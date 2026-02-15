export declare const AIProvider: {
    readonly OPENAI: "openai";
    readonly ANTHROPIC: "anthropic";
    readonly OLLAMA: "ollama";
    readonly OPENROUTER: "openrouter";
    readonly ZAI: "zai";
};
export declare const AIRole: {
    readonly USER: "user";
    readonly ASSISTANT: "assistant";
    readonly SYSTEM: "system";
    readonly TOOL: "tool";
};
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
    attachments?: {
        name: string;
    }[];
    parts?: unknown[];
    createdAt: Date;
    metadata?: Record<string, unknown>;
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
    execute: (params: any) => Promise<any>;
}
export interface AiAction {
    type: 'read' | 'write';
    entity: string;
    description: string;
    status: 'pending' | 'confirmed' | 'executed' | 'failed';
    data?: unknown;
}
export type AiAgentEventType = 'run_start' | 'iteration' | 'llm_call' | 'llm_retry' | 'tool_call_start' | 'tool_call_end' | 'guardrail' | 'error' | 'run_end';
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
export declare const PREDEFINED_MODELS: {
    openai: {
        id: string;
        name: string;
    }[];
    anthropic: {
        id: string;
        name: string;
    }[];
    openrouter: {
        id: string;
        name: string;
    }[];
    ollama: {
        id: string;
        name: string;
    }[];
    zai: {
        id: string;
        name: string;
    }[];
};
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
//# sourceMappingURL=ai.d.ts.map