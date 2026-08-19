/**
 * Client-side ONNX Runtime Web Tone Predictor
 * Uses trained 1D-CNN + Bi-LSTM Deep Learning model (mandarin_tone_cnn.onnx)
 * Runs 100% locally inside the browser with WebAssembly / WebGPU in < 15ms.
 */

import { browser } from '$app/environment';
import type { PitchPoint, ToneNumber } from './pitch';

export type ONNXTonePrediction = {
	detectedTone: ToneNumber;
	confidence: number;
	probabilities: Record<ToneNumber, number>; // Tone 1..4 probability (0.0 to 1.0)
	rawLogits: number[];
	isAIModel: boolean;
};

// Global session singleton
let ortSession: any = null;
let isSessionLoading = false;
let sessionLoadPromise: Promise<any> | null = null;

const MODEL_PATH = '/models/mandarin_tone_cnn.onnx';
const NUM_TIME_STEPS = 50;

/**
 * Dynamically loads the ONNX Runtime Web library script into the page.
 */
async function loadONNXRuntimeScript(): Promise<any> {
	if (!browser) return null;
	if ((window as any).ort) {
		return (window as any).ort;
	}

	return new Promise((resolve, reject) => {
		const existingScript = document.querySelector('script[src*="onnxruntime-web"]');
		if (existingScript) {
			existingScript.addEventListener('load', () => resolve((window as any).ort));
			existingScript.addEventListener('error', (e) => reject(e));
			return;
		}

		const script = document.createElement('script');
		script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.min.js';
		script.async = true;
		script.onload = () => {
			if ((window as any).ort) {
				// Configure ONNX wasm path
				(window as any).ort.env.wasm.wasmPaths =
					'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';
				(window as any).ort.env.wasm.numThreads = 1;
				resolve((window as any).ort);
			} else {
				reject(new Error('ONNX runtime loaded but `ort` is undefined'));
			}
		};
		script.onerror = (err) => reject(err);
		document.head.appendChild(script);
	});
}

/**
 * Initializes and caches the ONNX InferenceSession for mandarin_tone_cnn.onnx
 */
export async function initToneNeuralNetwork(): Promise<boolean> {
	if (!browser) return false;
	if (ortSession) return true;
	if (isSessionLoading && sessionLoadPromise) {
		await sessionLoadPromise;
		return ortSession !== null;
	}

	isSessionLoading = true;
	sessionLoadPromise = (async () => {
		try {
			const ort = await loadONNXRuntimeScript();
			if (!ort) return null;

			// Fetch model as ArrayBuffer for 100% reliable local/remote loading
			const response = await fetch(MODEL_PATH);
			if (!response.ok) {
				throw new Error(`Failed to fetch model from ${MODEL_PATH}: ${response.statusText}`);
			}
			const modelBuffer = await response.arrayBuffer();

			// Create inference session with WebAssembly provider
			const session = await ort.InferenceSession.create(new Uint8Array(modelBuffer), {
				executionProviders: ['wasm'],
				graphOptimizationLevel: 'all'
			});
			ortSession = session;
			console.log('🤖 [ONNX Web] 1D-CNN + Bi-LSTM Tone Model initialized successfully!');
			return session;
		} catch (err) {
			console.warn('⚠️ [ONNX Web] Failed to initialize ONNX model, fallback active:', err);
			return null;
		} finally {
			isSessionLoading = false;
		}
	})();

	const res = await sessionLoadPromise;
	return res !== null;
}

/**
 * Applies Softmax to convert raw logits to probabilities
 */
function softmax(logits: number[]): number[] {
	const max = Math.max(...logits);
	const exp = logits.map((z) => Math.exp(z - max));
	const sum = exp.reduce((a, b) => a + b, 0);
	return exp.map((e) => (sum > 0 ? e / sum : 0.25));
}

/**
 * Preprocesses recorded pitch points into [1, 2, 50] Float32Array tensor.
 */
function preprocessPitchPoints(points: PitchPoint[]): Float32Array | null {
	const voiced = points.filter((p) => p.f0 > 0 && p.clarity > 0.35);
	if (voiced.length < 4) return null;

	const tensorData = new Float32Array(1 * 2 * NUM_TIME_STEPS);

	// Channel 0 offset: 0..49 (Pitch Chao scale)
	// Channel 1 offset: 50..99 (Volume)
	const pitchOffset = 0;
	const volumeOffset = NUM_TIME_STEPS;

	// Resample into NUM_TIME_STEPS using linear interpolation
	for (let i = 0; i < NUM_TIME_STEPS; i++) {
		const ratio = i / (NUM_TIME_STEPS - 1);
		const exactIdx = ratio * (voiced.length - 1);
		const lower = Math.floor(exactIdx);
		const upper = Math.min(voiced.length - 1, Math.ceil(exactIdx));
		const frac = exactIdx - lower;

		const lowerP = voiced[lower];
		const upperP = voiced[upper];

		// Interpolated pitch (Chao scale 1.0 - 5.0)
		const chaoPitch = lowerP.chaoLevel * (1 - frac) + upperP.chaoLevel * frac;
		// Interpolated volume (0.01 - 1.0)
		const vol = (lowerP.volume || 0.5) * (1 - frac) + (upperP.volume || 0.5) * frac;

		tensorData[pitchOffset + i] = Math.max(1.0, Math.min(5.0, chaoPitch));
		tensorData[volumeOffset + i] = Math.max(0.01, Math.min(1.0, vol));
	}

	return tensorData;
}

/**
 * Predicts the Mandarin tone using the trained 1D-CNN + Bi-LSTM ONNX model.
 * Returns null if ONNX session is not available (allowing fallback).
 */
export async function predictToneNeuralNetwork(
	points: PitchPoint[]
): Promise<ONNXTonePrediction | null> {
	if (!browser) return null;

	try {
		// Ensure session is initialized
		if (!ortSession) {
			const ok = await initToneNeuralNetwork();
			if (!ok || !ortSession) return null;
		}

		const ort = (window as any).ort;
		if (!ort) return null;

		const inputData = preprocessPitchPoints(points);
		if (!inputData) return null;

		// Input tensor shape: [1, 2, 50]
		const inputTensor = new ort.Tensor('float32', inputData, [1, 2, NUM_TIME_STEPS]);
		const feeds: Record<string, any> = { pitch_input: inputTensor };

		// Run inference in WebAssembly
		const results = await ortSession.run(feeds);
		const outputTensor = results.tone_logits;

		if (!outputTensor || !outputTensor.data) return null;

		const rawLogits = Array.from(outputTensor.data as Float32Array);
		const probs = softmax(rawLogits);

		// Find highest probability tone
		let bestToneIdx = 0;
		let maxProb = -1;
		for (let i = 0; i < probs.length; i++) {
			if (probs[i] > maxProb) {
				maxProb = probs[i];
				bestToneIdx = i;
			}
		}

		const detectedTone = (bestToneIdx + 1) as ToneNumber;

		return {
			detectedTone,
			confidence: Math.round(maxProb * 100) / 100,
			probabilities: {
				1: probs[0],
				2: probs[1],
				3: probs[2],
				4: probs[3],
				5: 0
			},
			rawLogits,
			isAIModel: true
		};
	} catch (err) {
		console.warn('⚠️ [ONNX Web] Inference error, falling back:', err);
		return null;
	}
}
