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

	if (!isAuthenticated && !isAuthPage && url.pathname.startsWith('/ui')) {
		// Check if there are any users in the DB to decide where to redirect
		const userCountResult = await db.all(sql`SELECT count(*) as count FROM user`);
		const userCount = (userCountResult[0] as unknown as { count: number }).count;

		if (userCount === 0) {
			throw redirect(302, '/ui/welcome');
		} else {
			throw redirect(302, '/ui/login');
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
