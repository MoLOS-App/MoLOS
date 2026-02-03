/**
 * MCP Async Log Queue
 *
 * Non-blocking logging queue for MCP requests/responses.
 * Batches log writes to reduce database latency.
 */

import { McpLogRepository } from '$lib/repositories/ai/mcp';
import type { MCPContext } from '$lib/models/ai/mcp';

/**
 * Log entry data
 */
export interface LogEntry {
	userId: string;
	apiKeyId: string | null;
	sessionId: string;
	requestId: string;
	method: string;
	toolName?: string;
	resourceName?: string;
	promptName?: string;
	params?: unknown;
	result?: unknown;
	status: 'success' | 'error';
	errorMessage?: string;
	durationMs: number;
	timestamp: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
	queueSize: number;
	processedCount: number;
	errorCount: number;
	lastFlushTime: number | null;
}

/**
 * Async Log Queue
 *
 * Buffers log entries and writes them in batches to reduce database load.
 */
export class LogQueue {
	private queue: LogEntry[] = [];
	private processing = false;
	private batchSize: number;
	private flushInterval: number;
	private flushTimer: ReturnType<typeof setInterval> | null = null;
	private stats = {
		processedCount: 0,
		errorCount: 0,
		lastFlushTime: null as number | null
	};
	private shutdownRequested = false;

	constructor(batchSize = 50, flushInterval = 5000) {
		this.batchSize = batchSize;
		this.flushInterval = flushInterval;

		// Start periodic flush
		this.flushTimer = setInterval(() => {
			this.flush().catch((err) => {
				console.error('[MCP Log Queue] Error flushing:', err);
			});
		}, this.flushInterval);
	}

	/**
	 * Enqueue a log entry (non-blocking)
	 */
	enqueue(entry: LogEntry): void {
		if (this.shutdownRequested) {
			console.warn('[MCP Log Queue] Shutdown requested, ignoring log entry');
			return;
		}

		this.queue.push(entry);

		// Flush immediately if batch size reached
		if (this.queue.length >= this.batchSize) {
			this.flush().catch((err) => {
				console.error('[MCP Log Queue] Error flushing:', err);
			});
		}
	}

	/**
	 * Process a batch of log entries
	 */
	private async processBatch(entries: LogEntry[]): Promise<void> {
		const logRepo = new McpLogRepository();

		for (const entry of entries) {
			try {
				await logRepo.create({
					userId: entry.userId,
					apiKeyId: entry.apiKeyId,
					sessionId: entry.sessionId,
					requestId: entry.requestId,
					method: entry.method,
					toolName: entry.toolName,
					resourceName: entry.resourceName,
					promptName: entry.promptName,
					params: entry.params,
					result: entry.result,
					status: entry.status,
					errorMessage: entry.errorMessage,
					durationMs: entry.durationMs
				});
				this.stats.processedCount++;
			} catch (error) {
				this.stats.errorCount++;
				console.error('[MCP Log Queue] Error writing log entry:', error);
			}
		}
	}

	/**
	 * Flush queued entries to database
	 */
	async flush(): Promise<void> {
		if (this.processing || this.queue.length === 0) {
			return;
		}

		this.processing = true;

		try {
			// Take all entries currently in queue
			const entries = this.queue.splice(0, this.queue.length);

			if (entries.length > 0) {
				await this.processBatch(entries);
				this.stats.lastFlushTime = Date.now();
				console.debug(`[MCP Log Queue] Flushed ${entries.length} entries`);
			}
		} catch (error) {
			console.error('[MCP Log Queue] Error flushing batch:', error);
		} finally {
			this.processing = false;
		}
	}

	/**
	 * Get queue statistics
	 */
	getStats(): QueueStats {
		return {
			queueSize: this.queue.length,
			processedCount: this.stats.processedCount,
			errorCount: this.stats.errorCount,
			lastFlushTime: this.stats.lastFlushTime
		};
	}

	/**
	 * Clear all queued entries (without writing)
	 */
	clear(): void {
		this.queue = [];
	}

	/**
	 * Shutdown the queue (flush remaining entries and stop timer)
	 */
	async shutdown(timeout = 10000): Promise<void> {
		this.shutdownRequested = true;

		// Stop the flush timer
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}

		// Flush remaining entries
		const startTime = Date.now();
		while (this.queue.length > 0 && Date.now() - startTime < timeout) {
			await this.flush();
			// Wait a bit for the flush to complete
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		if (this.queue.length > 0) {
			console.warn(`[MCP Log Queue] Shutdown with ${this.queue.length} entries still in queue`);
		}
	}
}

/**
 * Singleton log queue instance
 */
export const logQueue = new LogQueue();

/**
 * Create a log entry helper
 */
export function createLogEntry(
	context: MCPContext,
	requestId: string,
	method: string,
	result: unknown,
	status: 'success' | 'error',
	durationMs: number,
	errorMessage?: string,
	metadata?: {
		toolName?: string;
		resourceName?: string;
		promptName?: string;
		params?: unknown;
	}
): LogEntry {
	return {
		userId: context.userId,
		apiKeyId: context.apiKeyId,
		sessionId: context.sessionId,
		requestId,
		method,
		...metadata,
		result,
		status,
		errorMessage,
		durationMs,
		timestamp: Date.now()
	};
}

/**
 * Log an MCP request (non-blocking)
 */
export function logRequest(
	context: MCPContext,
	requestId: string,
	method: string,
	result: unknown,
	status: 'success' | 'error',
	durationMs: number,
	errorMessage?: string,
	metadata?: {
		toolName?: string;
		resourceName?: string;
		promptName?: string;
		params?: unknown;
	}
): void {
	const entry = createLogEntry(
		context,
		requestId,
		method,
		result,
		status,
		durationMs,
		errorMessage,
		metadata
	);

	logQueue.enqueue(entry);
}

/**
 * Get log queue statistics
 */
export function getLogQueueStats(): QueueStats {
	return logQueue.getStats();
}

/**
 * Flush the log queue manually
 */
export async function flushLogQueue(): Promise<void> {
	return logQueue.flush();
}

/**
 * Shutdown the log queue
 */
export async function shutdownLogQueue(): Promise<void> {
	return logQueue.shutdown();
}
