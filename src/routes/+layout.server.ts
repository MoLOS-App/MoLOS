import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { sql, count } from 'drizzle-orm';
import type { Theme } from '$lib/theme';
import { user } from '@molos/database/schema';

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

		// Check if any users exist in the database
		const [userCount] = await db.select({ count: count() }).from(user);
		const hasUsers = (userCount?.count ?? 0) > 0;

		console.log('[Auth Debug] Redirecting with params:', {
			searchParams,
			pathname: url.pathname,
			hasUsers
		});

		if (hasUsers) {
			// Users exist → redirect to login
			throw redirect(302, `/ui/login?${searchParams}`);
		} else {
			// No users → redirect to welcome
			throw redirect(302, `/ui/welcome?${searchParams}`);
		}
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
