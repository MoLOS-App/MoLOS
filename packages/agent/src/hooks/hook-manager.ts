/**
 * Enhanced Hook Manager for MoLOS Agent
 *
 * Hook system with void/modifying/claiming patterns for extensible
 * event-driven customization of agent behavior.
 *
 * Extended with LLM interception, tool approval, and observer patterns.
 */

import type { AgentEvent } from '../events/event-bus.js';
import { getGlobalEventBus } from '../events/event-bus.js';
import type { LlmRequest, LlmResponse, AgentMessage, ToolDefinition } from '../types/index.js';
import { HOOK } from '../constants.js';

// Re-export lifecycle hook types for convenience
export type {
	LifecycleHookName,
	LifecycleEvent,
	LifecycleHookAction,
	LifecycleHookBeforeResult,
	LifecycleHookAfterResult,
	AgentStats,
	CombinedLifecycleHooks,
	LifecycleHookRegistration,
	AgentBeforeStartEvent,
	AgentAfterEndEvent,
	TurnBeforeStartEvent,
	TurnAfterEndEvent,
	ToolBeforeExecuteEvent,
	ToolAfterExecuteEvent,
	ToolOnErrorEvent,
	ProviderBeforeCallEvent,
	ProviderAfterCallEvent,
	ProviderOnErrorEvent
} from './lifecycle.js';

import {
	LifecycleHooks,
	type LifecycleHookName,
	type LifecycleEvent,
	type LifecycleHookAction,
	type LifecycleHookBeforeResult,
	type LifecycleHookAfterResult,
	type AgentStats,
	type CombinedLifecycleHooks,
	type LifecycleHookRegistration,
	type AgentBeforeStartEvent,
	type AgentAfterEndEvent,
	type TurnBeforeStartEvent,
	type TurnAfterEndEvent,
	type ToolBeforeExecuteEvent,
	type ToolAfterExecuteEvent,
	type ToolOnErrorEvent,
	type ProviderBeforeCallEvent,
	type ProviderAfterCallEvent,
	type ProviderOnErrorEvent
} from './lifecycle.js';

// =============================================================================
// Hook Action & Decision Types
// =============================================================================

/**
 * Actions that hooks can take to control flow
 */
export type HookAction = 'continue' | 'modify' | 'deny_tool' | 'abort_turn' | 'hard_abort';

/**
 * Decision returned by hook interceptors
 */
export interface HookDecision {
	action: HookAction;
	reason?: string;
}

/**
 * Decision for tool approval requests
 */
export interface ApprovalDecision {
	approved: boolean;
	reason?: string;
}

// =============================================================================
// LLM Interception Hooks
// =============================================================================

/**
 * Request payload for LLM interception hooks
 */
export interface LLMHookRequest {
	model: string;
	messages: AgentMessage[];
	tools?: ToolDefinition[];
	options?: Record<string, unknown>;
	channel?: string;
	chatId?: string;
}

/**
 * Response payload for LLM interception hooks
 */
export interface LLMHookResponse {
	model: string;
	response: LlmResponse;
	channel?: string;
	chatId?: string;
}

/**
 * LLM Interceptor interface for before/after LLM calls
 */
export interface LLMInterceptor {
	BeforeLLM?(
		req: LLMHookRequest,
		context: HookContext
	): Promise<{ modified?: LLMHookRequest; decision: HookDecision }>;
	AfterLLM?(
		resp: LLMHookResponse,
		context: HookContext
	): Promise<{ modified?: LLMHookResponse; decision: HookDecision }>;
}

// =============================================================================
// Tool Approval Hooks
// =============================================================================

/**
 * Request payload for tool approval hooks
 */
export interface ToolApprovalRequest {
	tool: string;
	arguments: Record<string, unknown>;
	channel?: string;
	chatId?: string;
}

/**
 * Tool approver interface for approving/denying tool calls
 */
export interface ToolApprover {
	ApproveTool(req: ToolApprovalRequest, context: HookContext): Promise<ApprovalDecision>;
}

// =============================================================================
// Event Observer
// =============================================================================

/**
 * Event observer interface for observing all agent events
 */
export interface EventObserver {
	onEvent(event: AgentEvent, context: HookContext): Promise<void>;
}

// =============================================================================
// Extended Hook Handler Union
// =============================================================================

/**
 * Extended hook handler that supports all hook types including
 * LLM interception, tool approval, and event observation
 */
export type ExtendedHookHandler =
	| ((...args: any[]) => any) // Existing function hooks
	| LLMInterceptor
	| ToolApprover
	| EventObserver;

// =============================================================================
// Hook Registration
// =============================================================================

/**
 * Registration entry for extended hooks
 */
export interface HookRegistration {
	name: string;
	priority?: number;
	source?: 'in_process' | 'process';
	hook: ExtendedHookHandler;
}

// =============================================================================
// Hook Name Types
// =============================================================================

/**
 * Void hooks - fire and forget, parallel execution
 */
export type VoidHookName = 'agent_start' | 'agent_end' | 'llm_output' | 'tool_result';

/**
 * Modifying hooks - sequential execution, can modify data
 */
export type ModifyingHookName =
	| 'before_model_resolve'
	| 'before_prompt_build'
	| 'before_tool_call'
	| 'before_compaction'
	| 'after_compaction';

/**
 * Claiming hooks - first handler to claim wins
 */
export type ClaimingHookName = 'inbound_claim' | 'message_received';

export type HookName = VoidHookName | ModifyingHookName | ClaimingHookName;

// =============================================================================
// Hook Handlers
// =============================================================================

/**
 * Context passed to all hook handlers
 */
export interface HookContext {
	sessionKey?: string;
	userId?: string;
	runId: string;
	timestamp: number;
	metadata?: Record<string, unknown>;
}

/**
 * Void hook handler - fire and forget, no return value expected
 */
export interface VoidHookHandler {
	name: VoidHookName;
	handler: (event: AgentEvent, context: HookContext) => Promise<void>;
	priority?: number;
	timeoutMs?: number;
}

/**
 * Modifying hook handler - can modify the value being processed
 */
export interface ModifyingHookHandler<T = unknown> {
	name: ModifyingHookName;
	handler: (
		event: AgentEvent,
		context: HookContext,
		currentValue: T
	) => Promise<{ modified?: T; continue?: boolean }>;
	priority?: number;
	timeoutMs?: number;
}

/**
 * Claiming hook handler - first to claim wins, subsequent handlers skipped
 */
export interface ClaimingHookHandler<T = unknown> {
	name: ClaimingHookName;
	handler: (event: AgentEvent, context: HookContext) => Promise<{ handled: boolean; result?: T }>;
	priority?: number;
	timeoutMs?: number;
}

export type AnyHookHandler = VoidHookHandler | ModifyingHookHandler | ClaimingHookHandler;

// =============================================================================
// Internal Hook Entry
// =============================================================================

/**
 * Internal hook entry with metadata
 */
interface HookEntry {
	id: number;
	handler: AnyHookHandler;
	priority: number;
	timeoutMs: number;
}

/**
 * Internal entry for extended hooks (LLM interceptors, tool approvers, observers)
 */
interface ExtendedHookEntry {
	id: number;
	registration: HookRegistration;
	timeoutMs: number;
}

/**
 * Internal entry for lifecycle hooks (before/after event hooks)
 */
interface LifecycleHookEntry {
	id: number;
	name: LifecycleHookName;
	registration: LifecycleHookRegistration;
	priority: number;
	timeoutMs: number;
}

// =============================================================================
// Hook Manager Configuration
// =============================================================================

/**
 * Configuration for hook manager with timeout tiers
 */
export interface HookManagerConfig {
	defaultTimeoutMs?: number;
	continueOnError?: boolean;
	/** Timeout for observer hooks (default: 500ms) */
	observerTimeoutMs?: number;
	/** Timeout for interceptor hooks (BeforeLLM/AfterLLM, BeforeTool/AfterTool) (default: 5000ms) */
	interceptorTimeoutMs?: number;
	/** Timeout for approval hooks (ApproveTool) (default: 60000ms) */
	approvalTimeoutMs?: number;
}

// =============================================================================
// Global Singleton
// =============================================================================

/**
 * Global hook manager singleton key
 */
const GLOBAL_HOOK_MANAGER_KEY = Symbol.for('molos.agent.hookManager');

// =============================================================================
// Hook Manager Implementation
// =============================================================================

/**
 * Enhanced Hook Manager with void/modifying/claiming patterns
 * and extended support for LLM interception, tool approval, observers,
 * and lifecycle hooks.
 */
export class HookManager {
	private voidHooks: Map<VoidHookName, HookEntry[]> = new Map();
	private modifyingHooks: Map<ModifyingHookName, HookEntry[]> = new Map();
	private claimingHooks: Map<ClaimingHookName, HookEntry[]> = new Map();
	private extendedHooks: ExtendedHookEntry[] = [];
	private lifecycleHooks: Map<LifecycleHookName, LifecycleHookEntry[]> = new Map();
	private nextId = 1;
	private readonly defaultTimeoutMs: number;
	private readonly continueOnError: boolean;
	private readonly observerTimeoutMs: number;
	private readonly interceptorTimeoutMs: number;
	private readonly approvalTimeoutMs: number;
	private eventBusUnsubscribe?: () => void;

	constructor(config?: HookManagerConfig) {
		this.defaultTimeoutMs = config?.defaultTimeoutMs ?? HOOK.DEFAULT_TIMEOUT_MS;
		this.continueOnError = config?.continueOnError ?? true;
		this.observerTimeoutMs = config?.observerTimeoutMs ?? HOOK.OBSERVER_TIMEOUT_MS;
		this.interceptorTimeoutMs = config?.interceptorTimeoutMs ?? HOOK.INTERCEPTOR_TIMEOUT_MS;
		this.approvalTimeoutMs = config?.approvalTimeoutMs ?? HOOK.APPROVAL_TIMEOUT_MS;
	}

	/**
	 * Register a hook handler
	 *
	 * @param hook - The hook to register
	 * @returns Unsubscribe function
	 */
	register(hook: AnyHookHandler): () => void {
		const priority = hook.priority ?? 50;
		const timeoutMs = hook.timeoutMs ?? this.defaultTimeoutMs;

		const entry: HookEntry = {
			id: this.nextId++,
			handler: hook,
			priority,
			timeoutMs
		};

		if (this.isVoidHookName(hook.name)) {
			this.addHookToMap(this.voidHooks, hook.name, entry);
		} else if (this.isModifyingHookName(hook.name)) {
			this.addHookToMap(this.modifyingHooks, hook.name, entry);
		} else if (this.isClaimingHookName(hook.name)) {
			this.addHookToMap(this.claimingHooks, hook.name, entry);
		}

		return () => this.unregister(entry.id);
	}

	/**
	 * Mount an extended hook registration (LLM interceptor, tool approver, or observer)
	 *
	 * @param registration - The hook registration to mount
	 * @returns Unsubscribe function
	 */
	mount(registration: HookRegistration): () => void {
		const priority = registration.priority ?? 50;
		let timeoutMs = this.defaultTimeoutMs;
		let hookType: 'observer' | 'interceptor' | 'approval' | 'unknown' = 'unknown';

		// Determine timeout tier based on hook type
		if (this.isLLMInterceptor(registration.hook)) {
			hookType = 'interceptor';
			timeoutMs = this.interceptorTimeoutMs;
		} else if (this.isToolApprover(registration.hook)) {
			hookType = 'approval';
			timeoutMs = this.approvalTimeoutMs;
		} else if (this.isEventObserver(registration.hook)) {
			hookType = 'observer';
			timeoutMs = this.observerTimeoutMs;
		}

		const entry: ExtendedHookEntry = {
			id: this.nextId++,
			registration: {
				...registration,
				priority
			},
			timeoutMs
		};

		// Add to array and sort by priority
		this.extendedHooks.push(entry);
		this.extendedHooks.sort((a, b) => b.registration.priority! - a.registration.priority!);

		// Auto-subscribe to event bus if this is an observer
		if (hookType === 'observer' && !this.eventBusUnsubscribe) {
			this.setupEventBusSubscription();
		}

		return () => this.unmount(entry.id);
	}

	/**
	 * Set up event bus subscription for observers
	 */
	private setupEventBusSubscription(): void {
		// Import event bus directly - no circular dependency since we import from event-bus directly
		const eventBus = getGlobalEventBus();
		this.eventBusUnsubscribe = eventBus.subscribe('*', async (event: AgentEvent) => {
			const context: HookContext = {
				sessionKey: event.sessionKey,
				runId: event.runId,
				timestamp: event.ts,
				metadata: { seq: event.seq, stream: event.stream }
			};

			// Run all observer hooks
			await this.runObserverHooks(event, context);
		});
	}

	/**
	 * Run all observer hooks for an event
	 */
	private async runObserverHooks(event: AgentEvent, context: HookContext): Promise<void> {
		const observerEntries = this.extendedHooks.filter((e) =>
			this.isEventObserver(e.registration.hook)
		);

		const promises = observerEntries.map(async (entry) => {
			const observer = entry.registration.hook as EventObserver;
			try {
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(
						() =>
							reject(
								new Error(
									`Observer hook '${entry.registration.name}' timed out after ${entry.timeoutMs}ms`
								)
							),
						entry.timeoutMs
					);
				});

				await Promise.race([observer.onEvent(event, context), timeoutPromise]);
			} catch (error) {
				if (this.continueOnError) {
					console.warn(`Observer hook warning [${entry.registration.name}]:`, error);
				} else {
					throw error;
				}
			}
		});

		await Promise.all(promises);
	}

	/**
	 * Before LLM call - intercept and optionally modify the request
	 *
	 * @param req - The LLM request
	 * @param context - Hook context
	 * @returns Modified request and decision
	 */
	async beforeLLM(
		req: LLMHookRequest,
		context: HookContext
	): Promise<{ req: LLMHookRequest; decision: HookDecision }> {
		let modifiedReq = { ...req };
		let decision: HookDecision = { action: 'continue' };

		const interceptorEntries = this.extendedHooks
			.filter((e) => this.isLLMInterceptor(e.registration.hook))
			.sort((a, b) => b.registration.priority! - a.registration.priority!);

		for (const entry of interceptorEntries) {
			const interceptor = entry.registration.hook as LLMInterceptor;
			if (!interceptor.BeforeLLM) continue;

			try {
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(
						() =>
							reject(
								new Error(
									`BeforeLLM hook '${entry.registration.name}' timed out after ${entry.timeoutMs}ms`
								)
							),
						entry.timeoutMs
					);
				});

				const result = await Promise.race([
					interceptor.BeforeLLM(modifiedReq, context),
					timeoutPromise
				]);

				if (result.modified) {
					modifiedReq = { ...modifiedReq, ...result.modified };
					decision.action = 'modify';
				}

				if (result.decision.action !== 'continue') {
					decision = result.decision;
					// If hard_abort, stop processing immediately
					if (result.decision.action === 'hard_abort') {
						break;
					}
				}
			} catch (error) {
				if (this.continueOnError) {
					console.warn(`BeforeLLM hook warning [${entry.registration.name}]:`, error);
				} else {
					throw error;
				}
			}
		}

		return { req: modifiedReq, decision };
	}

	/**
	 * After LLM call - intercept and optionally modify the response
	 *
	 * @param resp - The LLM response
	 * @param context - Hook context
	 * @returns Modified response and decision
	 */
	async afterLLM(
		resp: LLMHookResponse,
		context: HookContext
	): Promise<{ resp: LLMHookResponse; decision: HookDecision }> {
		let modifiedResp = { ...resp };
		let decision: HookDecision = { action: 'continue' };

		const interceptorEntries = this.extendedHooks
			.filter((e) => this.isLLMInterceptor(e.registration.hook))
			.sort((a, b) => b.registration.priority! - a.registration.priority!);

		for (const entry of interceptorEntries) {
			const interceptor = entry.registration.hook as LLMInterceptor;
			if (!interceptor.AfterLLM) continue;

			try {
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(
						() =>
							reject(
								new Error(
									`AfterLLM hook '${entry.registration.name}' timed out after ${entry.timeoutMs}ms`
								)
							),
						entry.timeoutMs
					);
				});

				const result = await Promise.race([
					interceptor.AfterLLM(modifiedResp, context),
					timeoutPromise
				]);

				if (result.modified) {
					modifiedResp = { ...modifiedResp, ...result.modified };
					decision.action = 'modify';
				}

				if (result.decision.action !== 'continue') {
					decision = result.decision;
					if (result.decision.action === 'hard_abort') {
						break;
					}
				}
			} catch (error) {
				if (this.continueOnError) {
					console.warn(`AfterLLM hook warning [${entry.registration.name}]:`, error);
				} else {
					throw error;
				}
			}
		}

		return { resp: modifiedResp, decision };
	}

	/**
	 * Approve or deny a tool call
	 *
	 * @param req - Tool approval request
	 * @param context - Hook context
	 * @returns Approval decision
	 */
	async approveTool(req: ToolApprovalRequest, context: HookContext): Promise<ApprovalDecision> {
		const approverEntries = this.extendedHooks
			.filter((e) => this.isToolApprover(e.registration.hook))
			.sort((a, b) => b.registration.priority! - a.registration.priority!);

		for (const entry of approverEntries) {
			const approver = entry.registration.hook as ToolApprover;

			try {
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(
						() =>
							reject(
								new Error(
									`ApproveTool hook '${entry.registration.name}' timed out after ${entry.timeoutMs}ms`
								)
							),
						entry.timeoutMs
					);
				});

				const decision = await Promise.race([approver.ApproveTool(req, context), timeoutPromise]);

				// Return the first approval/denial decision
				if (!decision.approved) {
					return {
						approved: false,
						reason: decision.reason ?? `Denied by approver '${entry.registration.name}'`
					};
				}
			} catch (error) {
				if (this.continueOnError) {
					console.warn(`ApproveTool hook warning [${entry.registration.name}]:`, error);
				} else {
					throw error;
				}
			}
		}

		// Default to approved if no denials
		return { approved: true };
	}

	/**
	 * Check if a hook implements LLMInterceptor
	 */
	private isLLMInterceptor(hook: ExtendedHookHandler): hook is LLMInterceptor {
		return typeof hook === 'object' && hook !== null && ('BeforeLLM' in hook || 'AfterLLM' in hook);
	}

	/**
	 * Check if a hook implements ToolApprover
	 */
	private isToolApprover(hook: ExtendedHookHandler): hook is ToolApprover {
		return typeof hook === 'object' && hook !== null && 'ApproveTool' in hook;
	}

	/**
	 * Check if a hook implements EventObserver
	 */
	private isEventObserver(hook: ExtendedHookHandler): hook is EventObserver {
		return typeof hook === 'object' && hook !== null && 'onEvent' in hook;
	}

	/**
	 * Unmount an extended hook by ID
	 */
	private unmount(id: number): void {
		const index = this.extendedHooks.findIndex((e) => e.id === id);
		if (index !== -1) {
			this.extendedHooks.splice(index, 1);
		}

		// Clean up event bus subscription if no observers remain
		if (
			this.eventBusUnsubscribe &&
			!this.extendedHooks.some((e) => this.isEventObserver(e.registration.hook))
		) {
			this.eventBusUnsubscribe();
			this.eventBusUnsubscribe = undefined;
		}
	}

	/**
	 * Add hook entry to map, sorted by priority
	 */
	private addHookToMap<T extends HookName>(
		map: Map<T, HookEntry[]>,
		name: T,
		entry: HookEntry
	): void {
		if (!map.has(name)) {
			map.set(name, []);
		}
		const hooks = map.get(name)!;
		hooks.push(entry);
		// Sort by priority (higher first)
		hooks.sort((a, b) => b.priority - a.priority);
	}

	/**
	 * Unregister a hook by ID
	 */
	private unregister(id: number): void {
		for (const hooks of this.voidHooks.values()) {
			const index = hooks.findIndex((h) => h.id === id);
			if (index !== -1) {
				hooks.splice(index, 1);
				return;
			}
		}
		for (const hooks of this.modifyingHooks.values()) {
			const index = hooks.findIndex((h) => h.id === id);
			if (index !== -1) {
				hooks.splice(index, 1);
				return;
			}
		}
		for (const hooks of this.claimingHooks.values()) {
			const index = hooks.findIndex((h) => h.id === id);
			if (index !== -1) {
				hooks.splice(index, 1);
				return;
			}
		}
	}

	/**
	 * Register a void hook
	 */
	registerVoidHook(hook: VoidHookHandler): () => void {
		return this.register(hook);
	}

	/**
	 * Register a modifying hook
	 */
	registerModifyingHook(hook: ModifyingHookHandler): () => void {
		return this.register(hook);
	}

	/**
	 * Register a claiming hook
	 */
	registerClaimingHook(hook: ClaimingHookHandler): () => void {
		return this.register(hook);
	}

	/**
	 * Run void hook - fire and forget, parallel execution
	 *
	 * All handlers are called in parallel. Errors are caught and logged
	 * but don't prevent other handlers from running.
	 */
	async runVoidHook(
		hookName: VoidHookName,
		event: AgentEvent,
		context: HookContext
	): Promise<void> {
		const hooks = this.voidHooks.get(hookName) ?? [];

		const promises = hooks.map(async (entry) => {
			const handler = entry.handler as VoidHookHandler;

			try {
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(
						() => reject(new Error(`Hook ${hookName} timed out after ${entry.timeoutMs}ms`)),
						entry.timeoutMs
					);
				});

				await Promise.race([handler.handler(event, context), timeoutPromise]);
			} catch (error) {
				if (this.continueOnError) {
					console.error(`Void hook error [${hookName}]:`, error);
				} else {
					throw error;
				}
			}
		});

		await Promise.all(promises);
	}

	/**
	 * Run modifying hook - sequential execution, merged result
	 *
	 * Hooks are executed in priority order. Each hook receives the
	 * modified value from the previous hook. Results can be merged
	 * using the optional merge function.
	 */
	async runModifyingHook<T>(
		hookName: ModifyingHookName,
		event: AgentEvent,
		context: HookContext,
		initialValue: T,
		mergeResults?: (a: T, b: T) => T
	): Promise<T | undefined> {
		const hooks = this.modifyingHooks.get(hookName) ?? [];

		if (hooks.length === 0) {
			return undefined;
		}

		let currentValue: T = initialValue;
		let shouldContinue = true;

		for (const entry of hooks) {
			if (!shouldContinue) {
				break;
			}

			const handler = entry.handler as ModifyingHookHandler<T>;

			try {
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(
						() => reject(new Error(`Hook ${hookName} timed out after ${entry.timeoutMs}ms`)),
						entry.timeoutMs
					);
				});

				const result = await Promise.race([
					handler.handler(event, context, currentValue),
					timeoutPromise
				]);

				if (result.modified !== undefined) {
					if (mergeResults) {
						currentValue = mergeResults(currentValue, result.modified);
					} else {
						currentValue = result.modified;
					}
				}

				if (result.continue === false) {
					shouldContinue = false;
				}
			} catch (error) {
				if (this.continueOnError) {
					console.error(`Modifying hook error [${hookName}]:`, error);
				} else {
					throw error;
				}
			}
		}

		return currentValue;
	}

	/**
	 * Run claiming hook - first to claim wins
	 *
	 * Hooks are executed in priority order. The first handler to return
	 * { handled: true } wins and subsequent handlers are skipped.
	 */
	async runClaimingHook<T>(
		hookName: ClaimingHookName,
		event: AgentEvent,
		context: HookContext
	): Promise<{ handled: boolean; result?: T }> {
		const hooks = this.claimingHooks.get(hookName) ?? [];

		for (const entry of hooks) {
			const handler = entry.handler as ClaimingHookHandler<T>;

			try {
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(
						() => reject(new Error(`Hook ${hookName} timed out after ${entry.timeoutMs}ms`)),
						entry.timeoutMs
					);
				});

				const result = await Promise.race([handler.handler(event, context), timeoutPromise]);

				if (result.handled) {
					return result;
				}
			} catch (error) {
				if (this.continueOnError) {
					console.error(`Claiming hook error [${hookName}]:`, error);
				} else {
					throw error;
				}
			}
		}

		return { handled: false };
	}

	/**
	 * Convenience method for before_tool_call hook
	 */
	async runBeforeToolCall(
		toolName: string,
		args: Record<string, unknown>,
		context: HookContext
	): Promise<{ blocked?: boolean; reason?: string; modifiedArgs?: Record<string, unknown> }> {
		const event: AgentEvent = {
			runId: context.runId,
			seq: 0,
			stream: 'tool',
			type: 'before_tool_call',
			ts: Date.now(),
			data: { toolName, args },
			sessionKey: context.sessionKey
		};

		const result = await this.runModifyingHook<Record<string, unknown>>(
			'before_tool_call',
			event,
			context,
			args,
			(a, b) => ({ ...a, ...b })
		);

		if (result && result.__blocked) {
			return {
				blocked: true,
				reason: (result.__reason as string) ?? 'Blocked by hook'
			};
		}

		return {
			modifiedArgs: result
		};
	}

	/**
	 * Convenience method for after_tool_call hook
	 */
	async runAfterToolCall(toolName: string, result: unknown, context: HookContext): Promise<void> {
		const event: AgentEvent = {
			runId: context.runId,
			seq: 0,
			stream: 'tool',
			type: 'tool_result',
			ts: Date.now(),
			data: { toolName, result },
			sessionKey: context.sessionKey
		};

		await this.runVoidHook('tool_result', event, context);
	}

	/**
	 * Check if a hook has registered handlers
	 */
	hasHooks(hookName: HookName): boolean {
		if (this.isVoidHookName(hookName)) {
			return (this.voidHooks.get(hookName) ?? []).length > 0;
		}
		if (this.isModifyingHookName(hookName)) {
			return (this.modifyingHooks.get(hookName) ?? []).length > 0;
		}
		if (this.isClaimingHookName(hookName)) {
			return (this.claimingHooks.get(hookName) ?? []).length > 0;
		}
		return false;
	}

	/**
	 * Get all registered hook names
	 */
	getRegisteredHookNames(): HookName[] {
		const names: HookName[] = [];
		names.push(...Array.from(this.voidHooks.keys()));
		names.push(...Array.from(this.modifyingHooks.keys()));
		names.push(...Array.from(this.claimingHooks.keys()));
		return [...new Set(names)];
	}

	/**
	 * Clear all hooks
	 */
	clear(): void {
		this.voidHooks.clear();
		this.modifyingHooks.clear();
		this.claimingHooks.clear();
		this.extendedHooks = [];
		this.lifecycleHooks.clear();
	}

	/**
	 * Gracefully shut down the hook manager
	 *
	 * Unsubscribes from event bus, closes all hooks that implement io.Closer pattern,
	 * and clears all registrations.
	 */
	close(): void {
		// Unsubscribe from event bus
		if (this.eventBusUnsubscribe) {
			this.eventBusUnsubscribe();
			this.eventBusUnsubscribe = undefined;
		}

		// Close all extended hooks that implement a close method
		for (const entry of this.extendedHooks) {
			const hook = entry.registration.hook;
			if (
				hook &&
				typeof hook === 'object' &&
				'close' in hook &&
				typeof (hook as any).close === 'function'
			) {
				try {
					(hook as { close(): void }).close();
				} catch (error) {
					console.warn(`Error closing hook '${entry.registration.name}':`, error);
				}
			}
		}

		// Close all lifecycle hooks that implement a close method
		for (const hooks of this.lifecycleHooks.values()) {
			for (const entry of hooks) {
				const lifecycleHooks = entry.registration.hooks;
				if (
					lifecycleHooks &&
					typeof lifecycleHooks === 'object' &&
					'close' in lifecycleHooks &&
					typeof (lifecycleHooks as any).close === 'function'
				) {
					try {
						(lifecycleHooks as { close(): void }).close();
					} catch (error) {
						console.warn(`Error closing lifecycle hook '${entry.registration.name}':`, error);
					}
				}
			}
		}

		// Clear all registrations
		this.clear();
	}

	// =============================================================================
	// Lifecycle Hook Methods
	// =============================================================================

	/**
	 * Register lifecycle hooks (before/after hooks for agent, turn, tool, provider events)
	 *
	 * @param registration - The lifecycle hook registration
	 * @returns Unsubscribe function
	 */
	registerLifecycleHooks(registration: LifecycleHookRegistration): () => void {
		const priority = registration.priority ?? 50;
		const timeoutMs = registration.timeoutMs ?? this.defaultTimeoutMs;

		// Create the base entry (without name since that varies per hook type)
		const baseEntry = {
			id: this.nextId++,
			registration,
			priority,
			timeoutMs
		};

		// Register this entry for each hook type that has a handler
		const hookMethods = [
			{ name: LifecycleHooks.agent.beforeStart, method: registration.hooks.onBeforeAgentStart },
			{ name: LifecycleHooks.agent.afterEnd, method: registration.hooks.onAfterAgentEnd },
			{ name: LifecycleHooks.turn.beforeStart, method: registration.hooks.onBeforeTurnStart },
			{ name: LifecycleHooks.turn.afterEnd, method: registration.hooks.onAfterTurnEnd },
			{ name: LifecycleHooks.tool.beforeExecute, method: registration.hooks.onBeforeToolExecute },
			{ name: LifecycleHooks.tool.afterExecute, method: registration.hooks.onAfterToolExecute },
			{ name: LifecycleHooks.tool.onError, method: registration.hooks.onToolError },
			{ name: LifecycleHooks.provider.beforeCall, method: registration.hooks.onBeforeProviderCall },
			{ name: LifecycleHooks.provider.afterCall, method: registration.hooks.onAfterProviderCall },
			{ name: LifecycleHooks.provider.onError, method: registration.hooks.onProviderError }
		];

		for (const { name, method } of hookMethods) {
			if (method) {
				if (!this.lifecycleHooks.has(name)) {
					this.lifecycleHooks.set(name, []);
				}
				const hooks = this.lifecycleHooks.get(name)!;
				hooks.push({ ...baseEntry, name });
				// Sort by priority (higher first)
				hooks.sort((a, b) => b.priority - a.priority);
			}
		}

		return () => this.unregisterLifecycleHook(baseEntry.id);
	}

	/**
	 * Unregister lifecycle hook by ID
	 */
	private unregisterLifecycleHook(id: number): void {
		for (const hooks of this.lifecycleHooks.values()) {
			const index = hooks.findIndex((h) => h.id === id);
			if (index !== -1) {
				hooks.splice(index, 1);
			}
		}
	}

	/**
	 * Run a lifecycle hook (before/after event)
	 *
	 * @param hookName - The lifecycle hook name
	 * @param event - The lifecycle event data
	 * @returns The result with modified data if any hooks modified it
	 */
	async runLifecycleHook<T extends LifecycleEvent>(
		hookName: LifecycleHookName,
		event: T
	): Promise<{ event: T; modified: boolean }> {
		const hooks = this.lifecycleHooks.get(hookName) ?? [];
		let modifiedEvent = event;
		let modified = false;

		for (const entry of hooks) {
			const methodName = this.getLifecycleHookMethodName(hookName);
			const method = (entry.registration.hooks as any)[methodName];

			if (!method) continue;

			try {
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(
						() =>
							reject(
								new Error(
									`Lifecycle hook '${entry.registration.name}' timed out after ${entry.timeoutMs}ms`
								)
							),
						entry.timeoutMs
					);
				});

				const result = await Promise.race([method(modifiedEvent), timeoutPromise]);

				if (result) {
					// Check if the hook returned a modification result
					if (typeof result === 'object' && 'action' in result) {
						const actionResult = result as
							| LifecycleHookBeforeResult<T>
							| LifecycleHookAfterResult<T>;
						if (actionResult.action === 'modify' && actionResult.modified) {
							modifiedEvent = actionResult.modified as T;
							modified = true;
						} else if (actionResult.action === 'abort' || actionResult.action === 'deny') {
							// For now, just log - in the future we could throw an error
							console.warn(
								`Lifecycle hook '${entry.registration.name}' returned action: ${actionResult.action}`,
								actionResult.reason
							);
						}
					}
				}
			} catch (error) {
				if (this.continueOnError) {
					console.warn(`Lifecycle hook warning [${entry.registration.name}]:`, error);
				} else {
					throw error;
				}
			}
		}

		return { event: modifiedEvent, modified };
	}

	/**
	 * Check if any hooks are registered for a lifecycle hook name
	 */
	hasLifecycleHooks(hookName: LifecycleHookName): boolean {
		return (this.lifecycleHooks.get(hookName) ?? []).length > 0;
	}

	/**
	 * Get all registered lifecycle hook names
	 */
	getRegisteredLifecycleHookNames(): LifecycleHookName[] {
		return Array.from(this.lifecycleHooks.keys()).filter((name): name is LifecycleHookName =>
			this.hasLifecycleHooks(name)
		);
	}

	/**
	 * Map lifecycle hook name to handler method name
	 */
	private getLifecycleHookMethodName(hookName: LifecycleHookName): string {
		const mapping: Record<LifecycleHookName, string> = {
			'agent:before_start': 'onBeforeAgentStart',
			'agent:after_end': 'onAfterAgentEnd',
			'turn:before_start': 'onBeforeTurnStart',
			'turn:after_end': 'onAfterTurnEnd',
			'tool:before_execute': 'onBeforeToolExecute',
			'tool:after_execute': 'onAfterToolExecute',
			'tool:on_error': 'onToolError',
			'provider:before_call': 'onBeforeProviderCall',
			'provider:after_call': 'onAfterProviderCall',
			'provider:on_error': 'onProviderError'
		};
		return mapping[hookName];
	}

	// =============================================================================
	// Lifecycle Hook Methods
	// =============================================================================

	/**
	 * Type guard for VoidHookName
	 */
	private isVoidHookName(name: string): name is VoidHookName {
		return ['agent_start', 'agent_end', 'llm_output', 'tool_result'].includes(name);
	}

	/**
	 * Type guard for ModifyingHookName
	 */
	private isModifyingHookName(name: string): name is ModifyingHookName {
		return [
			'before_model_resolve',
			'before_prompt_build',
			'before_tool_call',
			'before_compaction',
			'after_compaction'
		].includes(name);
	}

	/**
	 * Type guard for ClaimingHookName
	 */
	private isClaimingHookName(name: string): name is ClaimingHookName {
		return ['inbound_claim', 'message_received'].includes(name);
	}
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new hook manager instance
 */
export function createHookManager(config?: HookManagerConfig): HookManager {
	return new HookManager(config);
}

/**
 * Get or create the global hook manager singleton
 */
export function getGlobalHookManager(): HookManager {
	const globalScope = globalThis as typeof globalThis & {
		[GLOBAL_HOOK_MANAGER_KEY]?: HookManager;
	};

	if (!globalScope[GLOBAL_HOOK_MANAGER_KEY]) {
		globalScope[GLOBAL_HOOK_MANAGER_KEY] = new HookManager();
	}

	return globalScope[GLOBAL_HOOK_MANAGER_KEY];
}
