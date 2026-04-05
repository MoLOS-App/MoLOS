/**
 * Agent Loop State Types - State types and configuration for the agent loop
 *
 * This module provides the core state types used by AgentLoop:
 * - AgentLoopState: Internal state tracking for loop execution
 * - AgentRunResult: Result returned after a complete agent run
 * - LLMProviderClient: Interface for LLM provider communication
 *
 * Also re-exports error types for backward compatibility.
 */

// Import state types from turn module
import type { Turn, TurnResult } from './turn.js';

// Import types from the main types index
import type { AgentMessage, LlmRequest, LlmResponse } from '../types/index.js';

// Import and re-export AgentError for backward compatibility
import type { AgentError } from '../errors/index.js';
export type { AgentError };

/**
 * Result returned after a complete agent run
 */
export interface AgentRunResult {
	messages: AgentMessage[];
	finalOutput: string;
	iterations: number;
	turns: TurnResult[];
	error?: AgentError;
	usage?: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
}

/**
 * Internal state tracking for the agent loop
 */
export interface AgentLoopState {
	running: boolean;
	currentTurn: Turn | null;
	iteration: number;
	turnCount: number;
	toolCallCount: number;
	accumulatedUsage: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
	seq: number;
	overflowCompactionAttempts: number;
	retryCount: number;
	lastError: AgentError | null;
	panicCount: number;
}

/**
 * Provider interface for LLM calls
 */
export interface LLMProviderClient {
	chat(request: LlmRequest): Promise<LlmResponse>;
}

/**
 * Usage statistics for an agent run
 */
export interface AgentUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
}

/**
 * Default initial state factory for AgentLoopState
 */
export function createInitialAgentLoopState(): AgentLoopState {
	return {
		running: false,
		currentTurn: null,
		iteration: 0,
		turnCount: 0,
		toolCallCount: 0,
		accumulatedUsage: {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0
		},
		seq: 0,
		overflowCompactionAttempts: 0,
		retryCount: 0,
		lastError: null,
		panicCount: 0
	};
}
