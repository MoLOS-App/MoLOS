/**
 * Lifecycle Tracker - Agent Lifecycle Events & Orphan Detection
 *
 * ## Purpose
 * Tracks lifecycle events for subagents including spawned, running, idle,
 * terminated, and orphaned states. Provides orphan detection for crash recovery.
 *
 * ## Lifecycle States
 *
 * ```
 * ┌─────────┐    spawn    ┌─────────┐    start    ┌─────────┐
 * │         │ ──────────► │         │ ──────────► │         │
 * │         │             │         │             │         │
 * └─────────┘             └─────────┘             └─────────┘
 *                                                     │
 *                    ┌─────────┐    ┌─────────┐       │ end
 *                    │         │◄────│         │◄──────┘
 *                    │ orphaned│     │terminated│
 *                    └─────────┘     └─────────┘
 * ```
 *
 * ## Event Types
 *
 * | Event Type   | Description                                      |
 * |--------------|--------------------------------------------------|
 * | `spawned`    | Subagent has been created                         |
 * | `running`    | Subagent has started processing                   |
 * | `idle`      | Subagent is waiting for work                      |
 * | `terminated` | Subagent completed normally                       |
 * | `orphaned`   | Subagent detected as stuck/crashed                |
 *
 * ## Orphan Detection
 *
 * An agent is considered orphaned if:
 * - It has a `running` event
 * - No subsequent event has occurred within `timeoutMs`
 *
 * ## Usage
 *
 * ```typescript
 * const tracker = new LifecycleTracker();
 *
 * tracker.record({
 *   type: 'spawned',
 *   sessionId: 'session-123',
 *   agentId: 'agent-456',
 *   timestamp: Date.now()
 * });
 *
 * // Later, detect orphans
 * const orphans = tracker.getOrphans(60000); // 60 second timeout
 * for (const orphanId of orphans) {
 *   console.log(`Orphan detected: ${orphanId}`);
 *   tracker.record({ type: 'orphaned', ... });
 * }
 * ```
 *
 * @example
 * // Sweep for orphans every minute
 * setInterval(() => {
 *   const orphans = lifecycleTracker.cleanup(60000);
 *   for (const orphan of orphans) {
 *     cleanupOrphan(orphan);
 *   }
 * }, 60000);
 */

import type { EventBus } from '../events/event-bus.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Lifecycle event types
 */
export type LifecycleEventType = 'spawned' | 'running' | 'idle' | 'terminated' | 'orphaned';

/**
 * A lifecycle event for an agent
 */
export interface AgentLifecycleEvent {
	/** Event type */
	type: LifecycleEventType;
	/** Session ID for the agent */
	sessionId: string;
	/** Agent ID */
	agentId: string;
	/** Event timestamp */
	timestamp: number;
	/** Optional additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Result of orphan detection
 */
export interface OrphanDetectionResult {
	/** Agent ID */
	agentId: string;
	/** Session ID */
	sessionId: string;
	/** Time since last event in ms */
	timeSinceLastEvent: number;
	/** Last event type before orphan detection */
	lastEventType: LifecycleEventType;
}

// =============================================================================
// Lifecycle Tracker
// =============================================================================

/**
 * Tracks agent lifecycle events and detects orphans
 */
export class LifecycleTracker {
	private events: Map<string, AgentLifecycleEvent[]> = new Map();
	private orphans: Set<string> = new Set();
	private eventBus?: EventBus;
	private sweeperInterval?: ReturnType<typeof setInterval>;

	constructor(eventBus?: EventBus) {
		this.eventBus = eventBus;
	}

	/**
	 * Record a lifecycle event
	 */
	record(event: AgentLifecycleEvent): void {
		const events = this.events.get(event.agentId) || [];
		events.push(event);
		this.events.set(event.agentId, events);

		// Update orphan set based on event type
		if (event.type === 'orphaned') {
			this.orphans.add(event.agentId);
		} else if (event.type === 'terminated') {
			this.orphans.delete(event.agentId);
		}

		// Emit event if we have an event bus
		if (this.eventBus) {
			this.eventBus.emit({
				runId: 'lifecycle-tracker',
				seq: 0,
				stream: 'lifecycle',
				ts: Date.now(),
				type: `lifecycle.${event.type}`,
				data: event as unknown as Record<string, unknown>
			});
		}
	}

	/**
	 * Record a spawned event (convenience method)
	 */
	recordSpawned(sessionId: string, agentId: string, metadata?: Record<string, unknown>): void {
		this.record({
			type: 'spawned',
			sessionId,
			agentId,
			timestamp: Date.now(),
			metadata
		});
	}

	/**
	 * Record a running event (convenience method)
	 */
	recordRunning(sessionId: string, agentId: string, metadata?: Record<string, unknown>): void {
		this.record({
			type: 'running',
			sessionId,
			agentId,
			timestamp: Date.now(),
			metadata
		});
	}

	/**
	 * Record an idle event (convenience method)
	 */
	recordIdle(sessionId: string, agentId: string, metadata?: Record<string, unknown>): void {
		this.record({
			type: 'idle',
			sessionId,
			agentId,
			timestamp: Date.now(),
			metadata
		});
	}

	/**
	 * Record a terminated event (convenience method)
	 */
	recordTerminated(sessionId: string, agentId: string, metadata?: Record<string, unknown>): void {
		this.record({
			type: 'terminated',
			sessionId,
			agentId,
			timestamp: Date.now(),
			metadata
		});
	}

	/**
	 * Get agents that are considered orphans
	 *
	 * An agent is an orphan if:
	 * - It has events
	 * - The last event type is 'running'
	 * - The time since the last event exceeds timeoutMs
	 */
	getOrphans(timeoutMs: number): string[] {
		const now = Date.now();
		const result: string[] = [];

		for (const [agentId, events] of this.events) {
			if (events.length === 0) continue;

			const lastEvent = events[events.length - 1];
			if (lastEvent && lastEvent.type === 'running') {
				if (now - lastEvent.timestamp > timeoutMs) {
					result.push(agentId);
				}
			}
		}

		return result;
	}

	/**
	 * Get detailed orphan detection results
	 */
	getOrphanDetails(timeoutMs: number): OrphanDetectionResult[] {
		const now = Date.now();
		const results: OrphanDetectionResult[] = [];

		for (const [agentId, events] of this.events) {
			if (events.length === 0) continue;

			const lastEvent = events[events.length - 1];
			if (lastEvent && lastEvent.type === 'running') {
				const timeSinceLastEvent = now - lastEvent.timestamp;
				if (timeSinceLastEvent > timeoutMs) {
					results.push({
						agentId,
						sessionId: lastEvent.sessionId,
						timeSinceLastEvent,
						lastEventType: lastEvent.type
					});
				}
			}
		}

		return results;
	}

	/**
	 * Get the lifecycle history for an agent
	 */
	getHistory(agentId: string): AgentLifecycleEvent[] {
		return this.events.get(agentId) || [];
	}

	/**
	 * Get the last event for an agent
	 */
	getLastEvent(agentId: string): AgentLifecycleEvent | undefined {
		const events = this.events.get(agentId);
		if (!events || events.length === 0) return undefined;
		return events[events.length - 1];
	}

	/**
	 * Get the current state of an agent
	 */
	getState(agentId: string): LifecycleEventType | undefined {
		const lastEvent = this.getLastEvent(agentId);
		return lastEvent?.type;
	}

	/**
	 * Check if an agent is an orphan
	 */
	isOrphan(agentId: string): boolean {
		return this.orphans.has(agentId);
	}

	/**
	 * Cleanup and mark orphans
	 *
	 * Returns agent IDs that were marked as orphans
	 */
	cleanup(timeoutMs: number): string[] {
		const orphans = this.getOrphans(timeoutMs);
		for (const agentId of orphans) {
			// Get session ID from existing events
			const events = this.events.get(agentId);
			const sessionId = events?.[0]?.sessionId || agentId;

			this.record({
				type: 'orphaned',
				sessionId,
				agentId,
				timestamp: Date.now(),
				metadata: { cleanup: true, timeoutMs }
			});
		}
		return orphans;
	}

	/**
	 * Start automatic orphan sweeping
	 */
	startSweeper(timeoutMs: number, intervalMs: number): void {
		this.stopSweeper();
		this.sweeperInterval = setInterval(() => {
			this.cleanup(timeoutMs);
		}, intervalMs);
	}

	/**
	 * Stop automatic orphan sweeping
	 */
	stopSweeper(): void {
		if (this.sweeperInterval) {
			clearInterval(this.sweeperInterval);
			this.sweeperInterval = undefined;
		}
	}

	/**
	 * Clear all tracked events
	 */
	clear(): void {
		this.events.clear();
		this.orphans.clear();
		this.stopSweeper();
	}

	/**
	 * Clear events for a specific agent
	 */
	clearAgent(agentId: string): void {
		this.events.delete(agentId);
		this.orphans.delete(agentId);
	}

	/**
	 * Get count of tracked agents
	 */
	get trackedCount(): number {
		return this.events.size;
	}

	/**
	 * Get count of current orphans
	 */
	get orphanCount(): number {
		return this.orphans.size;
	}

	/**
	 * Get all tracked agent IDs
	 */
	getTrackedAgents(): string[] {
		return Array.from(this.events.keys());
	}
}

// =============================================================================
// Persistent Lifecycle Tracker
// =============================================================================

/**
 * Interface for persistent lifecycle tracking
 * Implement this for disk persistence and crash recovery
 */
export interface PersistentLifecycleTracker extends LifecycleTracker {
	/**
	 * Persist current state to disk
	 */
	persist(): Promise<void>;

	/**
	 * Restore state from disk
	 */
	restore(): Promise<void>;

	/**
	 * Mark state as dirty (needs persistence)
	 */
	markDirty(): void;

	/**
	 * Check if state needs persistence
	 */
	isDirty(): boolean;

	/**
	 * Get persistence file path
	 */
	getFilePath(): string;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new lifecycle tracker
 */
export function createLifecycleTracker(eventBus?: EventBus): LifecycleTracker {
	return new LifecycleTracker(eventBus);
}
