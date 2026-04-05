import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pollingIntervals } from '$lib/server/ai/telegram-polling-store';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const isPolling = pollingIntervals.has(locals.user.id);
	return json({ isPolling });
};
