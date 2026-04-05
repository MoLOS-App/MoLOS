/**
 * Core Agent Components
 *
 * ## Package Overview
 * This module exports the core building blocks for the MoLOS Agent system:
 *
 * ### Agent Loop (`agent-loop.ts`)
 * Main orchestration engine that runs the agent execution lifecycle:
 * - Turn management with retry and recovery
 * - Tool execution with timeout and hooks
 * - Context overflow handling (compaction + truncation)
 * - Streaming middleware pipeline
 *
 * ### Turn Management (`turn.ts`)
 * Handles the lifecycle of turns and sub-turns:
 * - Turn: One user message + all LLM calls + tool executions
 * - Sub-turn: A single LLM call within a turn
 * - Enables recursive tool calling up to maxSubTurnDepth
 *
 * ### Session Management (`session.ts`)
 * Manages conversation sessions and message history:
 * - InMemorySessionStore: Persistent sessions with optional disk storage
 * - EphemeralSessionStore: Lightweight temporary sessions (for subagents)
 * - History sanitization for provider compatibility
 *
 * ### Context Building (`context.ts`)
 * Constructs system prompts and message context:
 * - Mtime-based caching for system prompts
 * - Two-pass history sanitization
 * - Skills loading from workspace/global/builtin tiers
 * - Dynamic context (time, session, runtime info)
 *
 * ### Hooks (`hooks.ts`)
 * Extensibility system for agent interception:
 * - before/after LLM call hooks
 * - Tool approval hooks
 * - Turn lifecycle hooks
 *
 * ### Streaming (`streaming.ts`)
 * Streaming middleware pipeline for LLM response streams:
 * - StreamChain for middleware composition
 * - Built-in middlewares for sanitization, trimming, and repair
 * - Stream chunk types for text deltas and tool calls
 *
 * ### Agent Loop State (`agent-loop-state.ts`)
 * State types and configuration for the agent loop:
 * - AgentLoopState: Internal state tracking for loop execution
 * - AgentRunResult: Result returned after a complete agent run
 * - LLMProviderClient: Interface for LLM provider communication
 *
 * ### Error Recovery (`error-recovery.ts`)
 * Standalone error handling and recovery logic:
 * - Error classification and retry handling
 * - Panic recovery with exponential backoff
 * - Context overflow compaction triggers
 *
 * ### Context Manager (`context-manager.ts`)
 * Context overflow handling and compaction logic:
 * - Tool result truncation (head+tail strategy)
 * - Context estimation and compaction
 * - Force compression at turn boundaries
 *
 * ## Quick Start
 * ```typescript
 * import {
 *   AgentLoop,
 *   createTurnManager,
 *   createSessionStore,
 *   createContextBuilder
 * } from './core/index.js';
 *
 * const loop = new AgentLoop({
 *   provider: myLlmProvider,
 *   tools: myToolDefs,
 *   workspace: '/path/to/workspace'
 * });
 *
 * loop.setToolExecutor(async (tool, args) => {
 *   // Execute tool
 *   return { toolName: tool.name, success: true, output: 'result' };
 * });
 *
 * const result = await loop.run([], 'Hello, agent!');
 * ```
 *
 * ## Architecture Diagram
 * ```
 * AgentLoop
 * ├── TurnManager (turn lifecycle)
 * │   └── Turn → SubTurn[]
 * ├── SessionStore (message history)
 * │   └── Session → AgentMessage[]
 * ├── ContextBuilder (prompt construction)
 * │   ├── System prompt (cached)
 * │   ├── Skills loader
 * │   └── Memory context
 * └── HookManager (extensibility)
 *     ├── LLM hooks
 *     └── Tool approval
 * ```
 *
 * ## AI Context Optimization Tips
 * 1. **Reuse AgentLoop**: Don't create new instances per turn
 * 2. **Set tool executor once**: Avoid repeated executor setup
 * 3. **Use session stores**: Session history management handles truncation
 * 4. **Leverage caching**: ContextBuilder caches prompts by mtime
 * 5. **Configure limits**: Set maxIterations, maxTurns to prevent runaway loops
 */

// Re-export from types for convenience
export type {
	AgentMessage,
	ToolDefinition,
	ToolResult,
	ToolCall,
	LlmProvider,
	LlmRequest,
	LlmResponse
} from '../types/index.js';

// Agent Loop
export { AgentLoop, createAgentLoop } from './agent-loop.js';

// Turn Management
export {
	createTurnManager,
	type Turn,
	type TurnResult,
	type SubTurn,
	type SubTurnResult,
	type TurnStatus,
	type SpawnConfig,
	type TurnManagerConfig,
	type TurnManager
} from './turn.js';

// Turn helper functions
export {
	hasExceededMaxToolCalls,
	getTotalToolCalls,
	getTotalToolResults,
	areAllSubTurnsComplete,
	getRunningSubTurns,
	getTurnDurationMs
} from './turn.js';

// Session Management
export {
	createSessionStore,
	createEphemeralSessionStore,
	type Session,
	type SessionStore,
	type SessionConfig,
	type SessionStoreConfig
} from './session.js';

export {
	MAX_EPHEMERAL_HISTORY,
	sanitizeHistory,
	formatSession,
	isSessionStale
} from './session.js';

// Context Building
export {
	createContextBuilder,
	type ContextBuilder,
	type ContextBuilderConfig,
	type Skill,
	type SkillMeta,
	type SkillsLoader,
	type SkillSearchResult,
	type SystemPromptResult,
	type ContextResult
} from './context.js';

// Hooks
export {
	createHookManager,
	type HookManager,
	type Hook,
	type HookContext,
	type HookEvent,
	type HookHandler,
	onTurnStart,
	onTurnEnd,
	onToolCall,
	onToolResult,
	onError
} from './hooks.js';

// =============================================================================
// Streaming
// =============================================================================
export {
	StreamChain,
	type StreamChunk,
	type StreamContext,
	type StreamMiddleware,
	type StreamResult,
	streamingMiddlewares
} from './streaming.js';

// =============================================================================
// Agent Loop State
// =============================================================================
export {
	type AgentLoopState,
	type AgentRunResult,
	type LLMProviderClient,
	type AgentUsage,
	createInitialAgentLoopState
} from './agent-loop-state.js';

// =============================================================================
// Error Recovery
// =============================================================================
export {
	classifyError,
	classifyErrorWithRecovery,
	isRetryableError,
	handleRetriableError,
	runWithPanicRecovery,
	mapErrorToProviderErrorType,
	createErrorRecoveryContext,
	type AgentError,
	type ClassifiedError,
	type ErrorRecoveryContext,
	type ProviderErrorType,
	type RecoveryAction
} from './error-recovery.js';

// =============================================================================
// Context Manager
// =============================================================================
export {
	calculateMaxToolResultChars,
	getToolResultTextLength,
	hasImportantTail,
	truncateToolResultText,
	truncateToolResultsIfNeeded,
	toolResultsLikelyOversized,
	estimateContextWindow,
	shouldCompact as shouldCompactContext,
	compactContext,
	createCompactionSummary,
	forceCompression
} from './context-manager.js';
