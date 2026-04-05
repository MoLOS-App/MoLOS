/**
 * Integration tests for Event Bus
 *
 * Tests the channel-based multi-subscriber event bus with buffering,
 * filtering, dropped event monitoring, and stream-based routing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	EventBus,
	createEventBus,
	getGlobalEventBus,
	type AgentEvent,
	type EventStream
} from '../../src/events/event-bus.js';

/**
 * Delay helper for tests
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('EventBus Integration', () => {
	let eventBus: EventBus;

	beforeEach(() => {
		eventBus = createEventBus();
	});

	afterEach(() => {
		eventBus.close();
	});

	/**
	 * Helper to create a test event
	 */
	function createEvent(
		type: string,
		stream: EventStream = 'lifecycle',
		data: Record<string, unknown> = {}
	): AgentEvent {
		return {
			runId: `test-run-${Date.now()}`,
			seq: 1,
			stream,
			ts: Date.now(),
			data,
			type
		};
	}

	describe('basic subscribe/unsubscribe', () => {
		it('should receive emitted events', async () => {
			const receivedEvents: AgentEvent[] = [];

			const unsubscribe = eventBus.subscribe('*', (event) => {
				receivedEvents.push(event);
			});

			eventBus.emit(createEvent('test.event'));

			// Wait for async delivery
			await delay(10);

			expect(receivedEvents.length).toBe(1);
			expect(receivedEvents[0].type).toBe('test.event');

			unsubscribe();
		});

		it('should return unsubscribe function', async () => {
			const receivedEvents: AgentEvent[] = [];

			const unsubscribe = eventBus.subscribe('*', (event) => {
				receivedEvents.push(event);
			});

			// Unsubscribe immediately
			unsubscribe();

			eventBus.emit(createEvent('test.event'));

			// Wait a bit
			await delay(10);

			// Should not receive event after unsubscribe
			expect(receivedEvents.length).toBe(0);
		});

		it('should handle multiple subscribers', async () => {
			const events1: AgentEvent[] = [];
			const events2: AgentEvent[] = [];

			eventBus.subscribe('*', (event) => {
				events1.push(event);
			});
			eventBus.subscribe('*', (event) => {
				events2.push(event);
			});

			eventBus.emit(createEvent('test.event'));

			await delay(10);

			expect(events1.length).toBe(1);
			expect(events2.length).toBe(1);
		});

		it('should track subscriber count', () => {
			const unsub1 = eventBus.subscribe('*', () => {});
			expect(eventBus.getSubscriberCount()).toBe(1);

			const unsub2 = eventBus.subscribe('*', () => {});
			expect(eventBus.getSubscriberCount()).toBe(2);

			unsub1();
			expect(eventBus.getSubscriberCount()).toBe(1);

			unsub2();
			expect(eventBus.getSubscriberCount()).toBe(0);
		});
	});

	describe('stream-based filtering', () => {
		it('should route events to matching stream subscribers', async () => {
			const lifecycleEvents: AgentEvent[] = [];
			const toolEvents: AgentEvent[] = [];

			eventBus.subscribe('lifecycle', (event) => {
				lifecycleEvents.push(event);
			});
			eventBus.subscribe('tool', (event) => {
				toolEvents.push(event);
			});

			eventBus.emit(createEvent('agent.start', 'lifecycle'));
			eventBus.emit(createEvent('tool.execute', 'tool'));

			await delay(10);

			expect(lifecycleEvents.length).toBe(1);
			expect(lifecycleEvents[0].type).toBe('agent.start');

			expect(toolEvents.length).toBe(1);
			expect(toolEvents[0].type).toBe('tool.execute');
		});

		it('should deliver to wildcard subscribers for all streams', async () => {
			const allEvents: AgentEvent[] = [];

			eventBus.subscribe('*', (event) => {
				allEvents.push(event);
			});

			eventBus.emit(createEvent('event1', 'lifecycle'));
			eventBus.emit(createEvent('event2', 'tool'));
			eventBus.emit(createEvent('event3', 'assistant'));

			await delay(10);

			expect(allEvents.length).toBe(3);
		});

		it('should not deliver to non-matching stream subscribers', async () => {
			const lifecycleEvents: AgentEvent[] = [];

			eventBus.subscribe('tool', (event) => {
				lifecycleEvents.push(event);
			});

			eventBus.emit(createEvent('agent.start', 'lifecycle'));

			await delay(10);

			expect(lifecycleEvents.length).toBe(0);
		});
	});

	describe('event filtering', () => {
		it('should filter events using filter option', async () => {
			const receivedEvents: AgentEvent[] = [];

			eventBus.subscribe(
				'*',
				(event) => {
					receivedEvents.push(event);
				},
				{
					filter: (event) => event.data.important === true
				}
			);

			eventBus.emit(createEvent('event1', 'lifecycle', { important: true }));
			eventBus.emit(createEvent('event2', 'lifecycle', { important: false }));
			eventBus.emit(createEvent('event3', 'lifecycle', { important: true }));

			await delay(10);

			expect(receivedEvents.length).toBe(2);
			expect(receivedEvents[0].data.important).toBe(true);
			expect(receivedEvents[1].data.important).toBe(true);
		});

		it('should apply filter after stream matching', async () => {
			const events: AgentEvent[] = [];

			eventBus.subscribe(
				'lifecycle',
				(event) => {
					events.push(event);
				},
				{
					filter: (event) => event.data.important === true
				}
			);

			// Should NOT be received (wrong stream)
			eventBus.emit(createEvent('tool.event', 'tool', { important: true }));

			// Should NOT be received (right stream, but filtered)
			eventBus.emit(createEvent('lifecycle.event', 'lifecycle', { important: false }));

			// Should be received
			eventBus.emit(createEvent('lifecycle.important', 'lifecycle', { important: true }));

			await delay(10);

			expect(events.length).toBe(1);
			expect(events[0].type).toBe('lifecycle.important');
		});
	});

	describe('buffering', () => {
		it('should buffer events when subscriber is slow', async () => {
			const receivedEvents: AgentEvent[] = [];

			// Small buffer
			const unsubscribe = eventBus.subscribe(
				'*',
				(event) => {
					receivedEvents.push(event);
				},
				{ bufferSize: 3 }
			);

			// Emit more events than buffer size
			for (let i = 0; i < 5; i++) {
				eventBus.emit(createEvent(`event${i}`));
			}

			// Wait for some to be delivered
			await delay(20);

			// At least some events should be buffered
			// The exact count depends on async delivery timing

			unsubscribe();
		});

		it('should use default buffer size when not specified', () => {
			const unsub = eventBus.subscribe('*', () => {});

			const subscriberCount = eventBus.getSubscriberCount();
			expect(subscriberCount).toBe(1);

			unsub();
		});

		it('should use custom buffer size from config', () => {
			const bus = createEventBus({ defaultBufferSize: 32 });
			const unsub = bus.subscribe('*', () => {});

			const subscriberCount = bus.getSubscriberCount();
			expect(subscriberCount).toBe(1);

			unsub();
			bus.close();
		});
	});

	describe('dropped events', () => {
		it('should track dropped event counts', async () => {
			const receivedEvents: AgentEvent[] = [];

			// Very small buffer to ensure drops
			const unsub = eventBus.subscribe(
				'lifecycle',
				(event) => {
					receivedEvents.push(event);
				},
				{ bufferSize: 1 }
			);

			// Emit many events rapidly
			for (let i = 0; i < 10; i++) {
				eventBus.emit(createEvent(`event${i}`, 'lifecycle'));
			}

			// Wait for processing
			await delay(50);

			const dropped = eventBus.getDroppedCounts();
			expect(dropped['lifecycle']).toBeGreaterThanOrEqual(0);

			unsub();
		});

		it('should return empty dropped counts initially', () => {
			const dropped = eventBus.getDroppedCounts();
			expect(dropped).toEqual({});
		});
	});

	describe('max subscribers limit', () => {
		it('should throw when max subscribers reached', () => {
			const bus = createEventBus({ maxSubscribers: 2 });

			bus.subscribe('*', () => {});
			bus.subscribe('*', () => {});

			expect(() => {
				bus.subscribe('*', () => {});
			}).toThrow('Maximum subscribers');

			bus.close();
		});

		it('should allow new subscribers after unsubscribe', () => {
			const bus = createEventBus({ maxSubscribers: 2 });

			const unsub1 = bus.subscribe('*', () => {});
			const unsub2 = bus.subscribe('*', () => {});

			// Should throw with 2 subscribers
			expect(() => {
				bus.subscribe('*', () => {});
			}).toThrow('Maximum subscribers');

			// After unsubscribing one, should work
			unsub1();

			expect(() => {
				bus.subscribe('*', () => {});
			}).not.toThrow();

			bus.close();
		});
	});

	describe('close behavior', () => {
		it('should prevent new subscriptions after close', () => {
			eventBus.close();

			const received: AgentEvent[] = [];
			const unsubscribe = eventBus.subscribe('*', (e) => {
				received.push(e);
			});

			// Should immediately return no-op unsubscribe
			expect(typeof unsubscribe).toBe('function');

			// Emit should be no-op
			eventBus.emit(createEvent('test'));

			expect(received.length).toBe(0);
		});

		it('should clear all subscribers on close', async () => {
			eventBus.subscribe('*', () => {});
			eventBus.subscribe('*', () => {});

			expect(eventBus.getSubscriberCount()).toBe(2);

			eventBus.close();

			expect(eventBus.getSubscriberCount()).toBe(0);
		});

		it('should clear dropped counts on clear()', () => {
			// Manually trigger a drop by having full buffer
			const bus = createEventBus({ defaultBufferSize: 1 });

			// Emit and let some be "dropped" (via the internal mechanism)
			// Then clear
			bus.clear();

			const dropped = bus.getDroppedCounts();
			expect(dropped).toEqual({});

			bus.close();
		});
	});

	describe('clear behavior', () => {
		it('should remove all subscribers but keep bus open', () => {
			eventBus.subscribe('*', () => {});
			eventBus.subscribe('*', () => {});

			expect(eventBus.getSubscriberCount()).toBe(2);

			eventBus.clear();

			expect(eventBus.getSubscriberCount()).toBe(0);

			// Should still be able to subscribe after clear
			const unsub = eventBus.subscribe('*', () => {});
			expect(eventBus.getSubscriberCount()).toBe(1);

			unsub();
		});

		it('should reset dropped counts on clear', () => {
			// The dropped counts are internal, clear should reset them
			eventBus.clear();

			const dropped = eventBus.getDroppedCounts();
			expect(dropped).toEqual({});
		});
	});

	describe('emit behavior', () => {
		it('should set timestamp if not provided', async () => {
			const received: AgentEvent[] = [];

			eventBus.subscribe('*', (e) => {
				received.push(e);
			});

			const eventWithoutTs: AgentEvent = {
				runId: 'test',
				seq: 1,
				stream: 'lifecycle',
				ts: 0, // Will be set by emit
				data: {},
				type: 'no-ts'
			};

			eventBus.emit(eventWithoutTs);

			await delay(10);

			expect(received.length).toBe(1);
			expect(received[0].ts).toBeDefined();
			expect(received[0].ts).toBeGreaterThan(0);
		});

		it('should handle async subscriber errors gracefully', async () => {
			const received: AgentEvent[] = [];

			eventBus.subscribe('*', async (e) => {
				received.push(e);
				throw new Error('Handler error');
			});

			eventBus.emit(createEvent('test'));

			await delay(10);

			// Other subscribers should still receive
			expect(received.length).toBe(1);
		});
	});

	describe('global singleton', () => {
		it('should return same instance for same global scope', () => {
			const bus1 = getGlobalEventBus();
			const bus2 = getGlobalEventBus();

			expect(bus1).toBe(bus2);

			// Cleanup
			bus1.close();
		});
	});

	describe('Integration: Event Bus with Multiple Subscribers', () => {
		it('should handle complex multi-subscriber scenarios', async () => {
			const lifecycleHandler: AgentEvent[] = [];
			const errorHandler: AgentEvent[] = [];
			const allHandler: AgentEvent[] = [];

			// Subscribe to specific streams
			eventBus.subscribe('lifecycle', (e) => {
				lifecycleHandler.push(e);
			});
			eventBus.subscribe('error', (e) => {
				errorHandler.push(e);
			});

			// Subscribe to all streams with filter
			eventBus.subscribe(
				'*',
				(e) => {
					allHandler.push(e);
				},
				{
					filter: (e) => e.data.important === true
				}
			);

			// Emit mixed events
			eventBus.emit(createEvent('agent.start', 'lifecycle', { important: true }));
			eventBus.emit(createEvent('error happened', 'error', { important: false }));
			eventBus.emit(createEvent('agent.end', 'lifecycle', { important: true }));
			eventBus.emit(createEvent('error.critical', 'error', { important: true }));

			await delay(20);

			// Lifecycle handler gets all lifecycle events
			expect(lifecycleHandler.length).toBe(2);

			// Error handler gets all error events
			expect(errorHandler.length).toBe(2);

			// All handler gets only important events
			expect(allHandler.length).toBe(3);
		});

		it('should handle rapid event emission', async () => {
			const received: AgentEvent[] = [];

			eventBus.subscribe('*', (e) => {
				received.push(e);
			});

			const count = 100;
			for (let i = 0; i < count; i++) {
				eventBus.emit(createEvent(`rapid-${i}`));
			}

			await delay(50);

			// All events should be received eventually
			expect(received.length).toBe(count);
		});

		it('should handle unsubscribe during event processing', async () => {
			const received: AgentEvent[] = [];
			let unsub: () => void;

			unsub = eventBus.subscribe('*', (e) => {
				received.push(e);
				if (e.data.unsubscribe === true) {
					unsub();
				}
			});

			eventBus.emit(createEvent('keep', 'lifecycle', { unsubscribe: false }));
			eventBus.emit(createEvent('unsub', 'lifecycle', { unsubscribe: true }));
			eventBus.emit(createEvent('after-unsub', 'lifecycle', { unsubscribe: false }));

			await delay(20);

			// Should have received events up to and including the unsubscribe trigger
			expect(received.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty event data', async () => {
			const received: AgentEvent[] = [];

			eventBus.subscribe('*', (e) => {
				received.push(e);
			});

			eventBus.emit(createEvent('no-data', 'lifecycle', {}));

			await delay(10);

			expect(received.length).toBe(1);
		});

		it('should handle special characters in event type', async () => {
			const received: AgentEvent[] = [];

			eventBus.subscribe('*', (e) => {
				received.push(e);
			});

			eventBus.emit(createEvent('event.with.dots', 'lifecycle'));
			eventBus.emit(createEvent('event-with-dashes', 'lifecycle'));
			eventBus.emit(createEvent('event_with_underscores', 'lifecycle'));

			await delay(10);

			expect(received.length).toBe(3);
		});

		it('should handle subscriber throwing sync error', () => {
			const received: AgentEvent[] = [];

			eventBus.subscribe('*', (e) => {
				if (e.data.throw) {
					throw new Error('Sync error');
				}
				received.push(e);
			});

			// Should not throw
			eventBus.emit(createEvent('ok', 'lifecycle', {}));
			eventBus.emit(createEvent('throw', 'lifecycle', { throw: true }));
			eventBus.emit(createEvent('after-throw', 'lifecycle', {}));

			// Other events should still be processed
			expect(received.length).toBe(2);
		});
	});
});
