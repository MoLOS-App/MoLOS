import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AiRepository } from '$lib/repositories/ai/ai-repository';
import { z } from 'zod';

const UpdateTelegramSettingsSchema = z.object({
	botToken: z.string().min(1, 'Bot token is required').optional(),
	chatId: z.string().min(1, 'Chat ID is required'),
	modelName: z.string().optional(),
	webhookUrl: z.string().optional(),
	systemPrompt: z.string().optional(),
	temperature: z.number().min(0).max(2).optional(),
	maxTokens: z.number().positive().optional(),
	enabled: z.boolean().optional()
});

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const aiRepo = new AiRepository();
	const settings = await aiRepo.getTelegramSettings(locals.user.id);

	// Don't expose full bot token in GET response
	if (settings) {
		const maskedSettings = {
			...settings,
			botToken: settings.botToken ? settings.botToken.slice(0, 10) + '...' : ''
		};
		return json({ settings: maskedSettings });
	}

	return json({ settings: null });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const result = UpdateTelegramSettingsSchema.safeParse(body);

	if (!result.success) {
		return json({ error: result.error.issues[0].message }, { status: 400 });
	}

	const aiRepo = new AiRepository();
	const updated = await aiRepo.updateTelegramSettings(locals.user.id, result.data);

	// Don't expose full bot token in response
	const maskedSettings = {
		...updated,
		botToken: updated.botToken ? updated.botToken.slice(0, 10) + '...' : ''
	};

	return json({ settings: maskedSettings });
};

export const DELETE: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const aiRepo = new AiRepository();
	await aiRepo.updateTelegramSettings(locals.user.id, {
		botToken: '',
		chatId: '',
		enabled: false
	});

	return json({ success: true });
};
