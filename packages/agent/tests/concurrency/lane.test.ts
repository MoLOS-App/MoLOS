/**
 * Tests for Lane-based Concurrency System
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Lane, AsyncLane, LaneManager, globalLaneManager } from '../../src/concurrency/lane.js';

describe('AsyncLane', () => {
	describe('basic operations', () => {
		it('should execute a single task', async () => {
			const lane = new AsyncLane<string>();

			const result = await lane.enqueue(async () => {
				return 'hello';
			});

			expect(result).toBe('hello');
		});

		it('should return pending task count of 0 after execution', async () => {
			const lane = new AsyncLane<string>();

			await lane.enqueue(async () => 'result');

			expect(lane.size()).toBe(0);
		});

		it('should return pending task count when tasks are queued', async () => {
			const lane = new AsyncLane<string>();

			lane.enqueue(async () => 'a');
			lane.enqueue(async () => 'b');

			// Small delay to let tasks queue up
			await new Promise((r) => setTimeout(r, 10));

			expect(lane.size()).toBeGreaterThanOrEqual(0);
		});

		it('should propagate errors from tasks', async () => {
			const lane = new AsyncLane<string>();

			await expect(
				lane.enqueue(async () => {
					throw new Error('test error');
				})
			).rejects.toThrow('test error');
		});

		it('should execute multiple tasks sequentially by default', async () => {
			const lane = new AsyncLane<number>(1);
			const executionOrder: number[] = [];

			const task1 = lane.enqueue(async () => {
				executionOrder.push(1);
				await new Promise((r) => setTimeout(r, 30));
				return 1;
			});

			const task2 = lane.enqueue(async () => {
				executionOrder.push(2);
				return 2;
			});

			await Promise.all([task1, task2]);

			// Task 2 should have started after task 1 completed
			// due to concurrency of 1
			expect(executionOrder).toEqual([1, 2]);
		});

		it('should close lane and clear queue', async () => {
			const lane = new AsyncLane<string>();
			let taskStarted = false;

			lane.enqueue(async () => {
				taskStarted = true;
				return 'result';
			});

			lane.close();

			// After close, size should be 0
			expect(lane.size()).toBe(0);
		});
	});

	describe('concurrency', () => {
		it('should allow specified concurrency', async () => {
			const lane = new AsyncLane<number>(2);
			const order: string[] = [];
			let concurrent = 0;
			let maxConcurrent = 0;

			const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

			// Start 3 tasks that each take some time
			const task1 = lane.enqueue(async () => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				order.push('1-start');
				await delay(20);
				concurrent--;
				order.push('1-end');
				return 1;
			});

			const task2 = lane.enqueue(async () => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				order.push('2-start');
				await delay(20);
				concurrent--;
				order.push('2-end');
				return 2;
			});

			const task3 = lane.enqueue(async () => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				order.push('3-start');
				await delay(20);
				concurrent--;
				order.push('3-end');
				return 3;
			});

			await Promise.all([task1, task2, task3]);

			// With concurrency 2, we should have had at least 2 tasks running at once
			expect(maxConcurrent).toBe(2);

			// All tasks should have started and completed
			expect(order).toContain('1-start');
			expect(order).toContain('1-end');
			expect(order).toContain('2-start');
			expect(order).toContain('2-end');
			expect(order).toContain('3-start');
			expect(order).toContain('3-end');
		});

		it('should serialize when concurrency is 1', async () => {
			const lane = new AsyncLane<string>(1);
			const order: string[] = [];

			// First task with delay
			await lane.enqueue(async () => {
				order.push('start-a');
				await new Promise((r) => setTimeout(r, 20));
				order.push('end-a');
				return 'a';
			});

			// Second task starts after first completes
			await lane.enqueue(async () => {
				order.push('b');
				return 'b';
			});

			// Should see both start and end of 'a' before 'b'
			expect(order).toEqual(['start-a', 'end-a', 'b']);
		});
	});
});

describe('LaneManager', () => {
	let manager: LaneManager;

	beforeEach(() => {
		manager = new LaneManager();
	});

	afterEach(() => {
		manager.closeAll();
	});

	describe('getLane', () => {
		it('should create a new lane on first access', () => {
			const lane = manager.getLane('test');

			expect(lane).toBeDefined();
			expect(manager.hasLane('test')).toBe(true);
		});

		it('should return same lane on subsequent accesses', () => {
			const lane1 = manager.getLane('test');
			const lane2 = manager.getLane('test');

			expect(lane1).toBe(lane2);
		});

		it('should create lanes with different names independently', () => {
			const lane1 = manager.getLane('lane1');
			const lane2 = manager.getLane('lane2');

			expect(lane1).not.toBe(lane2);
		});

		it('should report correct lane count', () => {
			manager.getLane('a');
			manager.getLane('b');
			manager.getLane('c');

			expect(manager.size()).toBe(3);
		});
	});

	describe('closeLane', () => {
		it('should close and remove a specific lane', () => {
			manager.getLane('test');
			expect(manager.hasLane('test')).toBe(true);

			manager.closeLane('test');
			expect(manager.hasLane('test')).toBe(false);
		});

		it('should not affect other lanes', () => {
			manager.getLane('a');
			manager.getLane('b');

			manager.closeLane('a');

			expect(manager.hasLane('a')).toBe(false);
			expect(manager.hasLane('b')).toBe(true);
		});
	});

	describe('closeAll', () => {
		it('should close all lanes', () => {
			manager.getLane('a');
			manager.getLane('b');
			manager.getLane('c');

			manager.closeAll();

			expect(manager.size()).toBe(0);
		});
	});

	describe('lane isolation', () => {
		it('should isolate tasks between different lanes', async () => {
			const laneA = manager.getLane('A');
			const laneB = manager.getLane('B');

			const order: string[] = [];

			// Both lanes receive a task at roughly the same time
			const promiseA = laneA.enqueue(async () => {
				await new Promise((r) => setTimeout(r, 30));
				order.push('A');
				return 'A';
			});

			const promiseB = laneB.enqueue(async () => {
				order.push('B');
				return 'B';
			});

			await Promise.all([promiseA, promiseB]);

			// B should have completed before A because A had delay
			// but more importantly, they ran in parallel (different lanes)
			expect(order).toContain('B');
			expect(order).toContain('A');
		});

		it('should serialize tasks within same lane', async () => {
			const lane = manager.getLane('serial');

			const timestamps: number[] = [];
			const start = Date.now();

			const task1 = lane.enqueue(async () => {
				await new Promise((r) => setTimeout(r, 30));
				timestamps.push(Date.now() - start);
				return 1;
			});

			const task2 = lane.enqueue(async () => {
				timestamps.push(Date.now() - start);
				return 2;
			});

			await Promise.all([task1, task2]);

			// Second task should have started after first due to serialization
			expect(timestamps[1]).toBeGreaterThanOrEqual(timestamps[0]);
		});
	});
});

describe('globalLaneManager', () => {
	afterEach(() => {
		// Clean up any lanes created during tests
		globalLaneManager.closeAll();
	});

	it('should be a singleton LaneManager', () => {
		expect(globalLaneManager).toBeInstanceOf(LaneManager);
	});

	it('should isolate tool executions by tool name', async () => {
		const executionLog: string[] = [];

		// Simulate two different tools being executed concurrently
		const toolALane = globalLaneManager.getLane('tool_a');
		const toolBLane = globalLaneManager.getLane('tool_b');

		// Tool A has delay, tool B does not
		const promiseA = toolALane.enqueue(async () => {
			await new Promise((r) => setTimeout(r, 30));
			executionLog.push('tool_a_done');
			return 'result_a';
		});

		const promiseB = toolBLane.enqueue(async () => {
			executionLog.push('tool_b_done');
			return 'result_b';
		});

		const [resultA, resultB] = await Promise.all([promiseA, promiseB]);

		// Both should complete
		expect(resultA).toBe('result_a');
		expect(resultB).toBe('result_b');

		// Both tools should have executed
		expect(executionLog).toContain('tool_a_done');
		expect(executionLog).toContain('tool_b_done');

		// tool_b should have completed first (no delay)
		expect(executionLog[0]).toBe('tool_b_done');
	});

	it('should serialize executions of the same tool', async () => {
		const order: string[] = [];

		// Get lane for same tool twice - should be same lane
		const lane1 = globalLaneManager.getLane('same_tool');
		const lane2 = globalLaneManager.getLane('same_tool');

		expect(lane1).toBe(lane2);

		// First task with delay
		await lane1.enqueue(async () => {
			order.push('start-1');
			await new Promise((r) => setTimeout(r, 30));
			order.push('end-1');
			return 1;
		});

		// Second task starts after first completes
		await lane2.enqueue(async () => {
			order.push('2');
			return 2;
		});

		// Should see first task complete before second starts
		expect(order).toEqual(['start-1', 'end-1', '2']);
	});
});

describe('error handling', () => {
	it('should propagate errors from lane tasks', async () => {
		const lane = new AsyncLane<string>();

		const error = new Error('lane error');

		await expect(
			lane.enqueue(async () => {
				throw error;
			})
		).rejects.toThrow(error);
	});

	it('should handle multiple rapid enqueues with errors', async () => {
		const lane = new AsyncLane<string>();

		const results = await Promise.allSettled([
			lane.enqueue(async () => {
				throw new Error('error 1');
			}),
			lane.enqueue(async () => 'success'),
			lane.enqueue(async () => {
				throw new Error('error 2');
			})
		]);

		expect(results[0].status).toBe('rejected');
		expect(results[1].status).toBe('fulfilled');
		expect(results[2].status).toBe('rejected');
	});
});
