/**
 * Persistence - Disk Persistence for Module Registry and Lifecycle
 *
 * ## Purpose
 * Provides optional disk persistence for the module registry and lifecycle tracker,
 * enabling crash recovery. Persistence is NOT required for in-memory operation.
 *
 * ## Persistence Features
 *
 * | Feature               | Description                                      |
 * |-----------------------|--------------------------------------------------|
 * | JSON file storage     | Human-readable format for debugging              |
 * | Dirty marking          | Only persist when state changes                 |
 * | Atomic writes          | Temp file + rename for crash safety              |
 * | Lazy persistence       | Only persist when explicitly called or shutdown  |
 *
 * ## Usage
 *
 * ```typescript
 * // Without persistence (in-memory only)
 * const registry = new ModuleRegistry();
 *
 * // With persistence
 * const registry = createPersistentModuleRegistry(new ModuleRegistry(), {
 *   filePath: './data/registry.json'
 * });
 *
 * // State is only persisted when markDirty() is called
 * registry.register(config);
 * registry.markDirty();
 * await registry.persist();
 * ```
 *
 * ## Crash Recovery
 *
 * On startup, you can restore previous state:
 *
 * ```typescript
 * const registry = createPersistentModuleRegistry(new ModuleRegistry(), { filePath });
 * await registry.restore();
 * ```
 *
 * ## File Format
 *
 * ```json
 * {
 *   "version": 1,
 *   "timestamp": 1699999999999,
 *   "agents": [...],
 *   "healthStatuses": {...}
 * }
 * ```
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ModuleRegistry } from './registry.js';
import type { LifecycleTracker } from './lifecycle.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for persistent registry
 */
export interface PersistentRegistryConfig {
	/** Path to the persistence file */
	filePath: string;
	/** Directory for temporary files (default: same as filePath) */
	tmpDir?: string;
	/** File mode for created files (default: 0o600) */
	fileMode?: number;
}

/**
 * Data structure for registry persistence
 */
export interface RegistryPersistenceData {
	/** Schema version */
	version: number;
	/** Last persisted timestamp */
	timestamp: number;
	/** Registered agent configs */
	agents: Array<{
		id: string;
		name: string;
		description: string;
		baseUrl: string;
		apiKey?: string;
		capabilities?: Record<string, unknown>;
		healthCheckIntervalMs?: number;
	}>;
	/** Health statuses */
	healthStatuses: Record<
		string,
		{
			moduleId: string;
			healthy: boolean;
			error?: string;
			lastChecked: number;
			latencyMs?: number;
		}
	>;
}

/**
 * Data structure for lifecycle persistence
 */
export interface LifecyclePersistenceData {
	/** Schema version */
	version: number;
	/** Last persisted timestamp */
	timestamp: number;
	/** Lifecycle events per agent */
	events: Record<
		string,
		Array<{
			type: string;
			sessionId: string;
			agentId: string;
			timestamp: number;
			metadata?: Record<string, unknown>;
		}>
	>;
	/** Known orphan agent IDs */
	orphans: string[];
}

// =============================================================================
// Persistent Module Registry
// =============================================================================

/**
 * ModuleRegistry with optional disk persistence
 *
 * This class wraps a ModuleRegistry instance with persistence capabilities.
 * It works perfectly fine WITHOUT disk persistence - just don't call
 * persist() or restore().
 */
export class PersistentModuleRegistry {
	private registry: ModuleRegistry;
	private config: PersistentRegistryConfig;
	private dirty = false;

	/**
	 * @deprecated Use createPersistentModuleRegistry factory instead
	 */
	constructor(registry: ModuleRegistry, config: PersistentRegistryConfig) {
		this.registry = registry;
		this.config = {
			fileMode: 0o600,
			...config
		};
	}

	/**
	 * Get the underlying registry
	 */
	getRegistry(): ModuleRegistry {
		return this.registry;
	}

	/**
	 * Get the persistence file path
	 */
	getFilePath(): string {
		return this.config.filePath;
	}

	/**
	 * Mark state as dirty (needs persistence)
	 */
	markDirty(): void {
		this.dirty = true;
	}

	/**
	 * Check if state needs persistence
	 */
	isDirty(): boolean {
		return this.dirty;
	}

	/**
	 * Persist current state to disk
	 */
	async persist(): Promise<void> {
		if (!this.dirty) return;

		const data: RegistryPersistenceData = {
			version: 1,
			timestamp: Date.now(),
			agents: this.registry.getAll().map((a) => ({
				id: a.id,
				name: a.name,
				description: a.description,
				baseUrl: a.baseUrl,
				apiKey: a.apiKey,
				capabilities: a.capabilities as Record<string, unknown> | undefined,
				healthCheckIntervalMs: a.healthCheckIntervalMs
			})),
			healthStatuses: Object.fromEntries(this.registry.getAllHealthStatuses())
		};

		// Ensure directory exists
		const dir = path.dirname(this.config.filePath);
		await fs.mkdir(dir, { recursive: true });

		// Write to temp file first, then rename (atomic)
		const tmpPath = `${this.config.filePath}.tmp`;
		await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), {
			mode: this.config.fileMode
		});

		await fs.rename(tmpPath, this.config.filePath);
		this.dirty = false;
	}

	/**
	 * Restore state from disk
	 */
	async restore(): Promise<void> {
		try {
			const content = await fs.readFile(this.config.filePath, 'utf-8');
			const data: RegistryPersistenceData = JSON.parse(content);

			if (data.version !== 1) {
				console.warn(`Unknown persistence version: ${data.version}`);
				return;
			}

			// Restore agents
			for (const agent of data.agents) {
				this.registry.register({
					id: agent.id,
					name: agent.name,
					description: agent.description,
					baseUrl: agent.baseUrl,
					apiKey: agent.apiKey,
					capabilities: agent.capabilities as Record<string, unknown> | undefined,
					healthCheckIntervalMs: agent.healthCheckIntervalMs
				});
			}

			this.dirty = false;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				// File doesn't exist, that's OK
				return;
			}
			throw error;
		}
	}

	/**
	 * Clear all data
	 */
	clear(): void {
		this.registry.clear();
		this.dirty = true;
	}

	// =============================================================================
	// Delegated ModuleRegistry Methods
	// =============================================================================

	/**
	 * Register a new module agent
	 */
	register(config: {
		id: string;
		name: string;
		description: string;
		baseUrl: string;
		apiKey?: string;
		capabilities?: Record<string, unknown>;
		healthCheckIntervalMs?: number;
	}): void {
		this.registry.register(config as Parameters<typeof this.registry.register>[0]);
		this.markDirty();
	}

	/**
	 * Unregister a module agent
	 */
	unregister(moduleId: string): boolean {
		const result = this.registry.unregister(moduleId);
		if (result) this.markDirty();
		return result;
	}

	/**
	 * Get a module agent config by ID
	 */
	get(moduleId: string) {
		return this.registry.get(moduleId);
	}

	/**
	 * Get all registered module agents
	 */
	getAll() {
		return this.registry.getAll();
	}

	/**
	 * Check if a module is registered
	 */
	has(moduleId: string): boolean {
		return this.registry.has(moduleId);
	}

	/**
	 * Get the number of registered modules
	 */
	get size(): number {
		return this.registry.size;
	}

	/**
	 * Check health of a specific module
	 */
	async checkHealth(moduleId: string) {
		return this.registry.checkHealth(moduleId);
	}

	/**
	 * Check health of all registered modules
	 */
	async checkAllHealth() {
		return this.registry.checkAllHealth();
	}

	/**
	 * Get health status for a module (cached)
	 */
	getHealthStatus(moduleId: string) {
		return this.registry.getHealthStatus(moduleId);
	}

	/**
	 * Get all health statuses (cached)
	 */
	getAllHealthStatuses() {
		return this.registry.getAllHealthStatuses();
	}

	/**
	 * Get tool definitions for delegating to module agents
	 */
	getDelegationTools() {
		return this.registry.getDelegationTools();
	}

	/**
	 * Get a description of all registered modules for context
	 */
	getModuleDescriptions() {
		return this.registry.getModuleDescriptions();
	}

	/**
	 * Load multiple module agent configs at once
	 */
	loadFromConfig(configs: Parameters<typeof this.registry.loadFromConfig>[0]): void {
		this.registry.loadFromConfig(configs);
		this.markDirty();
	}
}

// =============================================================================
// Persistent Lifecycle Tracker
// =============================================================================

/**
 * LifecycleTracker with optional disk persistence
 */
export class PersistentLifecycleTracker {
	private tracker: LifecycleTracker;
	private config: PersistentRegistryConfig;
	private dirty = false;

	/**
	 * @deprecated Use createPersistentLifecycleTracker factory instead
	 */
	constructor(tracker: LifecycleTracker, config: PersistentRegistryConfig) {
		this.tracker = tracker;
		this.config = {
			fileMode: 0o600,
			...config
		};
	}

	/**
	 * Get the underlying tracker
	 */
	getTracker(): LifecycleTracker {
		return this.tracker;
	}

	/**
	 * Get the persistence file path
	 */
	getFilePath(): string {
		return this.config.filePath;
	}

	/**
	 * Mark state as dirty (needs persistence)
	 */
	markDirty(): void {
		this.dirty = true;
	}

	/**
	 * Check if state needs persistence
	 */
	isDirty(): boolean {
		return this.dirty;
	}

	/**
	 * Persist current state to disk
	 */
	async persist(): Promise<void> {
		if (!this.dirty) return;

		const events: Record<
			string,
			Array<{
				type: string;
				sessionId: string;
				agentId: string;
				timestamp: number;
				metadata?: Record<string, unknown>;
			}>
		> = {};

		for (const agentId of this.tracker.getTrackedAgents()) {
			events[agentId] = this.tracker.getHistory(agentId);
		}

		const data: LifecyclePersistenceData = {
			version: 1,
			timestamp: Date.now(),
			events,
			orphans: Array.from((this.tracker as unknown as { orphans: Set<string> }).orphans || [])
		};

		// Ensure directory exists
		const dir = path.dirname(this.config.filePath);
		await fs.mkdir(dir, { recursive: true });

		// Write to temp file first, then rename (atomic)
		const tmpPath = `${this.config.filePath}.tmp`;
		await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), {
			mode: this.config.fileMode
		});

		await fs.rename(tmpPath, this.config.filePath);
		this.dirty = false;
	}

	/**
	 * Restore state from disk
	 */
	async restore(): Promise<void> {
		try {
			const content = await fs.readFile(this.config.filePath, 'utf-8');
			const data: LifecyclePersistenceData = JSON.parse(content);

			if (data.version !== 1) {
				console.warn(`Unknown persistence version: ${data.version}`);
				return;
			}

			// Restore events
			for (const [agentId, events] of Object.entries(data.events)) {
				for (const event of events) {
					this.tracker.record({
						type: event.type as Parameters<typeof this.tracker.record>[0]['type'],
						sessionId: event.sessionId,
						agentId: event.agentId,
						timestamp: event.timestamp,
						metadata: event.metadata
					});
				}
			}

			this.dirty = false;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				// File doesn't exist, that's OK
				return;
			}
			throw error;
		}
	}

	/**
	 * Record a lifecycle event
	 */
	record(event: Parameters<typeof this.tracker.record>[0]): void {
		this.tracker.record(event);
		this.markDirty();
	}

	/**
	 * Record a spawned event
	 */
	recordSpawned(sessionId: string, agentId: string, metadata?: Record<string, unknown>): void {
		this.tracker.recordSpawned(sessionId, agentId, metadata);
		this.markDirty();
	}

	/**
	 * Record a running event
	 */
	recordRunning(sessionId: string, agentId: string, metadata?: Record<string, unknown>): void {
		this.tracker.recordRunning(sessionId, agentId, metadata);
		this.markDirty();
	}

	/**
	 * Record an idle event
	 */
	recordIdle(sessionId: string, agentId: string, metadata?: Record<string, unknown>): void {
		this.tracker.recordIdle(sessionId, agentId, metadata);
		this.markDirty();
	}

	/**
	 * Record a terminated event
	 */
	recordTerminated(sessionId: string, agentId: string, metadata?: Record<string, unknown>): void {
		this.tracker.recordTerminated(sessionId, agentId, metadata);
		this.markDirty();
	}

	/**
	 * Get agents that are considered orphans
	 */
	getOrphans(timeoutMs: number): string[] {
		return this.tracker.getOrphans(timeoutMs);
	}

	/**
	 * Get detailed orphan detection results
	 */
	getOrphanDetails(timeoutMs: number) {
		return this.tracker.getOrphanDetails(timeoutMs);
	}

	/**
	 * Get the lifecycle history for an agent
	 */
	getHistory(agentId: string) {
		return this.tracker.getHistory(agentId);
	}

	/**
	 * Get the last event for an agent
	 */
	getLastEvent(agentId: string) {
		return this.tracker.getLastEvent(agentId);
	}

	/**
	 * Get the current state of an agent
	 */
	getState(agentId: string) {
		return this.tracker.getState(agentId);
	}

	/**
	 * Check if an agent is an orphan
	 */
	isOrphan(agentId: string): boolean {
		return this.tracker.isOrphan(agentId);
	}

	/**
	 * Cleanup and mark orphans
	 */
	cleanup(timeoutMs: number): string[] {
		const result = this.tracker.cleanup(timeoutMs);
		this.markDirty();
		return result;
	}

	/**
	 * Start automatic orphan sweeping
	 */
	startSweeper(timeoutMs: number, intervalMs: number): void {
		this.tracker.startSweeper(timeoutMs, intervalMs);
	}

	/**
	 * Stop automatic orphan sweeping
	 */
	stopSweeper(): void {
		this.tracker.stopSweeper();
	}

	/**
	 * Clear all tracked events
	 */
	clear(): void {
		this.tracker.clear();
		this.markDirty();
	}

	/**
	 * Clear events for a specific agent
	 */
	clearAgent(agentId: string): void {
		this.tracker.clearAgent(agentId);
		this.markDirty();
	}

	/**
	 * Get count of tracked agents
	 */
	get trackedCount(): number {
		return this.tracker.trackedCount;
	}

	/**
	 * Get count of current orphans
	 */
	get orphanCount(): number {
		return this.tracker.orphanCount;
	}

	/**
	 * Get all tracked agent IDs
	 */
	getTrackedAgents(): string[] {
		return this.tracker.getTrackedAgents();
	}
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a persistent module registry wrapper
 */
export function createPersistentModuleRegistry(
	registry: ModuleRegistry,
	config: PersistentRegistryConfig
): PersistentModuleRegistry {
	return new PersistentModuleRegistry(registry, config);
}

/**
 * Create a persistent lifecycle tracker wrapper
 */
export function createPersistentLifecycleTracker(
	tracker: LifecycleTracker,
	config: PersistentRegistryConfig
): PersistentLifecycleTracker {
	return new PersistentLifecycleTracker(tracker, config);
}
