/**
 * Module Registry - Agent Registration and Health Management
 *
 * ## Purpose
 * Central registry for managing module agents in a multi-agent architecture.
 * Tracks agent health, capabilities, and provides delegation tools that enable
 * parent agents to delegate tasks to specialized child agents.
 *
 * ## Agent Registration Pattern
 *
 * ```
 * Module Agent                  Module Registry
 *      │                              │
 *      │──── register(config) ──────►│
 *      │                              │
 *      │                              │─── Store config
 *      │                              │─── Init health status (unhealthy)
 *      │                              │─── Start health check timer
 *      │◄─── module.registered event ─│
 *      │                              │
 *      │──── checkHealth() ──────────►│
 *      │◄─── health status ──────────│
 * ```
 *
 * ## Health Check System
 *
 * ```
 * Health Check Timer (per module, configurable interval)
 *      │
 *      ▼
 * HTTP GET {baseUrl}/health
 *      │
 *      ├─[200 OK]──► Mark healthy, record latency
 *      │
 *      └─[Error]──► Mark unhealthy, record error
 * ```
 *
 * ## Capabilities Tracking
 *
 * Each registered module advertises its capabilities:
 * ```typescript
 * interface ModuleCapabilities {
 *   tools?: string[];           // Available tools
 *   maxConcurrent?: number;    // Max parallel requests
 *   supportsStreaming?: boolean; // Can stream responses
 * }
 * ```
 *
 * ## Delegation Tools
 *
 * The registry generates delegation tools for each registered module:
 * ```typescript
 * // Tool for delegating to a module
 * {
 *   name: "delegate_to_{moduleId}",
 *   description: "Delegate task to module agent: {name}. {description}",
 *   parameters: {
 *     task: "string",           // Task description
 *     timeout_seconds: "number", // Max wait time
 *     wait_for_completion: "boolean" // Sync vs async
 *   }
 * }
 * ```
 *
 * ## Agent Discovery
 *
 * | Method                    | Returns                              |
 * |---------------------------|--------------------------------------|
 * | `get(moduleId)`           | Single agent config                  |
 * | `getAll()`                | All registered agents                |
 * | `has(moduleId)`           | Boolean (is registered)              |
 * | `getModuleDescriptions()` | Human-readable capability summary   |
 * | `getDelegationTools()`    | Tool definitions for delegation     |
 *
 * ## Health Monitoring
 *
 * | Feature                      | Description                           |
 * |------------------------------|---------------------------------------|
 * | Periodic health checks        | Configurable interval (default: 30s)  |
 * | Timeout per check            | 5 second timeout                      |
 * | Cached status                | Last known status (not real-time)    |
 * | Latency tracking             | Records response time per check       |
 *
 * ## AI Context Optimization Tips
 * 1. **Delegation Tools**: Use `getDelegationTools()` to give parent agents
 *    structured ways to delegate (better than raw tool calls)
 * 2. **Capability Context**: Include module descriptions in parent context so it
 *    knows what subagents are available
 * 3. **Health Caching**: Don't check health on every request - use cached status
 * 4. **Tool Filtering**: Filter delegation tools by capability before showing to agent
 * 5. **Module Descriptions**: Include in system prompt for agent awareness
 *
 * ## Singleton Pattern
 * Uses global symbol for singleton instance:
 * ```typescript
 * const registry = getModuleRegistry();  // Gets or creates
 * resetModuleRegistry();                  // Clears and resets
 * ```
 *
 * @example
 * const registry = getModuleRegistry();
 *
 * // Register a module
 * registry.register({
 *   id: 'tasks-agent',
 *   name: 'Tasks Agent',
 *   description: 'Handles task management',
 *   baseUrl: 'http://localhost:3001',
 *   capabilities: {
 *     tools: ['createTask', 'updateTask', 'deleteTask'],
 *     maxConcurrent: 3,
 *     supportsStreaming: true
 *   }
 * });
 *
 * // Get delegation tools for parent agent
 * const tools = registry.getDelegationTools();
 *
 * @example
 * // Health monitoring
 * const status = await registry.checkHealth('tasks-agent');
 * if (!status.healthy) {
 *   console.log(`Agent unhealthy: ${status.error}`);
 * }
 */

import type { ToolDefinition } from '../types/index.js';
import type { SessionStore } from '../core/session.js';
import type { EventBus } from '../events/event-bus.js';
import { MULTI_AGENT } from '../constants.js';
import type { LifecycleTracker } from './lifecycle.js';
import { createLifecycleTracker } from './lifecycle.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for a module agent
 */
export interface ModuleAgentConfig {
	id: string;
	name: string;
	description: string;
	baseUrl: string;
	apiKey?: string;
	capabilities?: ModuleCapabilities;
	healthCheckIntervalMs?: number;
}

/**
 * Capabilities of a module agent
 */
export interface ModuleCapabilities {
	tools?: string[];
	maxConcurrent?: number;
	supportsStreaming?: boolean;
}

/**
 * Health status for a module agent
 */
export interface ModuleHealthStatus {
	moduleId: string;
	healthy: boolean;
	error?: string;
	lastChecked: number;
	latencyMs?: number;
}

// =============================================================================
// Constants
// =============================================================================

// Now imported from '../constants.js':
// - MULTI_AGENT.HEALTH_CHECK_INTERVAL_MS
// - MULTI_AGENT.HEALTH_CHECK_TIMEOUT_MS

// =============================================================================
// Module Registry
// =============================================================================

/**
 * Registry for managing module agents
 */
export class ModuleRegistry {
	private agents: Map<string, ModuleAgentConfig> = new Map();
	private healthStatus: Map<string, ModuleHealthStatus> = new Map();
	private healthCheckTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
	private eventBus?: EventBus;
	private lifecycleTracker?: LifecycleTracker;

	constructor(eventBus?: EventBus, lifecycleTracker?: LifecycleTracker) {
		this.eventBus = eventBus;
		this.lifecycleTracker = lifecycleTracker;
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
	// Registration
	// -------------------------------------------------------------------------

	/**
	 * Register a new module agent
	 */
	register(config: ModuleAgentConfig): void {
		if (!config.id) {
			throw new Error('Module agent config must have an id');
		}

		this.agents.set(config.id, { ...config });

		// Initialize health status
		this.healthStatus.set(config.id, {
			moduleId: config.id,
			healthy: false,
			lastChecked: 0
		});

		// Start health check if interval is configured
		if (config.healthCheckIntervalMs) {
			this.startHealthCheck(config.id, config.healthCheckIntervalMs);
		}

		// Emit registration event
		this.emitEvent('module.registered', { moduleId: config.id, name: config.name });
	}

	/**
	 * Unregister a module agent
	 */
	unregister(moduleId: string): boolean {
		const config = this.agents.get(moduleId);
		if (!config) {
			return false;
		}

		// Stop health check
		this.stopHealthCheck(moduleId);

		// Remove from maps
		this.agents.delete(moduleId);
		this.healthStatus.delete(moduleId);

		// Emit unregistration event
		this.emitEvent('module.unregistered', { moduleId, name: config.name });

		return true;
	}

	// -------------------------------------------------------------------------
	// Retrieval
	// -------------------------------------------------------------------------

	/**
	 * Get a module agent config by ID
	 */
	get(moduleId: string): ModuleAgentConfig | undefined {
		return this.agents.get(moduleId);
	}

	/**
	 * Get all registered module agents
	 */
	getAll(): ModuleAgentConfig[] {
		return Array.from(this.agents.values());
	}

	/**
	 * Check if a module is registered
	 */
	has(moduleId: string): boolean {
		return this.agents.has(moduleId);
	}

	/**
	 * Get the number of registered modules
	 */
	get size(): number {
		return this.agents.size;
	}

	// -------------------------------------------------------------------------
	// Health Management
	// -------------------------------------------------------------------------

	/**
	 * Check health of a specific module
	 */
	async checkHealth(moduleId: string): Promise<ModuleHealthStatus> {
		const config = this.agents.get(moduleId);
		if (!config) {
			const status: ModuleHealthStatus = {
				moduleId,
				healthy: false,
				error: 'Module not found',
				lastChecked: Date.now()
			};
			this.healthStatus.set(moduleId, status);
			return status;
		}

		const startTime = Date.now();

		try {
			// Perform health check (HTTP GET to baseUrl/health or similar)
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), MULTI_AGENT.HEALTH_CHECK_TIMEOUT_MS);

			const response = await fetch(`${config.baseUrl}/health`, {
				method: 'GET',
				headers: {
					...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
				},
				signal: controller.signal
			});

			clearTimeout(timeout);

			const latencyMs = Date.now() - startTime;

			if (!response.ok) {
				const status: ModuleHealthStatus = {
					moduleId,
					healthy: false,
					error: `Health check failed: ${response.status} ${response.statusText}`,
					lastChecked: Date.now(),
					latencyMs
				};
				this.healthStatus.set(moduleId, status);
				return status;
			}

			const status: ModuleHealthStatus = {
				moduleId,
				healthy: true,
				lastChecked: Date.now(),
				latencyMs
			};
			this.healthStatus.set(moduleId, status);
			return status;
		} catch (error) {
			const latencyMs = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			const status: ModuleHealthStatus = {
				moduleId,
				healthy: false,
				error: errorMessage,
				lastChecked: Date.now(),
				latencyMs
			};
			this.healthStatus.set(moduleId, status);
			return status;
		}
	}

	/**
	 * Check health of all registered modules
	 */
	async checkAllHealth(): Promise<Map<string, ModuleHealthStatus>> {
		const results = new Map<string, ModuleHealthStatus>();
		const promises: Promise<void>[] = [];

		for (const moduleId of this.agents.keys()) {
			promises.push(
				this.checkHealth(moduleId).then((status) => {
					results.set(moduleId, status);
				})
			);
		}

		await Promise.all(promises);
		return results;
	}

	/**
	 * Get health status for a module (cached)
	 */
	getHealthStatus(moduleId: string): ModuleHealthStatus | undefined {
		return this.healthStatus.get(moduleId);
	}

	/**
	 * Get all health statuses (cached)
	 */
	getAllHealthStatuses(): Map<string, ModuleHealthStatus> {
		return new Map(this.healthStatus);
	}

	// -------------------------------------------------------------------------
	// Health Check Scheduling
	// -------------------------------------------------------------------------

	/**
	 * Start periodic health check for a module
	 */
	private startHealthCheck(moduleId: string, intervalMs: number): void {
		// Stop any existing health check
		this.stopHealthCheck(moduleId);

		// Perform immediate health check
		this.checkHealth(moduleId).catch(() => {
			// Ignore errors in initial check
		});

		// Schedule periodic checks
		const timer = setInterval(() => {
			this.checkHealth(moduleId).catch(() => {
				// Ignore errors in periodic checks
			});
		}, intervalMs);

		this.healthCheckTimers.set(moduleId, timer);
	}

	/**
	 * Stop periodic health check for a module
	 */
	private stopHealthCheck(moduleId: string): void {
		const timer = this.healthCheckTimers.get(moduleId);
		if (timer) {
			clearInterval(timer);
			this.healthCheckTimers.delete(moduleId);
		}
	}

	// -------------------------------------------------------------------------
	// Tools
	// -------------------------------------------------------------------------

	/**
	 * Get tool definitions for delegating to module agents
	 */
	getDelegationTools(): ToolDefinition[] {
		const tools: ToolDefinition[] = [];

		for (const config of this.agents.values()) {
			tools.push({
				name: `delegate_to_${config.id}`,
				description: `Delegate task to module agent: ${config.name}. ${config.description}`,
				parameters: {
					type: 'object',
					properties: {
						task: {
							type: 'string',
							description: 'The task to delegate to the module agent'
						},
						timeout_seconds: {
							type: 'number',
							description: 'Maximum time to wait for result (default: 300)'
						},
						wait_for_completion: {
							type: 'boolean',
							description: 'Whether to wait for completion or return immediately (default: true)'
						}
					},
					required: ['task']
				}
			});
		}

		return tools;
	}

	/**
	 * Get a description of all registered modules for context
	 */
	getModuleDescriptions(): string {
		if (this.agents.size === 0) {
			return 'No module agents are currently registered.';
		}

		const descriptions: string[] = ['Available module agents:'];

		for (const config of this.agents.values()) {
			const caps = config.capabilities;
			let capStr = '';

			if (caps) {
				const parts: string[] = [];
				if (caps.tools && caps.tools.length > 0) {
					parts.push(`tools: ${caps.tools.join(', ')}`);
				}
				if (caps.maxConcurrent) {
					parts.push(`max ${caps.maxConcurrent} concurrent`);
				}
				if (caps.supportsStreaming) {
					parts.push('supports streaming');
				}
				if (parts.length > 0) {
					capStr = ` (${parts.join(', ')})`;
				}
			}

			descriptions.push(`- ${config.name}: ${config.description}${capStr}`);
		}

		return descriptions.join('\n');
	}

	// -------------------------------------------------------------------------
	// Configuration
	// -------------------------------------------------------------------------

	/**
	 * Load multiple module agent configs at once
	 */
	loadFromConfig(configs: ModuleAgentConfig[]): void {
		for (const config of configs) {
			this.register(config);
		}
	}

	/**
	 * Clear all registrations and stop all health checks
	 */
	clear(): void {
		// Stop all health check timers
		for (const timer of this.healthCheckTimers.values()) {
			clearInterval(timer);
		}
		this.healthCheckTimers.clear();

		// Clear all maps
		this.agents.clear();
		this.healthStatus.clear();

		// Emit clear event
		this.emitEvent('module.cleared', {});
	}

	// -------------------------------------------------------------------------
	// Event Emission
	// -------------------------------------------------------------------------

	private emitEvent(type: string, data: Record<string, unknown>): void {
		if (this.eventBus) {
			this.eventBus.emit({
				runId: 'registry',
				seq: 0,
				stream: 'lifecycle',
				ts: Date.now(),
				type,
				data
			});
		}
	}
}

// =============================================================================
// Singleton
// =============================================================================

const MODULE_REGISTRY_KEY = Symbol.for('molos.agent.moduleRegistry');

/**
 * Get the global module registry singleton
 */
export function getModuleRegistry(): ModuleRegistry {
	const globalScope = globalThis as typeof globalThis & {
		[MODULE_REGISTRY_KEY]?: ModuleRegistry;
	};

	if (!globalScope[MODULE_REGISTRY_KEY]) {
		globalScope[MODULE_REGISTRY_KEY] = new ModuleRegistry();
	}

	return globalScope[MODULE_REGISTRY_KEY];
}

/**
 * Reset the global module registry singleton
 */
export function resetModuleRegistry(): void {
	const globalScope = globalThis as typeof globalThis & {
		[MODULE_REGISTRY_KEY]?: ModuleRegistry;
	};

	if (globalScope[MODULE_REGISTRY_KEY]) {
		globalScope[MODULE_REGISTRY_KEY].clear();
		globalScope[MODULE_REGISTRY_KEY] = undefined;
	}
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Factory function for creating module registry with optional event bus and lifecycle tracker
 */
export function createModuleRegistry(
	eventBus?: EventBus,
	lifecycleTracker?: LifecycleTracker
): ModuleRegistry {
	// Create a lifecycle tracker if not provided but we have an event bus
	const tracker = lifecycleTracker || (eventBus ? createLifecycleTracker(eventBus) : undefined);
	return new ModuleRegistry(eventBus, tracker);
}
