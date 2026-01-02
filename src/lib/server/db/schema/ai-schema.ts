import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { user } from './auth-schema';
import { textEnum } from '../utils';

export const AIProvider = {
	OPENAI: 'openai',
	ANTHROPIC: 'anthropic',
	OLLAMA: 'ollama',
	OPENROUTER: 'openrouter'
} as const;

export const AIRole = {
	USER: 'user',
	ASSISTANT: 'assistant',
	SYSTEM: 'system',
	TOOL: 'tool'
} as const;

/**
 * AI Settings - User AI Configuration
 * Stores AI provider settings and preferences for each user
 */
export const aiSettings = sqliteTable('ai_settings', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	provider: textEnum('provider', AIProvider).notNull().default(AIProvider.OPENAI),
	apiKey: text('api_key'),
	modelName: text('model_name').notNull().default('gpt-4o'),
	systemPrompt: text('system_prompt'),
	baseUrl: text('base_url'),
	temperature: real('temperature'),
	topP: real('top_p'),
	maxTokens: integer('max_tokens'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
});

/**
 * AI Sessions - Chat Sessions
 * Stores chat sessions for each user
 */
export const aiSessions = sqliteTable('ai_sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
});

/**
 * AI Messages - Chat Messages
 * Stores individual messages within chat sessions
 */
export const aiMessages = sqliteTable('ai_messages', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	sessionId: text('session_id')
		.notNull()
		.references(() => aiSessions.id, { onDelete: 'cascade' }),
	role: textEnum('role', AIRole).notNull(),
	content: text('content').notNull(),
	contextMetadata: text('context_metadata'),
	toolCallId: text('tool_call_id'),
	toolCalls: text('tool_calls', { mode: 'json' }),
	attachments: text('attachments', { mode: 'json' }),
	parts: text('parts', { mode: 'json' }),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
});

/**
 * AI Memories - Long-term Memory
 * Stores important information for AI context
 */
export const aiMemories = sqliteTable('ai_memories', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	content: text('content').notNull(),
	importance: integer('importance').notNull().default(1),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
});