/**
 * Base Provider - Abstract base class for LLM providers
 */

import type {
	ILlmProvider,
	ProviderConfig,
	CompletionOptions,
	StreamHandler,
	StreamChunk
} from '../provider-interface';
import type { ToolDefinition, LlmResponse, AgentMessage } from '../../core/types';
import { ProviderError, calculateBackoff, sleep } from '../provider-interface';

/**
 * Abstract base class for LLM providers
 */
export abstract class BaseProvider implements ILlmProvider {
	abstract readonly name: string;
	abstract readonly type: string;

	protected config: ProviderConfig;
	protected initialized: boolean = false;

	constructor(config: ProviderConfig) {
		this.config = config;
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;
		await this.doInitialize();
		this.initialized = true;
	}

	async isAvailable(): Promise<boolean> {
		try {
			await this.initialize();
			return true;
		} catch {
			return false;
		}
	}

	abstract complete(
		messages: AgentMessage[],
		tools?: ToolDefinition[],
		options?: CompletionOptions
	): Promise<LlmResponse>;

	async streamComplete?(
		messages: AgentMessage[],
		tools?: ToolDefinition[],
		options?: CompletionOptions,
		onChunk?: StreamHandler
	): Promise<LlmResponse>;

	countTokens?(messages: AgentMessage[]): number;

	getAvailableModels?(): Promise<string[]>;

	async dispose?(): Promise<void> {
		this.initialized = false;
	}

	/**
	 * Subclasses implement this for initialization
	 */
	protected async doInitialize(): Promise<void> {
		// Override in subclasses if needed
	}

	/**
	 * Make an HTTP request with retry logic
	 */
	protected async fetchWithRetry(
		url: string,
		options: RequestInit,
		maxRetries: number = 3
	): Promise<Response> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const controller = new AbortController();
				const timeout = setTimeout(
					() => controller.abort(),
					this.config.timeout || 60000
				);

				const response = await fetch(url, {
					...options,
					signal: controller.signal
				});

				clearTimeout(timeout);

				if (!response.ok) {
					const errorBody = await this.parseErrorBody(response);

					if (this.shouldRetry(response.status) && attempt < maxRetries) {
						const backoff = calculateBackoff(attempt, 1000, 10000);
						await sleep(backoff);
						continue;
					}

					throw new ProviderError(
						errorBody.message || `HTTP ${response.status}`,
						'http_error',
						response.status,
						this.shouldRetry(response.status)
					);
				}

				return response;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				if (error instanceof Error && error.name === 'AbortError') {
					if (attempt < maxRetries) {
						const backoff = calculateBackoff(attempt, 1000, 10000);
						await sleep(backoff);
						continue;
					}
					throw new ProviderError('Request timed out', 'timeout', undefined, true);
				}

				if (attempt < maxRetries && this.isRetryableError(error)) {
					const backoff = calculateBackoff(attempt, 1000, 10000);
					await sleep(backoff);
					continue;
				}

				throw error;
			}
		}

		throw lastError || new Error('Max retries exceeded');
	}

	/**
	 * Parse error response body
	 */
	protected async parseErrorBody(response: Response): Promise<{ message: string }> {
		try {
			const data = await response.json();
			return {
				message: data?.error?.message || data?.error || response.statusText
			};
		} catch {
			return { message: response.statusText };
		}
	}

	/**
	 * Check if status code should trigger retry
	 */
	protected shouldRetry(status: number): boolean {
		return status === 408 || status === 429 || status >= 500;
	}

	/**
	 * Check if error is retryable
	 */
	protected isRetryableError(error: unknown): boolean {
		if (error instanceof ProviderError) {
			return error.retryable;
		}

		if (error instanceof Error) {
			const msg = error.message.toLowerCase();
			return (
				msg.includes('econnrefused') ||
				msg.includes('etimedout') ||
				msg.includes('enotfound') ||
				msg.includes('network')
			);
		}

		return false;
	}
}

/**
 * Anthropic Provider implementation
 */
export class AnthropicProvider extends BaseProvider {
	readonly name = 'anthropic';
	readonly type = 'anthropic';

	constructor(config: ProviderConfig) {
		super(config);
	}

	protected async doInitialize(): Promise<void> {
		if (!this.config.apiKey) {
			throw new ProviderError('API key is required for Anthropic', 'missing_api_key');
		}
	}

	async complete(
		messages: AgentMessage[],
		tools?: ToolDefinition[],
		options?: CompletionOptions
	): Promise<LlmResponse> {
		await this.initialize();

		const systemMessage = messages.find(m => m.role === 'system');
		const userMessages = messages.filter(m => m.role !== 'system');

		const body: Record<string, unknown> = {
			model: this.config.model,
			max_tokens: options?.maxTokens || this.config.maxTokens || 4096,
			messages: userMessages.map(m => this.formatMessage(m))
		};

		// Add system prompt
		if (systemMessage || options?.systemPrompt) {
			body.system = options?.systemPrompt || (systemMessage?.content as string);
		}

		// Add optional parameters
		if (options?.temperature !== undefined || this.config.temperature !== undefined) {
			body.temperature = options?.temperature ?? this.config.temperature;
		}

		if (options?.topP !== undefined || this.config.topP !== undefined) {
			body.top_p = options?.topP ?? this.config.topP;
		}

		if (options?.stopSequences) {
			body.stop_sequences = options.stopSequences;
		}

		// Add tools if provided
		if (tools && tools.length > 0) {
			body.tools = tools.map(t => ({
				name: t.name,
				description: t.description,
				input_schema: t.parameters
			}));
		}

		// Add thinking if enabled
		if (options?.thinkingEnabled) {
			body.thinking = {
				type: 'enabled',
				budget_tokens: options.thinkingBudget || 1000
			};
		}

		const response = await this.fetchWithRetry(
			this.config.baseUrl || 'https://api.anthropic.com/v1/messages',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': this.config.apiKey!,
					'anthropic-version': '2023-06-01'
				},
				body: JSON.stringify(body)
			}
		);

		const data = await response.json();
		return this.parseResponse(data);
	}

	private formatMessage(message: AgentMessage): Record<string, unknown> {
		const formatted: Record<string, unknown> = {
			role: message.role === 'tool' ? 'user' : message.role
		};

		if (message.role === 'assistant' && message.toolCalls) {
			// Assistant message with tool calls
			const content: unknown[] = [];

			if (message.content && typeof message.content === 'string' && message.content.trim()) {
				content.push({ type: 'text', text: message.content });
			}

			for (const tc of message.toolCalls) {
				let input = tc.parameters;
				if (typeof (tc as any).function?.arguments === 'string') {
					try {
						input = JSON.parse((tc as any).function.arguments);
					} catch {
						// Keep as is
					}
				}
				content.push({
					type: 'tool_use',
					id: tc.id,
					name: tc.name,
					input
				});
			}

			formatted.content = content;
		} else if (message.role === 'tool') {
			// Tool result message
			formatted.content = [
				{
					type: 'tool_result',
					tool_use_id: message.toolCallId,
					content: message.content
				}
			];
		} else {
			// Regular message
			formatted.content = message.content;
		}

		return formatted;
	}

	private parseResponse(data: any): LlmResponse {
		const contentParts = Array.isArray(data.content) ? data.content : [];
		const textPart = contentParts.find((c: any) => c.type === 'text');
		const toolParts = contentParts.filter((c: any) => c.type === 'tool_use');
		const thinkingPart = contentParts.find((c: any) => c.type === 'thinking');

		const toolCalls = toolParts.map((tc: any) => ({
			id: tc.id,
			name: tc.name,
			parameters: tc.input || {}
		}));

		return {
			content: textPart?.text || '',
			toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
			thinking: thinkingPart?.thinking,
			usage: data.usage ? {
				promptTokens: data.usage.input_tokens,
				completionTokens: data.usage.output_tokens,
				totalTokens: data.usage.input_tokens + data.usage.output_tokens
			} : undefined
		};
	}
}

/**
 * Create an Anthropic provider
 */
export function createAnthropicProvider(config: ProviderConfig): AnthropicProvider {
	return new AnthropicProvider(config);
}
