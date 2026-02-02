import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AiRepository } from '$lib/repositories/ai/ai-repository';
import { pollingIntervals } from '$lib/server/ai/telegram-polling-store';

interface SetModeBody {
	botToken: string;
	mode: 'webhook' | 'polling';
	webhookUrl?: string;
	pollingInterval?: number;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = (await request.json()) as SetModeBody;
		const { botToken, mode, webhookUrl, pollingInterval = 2000 } = body;

		if (!botToken) {
			return json({ error: 'Bot token is required' }, { status: 400 });
		}

		const aiRepo = new AiRepository();
		const settings = await aiRepo.getTelegramSettings(locals.user.id);

		if (!settings) {
			return json({ error: 'Telegram settings not found' }, { status: 404 });
		}

		// Clear any existing polling for this user
		const existingInterval = pollingIntervals.get(locals.user.id);
		if (existingInterval) {
			clearInterval(existingInterval);
			pollingIntervals.delete(locals.user.id);
		}

		if (mode === 'polling') {
			// Delete webhook to enable polling
			await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
				method: 'POST'
			});

			// Start server-side polling
			let lastUpdateId = 0;

			const intervalId = setInterval(async () => {
				try {
					const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}`;
					const response = await fetch(url);
					const data = await response.json();

					if (data.ok && data.result && data.result.length > 0) {
						// Process updates through the webhook endpoint
						for (const update of data.result) {
							lastUpdateId = update.update_id;

							// Forward to our webhook handler
							await fetch(`${request.url.origin}/api/ai/telegram/webhook`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(update)
							});
						}
					}
				} catch (error) {
					console.error('[Telegram Polling] Error:', error);
				}
			}, pollingInterval);

			pollingIntervals.set(locals.user.id, intervalId);

			return json({
				success: true,
				isPolling: true,
				message: `Polling mode enabled (${pollingInterval / 1000}s interval)`
			});
		} else {
			// Webhook mode
			let webhookSet = false;
			if (webhookUrl) {
				const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ url: webhookUrl })
				});
				const data = await response.json();
				webhookSet = data.ok;
			}

			return json({
				success: true,
				isPolling: false,
				webhookSet,
				message: webhookSet ? 'Webhook mode enabled' : 'Webhook mode selected (not configured)'
			});
		}
	} catch (error) {
		console.error('[Telegram] Error setting mode:', error);
		return json({ error: 'Failed to set mode' }, { status: 500 });
	}
};
