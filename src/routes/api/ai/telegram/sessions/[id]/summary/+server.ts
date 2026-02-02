import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AiRepository } from '$lib/repositories/ai/ai-repository';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const aiRepo = new AiRepository();
	const summary = await aiRepo.getTelegramSessionSummary(params.id, locals.user.id);

	if (!summary) {
		return json({ error: 'Session not found' }, { status: 404 });
	}

	return json(summary);
};
