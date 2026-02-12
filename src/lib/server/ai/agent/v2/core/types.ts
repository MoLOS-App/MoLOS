/**
 * Core Types with TypeBox Schemas
 *
 * Foundation types for the modular agent architecture.
 * All types include both TypeScript interfaces and TypeBox schemas for runtime validation.
 */

import { Type, type Static } from '@sinclair/typebox';

// ============================================================================
// Tool Types
// ============================================================================

/**
 * JSON Schema for tool parameters
 */
export const ToolParameterSchema = Type.Object({
	type: Type.Optional(Type.String()),
	properties: Type.Optional(Type.Record(Type.String(), Type.Any())),
	required: Type.Optional(Type.Array(Type.String()))
});
export type ToolParameterSchema = Static<typeof ToolParameterSchema>;

/**
 * Tool definition schema
 */
export const ToolDefinitionSchema = Type.Object({
	name: Type.String({ minLength: 1 }),
	description: Type.String({ minLength: 1 }),
	parameters: Type.Optional(ToolParameterSchema),
	execute: Type.Optional(Type.Function([], Type.Any())) // Runtime only, not serialized
});
export interface ToolDefinition {
	name: string;
	description: string;
	parameters?: {
		type?: string;
		properties?: Record<string, unknown>;
		required?: string[];
	};
	execute?: (params: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Tool call schema
 */
export const ToolCallSchema = Type.Object({
	id: Type.String(),
	name: Type.String(),
	parameters: Type.Record(Type.String(), Type.Any())
});
export interface ToolCall {
	id: string;
	name: string;
	parameters: Record<string, unknown>;
}

/**
 * Tool execution result schema
 */
export const ToolExecutionResultSchema = Type.Object({
	success: Type.Boolean(),
	result: Type.Any(),
	error: Type.Optional(Type.String()),
	durationMs: Type.Number(),
	cached: Type.Optional(Type.Boolean())
});
export interface ToolExecutionResult {
	success: boolean;
	result: unknown;
	error?: string;
	durationMs: number;
	cached?: boolean;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Message role enum
 */
export const MessageRole = Type.Union([
	Type.Literal('system'),
	Type.Literal('user'),
	Type.Literal('assistant'),
	Type.Literal('tool')
]);
export type MessageRole = Static<typeof MessageRole>;

/**
 * Agent message schema
 */
export const AgentMessageSchema = Type.Object({
	role: MessageRole,
	content: Type.Union([Type.String(), Type.Any()]),
	toolCalls: Type.Optional(Type.Array(ToolCallSchema)),
	toolCallId: Type.Optional(Type.String()),
	metadata: Type.Optional(Type.Record(Type.String(), Type.Any()))
});
export interface AgentMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string | unknown;
	toolCalls?: ToolCall[];
	toolCallId?: string;
	metadata?: Record<string, unknown>;
}

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Thinking level for reasoning depth
 */
export const ThinkingLevelSchema = Type.Union([
	Type.Literal('off'),
	Type.Literal('minimal'),
	Type.Literal('low'),
	Type.Literal('medium'),
	Type.Literal('high')
]);
export type ThinkingLevel = Static<typeof ThinkingLevelSchema>;

/**
 * Thought schema (ReAct pattern)
 */
export const ThoughtSchema = Type.Object({
	id: Type.String(),
	iteration: Type.Number(),
	reasoning: Type.String(),
	nextAction: Type.Union([
		Type.Literal('use_tool'),
		Type.Literal('complete'),
		Type.Literal('ask_user'),
		Type.Literal('retry')
	]),
	toolName: Type.Optional(Type.String()),
	toolParameters: Type.Optional(Type.Record(Type.String(), Type.Any())),
	confidence: Type.Number({ minimum: 0, maximum: 1 })
});
export interface Thought {
	id: string;
	iteration: number;
	reasoning: string;
	nextAction: 'use_tool' | 'complete' | 'ask_user' | 'retry';
	toolName?: string;
	toolParameters?: Record<string, unknown>;
	confidence: number;
}

/**
 * Observation schema (ReAct pattern)
 */
export const ObservationSchema = Type.Object({
	id: Type.String(),
	thoughtId: Type.String(),
	toolName: Type.Optional(Type.String()),
	result: Type.Any(),
	error: Type.Optional(Type.String()),
	durationMs: Type.Number(),
	timestamp: Type.Number(),
	isSuccess: Type.Boolean()
});
export interface Observation {
	id: string;
	thoughtId: string;
	toolName?: string;
	result: unknown;
	error?: string;
	durationMs: number;
	timestamp: number;
	isSuccess: boolean;
}

/**
 * Reflection schema (ReAct pattern)
 */
export const ReflectionSchema = Type.Object({
	id: Type.String(),
	observationId: Type.String(),
	thoughts: Type.String(),
	planChanged: Type.Boolean(),
	newPlanSteps: Type.Optional(Type.Array(Type.String())),
	satisfied: Type.Boolean(),
	shouldContinue: Type.Boolean(),
	nextStep: Type.Union([
		Type.Literal('continue'),
		Type.Literal('adjust_plan'),
		Type.Literal('complete'),
		Type.Literal('request_help')
	])
});
export interface Reflection {
	id: string;
	observationId: string;
	thoughts: string;
	planChanged: boolean;
	newPlanSteps?: string[];
	satisfied: boolean;
	shouldContinue: boolean;
	nextStep: 'continue' | 'adjust_plan' | 'complete' | 'request_help';
}

// ============================================================================
// Plan Types
// ============================================================================

/**
 * Plan step status
 */
export const PlanStepStatusSchema = Type.Union([
	Type.Literal('pending'),
	Type.Literal('in_progress'),
	Type.Literal('completed'),
	Type.Literal('failed'),
	Type.Literal('skipped')
]);
export type PlanStepStatus = Static<typeof PlanStepStatusSchema>;

/**
 * Plan step schema
 */
export const PlanStepSchema = Type.Object({
	id: Type.String(),
	description: Type.String(),
	toolName: Type.Optional(Type.String()),
	parameters: Type.Optional(Type.Record(Type.String(), Type.Any())),
	status: PlanStepStatusSchema,
	dependencies: Type.Array(Type.String()),
	result: Type.Optional(Type.Any()),
	error: Type.Optional(Type.String()),
	startedAt: Type.Optional(Type.Number()),
	completedAt: Type.Optional(Type.Number())
});
export interface PlanStep {
	id: string;
	description: string;
	toolName?: string;
	parameters?: Record<string, unknown>;
	status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
	dependencies: string[];
	result?: unknown;
	error?: string;
	startedAt?: number;
	completedAt?: number;
}

/**
 * Execution plan schema
 */
export const ExecutionPlanSchema = Type.Object({
	id: Type.String(),
	goal: Type.String(),
	steps: Type.Array(PlanStepSchema),
	status: Type.Union([
		Type.Literal('draft'),
		Type.Literal('active'),
		Type.Literal('completed'),
		Type.Literal('failed')
	]),
	createdAt: Type.Number(),
	startedAt: Type.Optional(Type.Number()),
	completedAt: Type.Optional(Type.Number()),
	currentStepId: Type.Optional(Type.String())
});
export interface ExecutionPlan {
	id: string;
	goal: string;
	steps: PlanStep[];
	status: 'draft' | 'active' | 'completed' | 'failed';
	createdAt: number;
	startedAt?: number;
	completedAt?: number;
	currentStepId?: string;
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session state schema
 */
export const SessionStateSchema = Type.Object({
	sessionId: Type.String(),
	userId: Type.String(),
	runId: Type.String(),
	createdAt: Type.Number(),
	updatedAt: Type.Number(),
	messageCount: Type.Number(),
	tokenCount: Type.Optional(Type.Number()),
	lastActivity: Type.Number(),
	isActive: Type.Boolean()
});
export interface SessionState {
	sessionId: string;
	userId: string;
	runId: string;
	createdAt: number;
	updatedAt: number;
	messageCount: number;
	tokenCount?: number;
	lastActivity: number;
	isActive: boolean;
}

// ============================================================================
// Agent Configuration Types
// ============================================================================

/**
 * LLM provider type
 */
export const LlmProviderSchema = Type.Union([
	Type.Literal('anthropic'),
	Type.Literal('openai'),
	Type.Literal('openrouter'),
	Type.Literal('ollama'),
	Type.Literal('zai')
]);
export type LlmProvider = Static<typeof LlmProviderSchema>;

/**
 * Agent configuration schema
 */
export const AgentConfigSchema = Type.Object({
	// LLM settings
	provider: LlmProviderSchema,
	modelName: Type.String(),
	apiKey: Type.Optional(Type.String()),
	baseUrl: Type.Optional(Type.String()),
	maxTokens: Type.Optional(Type.Number()),
	temperature: Type.Optional(Type.Number()),
	topP: Type.Optional(Type.Number()),

	// Execution settings
	maxSteps: Type.Optional(Type.Number()),
	maxDurationMs: Type.Optional(Type.Number()),
	thinkingLevel: Type.Optional(ThinkingLevelSchema),
	autonomousMode: Type.Optional(Type.Boolean()),

	// Cache settings
	toolCacheSize: Type.Optional(Type.Number()),
	toolCacheTtlMs: Type.Optional(Type.Number()),
	llmCacheEnabled: Type.Optional(Type.Boolean()),

	// Retry settings
	retryMax: Type.Optional(Type.Number()),
	retryBaseMs: Type.Optional(Type.Number()),
	retryMaxDelayMs: Type.Optional(Type.Number()),
	llmTimeoutMs: Type.Optional(Type.Number()),

	// Feature flags
	streamEnabled: Type.Optional(Type.Boolean()),
	telemetryEnabled: Type.Optional(Type.Boolean()),
	compactionEnabled: Type.Optional(Type.Boolean())
});
export interface AgentConfig {
	// LLM settings
	provider: LlmProvider;
	modelName: string;
	apiKey?: string;
	baseUrl?: string;
	maxTokens?: number;
	temperature?: number;
	topP?: number;

	// Execution settings
	maxSteps?: number;
	maxDurationMs?: number;
	thinkingLevel?: ThinkingLevel;
	autonomousMode?: boolean;

	// Cache settings
	toolCacheSize?: number;
	toolCacheTtlMs?: number;
	llmCacheEnabled?: boolean;

	// Retry settings
	retryMax?: number;
	retryBaseMs?: number;
	retryMaxDelayMs?: number;
	llmTimeoutMs?: number;

	// Feature flags
	streamEnabled?: boolean;
	telemetryEnabled?: boolean;
	compactionEnabled?: boolean;
}

// ============================================================================
// Agent State Types
// ============================================================================

/**
 * Agent execution state schema
 */
export const AgentStateSchema = Type.Object({
	runId: Type.String(),
	sessionId: Type.String(),
	userId: Type.String(),
	plan: Type.Optional(ExecutionPlanSchema),
	currentIteration: Type.Number(),
	totalStepsCompleted: Type.Number(),
	lastToolSignature: Type.Optional(Type.String()),
	messages: Type.Array(AgentMessageSchema),
	thoughts: Type.Array(ThoughtSchema),
	observations: Type.Array(ObservationSchema),
	isComplete: Type.Boolean(),
	completionReason: Type.Optional(Type.String())
});
export interface AgentState {
	runId: string;
	sessionId: string;
	userId: string;
	plan: ExecutionPlan | null;
	currentIteration: number;
	totalStepsCompleted: number;
	lastToolSignature: string | null;
	messages: AgentMessage[];
	thoughts: Thought[];
	observations: Observation[];
	isComplete: boolean;
	completionReason?: string;
}

// ============================================================================
// Telemetry Types
// ============================================================================

/**
 * Agent telemetry schema
 */
export const AgentTelemetrySchema = Type.Object({
	runId: Type.String(),
	startMs: Type.Number(),
	endMs: Type.Optional(Type.Number()),
	durationMs: Type.Number(),
	totalSteps: Type.Number(),
	successfulSteps: Type.Number(),
	failedSteps: Type.Number(),
	tokenEstimateIn: Type.Number(),
	tokenEstimateOut: Type.Number(),
	llmCalls: Type.Number(),
	cacheHits: Type.Number(),
	cacheMisses: Type.Number(),
	errors: Type.Number()
});
export interface AgentTelemetry {
	runId: string;
	startMs: number;
	endMs?: number;
	durationMs: number;
	totalSteps: number;
	successfulSteps: number;
	failedSteps: number;
	tokenEstimateIn: number;
	tokenEstimateOut: number;
	llmCalls: number;
	cacheHits: number;
	cacheMisses: number;
	errors: number;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Agent action for UI display
 */
export const AgentActionSchema = Type.Object({
	type: Type.Union([
		Type.Literal('read'),
		Type.Literal('write'),
		Type.Literal('plan'),
		Type.Literal('think'),
		Type.Literal('error')
	]),
	entity: Type.String(),
	description: Type.String(),
	status: Type.Union([
		Type.Literal('pending'),
		Type.Literal('executed'),
		Type.Literal('failed')
	]),
	data: Type.Record(Type.String(), Type.Any())
});
export interface AgentAction {
	type: 'read' | 'write' | 'plan' | 'think' | 'error';
	entity: string;
	description: string;
	status: 'pending' | 'executed' | 'failed';
	data: Record<string, unknown>;
}

/**
 * Agent event for tracking
 */
export const AgentEventSchema = Type.Object({
	type: Type.String(),
	timestamp: Type.Number(),
	data: Type.Record(Type.String(), Type.Any())
});
export interface AgentEvent {
	type: string;
	timestamp: number;
	data: Record<string, unknown>;
}

/**
 * Execution result schema
 */
export const ExecutionResultSchema = Type.Object({
	success: Type.Boolean(),
	message: Type.String(),
	actions: Type.Array(AgentActionSchema),
	plan: Type.Optional(ExecutionPlanSchema),
	telemetry: AgentTelemetrySchema,
	events: Type.Array(AgentEventSchema)
});
export interface ExecutionResult {
	success: boolean;
	message: string;
	actions: AgentAction[];
	plan: ExecutionPlan | null;
	telemetry: AgentTelemetry;
	events: AgentEvent[];
}

// ============================================================================
// Progress Types (for streaming)
// ============================================================================

/**
 * Progress event type
 */
export const ProgressEventTypeSchema = Type.Union([
	Type.Literal('plan'),
	Type.Literal('step_start'),
	Type.Literal('step_complete'),
	Type.Literal('step_failed'),
	Type.Literal('thinking'),
	Type.Literal('thought'),
	Type.Literal('observation'),
	Type.Literal('complete'),
	Type.Literal('error')
]);
export type ProgressEventType = Static<typeof ProgressEventTypeSchema>;

/**
 * Progress event schema (for streaming to UI)
 */
export const ProgressEventSchema = Type.Object({
	type: ProgressEventTypeSchema,
	timestamp: Type.Number(),
	data: Type.Record(Type.String(), Type.Any())
});
export interface ProgressEvent {
	type: 'plan' | 'step_start' | 'step_complete' | 'step_failed' | 'thinking' | 'thought' | 'observation' | 'complete' | 'error';
	timestamp: number;
	data: Record<string, unknown>;
}

// ============================================================================
// Agent Options (for processMessage)
// ============================================================================

/**
 * Agent options schema
 */
export const AgentOptionsSchema = Type.Object({
	streamEnabled: Type.Optional(Type.Boolean()),
	maxSteps: Type.Optional(Type.Number()),
	maxDurationMs: Type.Optional(Type.Number()),
	onProgress: Type.Optional(Type.Any()), // Function type, not serializable
	autonomousMode: Type.Optional(Type.Boolean()),
	thinkingLevel: Type.Optional(ThinkingLevelSchema)
});
export interface AgentOptions {
	streamEnabled?: boolean;
	maxSteps?: number;
	maxDurationMs?: number;
	onProgress?: (event: ProgressEvent) => void | Promise<void>;
	autonomousMode?: boolean;
	thinkingLevel?: ThinkingLevel;
}

// ============================================================================
// LLM Response Types
// ============================================================================

/**
 * LLM response schema
 */
export const LlmResponseSchema = Type.Object({
	content: Type.String(),
	toolCalls: Type.Optional(Type.Array(ToolCallSchema)),
	rawToolCalls: Type.Optional(Type.Array(Type.Any())),
	thinking: Type.Optional(Type.String()),
	usage: Type.Optional(Type.Object({
		promptTokens: Type.Number(),
		completionTokens: Type.Number(),
		totalTokens: Type.Number()
	}))
});
export interface LlmResponse {
	content: string;
	toolCalls?: ToolCall[];
	rawToolCalls?: unknown[];
	thinking?: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = {
	ok: true;
	value: T;
} | {
	ok: false;
	error: E;
};

/**
 * Creates a successful result
 */
export function Ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

/**
 * Creates a failed result
 */
export function Err<E>(error: E): Result<never, E> {
	return { ok: false, error };
}
