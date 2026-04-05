/**
 * Subagent Announcer - Result Delivery and Completion Handling
 *
 * ## Purpose
 * Handles waiting for subagent completion and delivering results back to the
 * parent agent. Implements retry logic for reliable delivery and completion
 * tracking for observability.
 *
 * ## Announcement Flow
 *
 * ```
 * Parent Agent                  SubagentAnnouncer              Session Store
 *      │                             │                              │
 *      │──── announce(params) ─────►│                              │
 *      │                             │                              │
 *      │                             │─── waitForCompletion() ────►│
 *      │                             │                              │
 *      │                             │◄── outcome / timeout ───────│
 *      │                             │                              │
 *      │                             │─── build output message      │
 *      │                             │    (roundOneReply + outcome) │
 *      │                             │                              │
 *      │                             │─── deliverToRequester() ───►│
 *      │                             │    Add assistant message    │
 *      │                             │    to parent's session       │
 *      │                             │                              │
 *      │                             │◄── success/failure ─────────│
 *      │                             │                              │
 *      │                             │─── [If failed] ──────────────│
 *      │                             │    handleDeliveryFailure()  │
 *      │                             │    (retry up to 3 times)    │
 *      │                             │                              │
 *      │◄── AnnouncementResult ─────│                              │
 *      │  { delivered, output }      │                              │
 * ```
 *
 * ## Wait for Completion Pattern
 *
 * The announcer polls for completion status:
 * ```typescript
 * while (not timed out) {
 *   // Check session metadata for completion flag
 *   // Check completion tracking Map
 *   // Wait 100ms before next check
 * }
 * // Timeout returns null
 * ```
 *
 * Completion is signaled by:
 * 1. Session metadata `completed: true`
 * 2. Completion tracking Map entry with `completed: true`
 *
 * ## Result Message Format
 *
 * Delivered to parent's session as an assistant message:
 * ```typescript
 * {
 *   role: 'assistant',
 *   content: `[Subagent {label} completed]\n{full_output}`,
 *   metadata: {
 *     source: 'subagent',
 *     childLabel: string  // Last segment of child session key
 *   }
 * }
 * ```
 *
 * The `full_output` includes:
 * - `roundOneReply` (if provided) as preamble
 * - Success: `outcome.output || 'Task completed successfully.'`
 * - Failure: `Task failed: ${outcome.error || 'Unknown error'}`
 *
 * ## Retry Logic
 *
 * Delivery failures are retried with exponential backoff:
 * ```
 * Retry 1: Wait 1s, then retry
 * Retry 2: Wait 2s, then retry
 * Retry 3: Wait 3s, then retry
 * ───────────────────────────────
 * All failed: Return { delivered: false, output, error }
 * ```
 *
 * ## Completion Tracking
 *
 * The announcer maintains two tracking mechanisms:
 *
 * ### Pending Handlers
 * Map of `childSessionKey → handler function`
 * - Registered via `registerCompletionHandler()`
 * - Called when child marks as completed
 * - Automatically unregistered after call
 *
 * ### Completion Tracking Map
 * Map of `childSessionKey → CompletionTrackingMetadata`
 * - Set when `markCompleted()` is called
 * - Checked during wait loop
 * - Stores `runId`, `requesterSessionKey`, `completionTime`
 *
 * ## Event Emissions
 *
 * | Event Type                      | Payload                                    |
 * |----------------------------------|--------------------------------------------|
 * | `subagent.announcement`         | childKey, requesterKey, success, delivered |
 * | `subagent.result_delivered`      | requesterKey, outputLength, childLabel      |
 * | `subagent.result_delivery_failed`| requesterKey, error                       |
 * | `subagent.result_delivery_exhausted`| requesterKey, retries, error            |
 * | `subagent.completed`            | childKey, runId, requesterKey              |
 *
 * ## AI Context Optimization Tips
 * 1. **Round-One Replies**: Use `roundOneReply` to pass partial results immediately
 * 2. **Timeout Tuning**: Adjust `timeoutMs` based on expected task complexity
 * 3. **Session Binding**: Works with spawner's `thread: true` for coordinated delivery
 * 4. **Error Context**: Failed deliveries still include output - parent can decide retry
 * 5. **Completion Waiting**: Don't poll too aggressively - 100ms intervals are reasonable
 *
 * ## Integration with Spawner
 *
 * ```
 * SubagentSpawner                    SubagentAnnouncer
 *      │                                  │
 *      │──── spawn()                      │
 *      │                                  │
 *      │──── markSubagentEnded() ─────────►│
 *      │       │                          │
 *      │       │                          │─── Register handler
 *      │       │                          │
 *      │       │                          │─── waitForCompletion()
 *      │       │                          │
 *      │       │◄─── result ──────────────│
 *      │                                  │
 *      │                                  │─── markCompleted()
 *      │                                  │    (emits event)
 * ```
 *
 * ## Default Constants
 *
 * | Constant          | Value     | Description                    |
 * |-------------------|-----------|--------------------------------|
 * | `DEFAULT_TIMEOUT_MS` | 300000  | 5 minutes max wait             |
 * | `RETRY_DELAY_MS`  | 1000      | 1 second base retry delay      |
 * | `MAX_RETRIES`     | 3         | Maximum delivery retry attempts |
 *
 * @example
 * const announcer = createSubagentAnnouncer(sessionStore, eventBus);
 *
 * // Announce completion and wait for result
 * const result = await announcer.announce({
 *   childSessionKey: 'agent:tasks:subagent:abc123',
 *   requesterSessionKey: parentSessionKey,
 *   roundOneReply: 'Research in progress...',
 *   cleanup: 'delete'
 * });
 *
 * if (result.delivered) {
 *   console.log('Result delivered:', result.output);
 * } else {
 *   console.log('Delivery failed:', result.error);
 * }
 *
 * @example
 * // Register completion handler for async notification
 * announcer.registerCompletionHandler(childSessionKey, (result) => {
 *   console.log('Child completed:', result.output);
 * });
 *
 * // Later, mark as completed
 * announcer.markCompleted(childSessionKey, runId, requesterSessionKey);
 */

import type { SessionStore } from '../core/session.js';
import type { EventBus } from '../events/event-bus.js';
import type { SubagentRunRecord } from './spawn.js';
import { MULTI_AGENT } from '../constants.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for announcing subagent completion
 */
export interface AnnounceParams {
	/** Session key of the child subagent */
	childSessionKey: string;
	/** Session key of the parent requester */
	requesterSessionKey: string;
	/** Optional initial reply from round one */
	roundOneReply?: string;
	/** Timeout in milliseconds */
	timeoutMs?: number;
	/** Cleanup policy */
	cleanup: 'delete' | 'keep';
}

/**
 * Result of announcing completion
 */
export interface AnnouncementResult {
	/** Whether the announcement was delivered */
	delivered: boolean;
	/** Output from the subagent */
	output?: string;
	/** Error message if failed */
	error?: string;
}

/**
 * Session metadata for tracking completion
 */
interface CompletionTrackingMetadata {
	runId: string;
	childSessionKey: string;
	requesterSessionKey: string;
	completed: boolean;
	completionTime?: number;
}

// =============================================================================
// Subagent Announcer
// =============================================================================

/**
 * Handles announcing subagent completion to parent agents
 */
export class SubagentAnnouncer {
	private sessionStore: SessionStore;
	private eventBus: EventBus;

	/** Pending completion handlers */
	private pendingHandlers: Map<string, (result: AnnouncementResult) => void> = new Map();

	/** Completion tracking */
	private completionTracking: Map<string, CompletionTrackingMetadata> = new Map();

	constructor(sessionStore: SessionStore, eventBus: EventBus) {
		this.sessionStore = sessionStore;
		this.eventBus = eventBus;
	}

	// -------------------------------------------------------------------------
	// Core Announcement
	// -------------------------------------------------------------------------

	/**
	 * Announce subagent completion to the parent agent
	 */
	async announce(params: AnnounceParams): Promise<AnnouncementResult> {
		const { childSessionKey, requesterSessionKey, roundOneReply, timeoutMs, cleanup } = params;

		const effectiveTimeout = timeoutMs || MULTI_AGENT.COMPLETION_TIMEOUT_MS;

		// Wait for subagent completion
		const outcome = await this.waitForCompletion(childSessionKey, effectiveTimeout);

		if (!outcome) {
			// Timeout waiting for completion
			return {
				delivered: false,
				error: 'Timeout waiting for subagent completion'
			};
		}

		// Build output message
		let output = '';

		if (roundOneReply) {
			output = `${roundOneReply}\n\n`;
		}

		if (outcome.success) {
			output += outcome.output || 'Task completed successfully.';
		} else {
			output += `Task failed: ${outcome.error || 'Unknown error'}`;
		}

		// Try to deliver to requester with retry
		const delivered = await this.deliverToRequester(
			requesterSessionKey,
			output,
			childSessionKey.split(':').pop()
		);

		if (!delivered) {
			// Retry delivery
			const retried = await this.handleDeliveryFailure(
				requesterSessionKey,
				output,
				MULTI_AGENT.MAX_DELIVERY_RETRIES
			);
			if (!retried) {
				return {
					delivered: false,
					output,
					error: 'Failed to deliver result to requester after retries'
				};
			}
		}

		// Emit completion event
		this.emitEvent('subagent.announcement', {
			childSessionKey,
			requesterSessionKey,
			success: outcome.success,
			delivered: true
		});

		return {
			delivered: true,
			output
		};
	}

	// -------------------------------------------------------------------------
	// Wait for Completion
	// -------------------------------------------------------------------------

	/**
	 * Wait for a subagent to complete
	 */
	private async waitForCompletion(
		childSessionKey: string,
		timeoutMs: number
	): Promise<SubagentRunRecord['outcome'] | null> {
		const startTime = Date.now();
		const checkInterval = 100; // Check every 100ms

		while (Date.now() - startTime < timeoutMs) {
			// Check if session has completion metadata
			const session = this.sessionStore.get(childSessionKey);
			if (session) {
				const metadata = session.metadata as CompletionTrackingMetadata | undefined;
				if (metadata?.completed) {
					return {
						success: true,
						output: session.summary || undefined
					};
				}
			}

			// Check completion tracking
			const tracking = this.completionTracking.get(childSessionKey);
			if (tracking?.completed) {
				return {
					success: true,
					output: tracking.completionTime?.toString()
				};
			}

			// Wait a bit before checking again
			await this.sleep(checkInterval);
		}

		// Timeout
		return null;
	}

	// -------------------------------------------------------------------------
	// Deliver to Requester
	// -------------------------------------------------------------------------

	/**
	 * Deliver result to the requester
	 */
	private async deliverToRequester(
		requesterSessionKey: string,
		output: string,
		childLabel?: string
	): Promise<boolean> {
		try {
			// Add result message to requester's session
			const message = childLabel
				? `[Subagent ${childLabel} completed]\n${output}`
				: `[Subagent completed]\n${output}`;

			this.sessionStore.addMessage(requesterSessionKey, {
				role: 'assistant',
				content: message,
				metadata: {
					source: 'subagent',
					childLabel
				}
			});

			// Emit delivery event
			this.emitEvent('subagent.result_delivered', {
				requesterSessionKey,
				outputLength: output.length,
				childLabel
			});

			return true;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			this.emitEvent('subagent.result_delivery_failed', {
				requesterSessionKey,
				error: errorMessage
			});
			return false;
		}
	}

	// -------------------------------------------------------------------------
	// Delivery Failure Handling
	// -------------------------------------------------------------------------

	/**
	 * Handle delivery failure with retry
	 */
	private async handleDeliveryFailure(
		requesterSessionKey: string,
		output: string,
		retries: number
	): Promise<boolean> {
		let lastError: Error | undefined;

		for (let i = 0; i < retries; i++) {
			// Wait before retry
			await this.sleep(MULTI_AGENT.DELIVERY_RETRY_DELAY_MS * (i + 1));

			// Try delivery again
			const delivered = await this.deliverToRequester(requesterSessionKey, output);
			if (delivered) {
				return true;
			}

			lastError = new Error(`Retry ${i + 1} failed`);
		}

		// All retries failed
		this.emitEvent('subagent.result_delivery_exhausted', {
			requesterSessionKey,
			retries,
			error: lastError?.message
		});

		return false;
	}

	// -------------------------------------------------------------------------
	// Completion Tracking
	// -------------------------------------------------------------------------

	/**
	 * Register a completion handler for a child session
	 */
	registerCompletionHandler(
		childSessionKey: string,
		handler: (result: AnnouncementResult) => void
	): void {
		this.pendingHandlers.set(childSessionKey, handler);
	}

	/**
	 * Unregister a completion handler
	 */
	unregisterCompletionHandler(childSessionKey: string): void {
		this.pendingHandlers.delete(childSessionKey);
	}

	/**
	 * Mark a subagent as completed
	 */
	markCompleted(childSessionKey: string, runId: string, requesterSessionKey: string): void {
		// Update completion tracking
		this.completionTracking.set(childSessionKey, {
			runId,
			childSessionKey,
			requesterSessionKey,
			completed: true,
			completionTime: Date.now()
		});

		// Call pending handler if exists
		const handler = this.pendingHandlers.get(childSessionKey);
		if (handler) {
			const session = this.sessionStore.get(childSessionKey);
			handler({
				delivered: true,
				output: session?.summary
			});
			this.pendingHandlers.delete(childSessionKey);
		}

		// Emit completion event
		this.emitEvent('subagent.completed', {
			childSessionKey,
			runId,
			requesterSessionKey
		});
	}

	// -------------------------------------------------------------------------
	// Utilities
	// -------------------------------------------------------------------------

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private emitEvent(type: string, data: Record<string, unknown>): void {
		this.eventBus.emit({
			runId: 'announcer',
			seq: 0,
			stream: 'lifecycle',
			ts: Date.now(),
			type,
			data
		});
	}

	/**
	 * Clear all state
	 */
	clear(): void {
		this.pendingHandlers.clear();
		this.completionTracking.clear();
	}
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new subagent announcer
 */
export function createSubagentAnnouncer(
	sessionStore: SessionStore,
	eventBus: EventBus
): SubagentAnnouncer {
	return new SubagentAnnouncer(sessionStore, eventBus);
}
