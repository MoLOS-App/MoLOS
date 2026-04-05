/**
 * Zod Schemas for Agent Configuration Validation
 *
 * This module provides type-safe validation schemas for all configuration
 * objects in the agent system. Using Zod ensures runtime validation
 * with full type inference.
 *
 * ## Schema Design Principles
 *
 * 1. **Allow extras**: Schemas use `.catchall()` to allow additional fields
 *    that may be present in config objects without breaking validation
 * 2. **Sensible defaults**: Use `.default()` for optional values
 * 3. **Clear error messages**: Custom error messages for common validation failures
 * 4. **Comprehensiveness**: Cover all config fields found in the codebase
 *
 * @module config/schemas
 */

import { z } from 'zod';
import { SCHEMA, AGENT, TOOL, PROVIDER } from '../constants.js';

// =============================================================================
// LLM Provider Types
// =============================================================================

/**
 * Supported LLM providers in the factory
 */
export const LlmProviderSchema = z.enum([
	'openai',
	'anthropic',
	'openrouter',
	'ollama',
	'zai',
	'groq',
	'deepseek',
	'google',
	'mistral',
	'moonshot',
	'xai',
	'minimax',
	'minimax-coding'
]);

export type LlmProvider = z.infer<typeof LlmProviderSchema>;

/**
 * Thinking levels for extended thinking budgets
 */
export const ThinkingLevelSchema = z.enum(['off', 'minimal', 'low', 'medium', 'high']);
export type ThinkingLevel = z.infer<typeof ThinkingLevelSchema>;

// =============================================================================
// Provider Config Schema (factory.ts ProviderConfig)
// =============================================================================

/**
 * Provider configuration schema for creating LLM provider instances.
 * Used by the provider factory to validate config before creating providers.
 */
export const ProviderConfigSchema = z
	.object({
		provider: LlmProviderSchema,
		modelName: z.string().min(1, 'modelName is required'),
		apiKey: z.string().optional(),
		baseUrl: z.string().url().optional().or(z.string().optional()),
		/** Multiple keys for failover */
		apiKeys: z.array(z.string()).optional(),
		/** Provider-specific options */
		thinkingLevel: ThinkingLevelSchema.optional(),
		temperature: z.number().min(0).max(2).optional(),
		topP: z.number().min(0).max(1).optional(),
		maxTokens: z.number().positive().optional(),
		extraBody: z.record(z.string(), z.unknown()).optional()
	})
	.catchall(z.unknown());

export type ValidatedProviderConfig = z.infer<typeof ProviderConfigSchema>;

// =============================================================================
// Model Config Schema (factory.ts ModelConfig)
// =============================================================================

/**
 * Model configuration schema with detailed provider settings
 */
export const ModelConfigSchema = z
	.object({
		/** Display name (e.g., "gpt-4o") */
		name: z.string().min(1, 'Model name is required'),
		/** Provider identifier */
		provider: LlmProviderSchema,
		/** Protocol identifier (e.g., "openai/gpt-4o") */
		model: z.string().min(1, 'Model identifier is required'),
		/** Custom API base URL */
		apiBase: z.string().url().optional(),
		/** Proxy URL */
		proxy: z.string().optional(),
		/** References to fallback model names */
		fallbacks: z.array(z.string()).optional(),
		/** Auth method (e.g., "oauth", "token") */
		authMethod: z.string().optional(),
		/** Connection mode (e.g., "grpc", "http") */
		connectMode: z.string().optional(),
		/** Workspace path for CLI providers */
		workspace: z.string().optional(),
		/** Requests per minute limit */
		rpm: z.number().positive().optional(),
		/** Custom max tokens field name */
		maxTokensField: z.string().optional(),
		/** Request timeout in seconds */
		requestTimeout: z.number().positive().optional(),
		/** Thinking level */
		thinkingLevel: ThinkingLevelSchema.optional(),
		/** Extra body parameters */
		extraBody: z.record(z.string(), z.unknown()).optional(),
		/** Security (private, not serialized) - array of API keys */
		_apiKeys: z.array(z.string()).optional()
	})
	.catchall(z.unknown());

export type ValidatedModelConfig = z.infer<typeof ModelConfigSchema>;

// =============================================================================
// Tool Registry Config Schema (registry.ts ToolRegistryConfig)
// =============================================================================

/**
 * Tool registry configuration schema
 */
export const ToolRegistryConfigSchema = z.object({
	maxConcurrent: z.number().positive().int().min(1).optional().default(TOOL.MAX_CONCURRENT)
});

export type ValidatedToolRegistryConfig = z.infer<typeof ToolRegistryConfigSchema>;

// =============================================================================
// Tool Definition Schema (types/index.ts ToolDefinition)
// =============================================================================

/**
 * Parameter schema for a tool (JSON Schema compatible)
 * Uses z.unknown() for recursive fields to avoid circular reference issues
 */
export const ToolParameterSchemaSchema: z.ZodType<unknown> = z.lazy(() =>
	z.object({
		type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']),
		description: z.string().optional(),
		enum: z.array(z.unknown()).optional(),
		default: z.unknown().optional(),
		minimum: z.number().optional(),
		maximum: z.number().optional(),
		minLength: z.number().optional(),
		maxLength: z.number().optional(),
		pattern: z.string().optional(),
		items: ToolParameterSchemaSchema.optional(),
		properties: z.record(z.string(), ToolParameterSchemaSchema).optional(),
		required: z.array(z.string()).optional(),
		additionalProperties: z.boolean().optional()
	})
);

export type ValidatedToolParameterSchema = z.infer<typeof ToolParameterSchemaSchema>;

/**
 * Tool definition schema - metadata for tools available to the agent
 */
export const ToolDefinitionSchema = z
	.object({
		name: z.string().min(1, 'Tool name is required'),
		description: z.string().min(1, 'Tool description is required'),
		parameters: z.object({
			type: z.literal('object'),
			properties: z.record(z.string(), ToolParameterSchemaSchema),
			required: z.array(z.string()).optional(),
			additionalProperties: z.boolean().optional()
		}),
		/** Whether this tool is async (default: true) */
		async: z.boolean().optional().default(true),
		/** Whether to include the full schema in LLM requests */
		includeSchemaInRequest: z.boolean().optional()
	})
	.catchall(z.unknown());

export type ValidatedToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// =============================================================================
// Agent Config Schema (extends types/index.ts AgentConfigSchema)
// =============================================================================

/**
 * Agent loop configuration with multi-provider support.
 * This is the main config type used by AgentLoop.
 *
 * Note: The providers field is kept permissive (z.array(z.any())) because
 * the AgentLoop actually receives the provider via constructor injection
 * (provider: LLMProviderClient), not from the config array.
 */
export const AgentLoopConfigSchema = z.object({
	/** Unique identifier for this agent configuration */
	id: z.string().min(1, 'AgentLoopConfig requires an id'),
	/** System prompt for the agent */
	systemPrompt: z.string().optional(),
	/** Model to use (e.g., "gpt-4o", "claude-3-sonnet") */
	model: z.string().optional(),
	/** Override the provider from config */
	provider: LlmProviderSchema.optional(),
	/** Temperature for LLM sampling */
	temperature: z.number().min(0).max(2).optional().default(1.0),
	/** Thinking level for extended thinking */
	thinkingLevel: ThinkingLevelSchema.optional().default('medium'),
	/** Maximum tokens in LLM response */
	maxTokens: z.number().positive().optional(),
	/** Maximum turns before stopping */
	maxTurns: z.number().positive().int().optional().default(AGENT.MAX_TURNS),
	/** Maximum tool calls per turn */
	maxToolCallsPerTurn: z
		.number()
		.positive()
		.int()
		.optional()
		.default(AGENT.MAX_TOOL_CALLS_PER_TURN),
	/** Array of provider configurations (permissive - not directly used by AgentLoop) */
	providers: z.array(z.any()).optional(),
	/** ID of the primary provider */
	primaryProvider: z.string().min(1, 'primaryProvider is required'),
	/** Tool timeout in milliseconds */
	toolTimeout: z.number().positive().optional().default(AGENT.TOOL_TIMEOUT_MS),
	/** Whether to execute tool calls in parallel */
	parallelToolCalls: z.boolean().optional().default(true),
	/** Cooldown configuration for rate limiting */
	cooldown: z
		.object({
			enabled: z.boolean().optional().default(true),
			defaultDurationMs: z.number().positive().optional().default(PROVIDER.COOLDOWN_DEFAULT_MS),
			maxRetries: z.number().int().min(0).optional().default(AGENT.MAX_RETRIES)
		})
		.optional(),
	/** Fallback provider configs */
	fallbackProviders: z.array(z.any()).optional(),
	/** Registered tools (permissive to match existing usage) */
	tools: z.array(z.any()).optional(),
	/** Hook configurations */
	hooks: z.array(z.any()).optional(),
	/** Custom workspace path */
	workspace: z.string().optional(),
	/** Maximum sub-turn depth for recursive tool calling */
	maxSubTurnDepth: z.number().positive().int().optional().default(AGENT.DEFAULT_MAX_SUB_TURN_DEPTH),
	/** Maximum iterations for the agent loop */
	maxIterations: z.number().positive().int().optional().default(AGENT.MAX_ITERATIONS)
});

export type ValidatedAgentLoopConfig = z.infer<typeof AgentLoopConfigSchema>;

// =============================================================================
// Session Config Schema (types/index.ts SessionConfigSchema)
// =============================================================================

/**
 * Session configuration schema
 */
export const SessionConfigSchema = z
	.object({
		userId: z.string().min(1, 'userId is required'),
		agentConfig: z.any().optional(),
		systemPrompt: z.string().optional(),
		initialMessages: z.array(z.any()).optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
		ttl: z.number().optional()
	})
	.catchall(z.unknown());

export type ValidatedSessionConfig = z.infer<typeof SessionConfigSchema>;

// =============================================================================
// Tool Call Schema
// =============================================================================

/**
 * A tool call from the LLM
 */
export const ToolCallSchema = z.object({
	id: z.string(),
	name: z.string(),
	input: z.record(z.string(), z.unknown())
});

export type ValidatedToolCall = z.infer<typeof ToolCallSchema>;

// =============================================================================
// Hook Config Schema
// =============================================================================

/**
 * Hook event types
 */
export const HookEventSchema = z.enum([
	'onTurnStart',
	'onTurnEnd',
	'onSubTurnStart',
	'onSubTurnEnd',
	'onToolCall',
	'onToolResult',
	'onError',
	'onProviderSwitch',
	'onRateLimit',
	'onSessionStart',
	'onSessionEnd',
	'onMessage'
]);

export type ValidatedHookEvent = z.infer<typeof HookEventSchema>;

/**
 * Hook configuration schema
 */
export const HookConfigSchema = z.object({
	id: z.string(),
	name: z.string(),
	event: HookEventSchema,
	priority: z.number().int().optional(),
	enabled: z.boolean().optional()
});

export type ValidatedHookConfig = z.infer<typeof HookConfigSchema>;

// =============================================================================
// Re-export from types for convenience
// =============================================================================

export { z };
