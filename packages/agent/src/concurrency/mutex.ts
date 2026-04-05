/**
 * Concurrency Utilities
 *
 * CPU-efficient async synchronization primitives using promise queues
 * instead of busy-waiting. These are designed for TypeScript's
 * single-threaded nature where locks are held for short durations.
 */

// =============================================================================
// AsyncMutex - Single-acquirer lock
// =============================================================================

/**
 * A CPU-efficient async mutex that uses promise queues instead of busy-waiting.
 *
 * Unlike spinlocks that repeatedly check a condition (wasting CPU cycles),
 * this implementation suspends the async task until the lock is available.
 *
 * @example
 * ```typescript
 * const mutex = new AsyncMutex();
 *
 * // Manual release pattern
 * await mutex.acquire();
 * try {
 *   // critical section
 * } finally {
 *   mutex.release();
 * }
 *
 * // Using Symbol.asyncDispose (TypeScript 5.2+)
 * await using _ = await mutex.acquire();
 * // critical section
 * ```
 */
export class AsyncMutex {
	private locked = false;
	private waiters: Array<(value: void) => void> = [];

	/**
	 * Acquire the mutex. Returns an AsyncDisposable that releases on dispose.
	 */
	async acquire(): Promise<AsyncDisposable> {
		if (!this.locked) {
			this.locked = true;
			return {
				[Symbol.asyncDispose]: async () => this.release()
			};
		}

		return new Promise<void>((resolve) => {
			this.waiters.push(resolve);
		}).then(() => {
			this.locked = true;
			return {
				[Symbol.asyncDispose]: async () => this.release()
			};
		});
	}

	/**
	 * Release the mutex, allowing the next waiter to acquire it.
	 */
	release(): void {
		const next = this.waiters.shift();
		if (next) {
			next();
		} else {
			this.locked = false;
		}
	}

	/**
	 * Check if the mutex is currently held.
	 */
	isLocked(): boolean {
		return this.locked;
	}

	/**
	 * Get the number of tasks waiting to acquire the mutex.
	 */
	getWaiterCount(): number {
		return this.waiters.length;
	}
}

// =============================================================================
// AsyncSemaphore - Concurrency limiter
// =============================================================================

/**
 * A semaphore that limits the number of concurrent operations.
 * Uses promise queues for efficient waiting instead of busy-waiting.
 *
 * @example
 * ```typescript
 * const semaphore = new AsyncSemaphore(3); // Allow 3 concurrent operations
 *
 * await using _ = await semaphore.acquire();
 * // Do work (up to 3 of these can run simultaneously)
 * ```
 */
export class AsyncSemaphore {
	private permits: number;
	private waiters: Array<(value: void) => void> = [];

	/**
	 * Create a semaphore with the specified number of permits.
	 * @param permits Number of concurrent acquisitions allowed
	 */
	constructor(permits: number) {
		if (permits < 0) {
			throw new Error('Semaphore permits cannot be negative');
		}
		this.permits = permits;
	}

	/**
	 * Acquire a permit. Returns an AsyncDisposable that releases on dispose.
	 */
	async acquire(): Promise<AsyncDisposable> {
		if (this.permits > 0) {
			this.permits--;
			return {
				[Symbol.asyncDispose]: async () => this.release()
			};
		}

		return new Promise<void>((resolve) => {
			this.waiters.push(resolve);
		}).then(() => {
			this.permits--;
			return {
				[Symbol.asyncDispose]: async () => this.release()
			};
		});
	}

	/**
	 * Release a permit, allowing the next waiter to acquire.
	 */
	release(): void {
		const next = this.waiters.shift();
		if (next) {
			next();
		} else {
			this.permits++;
		}
	}

	/**
	 * Get the number of available permits.
	 */
	getAvailablePermits(): number {
		return this.permits;
	}

	/**
	 * Get the number of tasks waiting to acquire.
	 */
	getWaiterCount(): number {
		return this.waiters.length;
	}
}

// =============================================================================
// RWMutex - Reader-Writer Mutex (for reference/comparison)
// =============================================================================

/**
 * A CPU-efficient reader-writer mutex using promise queues.
 *
 * - Multiple readers can hold the lock simultaneously (shared access)
 * - Writers get exclusive access (blocks all readers and other writers)
 * - Writers are served in FIFO order
 *
 * @example
 * ```typescript
 * const rwmutex = new RWMutex();
 *
 * // Multiple readers can proceed concurrently
 * await rwmutex.readLock();
 * try {
 *   // read operation
 * } finally {
 *   rwmutex.readUnlock();
 * }
 *
 * // Exclusive writer access
 * await rwmutex.writeLock();
 * try {
 *   // write operation
 * } finally {
 *   rwmutex.writeUnlock();
 * }
 * ```
 */
export class RWMutex {
	private readers = 0;
	private writers = 0;
	private writersWaiting = 0;
	private writeQueue: Array<(value: void) => void> = [];
	private readQueue: Array<(value: void) => void> = [];

	/**
	 * Acquire a read lock. Multiple readers can hold the lock simultaneously.
	 * Suspends the async task until all writers have released.
	 */
	async readLock(): Promise<void> {
		// Block if a writer is active or waiting (give writers priority)
		if (this.writers > 0 || this.writersWaiting > 0) {
			await new Promise<void>((resolve) => {
				this.readQueue.push(resolve);
			});
		}
		this.readers++;
	}

	/**
	 * Release a read lock.
	 */
	readUnlock(): void {
		this.readers--;
		// If last reader and writers are waiting, wake one
		if (this.readers === 0) {
			if (this.writersWaiting > 0) {
				this.writersWaiting--;
				const next = this.writeQueue.shift()!;
				next();
			}
		}
	}

	/**
	 * Acquire a write lock. Exclusive access - blocks all readers and other writers.
	 */
	async writeLock(): Promise<void> {
		// Need to wait if readers are active or writers are active
		if (this.readers > 0 || this.writers > 0) {
			this.writersWaiting++;
			await new Promise<void>((resolve) => {
				this.writeQueue.push(resolve);
			});
		}
		this.writers++;
	}

	/**
	 * Release a write lock.
	 */
	writeUnlock(): void {
		this.writers--;
		// If writers queue has entries, wake the next writer
		if (this.writeQueue.length > 0) {
			// Woken writer will increment writers when it runs
			const next = this.writeQueue.shift()!;
			next();
		} else {
			// No more writers waiting, wake all waiting readers
			this.writersWaiting = 0;
			while (this.readQueue.length > 0) {
				const next = this.readQueue.shift()!;
				next();
			}
		}
	}

	/**
	 * Get the number of active readers.
	 */
	getReaderCount(): number {
		return this.readers;
	}

	/**
	 * Check if a writer is waiting or active.
	 */
	isWriteLocked(): boolean {
		return this.writers > 0;
	}

	/**
	 * Get the number of waiting writers (in queue).
	 */
	getWriteWaiterCount(): number {
		return this.writeQueue.length;
	}

	/**
	 * Get the number of writers that have requested the lock but are waiting.
	 * This includes writers who incremented writersWaiting.
	 */
	getWritersWaitingCount(): number {
		return this.writersWaiting;
	}

	/**
	 * Get the number of waiting readers.
	 */
	getReadWaiterCount(): number {
		return this.readQueue.length;
	}
}
