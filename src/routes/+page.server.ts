import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Redirect root path '/' to the UI entry point
	throw redirect(302, '/ui');
};
