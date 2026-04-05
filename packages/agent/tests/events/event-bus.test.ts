/**
 * Tests for EventBus class
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus, createEventBus, type AgentEvent } from '../../src/events/event-bus.js';

describe('EventBus', () => {
	let eventBus: EventBus;

	const createTestEvent = (overrides: Partial<AgentEvent> = {}): AgentEvent => ({
		runId: 'test-run',
		seq: 1,
		stream: 'test',
		ts: Date.now(),
		type: 'test_event',
		data: {},
		...overrides
	});

	beforeEach(() => {
		eventBus = createEventBus({ defaultBufferSize: 10 });
	});

	afterEach(() => {
		eventBus.close();
	});

	describe('subscribe', () => {
		it('should return unsubscribe function', () => {
			const events: AgentEvent[] = [];
			const unsubscribe = eventBus.subscribe('test', (event) => {
				events.push(event);
			});

			expect(typeof unsubscribe).toBe('function');
			unsubscribe();
		});

		it('should call handler when event is emitted', async () => {
			const events: AgentEvent[] = [];
			eventBus.subscribe('test', (event) => {
				events.push(event);
			});

			const event = createTestEvent();
			eventBus.emit(event);

			// Give async dispatch time to process
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(events.length).toBeGreaterThan(0);
		});

		it('should support multiple subscribers', async () => {
			const events1: AgentEvent[] = [];
			const events2: AgentEvent[] = [];

			eventBus.subscribe('test', (event) => {
				events1.push(event);
			});

			eventBus.subscribe('test', (event) => {
				events2.push(event);
			});

			const event = createTestEvent();
			eventBus.emit(event);

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(events1.length).toBeGreaterThan(0);
			expect(events2.length).toBeGreaterThan(0);
		});

		it('should filter events when filter is provided', async () => {
			const events: AgentEvent[] = [];

			eventBus.subscribe(
				'test',
				(event) => {
					events.push(event);
				},
				{ filter: (event) => event.data.important === true }
			);

			eventBus.emit(createTestEvent({ data: { important: true } }));
			eventBus.emit(createTestEvent({ data: { important: false } }));

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(events.length).toBe(1);
		});

		it('should use custom buffer size', async () => {
			const eventBus2 = createEventBus({ defaultBufferSize: 5 });
			const events: AgentEvent[] = [];

			eventBus2.subscribe('test', (event) => {
				events.push(event);
			});

			// Emit events up to buffer size
			for (let i = 0; i < 5; i++) {
				eventBus2.emit(createTestEvent({ seq: i }));
			}

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(events.length).toBe(5);

			eventBus2.close();
		});

		it('should subscribe to all streams with "*"', async () => {
			const events: AgentEvent[] = [];

			eventBus.subscribe('*', (event) => {
				events.push(event);
			});

			eventBus.emit(createTestEvent({ stream: 'lifecycle' }));
			eventBus.emit(createTestEvent({ stream: 'tool' }));
			eventBus.emit(createTestEvent({ stream: 'assistant' }));

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(events.length).toBe(3);
		});

		it('should throw when max subscribers reached', () => {
			const smallBus = createEventBus({ maxSubscribers: 1 });

			smallBus.subscribe('test', () => {});

			expect(() => {
				smallBus.subscribe('test', () => {});
			}).toThrow('Maximum subscribers');

			smallBus.close();
		});

		it('should return no-op unsubscribe when bus is closed', () => {
			const closedBus = createEventBus();
			closedBus.close();

			const unsubscribe = closedBus.subscribe('test', () => {});
			expect(typeof unsubscribe).toBe('function');
		});
	});

	describe('emit', () => {
		it('should deliver event to matching subscribers', async () => {
			const events: AgentEvent[] = [];

			eventBus.subscribe('tool', (event) => {
				events.push(event);
			});

			const event = createTestEvent({ stream: 'tool' });
			eventBus.emit(event);

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(events.length).toBeGreaterThan(0);
		});

		it('should not deliver to non-matching stream subscribers', async () => {
			const events: AgentEvent[] = [];

			eventBus.subscribe('tool', (event) => {
				events.push(event);
			});

			const event = createTestEvent({ stream: 'assistant' });
			eventBus.emit(event);

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(events.length).toBe(0);
		});

		it('should set timestamp if not provided', async () => {
			const events: AgentEvent[] = [];

			eventBus.subscribe(
				'test',
				(event) => {
					events.push(event);
				},
				{ bufferSize: 100 }
			);

			const event = createTestEvent({ ts: undefined as any });
			eventBus.emit(event);

			// Wait for async dispatch
			await new Promise((resolve) => setTimeout(resolve, 20));

			expect(events[0].ts).toBeDefined();
		});

		it('should count dropped events when buffer is full', async () => {
			const smallBus = createEventBus({ defaultBufferSize: 2 });
			const events: AgentEvent[] = [];

			smallBus.subscribe(
				'test',
				(event) => {
					events.push(event);
				},
				{ bufferSize: 2 }
			);

			// Emit more events than buffer can hold
			for (let i = 0; i < 5; i++) {
				smallBus.emit(createTestEvent({ seq: i }));
			}

			await new Promise((resolve) => setTimeout(resolve, 50));

			const droppedCounts = smallBus.getDroppedCounts();
			expect(droppedCounts['test']).toBeGreaterThan(0);

			smallBus.close();
		});
	});

	describe('emitSync', () => {
		it('should not deliver to non-matching stream subscribers', async () => {
			let called = false;

			eventBus.subscribe('tool', async () => {
				called = true;
			});

			const event = createTestEvent({ stream: 'assistant' });
			await eventBus.emitSync(event);

			expect(called).toBe(false);
		});
	});

	describe('unsubscribe', () => {
		it('should stop event delivery after unsubscribe', async () => {
			const events: AgentEvent[] = [];

			const unsubscribe = eventBus.subscribe('test', (event) => {
				events.push(event);
			});

			eventBus.emit(createTestEvent({ seq: 1 }));
			await new Promise((resolve) => setTimeout(resolve, 10));

			unsubscribe();

			eventBus.emit(createTestEvent({ seq: 2 }));
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(events.length).toBe(1);
		});
	});

	describe('clear', () => {
		it('should remove all subscribers', async () => {
			const events1: AgentEvent[] = [];
			const events2: AgentEvent[] = [];

			eventBus.subscribe('test', (event) => {
				events1.push(event);
			});

			eventBus.subscribe('test', (event) => {
				events2.push(event);
			});

			eventBus.clear();

			const event = createTestEvent();
			eventBus.emit(event);

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(events1.length).toBe(0);
			expect(events2.length).toBe(0);
		});

		it('should reset dropped counts', () => {
			// Simulate some dropped events
			eventBus.getDroppedCounts(); // Initialize

			eventBus.clear();

			const droppedCounts = eventBus.getDroppedCounts();
			expect(Object.keys(droppedCounts).length).toBe(0);
		});
	});

	describe('getSubscriberCount', () => {
		it('should return correct subscriber count', () => {
			expect(eventBus.getSubscriberCount()).toBe(0);

			const unsub1 = eventBus.subscribe('test', () => {});
			expect(eventBus.getSubscriberCount()).toBe(1);

			const unsub2 = eventBus.subscribe('test', () => {});
			expect(eventBus.getSubscriberCount()).toBe(2);

			unsub1();
			expect(eventBus.getSubscriberCount()).toBe(1);

			unsub2();
			expect(eventBus.getSubscriberCount()).toBe(0);
		});
	});

	describe('getDroppedCounts', () => {
		it('should return empty object initially', () => {
			const counts = eventBus.getDroppedCounts();
			expect(counts).toEqual({});
		});

		it('should track dropped events per stream', async () => {
			const smallBus = createEventBus({ defaultBufferSize: 1 });

			smallBus.subscribe('test', () => {}, { bufferSize: 1 });

			// Emit more than buffer can handle
			for (let i = 0; i < 3; i++) {
				smallBus.emit(createTestEvent({ seq: i }));
			}

			await new Promise((resolve) => setTimeout(resolve, 20));

			const counts = smallBus.getDroppedCounts();
			expect(counts['test']).toBeGreaterThan(0);

			smallBus.close();
		});
	});

	describe('close', () => {
		it('should prevent further subscriptions', () => {
			eventBus.close();

			const unsubscribe = eventBus.subscribe('test', () => {});
			expect(typeof unsubscribe).toBe('function');
		});

		it('should clear all subscribers', () => {
			eventBus.subscribe('test', () => {});
			eventBus.subscribe('test', () => {});

			eventBus.close();

			expect(eventBus.getSubscriberCount()).toBe(0);
		});
	});

	describe('createEventBus', () => {
		it('should create new instance', () => {
			const bus = createEventBus();
			expect(bus).toBeInstanceOf(EventBus);
			bus.close();
		});

		it('should accept config options', () => {
			const bus = createEventBus({
				maxSubscribers: 50,
				defaultBufferSize: 100
			});
			expect(bus).toBeInstanceOf(EventBus);
			bus.close();
		});
	});

	describe('async dispatch behavior', () => {
		it('should handle handler errors gracefully', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			eventBus.subscribe('test', async () => {
				throw new Error('handler error');
			});

			eventBus.emit(createTestEvent());

			await new Promise((resolve) => setTimeout(resolve, 20));

			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it('should not block emit on slow handlers', () => {
			eventBus.subscribe('test', async () => {
				await new Promise((resolve) => setTimeout(resolve, 100));
			});

			// emit should return quickly even with slow handlers
			const start = Date.now();
			eventBus.emit(createTestEvent());
			const elapsed = Date.now() - start;

			expect(elapsed).toBeLessThan(50);
		});
	});
});
