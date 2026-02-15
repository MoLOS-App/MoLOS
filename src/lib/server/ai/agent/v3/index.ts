/**
 * MoLOS Agent V3 - AI SDK-based implementation
 *
 * This module exports the new AI SDK-based agent implementation
 * while preserving MoLOS-specific features:
 * - Hooks system (pre/post tool execution)
 * - EventBus for real-time events
 * - Telemetry and tracking
 * - Multi-agent delegation (Architect pattern)
 */

// Core agent
export { MoLOSAgent, createMoLOSAgent, type MoLOSAgentInitConfig } from './core/molos-agent';

// Types
export type {
	// Provider types
	LlmProvider,
	ProviderConfig,
	// Config types
	ThinkingLevel,
	MoLOSAgentConfig,
	// Message types
	MessageRole,
	AgentMessage,
	ProcessOptions,
	ToolCallInfo,
	// Tool types
	ToolParameterSchema,
	ToolDefinition,
	ToolExecutionResult,
	// Event types
	ProgressEventType,
	ProgressEvent,
	AgentEvent,
	// Result types
	AgentAction,
	AgentTelemetry,
	ExecutionResult,
	// Multi-agent types
	InterAgentMessage,
	ModuleAgentConfig,
	ModuleAgentResult,
	// Utility types
	Result,
} from './types';

export { Ok, Err, toCoreMessage, toCoreMessages, toModelMessage, toModelMessages } from './types';

// Providers
export { createProvider, mapProvider, getProviderOptions } from './providers';

// Tools
export {
	convertTypeBoxToZod,
	createZodSchemaFromParams,
	inferZodTypeFromJsonSchema,
	wrapToolWithHooks,
	convertToolsToAiSdk,
	clearToolCache,
	type ToolWrapperOptions,
} from './tools';

// Multi-agent
export {
	createDelegationTool,
	createModuleDelegationTools,
	createLocalModuleTool,
	generateModuleDescriptions,
	ModuleRegistry,
	getModuleRegistry,
	resetModuleRegistry,
	type ModuleHealthResponse,
	type DelegationRequest,
	type DelegationResponse,
	type ModuleCapabilitiesResponse,
} from './multi-agent';
