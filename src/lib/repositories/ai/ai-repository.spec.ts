import { describe, it, expect, beforeEach } from 'vitest';
import { AiRepository } from './ai-repository';
import { createTestDb } from '$lib/test-utils';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { AiSettings, AiSession, AiMessage } from '$lib/models/ai';

describe('AiRepository', () => {
	let db: BetterSQLite3Database<Record<string, unknown>>;
	let repository: AiRepository;
	const userId = 'test-user-1';
	const otherUserId = 'test-user-2';

	beforeEach(async () => {
		db = (await createTestDb()) as unknown as BetterSQLite3Database<Record<string, unknown>>;
		repository = new AiRepository(db);
	});

	describe('Settings', () => {
		it('should get settings for a user', async () => {
			const settings: Partial<AiSettings> = {
				provider: 'openai',
				modelName: 'gpt-4o',
				temperature: 0.7
			};

			await repository.updateSettings(userId, settings);
			const retrieved = await repository.getSettings(userId);

			expect(retrieved).not.toBeNull();
			expect(retrieved?.userId).toBe(userId);
			expect(retrieved?.provider).toBe('openai');
			expect(retrieved?.modelName).toBe('gpt-4o');
			expect(retrieved?.temperature).toBe(0.7);
		});

		it('should return null for non-existent settings', async () => {
			const retrieved = await repository.getSettings(userId);
			expect(retrieved).toBeNull();
		});

		it('should update existing settings', async () => {
			await repository.updateSettings(userId, { provider: 'openai', modelName: 'gpt-4o' });
			await repository.updateSettings(userId, { temperature: 0.8, maxTokens: 1000 });

			const retrieved = await repository.getSettings(userId);
			expect(retrieved?.temperature).toBe(0.8);
			expect(retrieved?.maxTokens).toBe(1000);
			expect(retrieved?.provider).toBe('openai');
		});
	});

	describe('Sessions', () => {
		it('should create and retrieve sessions', async () => {
			const session = await repository.createSession(userId, 'Test Session');
			expect(session.id).toBeDefined();
			expect(session.userId).toBe(userId);
			expect(session.title).toBe('Test Session');

			const sessions = await repository.getSessions(userId);
			expect(sessions.length).toBe(1);
			expect(sessions[0].id).toBe(session.id);
		});

		it('should not retrieve sessions from other users', async () => {
			await repository.createSession(otherUserId, 'Other Session');
			const sessions = await repository.getSessions(userId);
			expect(sessions.length).toBe(0);
		});

		it('should delete a session', async () => {
			const session = await repository.createSession(userId, 'To Delete');
			await repository.deleteSession(session.id);

			const sessions = await repository.getSessions(userId);
			expect(sessions.length).toBe(0);
		});
	});

	describe('Messages', () => {
		let session: AiSession;

		beforeEach(async () => {
			session = await repository.createSession(userId, 'Test Session');
		});

		it('should add and retrieve messages', async () => {
			const messageData: Omit<AiMessage, 'id' | 'userId' | 'createdAt'> = {
				sessionId: session.id,
				role: 'user',
				content: 'Hello AI'
			};

			const message = await repository.addMessage(userId, messageData);
			expect(message.id).toBeDefined();
			expect(message.userId).toBe(userId);
			expect(message.content).toBe('Hello AI');

			const messages = await repository.getMessages(session.id, userId);
			expect(messages.length).toBe(1);
			expect(messages[0].content).toBe('Hello AI');
		});

		it('should handle complex message data', async () => {
			const messageData: Omit<AiMessage, 'id' | 'userId' | 'createdAt'> = {
				sessionId: session.id,
				role: 'assistant',
				content: 'Response',
				toolCalls: [{ id: 'call1', type: 'function', function: { name: 'test', arguments: '{}' } }],
				attachments: [{ name: 'file.txt' }],
				parts: [{ type: 'text', text: 'part1' }]
			};

			await repository.addMessage(userId, messageData);
			const retrieved = await repository.getMessages(session.id, userId);

			expect(retrieved[0].toolCalls).toEqual(messageData.toolCalls);
			expect(retrieved[0].attachments).toEqual(messageData.attachments);
			expect(retrieved[0].parts).toEqual(messageData.parts);
		});

		it('should limit message retrieval', async () => {
			for (let i = 0; i < 5; i++) {
				await repository.addMessage(userId, {
					sessionId: session.id,
					role: 'user',
					content: `Message ${i}`
				});
			}

			const messages = await repository.getMessages(session.id, userId, 3);
			expect(messages.length).toBe(3);
		});
	});

	describe('History', () => {
		it('should clear history for a user', async () => {
			await repository.createSession(userId, 'Session 1');
			await repository.createSession(userId, 'Session 2');

			let sessions = await repository.getSessions(userId);
			expect(sessions.length).toBe(2);

			await repository.clearHistory(userId);

			sessions = await repository.getSessions(userId);
			expect(sessions.length).toBe(0);
		});
	});

	describe('Memories', () => {
		it('should add and retrieve memories', async () => {
			const memory = await repository.addMemory(userId, 'Test memory', 5);
			expect(memory.id).toBeDefined();
			expect(memory.content).toBe('Test memory');
			expect(memory.importance).toBe(5);

			const memories = await repository.getMemories(userId);
			expect(memories.length).toBe(1);
			expect(memories[0].content).toBe('Test memory');
		});

		it('should order memories by importance and date', async () => {
			await repository.addMemory(userId, 'Low importance', 1);
			await repository.addMemory(userId, 'High importance', 10);
			await repository.addMemory(userId, 'Medium importance', 5);

			const memories = await repository.getMemories(userId);
			expect(memories[0].importance).toBe(10);
			expect(memories[1].importance).toBe(5);
			expect(memories[2].importance).toBe(1);
		});
	});
});
