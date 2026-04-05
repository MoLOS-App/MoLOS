/**
 * Lifecycle Hooks for MoLOS Agent
 *
 * Provides before/after lifecycle hooks for agent, turn, tool, and provider events.
 * This enables fine-grained interception and modification of agent behavior at
 * each stage of execution.
 *
 * ## Hook Categories
 *
 * ### Agent Lifecycle Hooks
 * - `agent:before_start` - Before agent run begins
 * - `agent:after_end` - After agent run completes
 *
 * ### Turn Lifecycle Hooks
 * - `turn:before_start` - Before a turn begins
 * - `turn:after_end` - After a turn completes
 *
 * ### Tool Lifecycle Hooks
 * - `tool:before_execute` - Before tool execution
 * - `tool:after_execute` - After tool execution
 * - `tool:on_error` - When tool execution fails
 *
 * ### Provider Lifecycle Hooks
 * - `provider:before_call` - Before LLM provider call
 * - `provider:after_call` - After LLM provider call
 * - `provider:on_error` - When provider call fails
 */

// =============================================================================
// Lifecycle Hook Names
// =============================================================================

/**
 * Lifecycle hook names organized by category
 */
export const LifecycleHooks = {
	agent: {
		beforeStart: 'agent:before_start',
		afterEnd: 'agent:after_end'
	},
	turn: {
		beforeStart: 'turn:before_start',
		afterEnd: 'turn:after_end'
	},
	tool: {
		beforeExecute: 'tool:before_execute',
		afterExecute: 'tool:after_execute',
		onError: 'tool:on_error'
	},
	provider: {
		beforeCall: 'provider:before_call',
		afterCall: 'provider:after_call',
		onError: 'provider:on_error'
	}
} as const;

/**
 * All lifecycle hook names as a union type
 */
export type LifecycleHookName =
	| typeof LifecycleHooks.agent.beforeStart
	| typeof LifecycleHooks.agent.afterEnd
	| typeof LifecycleHooks.turn.beforeStart
	| typeof LifecycleHooks.turn.afterEnd
	| typeof LifecycleHooks.tool.beforeExecute
	| typeof LifecycleHooks.tool.afterExecute
	| typeof LifecycleHooks.tool.onError
	| typeof LifecycleHooks.provider.beforeCall
	| typeof LifecycleHooks.provider.afterCall
	| typeof LifecycleHooks.provider.onError;

// =============================================================================
// Agent Statistics Type
// =============================================================================

/**
 * Statistics about an agent run
 */
export interface AgentStats {
	/** Total iterations executed */
	iterations: number;
	/** Total turns executed */
	turns: number;
	/** Total tool calls executed */
	toolCalls: number;
	/** Input tokens used */
	inputTokens: number;
	/** Output tokens used */
	outputTokens: number;
	/** Total tokens used */
	totalTokens: number;
	/** Total execution time in milliseconds */
	durationMs: number;
}

// =============================================================================
// Lifecycle Event Types
// =============================================================================

/**
 * Base interface for all lifecycle events
 */
export interface BaseLifecycleEvent {
	/** The lifecycle hook name */
	kind: LifecycleHookName;
	/** Session identifier */
	sessionId?: string;
	/** Run identifier */
	runId: string;
	/** Timestamp of the event */
	timestamp: number;
}

/**
 * Agent before start event - fired before agent run begins
 */
export interface AgentBeforeStartEvent extends BaseLifecycleEvent {
	kind: typeof LifecycleHooks.agent.beforeStart;
	/** Agent configuration */
	config: {
		id?: string;
		model?: string;
		maxIterations?: number;
		maxTurns?: number;
		maxTokens?: number;
		temperature?: number;
	};
	/** User input that started the run */
	input: string;
}

/**
 * Agent after end event - fired after agent run completes
 */
export interface AgentAfterEndEvent extends BaseLifecycleEvent {
	kind: typeof LifecycleHooks.agent.afterEnd;
	/** Reason for completion */
	reason: 'completed' | 'error' | 'terminated';
	/** Agent run statistics */
	stats: AgentStats;
	/** Final output from the agent */
	finalOutput?: string;
	/** Total iterations run */
	iterations: number;
	/** Total turns executed */
	turns: number;
}

/**
 * Turn before start event - fired before a turn begins
 */
export interface TurnBeforeStartEvent extends BaseLifecycleEvent {
	kind: typeof LifecycleHooks.turn.beforeStart;
	/** Turn identifier */
	turnId: string;
	/** User input for this turn */
	input: string;
	/** Current iteration number */
	iteration: number;
}

/**
 * Turn after end event - fired after a turn completes
 */
export interface TurnAfterEndEvent extends BaseLifecycleEvent {
	kind: typeof LifecycleHooks.turn.afterEnd;
	/** Turn identifier */
	turnId: string;
	/** Output from the turn */
	output: string;
	/** Number of tool calls in this turn */
	toolCallCount: number;
	/** Duration of the turn in milliseconds */
	durationMs: number;
	/** Status of the turn */
	status: 'completed' | 'error' | 'skipped';
}

/**
 * Tool before execute event - fired before tool execution
 */
export interface ToolBeforeExecuteEvent extends BaseLifecycleEvent {
	kind: typeof LifecycleHooks.tool.beforeExecute;
	/** Tool name */
	toolName: string;
	/** Tool arguments */
	arguments: Record<string, unknown>;
	/** Optional context for the tool call */
	context?: Record<string, unknown>;
}

/**
 * Tool after execute event - fired after tool execution
 */
export interface ToolAfterExecuteEvent extends BaseLifecycleEvent {
	kind: typeof LifecycleHooks.tool.afterExecute;
	/** Tool name */
	toolName: string;
	/** Tool arguments */
	arguments: Record<string, unknown>;
	/** Tool result */
	result: {
		success: boolean;
		output?: string;
		error?: string;
	};
	/** Execution duration in milliseconds */
	durationMs: number;
}

/**
 * Tool error event - fired when tool execution fails
 */
export interface ToolOnErrorEvent extends BaseLifecycleEvent {
	kind: typeof LifecycleHooks.tool.onError;
	/** Tool name */
	toolName: string;
	/** Tool arguments */
	arguments: Record<string, unknown>;
	/** The error that occurred */
	error: string;
	/** Error type */
	errorType: 'timeout' | 'not_found' | 'denied' | 'execution_error' | 'unknown';
}

/**
 * Provider before call event - fired before LLM provider call
 */
export interface ProviderBeforeCallEvent extends BaseLifecycleEvent {
	kind: typeof LifecycleHooks.provider.beforeCall;
	/** Model being used */
	model: string;
	/** Request options */
	options?: Record<string, unknown>;
}

/**
 * Provider after call event - fired after LLM provider call
 */
export interface ProviderAfterCallEvent extends BaseLifecycleEvent {
	kind: typeof LifecycleHooks.provider.afterCall;
	/** Model that was used */
	model: string;
	/** Response metadata */
	response: {
		finishReason?: string;
		usage?: {
			inputTokens: number;
			outputTokens: number;
		};
	};
	/** Duration of the call in milliseconds */
	durationMs: number;
}

/**
 * Provider error event - fired when provider call fails
 */
export interface ProviderOnErrorEvent extends BaseLifecycleEvent {
	kind: typeof LifecycleHooks.provider.onError;
	/** Model that was being used */
	model: string;
	/** The error that occurred */
	error: string;
	/** Error type */
	errorType: 'timeout' | 'auth' | 'rate_limit' | 'server_error' | 'context_overflow' | 'unknown';
}

/**
 * Union of all lifecycle event types
 */
export type LifecycleEvent =
	| AgentBeforeStartEvent
	| AgentAfterEndEvent
	| TurnBeforeStartEvent
	| TurnAfterEndEvent
	| ToolBeforeExecuteEvent
	| ToolAfterExecuteEvent
	| ToolOnErrorEvent
	| ProviderBeforeCallEvent
	| ProviderAfterCallEvent
	| ProviderOnErrorEvent;

// =============================================================================
// Lifecycle Hook Interface
// =============================================================================

/**
 * Result type for lifecycle hooks
 * - modify: allows modifying the input/output before proceeding
 * - continue: allows proceeding with execution (default)
 * - deny: blocks the operation (for tool execution)
 * - abort: aborts the entire run
 */
export type LifecycleHookAction = 'continue' | 'modify' | 'deny' | 'abort';

/**
 * Lifecycle hook result for before hooks
 */
export interface LifecycleHookBeforeResult<T = unknown> {
	/** The action to take */
	action: LifecycleHookAction;
	/** Modified input/output if action is 'modify' */
	modified?: T;
	/** Reason for the action */
	reason?: string;
}

/**
 * Lifecycle hook result for after hooks
 */
export interface LifecycleHookAfterResult<T = unknown> {
	/** The action to take */
	action: LifecycleHookAction;
	/** Modified output if action is 'modify' */
	modified?: T;
	/** Reason for the action */
	reason?: string;
}

/**
 * Lifecycle hook interface for agents
 */
export interface AgentLifecycleHooks {
	/** Called before agent starts */
	onBeforeAgentStart?: (event: AgentBeforeStartEvent) => LifecycleHookBeforeResult<void> | void;
	/** Called after agent ends */
	onAfterAgentEnd?: (event: AgentAfterEndEvent) => void;
}

/**
 * Lifecycle hook interface for turns
 */
export interface TurnLifecycleHooks {
	/** Called before turn starts */
	onBeforeTurnStart?: (event: TurnBeforeStartEvent) => LifecycleHookBeforeResult<void> | void;
	/** Called after turn ends */
	onAfterTurnEnd?: (event: TurnAfterEndEvent) => void;
}

/**
 * Lifecycle hook interface for tools
 */
export interface ToolLifecycleHooks {
	/** Called before tool execution */
	onBeforeToolExecute?: (
		event: ToolBeforeExecuteEvent
	) => LifecycleHookBeforeResult<ToolBeforeExecuteEvent> | void;
	/** Called after tool execution */
	onAfterToolExecute?: (
		event: ToolAfterExecuteEvent
	) => LifecycleHookAfterResult<ToolAfterExecuteEvent> | void;
	/** Called when tool execution fails */
	onToolError?: (event: ToolOnErrorEvent) => void;
}

/**
 * Lifecycle hook interface for providers
 */
export interface ProviderLifecycleHooks {
	/** Called before provider call */
	onBeforeProviderCall?: (
		event: ProviderBeforeCallEvent
	) => LifecycleHookBeforeResult<ProviderBeforeCallEvent> | void;
	/** Called after provider call */
	onAfterProviderCall?: (
		event: ProviderAfterCallEvent
	) => LifecycleHookAfterResult<ProviderAfterCallEvent> | void;
	/** Called when provider call fails */
	onProviderError?: (event: ProviderOnErrorEvent) => void;
}

/**
 * Combined lifecycle hooks interface
 */
export interface CombinedLifecycleHooks
	extends AgentLifecycleHooks, TurnLifecycleHooks, ToolLifecycleHooks, ProviderLifecycleHooks {}

/**
 * Lifecycle hook registration with metadata
 */
export interface LifecycleHookRegistration {
	/** Unique name for this hook */
	name: string;
	/** Priority (higher runs first, default: 50) */
	priority?: number;
	/** The lifecycle hooks to register */
	hooks: CombinedLifecycleHooks;
	/** Timeout for hook execution in ms (default: 5000) */
	timeoutMs?: number;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a lifecycle event is an agent lifecycle event
 */
export function isAgentLifecycleEvent(
	event: LifecycleEvent
): event is AgentBeforeStartEvent | AgentAfterEndEvent {
	return (
		event.kind === LifecycleHooks.agent.beforeStart || event.kind === LifecycleHooks.agent.afterEnd
	);
}

/**
 * Check if a lifecycle event is a turn lifecycle event
 */
export function isTurnLifecycleEvent(
	event: LifecycleEvent
): event is TurnBeforeStartEvent | TurnAfterEndEvent {
	return (
		event.kind === LifecycleHooks.turn.beforeStart || event.kind === LifecycleHooks.turn.afterEnd
	);
}

/**
 * Check if a lifecycle event is a tool lifecycle event
 */
export function isToolLifecycleEvent(
	event: LifecycleEvent
): event is ToolBeforeExecuteEvent | ToolAfterExecuteEvent | ToolOnErrorEvent {
	return (
		event.kind === LifecycleHooks.tool.beforeExecute ||
		event.kind === LifecycleHooks.tool.afterExecute ||
		event.kind === LifecycleHooks.tool.onError
	);
}

/**
 * Check if a lifecycle event is a provider lifecycle event
 */
export function isProviderLifecycleEvent(
	event: LifecycleEvent
): event is ProviderBeforeCallEvent | ProviderAfterCallEvent | ProviderOnErrorEvent {
	return (
		event.kind === LifecycleHooks.provider.beforeCall ||
		event.kind === LifecycleHooks.provider.afterCall ||
		event.kind === LifecycleHooks.provider.onError
	);
}

/**
 * Get the category of a lifecycle hook name
 */
export function getLifecycleHookCategory(
	hookName: LifecycleHookName
): 'agent' | 'turn' | 'tool' | 'provider' {
	if (hookName.startsWith('agent:')) return 'agent';
	if (hookName.startsWith('turn:')) return 'turn';
	if (hookName.startsWith('tool:')) return 'tool';
	if (hookName.startsWith('provider:')) return 'provider';
	throw new Error(`Unknown lifecycle hook category: ${hookName}`);
}

/**
 * Map lifecycle hook name to handler method name
 */
export function getLifecycleHookMethodName(hookName: LifecycleHookName): string {
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
