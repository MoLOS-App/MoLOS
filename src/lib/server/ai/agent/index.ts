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
import type { AiSettings, AiMessage, AiAction, AiChatResponse } from '$lib/models/ai';
import type { AgentOptions, ExecutionResult, ProgressEvent } from './core/agent-types';
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
 * Detect if a user query is a simple conversational message that doesn't need planning
 * Simple queries are: greetings, thanks, short acknowledgments
 * Action requests are: create, delete, update, list, show, remove, etc.
 */
function isSimpleConversationalQuery(content: string): boolean {
	const trimmed = content.toLowerCase().trim();

	// Action keywords that mean this is NOT a simple query
	const actionPatterns = [
		/create|add|make|new|generate|build/i,
		/delete|remove|clear|erase|destroy|clean/i,
		/update|edit|modify|change|set/i,
		/list|show|get|fetch|find|search|what|tell me/i,
		/help|need|want|can you|could you/i
	];

	// Check for action patterns first
	for (const pattern of actionPatterns) {
		if (pattern.test(trimmed)) return false; // Has action keyword = NOT simple
	}

	// Simple conversational patterns
	const simplePatterns = [
		/^(hi|hello|hey|greetings|howdy|yo)/i,
		/^(thanks?|thank you|thx)/i,
		/^(ok|okay|sure|alright|got it|understood)/i,
		/^(yes|no|yep|nope|maybe)/i,
		/^(what'?s up|sup|how are you|how'?s it going)/i,
		/^(bye|goodbye|see you|later|cya)/i,
		/^(cool|awesome|great|nice|amazing)/i,
		/^(wow|oh|oh my|wowza)/i
	];

	// Check against simple patterns
	for (const pattern of simplePatterns) {
		if (pattern.test(trimmed)) return true;
	}

	// Very short messages without action words (under 30 chars, no question mark)
	if (trimmed.length < 30 && !trimmed.includes('?')) {
		return true;
	}

	return false;
}

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
		return await this.runAgent(
			content,
			sessionId,
			settings,
			initialMessages,
			activeModuleIds,
			options
		);
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
				plan = await this.generatePlan(userContent, tools, llmClient, planGenerator, streamer);
			} catch (planError) {
				// If plan generation fails due to LLM error, check if we should continue
				console.warn('[Agent] Plan generation error:', planError);
				if ((planError as any).code === 'llm_request_failed') {
					// LLM is not available - return helpful error immediately
					return {
						message:
							"I'm having trouble connecting to the AI service. Please check your API key in AI settings and try again.",
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
				stepsCompleted: result.plan
					? result.plan.steps.filter((s) => s.status === 'completed').length
					: 0,
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

			// Skip planning for simple conversational queries - go straight to direct response
			if (isSimpleConversationalQuery(userContent)) {
				console.log('[Agent] Simple conversational query detected, skipping plan generation');
				return null;
			}

			// Don't emit the planning thinking message - it's redundant noise
			// await streamer.streamThinking("Let me break down your request into a plan...");

			const plan = await planGenerator.generatePlan(
				userContent,
				tools, // Pass full tool definitions instead of just names
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
				console.log(
					'[Agent] LLM API error detected - will skip plan generation and use direct execution'
				);
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

		// Skip LLM summary generation if:
		// 1. No actions were taken, OR
		// 2. All actions failed, OR
		// 3. No plan was created (direct mode)
		// 4. Most actions failed (more than 50% failed) - use simple fallback instead
		const hasSuccessfulActions = actions.some((a) => a.status === 'executed');
		const failedActionsCount = actions.filter((a) => a.status === 'failed').length;
		const mostActionsFailed = actions.length > 0 && failedActionsCount / actions.length > 0.5;
		const shouldGenerateLLMSummary =
			actions.length > 0 && hasSuccessfulActions && !mostActionsFailed && planTracker?.getPlan();

		if (shouldGenerateLLMSummary) {
			try {
				// Removed: redundant thinking event
				// await streamer.streamThinking("Preparing a summary of what I've accomplished...");

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
		} else {
			console.log('[Agent] Skipping LLM summary - using simple fallback');
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
	 * Correct step parameters using LLM after a failure
	 */
	private async correctStepParameters(
		step: any,
		tool: any,
		error: string,
		llmClient: LlmClient
	): Promise<any | null> {
		try {
			// Format tool parameters for the prompt
			const toolParams = tool.parameters?.properties
				? Object.entries(tool.parameters.properties)
						.map(([name, schema]: [string, any]) => {
							const required = (tool.parameters?.required || []).includes(name)
								? ' (required)'
								: ' (optional)';
							const typeInfo =
								schema.type === 'array'
									? `array of ${schema.items?.type || 'objects'}`
									: schema.type || 'any';
							return `  - ${name}${required}: ${typeInfo}`;
						})
						.join('\n')
				: '  (no parameters)';

			const correctionPrompt = `A step in my execution plan failed. I need you to fix the parameters.

Step description: ${step.description}
Tool: ${tool.name}
Tool parameters:
${toolParams}

Current (incorrect) parameters:
${JSON.stringify(step.parameters || {}, null, 2)}

Error that occurred: ${error}

Please provide the CORRECTED parameters for this step. Extract the actual values from the step description above.

IMPORTANT:
- For array parameters, make sure to include ALL items mentioned in the description
- For required parameters, NEVER leave them empty or null
- Response format MUST be valid JSON only, no markdown

Respond with ONLY the corrected parameters as a JSON object:
{
  "param1": "value1",
  "param2": ["item1", "item2"],
  ...
}`;

			const response = await llmClient.call([{ role: 'user', content: correctionPrompt }]);

			if (!response.content) {
				console.warn('[Agent] LLM returned empty response for parameter correction');
				return null;
			}

			// Extract JSON from response (may be wrapped in markdown)
			const jsonMatch =
				response.content.match(/```json\n([\s\S]*?)\n```/) ||
				response.content.match(/```\n([\s\S]*?)\n```/) ||
				response.content.match(/\{[\s\S]*\}/);

			if (!jsonMatch) {
				console.warn(
					'[Agent] LLM response did not contain valid JSON:',
					response.content.substring(0, 200)
				);
				return null;
			}

			const jsonStr = jsonMatch[1] || jsonMatch[0];
			const correctedParams = JSON.parse(jsonStr);

			console.log('[Agent] Corrected parameters:', JSON.stringify(correctedParams, null, 2));

			return {
				...step,
				parameters: correctedParams
			};
		} catch (parseError) {
			console.warn('[Agent] Failed to parse corrected parameters:', parseError);
			return null;
		}
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

		// Removed: redundant thinking message - step_start already provides this info
		// await streamer.streamThinking(`[${stepNumber}/${totalSteps}] ${step.description}...`);

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

					// Track completion message for summary (but don't emit as thinking event)
					const completionMsg = `[${stepNumber}/${totalSteps}] ✓ ${step.description}`;
					completionMessages.push(completionMsg);
					// Removed: redundant thinking event
					// await streamer.streamThinking(completionMsg);

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
					// Auto-retry with corrected parameters
					await streamer.streamStepFailed(
						step,
						stepNumber,
						totalSteps,
						result.error || 'Unknown error'
					);

					// Try to fix the parameters using LLM
					console.log('[Agent] Step failed, attempting auto-retry with corrected parameters...');
					const correctedStep = await this.correctStepParameters(
						step,
						tool,
						result.error || 'Unknown error',
						llmClient
					);

					if (correctedStep && correctedStep.parameters) {
						console.log('[Agent] LLM provided corrected parameters, retrying...');
						const retryResult = await toolExecutor.executeTool(
							tool,
							{ id: uuid(), name: step.toolName, parameters: correctedStep.parameters || {} },
							this.userId
						);

						if (retryResult.success) {
							planTracker.completeStep(step.id, retryResult.result);
							await streamer.streamStepCompleted(step, stepNumber, totalSteps, retryResult.result);

							const completionMsg = `[${stepNumber}/${totalSteps}] ✓ ${step.description} (retried with corrected parameters)`;
							completionMessages.push(completionMsg);

							actions.push({
								type: 'read',
								entity: step.toolName,
								description: step.description,
								status: 'executed',
								data: { toolName: step.toolName, result: retryResult.result, retried: true }
							});

							return { result: retryResult, actions };
						}
					}

					// Retry also failed, mark as permanently failed
					planTracker.failStep(step.id, result.error || 'Execution failed');

					const failureMsg = `[${stepNumber}/${totalSteps}] ✗ Failed: ${step.description} - ${result.error || 'Unknown error'}`;
					completionMessages.push(failureMsg);

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
		actions: any[],
		iteration: number = 0
	): Promise<ExecutionResult> {
		// Safety: prevent infinite loops
		const maxReactIterations = 10;
		if (iteration >= maxReactIterations) {
			console.warn('[Agent] Max ReAct iterations reached, returning current results');
			return responseBuilder.buildExecutionResult({
				success: false,
				baseMessage:
					"I've processed your request through multiple steps. Let me provide an update on what I've accomplished so far.",
				actions,
				plan: null,
				telemetry,
				events: []
			});
		}
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
					baseMessage:
						err.message ||
						"I'm having trouble connecting to the AI service. Please check your API key in AI settings.",
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
				response.toolCalls.map(
					(call: { id: string; name: string; parameters: Record<string, unknown> }) => ({
						...call,
						parameters: normalizeToolParams(call.parameters)
					})
				)
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

			// AUTONOMOUS: Execute write calls automatically without confirmation
			if (writeCalls.length > 0) {
				console.log(`[Agent] Executing ${writeCalls.length} write call(s) autonomously...`);

				for (const call of writeCalls) {
					const tool = tools.find((t) => t.name === call.name);
					if (tool) {
						const result = await toolExecutor.executeTool(tool, call, this.userId);
						actions.push({
							type: 'write',
							entity: call.name.split('_')[1] || 'data',
							description: `Writing ${call.name.replace('_', ' ')}`,
							status: result.success ? 'executed' : 'failed',
							data: { toolName: call.name, result: result.result, error: result.error }
						});

						// Update state manager with tool result for next iteration
						stateManager.addMessage({
							role: 'tool',
							content: JSON.stringify(result.result || { error: result.error }),
							toolCallId: call.id
						});
					}
				}

				// Continue the ReAct loop - call LLM again with tool results to see if more actions needed
				console.log('[Agent] Write calls completed, continuing ReAct loop...');
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
					actions,
					iteration + 1
				);
			}

			// Only read calls were made - continue loop to see if more actions needed
			if (readCalls.length > 0) {
				// Add tool results to state and continue
				for (const call of readCalls) {
					const action = actions.find((a) => a.data?.toolName === call.name);
					if (action) {
						stateManager.addMessage({
							role: 'tool',
							content: JSON.stringify(action.data?.result || {}),
							toolCallId: call.id
						});
					}
				}

				console.log('[Agent] Read calls completed, continuing ReAct loop...');
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
					actions,
					iteration + 1
				);
			}
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
	 * Made more concise to avoid truncation issues
	 */
	private buildSummaryPrompt(
		userRequest: string,
		actions: any[],
		plan: any,
		completionMessages: string[] = []
	): string {
		const successfulActions = actions.filter((a) => a.status === 'executed');
		const failedActions = actions.filter((a) => a.status === 'failed');

		const planInfo = plan
			? `Plan: ${plan.goal} (${plan.steps.filter((s: any) => s.status === 'completed').length}/${plan.steps.length} steps completed)`
			: '';

		return `User request: "${userRequest.substring(0, 200)}${userRequest.length > 200 ? '...' : ''}"

${planInfo}
Completed: ${successfulActions.length} actions
${failedActions.length > 0 ? `Failed: ${failedActions.length} actions` : ''}

Provide a brief, natural summary of what was accomplished. Be conversational and concise. Do NOT use markdown.`;
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
