/**
 * Events Module - Public API for agent event system
 *
 * ## Module Overview
 * This module re-exports all public types and functions from the events subsystem.
 * It provides a single import point for consumers of the event system.
 *
 * ## Package Structure
 * ```
 * event-bus.ts  - EventBus class, Channel implementation, factory functions
 * types.ts      - EventKind enum, TypedAgentEvent, legacy event types, type guards
 * index.ts      - Public re-exports
 * ```
 *
 * ## Export Categories
 *
 * ### Event Bus & Factory (from event-bus.ts)
 * - `EventBus` - Main event bus class with subscribe/emit
 * - `createEventBus(config?)` - Factory for isolated event buses
 * - `getGlobalEventBus()` - Singleton for shared event bus
 * - `EventBusConfig` - Configuration options interface
 * - `EventStream` - Stream type union
 * - `EventSubscriber` - Subscriber interface
 * - `AgentEvent` - Base event interface
 *
 * ### EventKind & Typed Events (from types.ts)
 * - `EventKind` - 19 typed event kind values
 * - `EventMeta` - Common metadata interface
 * - `TypedAgentEvent<T>` - Typed event with kind-specific payload
 * - 19 typed payload interfaces (TurnStartPayload, LLMRequestPayload, etc.)
 *
 * ### Legacy Events (from types.ts)
 * - `AgentStartEvent`, `AgentEndEvent`
 * - `MessageStartEvent`, `MessageUpdateEvent`, `MessageEndEvent`
 * - `ToolExecutionStartEvent`, `ToolExecutionUpdateEvent`, `ToolExecutionEndEvent`
 * - `AutoCompactionStartEvent`, `AutoCompactionEndEvent`
 * - `ErrorEvent`
 *
 * ### Type Guards
 * - `isEventKind(event, kind)` - Check if event matches EventKind
 * - `getEventKind(event)` - Extract EventKind from typed event
 * - Legacy type guards (isAgentStartEvent, isMessageEndEvent, etc.)
 *
 * ## Quick Reference
 * ```typescript
 * import {
 *   EventBus,
 *   EventKind,
 *   TypedAgentEvent,
 *   isEventKind
 * } from '@molos/agent/events';
 *
 * // Create event bus
 * const bus = new EventBus();
 *
 * // Subscribe to typed events
 * bus.subscribe('*', (event) => {
 *   const typed = event as TypedAgentEvent;
 *   if (isEventKind(event, EventKind.LLMResponse)) {
 *     // typed.data is LLMResponsePayload
 *   }
 * });
 * ```
 *
 * ## AI Context Optimization
 * - Import from this index to get all event types in one import
 * - Use EventKind enum values (not strings) for type safety
 * - Use type guard functions for runtime event type checking
 * - Prefer typed events over legacy events for new code
 */

// Re-export event bus and types from event-bus.ts
export {
	EventBus,
	createEventBus,
	getGlobalEventBus,
	type EventBusConfig,
	type EventStream,
	type EventSubscriber,
	type AgentEvent
} from './event-bus.js';

// EventKind - re-export from kind.ts to avoid circular dependencies
export { EventKind, type EventKindValue } from './kind.js';

// Event type definitions - new typed payloads
export {
	// EventMeta interface
	type EventMeta,
	// Typed payload interfaces
	type TurnStartPayload,
	type TurnEndPayload,
	type LLMRequestPayload,
	type LLMDeltaPayload,
	type LLMResponsePayload,
	type LLMRetryPayload,
	type ContextCompressPayload,
	type SessionSummarizePayload,
	type ToolExecStartPayload,
	type ToolExecEndPayload,
	type ToolExecSkippedPayload,
	type SteeringInjectedPayload,
	type FollowUpQueuedPayload,
	type InterruptReceivedPayload,
	type SubTurnSpawnPayload,
	type SubTurnEndPayload,
	type SubTurnResultDeliveredPayload,
	type SubTurnOrphanPayload,
	type ErrorPayload,
	// Typed event interface
	type TypedAgentEvent
} from './types.js';

// Event type definitions - legacy events
export type {
	// Lifecycle events
	AgentStartEvent,
	AgentEndEvent,
	// Message events
	MessageStartEvent,
	MessageUpdateEvent,
	MessageEndEvent,
	// Tool events
	ToolExecutionStartEvent,
	ToolExecutionUpdateEvent,
	ToolExecutionEndEvent,
	// Compaction events
	AutoCompactionStartEvent,
	AutoCompactionEndEvent,
	// Error events
	ErrorEvent
} from './types.js';

// Type guards for legacy events
export {
	isAgentStartEvent,
	isAgentEndEvent,
	isMessageStartEvent,
	isMessageEndEvent,
	isToolExecutionStartEvent,
	isToolExecutionEndEvent,
	isAutoCompactionStartEvent,
	isAutoCompactionEndEvent,
	isErrorEvent
} from './types.js';

// Type guard utilities for typed events
export { isEventKind, getEventKind } from './types.js';
