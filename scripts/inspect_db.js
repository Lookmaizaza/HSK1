// scripts/inspect_db.js
// Database Inspection Tool for HSK Pronunciation Platform
// Run with: node scripts/inspect_db.js

import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';

const ENV_PATH = path.resolve('.env');
let tursoUrl = null;
let tursoAuthToken = null;

if (fs.existsSync(ENV_PATH)) {
	const envText = fs.readFileSync(ENV_PATH, 'utf-8');
	for (const line of envText.split(/\r?\n/)) {
		const [k, ...v] = line.trim().split('=');
		if (k === 'TURSO_DATABASE_URL') tursoUrl = v.join('=').trim();
		if (k === 'TURSO_AUTH_TOKEN') tursoAuthToken = v.join('=').trim();
	}
}

const isTursoCloud = !!tursoUrl && tursoUrl.startsWith('libsql://');
let client;

if (isTursoCloud) {
	console.log(`🌐 Connected to: Turso Cloud Database`);
	console.log(`🔗 Database URL: ${tursoUrl}\n`);
	client = createClient({ url: tursoUrl, authToken: tursoAuthToken });
} else {
	const DB_PATH = path.resolve('data/hsk.db');
	if (!fs.existsSync(DB_PATH)) {
		console.log(`⚠️ Database file not found at: ${DB_PATH}`);
		console.log('The database file will be automatically created on first run.\n');
		process.exit(0);
	}
	const stats = fs.statSync(DB_PATH);
	const sizeKb = (stats.size / 1024).toFixed(2);
	console.log(`📁 Connected to: Local SQLite Database`);
	console.log(`📦 Database File: ${DB_PATH} (${sizeKb} KB)\n`);
	client = createClient({ url: `file:${DB_PATH}` });
}

async function inspect() {
	try {
		// 1. Table Summary
		const tablesRes = await client.execute(
			"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
		);

		console.log('------------------------------------------------------');
		console.log('📊 TABLES & ROW COUNTS');
		console.log('------------------------------------------------------');

		const tableCounts = [];
		for (const row of tablesRes.rows) {
			const name = String(row.name);
			try {
				const countRes = await client.execute(`SELECT COUNT(*) as count FROM "${name}"`);
				const count = Number(countRes.rows[0]?.count ?? 0);
				tableCounts.push({ 'Table Name': name, 'Total Records': count });
			} catch (e) {
				tableCounts.push({ 'Table Name': name, 'Total Records': 'error' });
			}
		}
		console.table(tableCounts);

		// 2. Sample records from key tables
		async function printSample(tableName, title, columns) {
			try {
				const res = await client.execute(
					`SELECT * FROM "${tableName}" ORDER BY rowid DESC LIMIT 3`
				);
				console.log(`\n📋 Recent Records: ${title} (${tableName}) - ${res.rows.length} records:`);
				if (res.rows.length === 0) {
					console.log('   (ยังไม่มีข้อมูลในตารางนี้)');
					return;
				}
				const sanitized = res.rows.map((r) => {
					const obj = {};
					for (const col of columns) {
						let val = r[col];
						if (typeof val === 'string' && val.length > 35) {
							val = val.slice(0, 32) + '...';
						}
						obj[col] = val;
					}
					return obj;
				});
				console.table(sanitized);
			} catch (e) {
				// table might not have been created yet
			}
		}

		await printSample('users', 'ผู้ใช้งานในระบบ', ['id', 'username', 'created_at']);
		await printSample('user_consents', 'การยินยอม PDPA & Privacy', ['id', 'user_id', 'consent_type', 'granted', 'created_at']);
		await printSample('pronunciation_evaluations', 'ผลการประเมินเสียง (ภาพรวมคำ)', ['id', 'user_id', 'word_id', 'pinyin', 'gop_overall', 'tone_score']);
		await printSample('phoneme_evaluations', 'ผลการประเมินหน่วยเสียงละเอียด (Phoneme Breakdown)', ['id', 'user_id', 'word_id', 'phoneme', 'phoneme_type', 'gop', 'status', 'target', 'recognized']);
		await printSample('learning_events', 'เหตุการณ์การเรียนรู้ (xAPI Statements)', ['id', 'user_id', 'event_type', 'word_id', 'statement_id', 'created_at']);

		console.log('\n------------------------------------------------------');
		if (isTursoCloud) {
			console.log('💡 วิธีดูและจัดการข้อมูล Turso Cloud ผ่านหน้าเว็บ Dashboard:');
			console.log('   - ไปที่ https://app.turso.tech เพื่อดูตารางและคิวรีข้อมูลบนคลาวด์');
			console.log('   - หรือใช้คำสั่ง "turso db shell hsk-db-lookmaizaza" ใน CLI');
		} else {
			console.log('💡 วิธีเปิดดูข้อมูลด้วยโปรแกรมกราฟิก (GUI Tools):');
			console.log('   1. ใช้โปรแกรมฟรี "DB Browser for SQLite" (https://sqlitebrowser.org)');
			console.log('      -> กด Open Database แล้วเลือกไฟล์: data/hsk.db');
			console.log('   2. หรือใน VS Code ติดตั้ง Extension "SQLite Viewer"');
			console.log('      -> คลิกขวาที่ไฟล์ data/hsk.db แล้วเลือก Open With... -> SQLite Viewer');
		}
		console.log('======================================================\n');
	} catch (err) {
		console.error('Inspection error:', err);
	}
}

inspect();
