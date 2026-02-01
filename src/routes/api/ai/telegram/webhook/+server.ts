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
	callback_query?: {
		id: string;
		from: {
			id: number;
		};
		message: {
			message_id: number;
			chat: {
				id: number;
			};
		};
		data: string;
	};
}

interface TelegramMessageResponse {
	method: string;
	chat_id: string | number;
	text: string;
	parse_mode?: string;
	reply_markup?: {
		inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
	};
}

// Store pending actions in memory per session (in production, use Redis or database)
const pendingActionsStore = new Map<string, any>();

export const POST: RequestHandler = async ({ request }) => {
	try {
		const update = (await request.json()) as TelegramUpdate;

		console.log('[Telegram Webhook] Received update:', JSON.stringify(update, null, 2));

		const aiRepo = new AiRepository();
		const db = aiRepo['db'];
		const { telegramSettings } = await import('$lib/server/db/schema');

		// Handle callback query (button presses)
		if (update.callback_query) {
			return await handleCallbackQuery(update.callback_query, aiRepo, db);
		}

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

		console.log(`[Telegram Webhook] Using session ${session.id}, aiSession ${session.aiSessionId}`);

		// Add user message to Telegram database
		console.log(`[Telegram Webhook] Saving user message to Telegram DB...`);
		await aiRepo.addTelegramMessage(userId, {
			sessionId: session.id,
			telegramMessageId,
			role: 'user',
			content: messageText
		});

		// Use AiAgent to process the message
		if (!session.aiSessionId) {
			await sendTelegramMessage(
				settings.botToken,
				telegramChatId,
				'Session error. Please start a new chat.'
			);
			return json({ ok: true });
		}

		console.log(`[Telegram Webhook] Processing with AiAgent...`);
		const agent = new AiAgent(userId);
		const response = await agent.processMessage(messageText, session.aiSessionId, [], undefined, undefined);

		console.log(`[Telegram Webhook] AI response:`, response.message?.substring(0, 100) + '...');

		// Check if there are pending write actions that need confirmation
		if (response.actions && response.actions.some((a) => a.type === 'write' && a.status === 'pending')) {
			// Store pending actions for later confirmation
			const pendingActions = response.actions.filter((a) => a.type === 'write' && a.status === 'pending');
			pendingActionsStore.set(session.aiSessionId, pendingActions);

			// Send message with inline keyboard for confirmation
			await sendTelegramConfirmation(
				settings.botToken,
				telegramChatId,
				response.message || 'Please confirm the following actions:',
				pendingActions,
				session.aiSessionId
			);

			// Store the assistant message in Telegram DB
			await aiRepo.addTelegramMessage(userId, {
				sessionId: session.id,
				telegramMessageId: 0,
				role: 'assistant',
				content: response.message || 'Actions pending confirmation'
			});

			return json({ ok: true });
		}

		// Send response back to Telegram
		if (response.message) {
			console.log(`[Telegram Webhook] Sending response to Telegram...`);
			await sendTelegramMessage(settings.botToken, telegramChatId, response.message);

			// Store the assistant message in Telegram database
			console.log(`[Telegram Webhook] Saving assistant message to Telegram DB...`);
			await aiRepo.addTelegramMessage(userId, {
				sessionId: session.id,
				telegramMessageId: 0,
				role: 'assistant',
				content: response.message
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

async function handleCallbackQuery(
	callbackQuery: TelegramUpdate['callback_query'],
	aiRepo: AiRepository,
	db: any
) {
	if (!callbackQuery) return json({ ok: true });

	const { telegramSettings } = await import('$lib/server/db/schema');
	const telegramChatId = callbackQuery.message.chat.id.toString();
	const callbackData = callbackQuery.data; // Format: "confirm:sessionId" or "reject:sessionId"

	console.log(`[Telegram Webhook] Callback query: ${callbackData}`);

	const [action, aiSessionId] = callbackData.split(':');

	// Get user settings
	const settingsResult = await db
		.select({
			userId: telegramSettings.userId,
			botToken: telegramSettings.botToken
		})
		.from(telegramSettings)
		.where(eq(telegramSettings.chatId, telegramChatId))
		.limit(1);

	if (!settingsResult || settingsResult.length === 0) {
		return json({ ok: true });
	}

	const { userId, botToken } = settingsResult[0];

	// Answer the callback query to remove the loading state
	await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			callback_query_id: callbackQuery.id
		})
	});

	if (action === 'confirm') {
		// Get pending actions
		const pendingActions = pendingActionsStore.get(aiSessionId);
		if (!pendingActions || pendingActions.length === 0) {
			await sendTelegramMessage(botToken, telegramChatId, 'No pending actions found.');
			pendingActionsStore.delete(aiSessionId);
			return json({ ok: true });
		}

		console.log(`[Telegram Webhook] Executing ${pendingActions.length} confirmed actions...`);

		// Execute each action and get final response
		const agent = new AiAgent(userId);
		let finalResponse = '';

		for (const pendingAction of pendingActions) {
			try {
				const result = await agent.processActionConfirmation(pendingAction, aiSessionId, []);
				finalResponse = result.message || 'Actions executed successfully.';
			} catch (error) {
				console.error('[Telegram Webhook] Error executing action:', error);
				finalResponse = 'Error executing action.';
			}
		}

		// Clear pending actions
		pendingActionsStore.delete(aiSessionId);

		// Send the final response
		await sendTelegramMessage(botToken, telegramChatId, finalResponse);

		// Save to Telegram DB
		const session = await aiRepo.getTelegramSessionByChatId(userId, telegramChatId);
		if (session) {
			await aiRepo.addTelegramMessage(userId, {
				sessionId: session.id,
				telegramMessageId: 0,
				role: 'assistant',
				content: finalResponse
			});
		}
	} else if (action === 'reject') {
		// Clear pending actions
		pendingActionsStore.delete(aiSessionId);
		await sendTelegramMessage(botToken, telegramChatId, 'Actions cancelled.');
	}

	return json({ ok: true });
}

// Helper function to send message to Telegram
async function sendTelegramMessage(
	botToken: string,
	chatId: string,
	text: string
): Promise<void> {
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

// Helper function to send confirmation message with inline keyboard
async function sendTelegramConfirmation(
	botToken: string,
	chatId: string,
	text: string,
	actions: any[],
	aiSessionId: string
): Promise<void> {
	const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

	// Build action descriptions
	const actionDescriptions = actions
		.map((a) => `• ${a.description}`)
		.join('\n');

	const fullText = `${text}\n\n${actionDescriptions}`;

	const body: TelegramMessageResponse = {
		method: 'sendMessage',
		chat_id: chatId,
		text: fullText,
		parse_mode: 'Markdown',
		reply_markup: {
			inline_keyboard: [
				[
					{ text: '✓ Confirm', callback_data: `confirm:${aiSessionId}` },
					{ text: '✗ Reject', callback_data: `reject:${aiSessionId}` }
				]
			]
		}
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
			console.error('Failed to send Telegram confirmation:', await response.text());
		}
	} catch (error) {
		console.error('Error sending Telegram confirmation:', error);
	}
}
