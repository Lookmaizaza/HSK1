// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user: {
				id: number;
				username: string;
				isAdmin: boolean;
				role: 'admin' | 'user';
				isImpersonated?: boolean;
				realAdminUsername?: string;
			} | null;
			realAdmin?: { id: number; username: string; isAdmin: boolean; role: 'admin' } | null;
		}
		interface PageData {
			user: {
				id: number;
				username: string;
				isAdmin: boolean;
				role: 'admin' | 'user';
				isImpersonated?: boolean;
				realAdminUsername?: string;
			} | null;
		}
	}
}

export {};
