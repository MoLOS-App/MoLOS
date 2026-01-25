import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from '../../$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

export const load: LayoutServerLoad = async () => {
	// Check if there are any users in the DB to decide where to redirect
	const userCountResult = await db.all(sql`SELECT count(*) as count FROM user`);
	const userCount = (userCountResult[0] as unknown as { count: number }).count;

	if (userCount === 0) {
		throw redirect(302, '/ui/welcome');
	}
};
