/**
 * Subagent Spawner - Lifecycle Management for Child Agents
 *
 * ## Purpose
 * Handles spawning new subagent sessions with proper depth tracking, concurrency
 * limits, and lifecycle management. Ensures parent-child relationships are properly
 * established for result delivery and context propagation.
 *
 * ## Spawn Lifecycle
 *
 * ```
 * Parent Agent                    SubagentSpawner
 *     │                                 │
 *     │──── spawn(params, context) ─────►│
 *     │                                 │
 *     │                                 │─── Check depth limit
 *     │                                 │─── Check child count limit
 *     │                                 │─── Generate runId, childSessionKey
 *     │                                 │
 *     │                                 │─── Create run record
 *     │                                 │─── Increment child count
 *     │                                 │─── Store depth cache
 *     │                                 │
 *     │                                 │─── Create child session
 *     │                                 │    (parent key, depth, mode, cleanup)
 *     │                                 │
 *     │                                 │─── Add task message
 *     │                                 │─── Add attachments (if any)
 *     │                                 │
 *     │                                 │─── Emit 'subagent.spawn' event
 *     │◄─── { childSessionKey, runId } ─│
 *     │                                 │
 *     │         (Child processes task)  │
 *     │                                 │
 *     │──── markSubagentStarted(runId) ─►│
 *     │                                 │─── Record start time
 *     │                                 │─── Emit 'subagent.started' event
 *     │                                 │
 *     │         (Child completes)        │
 *     │                                 │
 *     │──── markSubagentEnded(runId) ───►│
 *     │                                 │─── Record end time, outcome
 *     │                                 │─── Decrement child count
 *     │                                 │─── Emit 'subagent.ended' event
 *     │                                 │
 *     │                                 │─── [If cleanup=delete]
 *     │                                 │    Delete child session
 *     │                                 │    Clear depth cache
 *     │                                 │    Emit 'subagent.cleanup' event
 * ```
 *
 * ## Depth Tracking
 *
 * Depth represents how many levels deep in the agent hierarchy:
 * ```
 * Depth 0: Root agent (human-initiated)
 * Depth 1: Child of root agent
 * Depth 2: Grandchild
 * Depth 3: Great-grandchild (max by default)
 * ```
 *
 * Depth is:
 * - **Cached**: Stored in `sessionDepths` Map for fast lookup
 * - **Lazy-calculated**: If not in cache, walks parent chain
 * - **Inherited**: Child depth = parent depth + 1
 *
 * ## Concurrency Limits
 *
 * Each parent has a maximum number of concurrent children:
 * ```
 * maxChildren = 5 (default)
 *
 * Parent ─┬─► Child 1 (active)
 *          ├─► Child 2 (active)
 *          ├─► Child 3 (active)
 *          └─► Child 4 (spawning...)
 *                   │
 *                   └── [BLOCKED] max children reached
 * ```
 *
 * ## Spawn Modes
 *
 * | Mode      | Description                                      |
 * |-----------|--------------------------------------------------|
 * | `run`     | Fire-and-forget, don't wait for completion (default) |
 * | `session` | Wait for completion, deliver result to parent    |
 *
 * ## Cleanup Policy
 *
 * | Policy   | Behavior                                          |
 * |----------|--------------------------------------------------|
 * | `delete` | Delete child session after completion (default)   |
 * | `keep`   | Retain child session for debugging/inspection     |
 *
 * ## Thread Binding (Parent-Child Context Sharing)
 *
 * When `thread: true` is set:
 * - Child session stores `controllerSessionKey` = parent's session key
 * - This enables:
 *   - Parent to monitor child's progress
 *   - Child to access parent's context
 *   - Coordinated cancellation
 *
 * ## Parent-Child Turn Relationships
 *
 * The spawner establishes parent-child turn relationships:
 * ```
 * Turn 1: Parent processes request
 *            │
 *            ├── spawn() ──► Child 1 starts
 *            │                 │
 *            └── spawn() ──► Child 2 starts
 *                              │
 *                              ├── Child 1 completes, result delivered
 *                              │
 *                              └── Child 2 completes, result delivered
 *            │
 * Turn N: Parent processes child results
 * ```
 *
 * ## AI Context Optimization Tips
 * 1. **Depth Budget**: Reserve context for depth 0-1, use depth 2-3 sparingly
 * 2. **Attachment Size**: Minimize attachment sizes to reduce cross-agent context
 * 3. **Cleanup = Less Context**: Delete completed sessions to free context space
 * 4. **Mode Selection**: Use `run` for parallel tasks, `session` for sequential delegation
 * 5. **Depth First**: Better to spawn many shallow agents than few deep ones
 *
 * ## Session Metadata
 * Stored on each child session:
 * ```typescript
 * {
 *   runId: string;           // Unique run identifier
 *   parentSessionKey: string; // Parent's session
 *   depth: number;           // Hierarchy depth
 *   spawnMode: 'run' | 'session';
 *   cleanup: 'delete' | 'keep';
 *   childSessionKey: string; // Child's own session key
 * }
 * ```
 *
 * @example
 * const spawner = getSubagentSpawner();
 *
 * // Spawn a research subagent
 * const result = await spawner.spawn(
 *   {
 *     task: 'Research the latest AI developments',
 *     label: 'research-1',
 *     mode: 'session',
 *     cleanup: 'keep'  // Keep for debugging
 *   },
 *   {
 *     requesterSessionKey: parentSessionKey,
 *     requesterUserId: 'user-123',
 *     maxDepth: 3,
 *     maxChildren: 5
 *   }
 * );
 *
 * if (result.status === 'success') {
 *   console.log(`Spawned child: ${result.childSessionKey}`);
 * }
 *
 * @example
 * // Depth tracking
 * const depth = spawner.getSubagentDepth(childSessionKey);
 * console.log(`Child is at depth ${depth}`);
 *
 * // Check if can spawn more
 * const canSpawn = spawner.canSpawnSubagent(parentKey, 3, 5);
 */

import { randomUUID } from 'crypto';
import type { SessionStore } from '../core/session.js';
import type { EventBus } from '../events/event-bus.js';
import { ModuleRegistry } from './registry.js';
import type { LifecycleTracker } from './lifecycle.js';
import { createLifecycleTracker } from './lifecycle.js';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_MAX_CHILDREN = 5;
const DEFAULT_TIMEOUT_SECONDS = 300; // 5 minutes

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for spawning a subagent
 */
export interface SpawnParams {
	/** The task description for the subagent */
	task: string;
	/** Optional label for the subagent */
	label?: string;
	/** Target agent ID (default: current agent) */
	agentId?: string;
	/** Override model */
	model?: string;
	/** Thinking level */
	thinking?: string;
	/** Timeout in seconds (default: 300) */
	runTimeoutSeconds?: number;
	/** Create thread binding to parent */
	thread?: boolean;
	/** Spawn mode */
	mode?: 'run' | 'session';
	/** Cleanup policy after completion */
	cleanup?: 'delete' | 'keep';
	/** Sandbox policy */
	sandbox?: 'inherit' | 'require';
	/** Whether to expect a completion message */
	expectsCompletionMessage?: boolean;
	/** Attachments to pass to the subagent */
	attachments?: Array<{
		name: string;
		content: string;
		encoding?: string;
		mimeType?: string;
	}>;
}

/**
 * Context for spawning a subagent
 */
export interface SpawnContext {
	/** Session key of the requesting parent */
	requesterSessionKey: string;
	/** User ID of the requester */
	requesterUserId?: string;
	/** Agent channel for delivery */
	agentChannel?: string;
	/** Maximum depth of subagent chain */
	maxDepth?: number;
	/** Maximum concurrent children per parent */
	maxChildren?: number;
}

/**
 * Result of spawning a subagent
 */
export interface SpawnResult {
	status: 'success' | 'forbidden' | 'error';
	/** Session key of the child subagent */
	childSessionKey?: string;
	/** Run ID for tracking */
	runId?: string;
	/** Error message if failed */
	error?: string;
}

/**
 * Record of a subagent run
 */
export interface SubagentRunRecord {
	/** Unique run identifier */
	runId: string;
	/** Child session key */
	childSessionKey: string;
	/** Controller session key (for thread binding) */
	controllerSessionKey?: string;
	/** Parent session key */
	requesterSessionKey: string;
	/** Task description */
	task: string;
	/** Cleanup policy */
	cleanup: 'delete' | 'keep';
	/** Spawn mode */
	spawnMode: 'run' | 'session';
	/** Creation timestamp */
	createdAt: number;
	/** Start timestamp */
	startedAt?: number;
	/** End timestamp */
	endedAt?: number;
	/** Outcome of the run */
	outcome?: {
		success: boolean;
		output?: string;
		error?: string;
	};
}

/**
 * Session metadata for subagent tracking
 */
interface SubagentSessionMetadata {
	runId: string;
	parentSessionKey: string;
	depth: number;
	spawnMode: 'run' | 'session';
	cleanup: 'delete' | 'keep';
	childSessionKey: string;
}

// =============================================================================
// Subagent Spawner
// =============================================================================

/**
 * Handles spawning and tracking subagents
 */
export class SubagentSpawner {
	private registry: ModuleRegistry;
	private sessionStore: SessionStore;
	private eventBus: EventBus;
	private lifecycleTracker?: LifecycleTracker;

	/** Active subagent runs */
	private activeRuns: Map<string, SubagentRunRecord> = new Map();

	/** Child count per parent session */
	private childCounts: Map<string, number> = new Map();

	/** Session depth cache */
	private sessionDepths: Map<string, number> = new Map();

	constructor(
		registry: ModuleRegistry,
		sessionStore: SessionStore,
		eventBus: EventBus,
		lifecycleTracker?: LifecycleTracker
	) {
		this.registry = registry;
		this.sessionStore = sessionStore;
		this.eventBus = eventBus;
		this.lifecycleTracker =
			lifecycleTracker || (eventBus ? createLifecycleTracker(eventBus) : undefined);
	}

	/**
	 * Get the lifecycle tracker instance
	 */
	getLifecycleTracker(): LifecycleTracker | undefined {
		return this.lifecycleTracker;
	}

	/**
	 * Set a custom lifecycle tracker
	 */
	setLifecycleTracker(tracker: LifecycleTracker): void {
		this.lifecycleTracker = tracker;
	}

	// -------------------------------------------------------------------------
	// Core Spawning
	// -------------------------------------------------------------------------

	/**
	 * Spawn a new subagent
	 */
	async spawn(params: SpawnParams, context: SpawnContext): Promise<SpawnResult> {
		const {
			requesterSessionKey,
			requesterUserId,
			agentChannel,
			maxDepth = DEFAULT_MAX_DEPTH,
			maxChildren = DEFAULT_MAX_CHILDREN
		} = context;

		// Check depth limit
		const currentDepth = this.getSubagentDepth(requesterSessionKey);
		if (currentDepth >= maxDepth) {
			return {
				status: 'forbidden',
				error: `Depth limit exceeded: ${currentDepth} >= ${maxDepth}`
			};
		}

		// Check child count limit
		if (!this.canSpawnSubagent(requesterSessionKey, maxDepth, maxChildren)) {
			return {
				status: 'forbidden',
				error: `Max children limit exceeded: ${this.childCounts.get(requesterSessionKey) || 0} >= ${maxChildren}`
			};
		}

		// Generate session key and run ID
		const runId = `run-${randomUUID()}`;
		const childSessionKey = `agent:${params.agentId || 'default'}:subagent:${randomUUID()}`;

		// Determine spawn mode
		const spawnMode = params.mode || 'run';
		const cleanup = params.cleanup || 'delete';

		// Create run record
		const runRecord: SubagentRunRecord = {
			runId,
			childSessionKey,
			controllerSessionKey: params.thread ? requesterSessionKey : undefined,
			requesterSessionKey,
			task: params.task,
			cleanup,
			spawnMode,
			createdAt: Date.now()
		};

		// Store run record
		this.activeRuns.set(runId, runRecord);

		// Increment child count
		const currentCount = this.childCounts.get(requesterSessionKey) || 0;
		this.childCounts.set(requesterSessionKey, currentCount + 1);

		// Store depth for child
		this.sessionDepths.set(childSessionKey, currentDepth + 1);

		// Create child session
		this.sessionStore.create(childSessionKey, {
			runId,
			parentSessionKey: requesterSessionKey,
			depth: currentDepth + 1,
			spawnMode,
			cleanup,
			label: params.label
		});

		// Add initial task message
		this.sessionStore.addMessage(childSessionKey, {
			role: 'user',
			content: params.task
		});

		// Add attachments if provided
		if (params.attachments && params.attachments.length > 0) {
			for (const attachment of params.attachments) {
				this.sessionStore.addMessage(childSessionKey, {
					role: 'user',
					content: `[Attachment: ${attachment.name}]\n${attachment.content}`,
					metadata: {
						attachment: true,
						mimeType: attachment.mimeType,
						encoding: attachment.encoding
					}
				});
			}
		}

		// Emit spawn event
		this.emitEvent('subagent.spawn', {
			runId,
			childSessionKey,
			requesterSessionKey,
			task: params.task,
			label: params.label,
			depth: currentDepth + 1,
			spawnMode,
			cleanup
		});

		// Record lifecycle event
		this.lifecycleTracker?.recordSpawned(childSessionKey, runId, {
			runId,
			childSessionKey,
			requesterSessionKey,
			task: params.task,
			label: params.label,
			depth: currentDepth + 1,
			spawnMode,
			cleanup
		});

		return {
			status: 'success',
			childSessionKey,
			runId
		};
	}

	// -------------------------------------------------------------------------
	// Depth Management
	// -------------------------------------------------------------------------

	/**
	 * Get the depth of a session in the subagent chain
	 */
	getSubagentDepth(sessionKey: string): number {
		// Check cache first
		const cached = this.sessionDepths.get(sessionKey);
		if (cached !== undefined) {
			return cached;
		}

		// Try to get from session store metadata
		const session = this.sessionStore.get(sessionKey);
		if (!session) {
			return 0;
		}

		const metadata = session.metadata as SubagentSessionMetadata | undefined;
		if (!metadata || metadata.parentSessionKey === sessionKey) {
			// Root session
			this.sessionDepths.set(sessionKey, 0);
			return 0;
		}

		// Recursively calculate depth
		const parentDepth = this.getSubagentDepth(metadata.parentSessionKey);
		const depth = parentDepth + 1;
		this.sessionDepths.set(sessionKey, depth);
		return depth;
	}

	/**
	 * Check if a subagent can be spawned
	 */
	canSpawnSubagent(requesterKey: string, maxDepth: number, maxChildren: number): boolean {
		// Check depth
		const depth = this.getSubagentDepth(requesterKey);
		if (depth >= maxDepth) {
			return false;
		}

		// Check child count
		const childCount = this.childCounts.get(requesterKey) || 0;
		return childCount < maxChildren;
	}

	// -------------------------------------------------------------------------
	// Active Subagent Tracking
	// -------------------------------------------------------------------------

	/**
	 * Get all active subagent runs
	 */
	getActiveSubagentRuns(): SubagentRunRecord[] {
		return Array.from(this.activeRuns.values()).filter(
			(run) => run.startedAt !== undefined && run.endedAt === undefined
		);
	}

	/**
	 * Get all subagent runs for a specific session
	 */
	getSubagentRunsForSession(sessionKey: string): SubagentRunRecord[] {
		return Array.from(this.activeRuns.values()).filter(
			(run) => run.requesterSessionKey === sessionKey || run.childSessionKey === sessionKey
		);
	}

	/**
	 * Get a specific run by ID
	 */
	getSubagentRun(runId: string): SubagentRunRecord | undefined {
		return this.activeRuns.get(runId);
	}

	// -------------------------------------------------------------------------
	// Lifecycle Management
	// -------------------------------------------------------------------------

	/**
	 * Mark a subagent as started
	 */
	markSubagentStarted(runId: string): void {
		const run = this.activeRuns.get(runId);
		if (run) {
			run.startedAt = Date.now();
			this.emitEvent('subagent.started', {
				runId,
				childSessionKey: run.childSessionKey,
				requesterSessionKey: run.requesterSessionKey
			});

			// Record lifecycle event
			this.lifecycleTracker?.recordRunning(run.childSessionKey, runId, {
				runId,
				childSessionKey: run.childSessionKey,
				requesterSessionKey: run.requesterSessionKey
			});
		}
	}

	/**
	 * Mark a subagent as ended
	 */
	markSubagentEnded(runId: string, outcome: SubagentRunRecord['outcome']): void {
		const run = this.activeRuns.get(runId);
		if (!run) {
			return;
		}

		run.endedAt = Date.now();
		run.outcome = outcome;

		// Decrement child count
		const currentCount = this.childCounts.get(run.requesterSessionKey) || 1;
		this.childCounts.set(run.requesterSessionKey, Math.max(0, currentCount - 1));

		// Emit end event
		this.emitEvent('subagent.ended', {
			runId,
			childSessionKey: run.childSessionKey,
			requesterSessionKey: run.requesterSessionKey,
			success: outcome?.success ?? false,
			durationMs: run.endedAt - (run.startedAt || run.createdAt)
		});

		// Record lifecycle event
		this.lifecycleTracker?.recordTerminated(run.childSessionKey, runId, {
			runId,
			childSessionKey: run.childSessionKey,
			requesterSessionKey: run.requesterSessionKey,
			success: outcome?.success ?? false,
			durationMs: run.endedAt - (run.startedAt || run.createdAt)
		});

		// Handle cleanup
		if (run.cleanup === 'delete') {
			this.cleanupSubagent(runId);
		}
	}

	// -------------------------------------------------------------------------
	// Cleanup
	// -------------------------------------------------------------------------

	/**
	 * Cleanup a subagent session
	 */
	cleanupSubagent(runId: string): void {
		const run = this.activeRuns.get(runId);
		if (!run) {
			return;
		}

		// Delete child session
		this.sessionStore.delete(run.childSessionKey);

		// Clear depth cache
		this.sessionDepths.delete(run.childSessionKey);

		// Remove from active runs
		this.activeRuns.delete(runId);

		// Emit cleanup event
		this.emitEvent('subagent.cleanup', {
			runId,
			childSessionKey: run.childSessionKey,
			requesterSessionKey: run.requesterSessionKey
		});
	}

	/**
	 * Clear all tracking state
	 */
	clear(): void {
		this.activeRuns.clear();
		this.childCounts.clear();
		this.sessionDepths.clear();
	}

	// -------------------------------------------------------------------------
	// Event Emission
	// -------------------------------------------------------------------------

	private emitEvent(type: string, data: Record<string, unknown>): void {
		this.eventBus.emit({
			runId: 'spawner',
			seq: 0,
			stream: 'lifecycle',
			ts: Date.now(),
			type,
			data
		});
	}
}

// =============================================================================
// Singleton
// =============================================================================

const SUBAGENT_SPAWNER_KEY = Symbol.for('molos.agent.subagentSpawner');

/**
 * Get the global subagent spawner singleton
 */
export function getSubagentSpawner(): SubagentSpawner {
	const globalScope = globalThis as typeof globalThis & {
		[SUBAGENT_SPAWNER_KEY]?: SubagentSpawner;
	};

	if (!globalScope[SUBAGENT_SPAWNER_KEY]) {
		throw new Error('SubagentSpawner not initialized. Call createSubagentSpawner() first.');
	}

	return globalScope[SUBAGENT_SPAWNER_KEY];
}

/**
 * Create and register a subagent spawner
 */
export function createSubagentSpawner(
	registry: ModuleRegistry,
	sessionStore: SessionStore,
	eventBus: EventBus,
	lifecycleTracker?: LifecycleTracker
): SubagentSpawner {
	const globalScope = globalThis as typeof globalThis & {
		[SUBAGENT_SPAWNER_KEY]?: SubagentSpawner;
	};

	globalScope[SUBAGENT_SPAWNER_KEY] = new SubagentSpawner(
		registry,
		sessionStore,
		eventBus,
		lifecycleTracker
	);
	return globalScope[SUBAGENT_SPAWNER_KEY];
}

/**
 * Reset the global subagent spawner singleton
 */
export function resetSubagentSpawner(): void {
	const globalScope = globalThis as typeof globalThis & {
		[SUBAGENT_SPAWNER_KEY]?: SubagentSpawner;
	};

	if (globalScope[SUBAGENT_SPAWNER_KEY]) {
		globalScope[SUBAGENT_SPAWNER_KEY].clear();
		globalScope[SUBAGENT_SPAWNER_KEY] = undefined;
	}
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate spawn parameters
 */
export function validateSpawnParams(params: Partial<SpawnParams>): string[] {
	const errors: string[] = [];

	if (!params.task || params.task.trim() === '') {
		errors.push('Task is required');
	}

	if (params.runTimeoutSeconds !== undefined && params.runTimeoutSeconds <= 0) {
		errors.push('runTimeoutSeconds must be positive');
	}

	if (params.mode && !['run', 'session'].includes(params.mode)) {
		errors.push('mode must be "run" or "session"');
	}

	if (params.cleanup && !['delete', 'keep'].includes(params.cleanup)) {
		errors.push('cleanup must be "delete" or "keep"');
	}

	if (params.sandbox && !['inherit', 'require'].includes(params.sandbox)) {
		errors.push('sandbox must be "inherit" or "require"');
	}

	if (params.attachments) {
		for (let i = 0; i < params.attachments.length; i++) {
			const attachment = params.attachments[i];
			if (!attachment) {
				errors.push(`Attachment ${i} is undefined`);
			} else {
				if (!attachment.name || attachment.name.trim() === '') {
					errors.push(`Attachment ${i} must have a name`);
				}
				if (!attachment.content) {
					errors.push(`Attachment ${i} must have content`);
				}
			}
		}
	}

	return errors;
}
