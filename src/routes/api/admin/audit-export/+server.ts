import { error } from '@sveltejs/kit';
import { getAuditLogs, recordAuditLog } from '$lib/server/db';
import type { RequestHandler } from './$types';

const ACTION_MAP: Record<string, string> = {
	admin_login: 'เข้าสู่ระบบผู้ดูแล',
	save_stage: 'บันทึกแก้ไขด่าน',
	toggle_stage: 'เปิด/ปิดด่าน',
	reset_stage: 'รีเซ็ตด่านกลับค่าเริ่มต้น',
	impersonate_user: 'สวมบทบาทผู้เรียน',
	stop_impersonate: 'ออกจากโหมดสวมบทบาท',
	assign_teacher_intervention: 'มอบหมายชุดซ่อมเสริม',
	update_teacher_intervention: 'อัปเดตคำแนะนำซ่อมเสริม',
	update_listening_policy: 'เปลี่ยนนโยบายการฟังตัวอย่าง',
	update_pitch_sensitivity: 'ปรับความไวเสียงวรรณยุกต์',
	delete_mock_learners: 'ลบข้อมูลผู้เรียนจำลอง',
	sync_turso_to_neon: 'ซิงค์ฐานข้อมูลไปยัง Neon'
};

function formatThaiDate(ts: number): string {
	try {
		const d = new Date(ts);
		const pad = (n: number) => String(n).padStart(2, '0');
		const y = d.getFullYear();
		const m = pad(d.getMonth() + 1);
		const day = pad(d.getDate());
		const h = pad(d.getHours());
		const min = pad(d.getMinutes());
		const s = pad(d.getSeconds());
		return `${y}-${m}-${day} ${h}:${min}:${s}`;
	} catch {
		return String(ts);
	}
}

function escapeCsv(val: any): string {
	if (val === null || val === undefined) return '""';
	const str = String(val).replace(/"/g, '""');
	return `"${str}"`;
}

export const GET: RequestHandler = async ({ locals }) => {
	const admin = locals.realAdmin || locals.user;
	if (!admin?.isAdmin) {
		throw error(403, 'Forbidden: Admin access required');
	}

	const logs = await getAuditLogs(1000);

	// Record that admin exported audit logs
	await recordAuditLog({
		actorUsername: admin.username,
		action: 'export_audit_logs',
		resourceType: 'system',
		resourceId: 'audit_logs',
		details: `ส่งออกไฟล์ CSV Audit Logs จำนวน ${logs.length} รายการ`
	});

	const header = ['วัน-เวลา', 'แอดมินผู้กระทำ', 'การกระทำ', 'ประเภทเป้าหมาย', 'รหัสเป้าหมาย', 'รายละเอียด', 'หมายเลข IP'];
	const rows = [header.map(escapeCsv).join(',')];

	for (const log of logs) {
		const actionThai = ACTION_MAP[log.action] || log.action;
		rows.push(
			[
				escapeCsv(formatThaiDate(log.createdAt)),
				escapeCsv(log.actorUsername),
				escapeCsv(actionThai),
				escapeCsv(log.resourceType),
				escapeCsv(log.resourceId),
				escapeCsv(log.details || ''),
				escapeCsv(log.ipAddress || '')
			].join(',')
		);
	}

	// UTF-8 BOM (\uFEFF) ensures Microsoft Excel on Windows renders Thai characters cleanly without mojibake
	const csvContent = '\uFEFF' + rows.join('\r\n');
	const today = new Date().toISOString().slice(0, 10);

	return new Response(csvContent, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="audit_logs_${today}.csv"`,
			'Cache-Control': 'no-store'
		}
	});
};

