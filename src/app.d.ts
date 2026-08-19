// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user: { id: number; username: string; isAdmin: boolean } | null;
		}
		interface PageData {
			user: { id: number; username: string; isAdmin: boolean } | null;
		}
	}
}

export {};
