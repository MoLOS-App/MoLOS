/**
 * LLM Provider Client - Wrapper for @molos/agent AgentLoop
 *
 * This implements the LLMProviderClient interface required by AgentLoop.
 * It wraps our existing provider call logic (MiniMax/OpenAI/etc).
 */

import type { LLMProviderClient, LlmRequest, LlmResponse, AgentMessage } from '@molos/agent';
import { createProvider, mapProvider } from '@molos/agent';
import type { AiSettings } from '$lib/models/ai';

export class LlmProviderClient implements LLMProviderClient {
	private settings: AiSettings;
	private provider: any; // LanguageModelV3 from AI SDK

	constructor(settings: AiSettings) {
		this.settings = settings;
	}

	async initialize(): Promise<void> {
		const providerType = mapProvider(this.settings.provider);
		this.provider = await createProvider({
			provider: providerType,
			modelName: this.settings.modelName,
			apiKey: this.settings.apiKey,
			baseUrl: this.settings.baseUrl
		});
	}

	async chat(request: LlmRequest): Promise<LlmResponse> {
		// Convert @molos/agent AgentMessage[] to AI SDK format
		const aiSdkMessages = request.messages.map((msg) => ({
			role: msg.role as 'user' | 'assistant' | 'system',
			content: msg.content
		}));

		// Call the AI SDK provider
		const result = await this.provider.doGenerate({
			mode: { type: 'regular' },
			messages: aiSdkMessages,
			tools: request.tools?.length ? request.tools : undefined,
			toolChoice: request.toolChoice || 'auto',
			temperature: request.temperature,
			maxTokens: request.maxTokens
		});

		// Convert back to @molos/agent LlmResponse format
		return {
			model: result.model,
			message: {
				role: 'assistant',
				content:
					result.finishReason === 'tool_calls'
						? '' // Tool calls have no text content
						: result.content[0]?.text || '',
				toolCalls: result.toolCalls?.map(
					(tc: { toolCallId: string; toolName: string; input: Record<string, unknown> }) => ({
						id: tc.toolCallId,
						name: tc.toolName,
						arguments: tc.input as Record<string, unknown>
					})
				)
			} as AgentMessage,
			usage: {
				inputTokens: result.usage?.inputTokens || 0,
				outputTokens: result.usage?.outputTokens || 0,
				totalTokens: (result.usage?.inputTokens || 0) + (result.usage?.outputTokens || 0)
			},
			finishReason: result.finishReason as LlmResponse['finishReason']
		};
	}
}

export async function createLlmProviderClient(settings: AiSettings): Promise<LLMProviderClient> {
	const client = new LlmProviderClient(settings);
	await client.initialize();
	return client;
}
