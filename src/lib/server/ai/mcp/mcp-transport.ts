/**
 * MCP Transport Layer
 *
 * Handles Server-Sent Events (SSE) communication for the MCP protocol.
 */

import { ReadableStream, TransformStream } from 'stream/web';
import type { JSONRPCResponse } from '$lib/models/ai/mcp';
import { formatSSEMessage } from './json-rpc';

/**
 * Global flag to indicate if module is being disposed (for HMR)
 */
let isDisposing = false;

/**
 * SSE event types
 */
export type SSEEventType = 'message' | 'endpoint' | 'error' | 'keep-alive';

/**
 * SSE event
 */
export interface SSEEvent {
	event: SSEEventType;
	data: unknown;
}

/**
 * Create a TransformStream that converts objects to SSE format
 */
export function createSSETransformStream(): TransformStream<JSONRPCResponse, Uint8Array> {
	return new TransformStream({
		transform(chunk, controller) {
			const message = formatSSEMessage(chunk);
			controller.enqueue(new TextEncoder().encode(message));
		}
	});
}

/**
 * Create a SSE message event
 */
export function createSSEMessageEvent(data: JSONRPCResponse): SSEEvent {
	return {
		event: 'message',
		data
	};
}

/**
 * Create a SSE endpoint event (connection info)
 */
export function createSSEEndpointEvent(url: string): SSEEvent {
	return {
		event: 'endpoint',
		data: { url }
	};
}

/**
 * Create a SSE error event
 */
export function createSSEErrorEvent(message: string, code?: number): SSEEvent {
	return {
		event: 'error',
		data: {
			message,
			...(code !== undefined && { code })
		}
	};
}

/**
 * Format SSE event for sending
 */
export function formatSSEEvent(event: SSEEvent): string {
	if (event.event === 'keep-alive') {
		return ': keep-alive\n\n';
	}

	let output = '';

	if (event.event !== 'message') {
		output += `event: ${event.event}\n`;
	}

	output += `data: ${JSON.stringify(event.data)}\n\n`;

	return output;
}

/**
 * Track all active timers for cleanup during HMR
 */
const activeTimers = new Set<ReturnType<typeof setInterval>>();

/**
 * Create a readable stream that periodically sends keep-alive comments
 */
export function createKeepAliveStream(intervalMs: number = 15000): ReadableStream<Uint8Array> {
	let controller: ReadableStreamDefaultController<Uint8Array>;
	let timer: ReturnType<typeof setInterval> | null = null;

	return new ReadableStream({
		start(c) {
			controller = c;
			timer = setInterval(() => {
				if (isDisposing) {
					// Module is being disposed, stop timer
					if (timer) {
						clearInterval(timer);
						activeTimers.delete(timer);
					}
					return;
				}
				if (!controller || controller.desiredSize === null) {
					// Controller is closed
					if (timer) {
						clearInterval(timer);
						activeTimers.delete(timer);
					}
					return;
				}
				try {
					controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'));
				} catch {
					// Stream already closed, clean up
					if (timer) {
						clearInterval(timer);
						activeTimers.delete(timer);
					}
				}
			}, intervalMs);
			if (timer) {
				activeTimers.add(timer);
			}
		},
		cancel() {
			if (timer) {
				clearInterval(timer);
				activeTimers.delete(timer);
			}
		}
	});
}

/**
 * Merge multiple readable streams into one
 */
export function mergeStreams(...streams: ReadableStream<Uint8Array>[]): ReadableStream<Uint8Array> {
	const readers = streams.map((s) => s.getReader());
	let closedCount = 0;

	return new ReadableStream({
		async start(controller) {
			// Track if controller is already closed
			let isClosed = false;

			// Read from all streams in parallel
			for (let i = 0; i < readers.length; i++) {
				const reader = readers[i];
				(async () => {
					try {
						while (true) {
							// Check if module is being disposed
							if (isDisposing) {
								break;
							}
							const { done, value } = await reader.read();
							if (done) break;
							if (!isClosed) {
								try {
									controller.enqueue(value);
								} catch {
									isClosed = true;
									break;
								}
							}
						}
					} finally {
						closedCount++;
						if (closedCount === readers.length && !isClosed && !isDisposing) {
							try {
								controller.close();
							} catch {
								// Controller already closed
							}
						}
					}
				})();
			}
		},
		cancel() {
			// Cancel all readers
			for (const reader of readers) {
				reader.cancel().catch(() => {
					// Ignore cancel errors
				});
			}
		}
	});
}

/**
 * MCP Connection Session
 *
 * Manages an active MCP SSE connection
 */
export class MCPConnectionSession {
	private responseQueue: JSONRPCResponse[] = [];
	private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
	private closed = false;
	private sessionId: string;
	private startTime: Date;

	constructor(sessionId?: string) {
		this.sessionId = sessionId ?? crypto.randomUUID();
		this.startTime = new Date();
	}

	get id(): string {
		return this.sessionId;
	}

	get duration(): number {
		return Date.now() - this.startTime.getTime();
	}

	get isActive(): boolean {
		return !this.closed;
	}

	get hasController(): boolean {
		return this.controller !== null;
	}

	/**
	 * Attach a stream controller to this session
	 */
	attachController(controller: ReadableStreamDefaultController<Uint8Array>): void {
		this.controller = controller;
		console.log('[MCP Session] Controller attached to session:', this.id);

		// Send any queued messages
		let queuedCount = 0;
		while (this.responseQueue.length > 0 && this.closed === false) {
			const response = this.responseQueue.shift();
			if (response) {
				this.sendResponse(response);
				queuedCount++;
			}
		}
		if (queuedCount > 0) {
			console.log('[MCP Session] Sent', queuedCount, 'queued messages');
		}
	}

	/**
	 * Send a response to the client
	 */
	sendResponse(response: JSONRPCResponse): void {
		if (this.closed) {
			console.error('[MCP Session] Session closed, cannot send response');
			return;
		}

		const message = formatSSEMessage(response);

		if (this.controller) {
			try {
				this.controller.enqueue(new TextEncoder().encode(message));
				console.log('[MCP Session] Response enqueued to SSE:', message.substring(0, 100));
			} catch (e) {
				// Stream closed
				console.error('[MCP Session] Error enqueueing response:', e);
				this.closed = true;
			}
		} else {
			// Queue the message until controller is attached
			console.log('[MCP Session] Controller not attached, queuing message');
			this.responseQueue.push(response);
		}
	}

	/**
	 * Close the session
	 */
	close(reason?: string): void {
		this.closed = true;

		if (this.controller) {
			if (reason) {
				const event = formatSSEEvent(createSSEErrorEvent(reason, 1000));
				try {
					this.controller.enqueue(new TextEncoder().encode(event));
				} catch {
					// Stream already closed
				}
			}
			try {
				this.controller.close();
			} catch {
				// Stream already closed
			}
		}

		this.responseQueue = [];
	}
}

/**
 * Active session storage
 */
const activeSessions = new Map<string, MCPConnectionSession>();

/**
 * Get or create a session
 */
export function getSession(sessionId: string): MCPConnectionSession {
	let session = activeSessions.get(sessionId);

	if (!session) {
		session = new MCPConnectionSession(sessionId);
		activeSessions.set(sessionId, session);
	}

	return session;
}

/**
 * Remove a session
 */
export function removeSession(sessionId: string): void {
	const session = activeSessions.get(sessionId);
	if (session) {
		session.close();
		activeSessions.delete(sessionId);
	}
}

/**
 * Get all active sessions
 */
export function getActiveSessions(): MCPConnectionSession[] {
	return Array.from(activeSessions.values());
}

/**
 * Get active session count
 */
export function getActiveSessionCount(): number {
	return activeSessions.size;
}

/**
 * HMR cleanup - clear all active timers when module is disposed
 */
if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		// Signal all streams to stop operations
		isDisposing = true;

		// Small delay to let async operations notice the flag
		// Then clean up resources
		setTimeout(() => {
			// Clear all keep-alive timers
			for (const timer of activeTimers) {
				clearInterval(timer);
			}
			activeTimers.clear();

			// Close all active sessions
			for (const session of activeSessions.values()) {
				try {
					session.close('Module reloading');
				} catch {
					// Ignore close errors
				}
			}
			activeSessions.clear();
		}, 0);
	});
}
