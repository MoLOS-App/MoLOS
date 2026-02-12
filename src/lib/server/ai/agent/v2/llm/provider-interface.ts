/**
 * LLM Provider Interface
 *
 * Abstract interface for LLM providers with streaming support.
 * All providers must implement this interface.
 */

import type { ToolDefinition, LlmResponse, AgentMessage } from '../core/types';

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Base provider configuration
 */
export interface ProviderConfig {
	/** API key */
	apiKey?: string;
	/** Base URL for API */
	baseUrl?: string;
	/** Model name */
	model: string;
	/** Maximum tokens */
	maxTokens?: number;
	/** Temperature (0-1) */
	temperature?: number;
	/** Top P (0-1) */
	topP?: number;
	/** Request timeout in ms */
	timeout?: number;
}

/**
 * Anthropic-specific configuration
 */
export interface AnthropicConfig extends ProviderConfig {
	/** Anthropic API version */
	apiVersion?: string;
}

/**
 * OpenAI-specific configuration
 */
export interface OpenAIConfig extends ProviderConfig {
	/** Organization ID */
	organization?: string;
}

/**
 * Ollama-specific configuration
 */
export interface OllamaConfig extends ProviderConfig {
	/** Keep model loaded */
	keepAlive?: boolean;
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * LLM Provider interface
 */
export interface ILlmProvider {
	/** Provider name */
	readonly name: string;

	/** Provider type */
	readonly type: string;

	/**
	 * Initialize the provider
	 */
	initialize(): Promise<void>;

	/**
	 * Check if provider is available
	 */
	isAvailable(): Promise<boolean>;

	/**
	 * Make a completion request
	 */
	complete(
		messages: AgentMessage[],
		tools?: ToolDefinition[],
		options?: CompletionOptions
	): Promise<LlmResponse>;

	/**
	 * Stream a completion request
	 */
	streamComplete?(
		messages: AgentMessage[],
		tools?: ToolDefinition[],
		options?: CompletionOptions,
		onChunk?: StreamHandler
	): Promise<LlmResponse>;

	/**
	 * Count tokens in messages
	 */
	countTokens?(messages: AgentMessage[]): number;

	/**
	 * Get available models
	 */
	getAvailableModels?(): Promise<string[]>;

	/**
	 * Dispose of resources
	 */
	dispose?(): Promise<void>;
}

/**
 * Completion options
 */
export interface CompletionOptions {
	/** System prompt override */
	systemPrompt?: string;
	/** Stop sequences */
	stopSequences?: string[];
	/** Maximum tokens (override) */
	maxTokens?: number;
	/** Temperature (override) */
	temperature?: number;
	/** Top P (override) */
	topP?: number;
	/** Enable thinking/reasoning */
	thinkingEnabled?: boolean;
	/** Thinking budget tokens */
	thinkingBudget?: number;
	/** Metadata for request */
	metadata?: Record<string, unknown>;
}

/**
 * Stream handler function
 */
export type StreamHandler = (chunk: StreamChunk) => void | Promise<void>;

/**
 * Stream chunk types
 */
export type StreamChunk =
	| { type: 'text'; content: string }
	| { type: 'thinking'; content: string }
	| { type: 'tool_use'; id: string; name: string; input: unknown }
	| { type: 'tool_result'; id: string; result: unknown }
	| { type: 'usage'; input: number; output: number }
	| { type: 'error'; error: string }
	| { type: 'done' };

// ============================================================================
// Provider Error Types
// ============================================================================

/**
 * Base provider error
 */
export class ProviderError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly statusCode?: number,
		public readonly retryable: boolean = false
	) {
		super(message);
		this.name = 'ProviderError';
	}
}

/**
 * Rate limit error
 */
export class RateLimitError extends ProviderError {
	constructor(
		message: string,
		public readonly resetAt?: number
	) {
		super(message, 'rate_limit', 429, true);
		this.name = 'RateLimitError';
	}
}

/**
 * Authentication error
 */
export class AuthenticationError extends ProviderError {
	constructor(message: string) {
		super(message, 'authentication', 401, false);
		this.name = 'AuthenticationError';
	}
}

/**
 * Model not found error
 */
export class ModelNotFoundError extends ProviderError {
	constructor(model: string) {
		super(`Model not found: ${model}`, 'model_not_found', 404, false);
		this.name = 'ModelNotFoundError';
	}
}

/**
 * Context too long error
 */
export class ContextTooLongError extends ProviderError {
	constructor(
		message: string,
		public readonly tokensUsed: number,
		public readonly maxTokens: number
	) {
		super(message, 'context_too_long', 400, false);
		this.name = 'ContextTooLongError';
	}
}

/**
 * Provider unavailable error
 */
export class ProviderUnavailableError extends ProviderError {
	constructor(provider: string, reason?: string) {
		super(
			`Provider ${provider} unavailable: ${reason || 'unknown'}`,
			'provider_unavailable',
			503,
			true
		);
		this.name = 'ProviderUnavailableError';
	}
}

// ============================================================================
// Provider Utilities
// ============================================================================

/**
 * Estimate token count for messages
 */
export function estimateTokenCount(messages: AgentMessage[]): number {
	let tokens = 0;

	for (const msg of messages) {
		// Base cost per message
		tokens += 4; // Every message follows <im_start>{role/name}\n{content}<im_end>\n

		// Content tokens (rough estimate: 1 token per 4 characters)
		if (typeof msg.content === 'string') {
			tokens += Math.ceil(msg.content.length / 4);
		} else if (msg.content) {
			tokens += Math.ceil(JSON.stringify(msg.content).length / 4);
		}

		// Tool calls
		if (msg.toolCalls) {
			for (const tc of msg.toolCalls) {
				tokens += Math.ceil(tc.name.length / 4);
				tokens += Math.ceil(JSON.stringify(tc.parameters).length / 4);
			}
		}
	}

	return tokens;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
	if (error instanceof ProviderError) {
		return error.retryable;
	}

	if (error instanceof Error) {
		// Network errors
		if (error.message.includes('ECONNREFUSED')) return true;
		if (error.message.includes('ETIMEDOUT')) return true;
		if (error.message.includes('ENOTFOUND')) return true;

		// Rate limiting
		if (error.message.includes('rate limit')) return true;
		if (error.message.includes('429')) return true;
	}

	return false;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff
 */
export function calculateBackoff(
	attempt: number,
	baseMs: number,
	maxMs: number,
	jitter: boolean = true
): number {
	const delay = Math.min(maxMs, baseMs * Math.pow(2, attempt));
	if (jitter) {
		return delay + Math.floor(delay * 0.2 * Math.random());
	}
	return delay;
}
