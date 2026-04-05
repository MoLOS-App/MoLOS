/**
 * EventKind - Core event type constants without circular dependencies
 *
 * ## Purpose
 * Defines all possible event kinds in the agent system as simple constants.
 * This module has NO imports from event-bus.ts or other event modules,
 * making it safe to import anywhere without creating circular dependencies.
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
 * @example
 * ```typescript
 * // Import EventKind without pulling in EventBus dependencies
 * import { EventKind } from './kind.js';
 *
 * // Use in type discrimination
 * if (event.kind === EventKind.LLMResponse) {
 *   // event.data is LLMResponsePayload
 * }
 * ```
 */

/**
 * All possible event kinds in the agent system
 *
 * These 19 EventKind values provide type-safe event discrimination.
 * Each kind has a corresponding TypedAgentEvent<T> with kind-specific payload.
 */
export const EventKind = {
	// =========================================================================
	// Turn Lifecycle (2)
	// =========================================================================
	/** Emitted when a new user turn begins - marks start of agent processing */
	TurnStart: 'turn_start',
	/** Emitted when a turn completes - includes final status and metrics */
	TurnEnd: 'turn_end',

	// =========================================================================
	// LLM Events (4)
	// =========================================================================
	/** Emitted before making LLM API call - useful for logging/inspection */
	LLMRequest: 'llm_request',
	/** Emitted for each streaming delta (token chunk) from LLM */
	LLMDelta: 'llm_delta',
	/** Emitted when LLM response is complete - includes tool call info */
	LLMResponse: 'llm_response',
	/** Emitted when LLM call fails and retries - includes retry metrics */
	LLMRetry: 'llm_retry',

	// =========================================================================
	// Context Management (2)
	// =========================================================================
	/** Emitted when context is compressed - messages are dropped to fit limits */
	ContextCompress: 'context_compress',
	/** Emitted when session is summarized - summary replaces message history */
	SessionSummarize: 'session_summarize',

	// =========================================================================
	// Tool Execution (3)
	// =========================================================================
	/** Emitted when tool execution begins */
	ToolExecStart: 'tool_exec_start',
	/** Emitted when tool execution completes - includes timing and output */
	ToolExecEnd: 'tool_exec_end',
	/** Emitted when tool execution is skipped - e.g., duplicate or invalid */
	ToolExecSkipped: 'tool_exec_skipped',

	// =========================================================================
	// Steering (1)
	// =========================================================================
	/** Emitted when steering content is injected into context */
	SteeringInjected: 'steering_injected',

	// =========================================================================
	// Follow-up & Interrupts (2)
	// =========================================================================
	/** Emitted when a follow-up message is queued for later processing */
	FollowUpQueued: 'follow_up_queued',
	/** Emitted when an external interrupt is received */
	InterruptReceived: 'interrupt_received',

	// =========================================================================
	// Sub-turn Events (4)
	// =========================================================================
	/** Emitted when a sub-turn (sub-agent) spawns - marks parallel processing */
	SubTurnSpawn: 'sub_turn_spawn',
	/** Emitted when a sub-turn ends */
	SubTurnEnd: 'sub_turn_end',
	/** Emitted when sub-turn result is delivered to parent channel */
	SubTurnResultDelivered: 'sub_turn_result_delivered',
	/** Emitted when a sub-turn becomes orphaned (parent completed first) */
	SubTurnOrphan: 'sub_turn_orphan',

	// =========================================================================
	// Error (1)
	// =========================================================================
	/** Emitted when an error occurs - includes stage and error message */
	Error: 'error'
} as const;

/**
 * Type representing EventKind values
 */
export type EventKindValue = (typeof EventKind)[keyof typeof EventKind];

/**
 * Type guard to check if a string is a valid EventKind value
 */
export function isEventKindValue(value: string): value is EventKindValue {
	return Object.values(EventKind).includes(value as EventKindValue);
}
