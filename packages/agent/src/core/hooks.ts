/**
 * Hook Manager - Manages hooks for agent lifecycle events
 *
 * Based on patterns from picoclaw/pkg/agent/hooks.go
 */

import type { AgentMessage, ToolResult } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Hook event types
 */
export type HookEvent =
	| 'onTurnStart'
	| 'onTurnEnd'
	| 'onSubTurnStart'
	| 'onSubTurnEnd'
	| 'onToolCall'
	| 'onToolResult'
	| 'onError'
	| 'onProviderSwitch'
	| 'onRateLimit'
	| 'onSessionStart'
	| 'onSessionEnd'
	| 'onMessage';

/**
 * Hook handler function
 */
export type HookHandler<T = unknown> = (
	event: HookEvent,
	data: T,
	context: HookContext
) => void | Promise<void>;

/**
 * Hook registration
 */
export interface Hook {
	id: string;
	name: string;
	event: HookEvent;
	handler: HookHandler;
	priority: number;
	enabled: boolean;
}

/**
 * Context passed to hook handlers
 */
export interface HookContext {
	sessionId: string;
	turnId: string;
	subTurnId?: string;
	userId: string;
	timestamp: number;
	metadata?: Record<string, unknown>;
}

// =============================================================================
// Hook Manager
// =============================================================================

/**
 * HookManager handles registration and dispatching of lifecycle hooks
 */
export class HookManager {
	private hooks: Map<HookEvent, Hook[]> = new Map();
	private nextId = 1;

	constructor() {
		// Initialize hook arrays for each event type
		const events: HookEvent[] = [
			'onTurnStart',
			'onTurnEnd',
			'onSubTurnStart',
			'onSubTurnEnd',
			'onToolCall',
			'onToolResult',
			'onError',
			'onProviderSwitch',
			'onRateLimit',
			'onSessionStart',
			'onSessionEnd',
			'onMessage'
		];
		for (const event of events) {
			this.hooks.set(event, []);
		}
	}

	/**
	 * Register a hook
	 */
	register(hook: Omit<Hook, 'id'>): () => void {
		const id = `hook_${this.nextId++}`;
		const fullHook: Hook = { ...hook, id };

		const eventHooks = this.hooks.get(hook.event) ?? [];
		eventHooks.push(fullHook);
		eventHooks.sort((a, b) => b.priority - a.priority);
		this.hooks.set(hook.event, eventHooks);

		// Return unregister function
		return () => this.unregister(id);
	}

	/**
	 * Unregister a hook by ID
	 */
	unregister(id: string): boolean {
		for (const [event, eventHooks] of this.hooks) {
			const index = eventHooks.findIndex((h) => h.id === id);
			if (index !== -1) {
				eventHooks.splice(index, 1);
				return true;
			}
		}
		return false;
	}

	/**
	 * Unregister all hooks for an event
	 */
	unregisterAll(event: HookEvent): void {
		const eventHooks = this.hooks.get(event);
		if (eventHooks) {
			eventHooks.length = 0;
		}
	}

	/**
	 * Check if a hook exists
	 */
	has(event: HookEvent): boolean {
		const eventHooks = this.hooks.get(event);
		return eventHooks !== undefined && eventHooks.length > 0;
	}

	/**
	 * Get all registered hooks
	 */
	getHooks(event?: HookEvent): Hook[] {
		if (event) {
			return this.hooks.get(event) ?? [];
		}
		const all: Hook[] = [];
		for (const hooks of this.hooks.values()) {
			all.push(...hooks);
		}
		return all;
	}

	/**
	 * Emit an event to all registered hooks
	 */
	async emit<T>(event: HookEvent, data: T, context: HookContext): Promise<void> {
		const eventHooks = this.hooks.get(event) ?? [];

		for (const hook of eventHooks) {
			if (!hook.enabled) {
				continue;
			}

			try {
				await hook.handler(event, data, context);
			} catch (error) {
				console.error(`Hook error [${hook.name}]:`, error);
			}
		}
	}

	/**
	 * Create a hook context
	 */
	createContext(params: {
		sessionId: string;
		turnId: string;
		subTurnId?: string;
		userId?: string;
		metadata?: Record<string, unknown>;
	}): HookContext {
		return {
			sessionId: params.sessionId,
			turnId: params.turnId,
			subTurnId: params.subTurnId,
			userId: params.userId ?? 'unknown',
			timestamp: Date.now(),
			metadata: params.metadata
		};
	}

	/**
	 * Clear all hooks
	 */
	clear(): void {
		for (const eventHooks of this.hooks.values()) {
			eventHooks.length = 0;
		}
	}
}

// =============================================================================
// Convenience Methods
// =============================================================================

/**
 * Create a turn start hook
 */
export function onTurnStart(
	handler: (data: { turnId: string; input: string }, context: HookContext) => void | Promise<void>,
	priority = 0
): Omit<Hook, 'id'> {
	return {
		name: 'onTurnStart',
		event: 'onTurnStart',
		handler: handler as unknown as HookHandler,
		priority,
		enabled: true
	};
}

/**
 * Create a turn end hook
 */
export function onTurnEnd(
	handler: (
		data: { turnId: string; output: string; durationMs: number },
		context: HookContext
	) => void | Promise<void>,
	priority = 0
): Omit<Hook, 'id'> {
	return {
		name: 'onTurnEnd',
		event: 'onTurnEnd',
		handler: handler as unknown as HookHandler,
		priority,
		enabled: true
	};
}

/**
 * Create a tool call hook
 */
export function onToolCall(
	handler: (
		data: { toolName: string; arguments: Record<string, unknown> },
		context: HookContext
	) => void | Promise<void>,
	priority = 0
): Omit<Hook, 'id'> {
	return {
		name: 'onToolCall',
		event: 'onToolCall',
		handler: handler as unknown as HookHandler,
		priority,
		enabled: true
	};
}

/**
 * Create a tool result hook
 */
export function onToolResult(
	handler: (data: ToolResult, context: HookContext) => void | Promise<void>,
	priority = 0
): Omit<Hook, 'id'> {
	return {
		name: 'onToolResult',
		event: 'onToolResult',
		handler: handler as unknown as HookHandler,
		priority,
		enabled: true
	};
}

/**
 * Create an error hook
 */
export function onError(
	handler: (data: { error: Error; phase: string }, context: HookContext) => void | Promise<void>,
	priority = 0
): Omit<Hook, 'id'> {
	return {
		name: 'onError',
		event: 'onError',
		handler: handler as unknown as HookHandler,
		priority,
		enabled: true
	};
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new HookManager instance
 */
export function createHookManager(): HookManager {
	return new HookManager();
}
