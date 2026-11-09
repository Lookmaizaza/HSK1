import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getUserFullDetail } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals, params }) => {
	// Security: Only authenticated administrators can inspect learner deep details
	const admin = locals.realAdmin || locals.user;
	if (!admin) {
		throw error(401, 'Unauthorized: กรุณาเข้าสู่ระบบในฐานะผู้ดูแลระบบ');
	}
	if (!admin.isAdmin) {
		throw error(403, 'Forbidden: บัญชีของคุณไม่มีสิทธิ์ผู้ดูแลระบบ (Admin)');
	}

	const userId = Number(params.id);
	if (!userId || isNaN(userId) || userId <= 0) {
		throw error(400, 'Invalid user ID: รหัสผู้เรียนไม่ถูกต้อง');
	}

	try {
		const detail = await getUserFullDetail(userId);
		if (!detail) {
			throw error(404, 'User not found: ไม่พบข้อมูลผู้เรียนคนนี้ในฐานข้อมูล');
		}

		return json(detail, {
			headers: {
				'Cache-Control': 'no-store, no-cache, must-revalidate'
			}
		});
	} catch (e: any) {
		if (e?.status) throw e;
		console.error(`Failed to fetch user full detail for user ${userId}:`, e);
		throw error(500, 'Internal Server Error: ไม่สามารถดึงข้อมูลผู้เรียนได้');
	}
};

