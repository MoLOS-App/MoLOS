/**
 * OpenAI Provider implementation
 */

import { BaseProvider } from './anthropic';
import type { ToolDefinition, LlmResponse, AgentMessage } from '../../core/types';
import type { ProviderConfig, CompletionOptions } from '../provider-interface';
import { ProviderError } from '../provider-interface';

/**
 * OpenAI-compatible Provider (works for OpenAI, OpenRouter, Ollama, Zai)
 */
export class OpenAICompatibleProvider extends BaseProvider {
	readonly name: string;
	readonly type: string;

	constructor(
		config: ProviderConfig,
		providerName: string = 'openai'
	) {
		super(config);
		this.name = providerName;
		this.type = providerName;
	}

	protected async doInitialize(): Promise<void> {
		// OpenAI-compatible endpoints may not require API key (e.g., Ollama)
		// So we don't throw an error here
	}

	async complete(
		messages: AgentMessage[],
		tools?: ToolDefinition[],
		options?: CompletionOptions
	): Promise<LlmResponse> {
		await this.initialize();

		const body: Record<string, unknown> = {
			model: this.config.model,
			messages: messages.map(m => this.formatMessage(m))
		};

		// Add optional parameters
		if (options?.maxTokens || this.config.maxTokens) {
			body.max_tokens = options?.maxTokens || this.config.maxTokens;
		}

		if (options?.temperature !== undefined || this.config.temperature !== undefined) {
			body.temperature = options?.temperature ?? this.config.temperature;
		}

		if (options?.topP !== undefined || this.config.topP !== undefined) {
			body.top_p = options?.topP ?? this.config.topP;
		}

		if (options?.stopSequences) {
			body.stop = options.stopSequences;
		}

		// Add tools if provided
		if (tools && tools.length > 0) {
			body.tools = tools.map(t => ({
				type: 'function',
				function: {
					name: t.name,
					description: t.description,
					parameters: t.parameters
				}
			}));
			body.tool_choice = 'auto';
		}

		// Provider-specific headers
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		if (this.config.apiKey) {
			headers['Authorization'] = `Bearer ${this.config.apiKey}`;
		}

		// OpenRouter-specific headers
		if (this.name === 'openrouter') {
			headers['HTTP-Referer'] = 'https://molos.app';
			headers['X-Title'] = 'MoLOS';
		}

		const response = await this.fetchWithRetry(
			this.getEndpoint(),
			{
				method: 'POST',
				headers,
				body: JSON.stringify(body)
			}
		);

		const data = await response.json();
		return this.parseResponse(data);
	}

	private getEndpoint(): string {
		if (this.config.baseUrl) {
			return this.config.baseUrl;
		}

		switch (this.name) {
			case 'openai':
				return 'https://api.openai.com/v1/chat/completions';
			case 'openrouter':
				return 'https://openrouter.ai/api/v1/chat/completions';
			case 'ollama':
				return 'http://localhost:11434/v1/chat/completions';
			case 'zai':
				return 'https://api.z.ai/api/coding/paas/v4/chat/completions';
			default:
				return 'https://api.openai.com/v1/chat/completions';
		}
	}

	private formatMessage(message: AgentMessage): Record<string, unknown> {
		const formatted: Record<string, unknown> = {
			role: message.role,
			content: message.content
		};

		if (message.toolCalls) {
			formatted.tool_calls = message.toolCalls.map(tc => ({
				id: tc.id,
				type: 'function',
				function: {
					name: tc.name,
					arguments: JSON.stringify(tc.parameters)
				}
			}));
		}

		if (message.toolCallId) {
			formatted.tool_call_id = message.toolCallId;
		}

		if (message.role === 'tool' && message.toolCallId) {
			formatted.name = message.toolCallId; // Some providers need this
		}

		return formatted;
	}

	private parseResponse(data: any): LlmResponse {
		const choice = data.choices?.[0];
		const message = choice?.message || {};

		const toolCalls = message.tool_calls?.map((tc: any) => {
			let parameters = {};
			try {
				parameters = typeof tc.function.arguments === 'string'
					? JSON.parse(tc.function.arguments)
					: tc.function.arguments;
			} catch {
				// Keep empty parameters
			}

			return {
				id: tc.id,
				name: tc.function.name,
				parameters
			};
		});

		return {
			content: message.content || '',
			toolCalls: toolCalls?.length > 0 ? toolCalls : undefined,
			usage: data.usage ? {
				promptTokens: data.usage.prompt_tokens,
				completionTokens: data.usage.completion_tokens,
				totalTokens: data.usage.total_tokens
			} : undefined
		};
	}
}

/**
 * Create an OpenAI provider
 */
export function createOpenAIProvider(config: ProviderConfig): OpenAICompatibleProvider {
	return new OpenAICompatibleProvider(config, 'openai');
}

/**
 * Create an OpenRouter provider
 */
export function createOpenRouterProvider(config: ProviderConfig): OpenAICompatibleProvider {
	return new OpenAICompatibleProvider(config, 'openrouter');
}

/**
 * Create an Ollama provider
 */
export function createOllamaProvider(config: ProviderConfig): OpenAICompatibleProvider {
	return new OpenAICompatibleProvider(config, 'ollama');
}

/**
 * Create a Zai provider
 */
export function createZaiProvider(config: ProviderConfig): OpenAICompatibleProvider {
	return new OpenAICompatibleProvider(config, 'zai');
}
