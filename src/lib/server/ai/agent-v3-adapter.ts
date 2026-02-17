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

// ============================================================================
// Header Size Calculation Utilities
// ============================================================================

/**
 * Calculate estimated HTTP header size for a request
 * This is a rough estimate since AI SDK constructs final headers
 */
function estimateHeaderSize(
	provider: string,
	modelName: string,
	apiKeyLength: number
): number {
	// Base headers: Content-Type, Host, etc.
	let size = 500;

	// User-Agent headers get concatenated by AI SDK
	size += 200; // AI SDK user-agent

	// Provider-specific user-agent
	size += 100;

	// Authorization header
	size += 20 + apiKeyLength; // "Authorization: Bearer " + apiKey

	// Model-specific headers
	size += modelName.length + 50;

	return size;
}

/**
 * Calculate estimated total request size (headers + body)
 * Note: Tool schemas get encoded in headers for some providers!
 */
function estimateRequestSize(
	provider: string,
	modelName: string,
	apiKeyLength: number,
	tools: ToolDefinition[],
	messages: AgentMessage[],
	systemPrompt: string
): {
	headers: number;
	body: number;
	total: number;
	overLimit: boolean;
} {
	const headerSize = estimateHeaderSize(provider, modelName, apiKeyLength);

	// For some providers (like Z.ai), tool schemas are encoded in HEADERS, not body!
	// This is the critical insight for the 431 error
	const toolsJsonSize = JSON.stringify(tools).length;
	const estimatedToolHeaderSize = toolsJsonSize * 2; // Rough estimate for URL encoding

	const messagesSize = JSON.stringify(messages).length;
	const systemPromptSize = systemPrompt.length;

	const totalHeaderSize = headerSize + estimatedToolHeaderSize;
	const bodySize = messagesSize + systemPromptSize;
	const total = totalHeaderSize + bodySize;

	return {
		headers: totalHeaderSize,
		body: bodySize,
		total,
		overLimit: total > 8192, // 8KB HTTP header limit
	};
}

/**
 * Filter tools to only essential ones for fallback
 */
function getEssentialTools(allTools: ToolDefinition[]): ToolDefinition[] {
	const essentialToolNames = new Set([
		'get_active_modules',
		'get_user_profile',
		'get_current_time',
	]);

	return allTools.filter(t => essentialToolNames.has(t.name));
}

// ============================================================================

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

		// =====================================================================
		// DEBUG: Comprehensive logging for 431 error investigation
		// =====================================================================
		console.log('\n[AI Agent Debug] === REQUEST INFO ===');
		console.log('[AI Agent Debug] Provider:', settings.provider);
		console.log('[AI Agent Debug] Model:', settings.modelName);
		console.log('[AI Agent Debug] Base URL:', settings.baseUrl || 'default');
		console.log('[AI Agent Debug] Messages count:', agentHistory.length);
		console.log('[AI Agent Debug] Tools count:', tools.length);
		console.log('[AI Agent Debug] System prompt length:', systemPromptWithTools.length);

		// Calculate exact sizes
		const toolsJson = JSON.stringify(tools);
		console.log('[AI Agent Debug] Tools JSON size:', toolsJson.length, 'bytes');
		if (toolsJson.length > 0) {
			console.log('[AI Agent Debug] Tools JSON (first 300 chars):', toolsJson.substring(0, 300) + '...');
		}

		const messagesSize = JSON.stringify(agentHistory).length;
		console.log('[AI Agent Debug] Messages size:', messagesSize, 'bytes');
		console.log('[AI Agent Debug] Total estimated body:', systemPromptWithTools.length + messagesSize + toolsJson.length, 'bytes');

		// Log each message
		agentHistory.forEach((msg, i) => {
			const contentPreview = typeof msg.content === 'string'
				? msg.content.substring(0, 100)
				: JSON.stringify(msg.content).substring(0, 100);
			console.log(`[AI Agent Debug] Message ${i}:`, msg.role, '-', contentPreview + '...');
		});

		// Estimate HTTP header size (AI SDK adds its own headers)
		const estimatedSize = estimateRequestSize(
			settings.provider,
			settings.modelName,
			settings.apiKey?.length || 0,
			tools,
			agentHistory,
			systemPromptWithTools
		);

		console.log('[AI Agent Debug] Estimated total request (headers + body):', estimatedSize.total, 'bytes');
		console.log('[AI Agent Debug] Estimated headers:', estimatedSize.headers, 'bytes');
		console.log('[AI Agent Debug] Estimated body:', estimatedSize.body, 'bytes');
		console.log('[AI Agent Debug] HTTP header limit: 8192 bytes (8KB)');
		console.log('[AI Agent Debug] Approaching limit?', estimatedSize.overLimit ? 'YES - WARNING!' : estimatedSize.total > 7000 ? 'Close to limit' : 'No');
		console.log('[AI Agent Debug] ============================\n');
		// =====================================================================

		// =====================================================================
		// PROGRESSIVE FALLBACK STRATEGY for 431 Error Handling
		// =====================================================================
		const strategies = [
			{
				name: 'full-tools',
				tools: tools,
				prompt: systemPromptWithTools,
			},
			{
				name: 'essential-tools',
				tools: getEssentialTools(tools),
				prompt: systemPromptWithTools,
			},
			{
				name: 'no-tools',
				tools: [],
				prompt: `You are MoLOS AI assistant. You currently have no tools available due to technical limitations. Please respond conversationally and let the user know about the limitation.`,
			},
		];

		let result: ExecutionResult | null = null;
		let lastError: Error | null = null;

		for (const strategy of strategies) {
			try {
				console.log(`[AiAgent] Trying strategy: ${strategy.name} with ${strategy.tools.length} tools`);

				// Update agent with strategy-specific tools
				const agent = createMoLOSAgent(agentConfig);
				agent.registerTools(strategy.tools as ToolDefinition[]);

				// Update system prompt
				agentConfig.systemPrompt = strategy.prompt;

				result = await agent.processMessage(content, agentHistory, {
					maxSteps: options.maxSteps ?? agentConfig.maxSteps,
					maxDurationMs: options.maxDurationMs ?? agentConfig.maxDurationMs,
					onProgress: options.onProgress,
					streamEnabled: options.streamEnabled ?? agentConfig.streamEnabled,
					systemPrompt: strategy.prompt,
				});

				console.log(`[AiAgent] Strategy ${strategy.name} succeeded!`);
				break; // Success! Exit the fallback loop
			} catch (error: any) {
				lastError = error;
				const is431 = error?.statusCode === 431 ||
					error?.status === 431 ||
					error?.message?.includes('431') ||
					error?.message?.includes('header');

				if (is431) {
					console.warn(`[AiAgent] Strategy ${strategy.name} failed with 431 (header too large), trying next fallback...`);
					continue;
				}
				// For non-431 errors, don't fallback - let it propagate
				console.error(`[AiAgent] Strategy ${strategy.name} failed with non-431 error:`, error?.message || error);
				throw error;
			}
		}

		// If all strategies failed, throw the last error
		if (!result) {
			console.error('[AiAgent] All fallback strategies failed!');
			throw lastError || new Error('All agent execution strategies failed');
		}
		// =====================================================================

		// DEBUG: Log message saving status
		console.log('[AiAgentV3Adapter] Final result message length:', result.message?.length || 0);
		console.log('[AiAgentV3Adapter] Note: Message persistence handled by API endpoint from message_segment events');
		// The API endpoint saves message_segment events to avoid duplicates
		// If messages are not being saved, check if message_segment events are being emitted

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

		try {
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
		} catch (error) {
			console.error('[AiAgentV3Adapter] Action execution failed:', error);
			// Return error result instead of throwing to prevent app crashes
			return {
				error: error instanceof Error ? error.message : String(error),
				success: false,
				toolName: action.entity
			};
		}
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
