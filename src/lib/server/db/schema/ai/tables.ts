import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { textEnum } from '../../utils';
import { AIProvider, AIRole } from '../../../../models/ai';

/**
 * AI Settings Table
 * Stores configuration for AI providers and models
 */
export const aiSettings = sqliteTable('ai_settings', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull(),
	provider: textEnum('provider', AIProvider).notNull(),
	apiKey: text('api_key'),
	modelName: text('model_name').notNull(),
	systemPrompt: text('system_prompt'),
	baseUrl: text('base_url'),
	temperature: integer('temperature'), // Stored as integer (e.g. 70 for 0.7) or real if supported
	topP: integer('top_p'),
	maxTokens: integer('max_tokens'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
});

/**
 * AI Sessions Table
 * Groups messages into threads
 */
export const aiSessions = sqliteTable('ai_sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull(),
	title: text('title').notNull().default('New Chat'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
});

/**
 * AI Messages Table
 * Stores chat history for the AI assistant
 */
export const aiMessages = sqliteTable('ai_messages', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull(),
	sessionId: text('session_id')
		.notNull()
		.references(() => aiSessions.id, { onDelete: 'cascade' }),
	role: textEnum('role', AIRole).notNull(),
	content: text('content').notNull(),
	toolCallId: text('tool_call_id'),
	toolCalls: text('tool_calls'), // JSON string
	attachments: text('attachments'), // JSON string
	parts: text('parts'), // JSON string
	contextMetadata: text('context_metadata'), // JSON string for additional context
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
});

/**
 * AI Memories Table
 * Stores persistent context and user preferences
 */
export const aiMemories = sqliteTable('ai_memories', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull(),
	content: text('content').notNull(),
	importance: integer('importance').default(1), // 1-5
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
});
