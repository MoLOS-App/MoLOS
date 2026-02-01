import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AiRepository } from '$lib/repositories/ai/ai-repository';
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

		console.log('[Telegram Webhook] Received update:', JSON.stringify(update, null, 2));

		if (!update.message || !update.message.text) {
			console.log('[Telegram Webhook] No message text, skipping');
			return json({ ok: true });
		}

		const messageText = update.message.text;
		const telegramChatId = update.message.chat.id.toString();
		const telegramMessageId = update.message.message_id;

		console.log(
			`[Telegram Webhook] Processing message from chat ${telegramChatId}: "${messageText}"`
		);

		// Find user by telegram chat_id
		const aiRepo = new AiRepository();

		// Get telegram settings by chat ID
		const db = aiRepo['db'];
		const { telegramSettings, aiSettings } = await import('$lib/server/db/schema');

		const settingsResult = await db
			.select({
				id: telegramSettings.id,
				userId: telegramSettings.userId,
				botToken: telegramSettings.botToken,
				chatId: telegramSettings.chatId,
				webhookUrl: telegramSettings.webhookUrl,
				modelName: telegramSettings.modelName,
				systemPrompt: telegramSettings.systemPrompt,
				temperature: telegramSettings.temperature,
				maxTokens: telegramSettings.maxTokens,
				enabled: telegramSettings.enabled
			})
			.from(telegramSettings)
			.where(eq(telegramSettings.chatId, telegramChatId))
			.limit(1);

		if (!settingsResult || settingsResult.length === 0) {
			console.log(`[Telegram Webhook] No user found for telegram chat_id: ${telegramChatId}`);
			return json({ ok: true });
		}

		const settings = settingsResult[0];
		const userId = settings.userId;

		console.log(`[Telegram Webhook] Found user ${userId} with enabled=${settings.enabled}`);

		if (!settings.enabled) {
			console.log('[Telegram Webhook] Telegram is disabled for user:', userId);
			return json({ ok: true });
		}

		// Get or create session for this telegram chat
		console.log(`[Telegram Webhook] Creating/getting session...`);
		const session = await aiRepo.getOrCreateTelegramSession(
			userId,
			telegramChatId,
			`Telegram Chat (${update.message.chat.title || telegramChatId})`
		);

		console.log(`[Telegram Webhook] Using session ${session.id}`);

		// Add user message to database
		console.log(`[Telegram Webhook] Saving user message...`);
		await aiRepo.addTelegramMessage(userId, {
			sessionId: session.id,
			telegramMessageId,
			role: 'user',
			content: messageText
		});

		// Get AI settings for LLM call
		const aiSettingsResult = await db
			.select()
			.from(aiSettings)
			.where(eq(aiSettings.userId, userId))
			.limit(1);

		if (!aiSettingsResult || aiSettingsResult.length === 0 || !aiSettingsResult[0].apiKey) {
			console.log('[Telegram Webhook] No AI settings found');
			await sendTelegramMessage(
				settings.botToken,
				telegramChatId,
				'I need an API key to function. Please configure your AI settings.'
			);
			return json({ ok: true });
		}

		const aiConfig = aiSettingsResult[0];

		// Get message history for context
		const history = await aiRepo.getTelegramMessages(session.id, userId, 10);

		// Build messages array for LLM
		const messages: Record<string, unknown>[] = [];

		// Add system prompt if available
		const systemPrompt =
			settings.systemPrompt ||
			aiConfig.systemPrompt ||
			'You are a helpful AI assistant. Be concise and friendly.';
		messages.push({ role: 'system', content: systemPrompt });

		// Add conversation history
		for (const msg of history) {
			messages.push({ role: msg.role, content: msg.content });
		}

		// Process with AI
		console.log(`[Telegram Webhook] Processing with AI...`);
		const response = await callLLM(
			messages,
			aiConfig.provider as string,
			aiConfig.apiKey as string,
			settings.modelName || aiConfig.modelName,
			aiConfig.baseUrl as string | undefined,
			settings.temperature ?? aiConfig.temperature,
			settings.maxTokens ?? aiConfig.maxTokens
		);

		console.log(`[Telegram Webhook] AI response:`, response?.substring(0, 100) + '...');

		// Send response back to Telegram
		if (response) {
			// Send message to Telegram via bot API
			console.log(`[Telegram Webhook] Sending response to Telegram...`);
			await sendTelegramMessage(settings.botToken, telegramChatId, response);

			// Store the assistant message in database
			console.log(`[Telegram Webhook] Saving assistant message...`);
			await aiRepo.addTelegramMessage(userId, {
				sessionId: session.id,
				telegramMessageId: 0, // We don't have a real message ID yet
				role: 'assistant',
				content: response
			});
		}

		return json({ ok: true });
	} catch (error) {
		console.error('[Telegram Webhook] Error:', error);
		if (error instanceof Error) {
			console.error('[Telegram Webhook] Error stack:', error.stack);
		}
		return json({ ok: false, error: 'Internal server error' }, { status: 500 });
	}
};

// Helper function to send message to Telegram
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

// Helper function to call LLM
async function callLLM(
	messages: Record<string, unknown>[],
	provider: string,
	apiKey: string,
	modelName: string,
	baseUrl?: string,
	temperature?: number | null,
	maxTokens?: number | null
): Promise<string | null> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};

	let endpoint = '';
	let body: Record<string, unknown> = {};

	if (provider === 'anthropic') {
		endpoint = 'https://api.anthropic.com/v1/messages';
		headers['x-api-key'] = apiKey;
		headers['anthropic-version'] = '2023-06-01';

		const systemMessage = messages.find((m) => m.role === 'system');
		const userMessages = messages.filter((m) => m.role !== 'system');

		body = {
			model: modelName,
			max_tokens: maxTokens || 4096,
			temperature: temperature !== null && temperature !== undefined ? temperature / 100 : undefined,
			system: systemMessage?.content,
			messages: userMessages.map((m) => ({ role: m.role, content: m.content }))
		};
	} else if (provider === 'openai') {
		endpoint = 'https://api.openai.com/v1/chat/completions';
		headers['Authorization'] = `Bearer ${apiKey}`;

		body = {
			model: modelName,
			temperature: temperature !== null && temperature !== undefined ? temperature / 100 : undefined,
			max_tokens: maxTokens || undefined,
			messages: messages
		};
	} else if (provider === 'openrouter') {
		endpoint = baseUrl || 'https://openrouter.ai/api/v1/chat/completions';
		headers['Authorization'] = `Bearer ${apiKey}`;
		headers['HTTP-Referer'] = 'https://molos.app';
		headers['X-Title'] = 'MoLOS';

		body = {
			model: modelName,
			temperature: temperature !== null && temperature !== undefined ? temperature / 100 : undefined,
			max_tokens: maxTokens || undefined,
			messages: messages
		};
	} else if (provider === 'ollama') {
		endpoint = `${baseUrl || 'http://localhost:11434'}/v1/chat/completions`;

		body = {
			model: modelName,
			temperature: temperature !== null && temperature !== undefined ? temperature / 100 : undefined,
			messages: messages
		};
	} else {
		return 'Error: Unsupported AI provider';
	}

	try {
		const res = await fetch(endpoint, {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const errorText = await res.text();
			console.error('LLM API error:', errorText);
			return `Error: AI provider returned ${res.status}`;
		}

		const data = await res.json();

		if (provider === 'anthropic') {
			const content = data.content?.find((c: any) => c.type === 'text')?.text;
			return content || null;
		} else {
			return data.choices?.[0]?.message?.content || null;
		}
	} catch (error) {
		console.error('LLM call error:', error);
		return 'Error: Failed to call AI provider';
	}
}
