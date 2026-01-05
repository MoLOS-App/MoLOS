import { AiRepository } from '$lib/repositories/ai/ai-repository';
import { AiToolbox } from './toolbox';
import type {
	AiMessage,
	AiAction,
	AiSettings,
	ToolDefinition,
	AiChatResponse,
	AiAgentEvent,
	AiAgentTelemetry
} from '$lib/models/ai';
import {
	TtlCache,
	createToolCacheKey,
	dedupeToolCalls,
	isWriteTool,
	normalizeToolParams,
	stableStringify,
	validateToolParams,
	type ToolCall
} from './agent-utils';
import {
	createTelemetry,
	estimateTokensFromMessages,
	estimateTokensFromText
} from './telemetry';
import { getAgentRuntimeConfig, type AgentRuntimeConfig } from './runtime-config';

type LlmResponse = {
	content: string;
	toolCalls?: ToolCall[];
	rawToolCalls?: unknown[];
};

class AiAgentError extends Error {
	code: string;
	status?: number;
	details?: unknown;

	constructor(code: string, message: string, options?: { status?: number; details?: unknown }) {
		super(message);
		this.code = code;
		this.status = options?.status;
		this.details = options?.details;
	}
}

const toolResultCache = new TtlCache<unknown>(
	Number(process.env.AI_AGENT_TOOL_CACHE_SIZE || 256)
);

export class AiAgent {
	private aiRepo: AiRepository;
	private toolbox: AiToolbox;
	private userId: string;

	constructor(userId: string) {
		this.userId = userId;
		this.aiRepo = new AiRepository();
		this.toolbox = new AiToolbox();
	}

	async processMessage(
		content: string,
		sessionId: string,
		activeModuleIds: string[] = [],
		attachments?: unknown[],
		parts?: unknown[]
	): Promise<AiChatResponse> {
		// 1. Save user message
		await this.aiRepo.addMessage(this.userId, {
			role: 'user',
			content,
			sessionId,
			attachments: attachments as Array<{ name: string }> | undefined,
			parts
		});

		// 2. Get settings and history
		const settings = await this.aiRepo.getSettings(this.userId);
		const history = await this.aiRepo.getMessages(sessionId, this.userId);

		if (!settings || !settings.apiKey) {
			return {
				message: 'I need an API key to function. Please configure your AI settings.'
			};
		}

		// 3. Context Injection (Memories & Dynamic Context)
		const memories = await this.aiRepo.getMemories(this.userId);
		const context = await this.getInjectedContext(content, activeModuleIds);
		const augmentedHistory = [...history];

		const runtime = getAgentRuntimeConfig(settings);
		const systemContext = this.buildSystemContext(memories, context, runtime);

		if (systemContext) {
			augmentedHistory.unshift({
				id: 'context',
				userId: this.userId,
				sessionId,
				role: 'system',
				content: systemContext,
				createdAt: new Date()
			});
		}

		// 4. Agent Loop
		return await this.runAgentLoop(content, augmentedHistory, settings, sessionId, activeModuleIds);
	}

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
		return await this.runAgentLoop(
			'The action was confirmed and executed successfully.',
			history,
			settings,
			sessionId,
			activeModuleIds
		);
	}

	private async getInjectedContext(
		query: string,
		activeModuleIds: string[]
	): Promise<string | null> {
		const lowerQuery = query.toLowerCase();
		const tools = await this.toolbox.getTools(this.userId, activeModuleIds);
		const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
		const contextParts: string[] = [];

		const shouldFetchTasks = lowerQuery.includes('task') || lowerQuery.includes('todo');
		const shouldFetchExpenses =
			lowerQuery.includes('expense') ||
			lowerQuery.includes('money') ||
			lowerQuery.includes('spend');

		const tasksPromise = shouldFetchTasks
			? toolsByName.get('get_tasks')?.execute({ status: 'to_do' })
			: undefined;
		const expensesPromise = shouldFetchExpenses
			? toolsByName.get('get_expenses')?.execute({ limit: 5 })
			: undefined;

		let tasks: unknown;
		let expenses: unknown;
		try {
			[tasks, expenses] = await Promise.all([tasksPromise, expensesPromise]);
		} catch (error) {
			console.warn('[AiAgent] Failed to fetch injected context data:', error);
			return null;
		}

		if (Array.isArray(tasks) && tasks.length > 0) {
			contextParts.push(
				`Pending Tasks: ${tasks
					.slice(0, 5)
					.map((t: any) => t.title)
					.join(', ')}`
			);
		}

		if (Array.isArray(expenses) && expenses.length > 0) {
			contextParts.push(
				`Recent Expenses: ${expenses.map((e) => `${e.description} ($${e.amount})`).join(', ')}`
			);
		}

		return contextParts.length > 0 ? contextParts.join('\n') : null;
	}

	private buildSystemContext(
		memories: { content: string }[],
		context: string | null,
		runtime: AgentRuntimeConfig
	): string | null {
		const contextParts: string[] = [];
		if (memories.length > 0) {
			const trimmedMemories = memories
				.map((memory) => memory.content)
				.join('\n')
				.slice(0, runtime.memoryMaxChars);
			contextParts.push(`USER MEMORIES:\n${trimmedMemories}`);
		}
		if (context) {
			contextParts.push(`RELEVANT DATABASE CONTEXT:\n${context}`);
		}
		return contextParts.length > 0 ? contextParts.join('\n\n') : null;
	}

	private async runAgentLoop(
		content: string,
		history: AiMessage[],
		settings: AiSettings,
		sessionId: string,
		activeModuleIds: string[]
	): Promise<AiChatResponse> {
		const tools = await this.toolbox.getTools(this.userId, activeModuleIds);
		const dynamicPrompt = await this.toolbox.getDynamicSystemPrompt(this.userId, activeModuleIds);
		const actions: AiAction[] = [];
		let currentPlan: string | null = null;
		const runtime = getAgentRuntimeConfig(settings);
		const runId = crypto.randomUUID();
		const { telemetry, events, recordEvent } = createTelemetry(runId);
		const record = (event: AiAgentEvent) => {
			if (events.length >= runtime.maxEvents) return;
			recordEvent(event);
		};
		record({ type: 'run_start', timestamp: Date.now() });

		let currentMessages: Record<string, unknown>[] = [
			{ role: 'system', content: settings.systemPrompt || dynamicPrompt },
			...history.map((m) => {
				const msg: Record<string, unknown> = { role: m.role, content: m.content };
				if (m.toolCalls) msg.tool_calls = m.toolCalls;
				if (m.toolCallId) msg.tool_call_id = m.toolCallId;
				return msg;
			}),
			{ role: 'user', content }
		];
		currentMessages = this.trimMessagesToBudget(currentMessages, runtime.promptTokenBudget);
		telemetry.tokenEstimateIn = estimateTokensFromMessages(currentMessages);

		try {
			let response = await this.callLLM(
				currentMessages,
				tools,
				settings,
				runtime,
				record,
				telemetry
			);

			let iterations = 0;
			let lastToolSignature: string | null = null;
			while (iterations < runtime.maxSteps) {
				if (Date.now() - telemetry.startMs > runtime.maxDurationMs) {
					record({
						type: 'guardrail',
						timestamp: Date.now(),
						detail: { reason: 'max_duration' }
					});
					telemetry.durationMs = Date.now() - telemetry.startMs;
					record({ type: 'run_end', timestamp: Date.now() });
					return {
						message: 'I need a bit more time to finish this. Please try again.',
						actions,
						events: runtime.telemetryEnabled ? events : undefined,
						telemetry: runtime.telemetryEnabled ? telemetry : undefined
					};
				}
				iterations++;
				record({ type: 'iteration', timestamp: Date.now(), detail: { step: iterations } });

				// Self-Correction: If the response is empty and no tool calls, try one more time with a nudge
				if (
					!response.content &&
					(!response.toolCalls || response.toolCalls.length === 0) &&
					iterations < 3
				) {
					currentMessages.push({
						role: 'user',
						content: 'Please provide a response or take an action.'
					});
					currentMessages = this.trimMessagesToBudget(currentMessages, runtime.promptTokenBudget);
					response = await this.callLLM(
						currentMessages,
						tools,
						settings,
						runtime,
						record,
						telemetry
					);
					continue;
				}

				// Extract thought and plan if present
				const thoughtMatch = response.content?.match(/<thought>([\s\S]*?)<\/thought>/);
				const thought = thoughtMatch ? thoughtMatch[1].trim() : null;

				const planMatch = response.content?.match(/<plan>([\s\S]*?)<\/plan>/);
				if (planMatch) currentPlan = planMatch[1].trim();

				const cleanContent = response.content
					?.replace(/<thought>[\s\S]*?<\/thought>/, '')
					.replace(/<plan>[\s\S]*?<\/plan>/, '')
					.trim();

				if (response.toolCalls && response.toolCalls.length > 0) {
					const toolCalls = dedupeToolCalls(
						response.toolCalls.map((call) => ({
							...call,
							parameters: normalizeToolParams(call.parameters)
						}))
					);
					const toolSignature = stableStringify(
						toolCalls.map((call) => ({ name: call.name, parameters: call.parameters }))
					);
					if (toolSignature === lastToolSignature) {
						record({
							type: 'guardrail',
							timestamp: Date.now(),
							detail: { reason: 'repeated_tool_calls' }
						});
						telemetry.durationMs = Date.now() - telemetry.startMs;
						record({ type: 'run_end', timestamp: Date.now() });
						return {
							message:
								cleanContent ||
								"I couldn't make progress with those tool calls. Could you clarify your request?",
							actions,
							events: runtime.telemetryEnabled ? events : undefined,
							telemetry: runtime.telemetryEnabled ? telemetry : undefined
						};
					}
					lastToolSignature = toolSignature;

					const toolCallMessage = {
						role: 'assistant',
						content: response.content || null,
						tool_calls: response.rawToolCalls
					};
					currentMessages.push(toolCallMessage);

					// Save assistant message with tool calls and thought to history
					// We only save if there is actual content or if it's the final message
					if (cleanContent || iterations === 1) {
						await this.aiRepo.addMessage(this.userId, {
							role: 'assistant',
							content: cleanContent || '',
							sessionId,
							toolCalls: response.rawToolCalls as Record<string, unknown>[],
							contextMetadata: JSON.stringify({ thought, plan: currentPlan })
						});
					}

					const readCalls = toolCalls.filter((call) => !isWriteTool(call.name));

					const writeCalls = toolCalls.filter((call) => !readCalls.includes(call));

					// Handle Read Calls in Parallel
					if (readCalls.length > 0) {
						const results = await Promise.all(
							readCalls.map(async (call) => {
								const tool = tools.find((t) => t.name === call.name);
								if (tool) {
									const validation = validateToolParams(tool, call.parameters);
									if (!validation.ok) {
										return {
											call,
											result: { error: 'Missing required parameters', missing: validation.missing }
										};
									}
									const cacheKey = createToolCacheKey(this.userId, call.name, call.parameters);
									const cached = toolResultCache.get(cacheKey);
									if (cached !== undefined) {
										return { call, result: cached, cacheHit: true };
									}
									try {
										record({
											type: 'tool_call_start',
											timestamp: Date.now(),
											detail: { tool: call.name }
										});
										const result = await tool.execute(call.parameters);
										toolResultCache.set(cacheKey, result, runtime.toolCacheTtlMs);
										record({
											type: 'tool_call_end',
											timestamp: Date.now(),
											detail: { tool: call.name }
										});
										return { call, result };
									} catch (error) {
										record({
											type: 'tool_call_end',
											timestamp: Date.now(),
											detail: { tool: call.name, error: true }
										});
										return { call, result: { error: 'Tool execution failed' } };
									}
								}
								return { call, result: { error: 'Tool not found' } };
							})
						);

						for (const { call, result, cacheHit } of results as Array<{
							call: ToolCall;
							result: unknown;
							cacheHit?: boolean;
						}>) {
							const action: AiAction = {
								type: 'read',
								entity: call.name.split('_')[1] || 'data',
								description: `Reading ${call.name.replace('_', ' ')}`,
								status: 'executed',
								data: {
									toolName: call.name,
									parameters: call.parameters,
									toolCallId: call.id,
									cacheHit
								}
							};
							actions.push(action);
							telemetry.toolCalls += 1;

							const toolResultMessage = {
								role: 'tool',
								tool_call_id: call.id,
								name: call.name,
								content: JSON.stringify(result)
							};
							currentMessages.push(toolResultMessage);

							await this.aiRepo.addMessage(this.userId, {
								role: 'tool',
								content: JSON.stringify(result),
								sessionId,
								toolCallId: call.id
							});
						}
					}

					// Handle Write Calls (Pending confirmation)
					for (const call of writeCalls) {
						const tool = tools.find((t) => t.name === call.name);
						if (!tool) {
							actions.push({
								type: 'write',
								entity: call.name.split('_')[1] || 'data',
								description: `Tool not found: ${call.name}`,
								status: 'failed',
								data: { toolName: call.name, parameters: call.parameters, toolCallId: call.id }
							});
							continue;
						}

						const validation = validateToolParams(tool, call.parameters);
						if (!validation.ok) {
							actions.push({
								type: 'write',
								entity: call.name.split('_')[1] || 'data',
								description: `Missing required parameters for ${call.name}: ${validation.missing.join(
									', '
								)}`,
								status: 'failed',
								data: { toolName: call.name, parameters: call.parameters, toolCallId: call.id }
							});
							continue;
						}
						const isBulk = call.name.startsWith('bulk');
						const itemCount =
							(call.parameters as any)?.items?.length ||
							(call.parameters as any)?.ids?.length ||
							(call.parameters as any)?.meals?.length ||
							(call.parameters as any)?.workouts?.length ||
							(call.parameters as any)?.expenses?.length ||
							(call.parameters as any)?.entries?.length ||
							(call.parameters as any)?.goals?.length ||
							(call.parameters as any)?.resources?.length ||
							(call.parameters as any)?.tasks?.length;

						const action: AiAction = {
							type: 'write',
							entity: call.name.split('_')[1] || 'data',
							description:
								isBulk && itemCount
									? `I need to ${call.name.replace(/_/g, ' ')} (${itemCount} items)`
									: `I need to ${call.name.replace(/_/g, ' ')}`,
							status: 'pending',
							data: { toolName: call.name, parameters: call.parameters, toolCallId: call.id }
						};
						actions.push(action);
						telemetry.toolCalls += 1;
					}

					// If we only have write calls, we stop and wait for user confirmation
					if (readCalls.length === 0 && writeCalls.length > 0) {
						// If there's no content yet, we might want to nudge the LLM to explain what it's doing
						// but for now we return the pending actions to the UI
						telemetry.durationMs = Date.now() - telemetry.startMs;
						record({ type: 'run_end', timestamp: Date.now() });
						return {
							message:
								cleanContent ||
								(writeCalls.length === 1
									? `I need your confirmation to ${writeCalls[0].name.replace(/_/g, ' ')}.`
									: "I've planned some actions that require your confirmation."),
							actions,
							events: runtime.telemetryEnabled ? events : undefined,
							telemetry: runtime.telemetryEnabled ? telemetry : undefined
						};
					}

					// If we had read calls, we continue the loop to let the LLM process the results
					if (readCalls.length > 0) {
						currentMessages = this.trimMessagesToBudget(currentMessages, runtime.promptTokenBudget);
						response = await this.callLLM(
							currentMessages,
							tools,
							settings,
							runtime,
							record,
							telemetry
						);
						continue;
					}
				}

				// No more tool calls, or only read calls that are finished
				const finalMessage = cleanContent || "I've processed your request.";

				await this.aiRepo.addMessage(this.userId, {
					role: 'assistant',
					content: finalMessage,
					sessionId,
					contextMetadata: JSON.stringify({
						thought,
						plan: currentPlan,
						actions: actions.length > 0 ? actions : undefined,
						telemetry: runtime.telemetryEnabled ? telemetry : undefined,
						events: runtime.telemetryEnabled ? events : undefined
					})
				});

				telemetry.durationMs = Date.now() - telemetry.startMs;
				if (telemetry.tokenEstimateOut === 0) {
					telemetry.tokenEstimateOut = estimateTokensFromText(finalMessage);
				}
				record({ type: 'run_end', timestamp: Date.now() });

				return {
					message: finalMessage,
					actions,
					events: runtime.telemetryEnabled ? events : undefined,
					telemetry: runtime.telemetryEnabled ? telemetry : undefined
				};
			}

			record({
				type: 'guardrail',
				timestamp: Date.now(),
				detail: { reason: 'max_steps' }
			});
			telemetry.durationMs = Date.now() - telemetry.startMs;
			record({ type: 'run_end', timestamp: Date.now() });
			return {
				message: "I've reached the maximum number of iterations.",
				actions,
				events: runtime.telemetryEnabled ? events : undefined,
				telemetry: runtime.telemetryEnabled ? telemetry : undefined
			};
		} catch (e) {
			const error = e as AiAgentError;
			console.error('Agent Loop Error:', error);
			telemetry.errors += 1;
			telemetry.durationMs = Date.now() - telemetry.startMs;
			record({
				type: 'error',
				timestamp: Date.now(),
				detail: { code: error.code, message: error.message }
			});
			record({ type: 'run_end', timestamp: Date.now() });
			return {
				message: this.formatUserError(error),
				actions,
				events: runtime.telemetryEnabled ? events : undefined,
				telemetry: runtime.telemetryEnabled ? telemetry : undefined
			};
		}
	}

	private async callLLM(
		messages: Record<string, unknown>[],
		tools: ToolDefinition[],
		settings: AiSettings,
		runtime: AgentRuntimeConfig,
		record: (event: AiAgentEvent) => void,
		telemetry: AiAgentTelemetry
	): Promise<LlmResponse> {
		const { provider, apiKey, modelName, baseUrl } = settings;

		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		let endpoint = '';
		let body: Record<string, unknown> = {};

		if (provider === 'anthropic') {
			endpoint = 'https://api.anthropic.com/v1/messages';
			headers['x-api-key'] = apiKey!;
			headers['anthropic-version'] = '2023-06-01';

			body = {
				model: modelName,
				max_tokens: settings.maxTokens || 4096,
				temperature: settings.temperature !== undefined ? settings.temperature / 100 : undefined,
				top_p: settings.topP !== undefined ? settings.topP / 100 : undefined,
				system: (messages.find((m) => m.role === 'system')?.content as string) || undefined,
				messages: messages
					.filter((m) => m.role !== 'system')
					.map((m) => {
						const msg: Record<string, unknown> = { role: m.role, content: m.content };
						if (m.tool_calls) {
							msg.content = [
								{ type: 'text', text: m.content || '' },
								...(m.tool_calls as any[]).map((tc) => {
									let input = {};
									try {
										input =
											typeof tc.function.arguments === 'string'
												? JSON.parse(tc.function.arguments)
												: tc.function.arguments;
									} catch (e) {
										console.error('Failed to parse tool arguments:', tc.function.arguments);
									}
									return {
										type: 'tool_use',
										id: tc.id,
										name: tc.function.name,
										input
									};
								})
							];
						}
						if (m.role === 'tool') {
							msg.role = 'user';
							msg.content = [
								{
									type: 'tool_result',
									tool_use_id: m.tool_call_id,
									content: m.content
								}
							];
						}
						return msg;
					}),
				tools: tools.map((t) => ({
					name: t.name,
					description: t.description,
					input_schema: t.parameters
				}))
			};
		} else {
			// OpenAI-compatible providers (OpenAI, OpenRouter, Ollama)
			if (provider === 'openai') {
				endpoint = 'https://api.openai.com/v1/chat/completions';
				headers['Authorization'] = `Bearer ${apiKey}`;
			} else if (provider === 'openrouter') {
				endpoint = baseUrl || 'https://openrouter.ai/api/v1/chat/completions';
				headers['Authorization'] = `Bearer ${apiKey}`;
				headers['HTTP-Referer'] = 'https://molos.app';
				headers['X-Title'] = 'MoLOS';
			} else if (provider === 'ollama') {
				endpoint = `${baseUrl || 'http://localhost:11434'}/v1/chat/completions`;
			}

			body = {
				model: modelName,
				temperature: settings.temperature !== undefined ? settings.temperature / 100 : undefined,
				top_p: settings.topP !== undefined ? settings.topP / 100 : undefined,
				max_tokens: settings.maxTokens || undefined,
				messages: messages.map((m) => {
					const msg: Record<string, unknown> = { role: m.role, content: m.content };
					if (m.tool_calls) msg.tool_calls = m.tool_calls;
					if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
					if (m.name) msg.name = m.name;
					return msg;
				}),
				tools: tools.map((t) => ({
					type: 'function',
					function: {
						name: t.name,
						description: t.description,
						parameters: t.parameters
					}
				})),
				tool_choice: 'auto'
			};
		}

		const payload = JSON.stringify(body);

		const callOnce = async (attempt: number): Promise<unknown> => {
			record({
				type: attempt === 0 ? 'llm_call' : 'llm_retry',
				timestamp: Date.now(),
				detail: { attempt }
			});
			telemetry.llmCalls += 1;
			if (attempt > 0) telemetry.retries += 1;

			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), runtime.llmTimeoutMs);
			try {
				const res = await fetch(endpoint, {
					method: 'POST',
					headers,
					body: payload,
					signal: controller.signal
				});

				if (!res.ok) {
					const errorBody = await this.parseErrorResponse(res);
					const status = res.status;
					if (this.shouldRetry(status) && attempt < runtime.retryMax) {
						await this.sleep(this.getBackoffDelay(attempt, runtime));
						return callOnce(attempt + 1);
					}
					throw new AiAgentError('llm_request_failed', errorBody.message, {
						status,
						details: errorBody.details
					});
				}

				return await res.json();
			} catch (error) {
				if (error instanceof AiAgentError) throw error;
				const isAbort =
					typeof error === 'object' &&
					error !== null &&
					'name' in error &&
					(error as { name?: string }).name === 'AbortError';
				if (attempt < runtime.retryMax) {
					await this.sleep(this.getBackoffDelay(attempt, runtime));
					return callOnce(attempt + 1);
				}
				if (isAbort) {
					throw new AiAgentError('llm_timeout', 'The AI provider timed out.', {
						details: error
					});
				}
				throw new AiAgentError('llm_network_error', 'Unable to reach the AI provider.', {
					details: error
				});
			} finally {
				clearTimeout(timeout);
			}
		};

		const data = await callOnce(0);

		if (provider === 'anthropic') {
			const contentParts = Array.isArray(data.content) ? data.content : [];
			const content = contentParts.find((c: any) => c.type === 'text')?.text || '';
			const toolCalls = contentParts
				.filter((c: any) => c.type === 'tool_use')
				.map((tc: any) => ({
					id: tc.id,
					name: tc.name,
					parameters: normalizeToolParams(tc.input)
				}));

			telemetry.tokenEstimateOut += estimateTokensFromText(content);

			return {
				content,
				toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
				rawToolCalls:
					toolCalls.length > 0
						? toolCalls.map((tc: any) => ({
								id: tc.id,
								type: 'function',
								function: {
									name: tc.name,
									arguments:
										typeof tc.parameters === 'string'
											? tc.parameters
											: JSON.stringify(tc.parameters)
								}
							}))
						: undefined
			};
		} else {
			const choice = data.choices?.[0];
			const message = choice?.message || {};

			const toolCalls = (message.tool_calls as Record<string, unknown>[])?.map(
				(tc: Record<string, unknown>) => {
					const func = tc.function as Record<string, unknown>;
					let parameters = {};
					try {
						parameters =
							typeof func.arguments === 'string' ? JSON.parse(func.arguments) : func.arguments;
					} catch (e) {
						console.error(
							'Failed to parse tool arguments from OpenAI-compatible provider:',
							func.arguments
						);
					}
					return {
						id: tc.id as string,
						name: func.name as string,
						parameters: normalizeToolParams(parameters)
					};
				}
			);

			telemetry.tokenEstimateOut += estimateTokensFromText(message.content as string);

			return {
				content: (message.content as string) || '',
				toolCalls,
				rawToolCalls: message.tool_calls as unknown[]
			};
		}
	}

	private trimMessagesToBudget(
		messages: Record<string, unknown>[],
		budget: number
	): Record<string, unknown>[] {
		const trimmed = [...messages];
		while (trimmed.length > 3 && estimateTokensFromMessages(trimmed) > budget) {
			const idx = trimmed.findIndex((msg, index) => {
				const role = msg.role as string | undefined;
				return index > 0 && role !== 'system';
			});
			if (idx <= 0) break;
			trimmed.splice(idx, 1);
		}
		return trimmed;
	}

	private shouldRetry(status: number): boolean {
		return status === 408 || status === 429 || status >= 500;
	}

	private getBackoffDelay(attempt: number, runtime: AgentRuntimeConfig): number {
		const delay = Math.min(runtime.retryMaxDelayMs, runtime.retryBaseMs * 2 ** attempt);
		const jitter = Math.floor(delay * 0.2 * Math.random());
		return delay + jitter;
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private async parseErrorResponse(res: Response): Promise<{ message: string; details?: unknown }> {
		try {
			const data = await res.json();
			return {
				message: data?.error?.message || data?.error || 'API request failed',
				details: data
			};
		} catch (error) {
			const text = await res.text().catch(() => '');
			return { message: text || 'API request failed', details: text };
		}
	}

	private formatUserError(error: AiAgentError): string {
		if (error.code === 'llm_request_failed') {
			return 'The AI provider rejected the request. Please try again or adjust your settings.';
		}
		if (error.code === 'llm_network_error') {
			return 'I could not reach the AI provider. Please check your connection and try again.';
		}
		if (error.code === 'llm_timeout') {
			return 'The AI provider took too long to respond. Please try again.';
		}
		return 'I encountered an error while processing your request.';
	}

	async executeAction(action: AiAction, activeModuleIds: string[] = []): Promise<unknown> {
		if (action.status !== 'pending') return;

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
	}
}
