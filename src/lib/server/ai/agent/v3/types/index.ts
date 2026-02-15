/**
 * Core Types for V3 (AI SDK-based) Agent
 *
 * These types are designed to work with Vercel AI SDK while preserving
 * the MoLOS-specific features like hooks, events, and telemetry.
 */

import type { ToolSet, ModelMessage } from 'ai';
import { z } from 'zod';

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Supported LLM providers
 */
export type LlmProvider = 'anthropic' | 'openai' | 'openrouter' | 'ollama' | 'zai';

/**
 * Provider configuration
 */
export interface ProviderConfig {
	provider: LlmProvider;
	modelName: string;
	apiKey?: string;
	baseUrl?: string;
}

// ============================================================================
// Agent Configuration Types
// ============================================================================

/**
 * Thinking level for reasoning depth
 */
export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high';

/**
 * MoLOS Agent configuration
 */
export interface MoLOSAgentConfig {
	/** User ID */
	userId: string;
	/** LLM provider instance (AI SDK LanguageModelV1) */
	model: unknown; // LanguageModelV1 from AI SDK
	/** System prompt */
	systemPrompt: string;
	/** Maximum number of steps/iterations */
	maxSteps: number;
	/** Maximum duration in milliseconds */
	maxDurationMs?: number;
	/** Thinking level for Anthropic models */
	thinkingLevel?: ThinkingLevel;
	/** Enable streaming */
	streamEnabled?: boolean;
	/** Enable telemetry collection */
	telemetryEnabled?: boolean;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Tool call information
 */
export interface ToolCallInfo {
	id: string;
	name: string;
	parameters: Record<string, unknown>;
}

/**
 * Message role
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Agent message (compatible with AI SDK CoreMessage)
 */
export interface AgentMessage {
	role: MessageRole;
	content: string | unknown;
	toolCalls?: ToolCallInfo[];
	toolCallId?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Process options for message handling
 */
export interface ProcessOptions {
	/** Override max steps */
	maxSteps?: number;
	/** Override max duration */
	maxDurationMs?: number;
	/** Enable streaming */
	streamEnabled?: boolean;
	/** Progress callback */
	onProgress?: (event: ProgressEvent) => void | Promise<void>;
	/** Custom system prompt override */
	systemPrompt?: string;
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Tool parameter schema (JSON Schema format from v2)
 */
export interface ToolParameterSchema {
	type?: string;
	properties?: Record<string, unknown>;
	required?: string[];
}

/**
 * Tool definition (v2 compatible)
 */
export interface ToolDefinition {
	name: string;
	description: string;
	parameters?: ToolParameterSchema;
	execute?: (params: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
	success: boolean;
	result: unknown;
	error?: string;
	durationMs: number;
	cached?: boolean;
}

// ============================================================================
// Event Types (Preserved from v2)
// ============================================================================

/**
 * Progress event type for streaming to UI
 */
export type ProgressEventType =
	| 'plan'
	| 'step_start'
	| 'step_complete'
	| 'step_failed'
	| 'thinking'
	| 'thought'
	| 'observation'
	| 'complete'
	| 'error'
	| 'text'
	| 'tool_start'
	| 'tool_complete'
	| 'message_segment';

/**
 * Progress event for streaming to UI
 */
export interface ProgressEvent {
	type: ProgressEventType;
	timestamp: number;
	data: Record<string, unknown>;
}

/**
 * Agent event for tracking
 */
export interface AgentEvent {
	type: string;
	timestamp: number;
	data: Record<string, unknown>;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Agent action for UI display
 */
export interface AgentAction {
	type: 'read' | 'write' | 'plan' | 'think' | 'error';
	entity: string;
	description: string;
	status: 'pending' | 'executed' | 'failed';
	data: Record<string, unknown>;
}

/**
 * Telemetry data
 */
export interface AgentTelemetry {
	runId: string;
	startMs: number;
	endMs?: number;
	durationMs: number;
	totalSteps: number;
	successfulSteps: number;
	failedSteps: number;
	tokenEstimateIn: number;
	tokenEstimateOut: number;
	llmCalls: number;
	cacheHits: number;
	cacheMisses: number;
	errors: number;
}

/**
 * Agent execution result
 */
export interface ExecutionResult {
	success: boolean;
	message: string;
	actions: AgentAction[];
	telemetry: AgentTelemetry;
	events: AgentEvent[];
}

// ============================================================================
// Multi-Agent Types
// ============================================================================

/**
 * Agent message for inter-agent communication
 */
export interface InterAgentMessage {
	id: string;
	fromAgent: string;
	toAgent: string;
	type: 'request' | 'response' | 'delegation' | 'result';
	payload: {
		task: string;
		context?: Record<string, unknown>;
		tools?: ToolDefinition[];
	};
	metadata: {
		correlationId: string;
		timestamp: number;
		priority: 'low' | 'normal' | 'high';
	};
}

/**
 * Module agent configuration
 */
export interface ModuleAgentConfig {
	id: string;
	name: string;
	baseUrl: string;
	capabilities: string[];
	description: string;
}

/**
 * Module agent result
 */
export interface ModuleAgentResult {
	success: boolean;
	result: unknown;
	message: string;
	actions?: AgentAction[];
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
	| { ok: true; value: T }
	| { ok: false; error: E };

/**
 * Creates a successful result
 */
export function Ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

/**
 * Creates a failed result
 */
export function Err<E>(error: E): Result<never, E> {
	return { ok: false, error };
}

// ============================================================================
// Type Conversion Utilities
// ============================================================================

/**
 * Convert v2 AgentMessage to AI SDK ModelMessage
 */
export function toModelMessage(message: AgentMessage): ModelMessage {
	if (message.role === 'tool') {
		return {
			role: 'tool',
			content: [
				{
					type: 'tool-result' as const,
					toolCallId: message.toolCallId || '',
					result: message.content,
				},
			],
		} as unknown as ModelMessage;
	}

	return {
		role: message.role,
		content: message.content as string,
	} as ModelMessage;
}

/**
 * Convert array of v2 AgentMessage to AI SDK ModelMessage[]
 */
export function toModelMessages(messages: AgentMessage[]): ModelMessage[] {
	return messages.map(toModelMessage);
}

// Alias for backward compatibility
export const toCoreMessage = toModelMessage;
export const toCoreMessages = toModelMessages;
