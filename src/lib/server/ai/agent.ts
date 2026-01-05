import { AiRepository } from '$lib/repositories/ai/ai-repository';
import { AiToolbox } from './toolbox';
import type { AiMessage, AiAction, AiSettings, ToolDefinition } from '$lib/models/ai';

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
	): Promise<{ message: string; actions?: AiAction[] }> {
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

		if (memories.length > 0 || context) {
			let systemContext = '';
			if (memories.length > 0) {
				systemContext += `USER MEMORIES:\n${memories.map((m) => `- ${m.content}`).join('\n')}\n\n`;
			}
			if (context) {
				systemContext += `RELEVANT DATABASE CONTEXT:\n${context}`;
			}

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
	): Promise<{ message: string; actions?: AiAction[] }> {
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
		const contextParts: string[] = [];

		if (lowerQuery.includes('task') || lowerQuery.includes('todo')) {
			const tasks = await tools.find((t) => t.name === 'get_tasks')?.execute({ status: 'to_do' });
			if (Array.isArray(tasks) && tasks.length > 0) {
				contextParts.push(
					`Pending Tasks: ${tasks
						.slice(0, 5)
						.map((t: any) => t.title)
						.join(', ')}`
				);
			}
		}

		if (
			lowerQuery.includes('expense') ||
			lowerQuery.includes('money') ||
			lowerQuery.includes('spend')
		) {
			const expenses = await tools.find((t) => t.name === 'get_expenses')?.execute({ limit: 5 });
			if (Array.isArray(expenses) && expenses.length > 0) {
				contextParts.push(
					`Recent Expenses: ${expenses.map((e) => `${e.description} ($${e.amount})`).join(', ')}`
				);
			}
		}

		return contextParts.length > 0 ? contextParts.join('\n') : null;
	}

	private async runAgentLoop(
		content: string,
		history: AiMessage[],
		settings: AiSettings,
		sessionId: string,
		activeModuleIds: string[]
	): Promise<{ message: string; actions?: AiAction[] }> {
		const tools = await this.toolbox.getTools(this.userId, activeModuleIds);
		const dynamicPrompt = await this.toolbox.getDynamicSystemPrompt(this.userId, activeModuleIds);
		const actions: AiAction[] = [];
		let currentPlan: string | null = null;

		const currentMessages: Record<string, unknown>[] = [
			{ role: 'system', content: settings.systemPrompt || dynamicPrompt },
			...history.map((m) => {
				const msg: Record<string, unknown> = { role: m.role, content: m.content };
				if (m.toolCalls) msg.tool_calls = m.toolCalls;
				if (m.toolCallId) msg.tool_call_id = m.toolCallId;
				return msg;
			}),
			{ role: 'user', content }
		];

		try {
			let response = await this.callLLM(currentMessages, tools, settings);

			let iterations = 0;
			while (iterations < 10) {
				iterations++;

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
					response = await this.callLLM(currentMessages, tools, settings);
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
					const toolCalls = response.toolCalls as {
						id: string;
						name: string;
						parameters: Record<string, unknown>;
					}[];

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

					const readCalls = toolCalls.filter((call) => {
						const isWrite =
							call.name.startsWith('create') ||
							call.name.startsWith('add') ||
							call.name.startsWith('log') ||
							call.name.startsWith('update') ||
							call.name.startsWith('bulk') ||
							call.name.startsWith('delete');
						return !isWrite;
					});

					const writeCalls = toolCalls.filter((call) => !readCalls.includes(call));

					// Handle Read Calls in Parallel
					if (readCalls.length > 0) {
						const results = await Promise.all(
							readCalls.map(async (call) => {
								const tool = tools.find((t) => t.name === call.name);
								if (tool) {
									const result = await tool.execute(call.parameters);
									return { call, result };
								}
								return { call, result: { error: 'Tool not found' } };
							})
						);

						for (const { call, result } of results) {
							const action: AiAction = {
								type: 'read',
								entity: call.name.split('_')[1] || 'data',
								description: `Reading ${call.name.replace('_', ' ')}`,
								status: 'executed',
								data: { toolName: call.name, parameters: call.parameters, toolCallId: call.id }
							};
							actions.push(action);

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
					}

					// If we only have write calls, we stop and wait for user confirmation
					if (readCalls.length === 0 && writeCalls.length > 0) {
						// If there's no content yet, we might want to nudge the LLM to explain what it's doing
						// but for now we return the pending actions to the UI
						return {
							message:
								cleanContent ||
								(writeCalls.length === 1
									? `I need your confirmation to ${writeCalls[0].name.replace(/_/g, ' ')}.`
									: "I've planned some actions that require your confirmation."),
							actions
						};
					}

					// If we had read calls, we continue the loop to let the LLM process the results
					if (readCalls.length > 0) {
						response = await this.callLLM(currentMessages, tools, settings);
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
						actions: actions.length > 0 ? actions : undefined
					})
				});

				return { message: finalMessage, actions };
			}

			return { message: "I've reached the maximum number of iterations.", actions };
		} catch (e) {
			console.error('Agent Loop Error:', e);
			return { message: 'I encountered an error while processing your request.' };
		}
	}

	private async callLLM(
		messages: Record<string, unknown>[],
		tools: ToolDefinition[],
		settings: AiSettings
	): Promise<{ content: string; toolCalls?: Record<string, unknown>[]; rawToolCalls?: unknown[] }> {
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

		try {
			console.log('[AiAgent] Making LLM call to:', endpoint);
			console.log('[AiAgent] Provider:', provider, 'Model:', modelName);
			const res = await fetch(endpoint, {
				method: 'POST',
				headers,
				body: JSON.stringify(body)
			});

			console.log('[AiAgent] Response status:', res.status);
			if (!res.ok) {
				const errorData = await res.json();
				console.log('[AiAgent] Error data from provider:', errorData);
				throw new Error(errorData.error?.message || errorData.error || 'API Request failed');
			}

			const data = await res.json();

			if (provider === 'anthropic') {
				const content = data.content.find((c: any) => c.type === 'text')?.text || '';
				const toolCalls = data.content
					.filter((c: any) => c.type === 'tool_use')
					.map((tc: any) => ({
						id: tc.id,
						name: tc.name,
						parameters: tc.input
					}));

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
				const choice = data.choices[0];
				const message = choice.message;

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
							parameters
						};
					}
				);

				return {
					content: message.content,
					toolCalls,
					rawToolCalls: message.tool_calls as unknown[]
				};
			}
		} catch (e: unknown) {
			const error = e as Error;
			console.error('LLM Call Error:', error);
			return { content: `Error: ${error.message}` };
		}
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
