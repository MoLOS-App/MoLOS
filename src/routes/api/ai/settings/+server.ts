import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AiRepository } from '$lib/repositories/ai/ai-repository';
import { z } from 'zod';
import { AIProvider } from '$lib/models/ai';

const UpdateAiSettingsSchema = z.object({
	provider: z.nativeEnum(AIProvider).optional(),
	apiKey: z.string().optional(),
	modelName: z.string().optional(),
	systemPrompt: z.string().optional(),
	baseUrl: z.string().optional(),
	temperature: z.number().optional(),
	topP: z.number().optional(),
	maxTokens: z.number().optional(),
	streamEnabled: z.boolean().optional()
});

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const aiRepo = new AiRepository();
	const settings = await aiRepo.getSettings(locals.user.id);

	return json({ settings });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const result = UpdateAiSettingsSchema.safeParse(body);

	if (!result.success) {
		return json({ error: result.error.issues[0].message }, { status: 400 });
	}

	const aiRepo = new AiRepository();
	const updated = await aiRepo.updateSettings(locals.user.id, result.data);

	return json({ settings: updated });
};
