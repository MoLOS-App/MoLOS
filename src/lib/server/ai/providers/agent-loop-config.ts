/**
 * AgentLoop Configuration with Hooks
 *
 * Sets up AgentLoop with tool execution hooks for progress reporting.
 */

import { createAgentLoop, createHookManager } from '@molos/agent';
import type { LLMProviderClient, ToolDefinition } from '@molos/agent';

/**
 * Progress event types for UI updates
 */
export interface ProgressEvent {
	type:
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
	timestamp: number;
	data: Record<string, unknown>;
}

export interface AgentLoopConfig {
	provider: LLMProviderClient;
	tools: ToolDefinition[];
	maxIterations?: number;
	maxToolCallsPerTurn?: number;
	onProgress?: (event: ProgressEvent) => void;
}

/**
 * Lifecycle event types (mirrored from @molos/agent/hooks/lifecycle)
 */
interface ToolBeforeExecuteEvent {
	kind: 'tool:before_execute';
	toolName: string;
	arguments: Record<string, unknown>;
	sessionId?: string;
	runId: string;
	timestamp: number;
}

interface ToolAfterExecuteEvent {
	kind: 'tool:after_execute';
	toolName: string;
	arguments: Record<string, unknown>;
	result: {
		success: boolean;
		output?: string;
		error?: string;
	};
	durationMs: number;
	sessionId?: string;
	runId: string;
	timestamp: number;
}

interface ToolOnErrorEvent {
	kind: 'tool:on_error';
	toolName: string;
	arguments: Record<string, unknown>;
	error: string;
	errorType: 'timeout' | 'not_found' | 'denied' | 'execution_error' | 'unknown';
	sessionId?: string;
	runId: string;
	timestamp: number;
}

export function createAgentLoopWithHooks(config: AgentLoopConfig) {
	// Create hook manager
	const hookManager = createHookManager({});

	// Set up tool execution monitoring hooks
	// Note: registerLifecycleHooks exists on the HookManager class but may not be
	// reflected in the type definitions. Using type assertion for compatibility.
	(hookManager as any).registerLifecycleHooks({
		name: 'tool-progress-monitor',
		hooks: {
			onBeforeToolExecute: (event: ToolBeforeExecuteEvent) => {
				config.onProgress?.({
					type: 'tool_start',
					timestamp: Date.now(),
					data: {
						toolName: event.toolName,
						input: event.arguments
					}
				});
			},
			onAfterToolExecute: (event: ToolAfterExecuteEvent) => {
				config.onProgress?.({
					type: 'tool_complete',
					timestamp: Date.now(),
					data: {
						toolName: event.toolName,
						result: event.result.success ? event.result.output : { error: event.result.error }
					}
				});
			},
			onToolError: (event: ToolOnErrorEvent) => {
				config.onProgress?.({
					type: 'error',
					timestamp: Date.now(),
					data: {
						toolName: event.toolName,
						error: event.error
					}
				});
			}
		}
	});

	// Create the agent loop - use type assertion to handle the complex type hierarchy
	// where AgentConfig.provider is LlmProvider | undefined but we need LLMProviderClient
	const loop = createAgentLoop({
		...config,
		provider: config.provider as any,
		hookManager,
		maxIterations: config.maxIterations || 20,
		maxToolCallsPerTurn: config.maxToolCallsPerTurn || 100
	} as any);

	return loop;
}
