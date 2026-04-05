import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { AiRepository } from '$lib/repositories/ai/ai-repository';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const aiRepo = new AiRepository();
	const settings = await aiRepo.getSettings(locals.user.id);

	return {
		settings
	};
};
