import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import type { Theme } from '$lib/theme';

export const load: LayoutServerLoad = async ({ locals, url, cookies }) => {
	const session = locals.session;
	const isAuthPage =
		url.pathname === '/ui/login' || url.pathname === '/ui/signup' || url.pathname === '/ui/welcome';
	const isAuthenticated = !!session;

	if (!isAuthenticated && !isAuthPage) {
		// Preserve query parameters during redirect
		// Note: URL hash is not available server-side (never sent to server)
		const searchParams = url.searchParams.toString();
		console.log('[Auth Debug] Redirecting to /ui/welcome with params:', {
			searchParams,
			pathname: url.pathname
		});
		throw redirect(302, `/ui/welcome?${searchParams}`);
	}

	if (isAuthenticated && isAuthPage) {
		throw redirect(302, '/ui/dashboard');
	}

	const theme = (cookies.get('theme') as Theme) || 'light';

	return {
		session,
		theme
	};
};
