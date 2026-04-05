/**
 * Agent Loop - Main orchestration for agent lifecycle
 *
 * ## Purpose
 * The AgentLoop orchestrates the complete agent execution lifecycle including:
 * - Turn and sub-turn management with depth tracking
 * - Tool execution with timeout and approval hooks
 * - Context building via ContextBuilder integration
 * - Error handling with provider failover and recovery strategies
 * - Usage tracking (input/output tokens)
 * - Session state management
 * - Streaming middleware pipeline for response processing
 *
 * ## Key Concepts
 *
 * ### Turn vs Sub-turn Architecture
 * - **Turn**: Represents one user message and all its associated LLM calls and tool executions
 * - **Sub-turn**: A single LLM call within a turn (enables recursive tool calling)
 * - Sub-turns can spawn further sub-turns up to `maxSubTurnDepth` (default: 3)
 *
 * ### Error Recovery Hierarchy
 * 1. **Retry** (up to 3 attempts with exponential backoff) - for transient errors
 * 2. **Compact** (up to 3 attempts) - context summarization for overflow
 * 3. **Truncate** - last resort tool result shortening
 * 4. **Abort** - permanent failure
 *
 * ### Streaming Middleware Chain
 * Middlewares are applied in order (first added = first applied to stream):
 * - Sanitize malformed tool calls
 * - Trim tool call names
 * - Repair malformed JSON arguments
 *
 * ### Context Overflow Handling
 * When context limit is reached, the loop:
 * 1. Creates compaction summary (keeps system + last N messages)
 * 2. If still overflowing, truncates individual tool results
 * 3. Uses head+tail preservation for important content (errors, results)
 *
 * ## Usage Pattern
 * ```typescript
 * const loop = new AgentLoop({
 *   provider: myLlmProvider,
 *   tools: myToolDefs,
 *   workspace: '/path/to/workspace',
 *   maxIterations: 20,
 *   maxTurns: 50,
 *   hookManager: myHookManager
 * });
 *
 * loop.setToolExecutor(async (tool, args) => {
 *   // Execute tool and return result
 * });
 *
 * const result = await loop.run(existingMessages, userInput);
 * ```
 *
 * ## Important Algorithms
 *
 * ### Tool Result Truncation (head+tail strategy)
 * - Preserves beginning and end of tool results
 * - Prioritizes keeping errors, exceptions, final results
 * - Uses clean newline cut points when possible
 * - Truncation suffix: `[Content truncated — original was too large for context window]`
 *
 * ### Panic Recovery Pattern
 * Wraps each turn execution to catch:
 * - panic signals from LLM providers
 * - unexpected tokens, array buffer errors
 * - deadlock and stack size errors
 * After 3 panics, aborts the run.
 *
 * ### Proactive Context Checking
 * Before every LLM call, checks if context would overflow:
 * - Uses token estimation (chars/2.5 heuristic)
 * - Forces compression if budget exceeded
 * - Prevents downstream overflow errors
 *
 * ## AI Context Optimization
 * - System prompt caching via mtime invalidation reduces reprocessing
 * - Two-pass history sanitization removes dangling tool_call references
 * - Proactive compression happens BEFORE LLM call (not after error)
 * - Tool result truncation uses 30% context share limit per result
 * - Compacted context keeps first message (system) and last 10 messages
 * - Event emission uses seq numbers for ordering without full traces
 */

import type {
	AgentMessage,
	AgentLoopConfig,
	ToolDefinition,
	ToolResult,
	ToolCall,
	LlmRequest,
	LlmResponse
} from '../types/index.js';

// Import structured error classes (aliased to avoid conflict with local AgentError interface)
import { AgentError as StructuredAgentError, ErrorCode } from '../errors/index.js';

// Import config validation
import { AgentLoopConfigSchema, type ValidatedAgentLoopConfig } from '../config/schemas.js';
import { validateConfigOrThrow, formatZodError } from '../config/validation.js';

import { EventBus, type AgentEvent } from '../events/event-bus.js';
import {
	EventKind,
	type EventKindValue,
	type TypedAgentEvent,
	type EventMeta
} from '../events/types.js';
import {
	createTurnManager,
	type TurnManager,
	type Turn,
	type TurnResult,
	type SubTurnResult
} from './turn.js';
import { createSessionStore, type SessionStore } from './session.js';
import { createContextBuilder, type ContextBuilder } from './context.js';
import {
	shouldCompact,
	compactContext,
	estimateContextWindow,
	truncateToolResultsIfNeeded,
	forceCompression
} from './context-manager.js';
import {
	type HookManager,
	type LLMHookRequest,
	type LLMHookResponse,
	type ToolApprovalRequest,
	type HookDecision,
	type ApprovalDecision,
	LifecycleHooks,
	type AgentBeforeStartEvent,
	type AgentAfterEndEvent,
	type TurnBeforeStartEvent,
	type TurnAfterEndEvent,
	type ToolBeforeExecuteEvent,
	type ToolAfterExecuteEvent,
	type ToolOnErrorEvent,
	type ProviderBeforeCallEvent,
	type ProviderAfterCallEvent,
	type ProviderOnErrorEvent,
	type AgentStats
} from '../hooks/index.js';
import { AGENT } from '../constants.js';

// Streaming infrastructure imported from separate module
import type { StreamChunk, StreamContext, StreamMiddleware, StreamResult } from './streaming.js';
import { StreamChain, streamingMiddlewares } from './streaming.js';
export type { StreamChunk, StreamContext, StreamMiddleware, StreamResult };
export { streamingMiddlewares };

// Import state types from the new state module
import {
	type AgentRunResult,
	type AgentLoopState,
	type LLMProviderClient
} from './agent-loop-state.js';
export type { AgentRunResult, AgentLoopState, LLMProviderClient };

// Import error recovery functions from the new error-recovery module
import {
	classifyError,
	classifyErrorWithRecovery,
	isRetryableError,
	handleRetriableError,
	runWithPanicRecovery,
	mapErrorToProviderErrorType,
	createErrorRecoveryContext,
	type AgentError,
	type ErrorRecoveryContext
} from './error-recovery.js';

// AgentError is re-exported from error-recovery.ts for backward compatibility

// =============================================================================
// Agent Loop
// =============================================================================

/**
 * AgentLoop orchestrates the complete agent execution lifecycle.
 */
export class AgentLoop {
	private readonly config: AgentLoopConfig;
	private readonly provider: LLMProviderClient;
	private readonly tools: Map<string, ToolDefinition>;
	private readonly events: EventBus;
	private readonly session: SessionStore;
	private readonly contextBuilder: ContextBuilder;
	private turnManager: TurnManager;
	private hookManager?: HookManager;

	private readonly maxIterations: number;
	private readonly maxTurns: number;
	private readonly maxToolCallsPerTurn: number;
	private readonly toolTimeout: number;

	private state: AgentLoopState;
	private abortController: AbortController | null = null;
	private toolExecutor?: (
		tool: ToolDefinition,
		args: Record<string, unknown>
	) => Promise<ToolResult>;

	constructor(
		config: AgentLoopConfig & {
			provider: LLMProviderClient;
			workspace?: string;
			maxSubTurnDepth?: number;
			maxIterations?: number;
			hookManager?: HookManager;
		}
	) {
		// Validate configuration with Zod
		const validatedConfig = validateConfigOrThrow(
			AgentLoopConfigSchema,
			config,
			'AgentLoop configuration is invalid'
		);

		// Cast through unknown to align validated types with AgentLoopConfig interface
		this.config = validatedConfig as unknown as AgentLoopConfig;
		this.provider = config.provider;

		// Tools map - use type assertion for safe extraction from validated config
		this.tools = new Map(
			((validatedConfig as { tools?: unknown[] }).tools ?? []).map(
				(t: unknown) => [(t as { name?: string })?.name ?? '', t] as [string, ToolDefinition]
			)
		);

		this.events = new EventBus();
		this.session = createSessionStore();

		this.contextBuilder = createContextBuilder({
			workspace: config.workspace ?? process.cwd()
		});

		this.turnManager = createTurnManager({
			maxTurns: config.maxTurns ?? AGENT.MAX_TURNS,
			maxSubTurnDepth: config.maxSubTurnDepth ?? AGENT.DEFAULT_MAX_SUB_TURN_DEPTH
		});

		this.hookManager = config.hookManager;

		this.maxIterations = config.maxIterations ?? AGENT.MAX_ITERATIONS;
		this.maxTurns = config.maxTurns ?? AGENT.MAX_TURNS;
		this.maxToolCallsPerTurn = config.maxToolCallsPerTurn ?? AGENT.MAX_TOOL_CALLS_PER_TURN;
		this.toolTimeout = config.toolTimeout ?? AGENT.TOOL_TIMEOUT_MS;

		this.state = this.createInitialState();
	}

	private createInitialState(): AgentLoopState {
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

	setToolExecutor(
		executor: (tool: ToolDefinition, args: Record<string, unknown>) => Promise<ToolResult>
	): void {
		this.toolExecutor = executor;
	}

	/**
	 * Main entry point - runs the agent loop until completion or max iterations.
	 *
	 * ## Loop Flow
	 * ```
	 * for iteration in 1..maxIterations:
	 *   create turn
	 *   runTurnWithRetry(turn, messages, input)
	 *   if shouldStop(result): break
	 *   else if error and canCompact: compactContext, continue
	 *   else if error and canTruncate: truncateToolResults, continue
	 *   else if error and notRetriable: break
	 * return finalMessages, output, stats
	 * ```
	 *
	 * ## Error Recovery Flow
	 * 1. On context_overflow → compactContext() → retry
	 * 2. After 3 compactions → truncateToolResultsIfNeeded() → retry
	 * 3. If still failing → abort
	 *
	 * ## Key State Updates
	 * - `state.iteration`: Current iteration number (1-indexed)
	 * - `state.turnCount`: Total completed turns
	 * - `state.accumulatedUsage`: Running total of token usage
	 * - `state.overflowCompactionAttempts`: Compaction retry counter
	 */
	async run(messages: AgentMessage[], input: string): Promise<AgentRunResult> {
		if (this.state.running) {
			throw new Error('Agent loop is already running');
		}

		this.state.running = true;
		this.abortController = new AbortController();
		const runId = `run_${Date.now()}`;
		const startTime = Date.now();

		const turnResults: TurnResult[] = [];
		let currentMessages = [...messages];
		let finalOutput = '';
		let error: AgentError | undefined;

		try {
			// Emit agent:before_start lifecycle hook
			if (this.hookManager) {
				const beforeStartEvent: AgentBeforeStartEvent = {
					kind: LifecycleHooks.agent.beforeStart,
					runId,
					timestamp: startTime,
					config: {
						id: this.config.id,
						model: this.config.model,
						maxIterations: this.maxIterations,
						maxTurns: this.maxTurns,
						maxTokens: this.config.maxTokens,
						temperature: this.config.temperature
					},
					input
				};
				await this.hookManager.runLifecycleHook(LifecycleHooks.agent.beforeStart, beforeStartEvent);
			}

			this.emitEvent('run:start', { input, messageCount: messages.length }, runId);

			for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
				this.state.iteration = iteration;

				if (this.abortController.signal.aborted) {
					break;
				}

				const turn = this.turnManager.createTurn(input);
				this.state.currentTurn = turn as Turn;

				let turnResult: TurnResult | undefined;

				try {
					turnResult = await this.runTurnWithRetry(turn, currentMessages, input);

					if (turnResult) {
						turnResults.push(turnResult);
						currentMessages = turnResult.messages;
						finalOutput = turnResult.output;

						if (turnResult.usage) {
							this.state.accumulatedUsage.inputTokens += turnResult.usage.inputTokens;
							this.state.accumulatedUsage.outputTokens += turnResult.usage.outputTokens;
							this.state.accumulatedUsage.totalTokens += turnResult.usage.totalTokens;
						}

						if (this.shouldStop(turnResult)) {
							break;
						}
					}
				} catch (err) {
					error = classifyErrorWithRecovery(err);

					// Handle context overflow with compaction
					if (shouldCompact(error, this.state.overflowCompactionAttempts)) {
						this.state.overflowCompactionAttempts++;
						this.emitEvent(
							'run:compaction',
							{
								error,
								iteration,
								attempt: this.state.overflowCompactionAttempts
							},
							runId
						);

						const compactedMessages = await compactContext(currentMessages);
						currentMessages = compactedMessages;

						this.emitEvent(
							'run:compaction:complete',
							{
								originalCount: messages.length,
								compactedCount: compactedMessages.length
							},
							runId
						);

						// Reset turn manager state for the new iteration since we're retrying
						this.turnManager = createTurnManager({
							maxTurns: this.maxTurns,
							maxSubTurnDepth: 3
						});

						continue; // Retry with compacted context
					}

					// If compaction is exhausted but truncation might help, try truncating tool results
					if (error && (error.type === 'context_overflow' || error.type === 'context_limit')) {
						// Estimate context window from accumulated usage or use a default
						const estimatedContextWindow = estimateContextWindow(
							this.config,
							this.state.accumulatedUsage
						);
						const truncationResult = truncateToolResultsIfNeeded(
							currentMessages,
							estimatedContextWindow
						);

						if (truncationResult.truncatedCount > 0) {
							this.emitEvent(
								'run:tool_result_truncation',
								{
									error,
									iteration,
									truncatedCount: truncationResult.truncatedCount
								},
								runId
							);

							currentMessages = truncationResult.messages;

							// Reset turn manager and retry
							this.turnManager = createTurnManager({
								maxTurns: this.maxTurns,
								maxSubTurnDepth: 3
							});

							continue;
						}
					}

					// Non-retriable errors after all recovery attempts - abort
					this.emitEvent('run:error', { error, iteration, recoveryAttempted: true }, runId);
					break;
				}

				this.state.turnCount++;
			}
		} finally {
			this.state.running = false;
			this.state.currentTurn = null;
			this.abortController = null;
		}

		this.emitEvent(
			'run:end',
			{
				iterations: this.state.iteration,
				turns: turnResults.length,
				finalOutput,
				error
			},
			runId
		);

		// Emit agent:after_end lifecycle hook
		if (this.hookManager) {
			const endTime = Date.now();
			const stats: AgentStats = {
				iterations: this.state.iteration,
				turns: this.state.turnCount,
				toolCalls: this.state.toolCallCount,
				inputTokens: this.state.accumulatedUsage.inputTokens,
				outputTokens: this.state.accumulatedUsage.outputTokens,
				totalTokens: this.state.accumulatedUsage.totalTokens,
				durationMs: endTime - startTime
			};

			const afterEndEvent: AgentAfterEndEvent = {
				kind: LifecycleHooks.agent.afterEnd,
				runId,
				timestamp: endTime,
				reason: error ? 'error' : 'completed',
				stats,
				finalOutput,
				iterations: this.state.iteration,
				turns: this.state.turnCount
			};
			await this.hookManager.runLifecycleHook(LifecycleHooks.agent.afterEnd, afterEndEvent);
		}

		return {
			messages: currentMessages,
			finalOutput,
			iterations: this.state.iteration,
			turns: turnResults,
			error,
			usage: this.state.accumulatedUsage.totalTokens > 0 ? this.state.accumulatedUsage : undefined
		};
	}

	private emitEvent(type: string, data: Record<string, unknown>, runId: string): void {
		const event: AgentEvent = {
			runId,
			seq: this.state.seq++,
			stream: 'lifecycle',
			ts: Date.now(),
			data,
			type
		};
		this.events.emit(event);
	}

	/**
	 * Emit a typed event with proper EventKind
	 */
	private emitTypedEvent<T>(kind: EventKindValue, payload: T, meta: Partial<EventMeta> = {}): void {
		const currentSession = this.session.get('current');
		const meta_: EventMeta = {
			agent_id: this.config.id ?? 'unknown',
			turn_id: this.state.currentTurn?.id ?? '',
			session_key: currentSession?.key ?? '',
			iteration: this.state.iteration,
			trace_path: '',
			source: 'agent',
			...meta
		};

		const event: TypedAgentEvent<T> = {
			runId: `run_${Date.now()}`,
			seq: this.state.seq++,
			stream: 'lifecycle',
			ts: Date.now(),
			data: payload,
			type: kind, // For backward compat with AgentEvent
			kind,
			meta: meta_
		};
		this.events.emit(event as AgentEvent);
	}

	/**
	 * Build hook context for LLM interception
	 */
	private buildHookContext(): {
		sessionKey?: string;
		userId?: string;
		runId: string;
		timestamp: number;
		metadata?: Record<string, unknown>;
	} {
		// Get current session from store - session key should be stored/retrieved properly
		const currentSession = this.session.get('current');
		const sessionKey = currentSession?.key;
		const userId = currentSession?.metadata?.userId as string | undefined;

		return {
			sessionKey,
			userId,
			runId: `run_${Date.now()}`,
			timestamp: Date.now(),
			metadata: {
				turnId: this.state.currentTurn?.id,
				iteration: this.state.iteration
			}
		};
	}

	private async runTurnWithRetry(
		turn: Turn,
		messages: AgentMessage[],
		input: string
	): Promise<TurnResult | undefined> {
		let lastError: unknown;
		this.state.retryCount = 0;

		// Create error recovery context bound to this instance
		const errorContext: ErrorRecoveryContext = {
			overflowCompactionAttempts: this.state.overflowCompactionAttempts,
			panicCount: this.state.panicCount,
			lastError: this.state.lastError,
			emitEvent: this.emitEvent.bind(this)
		};

		for (let attempt = 0; attempt < AGENT.MAX_RETRIES; attempt++) {
			this.state.retryCount = attempt;

			try {
				// Wrap with panic recovery for each attempt
				return await runWithPanicRecovery(async () => {
					return await this.runTurn(turn, messages, input);
				}, errorContext);
			} catch (err) {
				lastError = err;
				const error = classifyErrorWithRecovery(err);

				// Check if we should handle this as a retriable error
				if (!isRetryableError(err)) {
					// Non-retriable errors are thrown immediately after classification
					this.emitEvent(
						'run:non_retriable_error',
						{
							error,
							attempt,
							message: error.message
						},
						''
					);
					throw err;
				}

				// Handle retry exhaustion
				const recoveryAction = handleRetriableError(error, attempt, errorContext);

				if (recoveryAction === 'abort') {
					this.emitEvent(
						'run:retry_exhausted',
						{
							error,
							attempt,
							maxRetries: AGENT.MAX_RETRIES,
							message: `Retry exhausted after ${attempt + 1} attempts`
						},
						''
					);
					throw err;
				}

				if (recoveryAction === 'compact') {
					this.emitEvent(
						'run:retry_compact',
						{
							error,
							attempt,
							overflowCompactionAttempts: this.state.overflowCompactionAttempts
						},
						''
					);
					// Context will be compacted in the main run loop
					throw err;
				}

				if (recoveryAction === 'truncate') {
					this.emitEvent(
						'run:retry_truncate',
						{
							error,
							attempt
						},
						''
					);
					// Tool result truncation will be attempted in the main run loop
					throw err;
				}

				// Continue retry with backoff
				this.emitEvent(
					'run:retry',
					{
						error,
						attempt,
						backoffMs: AGENT.RETRY_BACKOFF_MS * Math.pow(2, attempt)
					},
					''
				);
				const backoffMs = AGENT.RETRY_BACKOFF_MS * Math.pow(2, attempt);
				await this.sleep(backoffMs);
			}
		}

		throw lastError;
	}

	/**
	 * Executes a single turn - one user input with associated LLM call and tool executions.
	 *
	 * ## Turn Execution Flow
	 * ```
	 * 1. Build system prompt (with mtime-based caching)
	 * 2. Build dynamic context (time, session, runtime info)
	 * 3. Build messages (system + history + input)
	 * 4. Check context overflow proactively → compress if needed
	 * 5. Call LLM provider
	 * 6. Extract output and tool calls from response
	 * 7. Execute each tool call sequentially
	 * 8. Complete turn with results
	 * ```
	 *
	 * ## Proactive Context Management
	 * Before calling the LLM, checks if context would overflow:
	 * - Uses `checkContextOverflow()` with token estimation
	 * - If would overflow, calls `forceCompression()` to trim history
	 * - Emits `ContextCompress` event with reason and dropped message count
	 *
	 * ## Tool Execution
	 * Tools are executed sequentially after LLM response:
	 * - Each tool result is added to messages as a `tool` role message
	 * - Tools use the toolExecutor set via `setToolExecutor()`
	 * - Results are formatted: success → output string, failure → error string
	 *
	 * ## Event Emission
	 * - `turn:start` / `turn:end` - lifecycle events
	 * - `TurnStart` / `TurnEnd` - typed events with structured data
	 * - `ContextCompress` - when proactive compression occurs
	 * - `provider:response` / `provider:error` - LLM call results
	 * - `tool:call` / `tool:result` - tool execution events
	 */
	async runTurn(turn: Turn, messages: AgentMessage[], input: string): Promise<TurnResult> {
		const startTime = Date.now();
		const runId = `run_${startTime}`;

		// Emit turn:before_start lifecycle hook
		if (this.hookManager) {
			const beforeTurnEvent: TurnBeforeStartEvent = {
				kind: LifecycleHooks.turn.beforeStart,
				runId,
				timestamp: startTime,
				turnId: turn.id,
				input,
				iteration: this.state.iteration
			};
			await this.hookManager.runLifecycleHook(LifecycleHooks.turn.beforeStart, beforeTurnEvent);
		}

		this.emitEvent('turn:start', { turnId: turn.id, input }, runId);

		// Emit typed TurnStart event
		this.emitTypedEvent(
			EventKind.TurnStart,
			{
				channel: '',
				chat_id: '',
				user_message: input,
				media_count: 0
			},
			{ turn_id: turn.id }
		);

		const allMessages = [...messages];
		const toolCalls: ToolCall[] = [];
		const toolResults: ToolResult[] = [];
		let output = '';

		try {
			const { prompt: systemPrompt } = await this.contextBuilder.buildSystemPromptWithCache();
			const dynamicContext = this.contextBuilder.buildDynamicContext({ key: 'default' });
			let builtMessages = this.contextBuilder.buildMessages(
				allMessages,
				input,
				systemPrompt,
				dynamicContext
			);

			// Proactive context budget checking before LLM call
			const toolDefs = this.tools.size > 0 ? Array.from(this.tools.values()) : [];
			const contextWindow = this.config.maxTokens ? this.config.maxTokens * 4 : 128000;

			if (
				this.contextBuilder.checkContextOverflow(
					contextWindow,
					builtMessages,
					toolDefs,
					this.config.maxTokens ?? 4096
				)
			) {
				// Proactive compression needed
				const compression = await forceCompression(builtMessages);
				if (compression.success) {
					// Recompute messages after compression
					builtMessages = this.contextBuilder.buildMessages(
						compression.messages,
						input,
						systemPrompt,
						dynamicContext
					);
					this.emitTypedEvent(
						EventKind.ContextCompress,
						{
							reason: 'proactive',
							dropped_messages: compression.droppedCount,
							remaining_messages: builtMessages.length
						},
						{ turn_id: turn.id }
					);
				}
			}

			const request = this.buildLlmRequest(builtMessages);
			const response = await this.callProvider(request);

			output = this.extractOutput(response.message);
			const extractedToolCalls = this.extractToolCalls(response.message, runId);
			toolCalls.push(...extractedToolCalls);

			allMessages.push(response.message);

			for (const toolCall of extractedToolCalls) {
				const result = await this.executeTool(toolCall.tool.name, toolCall.arguments);
				toolResults.push(result);

				// Use toolCall.name (original from AI SDK) if available, fallback to toolCall.tool.name
				allMessages.push({
					role: 'tool',
					content: result.success
						? (result.output ?? '')
						: (result.error ?? 'Tool execution failed'),
					toolCallId: toolCall.id,
					name: toolCall.name ?? toolCall.tool.name
				});
			}

			this.turnManager.completeTurn(turn.id, {
				turnId: turn.id,
				messages: allMessages,
				output,
				toolCalls,
				toolResults,
				endedAt: Date.now(),
				durationMs: Date.now() - startTime
			});
		} catch (err) {
			const error = classifyError(err);
			this.turnManager.failTurn(turn.id, error);

			// Emit turn:after_end lifecycle hook for error case
			if (this.hookManager) {
				const endTime = Date.now();
				const afterEndEvent: TurnAfterEndEvent = {
					kind: LifecycleHooks.turn.afterEnd,
					runId,
					timestamp: endTime,
					turnId: turn.id,
					output,
					toolCallCount: toolCalls.length,
					durationMs: endTime - startTime,
					status: 'error'
				};
				await this.hookManager.runLifecycleHook(LifecycleHooks.turn.afterEnd, afterEndEvent);
			}

			throw err;
		}

		this.emitEvent(
			'turn:end',
			{
				turnId: turn.id,
				output,
				toolCallCount: toolCalls.length,
				durationMs: Date.now() - startTime
			},
			runId
		);

		// Emit typed TurnEnd event
		this.emitTypedEvent(
			EventKind.TurnEnd,
			{
				status: 'completed',
				iterations: this.state.iteration,
				duration_ms: Date.now() - startTime,
				final_content_len: output.length
			},
			{ turn_id: turn.id }
		);

		// Emit turn:after_end lifecycle hook for success case
		if (this.hookManager) {
			const endTime = Date.now();
			const afterEndEvent: TurnAfterEndEvent = {
				kind: LifecycleHooks.turn.afterEnd,
				runId,
				timestamp: endTime,
				turnId: turn.id,
				output,
				toolCallCount: toolCalls.length,
				durationMs: endTime - startTime,
				status: 'completed'
			};
			await this.hookManager.runLifecycleHook(LifecycleHooks.turn.afterEnd, afterEndEvent);
		}

		return {
			turnId: turn.id,
			messages: allMessages,
			output,
			toolCalls,
			toolResults,
			endedAt: Date.now(),
			durationMs: Date.now() - startTime
		};
	}

	async runSubTurn(
		parentTurn: Turn,
		input: string,
		spawnConfig?: {
			model?: string;
			tools?: ToolDefinition[];
			systemPrompt?: string;
			label?: string;
		}
	): Promise<SubTurnResult> {
		const startTime = Date.now();
		const subTurnId = `${parentTurn.id}-sub-${this.state.toolCallCount}`;
		const runId = `run_${startTime}`;

		this.emitEvent('subturn:start', { subTurnId, parentTurnId: parentTurn.id, input }, runId);

		// Emit SubTurnSpawn typed event
		this.emitTypedEvent(
			EventKind.SubTurnSpawn,
			{
				agent_id: 'subagent',
				label: spawnConfig?.label ?? 'default'
			},
			{ turn_id: parentTurn.id }
		);

		const toolCalls: ToolCall[] = [];
		const toolResults: ToolResult[] = [];
		let output = '';

		try {
			if (!this.turnManager.canSpawnSubTurn(parentTurn.id)) {
				throw new Error('Sub-turn depth limit exceeded');
			}

			const systemPrompt =
				spawnConfig?.systemPrompt ??
				(await this.contextBuilder.buildSystemPromptWithCache()).prompt;
			const dynamicContext = this.contextBuilder.buildDynamicContext({ key: 'default' });
			let messages = this.contextBuilder.buildMessages([], input, systemPrompt, dynamicContext);

			// Proactive context budget checking for subturn
			const toolDefs = this.tools.size > 0 ? Array.from(this.tools.values()) : [];
			const contextWindow = this.config.maxTokens ? this.config.maxTokens * 4 : 128000;

			if (
				this.contextBuilder.checkContextOverflow(
					contextWindow,
					messages,
					toolDefs,
					this.config.maxTokens ?? 4096
				)
			) {
				const compression = await forceCompression(messages);
				if (compression.success) {
					messages = this.contextBuilder.buildMessages(
						compression.messages,
						input,
						systemPrompt,
						dynamicContext
					);
					this.emitTypedEvent(
						EventKind.ContextCompress,
						{
							reason: 'proactive_subturn',
							dropped_messages: compression.droppedCount,
							remaining_messages: messages.length
						},
						{ turn_id: subTurnId }
					);
				}
			}

			const request = this.buildLlmRequest(messages, spawnConfig?.model);
			const response = await this.callProvider(request);

			output = this.extractOutput(response.message);
			const extractedToolCalls = this.extractToolCalls(response.message, runId);
			toolCalls.push(...extractedToolCalls);

			for (const toolCall of extractedToolCalls) {
				const result = await this.executeTool(toolCall.tool.name, toolCall.arguments);
				toolResults.push(result);
			}

			// Emit SubTurnEnd typed event
			this.emitTypedEvent(
				EventKind.SubTurnEnd,
				{
					agent_id: 'subagent',
					status: 'completed'
				},
				{ turn_id: subTurnId }
			);

			this.emitEvent(
				'subturn:end',
				{ subTurnId, output, toolCallCount: toolCalls.length, durationMs: Date.now() - startTime },
				runId
			);
		} catch (err) {
			this.emitEvent('subturn:error', { subTurnId, error: classifyError(err) }, runId);
			throw err;
		}

		return {
			turnId: subTurnId,
			messages: [],
			output,
			toolCalls,
			toolResults,
			endedAt: Date.now(),
			durationMs: Date.now() - startTime,
			parentTurnId: parentTurn.id,
			spawnMode: 'run'
		};
	}

	async executeTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
		const startTime = Date.now();
		const runId = `run_${startTime}`;

		this.emitEvent('tool:call', { toolName, arguments: args }, runId);

		// Tool approval check
		if (this.hookManager) {
			const approvalReq: ToolApprovalRequest = {
				tool: toolName,
				arguments: args
			};
			const decision = await this.hookManager.approveTool(approvalReq, this.buildHookContext());

			if (!decision.approved) {
				const result: ToolResult = {
					toolName,
					arguments: args,
					success: false,
					error: `Tool execution denied: ${decision.reason}`,
					executionMs: Date.now() - startTime
				};
				this.emitEvent('tool:result', result as unknown as Record<string, unknown>, runId);

				// Emit tool:on_error lifecycle hook for denied tool
				if (this.hookManager) {
					const errorEvent: ToolOnErrorEvent = {
						kind: LifecycleHooks.tool.onError,
						runId,
						timestamp: Date.now(),
						toolName,
						arguments: args,
						error: `Tool execution denied: ${decision.reason}`,
						errorType: 'denied'
					};
					await this.hookManager.runLifecycleHook(LifecycleHooks.tool.onError, errorEvent);
				}

				return result;
			}
		}

		const tool = this.tools.get(toolName);
		if (!tool) {
			const result: ToolResult = {
				toolName,
				arguments: args,
				success: false,
				error: `Tool not found: ${toolName}`,
				executionMs: Date.now() - startTime
			};

			this.emitEvent('tool:result', result as unknown as Record<string, unknown>, runId);

			// Emit tool:on_error lifecycle hook for not found
			if (this.hookManager) {
				const errorEvent: ToolOnErrorEvent = {
					kind: LifecycleHooks.tool.onError,
					runId,
					timestamp: Date.now(),
					toolName,
					arguments: args,
					error: `Tool not found: ${toolName}`,
					errorType: 'not_found'
				};
				await this.hookManager.runLifecycleHook(LifecycleHooks.tool.onError, errorEvent);
			}

			return result;
		}

		// Emit typed ToolExecStart event
		this.emitTypedEvent(EventKind.ToolExecStart, {
			tool: toolName,
			arguments: args
		});

		// Emit tool:before_execute lifecycle hook
		if (this.hookManager) {
			const beforeEvent: ToolBeforeExecuteEvent = {
				kind: LifecycleHooks.tool.beforeExecute,
				runId,
				timestamp: Date.now(),
				toolName,
				arguments: args
			};
			await this.hookManager.runLifecycleHook(LifecycleHooks.tool.beforeExecute, beforeEvent);
		}

		try {
			const result = await this.executeToolWithTimeout(tool, args, this.toolTimeout);
			this.emitEvent('tool:result', result as unknown as Record<string, unknown>, runId);

			// Emit typed ToolExecEnd event
			this.emitTypedEvent(EventKind.ToolExecEnd, {
				tool: toolName,
				duration_ms: result.executionMs,
				for_llm_len: result.output?.length ?? 0,
				for_user_len: 0,
				is_error: !result.success,
				async: false
			});

			// Emit tool:after_execute lifecycle hook
			if (this.hookManager) {
				const afterEvent: ToolAfterExecuteEvent = {
					kind: LifecycleHooks.tool.afterExecute,
					runId,
					timestamp: Date.now(),
					toolName,
					arguments: args,
					result: {
						success: result.success,
						output: result.output,
						error: result.error
					},
					durationMs: result.executionMs
				};
				await this.hookManager.runLifecycleHook(LifecycleHooks.tool.afterExecute, afterEvent);
			}

			return result;
		} catch (err) {
			const result: ToolResult = {
				toolName,
				arguments: args,
				success: false,
				error: err instanceof Error ? err.message : String(err),
				executionMs: Date.now() - startTime
			};

			this.emitEvent('tool:result', result as unknown as Record<string, unknown>, runId);

			// Emit tool:on_error lifecycle hook for execution error
			if (this.hookManager) {
				const errorEvent: ToolOnErrorEvent = {
					kind: LifecycleHooks.tool.onError,
					runId,
					timestamp: Date.now(),
					toolName,
					arguments: args,
					error: err instanceof Error ? err.message : String(err),
					errorType: 'execution_error'
				};
				await this.hookManager.runLifecycleHook(LifecycleHooks.tool.onError, errorEvent);
			}

			return result;
		}
	}

	private async executeToolWithTimeout(
		tool: ToolDefinition,
		args: Record<string, unknown>,
		timeoutMs: number
	): Promise<ToolResult> {
		const startTime = Date.now();

		return new Promise((resolve) => {
			const timeout = setTimeout(() => {
				resolve({
					toolName: tool.name,
					arguments: args,
					success: false,
					error: `Tool execution timed out after ${timeoutMs}ms`,
					executionMs: Date.now() - startTime
				});
			}, timeoutMs);

			Promise.resolve()
				.then(() => this.executeToolHandler(tool, args))
				.then((result) => {
					clearTimeout(timeout);
					resolve({ ...result, executionMs: Date.now() - startTime });
				})
				.catch((err) => {
					clearTimeout(timeout);
					resolve({
						toolName: tool.name,
						arguments: args,
						success: false,
						error: err instanceof Error ? err.message : String(err),
						executionMs: Date.now() - startTime
					});
				});
		});
	}

	private async executeToolHandler(
		tool: ToolDefinition,
		args: Record<string, unknown>
	): Promise<ToolResult> {
		if (this.toolExecutor) {
			return this.toolExecutor(tool, args);
		}
		throw new Error(`Tool '${tool.name}' execution not implemented - register a tool executor`);
	}

	private buildLlmRequest(messages: AgentMessage[], modelOverride?: string): LlmRequest {
		return {
			model: modelOverride ?? this.config.model ?? 'default',
			messages,
			tools: this.tools.size > 0 ? Array.from(this.tools.values()) : undefined,
			temperature: this.config.temperature,
			maxTokens: this.config.maxTokens
		};
	}

	private async callProvider(request: LlmRequest): Promise<LlmResponse> {
		const hookContext = this.buildHookContext();
		const callStartTime = Date.now();
		const runId = `run_${callStartTime}`;

		// Emit provider:before_call lifecycle hook
		if (this.hookManager) {
			const beforeEvent: ProviderBeforeCallEvent = {
				kind: LifecycleHooks.provider.beforeCall,
				runId,
				timestamp: callStartTime,
				model: request.model,
				options: { temperature: request.temperature, maxTokens: request.maxTokens }
			};
			await this.hookManager.runLifecycleHook(LifecycleHooks.provider.beforeCall, beforeEvent);
		}

		// Before LLM call - interception
		if (this.hookManager) {
			const llmReq: LLMHookRequest = {
				model: request.model,
				messages: request.messages,
				tools: request.tools,
				options: { temperature: request.temperature, maxTokens: request.maxTokens }
			};

			const { req: modifiedReq, decision } = await this.hookManager.beforeLLM(llmReq, hookContext);

			if (decision.action === 'abort_turn' || decision.action === 'hard_abort') {
				throw new Error(`Hook aborted: ${decision.reason}`);
			}

			if (decision.action === 'modify' && modifiedReq) {
				// Apply modifications
				request = {
					...request,
					messages: modifiedReq.messages ?? request.messages,
					model: modifiedReq.model ?? request.model
				};
			}
		}

		try {
			const response = await this.provider.chat(request);

			// DEBUG: Log the response structure
			console.log('[callProvider] Response received:');
			console.log('  model:', response.model);
			console.log('  finishReason:', response.finishReason);
			console.log('  message.role:', response.message.role);
			console.log('  message.content type:', typeof response.message.content);
			console.log('  message.content is array?:', Array.isArray(response.message.content));
			if (typeof response.message.content === 'string') {
				console.log('  message.content (string) length:', response.message.content.length);
			} else if (Array.isArray(response.message.content)) {
				console.log('  message.content array length:', response.message.content.length);
				for (let i = 0; i < response.message.content.length; i++) {
					const block = response.message.content[i];
					console.log(`    [${i}]:`, typeof block === 'object' ? JSON.stringify(block) : block);
				}
			}

			// After LLM call - interception
			if (this.hookManager) {
				const llmResp: LLMHookResponse = {
					model: response.model,
					response
				};
				await this.hookManager.afterLLM(llmResp, hookContext);
			}

			this.emitEvent(
				'provider:response',
				{
					model: response.model,
					finishReason: response.finishReason,
					usage: response.usage
				},
				runId
			);

			// Emit typed LLMResponse event
			this.emitTypedEvent(EventKind.LLMResponse, {
				content_len:
					typeof response.message.content === 'string'
						? response.message.content.length
						: JSON.stringify(response.message.content).length,
				tool_calls: 0, // Will be updated after extraction
				has_reasoning: false
			});

			// Emit provider:after_call lifecycle hook
			if (this.hookManager) {
				const afterEvent: ProviderAfterCallEvent = {
					kind: LifecycleHooks.provider.afterCall,
					runId,
					timestamp: Date.now(),
					model: response.model,
					response: {
						finishReason: response.finishReason,
						usage: response.usage
					},
					durationMs: Date.now() - callStartTime
				};
				await this.hookManager.runLifecycleHook(LifecycleHooks.provider.afterCall, afterEvent);
			}

			return response;
		} catch (err) {
			const error = classifyError(err);
			this.emitEvent('provider:error', { error, model: request.model }, runId);

			// Emit provider:on_error lifecycle hook
			if (this.hookManager) {
				const errorEvent: ProviderOnErrorEvent = {
					kind: LifecycleHooks.provider.onError,
					runId,
					timestamp: Date.now(),
					model: request.model,
					error: err instanceof Error ? err.message : String(err),
					errorType: mapErrorToProviderErrorType(error)
				};
				await this.hookManager.runLifecycleHook(LifecycleHooks.provider.onError, errorEvent);
			}

			throw err;
		}
	}

	private extractOutput(message: AgentMessage): string {
		if (typeof message.content === 'string') {
			return message.content;
		}
		if (Array.isArray(message.content)) {
			const textParts: string[] = [];
			for (const block of message.content) {
				if (typeof block === 'object' && block.type === 'text') {
					textParts.push(block.text);
				}
			}
			return textParts.join('\n');
		}
		return '';
	}

	private extractToolCalls(message: AgentMessage, runId: string): ToolCall[] {
		const toolCalls: ToolCall[] = [];
		const unknownTools: string[] = [];

		// DEBUG: Log the content type and structure
		console.log('[extractToolCalls] message.content type:', typeof message.content);
		console.log('[extractToolCalls] Is array?:', Array.isArray(message.content));
		if (typeof message.content === 'string') {
			console.log('[extractToolCalls] Content is string, length:', message.content.length);
			return toolCalls;
		}

		if (Array.isArray(message.content)) {
			console.log('[extractToolCalls] Content is array, length:', message.content.length);
			for (const block of message.content) {
				// DEBUG: Log each block's type and structure
				console.log('[extractToolCalls] Block:', JSON.stringify(block));
				console.log(
					'[extractToolCalls] Block type:',
					typeof block === 'object' ? (block as any).type : 'not an object'
				);

				// Check for BOTH 'tool_call' (underscore) and 'tool-call' (hyphen) formats
				// AI SDK uses 'tool-call' (hyphen) in result.content
				// But MolosLLMProviderClient constructs with 'tool_call' (underscore)
				const blockType = typeof block === 'object' ? (block as any).type : null;
				if (typeof block === 'object' && (blockType === 'tool_call' || blockType === 'tool-call')) {
					// Support both naming conventions: id/toolCallId, name/toolName
					const toolName = (block as any).name || (block as any).toolName;
					const toolId = (block as any).id || (block as any).toolCallId;
					const toolInput = (block as any).input || (block as any).arguments;

					console.log('[extractToolCalls] Found tool call block, name:', toolName, 'id:', toolId);

					let tool = this.tools.get(toolName);

					// Fallback matching if exact name not found
					if (!tool) {
						tool = this.findToolByFallback(toolName);
					}

					if (tool) {
						// Store the original toolName so the tool message can use it
						// This is important because tool.name (from ToolDefinition) might differ
						// from the name the AI SDK sent in the tool_call block
						toolCalls.push({ id: toolId, tool, arguments: toolInput, name: toolName });
					} else {
						// Track unknown tools for warning
						unknownTools.push(toolName);
					}
				}
			}
		} else if (message.content !== null && message.content !== undefined) {
			// DEBUG: Log unexpected content types
			console.log('[extractToolCalls] Unexpected content type:', typeof message.content);
			console.log('[extractToolCalls] Content value:', JSON.stringify(message.content));
		}

		console.log('[extractToolCalls] Returning toolCalls count:', toolCalls.length);

		// Emit warning for unknown tools
		if (unknownTools.length > 0) {
			this.emitEvent('tool:unknown', { tools: unknownTools }, runId);
		}

		return toolCalls;
	}

	/**
	 * Try to find a tool using fallback matching strategies:
	 * 1. Strip module prefix (e.g., MoLOS-Tasks_get_tasks → get_tasks)
	 * 2. Find by suffix match
	 * 3. Case-insensitive match as last resort
	 */
	private findToolByFallback(toolName: string): ToolDefinition | undefined {
		// Strategy 1: Try stripping module prefix (e.g., MoLOS-Tasks_get_tasks → get_tasks)
		const lastUnderscoreIndex = toolName.lastIndexOf('_');
		if (lastUnderscoreIndex > 0) {
			const strippedName = toolName.substring(lastUnderscoreIndex + 1);
			const tool = this.tools.get(strippedName);
			if (tool) return tool;
		}

		// Strategy 2: Try finding by suffix match (e.g., MoLOS-Tasks_get_tasks matches get_tasks)
		for (const [name, def] of this.tools) {
			if (name.endsWith('_' + toolName) || name.endsWith('/' + toolName)) {
				return def;
			}
		}

		// Strategy 3: Case-insensitive match as last resort
		const lowerName = toolName.toLowerCase();
		for (const [name, def] of this.tools) {
			if (name.toLowerCase() === lowerName) {
				return def;
			}
		}

		return undefined;
	}

	private shouldStop(result: TurnResult): boolean {
		if (result.toolCalls.length === 0 && result.output.trim().length > 0) {
			return true;
		}
		if (this.state.toolCallCount >= this.maxToolCallsPerTurn) {
			return true;
		}
		return false;
	}

	getIteration(): number {
		return this.state.iteration;
	}
	getTurnCount(): number {
		return this.state.turnCount;
	}
	getToolCallCount(): number {
		return this.state.toolCallCount;
	}
	isRunning(): boolean {
		return this.state.running;
	}
	getUsage(): { inputTokens: number; outputTokens: number; totalTokens: number } {
		return { ...this.state.accumulatedUsage };
	}

	reset(): void {
		if (this.state.running) throw new Error('Cannot reset while agent is running');
		this.state = this.createInitialState();
		this.turnManager = createTurnManager({ maxTurns: this.maxTurns, maxSubTurnDepth: 3 });
	}

	abort(): void {
		if (this.abortController) this.abortController.abort();
	}

	registerTool(tool: ToolDefinition): void {
		this.tools.set(tool.name, tool);
	}
	unregisterTool(toolName: string): boolean {
		return this.tools.delete(toolName);
	}
	getSessionStore(): SessionStore {
		return this.session;
	}
	getEventBus(): EventBus {
		return this.events;
	}
	getContextBuilder(): ContextBuilder {
		return this.contextBuilder;
	}
	getTurnManager(): TurnManager {
		return this.turnManager;
	}
	getHookManager(): HookManager | undefined {
		return this.hookManager;
	}
	setHookManager(hookManager: HookManager): void {
		this.hookManager = hookManager;
	}

	/**
	 * Run the agent loop with streaming support.
	 * Returns a StreamResult with an async iterable of StreamChunks that can be
	 * consumed by a client to receive real-time updates.
	 *
	 * @param messages - Initial conversation messages
	 * @param input - User input
	 * @param customMiddlewares - Optional array of custom streaming middlewares to apply
	 * @returns StreamResult containing the stream and context
	 */
	runStream(
		messages: AgentMessage[],
		input: string,
		customMiddlewares?: StreamMiddleware[]
	): StreamResult {
		if (this.state.running) {
			throw new Error('Agent loop is already running');
		}

		const runId = `stream_${Date.now()}`;
		const turn = this.turnManager.createTurn(input);

		const context: StreamContext = {
			turnId: turn.id,
			iteration: 0,
			toolCallCount: 0,
			metadata: { runId },
			abortSignal: this.abortController?.signal
		};

		// Create the base stream
		const baseStream = this.createStream(turn, messages, input, runId);

		// Create and configure the middleware chain
		const chain = new StreamChain();

		// Apply custom middlewares first if provided
		if (customMiddlewares) {
			for (const mw of customMiddlewares) {
				chain.use(mw);
			}
		}

		// Apply built-in sanitization middlewares by default
		chain.use(streamingMiddlewares.sanitizeMalformedToolCalls);
		chain.use(streamingMiddlewares.trimToolCallNames);
		chain.use(streamingMiddlewares.repairMalformedToolCallArguments);

		const stream = chain.execute(baseStream, context);

		return {
			stream,
			context
		};
	}

	/**
	 * Create the base streaming implementation.
	 * This is a generator that yields StreamChunks as the LLM response comes in.
	 */
	private async *createStream(
		turn: Turn,
		messages: AgentMessage[],
		input: string,
		runId: string
	): AsyncIterable<StreamChunk> {
		this.state.running = true;
		this.abortController = new AbortController();
		this.state.currentTurn = turn as Turn;

		const allMessages = [...messages];
		const maxToolExecutions = 100;
		let toolExecutionCount = 0;

		try {
			this.emitEvent('run:start', { input, messageCount: messages.length }, runId);

			// Main autonomous loop - continue until no more tool calls
			while (!this.abortController.signal.aborted) {
				// Build prompt and messages
				const { prompt: systemPrompt } = await this.contextBuilder.buildSystemPromptWithCache();
				const dynamicContext = this.contextBuilder.buildDynamicContext({ key: 'default' });
				const builtMessages = this.contextBuilder.buildMessages(
					allMessages,
					input,
					systemPrompt,
					dynamicContext
				);

				// Call LLM
				const request = this.buildLlmRequest(builtMessages);
				const response = await this.callProvider(request);

				// Extract tool calls from response
				const extractedToolCalls = this.extractToolCalls(response.message, runId);

				// Add LLM response to messages (needed for next iteration if tools were called)
				allMessages.push(response.message);

				// If no tool calls, this is the final response - yield output and finish
				if (extractedToolCalls.length === 0) {
					const output = this.extractOutput(response.message);
					if (output) {
						// Yield text in chunks of 10 chars
						for (let i = 0; i < output.length; i += 10) {
							yield {
								type: 'text-delta',
								delta: output.slice(i, i + 10)
							};
						}
					}

					yield {
						type: 'finish',
						reason: response.finishReason,
						usage: response.usage
					};
					return; // Exit the loop
				}

				// Execute tool calls and stream results
				for (const toolCall of extractedToolCalls) {
					// Check abort signal within tool execution loop
					if (this.abortController.signal.aborted) {
						break;
					}

					yield {
						type: 'tool-call-start',
						toolName: toolCall.tool.name,
						toolCallId: toolCall.id
					};

					// Stream the arguments as delta chunks
					const argsStr = JSON.stringify(toolCall.arguments);
					for (let i = 0; i < argsStr.length; i += 10) {
						yield {
							type: 'tool-call-delta',
							toolCallId: toolCall.id,
							delta: argsStr.slice(i, i + 10)
						};
					}

					// Execute tool and yield result
					const result = await this.executeTool(toolCall.tool.name, toolCall.arguments);
					toolExecutionCount++;

					yield {
						type: 'tool-call-end',
						toolCallId: toolCall.id,
						result: result.success ? result.output : result.error
					};

					// Add tool result to messages for next LLM call
					// IMPORTANT: The toolCallId MUST match the id from the tool_call block
					// in the assistant message, and name should match the ORIGINAL tool name
					// from the AI SDK response (toolCall.name), NOT toolCall.tool.name
					// toolCall.tool.name might differ if fallback matching was used
					const toolResultContent = result.success
						? (result.output ?? '')
						: (result.error ?? 'Tool execution failed');

					allMessages.push({
						role: 'tool' as const,
						content: toolResultContent,
						toolCallId: toolCall.id,
						name: toolCall.name ?? toolCall.tool.name
					});

					// Safety limit check
					if (toolExecutionCount >= maxToolExecutions) {
						yield {
							type: 'error',
							error: `Maximum tool executions (${maxToolExecutions}) reached`
						};
						return;
					}
				}

				// Loop back to LLM with tool results (Picoclaw pattern)
			}

			// Handle abort signal exit
			if (this.abortController.signal.aborted) {
				yield {
					type: 'error',
					error: 'Execution aborted'
				};
			}
		} catch (err) {
			yield {
				type: 'error',
				error: err instanceof Error ? err.message : String(err)
			};
		} finally {
			this.state.running = false;
			this.state.currentTurn = null;
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

export function createAgentLoop(
	config: AgentLoopConfig & {
		provider: LLMProviderClient;
		workspace?: string;
		maxSubTurnDepth?: number;
		maxIterations?: number;
	}
): AgentLoop {
	return new AgentLoop(config);
}
