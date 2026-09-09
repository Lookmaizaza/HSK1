// src/lib/server/neon.ts
import { neon } from '@neondatabase/serverless';
import { env } from '$env/dynamic/private';
import type { TargetPhonemeDetail } from '$lib/telemetry/adapter';

const NEON_URL =
	env.NEON_DATABASE_URL ||
	env.DATABASE_URL ||
	process.env.NEON_DATABASE_URL ||
	process.env.DATABASE_URL ||
	'postgresql://neondb_owner:npg_r0PXAKtfN6pU@ep-fragrant-union-azixkbg8-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

let isSchemaInitialized = false;

function getNeonClient() {
	return neon(NEON_URL);
}

/**
 * Initializes Neon schema for research phoneme evaluations and xAPI events.
 */
export async function initNeonSchema() {
	if (isSchemaInitialized) return;
	try {
		const sql = getNeonClient();
		// 1. Table for detailed phoneme breakdown (Phonetic Evaluation Analytics)
		await sql`
			CREATE TABLE IF NOT EXISTS phoneme_evaluations (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				user_id VARCHAR(100) NOT NULL,
				word_id VARCHAR(50) NOT NULL,
				pinyin VARCHAR(100) NOT NULL,
				phoneme VARCHAR(20) NOT NULL,
				phoneme_type VARCHAR(20) NOT NULL,
				gop NUMERIC(5, 2) NOT NULL,
				status VARCHAR(20) NOT NULL,
				target VARCHAR(20) NOT NULL,
				recognized VARCHAR(20) NOT NULL,
				created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			);
		`;

		await sql`
			CREATE INDEX IF NOT EXISTS idx_phoneme_eval_phoneme ON phoneme_evaluations(phoneme);
		`;
		await sql`
			CREATE INDEX IF NOT EXISTS idx_phoneme_eval_user ON phoneme_evaluations(user_id);
		`;

		isSchemaInitialized = true;
		console.log('✅ [Neon DB] Connected and verified phoneme_evaluations table in Neon PostgreSQL.');
	} catch (err) {
		console.warn('⚠️ [Neon DB Initialization Warning]:', err);
	}
}

/**
 * Archives granular phoneme breakdown records directly into Neon PostgreSQL for academic research.
 */
export async function recordPhonemesToNeon(params: {
	userId: string;
	wordId: string;
	pinyin: string;
	phonemeDetails: TargetPhonemeDetail[];
	xapiStatement?: any;
}) {
	try {
		await initNeonSchema();
		const sql = getNeonClient();

		if (params.phonemeDetails && params.phonemeDetails.length > 0) {
			for (const p of params.phonemeDetails) {
				// แบบที่ 3: กรองตัดพวกโค้ดที่เกิดจากบั๊กตัดพยางค์ทิ้ง
				if (p.phoneme.length > 5 || p.phoneme.startsWith('a') && p.phoneme.length > 3) {
					continue;
				}
				await sql`
					INSERT INTO phoneme_evaluations (
						user_id, word_id, pinyin, phoneme, phoneme_type, gop, status, target, recognized, created_at
					) VALUES (
						${params.userId},
						${params.wordId},
						${params.pinyin},
						${p.phoneme},
						${p.type},
						${p.gop},
						${p.status},
						${p.target},
						${p.recognized},
						CURRENT_TIMESTAMP
					);
				`;
			}
			console.log(`📡 [Neon DB Archive] Saved ${params.phonemeDetails.length} phoneme evaluation records to Neon.`);
		}
	} catch (err) {
		console.warn('⚠️ [Neon DB Phoneme Ingestion Warning - Non-fatal]:', err);
	}
}
