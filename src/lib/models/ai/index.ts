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

export interface AiSettings {
	id: string;
	userId: string;
	provider: (typeof AIProvider)[keyof typeof AIProvider];
	apiKey?: string;
	modelName: string;
	systemPrompt?: string;
	baseUrl?: string;
	temperature?: number;
	topP?: number;
	maxTokens?: number;
	streamEnabled?: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface AiSession {
	id: string;
	userId: string;
	title: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface BulkToolParameters {
	items?: unknown[];
	ids?: unknown[];
	meals?: unknown[];
	workouts?: unknown[];
	expenses?: unknown[];
	entries?: unknown[];
	goals?: unknown[];
	resources?: unknown[];
	tasks?: unknown[];
}

export interface AiMessage {
	id: string;
	userId: string;
	sessionId: string;
	role: (typeof AIRole)[keyof typeof AIRole];
	content: string;
	contextMetadata?: string;
	toolCallId?: string;
	toolCalls?: Record<string, unknown>[];
	attachments?: { name: string }[];
	parts?: unknown[];
	createdAt: Date;
	metadata?: Record<string, unknown>; // For UI-only metadata like temporary progress messages
}

export interface AiChatResponse {
	message: string;
	actions?: AiAction[];
	events?: AiAgentEvent[];
	telemetry?: AiAgentTelemetry;
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<string, unknown>;
		required?: string[];
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	execute: (params: any) => Promise<any>;
}

export interface AiAction {
	type: 'read' | 'write';
	entity: string;
	description: string;
	status: 'pending' | 'confirmed' | 'executed' | 'failed';
	data?: unknown;
}

export type AiAgentEventType =
	| 'run_start'
	| 'iteration'
	| 'llm_call'
	| 'llm_retry'
	| 'tool_call_start'
	| 'tool_call_end'
	| 'guardrail'
	| 'error'
	| 'run_end';

export interface AiAgentEvent {
	type: AiAgentEventType;
	timestamp: number;
	detail?: Record<string, unknown>;
}

export interface AiAgentTelemetry {
	runId: string;
	startMs: number;
	durationMs?: number;
	llmCalls: number;
	toolCalls: number;
	retries: number;
	errors: number;
	tokenEstimateIn: number;
	tokenEstimateOut: number;
}

export const PREDEFINED_MODELS = {
	openai: [
		{ id: 'gpt-4o', name: 'GPT-4o' },
		{ id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
		{ id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
	],
	anthropic: [
		{ id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
		{ id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
		{ id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
	],
	openrouter: [
		{ id: 'mistralai/mistral-small-24b-instruct-2501', name: 'Mistral Small 24B' },
		{ id: 'qwen/qwen3-32b', name: 'Qwen 3 32B' },
		{ id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B' },
		{ id: 'mistralai/mistral-nemo', name: 'Mistral Nemo' },
		{ id: 'mistralai/ministral-3b', name: 'Ministral 3B' },
		{ id: 'x-ai/grok-4.1-fast', name: 'Grok 4.1 Fast' }
	],
	ollama: [
		{ id: 'llama3', name: 'Llama 3' },
		{ id: 'mistral', name: 'Mistral' },
		{ id: 'phi3', name: 'Phi-3' }
	]
};

// Telegram-specific types
export interface TelegramSettings {
	id: string;
	userId: string;
	botToken: string;
	chatId: string;
	webhookUrl?: string;
	connectionMode: 'webhook' | 'polling';
	pollingInterval: number;
	modelName: string;
	systemPrompt?: string;
	temperature?: number;
	maxTokens?: number;
	enabled: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface TelegramSession {
	id: string;
	userId: string;
	aiSessionId?: string | null;
	telegramChatId: string;
	title: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface TelegramMessage {
	id: string;
	userId: string;
	sessionId: string;
	telegramMessageId: number;
	role: (typeof AIRole)[keyof typeof AIRole];
	content: string;
	contextMetadata?: string;
	toolCallId?: string;
	toolCalls?: Record<string, unknown>[];
	createdAt: Date;
}

// Export MCP (Model Context Protocol) types
export * from './mcp';
