/**
 * Hook Manager - Registry and execution of hooks
 *
 * Manages registration, prioritization, and execution of hooks.
 * Supports PreToolUse, PostToolUse, and Stop hooks.
 */

import type { ToolCall, ToolExecutionResult, AgentState } from '../core/types';
import type { IAgentContext } from '../core/context';
import {
	type HookDefinition,
	type PreToolUseHook,
	type PostToolUseHook,
	type StopHook,
	type PreToolUseContext,
	type PostToolUseContext,
	type StopContext,
	type HookResult,
	type HookPhase,
	type HookManagerConfig,
	DEFAULT_HOOK_CONFIG,
	type HookExecutionEvent
} from './hook-types';

// ============================================================================
// Hook Manager
// ============================================================================

/**
 * Hook Manager - Central registry and executor for hooks
 */
export class HookManager {
	private preHooks: Map<string, HookDefinition<PreToolUseHook>> = new Map();
	private postHooks: Map<string, HookDefinition<PostToolUseHook>> = new Map();
	private stopHooks: Map<string, HookDefinition<StopHook>> = new Map();
	private config: HookManagerConfig;
	private executionLog: HookExecutionEvent[] = [];

	constructor(config: Partial<HookManagerConfig> = {}) {
		this.config = { ...DEFAULT_HOOK_CONFIG, ...config };
	}

	// ============================================================================
	// Registration Methods
	// ============================================================================

	/**
	 * Register a PreToolUse hook
	 */
	registerPreHook(hook: Omit<HookDefinition<PreToolUseHook>, 'phase'>): void {
		const definition: HookDefinition<PreToolUseHook> = {
			...hook,
			phase: 'pre'
		};
		this.preHooks.set(hook.id, definition);
	}

	/**
	 * Register a PostToolUse hook
	 */
	registerPostHook(hook: Omit<HookDefinition<PostToolUseHook>, 'phase'>): void {
		const definition: HookDefinition<PostToolUseHook> = {
			...hook,
			phase: 'post'
		};
		this.postHooks.set(hook.id, definition);
	}

	/**
	 * Register a Stop hook
	 */
	registerStopHook(hook: Omit<HookDefinition<StopHook>, 'phase'>): void {
		const definition: HookDefinition<StopHook> = {
			...hook,
			phase: 'stop'
		};
		this.stopHooks.set(hook.id, definition);
	}

	/**
	 * Unregister a hook by ID
	 */
	unregister(hookId: string, phase?: HookPhase): boolean {
		if (phase) {
			switch (phase) {
				case 'pre':
					return this.preHooks.delete(hookId);
				case 'post':
					return this.postHooks.delete(hookId);
				case 'stop':
					return this.stopHooks.delete(hookId);
			}
		}

		// Try all phases
		return (
			this.preHooks.delete(hookId) ||
			this.postHooks.delete(hookId) ||
			this.stopHooks.delete(hookId)
		);
	}

	/**
	 * Enable a hook
	 */
	enable(hookId: string): void {
		const hook = this.findHook(hookId);
		if (hook) {
			hook.enabled = true;
		}
	}

	/**
	 * Disable a hook
	 */
	disable(hookId: string): void {
		const hook = this.findHook(hookId);
		if (hook) {
			hook.enabled = false;
		}
	}

	/**
	 * Get all registered hooks
	 */
	getAllHooks(): HookDefinition[] {
		return [
			...Array.from(this.preHooks.values()),
			...Array.from(this.postHooks.values()),
			...Array.from(this.stopHooks.values())
		];
	}

	/**
	 * Get hooks by phase
	 */
	getHooks(phase: HookPhase): HookDefinition[] {
		switch (phase) {
			case 'pre':
				return Array.from(this.preHooks.values());
			case 'post':
				return Array.from(this.postHooks.values());
			case 'stop':
				return Array.from(this.stopHooks.values());
		}
	}

	// ============================================================================
	// Execution Methods
	// ============================================================================

	/**
	 * Execute PreToolUse hooks
	 */
	async executePreHooks(
		toolCall: ToolCall,
		context: IAgentContext,
		state: AgentState,
		iteration: number
	): Promise<{ allowed: boolean; modifications?: Record<string, unknown>; reason?: string }> {
		const hooks = this.getSortedHooks(this.preHooks, toolCall.name);
		let modifiedParams = { ...toolCall.parameters };

		for (const hook of hooks) {
			if (!hook.enabled) continue;

			// Check condition
			if (hook.condition) {
				const ctx: PreToolUseContext = { toolCall, context, state, iteration };
				if (!hook.condition(ctx)) continue;
			}

			const result = await this.executeHook(hook, {
				toolCall: { ...toolCall, parameters: modifiedParams },
				context,
				state,
				iteration
			});

			if (!result) continue;

			if (result.action === 'block') {
				this.logExecution(hook, 'pre', result, 0);
				return { allowed: false, reason: result.reason };
			}

			if (result.action === 'modify' && result.modifications) {
				if (result.modifications.parameters) {
					modifiedParams = { ...modifiedParams, ...result.modifications.parameters };
				}
				if (result.modifications.skipTool) {
					return { allowed: false, reason: 'Hook requested skip' };
				}
				if (result.modifications.replaceWith) {
					modifiedParams = result.modifications.replaceWith.parameters;
				}
			}
		}

		return { allowed: true, modifications: modifiedParams };
	}

	/**
	 * Execute PostToolUse hooks
	 */
	async executePostHooks(
		toolCall: ToolCall,
		result: ToolExecutionResult,
		context: IAgentContext,
		state: AgentState,
		iteration: number
	): Promise<{ continue: boolean; modifiedResult?: ToolExecutionResult }> {
		const hooks = this.getSortedHooks(this.postHooks, toolCall.name);
		let modifiedResult = { ...result };

		for (const hook of hooks) {
			if (!hook.enabled) continue;

			// Check condition
			if (hook.condition) {
				const ctx: PostToolUseContext = { toolCall, result: modifiedResult, context, state, iteration };
				if (!hook.condition(ctx)) continue;
			}

			const hookResult = await this.executePostHook(hook, {
				toolCall,
				result: modifiedResult,
				context,
				state,
				iteration
			});

			if (!hookResult) continue;

			if (hookResult.action === 'block') {
				this.logExecution(hook, 'post', hookResult, 0);
				return { continue: false };
			}

			if (hookResult.action === 'modify' && hookResult.modifications?.result !== undefined) {
				modifiedResult = {
					...modifiedResult,
					result: hookResult.modifications.result
				};
			}
		}

		return { continue: true, modifiedResult };
	}

	/**
	 * Execute Stop hooks
	 */
	async executeStopHooks(
		reason: StopContext['reason'],
		context: IAgentContext,
		state: AgentState,
		totalIterations: number,
		error?: Error
	): Promise<void> {
		const hooks = Array.from(this.stopHooks.values())
			.filter(h => h.enabled)
			.sort((a, b) => a.priority - b.priority);

		for (const hook of hooks) {
			try {
				const startTime = Date.now();
				await Promise.race([
					hook.handler({ reason, context, state, totalIterations, error }),
					this.createTimeout(hook.id)
				]);

				this.logExecution(hook, 'stop', { action: 'continue' }, Date.now() - startTime);
			} catch (err) {
				this.logExecution(
					hook,
					'stop',
					{ action: 'continue' },
					0,
					err instanceof Error ? err : new Error(String(err))
				);

				if (!this.config.continueOnError) {
					throw err;
				}
			}
		}
	}

	// ============================================================================
	// Utility Methods
	// ============================================================================

	/**
	 * Clear all hooks
	 */
	clear(): void {
		this.preHooks.clear();
		this.postHooks.clear();
		this.stopHooks.clear();
		this.executionLog = [];
	}

	/**
	 * Get execution log
	 */
	getExecutionLog(): HookExecutionEvent[] {
		return [...this.executionLog];
	}

	/**
	 * Clear execution log
	 */
	clearExecutionLog(): void {
		this.executionLog = [];
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private findHook(hookId: string): HookDefinition | undefined {
		return (
			this.preHooks.get(hookId) ||
			this.postHooks.get(hookId) ||
			this.stopHooks.get(hookId)
		);
	}

	private getSortedHooks<T extends PreToolUseHook | PostToolUseHook>(
		hooks: Map<string, HookDefinition<T>>,
		toolName: string
	): HookDefinition<T>[] {
		return Array.from(hooks.values())
			.filter(hook => {
				if (!hook.enabled) return false;
				if (!hook.toolPattern) return true;

				if (typeof hook.toolPattern === 'string') {
					return toolName === hook.toolPattern;
				}
				return hook.toolPattern.test(toolName);
			})
			.sort((a, b) => a.priority - b.priority);
	}

	private async executeHook(
		hook: HookDefinition<PreToolUseHook>,
		ctx: PreToolUseContext
	): Promise<HookResult | null> {
		const startTime = Date.now();

		try {
			const result = await Promise.race([
				hook.handler(ctx),
				this.createTimeout(hook.id)
			]);

			this.logExecution(hook, 'pre', result, Date.now() - startTime);
			return result;
		} catch (error) {
			this.logExecution(
				hook,
				'pre',
				{ action: 'continue' },
				Date.now() - startTime,
				error instanceof Error ? error : new Error(String(error))
			);

			if (!this.config.continueOnError) {
				throw error;
			}

			return null;
		}
	}

	private async executePostHook(
		hook: HookDefinition<PostToolUseHook>,
		ctx: PostToolUseContext
	): Promise<HookResult | null> {
		const startTime = Date.now();

		try {
			const result = await Promise.race([
				hook.handler(ctx),
				this.createTimeout(hook.id)
			]);

			this.logExecution(hook, 'post', result, Date.now() - startTime);
			return result;
		} catch (error) {
			this.logExecution(
				hook,
				'post',
				{ action: 'continue' },
				Date.now() - startTime,
				error instanceof Error ? error : new Error(String(error))
			);

			if (!this.config.continueOnError) {
				throw error;
			}

			return null;
		}
	}

	private createTimeout(hookId: string): Promise<never> {
		return new Promise((_, reject) => {
			setTimeout(
				() => reject(new Error(`Hook ${hookId} timed out after ${this.config.timeoutMs}ms`)),
				this.config.timeoutMs
			);
		});
	}

	private logExecution(
		hook: HookDefinition,
		phase: HookPhase,
		result: HookResult,
		durationMs: number,
		error?: Error
	): void {
		const event: HookExecutionEvent = {
			hookId: hook.id,
			hookName: hook.name,
			phase,
			result,
			durationMs,
			error
		};

		this.executionLog.push(event);

		if (this.config.debug) {
			console.log(`[HookManager] ${phase} hook ${hook.name}:`, result.action, error || '');
		}
	}
}

// ============================================================================
// Built-in Hooks
// ============================================================================

/**
 * Hook: Log all tool calls
 */
export const loggingHook: Omit<HookDefinition<PreToolUseHook>, 'phase'> = {
	id: 'logging',
	name: 'Logging Hook',
	description: 'Logs all tool calls',
	priority: 0,
	enabled: true,
	handler: async (ctx: PreToolUseContext): Promise<HookResult> => {
		console.log(`[Tool] ${ctx.toolCall.name}`, ctx.toolCall.parameters);
		return { action: 'continue' };
	}
};

/**
 * Hook: Parameter validation
 */
export const validationHook: Omit<HookDefinition<PreToolUseHook>, 'phase'> = {
	id: 'validation',
	name: 'Validation Hook',
	description: 'Validates tool parameters',
	priority: 1,
	enabled: true,
	handler: async (ctx: PreToolUseContext): Promise<HookResult> => {
		const tools = ctx.context.getTools();
		const tool = tools.find(t => t.name === ctx.toolCall.name);
		if (!tool) {
			return { action: 'block', reason: `Tool not found: ${ctx.toolCall.name}` };
		}

		// Check required params
		const required = tool.parameters?.required || [];
		const missing = required.filter(
			p => ctx.toolCall.parameters[p] === undefined
		);

		if (missing.length > 0) {
			return {
				action: 'modify',
				modifications: {
					metadata: { missingParams: missing }
				}
			};
		}

		return { action: 'continue' };
	}
};

/**
 * Hook: Result caching check
 */
export const cacheCheckHook: Omit<HookDefinition<PostToolUseHook>, 'phase'> = {
	id: 'cache-check',
	name: 'Cache Check Hook',
	description: 'Checks if result should be cached',
	priority: 10,
	enabled: true,
	handler: async (ctx: PostToolUseContext): Promise<HookResult> => {
		// Mark cacheable results
		if (ctx.result.success && ctx.result.durationMs > 100) {
			return {
				action: 'modify',
				modifications: {
					metadata: { cacheable: true }
				}
			};
		}
		return { action: 'continue' };
	}
};

/**
 * Create a hook manager with default hooks
 */
export function createHookManager(config?: Partial<HookManagerConfig>): HookManager {
	const manager = new HookManager(config);

	// Register default hooks
	manager.registerPreHook(loggingHook);
	manager.registerPreHook(validationHook);
	manager.registerPostHook(cacheCheckHook);

	return manager;
}
