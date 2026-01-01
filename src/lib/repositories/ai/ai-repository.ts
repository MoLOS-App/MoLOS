import { eq, desc } from 'drizzle-orm';
import { aiSettings, aiMessages, aiSessions, aiMemories } from '$lib/server/db/schema';
import type { AiSettings, AiMessage, AiSession } from '$lib/models/ai';
import { BaseRepository } from '../base-repository';

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
			.where(eq(aiMessages.sessionId, sessionId))
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
				userId,
				content,
				importance,
				createdAt: new Date(),
				updatedAt: new Date()
			} as any)
			.returning();
		return result[0];
	}
}
