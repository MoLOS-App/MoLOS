import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AiRepository } from '$lib/repositories/ai/ai-repository';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const aiRepo = new AiRepository();
	const messages = await aiRepo.getTelegramMessages(params.sessionId, locals.user.id);

	return json({ messages });
};
