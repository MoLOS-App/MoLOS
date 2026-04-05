/**
 * MolosAgentAdapter - Direct @molos/agent Integration
 *
 * This adapter uses the @molos/agent package directly for AI agent orchestration,
 * providing a clean interface between the MoLOS application and the agent framework.
 *
 * Key features:
 * - Uses AgentLoop for agent orchestration
 * - LLMProviderClient implementation for AI SDK compatibility
 * - Tool execution via AiToolbox
 * - Streaming support via AgentLoop.runStream()
 * - Progress callbacks for UI updates
 * - HookManager for lifecycle monitoring
 */

import type {
	AgentMessage,
	ToolDefinition,
	ToolResult,
	LlmRequest,
	LlmResponse,
	StreamChunk,
	ToolParameterSchema
} from '@molos/agent';
import type { LlmProvider, ThinkingLevel } from '@molos/agent';
import {
	createAgentLoop,
	createHookManager,
	type HookManager,
	type LLMProviderClient,
	type AgentRunResult,
	type AgentLoopConfig
} from '@molos/agent';
import { createProvider, mapProvider, getProviderOptions } from '@molos/agent';

import type { AiSettings, AiChatResponse, AiAgentTelemetry } from '$lib/models/ai';
import type { ToolDefinition as AppToolDefinition } from '$lib/models/ai';
import { AiRepository } from '$lib/repositories/ai/ai-repository';
import { AiToolbox } from '$lib/server/ai/toolbox';
import { getAgentRuntimeConfig } from '$lib/server/ai/runtime-config';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Progress event types for UI updates
 */
interface ProgressEvent {
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

/**
 * Module agent configuration
 */
interface ModuleAgentConfig {
	id: string;
	name: string;
	href: string;
	icon?: string;
	description?: string;
}

// ============================================================================
// LLM Provider Client Implementation
// ============================================================================

/**
 * LLMProviderClient implementation that wraps the AI SDK provider
 * This bridges between @molos/agent's provider interface and our existing
 * provider creation logic.
 */
class MolosLLMProviderClient implements LLMProviderClient {
	private settings: AiSettings;
	private model: Awaited<ReturnType<typeof createProvider>> | null = null;

	constructor(settings: AiSettings) {
		this.settings = settings;
	}

	private async getModel() {
		if (!this.model) {
			const providerType = mapProvider(this.settings.provider);
			this.model = await createProvider({
				provider: providerType,
				modelName: this.settings.modelName,
				apiKey: this.settings.apiKey,
				baseUrl: this.settings.baseUrl
			});
		}
		return this.model;
	}

	async chat(request: LlmRequest): Promise<LlmResponse> {
		try {
			const model = await this.getModel();
			const providerType = mapProvider(this.settings.provider);
			const providerOptions = getProviderOptions(providerType, {
				temperature: request.temperature,
				maxTokens: request.maxTokens
			});

			// Convert AgentMessage[] to AI SDK format
			const messages = request.messages.map((msg) => {
				if (msg.role === 'assistant' || msg.role === 'tool') {
					let content = msg.content;

					// For tool messages, convert string content to array format
					if (msg.role === 'tool') {
						if (typeof content === 'string') {
							// Parse the stringified tool result
							let resultContent = content;
							try {
								// Try to parse if it's JSON
								resultContent = JSON.parse(content);
							} catch {
								// Keep as-is if not JSON
							}
							// Wrap in tool-result format (AI SDK uses tool-result with hyphen)
							content = [
								{
									type: 'tool-result' as const,
									toolCallId: msg.toolCallId || '',
									toolName: msg.name || '',
									output: {
										type: typeof resultContent === 'string' ? 'text' : 'json',
										value: resultContent
									}
								}
							] as any;
						} else if (Array.isArray(content)) {
							// Already in array format, ensure it has tool-result type (with hyphen)
							content = content.map((item) => {
								if (typeof item === 'object' && (item as any).type !== 'tool-result') {
									return {
										type: 'tool-result' as const,
										toolCallId: msg.toolCallId || '',
										toolName: msg.name || '',
										output: {
											type: 'json',
											value: item
										}
									};
								}
								return item;
							}) as any;
						}
					}

					return { role: msg.role, content };
				}
				// For user and system roles, ensure content is a string
				return {
					role: msg.role,
					content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
				};
			});

			// Convert tools to AI SDK format
			// The AI SDK expects tools as a record with toolName keys and {description, inputSchema} values
			// It also requires inputSchema (not parameters) and must be wrapped with jsonSchema()
			const { jsonSchema } = await import('@ai-sdk/provider-utils');

			const toolsRecord: Record<string, any> = {};
			for (const tool of request.tools ?? []) {
				// console.log(
				// 	'[MolosLLMProviderClient] Converting tool:',
				// 	tool.name,
				// 	'with parameters:',
				// 	JSON.stringify(tool.parameters).substring(0, 200)
				// );
				// Cast to any to handle the slight type mismatch between ToolParameterSchema and JSONSchema7
				// The runtime format is compatible, just the TypeScript types differ
				toolsRecord[tool.name] = {
					description: tool.description,
					inputSchema: jsonSchema(tool.parameters as any)
				};
			}

			// Use AI SDK's generateText
			const { generateText } = await import('ai');

			console.log(
				'[MolosLLMProviderClient] Calling generateText with',
				messages.length,
				'messages,',
				Object.keys(toolsRecord).length,
				'tools'
			);
			console.log('[MolosLLMProviderClient] Tools record keys:', Object.keys(toolsRecord));

			const result = await generateText({
				model: model as any,
				system: '', // System prompt is handled by AgentLoop
				messages: messages as any,
				tools: toolsRecord as any,
				...providerOptions
			});

			// console.log(
			// 	'[MolosLLMProviderClient] generateText returned, text length:',
			// 	result.text.length,
			// 	'toolCalls:',
			// 	result.toolCalls?.length
			// );

			// Build message content - if tool calls exist, embed them in content array format
			// that @molos/agent expects
			let messageContent: string | Array<any> = result.text || '';
			if (result.toolCalls?.length) {
				// DEBUG: Log the structure of each tool call
				console.log('[MolosLLMProviderClient] result.toolCalls structure:');
				for (let i = 0; i < result.toolCalls.length; i++) {
					const tc = result.toolCalls[i];
					console.log(
						`  [${i}] type:`,
						tc.type,
						'toolCallId:',
						tc.toolCallId,
						'toolName:',
						tc.toolName
					);
					console.log(`  [${i}] input:`, JSON.stringify(tc.input));
				}

				// Return tool calls in the content array format that extractToolCalls expects
				const contentBlocks: Array<{ type: string; [key: string]: any }> = [];
				if (result.text) {
					contentBlocks.push({ type: 'text', text: result.text });
				}
				for (const tc of result.toolCalls) {
					contentBlocks.push({
						type: 'tool-call' as const,
						toolCallId: tc.toolCallId,
						toolName: tc.toolName,
						input: tc.input
					});
				}
				messageContent = contentBlocks;

				// DEBUG: Log the constructed messageContent
				console.log('[MolosLLMProviderClient] Constructed messageContent:');
				console.log('  Is array?:', Array.isArray(messageContent));
				console.log('  Length:', Array.isArray(messageContent) ? messageContent.length : 'N/A');
				if (Array.isArray(messageContent)) {
					for (let i = 0; i < messageContent.length; i++) {
						console.log(`  [${i}]:`, JSON.stringify(messageContent[i]));
					}
				}
			}

			// Convert result back to LlmResponse format
			return {
				model: this.settings.modelName,
				message: {
					role: 'assistant',
					content: messageContent
				},
				usage: {
					inputTokens: result.usage?.inputTokens ?? 0,
					outputTokens: result.usage?.outputTokens ?? 0,
					totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0)
				},
				finishReason: result.toolCalls?.length ? 'tool_calls' : 'stop'
			};
		} catch (error) {
			console.error('[MolosLLMProviderClient] chat error:', error);
			throw error;
		}
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert app tool definition to @molos/agent tool definition
 */
function convertToolToAgentFormat(tool: AppToolDefinition): ToolDefinition {
	return {
		name: tool.name,
		description: tool.description,
		parameters: {
			type: 'object',
			properties: (tool.parameters?.properties as Record<string, ToolParameterSchema>) || {},
			required: tool.parameters?.required || []
		}
	};
}

/**
 * Create a basic AgentLoopConfig with required fields
 */
function createBasicAgentLoopConfig(
	userId: string,
	sessionId: string,
	modelName: string,
	providerType: string
): Omit<AgentLoopConfig, 'provider' | 'tools' | 'workspace' | 'maxIterations' | 'hookManager'> {
	return {
		id: `agent-${userId}-${sessionId}`,
		model: modelName,
		primaryProvider: providerType,
		providers: [],
		cooldown: {
			enabled: false,
			defaultDurationMs: 60000,
			maxRetries: 3
		},
		temperature: 1.0,
		maxTurns: 10,
		maxToolCallsPerTurn: 100,
		toolTimeout: 30000,
		parallelToolCalls: true,
		thinkingLevel: 'medium'
	};
}

// ============================================================================
// Agent Adapter
// ============================================================================

/**
 * MolosAgentAdapter - Uses @molos/agent directly for agent orchestration
 *
 * This adapter provides:
 * - AgentLoop for turn management and tool execution
 * - LLMProviderClient for AI SDK integration
 * - HookManager for lifecycle monitoring and progress callbacks
 * - Streaming support via runStream()
 * - Tool execution via AiToolbox
 */
export class MolosAgentAdapter {
	private userId: string;
	private aiRepo: AiRepository;
	private toolbox: AiToolbox;
	private moduleAgents: ModuleAgentConfig[];
	private hookManager: HookManager;
	private settings: AiSettings | null = null;
	private progressCallback?: (event: ProgressEvent) => void | Promise<void>;

	constructor(userId: string, options: { moduleAgents?: ModuleAgentConfig[] } = {}) {
		this.userId = userId;
		this.aiRepo = new AiRepository();
		this.toolbox = new AiToolbox();
		this.moduleAgents = options.moduleAgents || [];
		this.hookManager = createHookManager({});
	}

	/**
	 * Set progress callback for UI updates
	 */
	setProgressCallback(callback: (event: ProgressEvent) => void | Promise<void>): void {
		this.progressCallback = callback;
	}

	/**
	 * Emit a progress event if callback is set
	 */
	private emitProgress(event: ProgressEvent): void {
		if (this.progressCallback) {
			this.progressCallback(event);
		}
	}

	/**
	 * Process a user message using @molos/agent
	 */
	async processMessage(
		content: string,
		sessionId: string,
		activeModuleIds: string[] = [],
		attachments?: unknown[],
		parts?: unknown[],
		options: {
			streamEnabled?: boolean;
			maxSteps?: number;
			maxDurationMs?: number;
			onProgress?: (event: ProgressEvent) => void | Promise<void>;
			autonomousMode?: boolean;
			mentionedModuleIds?: string[];
		} = {}
	): Promise<AiChatResponse> {
		// Set progress callback if provided
		if (options.onProgress) {
			this.setProgressCallback(options.onProgress);
		}

		// Save user message
		await this.aiRepo.addMessage(this.userId, {
			role: 'user',
			content,
			sessionId,
			attachments: attachments as Array<{ name: string }> | undefined,
			parts
		});

		// Get settings
		this.settings = await this.aiRepo.getSettings(this.userId);

		if (!this.settings || !this.settings.apiKey) {
			return {
				message: 'I need an API key to function. Please configure your AI settings.'
			};
		}

		// Create LLM provider client
		const llmProvider = new MolosLLMProviderClient(this.settings);

		// Get history for context
		const history = await this.aiRepo.getMessages(sessionId, this.userId);

		// Convert history to AgentMessage format
		const agentHistory: AgentMessage[] = history.map((m) => {
			let parsedContent: string | Array<any> = m.content;

			// If it's an assistant message, try to parse JSON array content (like tool calls)
			if (m.role === 'assistant' && typeof m.content === 'string' && m.content.startsWith('[')) {
				try {
					parsedContent = JSON.parse(m.content);
				} catch {
					// Fall back to string if not valid JSON
				}
			}

			return {
				role: m.role as 'user' | 'assistant' | 'system' | 'tool',
				content: parsedContent,
				toolCallId: m.toolCallId,
				name: m.toolCalls?.[0]?.name as string | undefined
			};
		});

		// Get tools from toolbox
		const mentionedModuleIds = options.mentionedModuleIds || [];
		const tools = await this.toolbox.getTools(this.userId, activeModuleIds, mentionedModuleIds);

		// Get dynamic system prompt
		let dynamicSystemPrompt = await this.toolbox.getDynamicSystemPrompt(
			this.userId,
			activeModuleIds
		);

		// Add priority module context if modules were mentioned
		if (mentionedModuleIds.length > 0) {
			const priorityPrompt = this.toolbox.getPriorityModulesPrompt(mentionedModuleIds);
			dynamicSystemPrompt = `${priorityPrompt}\n\n${dynamicSystemPrompt}`;
		}

		// Append available tools to the system prompt
		const toolsList = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
		const systemPromptWithTools = `${dynamicSystemPrompt}

# AVAILABLE TOOLS
You have access to the following tools. Use them to accomplish tasks:
${toolsList}

Remember: When a task requires using tools, CALL THE TOOL IMMEDIATELY. Do not just describe what you would do.`;

		// Get runtime config
		const runtime = getAgentRuntimeConfig(this.settings);
		const maxSteps = options.maxSteps ?? runtime.maxSteps ?? 20;

		// Convert tools to @molos/agent format
		const toolDefs: ToolDefinition[] = tools.map(convertToolToAgentFormat);

		// Create tool map for execution
		const toolMap = new Map(tools.map((t) => [t.name, t]));

		// Get provider type
		const providerType = mapProvider(this.settings.provider);

		// Create base config
		const baseConfig = createBasicAgentLoopConfig(
			this.userId,
			sessionId,
			this.settings.modelName,
			providerType
		);

		// Create AgentLoop config
		// Note: AgentLoopConfigSchema expects provider as string enum, but createAgentLoop
		// actually requires LLMProviderClient. We pass the config without provider first,
		// then set the provider directly on the instance to bypass Zod validation.
		const agentConfig = {
			...baseConfig,
			tools: toolDefs,
			workspace: process.cwd(),
			maxIterations: maxSteps,
			maxToolCallsPerTurn: 100,
			temperature: this.settings.temperature ?? 1.0,
			maxTokens: this.settings.maxTokens ?? 4096,
			hookManager: this.hookManager
		};

		// Create loop with partial config, then set provider directly
		// This avoids Zod validation failing on provider being an object instead of string
		const loop = createAgentLoop(
			agentConfig as unknown as AgentLoopConfig & { provider: LLMProviderClient }
		);

		// Set provider directly on loop instance (bypasses schema validation since
		// provider is set after construction, not through the validated config)
		(loop as unknown as { provider: LLMProviderClient }).provider = llmProvider;

		// Set tool executor
		loop.setToolExecutor(async (tool, args) => {
			const startTime = Date.now();

			// Emit tool_start event
			this.emitProgress({
				type: 'tool_start',
				timestamp: Date.now(),
				data: { toolName: tool.name, arguments: args }
			});

			try {
				const appTool = toolMap.get(tool.name);
				if (!appTool) {
					const result: ToolResult = {
						toolName: tool.name,
						arguments: args,
						success: false,
						error: `Tool not found: ${tool.name}`,
						executionMs: Date.now() - startTime
					};
					this.emitProgress({
						type: 'tool_complete',
						timestamp: Date.now(),
						data: { toolName: tool.name, success: false, error: result.error }
					});
					return result;
				}

				// Execute the tool
				const output = await appTool.execute(args);

				const result: ToolResult = {
					toolName: tool.name,
					arguments: args,
					success: true,
					output: typeof output === 'string' ? output : JSON.stringify(output),
					executionMs: Date.now() - startTime
				};

				// Emit tool_complete event
				this.emitProgress({
					type: 'tool_complete',
					timestamp: Date.now(),
					data: { toolName: tool.name, success: true, output: result.output }
				});

				return result;
			} catch (error) {
				const result: ToolResult = {
					toolName: tool.name,
					arguments: args,
					success: false,
					error: error instanceof Error ? error.message : String(error),
					executionMs: Date.now() - startTime
				};

				// Emit tool_complete event with error
				this.emitProgress({
					type: 'tool_complete',
					timestamp: Date.now(),
					data: { toolName: tool.name, success: false, error: result.error }
				});

				return result;
			}
		});

		// Run the agent loop
		const runId = `run_${Date.now()}`;
		const startTime = Date.now();

		this.emitProgress({
			type: 'step_start',
			timestamp: startTime,
			data: { stepNumber: 1, totalSteps: maxSteps, description: 'Starting agent' }
		});

		let result: AgentRunResult;
		try {
			result = await loop.run(agentHistory, content);
		} catch (error) {
			console.error('[MolosAgentAdapter] Agent loop error:', error);
			return {
				message: error instanceof Error ? error.message : 'An error occurred during agent execution'
			};
		}

		const endTime = Date.now();

		// Emit completion event
		this.emitProgress({
			type: 'complete',
			timestamp: endTime,
			data: {
				finalOutput: result.finalOutput,
				iterations: result.iterations
			}
		});

		// Build telemetry
		const telemetry: AiAgentTelemetry = {
			runId,
			startMs: startTime,
			durationMs: endTime - startTime,
			llmCalls: result.turns?.length ?? 0,
			toolCalls: result.turns?.reduce((sum, turn) => sum + (turn.toolResults?.length ?? 0), 0) ?? 0,
			retries: 0,
			errors: result.error ? 1 : 0,
			tokenEstimateIn: result.usage?.inputTokens ?? 0,
			tokenEstimateOut: result.usage?.outputTokens ?? 0
		};

		// Extract actions from tool results
		const actions =
			result.turns?.flatMap((turn) =>
				(turn.toolResults ?? []).map((tr) => ({
					type: 'read' as const,
					entity: tr.toolName,
					description: `Tool call: ${tr.toolName}`,
					status: tr.success ? ('executed' as const) : ('failed' as const),
					data: { result: tr.output, error: tr.error }
				}))
			) ?? [];

		// Save assistant message
		await this.aiRepo.addMessage(this.userId, {
			role: 'assistant',
			content: result.finalOutput,
			sessionId
		});

		return {
			message: result.finalOutput,
			actions,
			telemetry
		};
	}

	/**
	 * Stream response using @molos/agent streaming
	 */
	async *streamResponse(
		messages: AgentMessage[],
		input: string,
		sessionId: string,
		onProgress?: (event: any) => void,
		attachments?: { name: string }[],
		parts?: unknown[]
	): AsyncGenerator<StreamChunk> {
		console.log('[MolosAgentAdapter] streamResponse called, input:', input);

		// Initialize settings if not already done
		if (!this.settings) {
			this.settings = await this.aiRepo.getSettings(this.userId);
		}

		if (!this.settings || !this.settings.apiKey) {
			console.error('[MolosAgentAdapter] No API key configured');
			yield { type: 'error', error: 'No API key configured' };
			return;
		}

		// Save user message before streaming
		try {
			await this.aiRepo.addMessage(this.userId, {
				role: 'user',
				content: input,
				sessionId,
				attachments,
				parts
			});
			console.log('[MolosAgentAdapter] User message saved to database');
		} catch (error) {
			console.error('[MolosAgentAdapter] Failed to save user message:', error);
			// Continue with streaming even if message save fails
		}

		// Track tool results during streaming
		const toolResults: Array<{ toolName: string; toolCallId: string; result: string }> = [];
		const toolCallIdToName: Map<string, string> = new Map();

		// Track accumulated text for assistant message
		let accumulatedText = '';

		// Create LLM provider client
		const llmProvider = new MolosLLMProviderClient(this.settings);

		// Get tools
		console.log('[MolosAgentAdapter] Loading tools...');
		const tools = await this.toolbox.getTools(this.userId);
		console.log('[MolosAgentAdapter] Loaded', tools.length, 'tools');
		const toolDefs: ToolDefinition[] = tools.map(convertToolToAgentFormat);

		// Get provider type
		const providerType = mapProvider(this.settings.provider);

		// Create base config
		const baseConfig = createBasicAgentLoopConfig(
			this.userId,
			'stream',
			this.settings.modelName,
			providerType
		);

		// Create AgentLoop config
		// Note: AgentLoopConfigSchema expects provider as string enum, but createAgentLoop
		// actually requires LLMProviderClient. We pass the config without provider first,
		// then set the provider directly on the instance to bypass Zod validation.
		const agentConfig = {
			...baseConfig,
			tools: toolDefs,
			workspace: process.cwd(),
			maxIterations: 20,
			maxToolCallsPerTurn: 100,
			temperature: this.settings.temperature ?? 1.0,
			maxTokens: this.settings.maxTokens ?? 4096
		};

		// Create loop with partial config, then set provider directly
		// This avoids Zod validation failing on provider being an object instead of string
		const loop = createAgentLoop(
			agentConfig as unknown as AgentLoopConfig & { provider: LLMProviderClient }
		);

		// Set provider directly on loop instance
		(loop as unknown as { provider: LLMProviderClient }).provider = llmProvider;

		// Set tool executor
		loop.setToolExecutor(async (tool, args) => {
			const startTime = Date.now();
			onProgress?.({ type: 'tool_start', toolName: tool.name, arguments: args });

			try {
				const result = await this.toolbox.getTools(this.userId).then((tools) => {
					const appTool = tools.find((t) => t.name === tool.name);
					if (!appTool) {
						throw new Error(`Tool not found: ${tool.name}`);
					}
					return appTool.execute(args);
				});

				const toolResult: ToolResult = {
					toolName: tool.name,
					arguments: args,
					success: true,
					output: typeof result === 'string' ? result : JSON.stringify(result),
					executionMs: Date.now() - startTime
				};

				onProgress?.({
					type: 'tool_complete',
					toolName: tool.name,
					success: true,
					output: toolResult.output
				});

				return toolResult;
			} catch (error) {
				const toolResult: ToolResult = {
					toolName: tool.name,
					arguments: args,
					success: false,
					error: error instanceof Error ? error.message : String(error),
					executionMs: Date.now() - startTime
				};

				onProgress?.({
					type: 'tool_complete',
					toolName: tool.name,
					success: false,
					error: toolResult.error
				});

				return toolResult;
			}
		});

		// Use runStream() for actual streaming
		console.log('[MolosAgentAdapter] Starting runStream with', messages.length, 'messages');
		const { stream } = loop.runStream(messages, input);
		console.log('[MolosAgentAdapter] Stream started, waiting for chunks...');

		// Yield chunks as they come in
		try {
			for await (const chunk of stream) {
				console.log('[MolosAgentAdapter] Got chunk:', chunk.type, chunk);

				// Track tool call name mapping from tool-call-start
				if (chunk.type === 'tool-call-start') {
					toolCallIdToName.set(chunk.toolCallId, chunk.toolName);
				}

				// Track tool results from tool-call-end
				if (chunk.type === 'tool-call-end') {
					const toolName = toolCallIdToName.get(chunk.toolCallId) || 'unknown';
					toolResults.push({
						toolName,
						toolCallId: chunk.toolCallId,
						result: chunk.result || ''
					});
				}

				// Track text deltas for accumulated text
				if (chunk.type === 'text-delta') {
					accumulatedText += chunk.delta;
				}

				yield chunk;
			}
			console.log('[MolosAgentAdapter] Stream completed');

			// Save tool results after streaming completes
			for (const tr of toolResults) {
				try {
					await this.aiRepo.addMessage(this.userId, {
						role: 'tool',
						content: tr.result,
						sessionId,
						toolCallId: tr.toolCallId,
						toolCalls: [{ name: tr.toolName, toolCallId: tr.toolCallId }]
					});
					console.log('[MolosAgentAdapter] Tool result saved:', tr.toolName);
				} catch (error) {
					console.error('[MolosAgentAdapter] Failed to save tool result:', error);
				}
			}

			// Save assistant message after streaming completes
			if (accumulatedText) {
				try {
					await this.aiRepo.addMessage(this.userId, {
						role: 'assistant',
						content: accumulatedText,
						sessionId
					});
					console.log(
						'[MolosAgentAdapter] Assistant message saved, length:',
						accumulatedText.length
					);
				} catch (error) {
					console.error('[MolosAgentAdapter] Failed to save assistant message:', error);
				}
			}
		} catch (error) {
			console.error('[MolosAgentAdapter] Stream error:', error);
			yield { type: 'error', error: String(error) };
		}
	}

	/**
	 * Process an action confirmation (user approved a write action)
	 */
	async processActionConfirmation(
		action: { type: string; entity: string; description: string; data?: unknown },
		sessionId: string,
		activeModuleIds: string[] = []
	): Promise<AiChatResponse> {
		const data = action.data as {
			toolName: string;
			parameters: unknown;
			toolCallId?: string;
		};

		const tools = await this.toolbox.getTools(this.userId, activeModuleIds);
		const tool = tools.find((t) => t.name === data?.toolName);

		let result: unknown;
		if (tool && tool.execute) {
			result = await tool.execute(data?.parameters);
		}

		await this.aiRepo.addMessage(this.userId, {
			role: 'tool',
			content: JSON.stringify(result),
			sessionId,
			toolCallId: data?.toolCallId || 'manual-confirmation'
		});

		return {
			message: 'The action was confirmed and executed successfully.',
			actions: [
				{
					type: action.type === 'read' || action.type === 'write' ? action.type : 'read',
					entity: action.entity,
					description: `Executed: ${action.description}`,
					status: 'executed',
					data: { toolName: data?.toolName, result }
				}
			]
		};
	}
}

/**
 * Create a MolosAgentAdapter instance
 */
export function createMolosAgentAdapter(
	userId: string,
	options?: { moduleAgents?: ModuleAgentConfig[] }
): MolosAgentAdapter {
	return new MolosAgentAdapter(userId, options);
}
