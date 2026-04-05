import type { AiSettings } from '$lib/models/ai';

export interface AgentRuntimeConfig {
	maxSteps: number;
	maxDurationMs: number;
	llmTimeoutMs: number;
	retryMax: number;
	retryBaseMs: number;
	retryMaxDelayMs: number;
	toolCacheTtlMs: number;
	toolCacheSize: number;
	promptTokenBudget: number;
	memoryMaxChars: number;
	maxEvents: number;
	telemetryEnabled: boolean;
}

const DEFAULTS: AgentRuntimeConfig = {
	maxSteps: 8,
	maxDurationMs: 45_000,
	llmTimeoutMs: 25_000,
	retryMax: 2,
	retryBaseMs: 400,
	retryMaxDelayMs: 4_000,
	toolCacheTtlMs: 15_000,
	toolCacheSize: 256,
	promptTokenBudget: 10_000,
	memoryMaxChars: 2_000,
	maxEvents: 80,
	telemetryEnabled: true
};

function readNumber(value: string | undefined, fallback: number): number {
	if (!value) return fallback;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
	if (!value) return fallback;
	return value === '1' || value.toLowerCase() === 'true';
}

export function getAgentRuntimeConfig(_settings: AiSettings): AgentRuntimeConfig {
	return {
		maxSteps: readNumber(process.env.AI_AGENT_MAX_STEPS, DEFAULTS.maxSteps),
		maxDurationMs: readNumber(process.env.AI_AGENT_MAX_DURATION_MS, DEFAULTS.maxDurationMs),
		llmTimeoutMs: readNumber(process.env.AI_AGENT_LLM_TIMEOUT_MS, DEFAULTS.llmTimeoutMs),
		retryMax: readNumber(process.env.AI_AGENT_RETRY_MAX, DEFAULTS.retryMax),
		retryBaseMs: readNumber(process.env.AI_AGENT_RETRY_BASE_MS, DEFAULTS.retryBaseMs),
		retryMaxDelayMs: readNumber(process.env.AI_AGENT_RETRY_MAX_DELAY_MS, DEFAULTS.retryMaxDelayMs),
		toolCacheTtlMs: readNumber(process.env.AI_AGENT_TOOL_CACHE_TTL_MS, DEFAULTS.toolCacheTtlMs),
		toolCacheSize: readNumber(process.env.AI_AGENT_TOOL_CACHE_SIZE, DEFAULTS.toolCacheSize),
		promptTokenBudget: readNumber(
			process.env.AI_AGENT_PROMPT_TOKEN_BUDGET,
			DEFAULTS.promptTokenBudget
		),
		memoryMaxChars: readNumber(process.env.AI_AGENT_MEMORY_MAX_CHARS, DEFAULTS.memoryMaxChars),
		maxEvents: readNumber(process.env.AI_AGENT_MAX_EVENTS, DEFAULTS.maxEvents),
		telemetryEnabled: readBoolean(process.env.AI_AGENT_TELEMETRY_ENABLED, DEFAULTS.telemetryEnabled)
	};
}
