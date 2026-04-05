import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AsyncMutex, AsyncSemaphore, RWMutex } from '../../src/concurrency/mutex.js';

describe('AsyncMutex', () => {
	let mutex: AsyncMutex;

	beforeEach(() => {
		mutex = new AsyncMutex();
	});

	it('should allow immediate acquisition when not locked', async () => {
		expect(mutex.isLocked()).toBe(false);
		const disposable = await mutex.acquire();
		expect(mutex.isLocked()).toBe(true);
		await disposable[Symbol.asyncDispose]();
		expect(mutex.isLocked()).toBe(false);
	});

	it('should block subsequent acquirers when locked', async () => {
		const first = await mutex.acquire();
		expect(mutex.isLocked()).toBe(true);
		expect(mutex.getWaiterCount()).toBe(0);

		let secondAcquired = false;
		const secondPromise = mutex.acquire().then(() => {
			secondAcquired = true;
		});

		// Give the promise a chance to execute
		await new Promise((r) => setTimeout(r, 10));
		expect(mutex.getWaiterCount()).toBe(1);
		expect(secondAcquired).toBe(false);

		await first[Symbol.asyncDispose]();

		// Give the second waiter a chance to acquire
		await new Promise((r) => setTimeout(r, 10));
		expect(secondAcquired).toBe(true);
		expect(mutex.isLocked()).toBe(true);
	});

	it('should maintain FIFO order for waiters', async () => {
		const acquisitionOrder: number[] = [];

		const acquireAndRecord = async (id: number) => {
			await mutex.acquire();
			acquisitionOrder.push(id);
			await new Promise((r) => setTimeout(r, 20));
			mutex.release();
		};

		// Start first acquisition
		const p1 = acquireAndRecord(1);

		// Queue up more acquisitions
		await new Promise((r) => setTimeout(r, 5));
		const p2 = acquireAndRecord(2);

		await new Promise((r) => setTimeout(r, 5));
		const p3 = acquireAndRecord(3);

		await p1;
		await p2;
		await p3;

		// All should have acquired in order
		expect(acquisitionOrder).toEqual([1, 2, 3]);
	});

	it('should correctly report waiter count', async () => {
		expect(mutex.getWaiterCount()).toBe(0);

		const first = await mutex.acquire();

		// Queue up multiple waiters
		const p2 = mutex.acquire();
		const p3 = mutex.acquire();

		await new Promise((r) => setTimeout(r, 10));
		expect(mutex.getWaiterCount()).toBe(2);

		await first[Symbol.asyncDispose]();
		await p2;
		expect(mutex.getWaiterCount()).toBe(1);

		mutex.release();
		await p3;
		expect(mutex.getWaiterCount()).toBe(0);
	});

	it('should work with manual release pattern', async () => {
		await mutex.acquire();
		expect(mutex.isLocked()).toBe(true);

		mutex.release();
		expect(mutex.isLocked()).toBe(false);
	});

	it('should support nested release with multiple acquisitions', async () => {
		const outer = await mutex.acquire();
		expect(mutex.isLocked()).toBe(true);

		// Try to acquire again while still holding
		let innerAcquired = false;
		const innerPromise = mutex.acquire().then(() => {
			innerAcquired = true;
		});

		await new Promise((r) => setTimeout(r, 10));
		expect(innerAcquired).toBe(false); // Can't acquire while locked

		await outer[Symbol.asyncDispose]();
		await innerPromise;
		expect(innerAcquired).toBe(true);
	});
});

describe('AsyncSemaphore', () => {
	let semaphore: AsyncSemaphore;

	beforeEach(() => {
		semaphore = new AsyncSemaphore(2);
	});

	it('should allow immediate acquisition up to permit limit', async () => {
		expect(semaphore.getAvailablePermits()).toBe(2);

		const s1 = await semaphore.acquire();
		expect(semaphore.getAvailablePermits()).toBe(1);

		const s2 = await semaphore.acquire();
		expect(semaphore.getAvailablePermits()).toBe(0);

		await s1[Symbol.asyncDispose]();
		expect(semaphore.getAvailablePermits()).toBe(1);

		await s2[Symbol.asyncDispose]();
		expect(semaphore.getAvailablePermits()).toBe(2);
	});

	it('should block acquirers when all permits are held', async () => {
		const s1 = await semaphore.acquire();
		const s2 = await semaphore.acquire();

		expect(semaphore.getAvailablePermits()).toBe(0);
		expect(semaphore.getWaiterCount()).toBe(0);

		let thirdAcquired = false;
		const thirdPromise = semaphore.acquire().then(() => {
			thirdAcquired = true;
		});

		await new Promise((r) => setTimeout(r, 10));
		expect(semaphore.getWaiterCount()).toBe(1);
		expect(thirdAcquired).toBe(false);

		await s1[Symbol.asyncDispose]();
		await thirdPromise;
		expect(thirdAcquired).toBe(true);
	});

	it('should maintain FIFO order for waiters', async () => {
		const acquisitionOrder: number[] = [];

		const acquireAndRelease = async (id: number) => {
			await semaphore.acquire();
			acquisitionOrder.push(id);
			await new Promise((r) => setTimeout(r, 20));
			semaphore.release();
		};

		// Start first two acquisitions
		const p1 = acquireAndRelease(1);
		const p2 = acquireAndRelease(2);

		await new Promise((r) => setTimeout(r, 5));
		const p3 = acquireAndRelease(3);

		await p1;
		await p2;
		await p3;

		expect(acquisitionOrder).toEqual([1, 2, 3]);
	});

	it('should throw error for negative permits', () => {
		expect(() => new AsyncSemaphore(-1)).toThrow('Semaphore permits cannot be negative');
	});

	it('should allow zero permits', () => {
		const zeroSemaphore = new AsyncSemaphore(0);
		expect(zeroSemaphore.getAvailablePermits()).toBe(0);

		let acquired = false;
		const promise = zeroSemaphore.acquire().then(() => {
			acquired = true;
		});

		expect(acquired).toBe(false);
		zeroSemaphore.release();
	});

	it('should correctly report available permits', () => {
		expect(semaphore.getAvailablePermits()).toBe(2);

		semaphore.acquire();
		expect(semaphore.getAvailablePermits()).toBe(1);

		semaphore.acquire();
		expect(semaphore.getAvailablePermits()).toBe(0);

		semaphore.release();
		expect(semaphore.getAvailablePermits()).toBe(1);
	});
});

describe('RWMutex', () => {
	let rwmutex: RWMutex;

	beforeEach(() => {
		rwmutex = new RWMutex();
	});

	it('should allow multiple readers simultaneously', async () => {
		const r1Promise = rwmutex.readLock();
		const r2Promise = rwmutex.readLock();

		await r1Promise;
		await r2Promise;

		expect(rwmutex.getReaderCount()).toBe(2);
		expect(rwmutex.isWriteLocked()).toBe(false);

		rwmutex.readUnlock();
		rwmutex.readUnlock();

		expect(rwmutex.getReaderCount()).toBe(0);
	});

	it('should block readers when writer holds lock', async () => {
		await rwmutex.writeLock();

		let readerAcquired = false;
		const readerPromise = rwmutex.readLock().then(() => {
			readerAcquired = true;
		});

		await new Promise((r) => setTimeout(r, 10));
		expect(readerAcquired).toBe(false);
		// Writer is active (isWriteLocked), so reader is blocked
		expect(rwmutex.isWriteLocked()).toBe(true);
		// No writers in queue since first writer acquired immediately
		expect(rwmutex.getWriteWaiterCount()).toBe(0);

		rwmutex.writeUnlock();
		await readerPromise;
		expect(readerAcquired).toBe(true);
	});

	it('should block writers when reader holds lock', async () => {
		await rwmutex.readLock();

		let writerAcquired = false;
		const writerPromise = rwmutex.writeLock().then(() => {
			writerAcquired = true;
		});

		await new Promise((r) => setTimeout(r, 10));
		expect(writerAcquired).toBe(false);

		rwmutex.readUnlock();
		await writerPromise;
		expect(writerAcquired).toBe(true);
	});

	it('should block additional writers when writer is waiting', async () => {
		await rwmutex.writeLock();

		let writer2Acquired = false;
		const writer2Promise = rwmutex.writeLock().then(() => {
			writer2Acquired = true;
		});

		await new Promise((r) => setTimeout(r, 10));
		expect(writer2Acquired).toBe(false);
		expect(rwmutex.getWriteWaiterCount()).toBe(1);

		rwmutex.writeUnlock();
		await writer2Promise;
		expect(writer2Acquired).toBe(true);
	});

	it('should allow readers after writer releases', async () => {
		await rwmutex.writeLock();

		const readersAcquired: number[] = [];
		const reader1Promise = rwmutex.readLock().then(() => readersAcquired.push(1));
		const reader2Promise = rwmutex.readLock().then(() => readersAcquired.push(2));

		await new Promise((r) => setTimeout(r, 10));
		expect(readersAcquired.length).toBe(0);

		rwmutex.writeUnlock();

		await reader1Promise;
		await reader2Promise;
		expect(readersAcquired).toEqual([1, 2]);
	});

	it('should maintain proper state after multiple read/write cycles', async () => {
		// Read lock cycle
		await rwmutex.readLock();
		rwmutex.readUnlock();
		expect(rwmutex.getReaderCount()).toBe(0);

		// Write lock cycle
		await rwmutex.writeLock();
		expect(rwmutex.isWriteLocked()).toBe(true);
		rwmutex.writeUnlock();
		expect(rwmutex.isWriteLocked()).toBe(false);

		// Mixed cycle: read -> write -> read
		await rwmutex.readLock();
		expect(rwmutex.getReaderCount()).toBe(1);

		rwmutex.readUnlock();
		await rwmutex.writeLock();
		expect(rwmutex.isWriteLocked()).toBe(true);

		rwmutex.writeUnlock();
		await rwmutex.readLock();
		expect(rwmutex.getReaderCount()).toBe(1);
		rwmutex.readUnlock();
	});

	it('should handle concurrent read-heavy workload', async () => {
		const readOperations: number[] = [];
		let writeCompleted = false;

		// Start multiple readers
		const readTasks = Array.from({ length: 5 }, async (_, i) => {
			await rwmutex.readLock();
			readOperations.push(i);
			await new Promise((r) => setTimeout(r, 10));
			rwmutex.readUnlock();
		});

		// Start a writer after some reads
		await new Promise((r) => setTimeout(r, 5));
		const writeTask = (async () => {
			await rwmutex.writeLock();
			writeCompleted = true;
			await new Promise((r) => setTimeout(r, 10));
			rwmutex.writeUnlock();
		})();

		await Promise.all(readTasks);
		await writeTask;

		// All reads should have started before the write (or interleaved)
		// The exact order depends on scheduling, but write should complete
		expect(writeCompleted).toBe(true);
	});
});

describe('Concurrency Stress Tests', () => {
	it('should handle rapid acquire/release cycles', async () => {
		const mutex = new AsyncMutex();

		const iterations = 100;
		const promises = Array.from({ length: iterations }, async (_, i) => {
			await mutex.acquire();
			await new Promise((r) => setTimeout(r, 1));
			mutex.release();
			return i;
		});

		await Promise.all(promises);
		expect(mutex.isLocked()).toBe(false);
		expect(mutex.getWaiterCount()).toBe(0);
	});

	it('should handle semaphore with high concurrency', async () => {
		const semaphore = new AsyncSemaphore(5);
		const completions: number[] = [];
		let activeCount = 0;
		let maxActive = 0;

		const tasks = Array.from({ length: 20 }, async (_, i) => {
			await semaphore.acquire();
			activeCount++;
			maxActive = Math.max(maxActive, activeCount);
			completions.push(i);
			await new Promise((r) => setTimeout(r, 5));
			activeCount--;
			semaphore.release();
		});

		await Promise.all(tasks);

		expect(completions.length).toBe(20);
		expect(maxActive).toBe(5); // Should never exceed semaphore limit
	});

	it('should not deadlock under complex locking patterns', async () => {
		const mutex1 = new AsyncMutex();
		const mutex2 = new AsyncMutex();

		const deadlockTest = async () => {
			// This pattern could deadlock if locks were not FIFO
			await using _1 = await mutex1.acquire();
			await using _2 = await mutex2.acquire();

			await new Promise((r) => setTimeout(r, 10));

			// Now release in opposite order
		};

		// Run multiple concurrent locking operations
		const tasks = Array.from({ length: 10 }, (_, i) => deadlockTest());

		await Promise.all(tasks);
		expect(mutex1.isLocked()).toBe(false);
		expect(mutex2.isLocked()).toBe(false);
	});
});
