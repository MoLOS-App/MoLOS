/**
 * Main Agent - Thin Orchestrator
 *
 * The main Agent class that orchestrates all components.
 * Designed to be thin, delegating to specialized modules.
 */

import type {
	AgentConfig,
	AgentMessage,
	AgentOptions,
	ExecutionResult,
	ProgressEvent,
	ToolDefinition,
	ThinkingLevel
} from './types';
import { AgentContext, createContext, Services } from './context';
import { createAgentConfig, getRuntimeConfig } from './config';
import { EventBus, getGlobalEventBus } from '../events/event-bus';
import { createHookManager, type HookManager } from '../hooks/hook-manager';
import { createRuleEngine, type RuleEngine } from '../hooks/rule-engine';
import { createToolRegistry, createToolExecutor, type ToolExecutor, type ToolRegistry } from '../tools';
import { createResponseCache, type ResponseCache } from '../llm/response-cache';
import { createTokenTracker, type TokenTracker } from '../llm/token-tracker';
import { createCircuitBreaker } from '../llm/circuit-breaker';
import { createFallbackManager, type FallbackManager } from '../llm/fallback-manager';
import { createSessionManager, type SessionManager } from '../session/session-manager';
import { createContextCompactor, type ContextCompactor } from '../session/context-compactor';
import { UnifiedReActLoop, type ReActLoopResult } from '../execution/react-loop';
import { createThinkingEngine, type ThinkingEngine } from '../execution/thinking-engine';
import { createBlockStreamer, type BlockStreamer } from '../streaming/block-streamer';
import { createChannelManager, type ChannelManager } from '../streaming/channel-manager';
import { createErrorRecovery, type ErrorRecovery } from '../errors/error-recovery';
import { AgentError, ErrorCode, formatErrorForUser } from '../errors/error-types';
import { AnthropicProvider, OpenAICompatibleProvider, type ILlmProvider } from '../llm/providers';
import { PluginLoader, createPluginLoader, type IPlugin } from '../plugins';

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Agent initialization options
 */
export interface AgentInitOptions {
	/** User ID */
	userId: string;
	/** Agent configuration */
	config: AgentConfig;
	/** Available tools */
	tools?: ToolDefinition[];
	/** Plugins to load */
	plugins?: IPlugin[];
}

/**
 * Agent execution options
 */
export interface AgentExecutionOptions extends AgentOptions {
	/** Session ID (creates new if not provided) */
	sessionId?: string;
	/** Conversation history */
	history?: AgentMessage[];
	/** Active module IDs */
	activeModuleIds?: string[];
}

// ============================================================================
// Agent Class
// ============================================================================

/**
 * Agent - Main orchestrator for AI agent execution
 */
export class Agent {
	private userId: string;
	private config: AgentConfig;
	private eventBus: EventBus;
	private context: AgentContext | null = null;

	// Core services
	private hookManager: HookManager;
	private ruleEngine: RuleEngine;
	private toolRegistry: ToolRegistry;
	private toolExecutor: ToolExecutor;
	private sessionManager: SessionManager;
	private contextCompactor: ContextCompactor;
	private thinkingEngine: ThinkingEngine;
	private blockStreamer: BlockStreamer;
	private channelManager: ChannelManager;
	private errorRecovery: ErrorRecovery;
	private pluginLoader: PluginLoader;

	// LLM services
	private llmProvider: ILlmProvider | null = null;
	private fallbackManager: FallbackManager;
	private responseCache: ResponseCache;
	private tokenTracker: TokenTracker;

	// State
	private initialized: boolean = false;

	constructor(options: AgentInitOptions) {
		this.userId = options.userId;
		this.config = options.config;
		this.eventBus = getGlobalEventBus();

		// Initialize services
		this.hookManager = createHookManager({ debug: false });
		this.ruleEngine = createRuleEngine();
		this.toolRegistry = createToolRegistry();
		this.sessionManager = createSessionManager({}, this.eventBus);
		this.contextCompactor = createContextCompactor();
		this.thinkingEngine = createThinkingEngine(this.config.thinkingLevel);
		this.blockStreamer = createBlockStreamer();
		this.channelManager = createChannelManager();
		this.errorRecovery = createErrorRecovery();
		this.pluginLoader = createPluginLoader();

		this.fallbackManager = createFallbackManager();
		this.responseCache = createResponseCache();
		this.tokenTracker = createTokenTracker();

		// Create tool executor with dependencies
		this.toolExecutor = createToolExecutor({
			registry: this.toolRegistry,
			cache: createToolExecutor().getCache() instanceof Function
				? createToolExecutor().getCache()
				: undefined,
			hookManager: this.hookManager,
			eventBus: this.eventBus
		});

		// Register provided tools
		if (options.tools) {
			for (const tool of options.tools) {
				this.toolRegistry.register(tool);
			}
		}

		// Register plugins
		if (options.plugins) {
			for (const plugin of options.plugins) {
				this.pluginLoader.register(plugin);
			}
		}
	}

	/**
	 * Initialize the agent
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		// Create LLM provider
		this.llmProvider = this.createProvider();

		// Create execution context
		this.context = this.createContext();

		// Initialize plugins
		if (this.context) {
			await this.pluginLoader.initializeAll(this.context);
		}

		this.initialized = true;
	}

	/**
	 * Process a user message
	 */
	async processMessage(
		content: string,
		options: AgentExecutionOptions = {}
	): Promise<ExecutionResult> {
		await this.initialize();

		const startTime = Date.now();
		const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		const sessionId = options.sessionId || `session_${Date.now()}`;

		try {
			// Create or restore session
			const session = options.sessionId
				? this.sessionManager.get(options.sessionId)
				: this.sessionManager.create({
						userId: this.userId,
						initialMessages: options.history
					});

			if (!session) {
				throw new AgentError('Session not found', ErrorCode.SESSION_NOT_FOUND);
			}

			// Add user message
			this.sessionManager.addMessage(session.state.sessionId, {
				role: 'user',
				content
			});

			// Update context
			if (this.context) {
				this.context.setState({
					runId,
					sessionId: session.state.sessionId,
					messages: session.messages
				});
			}

			// Build system prompt
			const systemPrompt = this.buildSystemPrompt();

			// Create and run ReAct loop
			const reactLoop = new UnifiedReActLoop(
				this.context!,
				this.llmProvider!,
				this.toolExecutor,
				this.toolRegistry.getAll(),
				systemPrompt,
				{
					maxIterations: options.maxSteps ?? getRuntimeConfig(this.config).maxSteps,
					maxDurationMs: options.maxDurationMs ?? getRuntimeConfig(this.config).maxDurationMs,
					thinkingLevel: options.thinkingLevel ?? this.config.thinkingLevel ?? 'low',
					requireToolUse: false,
					allowSelfCorrection: true,
					verboseReasoning: false,
					enableCompletionVerification: true,
					debug: false
				}
			);

			// Set up progress streaming
			if (options.onProgress) {
				this.blockStreamer.subscribe((block) => {
					const event: ProgressEvent = {
						type: this.mapBlockTypeToEventType(block.type),
						timestamp: block.timestamp,
						data: { content: block.content, ...block.metadata }
					};
					options.onProgress!(event);
				});
			}

			// Execute
			const result = await reactLoop.run(content, session.messages);

			// Save assistant message
			this.sessionManager.addMessage(session.state.sessionId, {
				role: 'assistant',
				content: result.finalMessage
			});

			// Build execution result
			const telemetry = this.context?.getTelemetry() || {
				runId,
				startMs: startTime,
				durationMs: Date.now() - startTime,
				totalSteps: result.observations.length,
				successfulSteps: result.observations.filter(o => o.isSuccess).length,
				failedSteps: result.observations.filter(o => !o.isSuccess).length,
				tokenEstimateIn: 0,
				tokenEstimateOut: 0,
				llmCalls: 0,
				cacheHits: 0,
				cacheMisses: 0,
				errors: 0
			};

			return {
				success: result.success,
				message: result.finalMessage,
				actions: result.observations.map(o => ({
					type: o.isSuccess ? 'read' : 'error',
					entity: o.toolName || 'unknown',
					description: o.toolName || 'Action',
					status: o.isSuccess ? 'executed' : 'failed',
					data: { result: o.result, error: o.error }
				})),
				plan: null,
				telemetry: {
					...telemetry,
					durationMs: Date.now() - startTime
				},
				events: []
			};
		} catch (error) {
			const message = formatErrorForUser(error);

			return {
				success: false,
				message,
				actions: [],
				plan: null,
				telemetry: {
					runId,
					startMs: startTime,
					durationMs: Date.now() - startTime,
					totalSteps: 0,
					successfulSteps: 0,
					failedSteps: 0,
					tokenEstimateIn: 0,
					tokenEstimateOut: 0,
					llmCalls: 0,
					cacheHits: 0,
					cacheMisses: 0,
					errors: 1
				},
				events: []
			};
		}
	}

	/**
	 * Register a tool
	 */
	registerTool(tool: ToolDefinition): void {
		this.toolRegistry.register(tool);
	}

	/**
	 * Register a plugin
	 */
	registerPlugin(plugin: IPlugin): void {
		this.pluginLoader.register(plugin);
	}

	/**
	 * Dispose of resources
	 */
	async dispose(): Promise<void> {
		await this.pluginLoader.disposeAll();
		this.sessionManager.dispose();
		this.initialized = false;
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private createProvider(): ILlmProvider {
		const { provider, modelName, apiKey, baseUrl, maxTokens, temperature, topP } = this.config;

		switch (provider) {
			case 'anthropic':
				return new AnthropicProvider({
					model: modelName,
					apiKey,
					baseUrl,
					maxTokens,
					temperature: temperature ? temperature / 100 : undefined,
					topP: topP ? topP / 100 : undefined
				});

			case 'openai':
			case 'openrouter':
			case 'ollama':
			case 'zai':
				return new OpenAICompatibleProvider(
					{
						model: modelName,
						apiKey,
						baseUrl,
						maxTokens,
						temperature: temperature ? temperature / 100 : undefined,
						topP: topP ? topP / 100 : undefined
					},
					provider
				);

			default:
				throw new AgentError(`Unsupported provider: ${provider}`, ErrorCode.CONFIG_INVALID);
		}
	}

	private createContext(): AgentContext {
		const runId = `run_${Date.now()}`;
		const sessionId = `session_${Date.now()}`;

		return createContext()
			.withRunId(runId)
			.withSessionId(sessionId)
			.withUserId(this.userId)
			.withConfig(this.config)
			.withEventBus(this.eventBus)
			.withTools(this.toolRegistry.getAll())
			.build();
	}

	private buildSystemPrompt(): string {
		const tools = this.toolRegistry.getAll();
		const toolsList = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');

		return `You are a helpful AI assistant with access to tools.

Available Tools:
${toolsList}

Guidelines:
- Use tools when needed to accomplish tasks
- Be helpful and concise
- Always explain what you're doing
- When done, provide a clear summary`;
	}

	private mapBlockTypeToEventType(type: string): ProgressEvent['type'] {
		switch (type) {
			case 'thinking':
				return 'thinking';
			case 'tool_use':
				return 'step_start';
			case 'tool_result':
				return 'step_complete';
			case 'error':
				return 'error';
			case 'complete':
				return 'complete';
			default:
				return 'thought';
		}
	}
}

/**
 * Create an agent
 */
export function createAgent(options: AgentInitOptions): Agent {
	return new Agent(options);
}
