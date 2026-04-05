export const AIProvider = {
	OPENAI: 'openai',
	ANTHROPIC: 'anthropic',
	OLLAMA: 'ollama',
	OPENROUTER: 'openrouter',
	ZAI: 'zai',
	GROQ: 'groq',
	DEEPSEEK: 'deepseek',
	GOOGLE: 'google',
	MISTRAL: 'mistral',
	MOONSHOT: 'moonshot',
	XAI: 'xai',
	MINIMAX: 'minimax',
	MINIMAX_CODING: 'minimax-coding'
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
	metadata?: {
		category: string;
		tags: string[];
		priority: number;
		essential: boolean;
		submodule?: string; // NEW: Which submodule this tool belongs to (e.g., "my", "projects", "dashboard")
	};
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
		// Latest GPT-4o models
		{ id: 'gpt-4o', name: 'GPT-4o (Latest)', category: 'general' },
		{ id: 'gpt-4o-mini', name: 'GPT-4o Mini', category: 'general' },
		{ id: 'gpt-4o-2024-08-13', name: 'GPT-4o (Aug 2024)', category: 'general' },
		{ id: 'gpt-4o-2024-05-13', name: 'GPT-4o (May 2024)', category: 'general' },
		// GPT-4 Turbo
		{ id: 'gpt-4-turbo', name: 'GPT-4 Turbo', category: 'general' },
		{ id: 'gpt-4-turbo-2024-04-09', name: 'GPT-4 Turbo (Apr 2024)', category: 'general' },
		// GPT-4
		{ id: 'gpt-4', name: 'GPT-4', category: 'general' },
		// o1 Series (Reasoning models)
		{ id: 'o1', name: 'o1 (Reasoning)', category: 'coding' },
		{ id: 'o1-mini', name: 'o1 Mini (Reasoning)', category: 'coding' },
		{ id: 'o1-preview', name: 'o1 Preview (Reasoning)', category: 'coding' },
		// GPT-3.5 Turbo
		{ id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', category: 'general' },
		{ id: 'gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16K', category: 'general' }
	],
	anthropic: [
		// Claude 4.6 Series (Latest)
		{ id: 'claude-opus-4-6-20251101', name: 'Claude Opus 4.6 (Nov 2025)', category: 'coding' },
		{ id: 'claude-sonnet-4-6-20251001', name: 'Claude Sonnet 4.6 (Oct 2025)', category: 'coding' },
		{ id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (Oct 2025)', category: 'coding' },
		// Claude 4.5 Series
		{ id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5 (Sep 2025)', category: 'coding' },
		{ id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5 (Nov 2025)', category: 'coding' },
		// Claude 4.1 Series
		{ id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1 (Aug 2025)', category: 'coding' },
		// Legacy Claude 3.5 Series
		{ id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet (Jun 2024)', category: 'coding' },
		{ id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Oct 2024)', category: 'coding' },
		// Legacy Claude 3 Series
		{ id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', category: 'coding' },
		{ id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', category: 'coding' },
		{ id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', category: 'coding' }
	],
	openrouter: [
		// Premium Models
		{ id: 'anthropic/claude-opus-4.6', name: 'Claude Opus 4.6', category: 'coding' },
		{ id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', category: 'coding' },
		{ id: 'openai/gpt-4o', name: 'GPT-4o', category: 'general' },
		{ id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', category: 'general' },
		// Open Source Models
		{ id: 'mistralai/mistral-large-3-25-12', name: 'Mistral Large 3', category: 'coding' },
		{ id: 'mistralai/mistral-small-4-0-26-03', name: 'Mistral Small 4', category: 'general' },
		{ id: 'mistralai/mistral-medium-3-1-25-08', name: 'Mistral Medium 3.1', category: 'coding' },
		{ id: 'qwen/qwen3-32b', name: 'Qwen 3 32B', category: 'coding' },
		{ id: 'qwen/qwen3-vl-32b', name: 'Qwen 3 VL 32B', category: 'coding' },
		{ id: 'meta-llama/llama-3.3-70b-versatile', name: 'Llama 3.3 70B', category: 'coding' },
		{ id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', category: 'general' },
		{
			id: 'meta-llama/llama-4-scout-17b-16e-instruct',
			name: 'Llama 4 Scout 17B',
			category: 'coding'
		},
		{ id: 'deepseek/deepseek-v3', name: 'DeepSeek V3', category: 'coding' },
		{ id: 'deepseek/deepseek-chat-v3', name: 'DeepSeek Chat V3', category: 'coding' },
		{ id: 'moonshotai/kimi-k2-instruct-0905', name: 'Kimi K2', category: 'coding' },
		{ id: 'x-ai/grok-4.1-fast', name: 'Grok 4.1 Fast', category: 'coding' },
		{ id: 'nvidia/nemotron-cascade-2', name: 'Nemotron Cascade 2', category: 'coding' },
		{ id: 'mistralai/devstral-2-25-12', name: 'Devstral 2 (Coding)', category: 'coding' },
		{ id: 'mistralai/codestral-25-08', name: 'Codestral', category: 'coding' },
		// Local/Ollama-style models
		{ id: 'mistralai/mistral-nemo', name: 'Mistral Nemo', category: 'general' },
		{ id: 'mistralai/ministral-3b', name: 'Ministral 3B', category: 'general' },
		{ id: 'mistralai/ministral-8b', name: 'Ministral 8B', category: 'general' }
	],
	ollama: [
		// Popular General Models
		{ id: 'llama3', name: 'Llama 3', category: 'general' },
		{ id: 'llama3.1', name: 'Llama 3.1', category: 'general' },
		{ id: 'llama3.2', name: 'Llama 3.2', category: 'general' },
		{ id: 'llama3.3', name: 'Llama 3.3', category: 'general' },
		{ id: 'mistral', name: 'Mistral', category: 'general' },
		{ id: 'mistral-small', name: 'Mistral Small', category: 'general' },
		{ id: 'phi3', name: 'Phi-3', category: 'general' },
		{ id: 'phi3.5', name: 'Phi-3.5', category: 'general' },
		// Coding Specialized Models
		{ id: 'codestral', name: 'Codestral', category: 'coding' },
		{ id: 'devstral', name: 'Devstral', category: 'coding' },
		{ id: 'qwen3-coder', name: 'Qwen3 Coder', category: 'coding' },
		{ id: 'qwen3-coder-next', name: 'Qwen3 Coder Next', category: 'coding' },
		{ id: 'deepseek-coder', name: 'DeepSeek Coder', category: 'coding' },
		{ id: 'codellama', name: 'Code Llama', category: 'coding' },
		{ id: 'codellama:34b', name: 'Code Llama 34B', category: 'coding' },
		// Vision Models
		{ id: 'llava', name: 'LLaVA', category: 'vision' },
		{ id: 'llava-llama3', name: 'LLaVA Llama 3', category: 'vision' },
		{ id: 'qwen2-vl', name: 'Qwen2 VL', category: 'vision' },
		// Reasoning Models
		{ id: 'qwen3:32b', name: 'Qwen 3 32B', category: 'coding' },
		{ id: 'nemotron-cascade-2', name: 'Nemotron Cascade 2', category: 'coding' },
		{ id: 'glm-4.7-flash', name: 'GLM-4.7 Flash', category: 'coding' },
		{ id: 'minimax-m2.7', name: 'MiniMax M2.7 (Coding)', category: 'coding' },
		{ id: 'minimax-m2.5', name: 'MiniMax M2.5 (Coding)', category: 'coding' }
	],
	zai: [
		// GLM Series (Coding focused)
		{ id: 'GLM-5', name: 'GLM-5 (40B active)', category: 'coding' },
		{ id: 'GLM-4.7', name: 'GLM-4.7', category: 'coding' },
		{ id: 'GLM-4.6', name: 'GLM-4.6', category: 'coding' },
		{ id: 'GLM-4.5', name: 'GLM-4.5', category: 'coding' },
		{ id: 'GLM-4-32B-0414-128K', name: 'GLM-4-32B-128K', category: 'coding' },
		{ id: 'GLM-4-flash', name: 'GLM-4 Flash', category: 'coding' },
		// GLM Vision
		{ id: 'GLM-4V', name: 'GLM-4V (Vision)', category: 'vision' },
		{ id: 'GLM-4V-plus', name: 'GLM-4V Plus', category: 'vision' }
	],
	groq: [
		// Llama Series
		{ id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', category: 'coding' },
		{ id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', category: 'general' },
		{
			id: 'meta-llama/llama-4-scout-17b-16e-instruct',
			name: 'Llama 4 Scout 17B',
			category: 'coding'
		},
		// Qwen Series
		{ id: 'qwen/qwen3-32b', name: 'Qwen 3 32B', category: 'coding' },
		// Mistral Series
		{ id: 'mistral-small-24b-instruct-2501', name: 'Mistral Small 24B', category: 'general' },
		// Moonshot AI
		{ id: 'moonshotai/kimi-k2-instruct-0905', name: 'Kimi K2', category: 'coding' },
		// OpenAI OSS
		{ id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', category: 'coding' },
		{ id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', category: 'coding' },
		// Safety
		{ id: 'openai/gpt-oss-safeguard-20b', name: 'Safety GPT-OSS 20B', category: 'general' },
		// Prompt Guard
		{ id: 'meta-llama/llama-prompt-guard-2-22m', name: 'Prompt Guard 2 22M', category: 'general' },
		{ id: 'meta-llama/llama-prompt-guard-2-86m', name: 'Prompt Guard 2 86M', category: 'general' }
	],
	deepseek: [
		// DeepSeek V3 Series (Latest)
		{ id: 'deepseek-v3', name: 'DeepSeek V3', category: 'coding' },
		{ id: 'deepseek-chat-v3', name: 'DeepSeek Chat V3', category: 'coding' },
		// DeepSeek Coder Series
		{ id: 'deepseek-coder', name: 'DeepSeek Coder', category: 'coding' },
		{ id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', category: 'coding' },
		{ id: 'deepseek-coder-v2-lite', name: 'DeepSeek Coder V2 Lite', category: 'coding' },
		// DeepSeek Math
		{ id: 'deepseek-math-7b', name: 'DeepSeek Math 7B', category: 'coding' },
		// DeepSeek V2 Series
		{ id: 'deepseek-v2', name: 'DeepSeek V2', category: 'coding' },
		{ id: 'deepseek-v2-lite', name: 'DeepSeek V2 Lite', category: 'coding' },
		// DeepSeek VL
		{ id: 'deepseek-vl', name: 'DeepSeek VL', category: 'vision' },
		{ id: 'deepseek-vl-32b', name: 'DeepSeek VL 32B', category: 'vision' }
	],
	google: [
		// Gemini 2.0 Series (Latest)
		{ id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', category: 'general' },
		{ id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', category: 'general' },
		{ id: 'gemini-2.0-pro-exp', name: 'Gemini 2.0 Pro (Experimental)', category: 'coding' },
		// Gemini 1.5 Series
		{ id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', category: 'general' },
		{ id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', category: 'general' },
		{ id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', category: 'coding' },
		{ id: 'gemini-1.5-pro-002', name: 'Gemini 1.5 Pro (002)', category: 'coding' },
		// Gemini 1.0 Series
		{ id: 'gemini-pro', name: 'Gemini Pro', category: 'general' },
		{ id: 'gemini-pro-vision', name: 'Gemini Pro Vision', category: 'vision' }
	],
	mistral: [
		// Mistral Large Series (Frontier)
		{ id: 'mistral-large-3-25-12', name: 'Mistral Large 3', category: 'coding' },
		{ id: 'mistral-large-2-24-11', name: 'Mistral Large 2.1', category: 'coding' },
		{ id: 'mistral-large-24-07', name: 'Mistral Large 2', category: 'coding' },
		// Mistral Medium Series
		{ id: 'mistral-medium-3-1-25-08', name: 'Mistral Medium 3.1', category: 'coding' },
		{ id: 'mistral-medium-3-25-05', name: 'Mistral Medium 3', category: 'coding' },
		// Mistral Small Series
		{ id: 'mistral-small-4-0-26-03', name: 'Mistral Small 4', category: 'general' },
		{ id: 'mistral-small-3-2-25-06', name: 'Mistral Small 3.2', category: 'general' },
		{ id: 'mistral-small-3-1-25-03', name: 'Mistral Small 3.1', category: 'general' },
		// Ministral Series (Edge)
		{ id: 'ministral-3-14b-25-12', name: 'Ministral 3 14B', category: 'general' },
		{ id: 'ministral-3-8b-25-12', name: 'Ministral 3 8B', category: 'general' },
		{ id: 'ministral-3-3b-25-12', name: 'Ministral 3 3B', category: 'general' },
		// Coding Specialized
		{ id: 'codestral-25-08', name: 'Codestral', category: 'coding' },
		{ id: 'codestral-2501', name: 'Codestral (Jan 2025)', category: 'coding' },
		{ id: 'devstral-2-25-12', name: 'Devstral 2', category: 'coding' },
		{ id: 'devstral-small-2-25-12', name: 'Devstral Small 2', category: 'coding' },
		{ id: 'devstral-medium-1-0-25-07', name: 'Devstral Medium 1.0', category: 'coding' },
		// Vision
		{ id: 'pixtral-large-24-11', name: 'Pixtral Large', category: 'vision' },
		{ id: 'pixtral-12b-24-09', name: 'Pixtral 12B', category: 'vision' },
		// Magistral Reasoning
		{ id: 'magistral-medium-1-2-25-09', name: 'Magistral Medium 1.2', category: 'coding' },
		{ id: 'magistral-small-1-2-25-09', name: 'Magistral Small 1.2', category: 'coding' },
		// Open Models
		{ id: 'open-mistral-7b', name: 'Mistral 7B', category: 'general' },
		{ id: 'open-mixtral-8x22b', name: 'Mixtral 8x22B', category: 'general' },
		{ id: 'open-mixtral-8x7b', name: 'Mixtral 8x7B', category: 'general' }
	],
	moonshot: [
		// Kimi Series
		{ id: 'kimi-k2-instruct-0905', name: 'Kimi K2', category: 'coding' },
		{ id: 'kimi-k2.5-instruct', name: 'Kimi K2.5', category: 'coding' },
		{ id: 'moonshot-v1-8k', name: 'Moonshot V1 8K', category: 'general' },
		{ id: 'moonshot-v1-32k', name: 'Moonshot V1 32K', category: 'general' },
		{ id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', category: 'general' }
	],
	xai: [
		// Grok Series
		{ id: 'grok-4.1-fast', name: 'Grok 4.1 Fast', category: 'coding' },
		{ id: 'grok-4.1-mini', name: 'Grok 4.1 Mini', category: 'general' },
		{ id: 'grok-4-fast', name: 'Grok 4 Fast', category: 'coding' },
		{ id: 'grok-2-1212', name: 'Grok 2', category: 'coding' },
		{ id: 'grok-2-mini-1212', name: 'Grok 2 Mini', category: 'general' },
		{ id: 'grok-beta', name: 'Grok Beta', category: 'coding' }
	],
	minimax: [
		// MiniMax M2 Series (Latest - recursive self-improvement)
		{ id: 'MiniMax-M2.7', name: 'MiniMax-M2.7 (60 tps)', category: 'coding' },
		{ id: 'MiniMax-M2.7-highspeed', name: 'MiniMax-M2.7 Highspeed (100 tps)', category: 'coding' },
		// MiniMax M2.5 Series (Peak Performance)
		{ id: 'MiniMax-M2.5', name: 'MiniMax-M2.5 (60 tps)', category: 'coding' },
		{ id: 'MiniMax-M2.5-highspeed', name: 'MiniMax-M2.5 Highspeed (100 tps)', category: 'coding' },
		// MiniMax M2.1 Series (Multi-Language Programming)
		{ id: 'MiniMax-M2.1', name: 'MiniMax-M2.1 (60 tps)', category: 'coding' },
		{ id: 'MiniMax-M2.1-highspeed', name: 'MiniMax-M2.1 Highspeed (100 tps)', category: 'coding' },
		// MiniMax M2 Series (Agentic capabilities)
		{ id: 'MiniMax-M2', name: 'MiniMax-M2 (Agentic)', category: 'coding' }
	],
	'minimax-coding': [
		// MiniMax M2 Series (Latest - recursive self-improvement)
		{ id: 'MiniMax-M2.7', name: 'MiniMax-M2.7 (60 tps)', category: 'coding' },
		{ id: 'MiniMax-M2.7-highspeed', name: 'MiniMax-M2.7 Highspeed (100 tps)', category: 'coding' },
		// MiniMax M2.5 Series (Peak Performance)
		{ id: 'MiniMax-M2.5', name: 'MiniMax-M2.5 (60 tps)', category: 'coding' },
		{ id: 'MiniMax-M2.5-highspeed', name: 'MiniMax-M2.5 Highspeed (100 tps)', category: 'coding' },
		// MiniMax M2.1 Series (Multi-Language Programming)
		{ id: 'MiniMax-M2.1', name: 'MiniMax-M2.1 (60 tps)', category: 'coding' },
		{ id: 'MiniMax-M2.1-highspeed', name: 'MiniMax-M2.1 Highspeed (100 tps)', category: 'coding' },
		// MiniMax M2 Series (Agentic capabilities)
		{ id: 'MiniMax-M2', name: 'MiniMax-M2 (Agentic)', category: 'coding' }
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
