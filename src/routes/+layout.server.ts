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

	// Check if any users exist in the database
	const userCountResult = await db.all(sql`SELECT count(*) as count FROM user`);
	const userCount = (userCountResult[0] as unknown as { count: number }).count;

	if (!isAuthenticated && !isAuthPage) {
		// Preserve query parameters during redirect
		// Note: URL hash is not available server-side (never sent to server)
		const searchParams = url.searchParams.toString();

		// Only redirect to /ui/welcome if NO users exist (first-time setup)
		// Otherwise redirect to /ui/login for authentication
		const redirectTarget = userCount === 0 ? '/ui/welcome' : '/ui/login';

		console.log('[Auth Debug] Redirecting to', redirectTarget, 'with params:', {
			searchParams,
			pathname: url.pathname,
			userCount
		});
		throw redirect(302, `${redirectTarget}${searchParams ? `?${searchParams}` : ''}`);
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
