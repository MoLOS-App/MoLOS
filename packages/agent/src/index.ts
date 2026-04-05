/**
 * MoLOS Agent Package - Main Entry Point
 *
 * A modular agent system with multi-provider support,
 * tool execution, and multi-agent coordination.
 */

// Re-export everything from types
export * from './types/index.js';

// Re-export structured error classes
export * from './errors/index.js';

// Re-export from core modules
export {
	createAgentLoop,
	type AgentLoop,
	type LLMProviderClient,
	// Streaming types and utilities
	type StreamChunk,
	type StreamContext,
	type StreamMiddleware,
	type StreamResult,
	streamingMiddlewares
} from './core/agent-loop.js';

// Export types from agent-loop-state
export type { AgentRunResult } from './core/agent-loop-state.js';

// Export types from error-recovery
export type { AgentError } from './core/error-recovery.js';

export {
	createTurnManager,
	type TurnManager,
	type Turn,
	type TurnResult,
	type SubTurn,
	type SubTurnResult,
	type TurnStatus,
	type SpawnConfig as TurnSpawnConfig,
	type TurnManagerConfig
} from './core/turn.js';

export {
	createSessionStore,
	createEphemeralSessionStore,
	type Session,
	type SessionStore,
	type SessionConfig
} from './core/session.js';

export {
	createContextBuilder,
	type ContextBuilder,
	type ContextBuilderConfig,
	type Skill,
	type SkillsLoader,
	type SkillSearchResult
} from './core/context.js';

// Re-export from tools module
export {
	ToolRegistry,
	type Tool,
	type ToolEntry,
	type ToolRegistryConfig,
	type ToolContext,
	type ToolSearchResult,
	type HiddenToolSnapshot,
	type HiddenToolDoc
} from './tools/index.js';

export { BM25Engine, BM25SearchTool, RegexSearchTool, type BM25Config } from './tools/index.js';

export {
	ToolResultCache,
	wrapToolDefinition,
	convertTools,
	wrapToolWithHooks,
	buildCacheKey,
	type ToolWrapperOptions
} from './tools/index.js';

export {
	convertSchemaToZod,
	createZodSchemaFromParams,
	inferZodType,
	validateToolArgs,
	type ParamSchema
} from './tools/index.js';

// Re-export from providers module
export {
	createProvider,
	mapProvider,
	getProviderOptions,
	expandMultiKeyModels,
	extractProtocol,
	modelConfigFromString,
	validateModelConfig,
	createProviderConfigFromEnv,
	getProviderApiKeys,
	PROTOCOL_DEFAULTS,
	type LlmProvider,
	type ProviderConfig,
	type ModelConfig,
	type ThinkingLevel,
	type ProviderOptions
} from './providers/index.js';

export {
	CooldownTracker,
	getStandardCooldown,
	getBillingCooldown,
	formatCooldownDuration,
	isRetriableReason,
	describeFailoverReason,
	type CooldownEntry,
	type CooldownTrackerConfig,
	type FailoverReason
} from './providers/index.js';

export {
	ErrorClassifier,
	createErrorClassifier,
	classifyError,
	FailoverError,
	classify,
	isRetriable,
	type ClassifiedError,
	type ErrorClassifierConfig,
	DEFAULT_PATTERNS
} from './providers/index.js';

export {
	FallbackChain,
	createFallbackChain,
	FallbackExhaustedError,
	parseModelRef,
	resolveCandidates,
	modelKey,
	type FallbackCandidate,
	type FallbackAttempt,
	type FallbackResult,
	type FallbackChainConfig,
	type ProviderRunResult,
	type ProviderRunFunction
} from './providers/index.js';

// Re-export from hooks module (enhanced hook manager)
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
} from './hooks/index.js';

// Re-export from events module
export {
	EventBus,
	createEventBus,
	getGlobalEventBus,
	type EventBusConfig,
	type EventStream,
	type EventSubscriber,
	type AgentEvent
} from './events/index.js';

export type {
	AgentStartEvent,
	AgentEndEvent,
	MessageStartEvent,
	MessageUpdateEvent,
	MessageEndEvent,
	ToolExecutionStartEvent,
	ToolExecutionUpdateEvent,
	ToolExecutionEndEvent,
	AutoCompactionStartEvent,
	AutoCompactionEndEvent,
	ErrorEvent
} from './events/index.js';

export {
	isAgentStartEvent,
	isAgentEndEvent,
	isMessageStartEvent,
	isMessageEndEvent,
	isToolExecutionStartEvent,
	isToolExecutionEndEvent,
	isAutoCompactionStartEvent,
	isAutoCompactionEndEvent,
	isErrorEvent
} from './events/index.js';

// Re-export from multi-agent module
export {
	// Registry
	ModuleRegistry,
	getModuleRegistry,
	resetModuleRegistry,
	createModuleRegistry,
	type ModuleAgentConfig,
	type ModuleCapabilities,
	type ModuleHealthStatus,
	// Spawn
	SubagentSpawner,
	getSubagentSpawner,
	createSubagentSpawner,
	resetSubagentSpawner,
	validateSpawnParams,
	type SpawnParams,
	type SpawnContext,
	type SpawnResult,
	type SubagentRunRecord,
	// Announce
	SubagentAnnouncer,
	createSubagentAnnouncer,
	type AnnounceParams,
	type AnnouncementResult,
	// Legacy exports (deprecated)
	createAgentRegistry,
	type AgentRegistry,
	spawnAgent,
	validateSpawnOptions,
	type SpawnConfig,
	type SpawnOptions,
	type SpawnLegacyResult,
	createAnnouncer,
	type AgentAnnouncement,
	type Announcer
} from './multi-agent/index.js';
