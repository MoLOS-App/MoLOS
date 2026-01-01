import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth-schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	return {
		user: locals.user
	};
};

export const actions: Actions = {
	update: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;

		if (!name || !email) {
			return fail(400, { message: 'Name and email are required' });
		}

		try {
			await db.update(user).set({ name, email }).where(eq(user.id, locals.user.id));

			return { success: true };
		} catch (e) {
			console.error('Failed to update profile:', e);
			return fail(500, { message: 'Failed to update profile' });
		}
	}
};
