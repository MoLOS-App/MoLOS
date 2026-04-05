/**
 * Type definitions for the MoLOS Agent Package
 *
 * This module provides all core types for the agent system including:
 * - LLM provider configurations
 * - Tool definitions and execution
 * - Agent sessions and turns
 * - Event handling
 * - Multi-agent spawning
 */

import { z } from 'zod';
import { SCHEMA, AGENT } from '../constants.js';

// =============================================================================
// Result Type
// =============================================================================

/**
 * Rust-like Result type for explicit error handling
 */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

/**
 * Creates a successful Result
 */
export function ok<T>(data: T): Result<T, never> {
	return { success: true, data };
}

/**
 * Creates a failure Result
 */
export function err<E = Error>(error: E): Result<never, E> {
	return { success: false, error };
}

/**
 * Type guard for successful results
 */
export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
	return result.success === true;
}

/**
 * Type guard for failed results
 */
export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
	return result.success === false;
}

// =============================================================================
// LLM Provider Types
// =============================================================================

/**
 * Supported LLM providers
 */
export const LlmProviderSchema = z.enum([
	'openai',
	'anthropic',
	'ollama',
	'lmstudio',
	'groq',
	'deepseek',
	'mistral',
	'custom'
]);

export type LlmProvider = z.infer<typeof LlmProviderSchema>;

/**
 * Provider-specific configuration schema
 */
export const ProviderConfigSchema = z.object({
	provider: LlmProviderSchema,
	apiKey: z.string().optional(),
	baseUrl: z.string().optional(),
	defaultHeaders: z.record(z.string(), z.string()).optional(),
	timeout: z.number().optional().default(SCHEMA.PROVIDER_TIMEOUT),
	maxRetries: z.number().optional().default(SCHEMA.PROVIDER_MAX_RETRIES)
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/**
 * Model configuration within a provider
 */
export const ModelConfigSchema = z.object({
	name: z.string(),
	provider: LlmProviderSchema,
	/** Context window size in tokens */
	contextWindow: z.number().optional(),
	/** Maximum output tokens */
	maxOutputTokens: z.number().optional(),
	/** Supported thinking levels (for providers that support it) */
	thinkingLevels: z.array(z.number()).optional(),
	/** Whether streaming is supported */
	supportsStreaming: z.boolean().optional().default(true),
	/** Whether function calling is supported */
	supportsFunctionCalling: z.boolean().optional().default(true),
	/** Cost per 1M input tokens (USD) */
	inputCostPerMToken: z.number().optional(),
	/** Cost per 1M output tokens (USD) */
	outputCostPerMToken: z.number().optional()
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

/**
 * Request to a language model
 */
export interface LlmRequest {
	model: string;
	messages: AgentMessage[];
	tools?: ToolDefinition[];
	toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
	temperature?: number;
	topP?: number;
	maxTokens?: number;
	thinking?: {
		type: 'enabled';
		budgetTokens: number;
	};
	stream?: boolean;
	metadata?: Record<string, unknown>;
}

/**
 * Response from a language model
 */
export interface LlmResponse {
	model: string;
	message: AgentMessage;
	usage: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
	finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
	thinking?: string;
}

// =============================================================================
// Tool Types
// =============================================================================

/**
 * Parameter schema for a tool (JSON Schema compatible)
 */
export interface ToolParameterSchema {
	type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
	description?: string;
	enum?: unknown[];
	default?: unknown;
	minimum?: number;
	maximum?: number;
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	items?: ToolParameterSchema;
	properties?: Record<string, ToolParameterSchema>;
	required?: string[];
	additionalProperties?: boolean;
}

/**
 * Definition of a tool that can be called by the agent
 */
export interface ToolDefinition {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<string, ToolParameterSchema>;
		required?: string[];
		additionalProperties?: boolean;
	};
	/** Whether this tool is async (default: true) */
	async?: boolean;
	/** Whether to include the full schema in LLM requests */
	includeSchemaInRequest?: boolean;
}

/**
 * Result of executing a tool
 */
export interface ToolResult {
	toolName: string;
	arguments: Record<string, unknown>;
	success: boolean;
	output?: string;
	error?: string;
	executionMs: number;
	metadata?: Record<string, unknown>;
}

/**
 * A tool ready to be executed
 */
export interface ToolCall {
	id: string;
	tool: ToolDefinition;
	arguments: Record<string, unknown>;
	/**
	 * Original tool name from the AI SDK response.
	 * This may differ from tool.name if fallback matching was used.
	 */
	name?: string;
}

// =============================================================================
// Message Types
// =============================================================================

/**
 * Role in a conversation
 */
export const MessageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

/**
 * Content in a message (can be text or tool calls)
 *
 * NOTE: AI SDK uses 'tool-call' (hyphen) format with toolCallId/toolName properties.
 * We support both this format and the legacy 'tool_call' (underscore) format with id/name.
 */
export type MessageContent =
	| string
	| { type: 'text'; text: string }
	| { type: 'tool-call'; toolCallId: string; toolName: string; input: Record<string, unknown> }
	| { type: 'tool_call'; id: string; name: string; input: Record<string, unknown> } // Legacy format
	| { type: 'tool_result'; toolCallId: string; content: string; isError?: boolean };

/**
 * A message in the agent conversation
 */
export interface AgentMessage {
	role: MessageRole;
	content: string | Array<MessageContent>;
	name?: string;
	toolCallId?: string;
	metadata?: Record<string, unknown>;
}

// =============================================================================
// Turn Types
// =============================================================================

/**
 * Level of detailed thinking/reasoning
 */
export const ThinkingLevelSchema = z.enum(['none', 'low', 'medium', 'high', 'max']);
export type ThinkingLevel = z.infer<typeof ThinkingLevelSchema>;

/**
 * Status of a turn
 */
export type TurnStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * A sub-turn represents a single LLM call within a turn
 */
export interface SubTurn {
	id: string;
	turnId: string;
	request: LlmRequest;
	response?: LlmResponse;
	toolCalls: ToolCall[];
	toolResults: ToolResult[];
	status: TurnStatus;
	startedAt: number;
	completedAt?: number;
	error?: string;
}

/**
 * A turn represents one user message and all its associated sub-turns
 */
export interface Turn {
	id: string;
	sessionId: string;
	userMessage: AgentMessage;
	subTurns: SubTurn[];
	status: TurnStatus;
	startedAt: number;
	completedAt?: number;
	finalResponse?: AgentMessage;
	error?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Result of a completed turn
 */
export interface TurnResult {
	turn: Turn;
	success: boolean;
	response: AgentMessage;
	toolResults: ToolResult[];
	durationMs: number;
}

// =============================================================================
// Session Types
// =============================================================================

/**
 * Session state persisted by SessionStore
 */
export interface Session {
	id: string;
	userId: string;
	config: AgentLoopConfig;
	messages: AgentMessage[];
	turns: Turn[];
	currentTurn?: Turn;
	metadata: Record<string, unknown>;
	createdAt: number;
	updatedAt: number;
	expiresAt?: number;
}

/**
 * Configuration for a session
 */
export const SessionConfigSchema = z.object({
	userId: z.string(),
	agentConfig: z.any().optional(),
	systemPrompt: z.string().optional(),
	initialMessages: z.array(z.any()).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	ttl: z.number().optional()
});

export type SessionConfig = z.infer<typeof SessionConfigSchema>;

/**
 * Abstract session store for persistence
 */
export interface SessionStore {
	create(config: SessionConfig): Promise<Session>;
	get(id: string): Promise<Session | null>;
	update(session: Session): Promise<void>;
	delete(id: string): Promise<void>;
	list(userId: string, limit?: number): Promise<Session[]>;
	exists(id: string): Promise<boolean>;
}

// =============================================================================
// Context Types
// =============================================================================

/**
 * Agent context for tool execution and hook callbacks
 */
export interface AgentContext {
	sessionId: string;
	turnId: string;
	subTurnId: string;
	userId: string;
	messages: AgentMessage[];
	config: AgentLoopConfig;
	metadata: Record<string, unknown>;
	/**
	 * Abort signal for cancellation
	 */
	signal: AbortSignal;
}

// =============================================================================
// Hook Types
// =============================================================================

/**
 * Events that can trigger hooks
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

export type HookEvent = z.infer<typeof HookEventSchema>;

/**
 * Handler function for a hook
 */
export type HookHandler<T = unknown> = (
	event: HookEvent,
	data: T,
	context: AgentContext
) => Promise<void> | void;

/**
 * A registered hook
 */
export interface Hook {
	id: string;
	name: string;
	event: HookEvent;
	handler: HookHandler;
	priority?: number;
	enabled?: boolean;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Event emitted by the event bus
 */
export interface Event<T = unknown> {
	id: string;
	type: string;
	payload: T;
	timestamp: number;
	source?: string;
}

/**
 * Subscriber function for events
 */
export type EventSubscriber<T = unknown> = (event: Event<T>) => void | Promise<void>;

/**
 * Event bus for pub/sub communication
 */
export interface EventBus {
	emit<T>(type: string, payload: T, source?: string): void;
	subscribe<T>(type: string, handler: EventSubscriber<T>): () => void;
	unsubscribe<T>(type: string, handler: EventSubscriber<T>): void;
	clear(type?: string): void;
}

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Failover reasons for provider switching
 */
export const FailoverReasonSchema = z.enum([
	'rate_limit',
	'timeout',
	'context_overflow',
	'invalid_api_key',
	'insufficient_quota',
	'model_not_found',
	'network_error',
	'server_error',
	'unknown_error'
]);

export type FailoverReason = z.infer<typeof FailoverReasonSchema>;

/**
 * Classification of an error from an LLM call
 */
export interface ErrorClassification {
	reason: FailoverReason;
	retryable: boolean;
	shouldFailover: boolean;
	retryAfter?: number;
	message: string;
}

/**
 * Provider instance with methods for LLM calls
 */
export interface LlmProviderInstance {
	config: ProviderConfig;
	models: ModelConfig[];
	chat(request: LlmRequest): Promise<LlmResponse>;
	dispose(): void;
}

/**
 * Factory for creating LLM provider instances
 */
export interface LlmProviderFactory {
	create(config: ProviderConfig): Result<LlmProviderInstance>;
	supports(provider: LlmProvider): boolean;
}

// =============================================================================
// Cooldown Types
// =============================================================================

/**
 * Cooldown entry for a provider/model
 */
export interface CooldownEntry {
	provider: string;
	model: string;
	until: number;
	reason: FailoverReason;
	retryCount: number;
}

/**
 * Cooldown manager for rate limiting
 */
export interface CooldownManager {
	/**
	 * Set cooldown for a provider/model
	 */
	set(provider: string, model: string, durationMs: number, reason: FailoverReason): void;

	/**
	 * Check if a provider/model is in cooldown
	 */
	isInCooldown(provider: string, model: string): boolean;

	/**
	 * Get cooldown entry if exists
	 */
	get(provider: string, model: string): CooldownEntry | undefined;

	/**
	 * Clear cooldown
	 */
	clear(provider: string, model: string): void;

	/**
	 * Clear all cooldowns
	 */
	clearAll(): void;
}

// =============================================================================
// Agent Configuration Types
// =============================================================================

/**
 * Agent configuration schema
 */
export const AgentConfigSchema = z.object({
	name: z.string().optional(),
	systemPrompt: z.string().optional(),
	model: z.string().optional(),
	provider: LlmProviderSchema.optional(),
	temperature: z.number().min(0).max(2).optional().default(1.0),
	thinkingLevel: ThinkingLevelSchema.optional().default('medium'),
	maxTokens: z.number().optional(),
	maxTurns: z.number().optional().default(10),
	maxToolCallsPerTurn: z.number().optional().default(AGENT.MAX_TOOL_CALLS_PER_TURN),
	tools: z.array(z.any()).optional(),
	toolTimeout: z.number().optional().default(SCHEMA.TOOL_TIMEOUT),
	parallelToolCalls: z.boolean().optional().default(true),
	fallbackProviders: z.array(z.any()).optional(),
	hooks: z.array(z.any()).optional()
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Agent loop configuration with multi-provider support
 */
export interface AgentLoopConfig extends AgentConfig {
	id: string;
	providers: ProviderConfig[];
	primaryProvider: string;
	cooldown: {
		enabled: boolean;
		defaultDurationMs: number;
		maxRetries: number;
	};
}

// =============================================================================
// Multi-Agent Types
// =============================================================================

/**
 * Configuration for spawning a new agent
 */
export interface SpawnConfig {
	name: string;
	config: AgentConfig;
	userId: string;
	parentSessionId?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Result of spawning an agent
 */
export interface SpawnResult {
	success: boolean;
	sessionId?: string;
	error?: string;
}

/**
 * Announcement from an agent
 */
export interface AgentAnnouncement {
	type: 'agent_spawned' | 'agent_terminated' | 'agent_error' | 'agent_message';
	sessionId: string;
	agentName: string;
	payload: unknown;
	timestamp: number;
}

/**
 * Registry for multi-agent coordination
 */
export interface AgentRegistry {
	register(sessionId: string, config: SpawnConfig): void;
	unregister(sessionId: string): void;
	get(sessionId: string): SpawnConfig | undefined;
	list(): SpawnConfig[];
	listByUser(userId: string): SpawnConfig[];
}

// =============================================================================
// BM25 Search Types
// =============================================================================

/**
 * A document in the BM25 index
 */
export interface Bm25Document {
	id: string;
	content: string;
	metadata?: Record<string, unknown>;
}

/**
 * Search result from BM25
 */
export interface Bm25SearchResult {
	document: Bm25Document;
	score: number;
}

/**
 * BM25 search options
 */
export interface Bm25Options {
	k1?: number;
	b?: number;
	limit?: number;
	minScore?: number;
}

// =============================================================================
// Tool Wrapper Types
// =============================================================================

/**
 * Wrapper to convert a function to a ToolDefinition
 */
export interface ToolWrapperOptions {
	name?: string;
	description?: string;
	parameterDescriptions?: Record<string, string>;
	required?: string[];
	transform?: {
		input?: (args: Record<string, unknown>) => Record<string, unknown>;
		output?: (result: unknown) => string;
	};
}

/**
 * A wrapped tool with both definition and executor
 */
export interface WrappedTool {
	definition: ToolDefinition;
	execute: (args: Record<string, unknown>, context: AgentContext) => Promise<ToolResult>;
}

// =============================================================================
// Re-exports
// =============================================================================

export { z };
