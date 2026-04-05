/**
 * Event Types - Complete type definitions for agent events
 *
 * ## Overview
 * This module defines all event types used by the MoLOS Agent system.
 * Events follow two patterns: **typed events** (19 EventKind-based) and
 * **legacy events** (string type-based for backward compatibility).
 *
 * ## Typed Events Architecture
 * Typed events use `EventKind` enum for discrimination and provide
 * rich, structured payloads specific to each event type. This pattern:
 * - Enables exhaustive switch statements on event kind
 * - Provides compile-time safety for event payloads
 * - Allows AI to quickly identify event context from `kind` field
 *
 * ## EventKind Categories (19 types)
 *
 * ### Turn Lifecycle (2)
 * - `TurnStart` - New user turn begins
 * - `TurnEnd` - Turn completes
 *
 * ### LLM Events (4)
 * - `LLMRequest` - Before API call
 * - `LLMDelta` - Streaming token delta
 * - `LLMResponse` - Response complete
 * - `LLMRetry` - Retry attempt
 *
 * ### Context Management (2)
 * - `ContextCompress` - Messages dropped
 * - `SessionSummarize` - Summary generated
 *
 * ### Tool Execution (3)
 * - `ToolExecStart` - Tool begins
 * - `ToolExecEnd` - Tool completes
 * - `ToolExecSkipped` - Tool skipped
 *
 * ### Steering (1)
 * - `SteeringInjected` - Steering content added
 *
 * ### Follow-up & Interrupts (2)
 * - `FollowUpQueued` - Follow-up scheduled
 * - `InterruptReceived` - External interrupt
 *
 * ### Sub-turn Events (4)
 * - `SubTurnSpawn` - Sub-turn created
 * - `SubTurnEnd` - Sub-turn finished
 * - `SubTurnResultDelivered` - Result sent to parent
 * - `SubTurnOrphan` - Sub-turn orphaned
 *
 * ### Error (1)
 * - `Error` - Error occurred
 *
 * ## EventMeta Fields
 * All typed events include metadata for tracing and correlation:
 * - `agent_id` - Source agent identifier
 * - `turn_id` - Unique turn within session
 * - `session_key` - Groups related events
 * - `iteration` - Iteration count within turn
 * - `trace_path` - Debug trace path
 * - `source` - Event origin ('agent', 'llm', 'tool')
 *
 * ## AI Context Optimization Tips
 * - Access `kind` field first to identify event type (constant-time vs string matching)
 * - Use `EventMeta` fields for correlating events across turns
 * - Use type guard functions (`isEventKind`, `getEventKind`) for runtime checks
 * - Legacy events use `type` string discriminator; prefer typed events for new code
 */

import type { AgentEvent } from './event-bus.js';
import { EventKind, type EventKindValue } from './kind.js';

// Re-export EventKind from kind.ts for backward compatibility
// EventKind is defined in kind.ts to avoid circular dependencies
export { EventKind, type EventKindValue };

// =============================================================================
// EventMeta Interface
// =============================================================================

/**
 * Common metadata attached to all typed events
 *
 * Provides correlation data for tracing events across the agent system.
 * Every TypedAgentEvent includes this metadata for context tracking.
 *
 * @example
 * ```typescript
 * // Trace all events from a specific turn
 * subscriber.subscribe('*', (event) => {
 *   const meta = event.meta as EventMeta;
 *   if (meta.turn_id === targetTurnId) {
 *     console.log(`[${meta.source}]`, event.kind);
 *   }
 * });
 * ```
 */
export interface EventMeta {
	/** The agent instance that emitted this event - unique per agent */
	agent_id: string;
	/** Unique turn identifier within a session - increments per user message */
	turn_id: string;
	/** Session key for grouping related events - shared across agent instances */
	session_key: string;
	/** Iteration count within the turn - tracks agent loop iterations */
	iteration: number;
	/** Trace path for debugging - shows event propagation path */
	trace_path: string;
	/** Source of the event - indicates which component emitted it */
	source: string;
}

// =============================================================================
// Typed Payload Interfaces
// =============================================================================

/**
 * TurnStartPayload - Emitted when a new turn begins
 */
export interface TurnStartPayload {
	channel: string;
	chat_id: string;
	user_message: string;
	media_count: number;
}

/**
 * TurnEndPayload - Emitted when a turn completes
 */
export interface TurnEndPayload {
	status: string;
	iterations: number;
	duration_ms: number;
	final_content_len: number;
}

/**
 * LLMRequestPayload - Emitted before making an LLM API call
 */
export interface LLMRequestPayload {
	model: string;
	messages_count: number;
	tools_count: number;
	max_tokens: number;
}

/**
 * LLMDeltaPayload - Emitted for each streaming delta from LLM
 */
export interface LLMDeltaPayload {
	content_delta_len: number;
	reasoning_delta_len: number;
}

/**
 * LLMResponsePayload - Emitted when LLM response is complete
 */
export interface LLMResponsePayload {
	content_len: number;
	tool_calls: number;
	has_reasoning: boolean;
}

/**
 * LLMRetryPayload - Emitted when LLM call fails and retries
 */
export interface LLMRetryPayload {
	attempt: number;
	max_retries: number;
	reason: string;
	error: string;
	backoff_ms: number;
}

/**
 * ContextCompressPayload - Emitted when context is compressed
 */
export interface ContextCompressPayload {
	reason: string;
	dropped_messages: number;
	remaining_messages: number;
}

/**
 * SessionSummarizePayload - Emitted when session is summarized
 */
export interface SessionSummarizePayload {
	summarized_messages: number;
	kept_messages: number;
	summary_len: number;
	omitted_oversized: number;
}

/**
 * ToolExecStartPayload - Emitted when tool execution begins
 */
export interface ToolExecStartPayload {
	tool: string;
	arguments: Record<string, unknown>;
}

/**
 * ToolExecEndPayload - Emitted when tool execution completes
 */
export interface ToolExecEndPayload {
	tool: string;
	duration_ms: number;
	for_llm_len: number;
	for_user_len: number;
	is_error: boolean;
	async: boolean;
}

/**
 * ToolExecSkippedPayload - Emitted when tool execution is skipped
 */
export interface ToolExecSkippedPayload {
	tool: string;
	reason: string;
}

/**
 * SteeringInjectedPayload - Emitted when steering content is injected
 */
export interface SteeringInjectedPayload {
	count: number;
	total_content_len: number;
}

/**
 * FollowUpQueuedPayload - Emitted when a follow-up is queued
 */
export interface FollowUpQueuedPayload {
	source_tool: string;
	channel: string;
	chat_id: string;
	content_len: number;
}

/**
 * InterruptReceivedPayload - Emitted when an interrupt is received
 */
export interface InterruptReceivedPayload {
	kind: string;
	role: string;
	content_len: number;
	queue_depth: number;
	hint_len: number;
}

/**
 * SubTurnSpawnPayload - Emitted when a sub-turn spawns
 */
export interface SubTurnSpawnPayload {
	agent_id: string;
	label: string;
}

/**
 * SubTurnEndPayload - Emitted when a sub-turn ends
 */
export interface SubTurnEndPayload {
	agent_id: string;
	status: string;
}

/**
 * SubTurnResultDeliveredPayload - Emitted when sub-turn result is delivered
 */
export interface SubTurnResultDeliveredPayload {
	target_channel: string;
	target_chat_id: string;
	content_len: number;
}

/**
 * SubTurnOrphanPayload - Emitted when a sub-turn becomes orphaned
 */
export interface SubTurnOrphanPayload {
	agent_id: string;
	reason: string;
}

/**
 * ErrorPayload - Emitted when an error occurs
 */
export interface ErrorPayload {
	stage: string;
	message: string;
}

// =============================================================================
// Typed Event Interfaces
// =============================================================================

/**
 * Typed event interface extending base AgentEvent
 *
 * All typed events follow this structure with EventKind discrimination
 * and structured payloads. This replaces the legacy string-based type field.
 *
 * @typeParam T - The payload type specific to this event kind
 *
 * @example
 * ```typescript
 * // Full event structure
 * const event: TypedAgentEvent<TurnStartPayload> = {
 *   kind: EventKind.TurnStart,
 *   runId: 'run-123',
 *   seq: 1,
 *   stream: 'lifecycle',
 *   ts: Date.now(),
 *   meta: {
 *     agent_id: 'agent-1',
 *     turn_id: 'turn-456',
 *     session_key: 'session-abc',
 *     iteration: 0,
 *     trace_path: 'agent.turn_start',
 *     source: 'agent'
 *   },
 *   data: {
 *     channel: 'slack',
 *     chat_id: 'C123',
 *     user_message: 'Hello!',
 *     media_count: 0
 *   }
 * };
 * ```
 */
export interface TypedAgentEvent<T = Record<string, unknown>> extends Omit<AgentEvent, 'data'> {
	/** EventKind discriminator for type-safe event identification */
	kind: EventKindValue;
	/** Common metadata for all typed events */
	meta: EventMeta;
	/** Kind-specific payload data */
	data: T;
}

// =============================================================================
// Type guard functions
// =============================================================================

/**
 * Check if an event matches a specific EventKind
 */
export function isEventKind(event: AgentEvent, kind: EventKindValue): boolean {
	return (event as TypedAgentEvent).kind === kind;
}

/**
 * Get the EventKind from an event if present
 */
export function getEventKind(event: AgentEvent): EventKindValue | undefined {
	return (event as TypedAgentEvent).kind;
}

// =============================================================================
// Legacy Event Types (for backward compatibility)
// =============================================================================

/**
 * Event emitted when an agent starts
 */
export interface AgentStartEvent extends AgentEvent {
	type: 'agent_start';
	stream: 'lifecycle';
	data: {
		model: string;
		provider: string;
	};
}

/**
 * Event emitted when an agent ends
 */
export interface AgentEndEvent extends AgentEvent {
	type: 'agent_end';
	stream: 'lifecycle';
	data: {
		output: string;
		iterations: number;
		durationMs: number;
	};
}

/**
 * Event emitted when a message starts
 */
export interface MessageStartEvent extends AgentEvent {
	type: 'message_start';
	stream: 'assistant';
	data: {
		messageId: string;
	};
}

/**
 * Event emitted when a message is updated (streaming)
 */
export interface MessageUpdateEvent extends AgentEvent {
	type: 'message_update';
	stream: 'assistant';
	data: {
		messageId: string;
		delta: string;
	};
}

/**
 * Event emitted when a message ends
 */
export interface MessageEndEvent extends AgentEvent {
	type: 'message_end';
	stream: 'assistant';
	data: {
		messageId: string;
		content: string;
	};
}

/**
 * Event emitted when tool execution starts
 */
export interface ToolExecutionStartEvent extends AgentEvent {
	type: 'tool_execution_start';
	stream: 'tool';
	data: {
		toolName: string;
		toolCallId: string;
		args: Record<string, unknown>;
	};
}

/**
 * Event emitted when tool execution is updated (progress)
 */
export interface ToolExecutionUpdateEvent extends AgentEvent {
	type: 'tool_execution_update';
	stream: 'tool';
	data: {
		toolName: string;
		toolCallId: string;
		progress?: string;
	};
}

/**
 * Event emitted when tool execution ends
 */
export interface ToolExecutionEndEvent extends AgentEvent {
	type: 'tool_execution_end';
	stream: 'tool';
	data: {
		toolName: string;
		toolCallId: string;
		result: unknown;
		durationMs: number;
	};
}

/**
 * Event emitted when auto-compaction starts
 */
export interface AutoCompactionStartEvent extends AgentEvent {
	type: 'auto_compaction_start';
	stream: 'compaction';
	data: {
		reason: string;
		tokensBefore: number;
	};
}

/**
 * Event emitted when auto-compaction ends
 */
export interface AutoCompactionEndEvent extends AgentEvent {
	type: 'auto_compaction_end';
	stream: 'compaction';
	data: {
		tokensAfter: number;
		durationMs: number;
	};
}

/**
 * Event emitted when an error occurs
 */
export interface ErrorEvent extends AgentEvent {
	type: 'error';
	stream: 'error';
	data: {
		code: string;
		message: string;
		recoverable: boolean;
	};
}

// =============================================================================
// Type guards for legacy events
// =============================================================================

/**
 * Type guard for AgentStartEvent
 */
export function isAgentStartEvent(event: AgentEvent): event is AgentStartEvent {
	return event.type === 'agent_start';
}

/**
 * Type guard for AgentEndEvent
 */
export function isAgentEndEvent(event: AgentEvent): event is AgentEndEvent {
	return event.type === 'agent_end';
}

/**
 * Type guard for MessageStartEvent
 */
export function isMessageStartEvent(event: AgentEvent): event is MessageStartEvent {
	return event.type === 'message_start';
}

/**
 * Type guard for MessageEndEvent
 */
export function isMessageEndEvent(event: AgentEvent): event is MessageEndEvent {
	return event.type === 'message_end';
}

/**
 * Type guard for ToolExecutionStartEvent
 */
export function isToolExecutionStartEvent(event: AgentEvent): event is ToolExecutionStartEvent {
	return event.type === 'tool_execution_start';
}

/**
 * Type guard for ToolExecutionEndEvent
 */
export function isToolExecutionEndEvent(event: AgentEvent): event is ToolExecutionEndEvent {
	return event.type === 'tool_execution_end';
}

/**
 * Type guard for AutoCompactionStartEvent
 */
export function isAutoCompactionStartEvent(event: AgentEvent): event is AutoCompactionStartEvent {
	return event.type === 'auto_compaction_start';
}

/**
 * Type guard for AutoCompactionEndEvent
 */
export function isAutoCompactionEndEvent(event: AgentEvent): event is AutoCompactionEndEvent {
	return event.type === 'auto_compaction_end';
}

/**
 * Type guard for ErrorEvent
 */
export function isErrorEvent(event: AgentEvent): event is ErrorEvent {
	return event.type === 'error';
}
