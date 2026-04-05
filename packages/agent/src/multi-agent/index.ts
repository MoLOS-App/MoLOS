/**
 * Multi-Agent Module - Subagent Coordination and Lifecycle Management
 *
 * ## Purpose
 * Provides coordination capabilities for spawning and managing subagents within
 * the MoLOS agent framework. Enables hierarchical agent structures where a parent
 * agent can delegate tasks to specialized subagents.
 *
 * ## Architecture Overview
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                         Parent Agent                             │
 * │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
 * │  │   Session   │  │   Session   │  │    Module Registry       │  │
 * │  │   Store     │  │   Store     │  │  (health, capabilities)  │  │
 * │  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
 * └─────────┼────────────────┼───────────────────────┼───────────────┘
 *           │                │                       │
 *           │   Spawn        │   Delegate            │ Register
 *           ▼                ▼                       ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    Multi-Agent Coordination                      │
 * │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
 * │  │ SubagentSpawner │  │ SubagentAnnouncer│  │ ModuleRegistry  │  │
 * │  │ - Depth limits  │  │ - Result delivery│  │ - Agent metadata│  │
 * │  │ - Child limits  │  │ - Completion wait│  │ - Health checks │  │
 * │  │ - Lifecycle     │  │ - Retry logic   │  │ - Capabilities  │  │
 * │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
 * └─────────────────────────────────────────────────────────────────┘
 *           │                │                       │
 *           ▼                ▼                       ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                      Child Subagents                             │
 * │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
 * │  │  Subagent 1 │  │  Subagent 2 │  │  Subagent 3 │            │
 * │  │  (depth=1)  │  │  (depth=1)  │  │  (depth=2)  │            │
 * │  └─────────────┘  └─────────────┘  └─────────────┘            │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Core Components
 *
 * ### ModuleRegistry (`registry.ts`)
 * - Manages registered module agents with health monitoring
 * - Provides delegation tools for parent → child communication
 * - Tracks capabilities per module (tools, concurrency, streaming)
 *
 * ### SubagentSpawner (`spawn.ts`)
 * - Creates child agent sessions with depth tracking
 * - Enforces max depth (default: 3) and max children (default: 5)
 * - Manages subagent lifecycle (spawn → started → ended → cleanup)
 *
 * ### SubagentAnnouncer (`announce.ts`)
 * - Waits for subagent completion
 * - Delivers results back to parent
 * - Handles delivery failures with retry logic
 *
 * ## Multi-Agent Communication Pattern
 *
 * 1. **Spawn**: Parent calls `spawn()` → creates child session, returns session key
 * 2. **Execute**: Child processes task, stores results in session
 * 3. **Complete**: Child marks session as completed
 * 4. **Announce**: Parent's announcer detects completion, delivers result
 *
 * ## Depth and Concurrency Limits
 *
 * | Limit          | Default | Purpose                              |
 * |----------------|---------|--------------------------------------|
 * | `maxDepth`     | 3       | Prevent infinite agent chains         |
 * | `maxChildren`  | 5       | Prevent resource exhaustion           |
 * | `timeout`      | 300s    | Prevent hanging subagents            |
 *
 * ## Cleanup Policy
 *
 * | Policy  | Behavior                                          |
 * |---------|---------------------------------------------------|
 * | `delete`| Session deleted after completion (default)         |
 * | `keep`  | Session retained for debugging/inspection         |
 *
 * ## AI Context Optimization Tips
 * 1. **Depth Limits**: Keep depth ≤ 3 to avoid context fragmentation
 * 2. **Session Binding**: Use `thread: true` for parent-child context sharing
 * 3. **Delegation Tools**: Registry's `getDelegationTools()` enables structured delegation
 * 4. **Result Caching**: Keep sessions for failed tasks to debug context issues
 * 5. **Event Monitoring**: Listen to lifecycle events for observability
 *
 * ## Legacy Exports
 * This module maintains backwards compatibility with older APIs via deprecated
 * exports. New code should use the class-based APIs directly.
 */

// =============================================================================
// Registry Exports
// =============================================================================

export {
	ModuleRegistry,
	getModuleRegistry,
	resetModuleRegistry,
	createModuleRegistry,
	type ModuleAgentConfig,
	type ModuleCapabilities,
	type ModuleHealthStatus
} from './registry.js';

// =============================================================================
// Spawn Exports
// =============================================================================

export {
	SubagentSpawner,
	getSubagentSpawner,
	createSubagentSpawner,
	resetSubagentSpawner,
	validateSpawnParams,
	type SpawnParams,
	type SpawnContext,
	type SpawnResult,
	type SubagentRunRecord
} from './spawn.js';

// =============================================================================
// Announce Exports
// =============================================================================

export {
	SubagentAnnouncer,
	createSubagentAnnouncer,
	type AnnounceParams,
	type AnnouncementResult
} from './announce.js';

// =============================================================================
// Lifecycle Exports
// =============================================================================

export {
	LifecycleTracker,
	createLifecycleTracker,
	type AgentLifecycleEvent,
	type LifecycleEventType,
	type OrphanDetectionResult
} from './lifecycle.js';

// =============================================================================
// Persistence Exports
// =============================================================================

export {
	PersistentModuleRegistry,
	PersistentLifecycleTracker,
	createPersistentModuleRegistry,
	createPersistentLifecycleTracker,
	type PersistentRegistryConfig,
	type RegistryPersistenceData,
	type LifecyclePersistenceData
} from './persistence.js';

// =============================================================================
// Legacy Exports (for backwards compatibility)
// =============================================================================

/**
 * @deprecated Use ModuleRegistry instead
 */
export interface AgentRegistry {
	register(sessionId: string, config: SpawnConfig): void;
	unregister(sessionId: string): void;
	get(sessionId: string): SpawnConfig | undefined;
	list(): SpawnConfig[];
	listByUser(userId: string): SpawnConfig[];
	getCount(): number;
	clear(): void;
}

/**
 * @deprecated Use SpawnParams instead
 */
export interface SpawnConfig {
	name: string;
	config: unknown;
	userId: string;
	parentSessionId?: string;
	metadata?: Record<string, unknown>;
}

/**
 * @deprecated Use SpawnParams instead
 */
export interface SpawnOptions {
	name: string;
	config: unknown;
	userId: string;
	parentSessionId?: string;
	metadata?: Record<string, unknown>;
}

/**
 * @deprecated Use SpawnResult instead
 */
export interface SpawnLegacyResult {
	success: boolean;
	sessionId?: string;
	error?: string;
}

/**
 * @deprecated Use ModuleHealthStatus instead
 */
export interface AgentAnnouncement {
	type: 'agent_spawned' | 'agent_terminated' | 'agent_error' | 'agent_message';
	sessionId: string;
	agentName: string;
	payload: unknown;
	timestamp: number;
}

/**
 * @deprecated Use SubagentAnnouncer instead
 */
export interface Announcer {
	announceSpawned(sessionId: string, agentName: string, metadata?: Record<string, unknown>): void;
	announceTerminated(sessionId: string, agentName: string, reason?: string): void;
	announceError(sessionId: string, agentName: string, error: Error): void;
	announceMessage(sessionId: string, agentName: string, message: unknown): void;
}

/**
 * Create an agent registry (legacy function)
 * @deprecated Use createModuleRegistry instead
 */
export function createAgentRegistry(): AgentRegistry {
	const agents: Map<string, SpawnConfig> = new Map();
	const userAgents: Map<string, Set<string>> = new Map();

	return {
		register(sessionId: string, config: SpawnConfig): void {
			agents.set(sessionId, config);

			if (!userAgents.has(config.userId)) {
				userAgents.set(config.userId, new Set());
			}
			userAgents.get(config.userId)!.add(sessionId);
		},

		unregister(sessionId: string): void {
			const config = agents.get(sessionId);
			if (config) {
				userAgents.get(config.userId)?.delete(sessionId);
				agents.delete(sessionId);
			}
		},

		get(sessionId: string): SpawnConfig | undefined {
			return agents.get(sessionId);
		},

		list(): SpawnConfig[] {
			return Array.from(agents.values());
		},

		listByUser(userId: string): SpawnConfig[] {
			const sessionIds = userAgents.get(userId);
			if (!sessionIds) return [];
			return Array.from(sessionIds)
				.map((id) => agents.get(id))
				.filter((config): config is SpawnConfig => config !== undefined);
		},

		getCount(): number {
			return agents.size;
		},

		clear(): void {
			agents.clear();
			userAgents.clear();
		}
	};
}

/**
 * Validate spawn options (legacy function)
 * @deprecated Use validateSpawnParams instead
 */
export function validateSpawnOptions(options: Partial<SpawnOptions>): string[] {
	const errors: string[] = [];

	if (!options.name || options.name.trim() === '') {
		errors.push('Agent name is required');
	}

	if (!options.userId || options.userId.trim() === '') {
		errors.push('User ID is required');
	}

	if (!options.config) {
		errors.push('Agent config is required');
	}

	return errors;
}

/**
 * Create an announcer (legacy function)
 * @deprecated Use createSubagentAnnouncer instead
 */
export function createAnnouncer(_eventBus: unknown): Announcer {
	return {
		announceSpawned(
			sessionId: string,
			agentName: string,
			_metadata?: Record<string, unknown>
		): void {
			console.log(`[announcer] Agent spawned: ${sessionId} (${agentName})`);
		},

		announceTerminated(sessionId: string, agentName: string, _reason?: string): void {
			console.log(`[announcer] Agent terminated: ${sessionId} (${agentName})`);
		},

		announceError(sessionId: string, agentName: string, error: Error): void {
			console.error(`[announcer] Agent error: ${sessionId} (${agentName})`, error);
		},

		announceMessage(sessionId: string, agentName: string, _message: unknown): void {
			console.log(`[announcer] Agent message: ${sessionId} (${agentName})`);
		}
	};
}

/**
 * Legacy spawn function
 * @deprecated Use SubagentSpawner.spawn instead
 */
export async function spawnAgent(
	options: SpawnOptions,
	_registry?: { register: (id: string, config: SpawnConfig) => void }
): Promise<SpawnLegacyResult> {
	// Generate session ID
	const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

	// Create spawn config
	const spawnConfig: SpawnConfig = {
		name: options.name,
		config: options.config,
		userId: options.userId,
		parentSessionId: options.parentSessionId,
		metadata: options.metadata
	};

	// Register if registry provided
	_registry?.register(sessionId, spawnConfig);

	// Return success with session ID
	return {
		success: true,
		sessionId
	};
}
