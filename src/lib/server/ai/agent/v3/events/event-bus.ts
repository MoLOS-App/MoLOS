/**
 * EventBus - Simple pub/sub event system for agent events
 */

export interface AgentEvent {
	type: string;
	timestamp: number;
	data?: unknown;
}

export type EventCallback = (event: AgentEvent) => void | Promise<void>;

/**
 * Simple EventBus implementation
 */
export class EventBus {
	private subscribers: Map<string, Set<EventCallback>> = new Map();

	/**
	 * Subscribe to events of a specific type
	 */
	subscribe(eventType: string, callback: EventCallback): () => void {
		if (!this.subscribers.has(eventType)) {
			this.subscribers.set(eventType, new Set());
		}
		this.subscribers.get(eventType)!.add(callback);

		// Return unsubscribe function
		return () => {
			this.subscribers.get(eventType)?.delete(callback);
		};
	}

	/**
	 * Emit an event (async)
	 */
	async emit(event: AgentEvent): Promise<void> {
		const callbacks = this.subscribers.get(event.type);
		if (callbacks) {
			for (const callback of callbacks) {
				await callback(event);
			}
		}
	}

	/**
	 * Emit an event (sync - callbacks should not be async)
	 */
	emitSync(event: AgentEvent): void {
		const callbacks = this.subscribers.get(event.type);
		if (callbacks) {
			for (const callback of callbacks) {
				callback(event);
			}
		}
	}

	/**
	 * Clear all subscribers
	 */
	clear(): void {
		this.subscribers.clear();
	}
}

// Global event bus instance
let globalEventBus: EventBus | null = null;

/**
 * Get the global event bus instance
 */
export function getGlobalEventBus(): EventBus {
	if (!globalEventBus) {
		globalEventBus = new EventBus();
	}
	return globalEventBus;
}

/**
 * Create a new event bus instance
 */
export function createEventBus(): EventBus {
	return new EventBus();
}
