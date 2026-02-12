/**
 * Agent V2 Adapter
 *
 * Provides backward compatibility between the v2 agent architecture
 * and the existing API surface expected by the frontend.
 *
 * This adapter:
 * 1. Uses AiRepository for session/message persistence (as expected by frontend)
 * 2. Uses v2 Agent for execution
 * 3. Maps between v1 types (AiSettings, AiChatResponse) and v2 types (AgentConfig, ExecutionResult)
 */

import type {
	AiSettings,
	AiAction,
	AiChatResponse,
	AiAgentTelemetry,
	AiAgentEvent
} from '$lib/models/ai';
import type {
	AgentConfig,
	ExecutionResult,
	ProgressEvent,
	ToolDefinition,
	LlmProvider
} from './agent/v2';
import { Agent, createAgent } from './agent/v2';
import { AiRepository } from '$lib/repositories/ai/ai-repository';
import { AiToolbox } from '$lib/server/ai/toolbox';
import { getAgentRuntimeConfig } from './runtime-config';

/**
 * Map AiSettings provider string to v2 LlmProvider type
 */
function mapProvider(provider: string): LlmProvider {
	const providerMap: Record<string, LlmProvider> = {
		openai: 'openai',
		anthropic: 'anthropic',
		ollama: 'ollama',
		openrouter: 'openrouter',
		zai: 'zai'
	};
	return providerMap[provider] || 'openai';
}

/**
 * Convert AiSettings to AgentConfig
 */
function settingsToConfig(settings: AiSettings): AgentConfig {
	const runtime = getAgentRuntimeConfig(settings);

	return {
		provider: mapProvider(settings.provider),
		modelName: settings.modelName,
		apiKey: settings.apiKey,
		baseUrl: settings.baseUrl,
		maxTokens: settings.maxTokens,
		// Temperature and topP are 0-100 in AiSettings, but 0-1 in AgentConfig
		temperature: settings.temperature,
		topP: settings.topP,
		// Runtime config
		maxSteps: runtime.maxSteps,
		maxDurationMs: runtime.maxDurationMs,
		// Default thinking level
		thinkingLevel: 'low',
		// Cache settings from runtime
		toolCacheSize: runtime.toolCacheSize,
		toolCacheTtlMs: runtime.toolCacheTtlMs,
		// Retry settings from runtime
		retryMax: runtime.retryMax,
		retryBaseMs: runtime.retryBaseMs,
		retryMaxDelayMs: runtime.retryMaxDelayMs,
		llmTimeoutMs: runtime.llmTimeoutMs,
		// Feature flags
		streamEnabled: settings.streamEnabled ?? true,
		telemetryEnabled: runtime.telemetryEnabled
	};
}

/**
 * Map ExecutionResult actions to AiAction[]
 */
function mapActions(result: ExecutionResult): AiAction[] {
	return result.actions.map((action) => ({
		type: action.type === 'error' ? 'read' : action.type === 'plan' || action.type === 'think' ? 'read' : action.type,
		entity: action.entity,
		description: action.description,
		status: action.status,
		data: action.data
	}));
}

/**
 * Map ExecutionResult telemetry to AiAgentTelemetry
 */
function mapTelemetry(result: ExecutionResult): AiAgentTelemetry {
	return {
		runId: result.telemetry.runId,
		startMs: result.telemetry.startMs,
		durationMs: result.telemetry.durationMs,
		llmCalls: result.telemetry.llmCalls,
		toolCalls: result.telemetry.totalSteps,
		retries: 0,
		errors: result.telemetry.errors,
		tokenEstimateIn: result.telemetry.tokenEstimateIn,
		tokenEstimateOut: result.telemetry.tokenEstimateOut
	};
}

/**
 * Map ExecutionResult events to AiAgentEvent[]
 */
function mapEvents(result: ExecutionResult): AiAgentEvent[] {
	return result.events.map((event) => ({
		type: event.type as AiAgentEvent['type'],
		timestamp: event.timestamp,
		detail: event.data
	}));
}

/**
 * Adapter that uses the v2 Agent with v1 persistence layer
 */
export class AiAgentV2Adapter {
	private userId: string;
	private aiRepo: AiRepository;
	private toolbox: AiToolbox;

	constructor(userId: string) {
		this.userId = userId;
		this.aiRepo = new AiRepository();
		this.toolbox = new AiToolbox();
	}

	/**
	 * Process a user message - main entry point
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
		} = {}
	): Promise<AiChatResponse> {
		// Save user message
		await this.aiRepo.addMessage(this.userId, {
			role: 'user',
			content,
			sessionId,
			attachments: attachments as Array<{ name: string }> | undefined,
			parts
		});

		// Get settings
		const settings = await this.aiRepo.getSettings(this.userId);

		if (!settings || !settings.apiKey) {
			return {
				message: 'I need an API key to function. Please configure your AI settings.'
			};
		}

		// Get history for context
		const history = await this.aiRepo.getMessages(sessionId, this.userId);

		// Convert history to v2 AgentMessage format
		const agentHistory = history.map((m) => ({
			role: m.role as 'user' | 'assistant' | 'system' | 'tool',
			content: m.content,
			toolCalls: m.toolCalls as any,
			toolCallId: m.toolCallId
		}));

		// Get tools from toolbox (they're already compatible with v2 ToolDefinition)
		const tools = await this.toolbox.getTools(this.userId, activeModuleIds);

		// Create agent config from settings
		const config = settingsToConfig(settings);

		// Override with options if provided
		if (options.maxSteps) config.maxSteps = options.maxSteps;
		if (options.maxDurationMs) config.maxDurationMs = options.maxDurationMs;

		// Create v2 Agent
		const agent = createAgent({
			userId: this.userId,
			config,
			tools: tools as ToolDefinition[]
		});

		// Initialize agent
		await agent.initialize();

		// Process message with v2 Agent
		// Note: Don't pass sessionId - v2 Agent has its own internal session manager.
		// We use AiRepository for database persistence separately.
		const result = await agent.processMessage(content, {
			history: agentHistory,
			maxSteps: options.maxSteps ?? config.maxSteps,
			maxDurationMs: options.maxDurationMs ?? config.maxDurationMs,
			onProgress: options.onProgress
		});

		// Save assistant message
		if (result.message && sessionId) {
			await this.aiRepo.addMessage(this.userId, {
				role: 'assistant',
				content: result.message,
				sessionId,
				contextMetadata: JSON.stringify({
					telemetry: result.telemetry,
					events: result.events
				})
			});
		}

		// Map result to AiChatResponse
		return {
			message: result.message,
			actions: mapActions(result),
			events: mapEvents(result),
			telemetry: mapTelemetry(result)
		};
	}

	/**
	 * Process an action confirmation (user approved a write action)
	 */
	async processActionConfirmation(
		action: AiAction,
		sessionId: string,
		activeModuleIds: string[] = []
	): Promise<AiChatResponse> {
		// Execute the action
		const result = await this.executeAction(action, activeModuleIds);

		// Save the tool result to history
		const data = action.data as { toolName: string; parameters: unknown; toolCallId?: string };
		await this.aiRepo.addMessage(this.userId, {
			role: 'tool',
			content: JSON.stringify(result),
			sessionId,
			toolCallId: data?.toolCallId || 'manual-confirmation'
		});

		// Build a simple response confirming the action
		return {
			message: 'The action was confirmed and executed successfully.',
			actions: [
				{
					type: action.type === 'read' || action.type === 'write' ? action.type : 'read',
					entity: action.entity,
					description: `Executed: ${action.description}`,
					status: 'executed',
					data: { toolName: (data as any)?.toolName, result }
				}
			]
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

		if (tool && tool.execute) {
			return await tool.execute(data.parameters);
		}

		return undefined;
	}
}

/**
 * Create a v2 adapter instance
 */
export function createAgentV2Adapter(userId: string): AiAgentV2Adapter {
	return new AiAgentV2Adapter(userId);
}
