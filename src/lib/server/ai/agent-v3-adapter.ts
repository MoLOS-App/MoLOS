/**
 * Agent V3 Adapter
 *
 * Provides compatibility between the new AI SDK-based v3 agent
 * and the existing API surface expected by the frontend.
 *
 * This adapter:
 * 1. Uses AiRepository for session/message persistence (as expected by frontend)
 * 2. Uses v3 MoLOSAgent for execution
 * 3. Maps between frontend types (AiSettings, AiChatResponse) and v3 types
 */

import type {
	AiSettings,
	AiAction,
	AiChatResponse,
	AiAgentTelemetry,
	AiAgentEvent,
} from '$lib/models/ai';
import type {
	AgentMessage,
	ExecutionResult,
	ProgressEvent,
	ToolDefinition,
} from './agent/v3/types';
import { MoLOSAgent, createMoLOSAgent, type MoLOSAgentInitConfig } from './agent/v3/core/molos-agent';
import { createProvider, mapProvider, getProviderOptions } from './agent/v3/providers';
import { AiRepository } from '$lib/repositories/ai/ai-repository';
import { AiToolbox } from '$lib/server/ai/toolbox';
import { getAgentRuntimeConfig } from './runtime-config';
import type { ModuleAgentConfig } from './agent/v3/types';

/**
 * Convert AiSettings to MoLOSAgentInitConfig
 */
function settingsToAgentConfig(
	settings: AiSettings,
	model: unknown
): MoLOSAgentInitConfig {
	const runtime = getAgentRuntimeConfig(settings);

	return {
		userId: '', // Set by adapter
		model,
		systemPrompt: '', // Set dynamically
		maxSteps: runtime.maxSteps ?? 20,
		maxDurationMs: runtime.maxDurationMs,
		thinkingLevel: 'low',
		streamEnabled: settings.streamEnabled ?? true,
		telemetryEnabled: runtime.telemetryEnabled,
	};
}

/**
 * Map ExecutionResult actions to AiAction[]
 */
function mapActions(result: ExecutionResult): AiAction[] {
	return result.actions.map((action) => ({
		type:
			action.type === 'error'
				? 'read'
				: action.type === 'plan' || action.type === 'think'
					? 'read'
					: action.type,
		entity: action.entity,
		description: action.description,
		status: action.status,
		data: action.data,
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
		tokenEstimateOut: result.telemetry.tokenEstimateOut,
	};
}

/**
 * Map ExecutionResult events to AiAgentEvent[]
 */
function mapEvents(result: ExecutionResult): AiAgentEvent[] {
	return result.events.map((event) => ({
		type: event.type as AiAgentEvent['type'],
		timestamp: event.timestamp,
		detail: event.data,
	}));
}

/**
 * Adapter that uses the v3 MoLOSAgent with v1 persistence layer
 */
export class AiAgentV3Adapter {
	private userId: string;
	private aiRepo: AiRepository;
	private toolbox: AiToolbox;
	private moduleAgents: ModuleAgentConfig[];

	constructor(
		userId: string,
		options: { moduleAgents?: ModuleAgentConfig[] } = {}
	) {
		this.userId = userId;
		this.aiRepo = new AiRepository();
		this.toolbox = new AiToolbox();
		this.moduleAgents = options.moduleAgents || [];
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
			parts,
		});

		// Get settings
		const settings = await this.aiRepo.getSettings(this.userId);

		if (!settings || !settings.apiKey) {
			return {
				message:
					'I need an API key to function. Please configure your AI settings.',
			};
		}

		// Create AI SDK provider
		const providerType = mapProvider(settings.provider);
		const model = createProvider({
			provider: providerType,
			modelName: settings.modelName,
			apiKey: settings.apiKey,
			baseUrl: settings.baseUrl,
		});

		// Get history for context
		const history = await this.aiRepo.getMessages(sessionId, this.userId);

		// Convert history to AgentMessage format
		const agentHistory: AgentMessage[] = history.map((m) => ({
			role: m.role as 'user' | 'assistant' | 'system' | 'tool',
			content: m.content,
			toolCalls: m.toolCalls as any,
			toolCallId: m.toolCallId,
		}));

		// Get tools from toolbox
		const tools = await this.toolbox.getTools(this.userId, activeModuleIds);

		// Get dynamic system prompt from toolbox
		const dynamicSystemPrompt = await this.toolbox.getDynamicSystemPrompt(
			this.userId,
			activeModuleIds
		);

		// Append available tools to the system prompt
		const toolsList = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
		const systemPromptWithTools = `${dynamicSystemPrompt}

# AVAILABLE TOOLS
You have access to the following tools. Use them to accomplish tasks:
${toolsList}

Remember: When a task requires using tools, CALL THE TOOL IMMEDIATELY. Do not just describe what you would do.`;

		// Create agent config
		const agentConfig = settingsToAgentConfig(settings, model);
		agentConfig.userId = this.userId;
		agentConfig.systemPrompt = systemPromptWithTools;
		agentConfig.moduleAgents = this.moduleAgents;

		// Override with options if provided
		if (options.maxSteps) agentConfig.maxSteps = options.maxSteps;
		if (options.maxDurationMs) agentConfig.maxDurationMs = options.maxDurationMs;
		if (options.streamEnabled !== undefined)
			agentConfig.streamEnabled = options.streamEnabled;

		// Create v3 Agent
		const agent = createMoLOSAgent(agentConfig);

		// Register tools
		agent.registerTools(tools as ToolDefinition[]);

		// Process message with v3 Agent
		const result = await agent.processMessage(content, agentHistory, {
			maxSteps: options.maxSteps ?? agentConfig.maxSteps,
			maxDurationMs: options.maxDurationMs ?? agentConfig.maxDurationMs,
			onProgress: options.onProgress,
			streamEnabled: options.streamEnabled ?? agentConfig.streamEnabled,
			systemPrompt: systemPromptWithTools,
		});

		// Save assistant message
		if (result.message && sessionId) {
			await this.aiRepo.addMessage(this.userId, {
				role: 'assistant',
				content: result.message,
				sessionId,
				contextMetadata: JSON.stringify({
					telemetry: result.telemetry,
					events: result.events,
				}),
			});
		}

		// Map result to AiChatResponse
		return {
			message: result.message,
			actions: mapActions(result),
			events: mapEvents(result),
			telemetry: mapTelemetry(result),
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
		const data = action.data as {
			toolName: string;
			parameters: unknown;
			toolCallId?: string;
		};
		await this.aiRepo.addMessage(this.userId, {
			role: 'tool',
			content: JSON.stringify(result),
			sessionId,
			toolCallId: data?.toolCallId || 'manual-confirmation',
		});

		// Build a simple response confirming the action
		return {
			message: 'The action was confirmed and executed successfully.',
			actions: [
				{
					type:
						action.type === 'read' || action.type === 'write'
							? action.type
							: 'read',
					entity: action.entity,
					description: `Executed: ${action.description}`,
					status: 'executed',
					data: { toolName: (data as any)?.toolName, result },
				},
			],
		};
	}

	/**
	 * Execute a single action
	 */
	async executeAction(
		action: AiAction,
		activeModuleIds: string[] = []
	): Promise<unknown> {
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
 * Create a v3 adapter instance
 */
export function createAgentV3Adapter(
	userId: string,
	options?: { moduleAgents?: ModuleAgentConfig[] }
): AiAgentV3Adapter {
	return new AiAgentV3Adapter(userId, options);
}
