/**
 * Tests for Lifecycle Tracker
 *
 * Tests the lifecycle tracking system for subagents including:
 * - Event recording
 * - Orphan detection
 * - Lifecycle history
 * - Sweeper functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	LifecycleTracker,
	createLifecycleTracker,
	type AgentLifecycleEvent
} from '../../src/multi-agent/lifecycle.js';
import { createEventBus, type EventBus } from '../../src/events/event-bus.js';

describe('LifecycleTracker', () => {
	// Test state
	let tracker: LifecycleTracker;
	let eventBus: EventBus;

	beforeEach(() => {
		eventBus = createEventBus();
		tracker = createLifecycleTracker(eventBus);
	});

	afterEach(() => {
		eventBus.close();
		tracker.clear();
		vi.restoreAllMocks();
	});

	describe('record', () => {
		it('should record a lifecycle event', () => {
			const event: AgentLifecycleEvent = {
				type: 'spawned',
				sessionId: 'session-123',
				agentId: 'agent-456',
				timestamp: Date.now()
			};

			tracker.record(event);

			const history = tracker.getHistory('agent-456');
			expect(history).toHaveLength(1);
			expect(history[0].type).toBe('spawned');
			expect(history[0].sessionId).toBe('session-123');
		});

		it('should record multiple events for same agent', () => {
			tracker.recordSpawned('session-1', 'agent-1');
			tracker.recordRunning('session-1', 'agent-1');
			tracker.recordTerminated('session-1', 'agent-1');

			const history = tracker.getHistory('agent-1');
			expect(history).toHaveLength(3);
			expect(history[0].type).toBe('spawned');
			expect(history[1].type).toBe('running');
			expect(history[2].type).toBe('terminated');
		});

		it('should add to orphan set when orphaned event recorded', () => {
			tracker.record({ type: 'orphaned', sessionId: 's', agentId: 'a', timestamp: Date.now() });

			expect(tracker.isOrphan('a')).toBe(true);
		});

		it('should remove from orphan set when terminated event recorded', () => {
			tracker.record({ type: 'orphaned', sessionId: 's', agentId: 'a', timestamp: Date.now() });
			expect(tracker.isOrphan('a')).toBe(true);

			tracker.record({ type: 'terminated', sessionId: 's', agentId: 'a', timestamp: Date.now() });
			expect(tracker.isOrphan('a')).toBe(false);
		});
	});

	describe('convenience methods', () => {
		it('should recordSpawned correctly', () => {
			tracker.recordSpawned('session-1', 'agent-1', { task: 'test' });

			const lastEvent = tracker.getLastEvent('agent-1');
			expect(lastEvent?.type).toBe('spawned');
			expect(lastEvent?.sessionId).toBe('session-1');
			expect(lastEvent?.metadata?.task).toBe('test');
		});

		it('should recordRunning correctly', () => {
			tracker.recordRunning('session-1', 'agent-1');

			const lastEvent = tracker.getLastEvent('agent-1');
			expect(lastEvent?.type).toBe('running');
		});

		it('should recordIdle correctly', () => {
			tracker.recordIdle('session-1', 'agent-1');

			const lastEvent = tracker.getLastEvent('agent-1');
			expect(lastEvent?.type).toBe('idle');
		});

		it('should recordTerminated correctly', () => {
			tracker.recordTerminated('session-1', 'agent-1', { success: true });

			const lastEvent = tracker.getLastEvent('agent-1');
			expect(lastEvent?.type).toBe('terminated');
			expect(lastEvent?.metadata?.success).toBe(true);
		});
	});

	describe('getOrphans', () => {
		it('should detect orphaned agents after timeout', async () => {
			// Record a running event with old timestamp
			const oldTimestamp = Date.now() - 60000; // 60 seconds ago
			tracker.record({
				type: 'running',
				sessionId: 'session-1',
				agentId: 'agent-1',
				timestamp: oldTimestamp
			});

			// Record a recent running event for another agent
			tracker.recordRunning('session-2', 'agent-2');

			// With 30 second timeout, only agent-1 should be orphan
			const orphans = tracker.getOrphans(30000);
			expect(orphans).toContain('agent-1');
			expect(orphans).not.toContain('agent-2');
		});

		it('should not consider non-running agents as orphans', () => {
			tracker.recordSpawned('session-1', 'agent-1');

			const orphans = tracker.getOrphans(30000);
			expect(orphans).not.toContain('agent-1');
		});

		it('should return empty array when no orphans', () => {
			tracker.recordRunning('session-1', 'agent-1');

			const orphans = tracker.getOrphans(60000); // 1 minute timeout
			expect(orphans).toHaveLength(0);
		});
	});

	describe('getOrphanDetails', () => {
		it('should return detailed orphan information', () => {
			const oldTimestamp = Date.now() - 90000; // 90 seconds ago
			tracker.record({
				type: 'running',
				sessionId: 'session-1',
				agentId: 'agent-1',
				timestamp: oldTimestamp
			});

			const details = tracker.getOrphanDetails(30000);
			expect(details).toHaveLength(1);
			expect(details[0].agentId).toBe('agent-1');
			expect(details[0].sessionId).toBe('session-1');
			expect(details[0].timeSinceLastEvent).toBeGreaterThan(60000);
			expect(details[0].lastEventType).toBe('running');
		});
	});

	describe('getHistory', () => {
		it('should return empty array for unknown agent', () => {
			const history = tracker.getHistory('unknown');
			expect(history).toHaveLength(0);
		});

		it('should return all events in chronological order', () => {
			tracker.recordSpawned('session-1', 'agent-1');
			tracker.recordRunning('session-1', 'agent-1');
			tracker.recordTerminated('session-1', 'agent-1');

			const history = tracker.getHistory('agent-1');
			expect(history).toHaveLength(3);
			expect(history[0].type).toBe('spawned');
			expect(history[1].type).toBe('running');
			expect(history[2].type).toBe('terminated');
		});
	});

	describe('getState', () => {
		it('should return current state of agent', () => {
			tracker.recordSpawned('session-1', 'agent-1');
			expect(tracker.getState('agent-1')).toBe('spawned');

			tracker.recordRunning('session-1', 'agent-1');
			expect(tracker.getState('agent-1')).toBe('running');
		});

		it('should return undefined for unknown agent', () => {
			expect(tracker.getState('unknown')).toBeUndefined();
		});
	});

	describe('cleanup', () => {
		it('should mark orphans and return their IDs', () => {
			// Create an agent that will be considered orphaned
			const oldTimestamp = Date.now() - 60000;
			tracker.record({
				type: 'running',
				sessionId: 'session-1',
				agentId: 'agent-1',
				timestamp: oldTimestamp
			});

			const cleaned = tracker.cleanup(30000);

			expect(cleaned).toContain('agent-1');
			expect(tracker.isOrphan('agent-1')).toBe(true);
		});
	});

	describe('sweeper', () => {
		it('should start and stop sweeper', () => {
			vi.useFakeTimers();

			tracker.startSweeper(30000, 10000);

			// Advance timer
			vi.advanceTimersByTime(10000);

			tracker.stopSweeper();

			vi.useRealTimers();
		});
	});

	describe('clear', () => {
		it('should clear all tracked agents', () => {
			tracker.recordSpawned('session-1', 'agent-1');
			tracker.recordSpawned('session-2', 'agent-2');

			expect(tracker.trackedCount).toBe(2);

			tracker.clear();

			expect(tracker.trackedCount).toBe(0);
		});
	});

	describe('clearAgent', () => {
		it('should clear specific agent', () => {
			tracker.recordSpawned('session-1', 'agent-1');
			tracker.recordSpawned('session-2', 'agent-2');

			tracker.clearAgent('agent-1');

			expect(tracker.trackedCount).toBe(1);
			expect(tracker.getHistory('agent-1')).toHaveLength(0);
			expect(tracker.getHistory('agent-2')).toHaveLength(1);
		});
	});

	describe('stats', () => {
		it('should report correct tracked count', () => {
			expect(tracker.trackedCount).toBe(0);

			tracker.recordSpawned('session-1', 'agent-1');
			expect(tracker.trackedCount).toBe(1);

			tracker.recordSpawned('session-2', 'agent-2');
			expect(tracker.trackedCount).toBe(2);
		});

		it('should report correct orphan count', () => {
			expect(tracker.orphanCount).toBe(0);

			tracker.record({ type: 'orphaned', sessionId: 's', agentId: 'a', timestamp: Date.now() });
			expect(tracker.orphanCount).toBe(1);
		});

		it('should return all tracked agent IDs', () => {
			tracker.recordSpawned('session-1', 'agent-1');
			tracker.recordSpawned('session-2', 'agent-2');

			const agents = tracker.getTrackedAgents();
			expect(agents).toContain('agent-1');
			expect(agents).toContain('agent-2');
		});
	});
});

describe('LifecycleTracker without EventBus', () => {
	let tracker: LifecycleTracker;

	beforeEach(() => {
		tracker = createLifecycleTracker(); // No event bus
	});

	afterEach(() => {
		tracker.clear();
	});

	it('should work without event bus', () => {
		tracker.recordSpawned('session-1', 'agent-1');
		tracker.recordRunning('session-1', 'agent-1');

		const history = tracker.getHistory('agent-1');
		expect(history).toHaveLength(2);
	});

	it('should not throw when emitting without event bus', () => {
		expect(() => {
			tracker.recordSpawned('session-1', 'agent-1');
		}).not.toThrow();
	});
});
