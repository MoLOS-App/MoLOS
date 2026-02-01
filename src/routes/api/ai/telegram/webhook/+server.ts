import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AiRepository } from '$lib/repositories/ai/ai-repository';
import { AiAgent } from '$lib/server/ai/agent';
import { eq } from 'drizzle-orm';

interface TelegramUpdate {
	update_id: number;
	message?: {
		message_id: number;
		from: {
			id: number;
			first_name?: string;
			last_name?: string;
			username?: string;
		};
		chat: {
			id: number;
			type: string;
			title?: string;
		};
		text?: string;
	};
}

interface TelegramMessageResponse {
	method: string;
	chat_id: string | number;
	text: string;
	parse_mode?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const update = (await request.json()) as TelegramUpdate;

		if (!update.message || !update.message.text) {
			return json({ ok: true });
		}

		const messageText = update.message.text;
		const telegramChatId = update.message.chat.id.toString();
		const telegramMessageId = update.message.message_id;

		// Find user by telegram chat_id
		const aiRepo = new AiRepository();

		// Get telegram settings by chat ID - we need to query without userId filter
		// This requires a direct database query
		const db = aiRepo['db'];
		const { telegramSettings } = await import('$lib/server/db/schema');

		const settingsResult = await db
			.select()
			.from(telegramSettings)
			.where(eq(telegramSettings.chatId, telegramChatId))
			.limit(1);

		if (!settingsResult || settingsResult.length === 0) {
			console.log('No user found for telegram chat_id:', telegramChatId);
			return json({ ok: true });
		}

		const settings = settingsResult[0];
		const userId = settings.user_id;

		if (!settings.enabled) {
			console.log('Telegram is disabled for user:', userId);
			return json({ ok: true });
		}

		// Get or create session for this telegram chat
		const session = await aiRepo.getOrCreateTelegramSession(
			userId,
			telegramChatId,
			`Telegram Chat (${update.message.chat.title || telegramChatId})`
		);

		// Add user message to database
		await aiRepo.addTelegramMessage(userId, {
			sessionId: session.id,
			telegramMessageId,
			role: 'user',
			content: messageText
		});

		// Process with AI agent
		const agent = new AiAgent(userId);
		const response = await agent.processMessage(
			messageText,
			session.id,
			[], // No active modules for Telegram
			undefined,
			undefined,
			{
				provider: 'openai', // Use user's configured provider
				modelName: settings.model_name,
				systemPrompt: settings.system_prompt,
				temperature: settings.temperature,
				maxTokens: settings.max_tokens
			}
		);

		// Send response back to Telegram
		// Note: In a real implementation, you would make an HTTP request to Telegram's API
		// For now, we'll just store the assistant message
		if (response.message) {
			await aiRepo.addTelegramMessage(userId, {
				sessionId: session.id,
				telegramMessageId: 0, // We don't have a real message ID yet
				role: 'assistant',
				content: response.message
			});

			// TODO: Send message to Telegram via bot API
			// await sendTelegramMessage(settings.bot_token, telegramChatId, response.message);
		}

		return json({ ok: true });
	} catch (error) {
		console.error('Error in Telegram webhook:', error);
		return json({ ok: false, error: 'Internal server error' }, { status: 500 });
	}
};

// Helper function to send message to Telegram (to be implemented)
async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
	const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
	const body: TelegramMessageResponse = {
		method: 'sendMessage',
		chat_id: chatId,
		text: text,
		parse_mode: 'Markdown'
	};

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			console.error('Failed to send Telegram message:', await response.text());
		}
	} catch (error) {
		console.error('Error sending Telegram message:', error);
	}
}
