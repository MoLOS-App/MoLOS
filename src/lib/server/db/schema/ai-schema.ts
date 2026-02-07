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

export const TelegramConnectionMode = {
	WEBHOOK: 'webhook',
	POLLING: 'polling'
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
	streamEnabled: integer('stream_enabled', { mode: 'boolean' }).notNull().default(true),
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

/**
 * Telegram Settings - Telegram Bot Configuration
 * Stores Telegram bot configuration for each user
 */
export const telegramSettings = sqliteTable('telegram_settings', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	botToken: text('bot_token').notNull(),
	chatId: text('chat_id').notNull(),
	webhookUrl: text('webhook_url'),
	connectionMode: textEnum('connection_mode', TelegramConnectionMode)
		.notNull()
		.default(TelegramConnectionMode.WEBHOOK),
	pollingInterval: integer('polling_interval').notNull().default(2000),
	modelName: text('model_name').notNull().default('gpt-4o'),
	systemPrompt: text('system_prompt'),
	temperature: real('temperature'),
	maxTokens: integer('max_tokens'),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
});

/**
 * Telegram Sessions - Telegram Chat Sessions
 * Stores Telegram chat sessions for each user
 */
export const telegramSessions = sqliteTable('telegram_sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	aiSessionId: text('ai_session_id').references(() => aiSessions.id, { onDelete: 'cascade' }),
	telegramChatId: text('telegram_chat_id').notNull(),
	title: text('title').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
});

/**
 * Telegram Messages - Telegram Chat Messages
 * Stores individual messages within Telegram chat sessions
 */
export const telegramMessages = sqliteTable('telegram_messages', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	sessionId: text('session_id')
		.notNull()
		.references(() => telegramSessions.id, { onDelete: 'cascade' }),
	telegramMessageId: integer('telegram_message_id').notNull(),
	role: textEnum('role', AIRole).notNull(),
	content: text('content').notNull(),
	contextMetadata: text('context_metadata'),
	toolCallId: text('tool_call_id'),
	toolCalls: text('tool_calls', { mode: 'json' }),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
});

// ============================================================================
// MCP (Model Context Protocol) Tables
// ============================================================================

export const MCPApiKeyStatus = {
	ACTIVE: 'active',
	DISABLED: 'disabled',
	REVOKED: 'revoked'
} as const;

export const MCPLogStatus = {
	SUCCESS: 'success',
	ERROR: 'error'
} as const;

export const MCPResourceType = {
	STATIC: 'static',
	URL: 'url'
} as const;

/**
 * MCP API Keys - Scoped API keys for MCP access
 * Stores API keys with module-level access control
 */
export const aiMcpApiKeys = sqliteTable('ai_mcp_api_keys', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	keyPrefix: text('key_prefix').notNull(),
	keyHash: text('key_hash').notNull(),
	status: textEnum('status', MCPApiKeyStatus).notNull().default(MCPApiKeyStatus.ACTIVE),
	// Scoping - which modules this key can access
	allowedModules: text('allowed_modules', { mode: 'json' })
		.notNull()
		.default('[]')
		.$type<string[]>(),
	// Optional expiration
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
	// Last used tracking
	lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
	usageCount: integer('usage_count').notNull().default(0),
	// Audit
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
});

/**
 * MCP Logs - Request/Response logging with API key tracking
 * Stores history of MCP requests for debugging and audit trails
 */
export const aiMcpLogs = sqliteTable('ai_mcp_logs', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	apiKeyId: text('api_key_id').references(() => aiMcpApiKeys.id),
	sessionId: text('session_id').notNull(),
	requestId: text('request_id').notNull(),
	method: text('method').notNull(),
	toolName: text('tool_name'),
	resourceName: text('resource_name'),
	promptName: text('prompt_name'),
	params: text('params', { mode: 'json' }),
	result: text('result'),
	errorMessage: text('error_message'),
	status: textEnum('status', MCPLogStatus).notNull(),
	durationMs: integer('duration_ms'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
});

/**
 * MCP Resources - User-defined resources for MCP access
 * Stores resources that can be accessed via MCP protocol
 */
export const aiMcpResources = sqliteTable('ai_mcp_resources', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	uri: text('uri').notNull(),
	moduleId: text('module_id'),
	description: text('description').notNull(),
	resourceType: textEnum('resource_type', MCPResourceType)
		.notNull()
		.default(MCPResourceType.STATIC),
	url: text('url'), // For URL-based resources
	mimeType: text('mime_type').default('application/json'),
	metadata: text('metadata', { mode: 'json' }),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
});

/**
 * MCP Prompts - User-defined prompt templates for MCP
 * Stores prompt templates that can be accessed via MCP protocol
 */
export const aiMcpPrompts = sqliteTable('ai_mcp_prompts', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description').notNull(),
	arguments: text('arguments', { mode: 'json' })
		.notNull()
		.$type<Array<{ name: string; description: string; required?: boolean }>>(),
	moduleId: text('module_id'),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
});

// ============================================================================
// MCP OAuth 2.0 Tables
// ============================================================================

export const MCPOAuthClientStatus = {
	ACTIVE: 'active',
	DISABLED: 'disabled',
	REVOKED: 'revoked'
} as const;

export const MCPOAuthGrantType = {
	AUTHORIZATION_CODE: 'authorization_code',
	REFRESH_TOKEN: 'refresh_token',
	CLIENT_CREDENTIALS: 'client_credentials'
} as const;

export const MCPOAuthTokenType = {
	ACCESS: 'access',
	REFRESH: 'refresh'
} as const;

/**
 * MCP OAuth Clients - Dynamic client registration
 * Stores OAuth 2.0 client applications that can access MCP
 */
export const aiMcpOAuthClients = sqliteTable('ai_mcp_oauth_clients', {
	id: text('id').primaryKey(), // client_id
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	clientSecret: text('client_secret'), // hashed, null for public/PKCE clients
	redirectUris: text('redirect_uris', { mode: 'json' }).notNull().$type<string[]>(),
	scopes: text('scopes', { mode: 'json' }).$type<string[]>(),
	grantTypes: text('grant_types', { mode: 'json' }).notNull().$type<string[]>(),
	tokenEndpointAuthMethod: text('token_endpoint_auth_method').notNull().default('none'),
	status: textEnum('status', MCPOAuthClientStatus).notNull().default(MCPOAuthClientStatus.ACTIVE),
	// Client secret expiration (0 = no expiration, per RFC 7591)
	clientSecretExpiresAt: integer('client_secret_expires_at', { mode: 'timestamp_ms' }),
	// Metadata
	clientUri: text('client_uri'),
	logoUri: text('logo_uri'),
	contacts: text('contacts', { mode: 'json' }).$type<string[]>(),
	tosUri: text('tos_uri'),
	policyUri: text('policy_uri'),
	softwareId: text('software_id'),
	softwareVersion: text('software_version'),
	// Audit
	issuedAt: integer('issued_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
});

/**
 * MCP OAuth Authorization Codes - PKCE flow
 * Stores temporary authorization codes for the OAuth flow
 */
export const aiMcpOAuthCodes = sqliteTable('ai_mcp_oauth_codes', {
	id: text('id').primaryKey(),
	code: text('code').notNull().unique(),
	clientId: text('client_id')
		.notNull()
		.references(() => aiMcpOAuthClients.id),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	redirectUri: text('redirect_uri').notNull(),
	scopes: text('scopes', { mode: 'json' }).notNull().$type<string[]>(),
	// PKCE support
	codeChallenge: text('code_challenge').notNull(),
	codeChallengeMethod: text('code_challenge_method').notNull().default('S256'),
	// State for CSRF protection
	state: text('state'),
	// Resource indicator (RFC 8707)
	resource: text('resource'),
	// Expiration and consumption
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
	consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
});

/**
 * MCP OAuth Tokens - Access and refresh tokens
 * Stores OAuth tokens issued to clients
 */
export const aiMcpOAuthTokens = sqliteTable('ai_mcp_oauth_tokens', {
	id: text('id').primaryKey(),
	clientId: text('client_id')
		.notNull()
		.references(() => aiMcpOAuthClients.id),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	tokenType: textEnum('token_type', MCPOAuthTokenType).notNull().default(MCPOAuthTokenType.ACCESS),
	token: text('token').notNull().unique(),
	scopes: text('scopes', { mode: 'json' }).notNull().$type<string[]>(),
	// Token expiration
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
	// Refresh token linkage (for access tokens)
	refreshTokenId: text('refresh_token_id').references(() => aiMcpOAuthTokens.id),
	// Revocation
	revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
	// Audit
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
});
