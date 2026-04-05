/**
 * Hooks module for MoLOS Agent
 *
 * Provides the hook system for extensibility and customization of agent behavior.
 * Includes void/modifying/claiming hooks, LLM interception, tool approval, event observers,
 * and lifecycle hooks for before/after event handling.
 */

// Re-export hook manager
export {
	HookManager,
	createHookManager,
	getGlobalHookManager,
	type HookManagerConfig,
	type HookContext,
	type HookName,
	type VoidHookName,
	type ModifyingHookName,
	type ClaimingHookName,
	type VoidHookHandler,
	type ModifyingHookHandler,
	type ClaimingHookHandler,
	type AnyHookHandler
} from './hook-manager.js';

// Re-export extended hook types
export {
	type HookAction,
	type HookDecision,
	type ApprovalDecision,
	type LLMHookRequest,
	type LLMHookResponse,
	type LLMInterceptor,
	type ToolApprovalRequest,
	type ToolApprover,
	type EventObserver,
	type ExtendedHookHandler,
	type HookRegistration
} from './hook-manager.js';

// Re-export lifecycle hooks
export {
	LifecycleHooks,
	type LifecycleHookName,
	type LifecycleEvent,
	type LifecycleHookAction,
	type LifecycleHookBeforeResult,
	type LifecycleHookAfterResult,
	type AgentStats,
	type AgentLifecycleHooks,
	type TurnLifecycleHooks,
	type ToolLifecycleHooks,
	type ProviderLifecycleHooks,
	type CombinedLifecycleHooks,
	type LifecycleHookRegistration,
	type BaseLifecycleEvent,
	type AgentBeforeStartEvent,
	type AgentAfterEndEvent,
	type TurnBeforeStartEvent,
	type TurnAfterEndEvent,
	type ToolBeforeExecuteEvent,
	type ToolAfterExecuteEvent,
	type ToolOnErrorEvent,
	type ProviderBeforeCallEvent,
	type ProviderAfterCallEvent,
	type ProviderOnErrorEvent,
	isAgentLifecycleEvent,
	isTurnLifecycleEvent,
	isToolLifecycleEvent,
	isProviderLifecycleEvent,
	getLifecycleHookCategory,
	getLifecycleHookMethodName
} from './lifecycle.js';
