/**
 * MoLOS AI Agent v2 - Public API
 *
 * A modular, autonomous AI agent using the ReAct pattern.
 *
 * @module agent-v2
 */

// ============================================================================
// Core Types and Configuration
// ============================================================================

export * from './core/types';
export * from './core/config';
export { AgentContext, createContext, Services } from './core/context';
export { Agent, createAgent, type AgentInitOptions, type AgentExecutionOptions } from './core/agent';

// ============================================================================
// Events
// ============================================================================

export * from './events/event-types';
export { EventBus, getGlobalEventBus, TypedEventEmitter } from './events/event-bus';

// ============================================================================
// Hooks
// ============================================================================

export * from './hooks/hook-types';
export { HookManager, createHookManager } from './hooks/hook-manager';
export { RuleEngine, createRuleEngine } from './hooks/rule-engine';

// ============================================================================
// LLM Layer
// ============================================================================

export * from './llm/provider-interface';
export { CircuitBreaker, createCircuitBreaker } from './llm/circuit-breaker';
export { FallbackManager, createFallbackManager } from './llm/fallback-manager';
export { ResponseCache, createResponseCache } from './llm/response-cache';
export { TokenTracker, createTokenTracker } from './llm/token-tracker';
export { AnthropicProvider, OpenAICompatibleProvider, createOpenAIProvider, createOpenRouterProvider, createOllamaProvider, createZaiProvider } from './llm/providers/index';

// ============================================================================
// Tools
// ============================================================================

export * from './tools/tool-registry';
export * from './tools/tool-cache';
export * from './tools/rate-limiter';
export * from './tools/tool-executor';

// ============================================================================
// Session Management
// ============================================================================

export * from './session/session-manager';
export * from './session/context-compactor';
export * from './session/conversation-store';

// ============================================================================
// Execution Engine
// ============================================================================

export * from './execution/thinking-engine';
export * from './execution/completion-promise';
export * from './execution/react-loop';

// ============================================================================
// Streaming
// ============================================================================

export * from './streaming/block-streamer';
export * from './streaming/channel-manager';

// ============================================================================
// Errors
// ============================================================================

export * from './errors/error-types';
export * from './errors/error-recovery';

// ============================================================================
// Plugins
// ============================================================================

export * from './plugins/plugin-interface';
export * from './plugins/plugin-loader';
