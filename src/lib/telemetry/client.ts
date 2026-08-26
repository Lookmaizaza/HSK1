// src/lib/telemetry/client.ts
import type { PronunciationAssessmentTelemetry } from '$lib/xapi';

/**
 * ฟังก์ชันสำหรับหน้าบ้าน (Frontend) เพื่อส่งข้อมูลผลการตรวจวรรณยุกต์และการฟังเสียงตัวอย่างเข้า Backend
 */
export async function sendPronunciationTelemetry(telemetry: PronunciationAssessmentTelemetry) {
	try {
		const response = await fetch('/api/v1/telemetry/score-ingest', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(telemetry)
		});

		if (!response.ok) {
			const err = await response.json();
			console.error('[Telemetry] Failed to ingest:', err);
			return null;
		}

		const result = await response.json();
		console.log('[Telemetry] Ingested successfully:', result);
		return result;
	} catch (error) {
		console.error('[Telemetry] Network error:', error);
		return null;
	}
}

