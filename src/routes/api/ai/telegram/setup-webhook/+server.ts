import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AiRepository } from '$lib/repositories/ai/ai-repository';
import { env } from '$env/dynamic/public';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { botToken, customWebhookUrl } = body;

		if (!botToken) {
			return json({ error: 'Bot token is required' }, { status: 400 });
		}

		// Build the webhook URL - use custom URL if provided, otherwise use current host
		let webhookUrl = customWebhookUrl;
		if (!webhookUrl) {
			const protocol = url.protocol;
			const host = url.host;

			// Check if we're in development and need HTTPS
			if (protocol === 'http:' && !env.PUBLIC_ENABLE_HTTP_WEBHOOK) {
				return json(
					{
						error:
							'Telegram requires HTTPS webhooks. For local development, use ngrok/localtunnel, or provide a custom HTTPS webhook URL.',
						devMode: true,
						needsHttps: true
					},
					{ status: 400 }
				);
			}

			webhookUrl = `${protocol}//${host}/api/ai/telegram/webhook`;
		} else {
			// Ensure custom webhook URL has the full path
			if (!webhookUrl.includes('/api/ai/telegram/webhook')) {
				webhookUrl = webhookUrl.replace(/\/$/, '') + '/api/ai/telegram/webhook';
			}
		}

		console.log('[Telegram Setup] Setting webhook:', webhookUrl);

		// Call Telegram API to set webhook
		const telegramUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;
		const response = await fetch(telegramUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				url: webhookUrl
			})
		});

		const data = await response.json();

		if (data.ok) {
			// Save the webhook URL to the database
			const aiRepo = new AiRepository();
			await aiRepo.updateTelegramSettings(locals.user.id, {
				botToken,
				webhookUrl
			});

			return json({
				success: true,
				webhookUrl,
				message: 'Webhook set successfully. Your bot is now connected!'
			});
		} else {
			return json(
				{
					error: `Failed to set webhook: ${data.description || 'Unknown error'}`
				},
				{ status: 400 }
			);
		}
	} catch (error) {
		console.error('Error setting webhook:', error);
		return json({ error: 'Failed to set webhook' }, { status: 500 });
	}
};

// Get webhook info
export const GET: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const url = new URL(request.url);
		const botToken = url.searchParams.get('botToken');

		if (!botToken) {
			return json({ error: 'Bot token is required' }, { status: 400 });
		}

		// Get current webhook info
		const telegramUrl = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
		const response = await fetch(telegramUrl);
		const data = await response.json();

		if (data.ok) {
			return json({ webhookInfo: data.result });
		} else {
			return json({ error: data.description }, { status: 400 });
		}
	} catch (error) {
		console.error('Error getting webhook info:', error);
		return json({ error: 'Failed to get webhook info' }, { status: 500 });
	}
};
