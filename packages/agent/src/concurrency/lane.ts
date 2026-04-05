/**
 * Lane-based Concurrency System
 *
 * ## Purpose
 * Provides isolated execution lanes to prevent concurrent access to shared
 * resources. Each lane maintains its own queue and concurrency limit, ensuring
 * that operations within a lane are serialized or limited to a specific
 * concurrency level.
 *
 * ## Problem Solved
 * When multiple tool executions need to access the same resource (e.g., a file,
 * a database connection, an API endpoint), concurrent access can cause race
 * conditions, deadlocks, or resource exhaustion. Lanes provide isolation so
 * that operations on the same "lane key" (e.g., tool name, resource identifier)
 * are executed sequentially or with controlled concurrency.
 *
 * ## Architecture
 *
 * - Lane<T>: Interface for a single execution lane
 * - AsyncLane<T>: Concrete implementation with async task support
 * - LaneManager: Factory for creating and managing multiple lanes
 * - globalLaneManager: Singleton for application-wide lane management
 *
 * ## Usage Pattern
 *
 * The typical pattern is to use lanes per-tool-name, ensuring that executions
 * of the same tool are serialized and don't overwhelm shared resources:
 *
 *   const lane = laneManager.getLane('get_weather');
 *   const result = await lane.enqueue(async () => {
 *     // Tool execution logic
 *     return await fetchWeather(args);
 *   });
 *
 * ## Example
 *
 *   // Create a lane manager
 *   const manager = new LaneManager();
 *
 *   // Get a lane for a specific tool (default concurrency: 1)
 *   const lane = manager.getLane('file_writer');
 *
 *   // Enqueue tasks - they will be executed sequentially
 *   await lane.enqueue(async () => writeFile('a.txt', 'content'));
 *   await lane.enqueue(async () => writeFile('b.txt', 'content'));
 *
 *   // Lane with higher concurrency for independent operations
 *   const parallelLane = manager.getLane('api_calls', 5);
 *
 * @module concurrency/lane
 */

/**
 * Lane interface for queued task execution
 */
export interface Lane<T> {
	/**
	 * Enqueue a task for execution
	 * @param task - Async function to execute
	 * @returns Promise resolving to the task result
	 */
	enqueue(task: () => Promise<T>): Promise<T>;

	/**
	 * Get the number of pending tasks in the queue
	 */
	size(): number;

	/**
	 * Close the lane, clearing the queue and preventing new enqueues
	 */
	close(): void;
}

/**
 * Async lane implementation with configurable concurrency
 *
 * Tasks are executed in order, with at most `concurrency` tasks running
 * simultaneously. When concurrency is 1 (default), tasks are serialized.
 */
export class AsyncLane<T> implements Lane<T> {
	private queue: Array<() => Promise<void>> = [];
	private running = 0;
	private readonly concurrency: number;

	/**
	 * Create a new AsyncLane
	 * @param concurrency - Maximum simultaneous executions (default: 1)
	 */
	constructor(concurrency = 1) {
		this.concurrency = concurrency;
	}

	/**
	 * Enqueue a task for execution
	 *
	 * Returns a promise that resolves when the task completes.
	 * The task is wrapped to catch errors and propagate them properly.
	 */
	async enqueue(task: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.queue.push(async (): Promise<void> => {
				try {
					const result = await task();
					resolve(result);
				} catch (err) {
					// Reject the waiting promise, but don't throw
					// (the throw would create an unhandled rejection in the queue)
					reject(err);
				}
			});
			this.process();
		});
	}

	/**
	 * Process next task in queue if capacity available
	 */
	private async process(): Promise<void> {
		if (this.running >= this.concurrency) {
			return;
		}

		const next = this.queue.shift();
		if (!next) {
			return;
		}

		this.running++;
		// Fire and forget - errors are already handled via the promise in enqueue
		next().finally(() => {
			this.running--;
			this.process();
		});
	}

	/**
	 * Get pending task count
	 */
	size(): number {
		return this.queue.length;
	}

	/**
	 * Close the lane, clearing all pending tasks
	 */
	close(): void {
		this.queue = [];
	}
}

/**
 * Lane manager for creating and managing named lanes
 *
 * Provides a factory for creating lanes with specific names and concurrency
 * settings. Lanes are created lazily on first access and can be closed
 * individually or all at once.
 */
export class LaneManager {
	private lanes: Map<string, Lane<unknown>> = new Map();

	/**
	 * Get or create a lane by name
	 *
	 * @param name - Unique identifier for the lane
	 * @param concurrency - Max simultaneous executions (default: 1 for serialization)
	 * @returns The lane for this name
	 */
	getLane(name: string, concurrency = 1): Lane<unknown> {
		if (!this.lanes.has(name)) {
			this.lanes.set(name, new AsyncLane(concurrency));
		}
		return this.lanes.get(name)!;
	}

	/**
	 * Check if a lane exists
	 */
	hasLane(name: string): boolean {
		return this.lanes.has(name);
	}

	/**
	 * Close a specific lane by name
	 */
	closeLane(name: string): void {
		const lane = this.lanes.get(name);
		if (lane) {
			lane.close();
			this.lanes.delete(name);
		}
	}

	/**
	 * Close all lanes and clear the registry
	 */
	closeAll(): void {
		for (const lane of this.lanes.values()) {
			lane.close();
		}
		this.lanes.clear();
	}

	/**
	 * Get count of managed lanes
	 */
	size(): number {
		return this.lanes.size;
	}
}

/**
 * Global singleton lane manager for application-wide use
 *
 * Use this for tool execution isolation across the application.
 * Each tool name can have its own lane to prevent concurrent access
 * to shared resources.
 */
export const globalLaneManager = new LaneManager();
