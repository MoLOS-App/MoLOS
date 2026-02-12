/**
 * Event Types for the Agent Event Bus
 *
 * Defines all events that can be emitted during agent execution.
 * Events follow a hierarchical naming convention: category.action
 */

import type {
	AgentState,
	ExecutionPlan,
	Thought,
	Observation,
	Reflection,
	ToolCall,
	ToolExecutionResult,
	ProgressEvent,
	AgentTelemetry
} from '../core/types';

// ============================================================================
// Base Event Type
// ============================================================================

/**
 * Base interface for all agent events
 */
export interface BaseAgentEvent {
	/** Unique event ID */
	id: string;
	/** Event type (category.action format) */
	type: string;
	/** Timestamp in milliseconds */
	timestamp: number;
	/** Run ID this event belongs to */
	runId: string;
	/** Session ID this event belongs to */
	sessionId: string;
}

// ============================================================================
// Lifecycle Events
// ============================================================================

/**
 * Agent run started
 */
export interface RunStartedEvent extends BaseAgentEvent {
	type: 'run.started';
	data: {
		userId: string;
		userMessage: string;
		config: {
			provider: string;
			modelName: string;
			autonomousMode: boolean;
			thinkingLevel: string;
		};
	};
}

/**
 * Agent run completed
 */
export interface RunCompletedEvent extends BaseAgentEvent {
	type: 'run.completed';
	data: {
		success: boolean;
		message: string;
		telemetry: AgentTelemetry;
	};
}

/**
 * Agent run failed
 */
export interface RunFailedEvent extends BaseAgentEvent {
	type: 'run.failed';
	data: {
		error: string;
		errorCode?: string;
		partialResult?: unknown;
	};
}

/**
 * Agent run aborted (user cancelled)
 */
export interface RunAbortedEvent extends BaseAgentEvent {
	type: 'run.aborted';
	data: {
		reason: string;
		lastState?: Partial<AgentState>;
	};
}

// ============================================================================
// Plan Events
// ============================================================================

/**
 * Plan created
 */
export interface PlanCreatedEvent extends BaseAgentEvent {
	type: 'plan.created';
	data: {
		plan: ExecutionPlan;
	};
}

/**
 * Plan step started
 */
export interface PlanStepStartedEvent extends BaseAgentEvent {
	type: 'plan.step_started';
	data: {
		stepId: string;
		stepNumber: number;
		totalSteps: number;
		description: string;
		toolName?: string;
	};
}

/**
 * Plan step completed
 */
export interface PlanStepCompletedEvent extends BaseAgentEvent {
	type: 'plan.step_completed';
	data: {
		stepId: string;
		stepNumber: number;
		totalSteps: number;
		description: string;
		result?: unknown;
		durationMs: number;
	};
}

/**
 * Plan step failed
 */
export interface PlanStepFailedEvent extends BaseAgentEvent {
	type: 'plan.step_failed';
	data: {
		stepId: string;
		stepNumber: number;
		totalSteps: number;
		description: string;
		error: string;
	};
}

/**
 * Plan updated (dynamic adjustment)
 */
export interface PlanUpdatedEvent extends BaseAgentEvent {
	type: 'plan.updated';
	data: {
		plan: ExecutionPlan;
		reason: string;
	};
}

// ============================================================================
// ReAct Loop Events
// ============================================================================

/**
 * Thought generated (ReAct pattern)
 */
export interface ThoughtGeneratedEvent extends BaseAgentEvent {
	type: 'react.thought';
	data: {
		thought: Thought;
		iteration: number;
	};
}

/**
 * Observation created (ReAct pattern)
 */
export interface ObservationCreatedEvent extends BaseAgentEvent {
	type: 'react.observation';
	data: {
		observation: Observation;
		iteration: number;
	};
}

/**
 * Reflection completed (ReAct pattern)
 */
export interface ReflectionCompletedEvent extends BaseAgentEvent {
	type: 'react.reflection';
	data: {
		reflection: Reflection;
		iteration: number;
	};
}

// ============================================================================
// Tool Events
// ============================================================================

/**
 * Tool call initiated (before execution)
 */
export interface ToolCallInitiatedEvent extends BaseAgentEvent {
	type: 'tool.call_initiated';
	data: {
		call: ToolCall;
		cached: boolean;
	};
}

/**
 * Tool call completed
 */
export interface ToolCallCompletedEvent extends BaseAgentEvent {
	type: 'tool.call_completed';
	data: {
		call: ToolCall;
		result: ToolExecutionResult;
	};
}

/**
 * Tool call failed
 */
export interface ToolCallFailedEvent extends BaseAgentEvent {
	type: 'tool.call_failed';
	data: {
		call: ToolCall;
		error: string;
	};
}

/**
 * Tool cache hit
 */
export interface ToolCacheHitEvent extends BaseAgentEvent {
	type: 'tool.cache_hit';
	data: {
		toolName: string;
		cacheKey: string;
	};
}

/**
 * Tool cache miss
 */
export interface ToolCacheMissEvent extends BaseAgentEvent {
	type: 'tool.cache_miss';
	data: {
		toolName: string;
		cacheKey: string;
	};
}

// ============================================================================
// LLM Events
// ============================================================================

/**
 * LLM request started
 */
export interface LlmRequestStartedEvent extends BaseAgentEvent {
	type: 'llm.request_started';
	data: {
		provider: string;
		model: string;
		messageCount: number;
		toolCount: number;
	};
}

/**
 * LLM response received
 */
export interface LlmResponseReceivedEvent extends BaseAgentEvent {
	type: 'llm.response_received';
	data: {
		provider: string;
		model: string;
		hasToolCalls: boolean;
		contentLength: number;
		durationMs: number;
		usage?: {
			promptTokens: number;
			completionTokens: number;
			totalTokens: number;
		};
	};
}

/**
 * LLM request failed
 */
export interface LlmRequestFailedEvent extends BaseAgentEvent {
	type: 'llm.request_failed';
	data: {
		provider: string;
		model: string;
		error: string;
		statusCode?: number;
		willRetry: boolean;
	};
}

/**
 * LLM fallback triggered
 */
export interface LlmFallbackTriggeredEvent extends BaseAgentEvent {
	type: 'llm.fallback_triggered';
	data: {
		fromProvider: string;
		toProvider: string;
		reason: string;
	};
}

/**
 * Circuit breaker state changed
 */
export interface CircuitBreakerStateChangedEvent extends BaseAgentEvent {
	type: 'llm.circuit_breaker_changed';
	data: {
		provider: string;
		fromState: 'closed' | 'open' | 'half-open';
		toState: 'closed' | 'open' | 'half-open';
		reason: string;
	};
}

// ============================================================================
// Hook Events
// ============================================================================

/**
 * Hook executed
 */
export interface HookExecutedEvent extends BaseAgentEvent {
	type: 'hook.executed';
	data: {
		hookType: string;
		hookName: string;
		result: 'continue' | 'block' | 'modify';
		durationMs: number;
	};
}

/**
 * Hook blocked action
 */
export interface HookBlockedEvent extends BaseAgentEvent {
	type: 'hook.blocked';
	data: {
		hookType: string;
		hookName: string;
		reason: string;
		originalAction?: unknown;
	};
}

// ============================================================================
// Session Events
// ============================================================================

/**
 * Session created
 */
export interface SessionCreatedEvent extends BaseAgentEvent {
	type: 'session.created';
	data: {
		userId: string;
	};
}

/**
 * Session restored
 */
export interface SessionRestoredEvent extends BaseAgentEvent {
	type: 'session.restored';
	data: {
		messageCount: number;
		tokenCount?: number;
	};
}

/**
 * Session compacted
 */
export interface SessionCompactedEvent extends BaseAgentEvent {
	type: 'session.compacted';
	data: {
		tokensBefore: number;
		tokensAfter: number;
		messagesRemoved: number;
		messagesPreserved: number;
	};
}

// ============================================================================
// Progress Events (for streaming to UI)
// ============================================================================

/**
 * Progress update (generic streaming event)
 */
export interface ProgressUpdateEvent extends BaseAgentEvent {
	type: 'progress.update';
	data: {
		event: ProgressEvent;
	};
}

/**
 * Thinking/Reasoning content
 */
export interface ThinkingEvent extends BaseAgentEvent {
	type: 'progress.thinking';
	data: {
		content: string;
		isComplete: boolean;
	};
}

/**
 * Streaming content chunk
 */
export interface StreamChunkEvent extends BaseAgentEvent {
	type: 'progress.stream_chunk';
	data: {
		content: string;
		channel: 'main' | 'thinking' | 'tool_result';
	};
}

// ============================================================================
// Error Events
// ============================================================================

/**
 * Error occurred
 */
export interface ErrorOccurredEvent extends BaseAgentEvent {
	type: 'error.occurred';
	data: {
		error: string;
		errorCode?: string;
		context?: Record<string, unknown>;
		recoverable: boolean;
		recoveryAttempt?: number;
	};
}

/**
 * Error recovered
 */
export interface ErrorRecoveredEvent extends BaseAgentEvent {
	type: 'error.recovered';
	data: {
		errorCode: string;
		recoveryStrategy: string;
		attempts: number;
	};
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * All agent event types
 */
export type AgentEventType =
	// Lifecycle
	| RunStartedEvent
	| RunCompletedEvent
	| RunFailedEvent
	| RunAbortedEvent
	// Plan
	| PlanCreatedEvent
	| PlanStepStartedEvent
	| PlanStepCompletedEvent
	| PlanStepFailedEvent
	| PlanUpdatedEvent
	// ReAct
	| ThoughtGeneratedEvent
	| ObservationCreatedEvent
	| ReflectionCompletedEvent
	// Tool
	| ToolCallInitiatedEvent
	| ToolCallCompletedEvent
	| ToolCallFailedEvent
	| ToolCacheHitEvent
	| ToolCacheMissEvent
	// LLM
	| LlmRequestStartedEvent
	| LlmResponseReceivedEvent
	| LlmRequestFailedEvent
	| LlmFallbackTriggeredEvent
	| CircuitBreakerStateChangedEvent
	// Hook
	| HookExecutedEvent
	| HookBlockedEvent
	// Session
	| SessionCreatedEvent
	| SessionRestoredEvent
	| SessionCompactedEvent
	// Progress
	| ProgressUpdateEvent
	| ThinkingEvent
	| StreamChunkEvent
	// Error
	| ErrorOccurredEvent
	| ErrorRecoveredEvent;

/**
 * Event type string literals
 */
export type EventTypeName = AgentEventType['type'];

/**
 * Event type to event mapping
 */
export interface EventTypeMap {
	'run.started': RunStartedEvent;
	'run.completed': RunCompletedEvent;
	'run.failed': RunFailedEvent;
	'run.aborted': RunAbortedEvent;
	'plan.created': PlanCreatedEvent;
	'plan.step_started': PlanStepStartedEvent;
	'plan.step_completed': PlanStepCompletedEvent;
	'plan.step_failed': PlanStepFailedEvent;
	'plan.updated': PlanUpdatedEvent;
	'react.thought': ThoughtGeneratedEvent;
	'react.observation': ObservationCreatedEvent;
	'react.reflection': ReflectionCompletedEvent;
	'tool.call_initiated': ToolCallInitiatedEvent;
	'tool.call_completed': ToolCallCompletedEvent;
	'tool.call_failed': ToolCallFailedEvent;
	'tool.cache_hit': ToolCacheHitEvent;
	'tool.cache_miss': ToolCacheMissEvent;
	'llm.request_started': LlmRequestStartedEvent;
	'llm.response_received': LlmResponseReceivedEvent;
	'llm.request_failed': LlmRequestFailedEvent;
	'llm.fallback_triggered': LlmFallbackTriggeredEvent;
	'llm.circuit_breaker_changed': CircuitBreakerStateChangedEvent;
	'hook.executed': HookExecutedEvent;
	'hook.blocked': HookBlockedEvent;
	'session.created': SessionCreatedEvent;
	'session.restored': SessionRestoredEvent;
	'session.compacted': SessionCompactedEvent;
	'progress.update': ProgressUpdateEvent;
	'progress.thinking': ThinkingEvent;
	'progress.stream_chunk': StreamChunkEvent;
	'error.occurred': ErrorOccurredEvent;
	'error.recovered': ErrorRecoveredEvent;
}

/**
 * Event handler function type
 */
export type EventHandler<T extends AgentEventType = AgentEventType> = (event: T) => void | Promise<void>;

/**
 * Event filter function type
 */
export type EventFilter = (event: AgentEventType) => boolean;
