/**
 * Agent Configuration Management
 *
 * Provides default configurations and configuration merging utilities.
 */

import type { AgentConfig, ThinkingLevel } from './types';

/**
 * Default agent configuration values
 */
export const DEFAULT_AGENT_CONFIG: Required<
	Omit<AgentConfig, 'apiKey' | 'baseUrl'>
> & { apiKey?: string; baseUrl?: string } = {
	// LLM settings
	provider: 'anthropic',
	modelName: 'claude-3-5-sonnet-20241022',
	apiKey: undefined,
	baseUrl: undefined,
	maxTokens: 4096,
	temperature: 70, // 0-100 scale, divided by 100 for API
	topP: 100,

	// Execution settings
	maxSteps: 20,
	maxDurationMs: 300000, // 5 minutes
	thinkingLevel: 'low' as ThinkingLevel,
	autonomousMode: true,

	// Cache settings
	toolCacheSize: 256,
	toolCacheTtlMs: 15000, // 15 seconds
	llmCacheEnabled: true,

	// Retry settings
	retryMax: 3,
	retryBaseMs: 1000,
	retryMaxDelayMs: 10000,
	llmTimeoutMs: 60000, // 60 seconds

	// Feature flags
	streamEnabled: true,
	telemetryEnabled: true,
	compactionEnabled: true
};

/**
 * Thinking level prompt texts (simple version)
 */
export const THINKING_PROMPT_TEXTS: Record<ThinkingLevel, string> = {
	off: '',
	minimal: 'Think briefly before responding.',
	low: 'Consider the context and plan your approach before acting.',
	medium: `Think through your approach step by step.
Consider alternatives and potential issues.
Plan your actions carefully.`,
	high: `<thinking_protocol>
Before taking any action, thoroughly analyze:
1. The user's true intent and any implicit requirements
2. The current state and available resources
3. Potential risks and edge cases
4. The optimal sequence of actions
5. How to verify success

Document your reasoning process and explain your decisions.
</thinking_protocol>`
};

/**
 * Provider-specific default models
 */
export const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
	anthropic: 'claude-3-5-sonnet-20241022',
	openai: 'gpt-4o',
	openrouter: 'anthropic/claude-3.5-sonnet',
	ollama: 'llama3.1',
	zai: 'claude-3-5-sonnet-20241022'
};

/**
 * Provider API endpoints
 */
export const PROVIDER_ENDPOINTS: Record<string, string> = {
	anthropic: 'https://api.anthropic.com/v1/messages',
	openai: 'https://api.openai.com/v1/chat/completions',
	openrouter: 'https://openrouter.ai/api/v1/chat/completions',
	ollama: 'http://localhost:11434/v1/chat/completions',
	zai: 'https://api.z.ai/api/coding/paas/v4/chat/completions'
};

/**
 * Circuit breaker configuration
 */
export const CIRCUIT_BREAKER_CONFIG = {
	failureThreshold: 5, // Open after 5 failures
	recoveryTimeout: 30000, // 30 seconds before attempting recovery
	halfOpenMaxCalls: 3 // Allow 3 test calls in half-open state
};

/**
 * Rate limiter configuration per provider
 */
export const RATE_LIMIT_CONFIG: Record<string, { requestsPerMinute: number; tokensPerMinute: number }> = {
	anthropic: { requestsPerMinute: 60, tokensPerMinute: 100000 },
	openai: { requestsPerMinute: 500, tokensPerMinute: 150000 },
	openrouter: { requestsPerMinute: 200, tokensPerMinute: 100000 },
	ollama: { requestsPerMinute: 1000, tokensPerMinute: 1000000 },
	zai: { requestsPerMinute: 60, tokensPerMinute: 100000 }
};

/**
 * Compaction configuration
 */
export const COMPACTION_CONFIG = {
	maxTokensBeforeCompaction: 100000, // Compact when approaching this
	targetTokensAfterCompaction: 50000, // Target token count after compaction
	summarizationModel: 'claude-3-haiku-20240307', // Cheaper model for summarization
	preserveRecentMessages: 10 // Always keep last N messages
};

/**
 * Create agent configuration by merging with defaults
 */
export function createAgentConfig(partial?: Partial<AgentConfig>): AgentConfig {
	if (!partial) return { ...DEFAULT_AGENT_CONFIG } as AgentConfig;

	return {
		...DEFAULT_AGENT_CONFIG,
		...partial
	} as AgentConfig;
}

/**
 * Get the effective model name for a provider
 */
export function getEffectiveModelName(config: AgentConfig): string {
	if (config.modelName) return config.modelName;
	return PROVIDER_DEFAULT_MODELS[config.provider] || 'unknown';
}

/**
 * Get the API endpoint for a provider
 */
export function getProviderEndpoint(config: AgentConfig): string {
	if (config.baseUrl) return config.baseUrl;
	return PROVIDER_ENDPOINTS[config.provider] || '';
}

/**
 * Get rate limit config for a provider
 */
export function getRateLimitConfig(provider: string): { requestsPerMinute: number; tokensPerMinute: number } {
	return RATE_LIMIT_CONFIG[provider] || { requestsPerMinute: 60, tokensPerMinute: 100000 };
}

/**
 * Validate agent configuration
 */
export function validateAgentConfig(config: AgentConfig): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Check required fields
	if (!config.provider) {
		errors.push('Provider is required');
	}

	if (!config.modelName) {
		errors.push('Model name is required');
	}

	// Validate numeric ranges
	if (config.maxTokens !== undefined && config.maxTokens < 1) {
		errors.push('maxTokens must be at least 1');
	}

	if (config.maxSteps !== undefined && config.maxSteps < 1) {
		errors.push('maxSteps must be at least 1');
	}

	if (config.maxDurationMs !== undefined && config.maxDurationMs < 1000) {
		errors.push('maxDurationMs must be at least 1000');
	}

	if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 100)) {
		errors.push('temperature must be between 0 and 100');
	}

	if (config.topP !== undefined && (config.topP < 0 || config.topP > 100)) {
		errors.push('topP must be between 0 and 100');
	}

	// Validate thinking level
	const validThinkingLevels = ['off', 'minimal', 'low', 'medium', 'high'];
	if (config.thinkingLevel && !validThinkingLevels.includes(config.thinkingLevel)) {
		errors.push(`thinkingLevel must be one of: ${validThinkingLevels.join(', ')}`);
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

/**
 * Convert temperature from 0-100 scale to 0-1 scale
 */
export function normalizeTemperature(temperature?: number): number | undefined {
	if (temperature === undefined) return undefined;
	return temperature / 100;
}

/**
 * Convert topP from 0-100 scale to 0-1 scale
 */
export function normalizeTopP(topP?: number): number | undefined {
	if (topP === undefined) return undefined;
	return topP / 100;
}

/**
 * Runtime configuration derived from agent config
 */
export interface RuntimeConfig {
	maxSteps: number;
	maxDurationMs: number;
	toolCacheSize: number;
	toolCacheTtlMs: number;
	retryMax: number;
	retryBaseMs: number;
	retryMaxDelayMs: number;
	llmTimeoutMs: number;
	telemetryEnabled: boolean;
	compactionEnabled: boolean;
	thinkingLevel: ThinkingLevel;
	autonomousMode: boolean;
}

/**
 * Get runtime configuration from agent config
 */
export function getRuntimeConfig(config: AgentConfig): RuntimeConfig {
	return {
		maxSteps: config.maxSteps ?? DEFAULT_AGENT_CONFIG.maxSteps,
		maxDurationMs: config.maxDurationMs ?? DEFAULT_AGENT_CONFIG.maxDurationMs,
		toolCacheSize: config.toolCacheSize ?? DEFAULT_AGENT_CONFIG.toolCacheSize,
		toolCacheTtlMs: config.toolCacheTtlMs ?? DEFAULT_AGENT_CONFIG.toolCacheTtlMs,
		retryMax: config.retryMax ?? DEFAULT_AGENT_CONFIG.retryMax,
		retryBaseMs: config.retryBaseMs ?? DEFAULT_AGENT_CONFIG.retryBaseMs,
		retryMaxDelayMs: config.retryMaxDelayMs ?? DEFAULT_AGENT_CONFIG.retryMaxDelayMs,
		llmTimeoutMs: config.llmTimeoutMs ?? DEFAULT_AGENT_CONFIG.llmTimeoutMs,
		telemetryEnabled: config.telemetryEnabled ?? DEFAULT_AGENT_CONFIG.telemetryEnabled,
		compactionEnabled: config.compactionEnabled ?? DEFAULT_AGENT_CONFIG.compactionEnabled,
		thinkingLevel: config.thinkingLevel ?? DEFAULT_AGENT_CONFIG.thinkingLevel,
		autonomousMode: config.autonomousMode ?? DEFAULT_AGENT_CONFIG.autonomousMode
	};
}
