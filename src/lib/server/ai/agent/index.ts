/**
 * The Architect v2.0 - Main Agent Orchestrator
 *
 * A modular, autonomous AI agent using the ReAct pattern:
 * - Thought → Action → Observation → Reflection → Repeat
 *
 * Features:
 * - Streaming progress updates to UI
 * - Never returns empty messages
 * - Completes full plans before finishing
 * - Self-reflection and correction
 */

import { AiRepository } from '$lib/repositories/ai/ai-repository';
import { AiToolbox } from '../toolbox';
import type {
	AiSettings,
	AiMessage,
	AiAction,
	AiChatResponse
} from '$lib/models/ai';
import type {
	AgentOptions,
	ExecutionResult,
	ProgressEvent
} from './core/agent-types';
import type { AgentSnapshot } from './core/agent-state';

// Core modules
import { AgentStateManager } from './core/agent-state';
import { ResponseBuilder } from './core/response-builder';

// Planning modules
import { PlanGenerator } from './planning/plan-generator';
import { PlanTracker } from './planning/plan-tracker';

// Execution modules
import { ToolExecutor } from './execution/tool-executor';

// Reflection modules
import { SelfReflector } from './reflection/self-reflector';
import { CompletionVerifier } from './reflection/completion-verifier';

// Streaming modules
import { ProgressStreamer } from './streaming/progress-streamer';

// LLM modules
import { LlmClient } from './llm/llm-client';

// Utilities
import { getAgentRuntimeConfig } from '../runtime-config';
import { createTelemetry, estimateTokensFromMessages } from '../telemetry';
import {
	TtlCache,
	dedupeToolCalls,
	isWriteTool,
	normalizeToolParams,
	type ToolCall
} from '../agent-utils';
import { uuid } from '$lib/utils/uuid';

/**
 * The Architect v2.0 - Autonomous AI Agent
 */
export class AiAgent {
	private aiRepo: AiRepository;
	private toolbox: AiToolbox;
	private userId: string;
	private toolCache: TtlCache<unknown>;

	constructor(userId: string) {
		this.userId = userId;
		this.aiRepo = new AiRepository();
		this.toolbox = new AiToolbox();
		this.toolCache = new TtlCache<unknown>(Number(process.env.AI_AGENT_TOOL_CACHE_SIZE || 256));
	}

	/**
	 * Process a user message
	 * Main entry point for the agent
	 */
	async processMessage(
		content: string,
		sessionId: string,
		activeModuleIds: string[] = [],
		attachments?: unknown[],
		parts?: unknown[],
		options: AgentOptions = {}
	): Promise<AiChatResponse> {
		// Save user message
		await this.aiRepo.addMessage(this.userId, {
			role: 'user',
			content,
			sessionId,
			attachments: attachments as Array<{ name: string }> | undefined,
			parts
		});

		// Get settings and history
		const settings = await this.aiRepo.getSettings(this.userId);
		const history = await this.aiRepo.getMessages(sessionId, this.userId);

		if (!settings || !settings.apiKey) {
			return {
				message: 'I need an API key to function. Please configure your AI settings.'
			};
		}

		// Convert history to internal format
		const initialMessages = history.map((m) => ({
			role: m.role,
			content: m.content,
			toolCalls: m.toolCalls as unknown[] | undefined,
			toolCallId: m.toolCallId || undefined
		}));

		// Run the agent
		return await this.runAgent(content, sessionId, settings, initialMessages, activeModuleIds, options);
	}

	/**
	 * Run the agent with full autonomous execution
	 */
	private async runAgent(
		userContent: string,
		sessionId: string,
		settings: AiSettings,
		initialMessages: any[],
		activeModuleIds: string[],
		options: AgentOptions
	): Promise<AiChatResponse> {
		const runtime = getAgentRuntimeConfig(settings);
		const tools = await this.toolbox.getTools(this.userId, activeModuleIds);
		const { telemetry, events, recordEvent } = createTelemetry(uuid());

		// Initialize modules
		const stateManager = new AgentStateManager(this.userId, sessionId, initialMessages);
		const responseBuilder = new ResponseBuilder();
		const planGenerator = new PlanGenerator();
		const toolExecutor = new ToolExecutor(runtime.toolCacheSize, runtime.toolCacheTtlMs);
		const reflector = new SelfReflector();
		const verifier = new CompletionVerifier();
		const streamer = new ProgressStreamer();
		const llmClient = new LlmClient(settings, runtime);

		// Wire up streaming
		if (options.onProgress) {
			streamer.onProgress(options.onProgress);
		}

		recordEvent({ type: 'run_start', timestamp: Date.now() });

		try {
			// Phase 1: Planning (ReAct - Thought)
			let plan: any = null;
			try {
				plan = await this.generatePlan(
					userContent,
					tools,
					llmClient,
					planGenerator,
					streamer
				);
			} catch (planError) {
				// If plan generation fails due to LLM error, check if we should continue
				console.warn('[Agent] Plan generation error:', planError);
				if ((planError as any).code === 'llm_request_failed') {
					// LLM is not available - return helpful error immediately
					return {
						message: 'I\'m having trouble connecting to the AI service. Please check your API key in AI settings and try again.',
						actions: [],
						events: runtime.telemetryEnabled ? events : undefined,
						telemetry: runtime.telemetryEnabled ? telemetry : undefined
					};
				}
				// Otherwise continue without a plan
			}

			if (plan) {
				stateManager.setPlan(plan);
				await streamer.streamPlanCreated(plan);
			}

			// Phase 2: Execution Loop (ReAct - Action → Observation → Reflection)
			const result = await this.executePlanLoop(
				userContent,
				plan,
				tools,
				settings,
				runtime,
				stateManager,
				toolExecutor,
				reflector,
				verifier,
				streamer,
				llmClient,
				responseBuilder,
				recordEvent,
				telemetry
			);

			// Phase 3: Completion
			recordEvent({ type: 'run_end', timestamp: Date.now() });
			telemetry.durationMs = Date.now() - telemetry.startMs;

			await streamer.streamComplete({
				success: result.success,
				message: result.message,
				stepsCompleted: result.plan ? result.plan.steps.filter((s) => s.status === 'completed').length : 0,
				stepsTotal: result.plan?.steps.length || 0,
				durationMs: telemetry.durationMs
			});

			// Save final assistant message
			if (result.message && sessionId) {
				await this.aiRepo.addMessage(this.userId, {
					role: 'assistant',
					content: result.message,
					sessionId,
					contextMetadata: JSON.stringify({
						plan: result.plan,
						telemetry: runtime.telemetryEnabled ? telemetry : undefined,
						events: runtime.telemetryEnabled ? events : undefined
					})
				});
			}

			return {
				message: result.message,
				actions: result.actions as AiAction[],
				events: runtime.telemetryEnabled ? events : undefined,
				telemetry: runtime.telemetryEnabled ? telemetry : undefined
			};

		} catch (error) {
			console.error('Agent error:', error);
			telemetry.durationMs = Date.now() - telemetry.startMs;
			telemetry.errors += 1;

			const errorMessage = this.formatError(error);

			await streamer.streamError(errorMessage);

			return {
				message: errorMessage,
				actions: [],
				events: runtime.telemetryEnabled ? events : undefined,
				telemetry: runtime.telemetryEnabled ? telemetry : undefined
			};
		}
	}

	/**
	 * Generate a plan using the LLM
	 * Falls back to null if planning fails (agent will use ReAct loop)
	 */
	private async generatePlan(
		userContent: string,
		tools: any[],
		llmClient: LlmClient,
		planGenerator: PlanGenerator,
		streamer: ProgressStreamer
	): Promise<any> {
		const toolNames = tools.map((t) => t.name);

		try {
			// Only try to generate a plan if we have tools to use
			if (tools.length === 0) {
				console.log('[Agent] No tools available, skipping plan generation');
				return null;
			}

			await streamer.streamThinking("Let me break down your request into a plan...");

			const plan = await planGenerator.generatePlan(
				userContent,
				toolNames,
				async (prompt) => {
					const response = await llmClient.call([{ role: 'user', content: prompt }]);
					return response.content;
				}
			);

			if (plan && plan.steps && plan.steps.length > 0) {
				console.log(`[Agent] Generated plan with ${plan.steps.length} steps: ${plan.goal}`);
			}

			return plan;
		} catch (error) {
			console.warn('[Agent] Plan generation failed, will proceed without plan:', error);
			// Check if it's an API configuration error - return null to skip planning
			const err = error as any;
			if (err.code === 'llm_request_failed' || err.message?.includes('Provider returned error')) {
				console.log('[Agent] LLM API error detected - will skip plan generation and use direct execution');
			}
			return null;
		}
	}

	/**
	 * Execute the plan loop until complete
	 */
	private async executePlanLoop(
		userContent: string,
		plan: any,
		tools: any[],
		settings: AiSettings,
		runtime: any,
		stateManager: AgentStateManager,
		toolExecutor: ToolExecutor,
		reflector: SelfReflector,
		verifier: CompletionVerifier,
		streamer: ProgressStreamer,
		llmClient: LlmClient,
		responseBuilder: ResponseBuilder,
		recordEvent: (event: any) => void,
		telemetry: any
	): Promise<ExecutionResult> {
		const planTracker = plan ? new PlanTracker(plan) : null;
		const actions: any[] = [];
		const completionMessages: string[] = []; // Track what happened for the final summary

		if (planTracker) {
			planTracker.start();
		}

		let iterations = 0;
		const maxIterations = runtime.maxSteps;

		while (iterations < maxIterations) {
			iterations++;
			stateManager.incrementIteration();

			// Check duration
			if (Date.now() - telemetry.startMs > runtime.maxDurationMs) {
				return responseBuilder.buildExecutionResult({
					success: false,
					baseMessage: `I've been working on this for a while. Let me give you an update on what I've accomplished so far.`,
					actions,
					plan: planTracker?.getPlan() || null,
					telemetry,
					events: []
				});
			}

			// Get next step or use direct mode
			let step = planTracker ? planTracker.getNextStep() : null;

			// If no plan or plan complete, use direct ReAct loop
			if (!step) {
				return await this.executeReactLoop(
					userContent,
					tools,
					settings,
					runtime,
					stateManager,
					toolExecutor,
					streamer,
					llmClient,
					responseBuilder,
					recordEvent,
					telemetry,
					actions
				);
			}

			// Execute the step
			const stepResult = await this.executeStep(
				step,
				planTracker!,
				tools,
				toolExecutor,
				reflector,
				streamer,
				llmClient,
				completionMessages
			);

			actions.push(...stepResult.actions);

			// Check if plan is complete
			if (planTracker && planTracker.isComplete()) {
				planTracker.complete();
				break;
			}
		}

		// Build final result with LLM-generated summary
		const verification = verifier.verifyPlanComplete(planTracker?.getPlan() || null);

		// Generate a natural language summary of what was accomplished
		let summaryMessage = verification.reason;
		console.log('[Agent] Plan execution complete. Actions taken:', actions.length);
		console.log('[Agent] Verification result:', verification);
		console.log('[Agent] Completion messages:', completionMessages);

		if (actions.length > 0 || planTracker?.getPlan()) {
			try {
				await streamer.streamThinking("Preparing a summary of what I've accomplished...");

				const summaryPrompt = this.buildSummaryPrompt(
					userContent,
					actions,
					planTracker?.getPlan() || null,
					completionMessages
				);

				console.log('[Agent] Calling LLM for summary generation...');
				const llmResponse = await llmClient.call([{ role: 'user', content: summaryPrompt }]);
				console.log('[Agent] LLM summary response:', llmResponse.content?.substring(0, 200));

				if (llmResponse.content && llmResponse.content.trim().length > 0) {
					summaryMessage = llmResponse.content;
				} else {
					console.warn('[Agent] LLM returned empty summary, using fallback');
				}
			} catch (summaryError) {
				console.warn('[Agent] Failed to generate summary, using fallback:', summaryError);
				// Keep the default verification reason
			}
		}

		console.log('[Agent] Final summary message:', summaryMessage.substring(0, 200));

		return responseBuilder.buildExecutionResult({
			success: verification.isComplete,
			baseMessage: summaryMessage,
			actions,
			plan: planTracker?.getPlan() || null,
			telemetry,
			events: []
		});
	}

	/**
	 * Execute a single plan step
	 */
	private async executeStep(
		step: any,
		planTracker: PlanTracker,
		tools: any[],
		toolExecutor: ToolExecutor,
		reflector: SelfReflector,
		streamer: ProgressStreamer,
		llmClient: LlmClient,
		completionMessages: string[]
	): Promise<{ result: any; actions: any[] }> {
		const actions: any[] = [];
		// Use the step's position in the plan for the step number, not completed count
		const stepNumber = planTracker.getStepNumber(step.id);
		const totalSteps = planTracker.getTotalCount();

		await streamer.streamStepStarting(step, stepNumber, totalSteps);

		// Send a descriptive message about what we're doing
		await streamer.streamThinking(`[${stepNumber}/${totalSteps}] ${step.description}...`);

		planTracker.startStep(step.id);

		// If step has a tool, execute it
		if (step.toolName) {
			const tool = tools.find((t) => t.name === step.toolName);
			if (tool) {
				const result = await toolExecutor.executeTool(
					tool,
					{ id: uuid(), name: step.toolName, parameters: step.parameters || {} },
					this.userId
				);

				if (result.success) {
					planTracker.completeStep(step.id, result.result);
					await streamer.streamStepCompleted(step, stepNumber, totalSteps, result.result);

					// Track completion message for summary
					const completionMsg = `[${stepNumber}/${totalSteps}] ✓ ${step.description}`;
					completionMessages.push(completionMsg);
					await streamer.streamThinking(completionMsg);

					// Reflection
					const reflection = await reflector.reflectOnActionResult(
						{ ...step, status: 'completed' },
						result,
						planTracker.getPlan(),
						async (prompt) => {
							const response = await llmClient.call([{ role: 'user', content: prompt }]);
							return response.content;
						}
					);

					actions.push({
						type: 'read',
						entity: step.toolName,
						description: step.description,
						status: 'executed',
						data: { toolName: step.toolName, result: result.result }
					});

					return { result, actions };
				} else {
					planTracker.failStep(step.id, result.error || 'Execution failed');
					await streamer.streamStepFailed(step, stepNumber, totalSteps, result.error || 'Unknown error');

					// Track failure message for summary
					const failureMsg = `[${stepNumber}/${totalSteps}] ✗ Failed: ${step.description} - ${result.error || 'Unknown error'}`;
					completionMessages.push(failureMsg);
					await streamer.streamThinking(failureMsg);

					actions.push({
						type: 'error',
						entity: step.toolName,
						description: `Failed: ${step.description}`,
						status: 'failed',
						data: { error: result.error }
					});

					return { result: null, actions };
				}
			}
		}

		// No tool - this is a thinking/reasoning step
		await streamer.streamThinking(step.description);
		planTracker.completeStep(step.id, null);

		return { result: null, actions };
	}

	/**
	 * Execute direct ReAct loop (no plan)
	 */
	private async executeReactLoop(
		userContent: string,
		tools: any[],
		settings: AiSettings,
		runtime: any,
		stateManager: AgentStateManager,
		toolExecutor: ToolExecutor,
		streamer: ProgressStreamer,
		llmClient: LlmClient,
		responseBuilder: ResponseBuilder,
		recordEvent: (event: any) => void,
		telemetry: any,
		actions: any[]
	): Promise<ExecutionResult> {
		// Build messages for LLM
		const systemPrompt = settings.systemPrompt || this.buildDefaultSystemPrompt(tools);
		const messages = [
			{ role: 'system' as const, content: systemPrompt },
			...stateManager.getMessages(),
			{ role: 'user' as const, content: userContent }
		];

		// Convert AgentMessage to Record<string, unknown> for token estimation
		const messagesForEstimation = messages.map((m) => ({
			role: m.role,
			content: m.content,
			tool_calls: m.toolCalls,
			tool_call_id: m.toolCallId
		}));

		telemetry.tokenEstimateIn = estimateTokensFromMessages(messagesForEstimation);

		let response: any;
		try {
			// Call LLM
			response = await llmClient.call(messages, tools);
		} catch (llmError) {
			const err = llmError as any;
			console.error('[Agent] LLM call failed:', llmError);

			// Check if it's an LLM API error
			if (err.code === 'llm_request_failed' || err.message?.includes('Invalid API key')) {
				return responseBuilder.buildExecutionResult({
					success: false,
					baseMessage: err.message || 'I\'m having trouble connecting to the AI service. Please check your API key in AI settings.',
					actions,
					plan: null,
					telemetry,
					events: []
				});
			}

			// For other errors, re-throw
			throw llmError;
		}

		telemetry.tokenEstimateOut += this.estimateTokens(response.content);

		// Check for tool calls
		if (response.toolCalls && response.toolCalls.length > 0) {
			const toolCalls = dedupeToolCalls(
				response.toolCalls.map((call) => ({
					...call,
					parameters: normalizeToolParams(call.parameters)
				}))
			);

			// Separate read and write calls
			const readCalls = toolCalls.filter((call) => !isWriteTool(call.name));
			const writeCalls = toolCalls.filter((call) => isWriteTool(call.name));

			// Execute read calls in parallel
			for (const call of readCalls) {
				const tool = tools.find((t) => t.name === call.name);
				if (tool) {
					const result = await toolExecutor.executeTool(tool, call, this.userId);
					actions.push({
						type: 'read',
						entity: call.name.split('_')[1] || 'data',
						description: `Reading ${call.name.replace('_', ' ')}`,
						status: 'executed',
						data: { toolName: call.name, result: result.result }
					});
				}
			}

			// If we have write calls, return for confirmation
			if (writeCalls.length > 0) {
				return responseBuilder.buildExecutionResult({
					success: true,
					baseMessage: response.content || `I need your confirmation for ${writeCalls.length} action(s).`,
					actions,
					plan: null,
					telemetry,
					events: []
				});
			}

			// Continue the loop with read results
			// (In a full implementation, we'd continue the ReAct loop here)
		}

		// No more tool calls - return the response
		return responseBuilder.buildExecutionResult({
			success: true,
			baseMessage: response.content || "I've processed your request.",
			actions,
			plan: null,
			telemetry,
			events: []
		});
	}

	/**
	 * Build default system prompt
	 */
	private buildDefaultSystemPrompt(tools: any[]): string {
		return `You are The Architect, an autonomous AI assistant.

You have access to these tools:
${tools.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

When you need to use a tool:
1. Think about what you want to accomplish
2. Choose the appropriate tool
3. Provide the required parameters
4. Explain what you're doing to the user
5. Never return empty messages - always provide a summary

If you complete the user's request, provide a clear summary of what you did.`;
	}

	/**
	 * Build prompt for generating execution summary
	 */
	private buildSummaryPrompt(userRequest: string, actions: any[], plan: any, completionMessages: string[] = []): string {
		const actionsSummary = actions.map((a, i) => {
			const status = a.status === 'executed' ? '✓' : a.status === 'failed' ? '✗' : '○';
			return `${i + 1}. ${status} ${a.description}`;
		}).join('\n');

		const planInfo = plan
			? `
Plan: ${plan.goal}
Steps: ${plan.steps.length} total, ${plan.steps.filter((s: any) => s.status === 'completed').length} completed
`
			: '';

		const completionLog = completionMessages.length > 0
			? `\nExecution log:\n${completionMessages.join('\n')}\n`
			: '';

		return `The user asked: "${userRequest}"

${planInfo}Actions taken:
${actionsSummary || 'No actions taken'}
${completionLog}
Provide a clear, conversational summary to the user explaining:
1. What you found or accomplished
2. Any important details from the actions
3. The current status

Be concise but informative. Start with a brief overview, then provide the key findings. Do NOT use markdown headers or bullet points - just write a natural, conversational response.`;
	}

	/**
	 * Estimate tokens in text
	 */
	private estimateTokens(text: string): number {
		return Math.ceil(text.length / 4);
	}

	/**
	 * Format error for user
	 */
	private formatError(error: unknown): string {
		if (error instanceof Error) {
			return `I encountered an error: ${error.message}`;
		}
		return 'I encountered an unexpected error. Please try again.';
	}

	/**
	 * Process an action confirmation (user approved a write action)
	 * This method is used when the user confirms a pending action
	 */
	async processActionConfirmation(
		action: AiAction,
		sessionId: string,
		activeModuleIds: string[] = []
	): Promise<AiChatResponse> {
		// 1. Execute the action
		const result = await this.executeAction(action, activeModuleIds);

		// 2. Save the tool result to history
		const data = action.data as { toolName: string; parameters: unknown; toolCallId?: string };
		await this.aiRepo.addMessage(this.userId, {
			role: 'tool',
			content: JSON.stringify(result),
			sessionId,
			toolCallId: data?.toolCallId || 'manual-confirmation'
		});

		// 3. Get settings and updated history
		const settings = await this.aiRepo.getSettings(this.userId);
		const history = await this.aiRepo.getMessages(sessionId, this.userId);

		if (!settings) {
			return { message: 'Settings not found.' };
		}

		// 4. Run agent loop to generate final response
		const runtime = getAgentRuntimeConfig(settings);
		const tools = await this.toolbox.getTools(this.userId, activeModuleIds);
		const responseBuilder = new ResponseBuilder();
		const { telemetry: baseTelemetry, events, recordEvent } = createTelemetry(uuid());

		// Add durationMs to telemetry
		const telemetry = {
			...baseTelemetry,
			durationMs: Date.now() - baseTelemetry.startMs
		};

		// Build a simple response confirming the action
		const executionResult = responseBuilder.buildExecutionResult({
			success: true,
			baseMessage: 'The action was confirmed and executed successfully.',
			actions: [
				{
					type: action.type as 'read' | 'write' | 'plan' | 'think' | 'error',
					entity: action.entity,
					description: `Executed: ${action.description}`,
					status: 'executed',
					data: { toolName: (data as any).toolName, result }
				}
			],
			plan: null,
			telemetry,
			events
		});

		// Save assistant message
		await this.aiRepo.addMessage(this.userId, {
			role: 'assistant',
			content: executionResult.message,
			sessionId
		});

		return {
			message: executionResult.message,
			actions: executionResult.actions as AiAction[],
			events: runtime.telemetryEnabled ? events : undefined,
			telemetry: runtime.telemetryEnabled ? telemetry : undefined
		};
	}

	/**
	 * Execute a single action
	 */
	async executeAction(action: AiAction, activeModuleIds: string[] = []): Promise<unknown> {
		if (action.status !== 'pending') return undefined;

		const tools = await this.toolbox.getTools(this.userId, activeModuleIds);
		const data = action.data as {
			toolName: string;
			parameters: Record<string, unknown>;
			toolCallId?: string;
		};
		const tool = tools.find((t) => t.name === data.toolName);

		if (tool) {
			return await tool.execute(data.parameters);
		}

		return undefined;
	}
}
