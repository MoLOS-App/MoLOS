/**
 * Hook Types - PreToolUse, PostToolUse, Stop hooks
 *
 * Defines hook types for tool lifecycle management.
 * Hooks allow extending agent behavior at key execution points.
 */

import type { ToolCall, ToolExecutionResult, AgentState } from '../core/types';
import type { IAgentContext } from '../core/context';

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Hook execution phase
 */
export type HookPhase = 'pre' | 'post' | 'stop';

/**
 * Result of a hook execution
 */
export type HookResult =
	| { action: 'continue' } // Allow the action to proceed
	| { action: 'block'; reason: string } // Block the action with reason
	| { action: 'modify'; modifications: HookModifications }; // Modify the action

/**
 * Modifications that hooks can apply
 */
export interface HookModifications {
	/** Modified tool parameters */
	parameters?: Record<string, unknown>;
	/** Modified tool result (for post hooks) */
	result?: unknown;
	/** Additional metadata to attach */
	metadata?: Record<string, unknown>;
	/** Skip this tool call entirely */
	skipTool?: boolean;
	/** Replace with a different tool call */
	replaceWith?: ToolCall;
}

// ============================================================================
// PreToolUse Hook
// ============================================================================

/**
 * Context provided to PreToolUse hooks
 */
export interface PreToolUseContext {
	/** The tool call being made */
	toolCall: ToolCall;
	/** Current agent context */
	context: IAgentContext;
	/** Current agent state */
	state: AgentState;
	/** Iteration number */
	iteration: number;
}

/**
 * PreToolUse hook function type
 * Called before a tool is executed
 */
export type PreToolUseHook = (ctx: PreToolUseContext) => Promise<HookResult> | HookResult;

// ============================================================================
// PostToolUse Hook
// ============================================================================

/**
 * Context provided to PostToolUse hooks
 */
export interface PostToolUseContext {
	/** The tool call that was made */
	toolCall: ToolCall;
	/** Result of the tool execution */
	result: ToolExecutionResult;
	/** Current agent context */
	context: IAgentContext;
	/** Current agent state */
	state: AgentState;
	/** Iteration number */
	iteration: number;
}

/**
 * PostToolUse hook function type
 * Called after a tool is executed
 */
export type PostToolUseHook = (ctx: PostToolUseContext) => Promise<HookResult> | HookResult;

// ============================================================================
// Stop Hook
// ============================================================================

/**
 * Context provided to Stop hooks
 */
export interface StopContext {
	/** Reason for stopping */
	reason: 'complete' | 'error' | 'user_cancel' | 'max_iterations' | 'timeout';
	/** Current agent context */
	context: IAgentContext;
	/** Final agent state */
	state: AgentState;
	/** Total iterations completed */
	totalIterations: number;
	/** Error if stopping due to error */
	error?: Error;
}

/**
 * Stop hook function type
 * Called when the agent is stopping
 */
export type StopHook = (ctx: StopContext) => Promise<void> | void;

// ============================================================================
// Generic Hook Type
// ============================================================================

/**
 * Generic hook type combining all hook variants
 */
export type Hook = PreToolUseHook | PostToolUseHook | StopHook;

/**
 * Hook definition with metadata
 */
export interface HookDefinition<T extends Hook = Hook> {
	/** Unique hook identifier */
	id: string;
	/** Hook name for display */
	name: string;
	/** Hook description */
	description?: string;
	/** Hook phase */
	phase: HookPhase;
	/** Priority (lower = executed first) */
	priority: number;
	/** Whether the hook is enabled */
	enabled: boolean;
	/** The hook function */
	handler: T;
	/** Tools to match (empty = all tools) */
	toolPattern?: string | RegExp;
	/** Only run on specific conditions */
	condition?: HookCondition;
}

/**
 * Condition for conditional hook execution
 */
export type HookCondition = (ctx: PreToolUseContext | PostToolUseContext | StopContext) => boolean;

// ============================================================================
// Hook Configuration
// ============================================================================

/**
 * Configuration for the hook manager
 */
export interface HookManagerConfig {
	/** Maximum execution time per hook in ms */
	timeoutMs: number;
	/** Continue on hook error */
	continueOnError: boolean;
	/** Enable debug logging */
	debug: boolean;
}

/**
 * Default hook manager configuration
 */
export const DEFAULT_HOOK_CONFIG: HookManagerConfig = {
	timeoutMs: 5000,
	continueOnError: true,
	debug: false
};

// ============================================================================
// Hook Events
// ============================================================================

/**
 * Hook execution event
 */
export interface HookExecutionEvent {
	/** Hook ID */
	hookId: string;
	/** Hook name */
	hookName: string;
	/** Phase */
	phase: HookPhase;
	/** Execution result */
	result: HookResult;
	/** Duration in ms */
	durationMs: number;
	/** Error if any */
	error?: Error;
}
