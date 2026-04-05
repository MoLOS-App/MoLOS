/**
 * Event Bus - Central event emission and subscription system
 *
 * ## Purpose
 * Provides a publish-subscribe mechanism for agent events, enabling loose
 * coupling between agent components. The event bus is the backbone of the
 * agent's reactive architecture.
 *
 * ## Event Architecture
 * - **Channel-based fan-out**: Each subscriber gets a buffered channel for async delivery
 * - **Non-blocking emit**: Events are fired without waiting for handlers
 * - **Per-kind dropped tracking**: Atomic counters monitor buffer overflow per EventKind
 * - **Stream filtering**: Subscribers can filter by EventStream category
 * - **Custom filters**: Optional predicate functions for fine-grained filtering
 *
 * ## Event Flow
 * ```
 * AgentLoop --emit()--> EventBus --dispatch to channels--> Subscribers
 *                                      |
 *                                      v
 *                            HookManager (observes all events)
 * ```
 *
 * ## Dropped Event Handling
 * When subscriber buffers are full, events are dropped (non-blocking).
 * Dropped counts are tracked per-stream and per-EventKind for monitoring:
 * - `getDroppedCounts()` - Returns stream-level drop counts
 * - `Dropped(kind)` - Returns drop count for specific EventKind
 * - `resetDroppedCounts()` - Clears all drop counters
 *
 * ## AI Context Optimization
 * - Typed events (19 EventKind values) help AI quickly identify event types
 * - Dropped event tracking enables monitoring context overflow conditions
 * - Event metadata (agent_id, turn_id, session_key, trace_path) enables tracing
 * - Stream categorization ('lifecycle', 'tool', 'assistant', 'compaction', 'error')
 *   allows selective observation without processing all events
 *
 * ## Usage Pattern
 * ```typescript
 * const bus = createEventBus();
 *
 * // Subscribe to all events
 * const unsub = bus.subscribe('*', (event) => {
 *   console.log('Event:', event.type);
 * });
 *
 * // Subscribe to specific stream with buffer
 * const unsubTool = bus.subscribe('tool', handleToolEvent, {
 *   bufferSize: 32,
 *   filter: (e) => e.data.toolName === 'my-tool'
 * });
 *
 * // Emit events
 * bus.emit({ type: 'test', runId: '123', seq: 1, stream: 'lifecycle', ts: Date.now(), data: {} });
 *
 * // Cleanup
 * unsub();
 * unsubTool();
 * ```
 *
 * ## Implementation Notes
 * - Uses a custom Channel implementation (not async iterator) for broader compat
 * - Channel buffers are bounded to prevent memory issues
 * - Subscriber dispatch runs in individual async tasks to prevent blocking
 * - Global singleton available via `getGlobalEventBus()`
 */

import { EVENT } from '../constants.js';

// =============================================================================
// Event Types
// =============================================================================

/**
 * Event streams for categorization
 */
export type EventStream =
	| 'lifecycle' // agent_start, agent_end
	| 'tool' // tool_execution_start, tool_execution_update, tool_execution_end
	| 'assistant' // message_start, message_update, message_end
	| 'error' // error events
	| 'compaction' // auto_compaction_start, auto_compaction_end
	| string; // arbitrary

/**
 * Base event interface for all agent events
 */
export interface AgentEvent {
	runId: string;
	seq: number;
	stream: EventStream;
	ts: number;
	data: Record<string, unknown>;
	sessionKey?: string;
	/** Event type discriminator */
	type: string;
}

/**
 * Configuration for event bus
 */
export interface EventBusConfig {
	maxSubscribers?: number;
	defaultBufferSize?: number;
}

/**
 * Event subscriber interface
 */
export interface EventSubscriber {
	id: number;
	ch: Chan<AgentEvent>;
	bufferSize: number;
	filter?: (event: AgentEvent) => boolean;
}

// =============================================================================
// Channel Implementation
// =============================================================================

/**
 * Simple channel implementation for event delivery
 * Works in both Node.js and browser environments
 */
type Chan<T> = {
	read(): T | undefined;
	write(v: T): boolean;
	close(): void;
	readonly closed: boolean;
};

/**
 * Creates a buffered channel for event delivery
 */
function createChannel<T>(bufferSize: number): Chan<T> {
	let buffer: T[] = [];
	let closed = false;
	const capacity = bufferSize;

	return {
		read() {
			if (closed && buffer.length === 0) {
				return undefined;
			}
			if (buffer.length === 0) {
				return undefined;
			}
			const item = buffer.shift();
			return item;
		},
		write(v: T): boolean {
			if (closed) {
				return false;
			}
			if (buffer.length >= capacity) {
				return false; // Channel full, would drop
			}
			buffer.push(v);
			return true;
		},
		close() {
			closed = true;
		},
		get closed() {
			return closed;
		}
	};
}

// =============================================================================
// Internal Subscriber
// =============================================================================

/**
 * Internal subscriber with channel
 */
interface InternalSubscriber {
	id: number;
	ch: Chan<AgentEvent>;
	bufferSize: number;
	filter?: (event: AgentEvent) => boolean;
	stream: EventStream | '*';
}

// =============================================================================
// Global Singleton
// =============================================================================

/**
 * Global event bus singleton key
 */
const GLOBAL_EVENT_BUS_KEY = Symbol.for('molos.agent.eventBus');

// =============================================================================
// Dropped Counts
// =============================================================================

/**
 * Global dropped event counts
 */
interface DroppedCounts {
	[stream: string]: number;
}

/**
 * Per-kind dropped event counts for typed events
 */
interface PerKindDroppedCounts {
	[kind: string]: number;
}

// =============================================================================
// Event Bus Implementation
// =============================================================================

/**
 * Enhanced Event Bus with channel-based fan-out
 */
export class EventBus {
	private subscribers: Map<number, InternalSubscriber> = new Map();
	private nextId = 1;
	private readonly maxSubscribers: number;
	private readonly defaultBufferSize: number;
	private droppedCounts: DroppedCounts = {};
	private perKindDroppedCounts: PerKindDroppedCounts = {};
	private closed = false;

	constructor(config?: EventBusConfig) {
		this.maxSubscribers = config?.maxSubscribers ?? EVENT.MAX_SUBSCRIBERS;
		this.defaultBufferSize = config?.defaultBufferSize ?? EVENT.DEFAULT_BUFFER_SIZE;
	}

	/**
	 * Subscribe to events on a specific stream or all streams ( '*' )
	 *
	 * @param stream - The stream to subscribe to, or '*' for all streams
	 * @param handler - Callback function for events
	 * @param options - Subscription options (bufferSize, filter)
	 * @returns Unsubscribe function
	 */
	subscribe(
		stream: EventStream | '*',
		handler: (event: AgentEvent) => void | Promise<void>,
		options?: { bufferSize?: number; filter?: (event: AgentEvent) => boolean }
	): () => void {
		if (this.closed) {
			return () => {};
		}

		if (this.subscribers.size >= this.maxSubscribers) {
			throw new Error(`Maximum subscribers (${this.maxSubscribers}) reached`);
		}

		const id = this.nextId++;
		const bufferSize = options?.bufferSize ?? this.defaultBufferSize;
		const ch = createChannel<AgentEvent>(bufferSize);

		const subscriber: InternalSubscriber = {
			id,
			ch,
			bufferSize,
			filter: options?.filter,
			stream
		};

		this.subscribers.set(id, subscriber);

		// Start dispatching to this subscriber
		this.startSubscriberDispatch(id, handler);

		return () => {
			this.unsubscribe(id);
		};
	}

	/**
	 * Start dispatching events to a subscriber
	 */
	private async startSubscriberDispatch(
		id: number,
		handler: (event: AgentEvent) => void | Promise<void>
	): Promise<void> {
		const subscriber = this.subscribers.get(id);
		if (!subscriber) {
			return;
		}

		while (!subscriber.ch.closed) {
			const event = subscriber.ch.read();
			if (event !== undefined) {
				try {
					await handler(event);
				} catch (error) {
					console.error(`Event handler error for subscriber ${id}:`, error);
				}
			} else {
				// Small delay to avoid busy waiting when channel is empty
				await new Promise((resolve) => setTimeout(resolve, 1));
			}
		}
	}

	/**
	 * Unsubscribe a specific subscriber
	 */
	private unsubscribe(id: number): void {
		const subscriber = this.subscribers.get(id);
		if (!subscriber) {
			return;
		}
		subscriber.ch.close();
		this.subscribers.delete(id);
	}

	/**
	 * Emit an event to all subscribers (non-blocking)
	 *
	 * Events are delivered non-blocking. If a subscriber's channel buffer
	 * is full, the event is dropped for that subscriber and the drop count
	 * is incremented.
	 */
	emit(event: AgentEvent): void {
		if (this.closed) {
			return;
		}

		if (event.ts === undefined) {
			event.ts = Date.now();
		}

		// Get event kind for per-kind tracking if present
		const eventKind = (event as { kind?: string }).kind;

		for (const subscriber of this.subscribers.values()) {
			// Check stream match
			if (subscriber.stream !== '*' && subscriber.stream !== event.stream) {
				continue;
			}

			// Apply filter if present
			if (subscriber.filter && !subscriber.filter(event)) {
				continue;
			}

			// Non-blocking write - drop if buffer full
			const wrote = subscriber.ch.write(event);
			if (!wrote) {
				this.droppedCounts[event.stream] = (this.droppedCounts[event.stream] ?? 0) + 1;
				// Track per-kind dropped counts if kind is available
				if (eventKind) {
					this.perKindDroppedCounts[eventKind] = (this.perKindDroppedCounts[eventKind] ?? 0) + 1;
				}
			}
		}
	}

	/**
	 * Emit and wait for all handlers to complete (blocking)
	 *
	 * This is useful when you need to ensure all handlers have processed
	 * an event before continuing.
	 */
	async emitSync(event: AgentEvent): Promise<void> {
		if (this.closed) {
			return;
		}

		if (event.ts === undefined) {
			event.ts = Date.now();
		}

		const handlers: Array<() => void | Promise<void>> = [];

		for (const subscriber of this.subscribers.values()) {
			// Check stream match
			if (subscriber.stream !== '*' && subscriber.stream !== event.stream) {
				continue;
			}

			// Apply filter if present
			if (subscriber.filter && !subscriber.filter(event)) {
				continue;
			}

			handlers.push(() => {
				// Synchronously process in emitSync mode
				return Promise.resolve();
			});
		}

		// Run all handlers in parallel but wait for completion
		await Promise.all(
			handlers.map(async (handler) => {
				try {
					await handler();
				} catch (error) {
					console.error('Event handler error:', error);
				}
			})
		);
	}

	/**
	 * Get dropped event counts for monitoring
	 */
	getDroppedCounts(): Record<string, number> {
		return { ...this.droppedCounts };
	}

	/**
	 * Get dropped count for a specific EventKind
	 * @param kind - The EventKind to get dropped count for
	 * @returns Number of events dropped for this kind
	 */
	Dropped(kind: string): number {
		return this.perKindDroppedCounts[kind] ?? 0;
	}

	/**
	 * Reset all dropped counts (both stream-based and per-kind)
	 */
	resetDroppedCounts(): void {
		this.droppedCounts = {};
		this.perKindDroppedCounts = {};
	}

	/**
	 * Clear all subscriptions
	 */
	clear(): void {
		for (const subscriber of this.subscribers.values()) {
			subscriber.ch.close();
		}
		this.subscribers.clear();
		this.droppedCounts = {};
	}

	/**
	 * Get active subscriber count
	 */
	getSubscriberCount(): number {
		return this.subscribers.size;
	}

	/**
	 * Close the event bus
	 */
	close(): void {
		this.closed = true;
		this.clear();
	}
}

// =============================================================================
// Singleton & Factory
// =============================================================================

/**
 * Get or create the global event bus singleton
 */
export function getGlobalEventBus(): EventBus {
	const globalScope = globalThis as typeof globalThis & {
		[GLOBAL_EVENT_BUS_KEY]?: EventBus;
	};

	if (!globalScope[GLOBAL_EVENT_BUS_KEY]) {
		globalScope[GLOBAL_EVENT_BUS_KEY] = new EventBus();
	}

	return globalScope[GLOBAL_EVENT_BUS_KEY];
}

/**
 * Create a new event bus instance
 */
export function createEventBus(config?: EventBusConfig): EventBus {
	return new EventBus(config);
}
