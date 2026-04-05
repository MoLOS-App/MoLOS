import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AiRepository } from '$lib/repositories/ai/ai-repository';
import { z } from 'zod';

const UpdateTelegramSettingsSchema = z.object({
	botToken: z.string().optional(),
	chatId: z.string().min(1, 'Chat ID is required'),
	modelName: z.string().optional(),
	webhookUrl: z.string().optional(),
	connectionMode: z.enum(['webhook', 'polling']).optional(),
	pollingInterval: z.number().min(1000).max(60000).optional(),
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

	// Return full bot token so it can be displayed with eye icon for privacy
	if (settings) {
		return json({ settings });
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

	// Handle webhook/polling mode
	const mode = result.data.connectionMode || updated.connectionMode || 'webhook';
	if (mode === 'webhook' && result.data.webhookUrl && updated.botToken) {
		// Register webhook with Telegram if webhookUrl is provided
		try {
			const webhookUrl = result.data.webhookUrl;
			const telegramApiUrl = `https://api.telegram.org/bot${updated.botToken}/setWebhook`;
			const response = await fetch(telegramApiUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: webhookUrl })
			});
			const data = await response.json();
			if (!data.ok) {
				console.error('[Telegram API] Failed to set webhook:', data.description);
			}
		} catch (error) {
			console.error('[Telegram API] Error setting webhook:', error);
		}
	}

	// Return actual bot token so it can be displayed with eye icon for privacy
	return json({ settings: updated });
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
