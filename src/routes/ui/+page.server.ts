import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = locals.session;
	const isAuthenticated = !!session;
	if (isAuthenticated) {
		throw redirect(302, '/ui/dashboard');
	}
	throw redirect(302, '/ui/login');
};
