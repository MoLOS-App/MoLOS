/**
 * MoLOS Agent - AI SDK-based implementation
 *
 * The main agent class that uses Vercel AI SDK for LLM interactions
 * while preserving MoLOS-specific features (hooks, events, telemetry).
 *
 * Supports multi-message streaming where the agent can send multiple
 * sequential messages before/during/after tool calls.
 */

import {
	streamText,
	stepCountIs,
	type ModelMessage,
	type ToolSet,
	type StreamTextResult,
} from 'ai';
import type {
	MoLOSAgentConfig,
	AgentMessage,
	ExecutionResult,
	ProgressEvent,
	AgentAction,
	AgentTelemetry,
	ToolDefinition,
	ProcessOptions,
	ThinkingLevel,
} from '../types';
import { toModelMessages } from '../types';
import { convertToolsToAiSdk, type ToolWrapperOptions } from '../tools';
import { getProviderOptions } from '../providers';
import { EventBus, getGlobalEventBus } from '../events/event-bus';
import { createHookManager, type HookManager } from '../hooks/hook-manager';
import {
	ModuleRegistry,
	getModuleRegistry,
} from '../multi-agent';
import type { ModuleAgentConfig } from '../types';

/**
 * Message segment - represents a partial message from the agent
 */
export interface MessageSegment {
	id: string;
	content: string;
	isComplete: boolean;
	timestamp: number;
}

/**
 * Generate a unique run ID
 */
function generateRunId(): string {
	return `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Build telemetry from execution
 */
function buildTelemetry(
	runId: string,
	startMs: number,
	steps: Array<{ toolCalls: unknown[]; usage?: { promptTokens: number; completionTokens: number } }>
): AgentTelemetry {
	const endMs = Date.now();
	const totalSteps = steps.length;
	const tokenEstimateIn = steps.reduce((sum, s) => sum + (s.usage?.promptTokens || 0), 0);
	const tokenEstimateOut = steps.reduce((sum, s) => sum + (s.usage?.completionTokens || 0), 0);

	return {
		runId,
		startMs,
		endMs,
		durationMs: endMs - startMs,
		totalSteps,
		successfulSteps: totalSteps, // TODO: Track actual success/failure
		failedSteps: 0,
		tokenEstimateIn,
		tokenEstimateOut,
		llmCalls: steps.length,
		cacheHits: 0,
		cacheMisses: 0,
		errors: 0,
	};
}

/**
 * Extract actions from steps
 */
function extractActions(
	steps: Array<{ toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>; toolResults?: Array<{ toolName: string; result: unknown; isError?: boolean }> }>
): AgentAction[] {
	const actions: AgentAction[] = [];

	for (const step of steps) {
		for (const toolCall of step.toolCalls || []) {
			const result = step.toolResults?.find((r) => r.toolName === toolCall.toolName);

			actions.push({
				type: 'read', // Default to read, could be enhanced
				entity: toolCall.toolName,
				description: `Tool call: ${toolCall.toolName}`,
				status: result?.isError ? 'failed' : 'executed',
				data: {
					input: toolCall.input,
					result: result?.result,
				},
			});
		}
	}

	return actions;
}

/**
 * MoLOS Agent configuration with additional options
 */
export interface MoLOSAgentInitConfig extends MoLOSAgentConfig {
	/** Hook manager instance */
	hookManager?: HookManager;
	/** Event bus instance */
	eventBus?: EventBus;
	/** Module agents for multi-agent delegation */
	moduleAgents?: ModuleAgentConfig[];
	/** Tool wrapper options */
	toolWrapperOptions?: ToolWrapperOptions;
}

/**
 * MoLOS Agent - The Architect agent that orchestrates AI interactions
 *
 * This agent:
 * 1. Uses Vercel AI SDK for LLM communication
 * 2. Preserves the hook system from v2
 * 3. Emits events to the EventBus for UI updates
 * 4. Supports multi-agent delegation via tools
 */
export class MoLOSAgent {
	private config: MoLOSAgentInitConfig;
	private tools: ToolSet = {};
	private hookManager: HookManager;
	private eventBus: EventBus;
	private moduleRegistry: ModuleRegistry;

	constructor(config: MoLOSAgentInitConfig) {
		this.config = config;
		this.hookManager = config.hookManager || createHookManager({ debug: false });
		this.eventBus = config.eventBus || getGlobalEventBus();
		this.moduleRegistry = getModuleRegistry();

		// Register module agents if provided
		if (config.moduleAgents) {
			for (const module of config.moduleAgents) {
				this.moduleRegistry.register(module);
			}
		}
	}

	/**
	 * Register tools for the agent to use
	 */
	registerTools(tools: ToolDefinition[]): void {
		const wrapperOptions: ToolWrapperOptions = {
			hookManager: this.hookManager,
			eventBus: this.eventBus,
			enableCache: this.config.toolWrapperOptions?.enableCache ?? true,
			cacheTtlMs: this.config.toolWrapperOptions?.cacheTtlMs ?? 60000,
		};

		// Convert v2 tools to AI SDK format
		this.tools = {
			...this.tools,
			...convertToolsToAiSdk(tools, wrapperOptions),
		};

		// Add module delegation tools
		if (this.moduleRegistry.size > 0) {
			this.tools = {
				...this.tools,
				...this.moduleRegistry.getDelegationTools(),
			};
		}
	}

	/**
	 * Process a user message and return the result
	 */
	async processMessage(
		content: string,
		messages: AgentMessage[],
		options: ProcessOptions = {}
	): Promise<ExecutionResult> {
		const startTime = Date.now();
		const runId = generateRunId();

		// Build system prompt with module descriptions
		const systemPrompt = options.systemPrompt ?? this.buildSystemPrompt();

		// Convert messages to AI SDK format
		const modelMessages: ModelMessage[] = [
			...toModelMessages(messages),
			{ role: 'user', content },
		];

		// Get provider-specific options
		const providerOptions = getProviderOptions(
			'anthropic', // Default, should be passed in config
			{
				thinkingLevel: this.config.thinkingLevel as ThinkingLevel | undefined,
			}
		);

		// Track progress events
		const events: Array<{ type: string; timestamp: number; data: Record<string, unknown> }> = [];
		let stepCounter = 0;
		const maxSteps = options.maxSteps ?? this.config.maxSteps ?? 20;

		console.log(`[MoLOSAgent ${runId}] Starting processMessage with streaming: ${options.streamEnabled ?? this.config.streamEnabled}`);

		try {
			// Create the stream
			const result = streamText({
				model: this.config.model as any, // LanguageModelV1
				system: systemPrompt,
				messages: modelMessages,
				tools: this.tools,
				stopWhen: stepCountIs(maxSteps),
				...providerOptions,
				onStepFinish: async (step) => {
					stepCounter++;
					const toolNames = step.toolCalls?.map((tc: any) => tc.toolName) || [];

					console.log(`[MoLOSAgent ${runId}] Step ${stepCounter} finished:`, {
						toolCalls: toolNames,
						textLength: step.text?.length
					});

					// Determine step description based on what happened
					let description = 'Processing';
					if (toolNames.length > 0) {
						description = `Calling ${toolNames.join(', ')}`;
					} else if (step.text) {
						description = 'Generating response';
					}

					// Emit step event to event bus with proper structure
					const eventData = {
						toolCalls: step.toolCalls,
						usage: step.usage,
						text: step.text,
						stepNumber: stepCounter,
						totalSteps: maxSteps,
						description,
					};

					// Track for telemetry
					events.push({
						type: 'step_complete',
						timestamp: Date.now(),
						data: eventData,
					});

					// Emit to event bus
					this.eventBus.emitSync({
						type: 'step_complete',
						timestamp: Date.now(),
						data: eventData,
					} as any);

					// Call progress callback if provided
					if (options.onProgress) {
						await options.onProgress({
							type: 'step_complete',
							timestamp: Date.now(),
							data: eventData,
						});
					}
				},
			});

			// Handle streaming if enabled - AWAIT the streaming to ensure events are sent
			if (options.streamEnabled ?? this.config.streamEnabled) {
				console.log(`[MoLOSAgent ${runId}] Starting streamToEventBus`);
				// Stream to event bus - this iterates through the full stream
				// We need to do this in parallel with getting the response
				const streamingPromise = this.streamToEventBus(result, runId, options.onProgress);

				// Get final response while streaming happens
				const response = await result.response;
				const text = await result.text;
				const steps = await result.steps;

				// Wait for streaming to complete
				await streamingPromise;

				console.log(`[MoLOSAgent ${runId}] Streaming complete, text length: ${text?.length}`);

				// Build telemetry
				const telemetry = buildTelemetry(runId, startTime, steps as any);

				// Extract actions
				const actions = extractActions(steps as any);

				return {
					success: true,
					message: text,
					actions,
					telemetry,
					events: events.map((e) => ({
						type: e.type,
						timestamp: e.timestamp,
						data: e.data,
					})),
				};
			}

			// Non-streaming path
			const response = await result.response;
			const text = await result.text;
			const steps = await result.steps;

			// Build telemetry
			const telemetry = buildTelemetry(runId, startTime, steps as any);

			// Extract actions
			const actions = extractActions(steps as any);

			return {
				success: true,
				message: text,
				actions,
				telemetry,
				events: events.map((e) => ({
					type: e.type,
					timestamp: e.timestamp,
					data: e.data,
				})),
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			return {
				success: false,
				message: `Error: ${errorMessage}`,
				actions: [],
				telemetry: {
					runId,
					startMs: startTime,
					endMs: Date.now(),
					durationMs: Date.now() - startTime,
					totalSteps: 0,
					successfulSteps: 0,
					failedSteps: 1,
					tokenEstimateIn: 0,
					tokenEstimateOut: 0,
					llmCalls: 0,
					cacheHits: 0,
					cacheMisses: 0,
					errors: 1,
				},
				events: [
					{
						type: 'error',
						timestamp: Date.now(),
						data: { error: errorMessage },
					},
				],
			};
		}
	}

	/**
	 * Stream results to event bus with message segment tracking
	 *
	 * This enables multi-message streaming where the agent can send
	 * multiple sequential messages before/during/after tool calls.
	 */
	private async streamToEventBus(
		result: StreamTextResult<any, any>,
		runId: string,
		onProgress?: (event: ProgressEvent) => void | Promise<void>
	): Promise<void> {
		// Track message segments
		let currentSegmentId = `seg_${runId}_0`;
		let currentSegmentContent = '';
		let segmentIndex = 0;
		let chunkCount = 0;

		console.log(`[MoLOSAgent ${runId}] streamToEventBus started`);

		const emitSegment = async (isComplete: boolean) => {
			if (currentSegmentContent.trim()) {
				console.log(`[MoLOSAgent ${runId}] Emitting segment ${segmentIndex}: ${currentSegmentContent.length} chars`);

				const event: ProgressEvent = {
					type: 'message_segment',
					timestamp: Date.now(),
					data: {
						id: currentSegmentId,
						content: currentSegmentContent,
						isComplete,
						segmentIndex,
					},
				};

				// Emit to event bus
				this.eventBus.emitSync({
					type: event.type as any,
					timestamp: event.timestamp,
					data: event.data,
				} as any);

				// Call progress callback
				if (onProgress) {
					await onProgress(event);
				}

				// Start new segment if this one is complete
				if (isComplete) {
					segmentIndex++;
					currentSegmentId = `seg_${runId}_${segmentIndex}`;
					currentSegmentContent = '';
				}
			}
		};

		try {
			for await (const chunk of result.fullStream) {
				chunkCount++;
				const event: ProgressEvent = {
					type: 'text',
					timestamp: Date.now(),
					data: {},
				};

				switch (chunk.type) {
					case 'text-delta':
						// Accumulate text for current segment
						currentSegmentContent += chunk.text;
						event.type = 'text';
						event.data = {
							delta: chunk.text,
							segmentId: currentSegmentId,
							segmentIndex,
						};

						// Emit text delta immediately for real-time streaming
						if (onProgress) {
							await onProgress(event);
						}
						break;

					case 'tool-call':
						console.log(`[MoLOSAgent ${runId}] Tool call: ${chunk.toolName}`);
						// Before tool call, finalize current segment if has content
						await emitSegment(true);

						event.type = 'tool_start';
						event.data = {
							toolName: chunk.toolName,
							toolCallId: chunk.toolCallId,
							input: chunk.input,
							segmentIndex,
						};

						// Call progress callback
						if (onProgress) {
							await onProgress(event);
						}
						break;

					case 'tool-result':
						console.log(`[MoLOSAgent ${runId}] Tool result: ${chunk.toolName}`);
						event.type = 'tool_complete';
						event.data = {
							toolName: chunk.toolName,
							toolCallId: chunk.toolCallId,
							result: chunk.output,
							segmentIndex,
						};

						// Call progress callback
						if (onProgress) {
							await onProgress(event);
						}
						break;

					case 'error':
						console.error(`[MoLOSAgent ${runId}] Stream error:`, chunk.error);
						event.type = 'error';
						event.data = { error: chunk.error };

						// Call progress callback
						if (onProgress) {
							await onProgress(event);
						}
						break;

					case 'finish':
						console.log(`[MoLOSAgent ${runId}] Stream finish, total chunks: ${chunkCount}`);
						// Finalize any remaining content
						await emitSegment(true);

						event.type = 'complete';
						event.data = {
							finishReason: chunk.finishReason,
							usage: chunk.totalUsage,
							totalSegments: segmentIndex,
						};

						// Call progress callback
						if (onProgress) {
							await onProgress(event);
						}
						break;

					default:
						// Log unknown chunk types for debugging
						console.log(`[MoLOSAgent ${runId}] Unknown chunk type: ${chunk.type}`);
						continue;
				}
			}

			console.log(`[MoLOSAgent ${runId}] streamToEventBus complete, processed ${chunkCount} chunks`);
		} catch (error) {
			console.error(`[MoLOSAgent ${runId}] Stream iteration error:`, error);
		}
	}

	/**
	 * Build the system prompt with module descriptions
	 */
	private buildSystemPrompt(): string {
		const moduleDescriptions = this.moduleRegistry.getModuleDescriptions();

		let prompt = this.config.systemPrompt;

		if (this.moduleRegistry.size > 0) {
			prompt += `

# MODULE AGENTS
You are the MoLOS Architect Agent. Your role is to:
1. Understand user requests
2. Plan how to accomplish tasks
3. DELEGATE specific work to specialized module agents when appropriate

${moduleDescriptions}

IMPORTANT: You are the ARCHITECT. Do not try to do everything yourself.
When a task requires capabilities from a specific module, delegate to the appropriate module agent using the delegate_to_* tools.`;
		}

		return prompt;
	}

	/**
	 * Register a module agent for delegation
	 */
	registerModuleAgent(config: ModuleAgentConfig): void {
		this.moduleRegistry.register(config);
	}

	/**
	 * Get the event bus
	 */
	getEventBus(): EventBus {
		return this.eventBus;
	}

	/**
	 * Get the hook manager
	 */
	getHookManager(): HookManager {
		return this.hookManager;
	}
}

/**
 * Create a MoLOS agent instance
 */
export function createMoLOSAgent(config: MoLOSAgentInitConfig): MoLOSAgent {
	return new MoLOSAgent(config);
}
