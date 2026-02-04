/**
 * Core types for the modular agent architecture
 */

// Re-export types from models/ai to maintain compatibility
import type {
	ToolDefinition as ToolDefinitionImport,
	AiAction as AiActionImport,
	AiAgentTelemetry as AiAgentTelemetryImport,
	AiAgentEvent as AiAgentEventImport
} from '$lib/models/ai';

export type ToolDefinition = ToolDefinitionImport;
export type AiAction = AiActionImport;
export type AiAgentEvent = AiAgentEventImport;

/**
 * A single step in an execution plan
 */
export interface PlanStep {
	id: string;
	description: string;
	toolName?: string;
	parameters?: Record<string, unknown>;
	status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
	dependencies: string[]; // IDs of steps that must complete first
	result?: unknown;
	error?: string;
	startedAt?: number;
	completedAt?: number;
}

/**
 * An execution plan with multiple steps
 */
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

/**
 * Agent execution state
 */
export interface AgentState {
	runId: string;
	sessionId: string;
	userId: string;
	plan: ExecutionPlan | null;
	currentIteration: number;
	totalStepsCompleted: number;
	lastToolSignature: string | null;
	messages: AgentMessage[];
	actions: InternalAgentAction[];
	isComplete: boolean;
}

/**
 * Internal agent message representation
 */
export interface AgentMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string | unknown;
	toolCalls?: ToolCall[];
	toolCallId?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Tool call representation
 */
export interface ToolCall {
	id: string;
	name: string;
	parameters: Record<string, unknown>;
}

/**
 * Agent action for UI (internal type, extends AiAction)
 */
export interface InternalAgentAction {
	type: 'read' | 'write' | 'plan' | 'think' | 'error';
	entity: string;
	description: string;
	status: 'pending' | 'executed' | 'failed';
	data: Record<string, unknown>;
}

/**
 * Progress event for streaming to UI
 */
export interface ProgressEvent {
	type: 'plan' | 'step_start' | 'step_complete' | 'step_failed' | 'thinking' | 'complete' | 'error';
	timestamp: number;
	data: Record<string, unknown>;
}

/**
 * Result of a plan execution
 */
export interface ExecutionResult {
	success: boolean;
	message: string;
	actions: AiAction[];
	plan: ExecutionPlan | null;
	telemetry: AgentTelemetry;
	events: AgentEvent[];
}

/**
 * Agent telemetry data - use AiAgentTelemetry from models/ai
 * We add durationMs as required for our internal use
 */
export interface AgentTelemetry extends Omit<AiAgentTelemetryImport, 'durationMs'> {
	durationMs: number;
}

/**
 * Agent event for tracking - use AiAgentEvent from models/ai
 */
export type AgentEvent = AiAgentEventImport;

/**
 * Options for agent execution
 */
export interface AgentOptions {
	streamEnabled?: boolean;
	maxSteps?: number;
	maxDurationMs?: number;
	onProgress?: (event: ProgressEvent) => void | Promise<void>;
}

/**
 * Result of a tool execution
 */
export interface ToolExecutionResult {
	success: boolean;
	result: unknown;
	error?: string;
	durationMs: number;
	cached?: boolean;
}

/**
 * Reflection result after an action
 */
export interface ReflectionResult {
	isSatisfied: boolean;
	shouldContinue: boolean;
	nextAction: 'continue' | 'retry' | 'skip' | 'complete';
	thoughts: string;
	corrections?: string[];
}
