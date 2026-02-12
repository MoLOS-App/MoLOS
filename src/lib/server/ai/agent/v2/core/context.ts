/**
 * Agent Context - Dependency Injection Container
 *
 * Provides a container for managing dependencies and services.
 * Enables loose coupling and testability.
 */

import type { AgentConfig, AgentState, AgentTelemetry, ToolDefinition } from './types';
import type { EventBus, TypedEventEmitter } from '../events/event-bus';

/**
 * Service identifier type
 */
export type ServiceIdentifier<T = unknown> = string | symbol;

/**
 * Factory function type for creating services
 */
export type ServiceFactory<T> = (context: AgentContext) => T | Promise<T>;

/**
 * Service registration options
 */
export interface ServiceOptions {
	/** Use singleton pattern (default: true) */
	singleton?: boolean;
	/** Lazy initialize on first access (default: true) */
	lazy?: boolean;
}

/**
 * Registered service entry
 */
interface ServiceEntry {
	factory: ServiceFactory<unknown>;
	instance?: unknown;
	singleton: boolean;
	lazy: boolean;
	initialized: boolean;
}

/**
 * Agent context interface - what's available to all components
 */
export interface IAgentContext {
	/** Unique run ID */
	runId: string;
	/** Session ID */
	sessionId: string;
	/** User ID */
	userId: string;
	/** Agent configuration */
	config: AgentConfig;
	/** Event bus */
	eventBus: EventBus;
	/** Typed event emitter */
	emitter: TypedEventEmitter;

	// Service access
	/** Get a service by identifier */
	getService<T>(identifier: ServiceIdentifier<T>): T;
	/** Check if a service is registered */
	hasService(identifier: ServiceIdentifier): boolean;

	// State access
	/** Get current agent state */
	getState(): AgentState;
	/** Update agent state */
	setState(state: Partial<AgentState>): void;

	// Tool access
	/** Get available tools */
	getTools(): ToolDefinition[];
	/** Set available tools */
	setTools(tools: ToolDefinition[]): void;

	// Telemetry
	/** Get current telemetry */
	getTelemetry(): AgentTelemetry;
	/** Update telemetry */
	updateTelemetry(updates: Partial<AgentTelemetry>): void;
	/** Increment a telemetry counter */
	incrementTelemetry(key: keyof Pick<AgentTelemetry, 'llmCalls' | 'cacheHits' | 'cacheMisses' | 'errors' | 'totalSteps' | 'successfulSteps' | 'failedSteps'>, amount?: number): void;
}

/**
 * Common service identifiers
 */
export const Services = {
	// LLM Services
	LLM_PROVIDER: Symbol('LLM_PROVIDER'),
	LLM_CACHE: Symbol('LLM_CACHE'),
	CIRCUIT_BREAKER: Symbol('CIRCUIT_BREAKER'),
	FALLBACK_MANAGER: Symbol('FALLBACK_MANAGER'),

	// Tool Services
	TOOL_REGISTRY: Symbol('TOOL_REGISTRY'),
	TOOL_EXECUTOR: Symbol('TOOL_EXECUTOR'),
	TOOL_CACHE: Symbol('TOOL_CACHE'),
	RATE_LIMITER: Symbol('RATE_LIMITER'),

	// Session Services
	SESSION_MANAGER: Symbol('SESSION_MANAGER'),
	CONTEXT_COMPACTOR: Symbol('CONTEXT_COMPACTOR'),
	CONVERSATION_STORE: Symbol('CONVERSATION_STORE'),

	// Execution Services
	REACT_LOOP: Symbol('REACT_LOOP'),
	THINKING_ENGINE: Symbol('THINKING_ENGINE'),
	COMPLETION_PROMISE: Symbol('COMPLETION_PROMISE'),

	// Hook Services
	HOOK_MANAGER: Symbol('HOOK_MANAGER'),
	RULE_ENGINE: Symbol('RULE_ENGINE'),

	// Streaming Services
	BLOCK_STREAMER: Symbol('BLOCK_STREAMER'),
	CHANNEL_MANAGER: Symbol('CHANNEL_MANAGER'),

	// Error Services
	ERROR_RECOVERY: Symbol('ERROR_RECOVERY'),

	// Plugin Services
	PLUGIN_LOADER: Symbol('PLUGIN_LOADER')
} as const;

/**
 * Agent Context - DI Container and state manager
 */
export class AgentContext implements IAgentContext {
	// Core properties
	public readonly runId: string;
	public readonly sessionId: string;
	public readonly userId: string;
	public readonly config: AgentConfig;
	public readonly eventBus: EventBus;
	public readonly emitter: TypedEventEmitter;

	// Service registry
	private services: Map<ServiceIdentifier, ServiceEntry> = new Map();

	// State
	private _state: AgentState;
	private _tools: ToolDefinition[] = [];
	private _telemetry: AgentTelemetry;

	constructor(
		runId: string,
		sessionId: string,
		userId: string,
		config: AgentConfig,
		eventBus: EventBus
	) {
		this.runId = runId;
		this.sessionId = sessionId;
		this.userId = userId;
		this.config = config;
		this.eventBus = eventBus;
		this.emitter = eventBus.createEmitter(runId, sessionId);

		// Initialize state
		this._state = {
			runId,
			sessionId,
			userId,
			plan: null,
			currentIteration: 0,
			totalStepsCompleted: 0,
			lastToolSignature: null,
			messages: [],
			thoughts: [],
			observations: [],
			isComplete: false
		};

		// Initialize telemetry
		this._telemetry = {
			runId,
			startMs: Date.now(),
			durationMs: 0,
			totalSteps: 0,
			successfulSteps: 0,
			failedSteps: 0,
			tokenEstimateIn: 0,
			tokenEstimateOut: 0,
			llmCalls: 0,
			cacheHits: 0,
			cacheMisses: 0,
			errors: 0
		};
	}

	// ============================================================================
	// Service Management
	// ============================================================================

	/**
	 * Register a service factory
	 */
	register<T>(
		identifier: ServiceIdentifier<T>,
		factory: ServiceFactory<T>,
		options: ServiceOptions = {}
	): void {
		const entry: ServiceEntry = {
			factory: factory as ServiceFactory<unknown>,
			singleton: options.singleton ?? true,
			lazy: options.lazy ?? true,
			initialized: false
		};

		this.services.set(identifier, entry);

		// Eager initialization if not lazy
		if (!entry.lazy) {
			this.initializeService(identifier, entry);
		}
	}

	/**
	 * Register a service instance directly
	 */
	registerInstance<T>(identifier: ServiceIdentifier<T>, instance: T): void {
		const entry: ServiceEntry = {
			factory: () => instance,
			instance,
			singleton: true,
			lazy: false,
			initialized: true
		};

		this.services.set(identifier, entry);
	}

	/**
	 * Get a service by identifier
	 */
	getService<T>(identifier: ServiceIdentifier<T>): T {
		const entry = this.services.get(identifier);

		if (!entry) {
			throw new Error(`Service not found: ${String(identifier)}`);
		}

		// Initialize if needed
		if (!entry.initialized) {
			this.initializeService(identifier, entry);
		}

		return entry.instance as T;
	}

	/**
	 * Check if a service is registered
	 */
	hasService(identifier: ServiceIdentifier): boolean {
		return this.services.has(identifier);
	}

	/**
	 * Unregister a service
	 */
	unregister(identifier: ServiceIdentifier): boolean {
		return this.services.delete(identifier);
	}

	/**
	 * Get all registered service identifiers
	 */
	getServiceIdentifiers(): ServiceIdentifier[] {
		return Array.from(this.services.keys());
	}

	// ============================================================================
	// State Management
	// ============================================================================

	/**
	 * Get current agent state
	 */
	getState(): AgentState {
		return { ...this._state };
	}

	/**
	 * Update agent state
	 */
	setState(updates: Partial<AgentState>): void {
		this._state = {
			...this._state,
			...updates
		};
	}

	/**
	 * Get a specific state property
	 */
	getStateProperty<K extends keyof AgentState>(key: K): AgentState[K] {
		return this._state[key];
	}

	// ============================================================================
	// Tool Management
	// ============================================================================

	/**
	 * Get available tools
	 */
	getTools(): ToolDefinition[] {
		return [...this._tools];
	}

	/**
	 * Set available tools
	 */
	setTools(tools: ToolDefinition[]): void {
		this._tools = [...tools];
	}

	/**
	 * Get a specific tool by name
	 */
	getTool(name: string): ToolDefinition | undefined {
		return this._tools.find(t => t.name === name);
	}

	// ============================================================================
	// Telemetry Management
	// ============================================================================

	/**
	 * Get current telemetry
	 */
	getTelemetry(): AgentTelemetry {
		return { ...this._telemetry };
	}

	/**
	 * Update telemetry
	 */
	updateTelemetry(updates: Partial<AgentTelemetry>): void {
		this._telemetry = {
			...this._telemetry,
			...updates
		};
	}

	/**
	 * Increment a telemetry counter
	 */
	incrementTelemetry(key: keyof Pick<AgentTelemetry, 'llmCalls' | 'cacheHits' | 'cacheMisses' | 'errors' | 'totalSteps' | 'successfulSteps' | 'failedSteps'>, amount: number = 1): void {
		this._telemetry[key] += amount;
	}

	// ============================================================================
	// Message Management
	// ============================================================================

	/**
	 * Add a message to the state
	 */
	addMessage(message: AgentState['messages'][0]): void {
		this._state.messages.push(message);
	}

	/**
	 * Get messages
	 */
	getMessages(): AgentState['messages'] {
		return [...this._state.messages];
	}

	// ============================================================================
	// Utility Methods
	// ============================================================================

	/**
	 * Create a child context for sub-tasks
	 */
	createChildContext(childRunId: string): AgentContext {
		const child = new AgentContext(
			childRunId,
			this.sessionId,
			this.userId,
			this.config,
			this.eventBus
		);

		// Inherit tools
		child.setTools(this._tools);

		// Share services (but not state)
		this.services.forEach((entry, id) => {
			if (entry.singleton && entry.initialized) {
				child.registerInstance(id, entry.instance);
			} else {
				child.services.set(id, { ...entry, initialized: false, instance: undefined });
			}
		});

		return child;
	}

	/**
	 * Clone the context (for snapshots)
	 */
	clone(): AgentContext {
		const cloned = new AgentContext(
			this.runId,
			this.sessionId,
			this.userId,
			{ ...this.config },
			this.eventBus
		);

		// Deep copy state
		cloned._state = JSON.parse(JSON.stringify(this._state));
		cloned._telemetry = { ...this._telemetry };
		cloned._tools = [...this._tools];

		return cloned;
	}

	/**
	 * Clean up resources
	 */
	async dispose(): Promise<void> {
		// Dispose any services with dispose methods
		const entries = Array.from(this.services.values());
		for (const entry of entries) {
			if (entry.instance && typeof (entry.instance as any).dispose === 'function') {
				await (entry.instance as any).dispose();
			}
		}

		this.services.clear();
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private initializeService(identifier: ServiceIdentifier, entry: ServiceEntry): void {
		try {
			const instance = entry.factory(this);

			// Handle async factories
			if (instance instanceof Promise) {
				// For async factories, we need to handle this differently
				// For now, throw an error - async initialization should be done explicitly
				throw new Error(
					`Async service factory detected for ${String(identifier)}. ` +
					`Use registerAsync or initialize explicitly.`
				);
			}

			entry.instance = instance;
			entry.initialized = true;
		} catch (error) {
			console.error(`Failed to initialize service ${String(identifier)}:`, error);
			throw error;
		}
	}
}

/**
 * Context builder for easier construction
 */
export class ContextBuilder {
	private runId: string = '';
	private sessionId: string = '';
	private userId: string = '';
	private config: AgentConfig | null = null;
	private eventBus: EventBus | null = null;
	private services: Array<[ServiceIdentifier, ServiceFactory<unknown>, ServiceOptions]> = [];
	private tools: ToolDefinition[] = [];

	withRunId(runId: string): this {
		this.runId = runId;
		return this;
	}

	withSessionId(sessionId: string): this {
		this.sessionId = sessionId;
		return this;
	}

	withUserId(userId: string): this {
		this.userId = userId;
		return this;
	}

	withConfig(config: AgentConfig): this {
		this.config = config;
		return this;
	}

	withEventBus(eventBus: EventBus): this {
		this.eventBus = eventBus;
		return this;
	}

	withService<T>(
		identifier: ServiceIdentifier<T>,
		factory: ServiceFactory<T>,
		options?: ServiceOptions
	): this {
		this.services.push([identifier, factory as ServiceFactory<unknown>, options ?? {}]);
		return this;
	}

	withTools(tools: ToolDefinition[]): this {
		this.tools = tools;
		return this;
	}

	build(): AgentContext {
		if (!this.config) {
			throw new Error('Config is required');
		}

		if (!this.eventBus) {
			throw new Error('EventBus is required');
		}

		const context = new AgentContext(
			this.runId || `run_${Date.now()}`,
			this.sessionId || `session_${Date.now()}`,
			this.userId,
			this.config,
			this.eventBus
		);

		// Register services
		for (const [id, factory, options] of this.services) {
			context.register(id, factory, options);
		}

		// Set tools
		if (this.tools.length > 0) {
			context.setTools(this.tools);
		}

		return context;
	}
}

/**
 * Create a new context builder
 */
export function createContext(): ContextBuilder {
	return new ContextBuilder();
}
