/**
 * Event Bus - Pub/Sub Event System
 *
 * Provides a centralized event bus for agent communication.
 * Supports typed events, filtering, and async handlers.
 */

import type {
	AgentEventType,
	EventHandler,
	EventFilter,
	EventTypeName,
	EventTypeMap,
	BaseAgentEvent
} from './event-types';

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
	return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Subscription handle for unsubscribing
 */
export interface Subscription {
	/** Unique subscription ID */
	id: string;
	/** Unsubscribe from events */
	unsubscribe: () => void;
	/** Event types this subscription listens to */
	eventTypes?: Set<string>;
}

/**
 * Internal subscription data
 */
interface SubscriptionData {
	id: string;
	handler: EventHandler;
	filter?: EventFilter;
	once: boolean;
}

/**
 * Event bus configuration
 */
export interface EventBusConfig {
	/** Maximum number of handlers per event type */
	maxHandlersPerType?: number;
	/** Enable debug logging */
	debug?: boolean;
	/** Async handler timeout in ms */
	asyncTimeout?: number;
}

/**
 * Event bus statistics
 */
export interface EventBusStats {
	totalEventsEmitted: number;
	eventsByType: Map<string, number>;
	activeSubscriptions: number;
	handlerErrors: number;
}

/**
 * Event Bus - Centralized pub/sub system for agent events
 */
export class EventBus {
	private subscriptions: Map<string, SubscriptionData[]> = new Map();
	private wildcardSubscriptions: SubscriptionData[] = [];
	private config: Required<EventBusConfig>;
	private stats: EventBusStats;

	constructor(config: EventBusConfig = {}) {
		this.config = {
			maxHandlersPerType: config.maxHandlersPerType ?? 100,
			debug: config.debug ?? false,
			asyncTimeout: config.asyncTimeout ?? 30000
		};

		this.stats = {
			totalEventsEmitted: 0,
			eventsByType: new Map(),
			activeSubscriptions: 0,
			handlerErrors: 0
		};
	}

	/**
	 * Subscribe to a specific event type
	 */
	on<K extends EventTypeName>(
		eventType: K,
		handler: EventHandler<EventTypeMap[K]>
	): Subscription {
		return this.addSubscription(eventType, handler, false);
	}

	/**
	 * Subscribe to multiple event types
	 */
	onMultiple(
		eventTypes: EventTypeName[],
		handler: EventHandler
	): Subscription {
		const subscriptionIds: string[] = [];

		for (const eventType of eventTypes) {
			const sub = this.addSubscription(eventType, handler, false);
			subscriptionIds.push(sub.id);
		}

		return {
			id: subscriptionIds.join(','),
			unsubscribe: () => {
				// Already handled by individual subscriptions
			},
			eventTypes: new Set(eventTypes)
		};
	}

	/**
	 * Subscribe to all events (wildcard)
	 */
	onAll(handler: EventHandler): Subscription {
		const id = generateEventId();
		const data: SubscriptionData = {
			id,
			handler: handler as EventHandler,
			once: false
		};

		this.wildcardSubscriptions.push(data);
		this.stats.activeSubscriptions++;

		return {
			id,
			unsubscribe: () => {
				const index = this.wildcardSubscriptions.findIndex(s => s.id === id);
				if (index !== -1) {
					this.wildcardSubscriptions.splice(index, 1);
					this.stats.activeSubscriptions--;
				}
			}
		};
	}

	/**
	 * Subscribe to events matching a filter
	 */
	onFilter(filter: EventFilter, handler: EventHandler): Subscription {
		const id = generateEventId();
		const data: SubscriptionData = {
			id,
			handler,
			filter,
			once: false
		};

		// Add to wildcard with filter
		this.wildcardSubscriptions.push(data);
		this.stats.activeSubscriptions++;

		return {
			id,
			unsubscribe: () => {
				const index = this.wildcardSubscriptions.findIndex(s => s.id === id);
				if (index !== -1) {
					this.wildcardSubscriptions.splice(index, 1);
					this.stats.activeSubscriptions--;
				}
			}
		};
	}

	/**
	 * Subscribe to a single occurrence of an event
	 */
	once<K extends EventTypeName>(
		eventType: K,
		handler: EventHandler<EventTypeMap[K]>
	): Subscription {
		return this.addSubscription(eventType, handler, true);
	}

	/**
	 * Emit an event to all subscribers
	 */
	async emit<K extends EventTypeName>(event: EventTypeMap[K]): Promise<void> {
		this.stats.totalEventsEmitted++;

		// Track event by type
		const count = this.stats.eventsByType.get(event.type) ?? 0;
		this.stats.eventsByType.set(event.type, count + 1);

		if (this.config.debug) {
			console.log(`[EventBus] Emitting: ${event.type}`, event);
		}

		// Get handlers for this specific event type
		const typeHandlers = this.subscriptions.get(event.type) ?? [];

		// Combine with wildcard handlers
		const allHandlers = [...typeHandlers, ...this.wildcardSubscriptions];

		// Track handlers to remove (for once subscriptions)
		const toRemove: SubscriptionData[] = [];

		// Execute all handlers
		const promises: Promise<void>[] = [];

		for (const sub of allHandlers) {
			// Apply filter if present
			if (sub.filter && !sub.filter(event)) {
				continue;
			}

			// Track once subscriptions for removal
			if (sub.once) {
				toRemove.push(sub);
			}

			// Execute handler
			const promise = this.executeHandler(sub, event);
			promises.push(promise);
		}

		// Remove once subscriptions
		for (const sub of toRemove) {
			this.removeSubscription(event.type, sub.id);
		}

		// Wait for all handlers to complete
		await Promise.all(promises);
	}

	/**
	 * Emit an event synchronously (doesn't wait for handlers)
	 */
	emitSync<K extends EventTypeName>(event: EventTypeMap[K]): void {
		this.emit(event).catch(error => {
			console.error(`[EventBus] Error in emitSync for ${event.type}:`, error);
			this.stats.handlerErrors++;
		});
	}

	/**
	 * Create a typed event emitter for a specific run/session
	 */
	createEmitter(runId: string, sessionId: string): TypedEventEmitter {
		return new TypedEventEmitter(this, runId, sessionId);
	}

	/**
	 * Get event bus statistics
	 */
	getStats(): Readonly<EventBusStats> {
		return { ...this.stats };
	}

	/**
	 * Clear all subscriptions
	 */
	clear(): void {
		this.subscriptions.clear();
		this.wildcardSubscriptions = [];
		this.stats.activeSubscriptions = 0;
	}

	/**
	 * Remove all subscriptions for a specific event type
	 */
	clearEventType(eventType: string): void {
		const handlers = this.subscriptions.get(eventType);
		if (handlers) {
			this.stats.activeSubscriptions -= handlers.length;
			this.subscriptions.delete(eventType);
		}
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private addSubscription<K extends EventTypeName>(
		eventType: K,
		handler: EventHandler<EventTypeMap[K]>,
		once: boolean
	): Subscription {
		const id = generateEventId();

		// Get or create handler array
		let handlers = this.subscriptions.get(eventType);
		if (!handlers) {
			handlers = [];
			this.subscriptions.set(eventType, handlers);
		}

		// Check max handlers limit
		if (handlers.length >= this.config.maxHandlersPerType) {
			console.warn(
				`[EventBus] Max handlers (${this.config.maxHandlersPerType}) reached for event type: ${eventType}`
			);
		}

		const data: SubscriptionData = {
			id,
			handler: handler as EventHandler,
			once
		};

		handlers.push(data);
		this.stats.activeSubscriptions++;

		return {
			id,
			unsubscribe: () => this.removeSubscription(eventType, id),
			eventTypes: new Set([eventType])
		};
	}

	private removeSubscription(eventType: string, subscriptionId: string): void {
		const handlers = this.subscriptions.get(eventType);
		if (!handlers) return;

		const index = handlers.findIndex(h => h.id === subscriptionId);
		if (index !== -1) {
			handlers.splice(index, 1);
			this.stats.activeSubscriptions--;

			// Clean up empty arrays
			if (handlers.length === 0) {
				this.subscriptions.delete(eventType);
			}
		}
	}

	private async executeHandler(sub: SubscriptionData, event: AgentEventType): Promise<void> {
		try {
			const result = sub.handler(event);

			// Handle async handlers with timeout
			if (result instanceof Promise) {
				await Promise.race([
					result,
					new Promise<void>((_, reject) =>
						setTimeout(
							() => reject(new Error(`Handler timeout after ${this.config.asyncTimeout}ms`)),
							this.config.asyncTimeout
						)
					)
				]);
			}
		} catch (error) {
			this.stats.handlerErrors++;
			console.error(`[EventBus] Handler error for ${event.type}:`, error);
		}
	}
}

/**
 * Typed event emitter for creating events with run/session context
 */
export class TypedEventEmitter {
	constructor(
		private bus: EventBus,
		private runId: string,
		private sessionId: string
	) {}

	/**
	 * Create and emit an event
	 */
	async emit<T extends EventTypeName>(
		type: T,
		data: Omit<EventTypeMap[T]['data'], 'runId' | 'sessionId'>
	): Promise<void> {
		const event = {
			id: generateEventId(),
			type,
			timestamp: Date.now(),
			runId: this.runId,
			sessionId: this.sessionId,
			data
		} as EventTypeMap[T];

		await this.bus.emit(event);
	}

	/**
	 * Create and emit an event synchronously
	 */
	emitSync<T extends EventTypeName>(
		type: T,
		data: Omit<EventTypeMap[T]['data'], 'runId' | 'sessionId'>
	): void {
		const event = {
			id: generateEventId(),
			type,
			timestamp: Date.now(),
			runId: this.runId,
			sessionId: this.sessionId,
			data
		} as EventTypeMap[T];

		this.bus.emitSync(event);
	}
}

/**
 * Create a helper function to build events
 */
export function createEvent<T extends EventTypeName>(
	type: T,
	runId: string,
	sessionId: string,
	data: EventTypeMap[T]['data']
): EventTypeMap[T] {
	return {
		id: generateEventId(),
		type,
		timestamp: Date.now(),
		runId,
		sessionId,
		data
	} as EventTypeMap[T];
}

/**
 * Global event bus instance (optional, for convenience)
 */
let globalEventBus: EventBus | null = null;

/**
 * Get or create the global event bus
 */
export function getGlobalEventBus(config?: EventBusConfig): EventBus {
	if (!globalEventBus) {
		globalEventBus = new EventBus(config);
	}
	return globalEventBus;
}

/**
 * Reset the global event bus (for testing)
 */
export function resetGlobalEventBus(): void {
	if (globalEventBus) {
		globalEventBus.clear();
		globalEventBus = null;
	}
}
