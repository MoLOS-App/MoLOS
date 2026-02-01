import { eq, desc, and } from 'drizzle-orm';
import {
	aiSettings,
	aiMessages,
	aiSessions,
	aiMemories,
	telegramSettings,
	telegramSessions,
	telegramMessages
} from '$lib/server/db/schema';
import type { AiSettings, AiMessage, AiSession, TelegramSettings, TelegramSession } from '$lib/models/ai';
import { BaseRepository } from '../base-repository';
import { uuid } from '$lib/utils/uuid';

export class AiRepository extends BaseRepository {
	private mapToSettings(row: Record<string, unknown>): AiSettings {
		return {
			...row,
			createdAt: new Date(row.createdAt as number),
			updatedAt: new Date(row.updatedAt as number)
		} as unknown as AiSettings;
	}

	private mapToSession(row: Record<string, unknown>): AiSession {
		return {
			...row,
			createdAt: new Date(row.createdAt as number),
			updatedAt: new Date(row.updatedAt as number)
		} as unknown as AiSession;
	}

	private mapToMessage(row: Record<string, unknown>): AiMessage {
		return {
			...row,
			toolCalls: row.toolCalls ? JSON.parse(row.toolCalls as string) : undefined,
			attachments: row.attachments ? JSON.parse(row.attachments as string) : undefined,
			parts: row.parts ? JSON.parse(row.parts as string) : undefined,
			createdAt: new Date(row.createdAt as number)
		} as unknown as AiMessage;
	}

	async getSettings(userId: string): Promise<AiSettings | null> {
		const result = await this.db
			.select()
			.from(aiSettings)
			.where(eq(aiSettings.userId, userId))
			.limit(1);

		return result[0] ? this.mapToSettings(result[0] as Record<string, unknown>) : null;
	}

	async updateSettings(
		userId: string,
		settings: Partial<Omit<AiSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
	): Promise<AiSettings> {
		const existing = await this.getSettings(userId);

		if (existing) {
			const result = await this.db
				.update(aiSettings)
				.set({
					...settings,
					updatedAt: new Date()
				} as any)
				.where(eq(aiSettings.userId, userId))
				.returning();
			return this.mapToSettings(result[0] as Record<string, unknown>);
		} else {
			const result = await this.db
				.insert(aiSettings)
				.values({
					id: uuid(),
					userId,
					provider: settings.provider || 'openai',
					modelName: settings.modelName || 'gpt-4o',
					...settings,
					updatedAt: new Date()
				} as any)
				.returning();
			return this.mapToSettings(result[0] as Record<string, unknown>);
		}
	}

	// Session Management
	async getSessions(userId: string): Promise<AiSession[]> {
		const result = await this.db
			.select()
			.from(aiSessions)
			.where(eq(aiSessions.userId, userId))
			.orderBy(desc(aiSessions.updatedAt));

		return result.map((row) => this.mapToSession(row as Record<string, unknown>));
	}

	async createSession(userId: string, title: string = 'New Chat'): Promise<AiSession> {
		const result = await this.db
			.insert(aiSessions)
			.values({
				id: uuid(),
				userId,
				title,
				createdAt: new Date(),
				updatedAt: new Date()
			} as any)
			.returning();

		return this.mapToSession(result[0] as Record<string, unknown>);
	}

	async deleteSession(sessionId: string): Promise<void> {
		await this.db.delete(aiSessions).where(eq(aiSessions.id, sessionId));
	}

	// Message Management
	async getMessages(sessionId: string, userId: string, limit: number = 50): Promise<AiMessage[]> {
		const result = await this.db
			.select()
			.from(aiMessages)
			.where(and(eq(aiMessages.sessionId, sessionId), eq(aiMessages.userId, userId)))
			.orderBy(desc(aiMessages.createdAt))
			.limit(limit);

		return result.reverse().map((row) => this.mapToMessage(row as Record<string, unknown>));
	}

	async addMessage(
		userId: string,
		message: Omit<AiMessage, 'id' | 'userId' | 'createdAt'>
	): Promise<AiMessage> {
		const { toolCallId, toolCalls, attachments, parts, ...rest } = message;

		const result = await this.db
			.insert(aiMessages)
			.values({
				id: uuid(),
				userId,
				...rest,
				toolCallId,
				toolCalls: toolCalls ? JSON.stringify(toolCalls) : undefined,
				attachments: attachments ? JSON.stringify(attachments) : undefined,
				parts: parts ? JSON.stringify(parts) : undefined,
				createdAt: new Date()
			} as any)
			.returning();

		// Update session timestamp
		await this.db
			.update(aiSessions)
			.set({ updatedAt: new Date() } as any)
			.where(eq(aiSessions.id, message.sessionId));

		return this.mapToMessage(result[0] as Record<string, unknown>);
	}

	async clearHistory(userId: string): Promise<void> {
		await this.db.delete(aiSessions).where(eq(aiSessions.userId, userId));
	}

	// Memory Management
	async getMemories(userId: string): Promise<any[]> {
		return await this.db
			.select()
			.from(aiMemories)
			.where(eq(aiMemories.userId, userId))
			.orderBy(desc(aiMemories.importance), desc(aiMemories.createdAt));
	}

	async addMemory(userId: string, content: string, importance: number = 1): Promise<any> {
		const result = await this.db
			.insert(aiMemories)
			.values({
				id: uuid(),
				userId,
				content,
				importance,
				createdAt: new Date(),
				updatedAt: new Date()
			} as any)
			.returning();
		return result[0];
	}

	// Telegram Settings Management
	async getTelegramSettings(userId: string): Promise<TelegramSettings | null> {
		const result = await this.db
			.select()
			.from(telegramSettings)
			.where(eq(telegramSettings.userId, userId))
			.limit(1);

		return result[0]
			? ({
					...result[0],
					createdAt: new Date(result[0].createdAt as number),
					updatedAt: new Date(result[0].updatedAt as number)
				} as unknown as TelegramSettings)
			: null;
	}

	async updateTelegramSettings(
		userId: string,
		settings: Partial<Omit<TelegramSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
	): Promise<TelegramSettings> {
		const existing = await this.getTelegramSettings(userId);

		if (existing) {
			const result = await this.db
				.update(telegramSettings)
				.set({
					...settings,
					updatedAt: new Date()
				} as any)
				.where(eq(telegramSettings.userId, userId))
				.returning();
			return {
				...result[0],
				createdAt: new Date(result[0].createdAt as number),
				updatedAt: new Date(result[0].updatedAt as number)
			} as unknown as TelegramSettings;
		} else {
			const result = await this.db
				.insert(telegramSettings)
				.values({
					id: uuid(),
					userId,
					botToken: settings.botToken || '',
					chatId: settings.chatId || '',
					modelName: settings.modelName || 'gpt-4o',
					enabled: settings.enabled ?? true,
					...settings,
					updatedAt: new Date()
				} as any)
				.returning();
			return {
				...result[0],
				createdAt: new Date(result[0].createdAt as number),
				updatedAt: new Date(result[0].updatedAt as number)
			} as unknown as TelegramSettings;
		}
	}

	// Telegram Session Management
	async getTelegramSessions(userId: string): Promise<TelegramSession[]> {
		const result = await this.db
			.select()
			.from(telegramSessions)
			.where(eq(telegramSessions.userId, userId))
			.orderBy(desc(telegramSessions.updatedAt));

		return result.map((row) => ({
			...row,
			createdAt: new Date(row.createdAt as number),
			updatedAt: new Date(row.updatedAt as number)
		})) as unknown as TelegramSession[];
	}

	async getTelegramSessionByChatId(
		userId: string,
		telegramChatId: string
	): Promise<TelegramSession | null> {
		const result = await this.db
			.select()
			.from(telegramSessions)
			.where(
				and(eq(telegramSessions.userId, userId), eq(telegramSessions.telegramChatId, telegramChatId))
			)
			.limit(1);

		return result[0]
			? ({
					...result[0],
					createdAt: new Date(result[0].createdAt as number),
					updatedAt: new Date(result[0].updatedAt as number)
				} as unknown as TelegramSession)
			: null;
	}

	async createTelegramSession(
		userId: string,
		telegramChatId: string,
		title: string = 'Telegram Chat'
	): Promise<TelegramSession> {
		const result = await this.db
			.insert(telegramSessions)
			.values({
				id: uuid(),
				userId,
				telegramChatId,
				title,
				createdAt: new Date(),
				updatedAt: new Date()
			} as any)
			.returning();

		return {
			...result[0],
			createdAt: new Date(result[0].createdAt as number),
			updatedAt: new Date(result[0].updatedAt as number)
		} as unknown as TelegramSession;
	}

	async getOrCreateTelegramSession(
		userId: string,
		telegramChatId: string,
		title: string = 'Telegram Chat'
	): Promise<TelegramSession> {
		const existing = await this.getTelegramSessionByChatId(userId, telegramChatId);
		if (existing) return existing;
		return await this.createTelegramSession(userId, telegramChatId, title);
	}

	// Telegram Message Management
	async getTelegramMessages(sessionId: string, userId: string, limit: number = 50): Promise<any[]> {
		const result = await this.db
			.select()
			.from(telegramMessages)
			.where(and(eq(telegramMessages.sessionId, sessionId), eq(telegramMessages.userId, userId)))
			.orderBy(desc(telegramMessages.createdAt))
			.limit(limit);

		return result.reverse().map((row) => ({
			...row,
			toolCalls: row.toolCalls ? JSON.parse(row.toolCalls as string) : undefined,
			createdAt: new Date(row.createdAt as number)
		}));
	}

	async addTelegramMessage(
		userId: string,
		message: Omit<any, 'id' | 'userId' | 'createdAt'>
	): Promise<any> {
		const { toolCallId, toolCalls, ...rest } = message;

		const result = await this.db
			.insert(telegramMessages)
			.values({
				id: uuid(),
				userId,
				...rest,
				toolCallId,
				toolCalls: toolCalls ? JSON.stringify(toolCalls) : undefined,
				createdAt: new Date()
			} as any)
			.returning();

		// Update session timestamp
		await this.db
			.update(telegramSessions)
			.set({ updatedAt: new Date() } as any)
			.where(eq(telegramSessions.id, message.sessionId));

		return {
			...result[0],
			toolCalls: result[0].toolCalls ? JSON.parse(result[0].toolCalls as string) : undefined,
			createdAt: new Date(result[0].createdAt as number)
		};
	}
}
