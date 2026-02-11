/**
 * LLM client abstraction
 * Handles API calls to different LLM providers
 */

import type { AiSettings } from '$lib/models/ai';
import type { ToolDefinition } from '$lib/models/ai';
import type { AgentRuntimeConfig } from '../../runtime-config';

/**
 * Extended error interface for LLM errors
 */
interface LlmError extends Error {
	code?: string;
	status?: number;
	details?: unknown;
}

/**
 * Response from LLM
 */
export interface LlmResponse {
	content: string;
	toolCalls?: Array<{
		id: string;
		name: string;
		parameters: Record<string, unknown>;
	}>;
	rawToolCalls?: unknown[];
}

/**
 * Message format for LLM
 */
export interface LlmMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string | unknown;
	toolCalls?: unknown[];
	toolCallId?: string;
	name?: string;
}

/**
 * LLM client for making API calls
 */
export class LlmClient {
	private settings: AiSettings;
	private runtime: AgentRuntimeConfig;

	constructor(settings: AiSettings, runtime: AgentRuntimeConfig) {
		this.settings = settings;
		this.runtime = runtime;
	}

	/**
	 * Call the LLM with messages and tools
	 */
	async call(messages: LlmMessage[], tools?: ToolDefinition[]): Promise<LlmResponse> {
		const { provider, apiKey, modelName, baseUrl } = this.settings;

		switch (provider) {
			case 'anthropic':
				return this.callAnthropic(messages, tools);
			case 'openai':
			case 'openrouter':
			case 'ollama':
			case 'zai':
				return this.callOpenAICompatible(messages, tools, provider, baseUrl);
			default:
				throw new Error(`Unsupported provider: ${provider}`);
		}
	}

	/**
	 * Call Anthropic API
	 */
	private async callAnthropic(
		messages: LlmMessage[],
		tools?: ToolDefinition[]
	): Promise<LlmResponse> {
		const endpoint = 'https://api.anthropic.com/v1/messages';

		const systemMessage = messages.find((m) => m.role === 'system');
		const userMessages = messages.filter((m) => m.role !== 'system');

		const body: Record<string, unknown> = {
			model: this.settings.modelName,
			max_tokens: this.settings.maxTokens || 4096,
			temperature:
				this.settings.temperature !== undefined ? this.settings.temperature / 100 : undefined,
			top_p: this.settings.topP !== undefined ? this.settings.topP / 100 : undefined,
			system: systemMessage?.content as string | undefined,
			messages: userMessages.map((m) => this.formatMessageForAnthropic(m))
		};

		// Only include tools if provided (for function calling)
		if (tools && tools.length > 0) {
			body.tools = tools.map((t) => ({
				name: t.name,
				description: t.description,
				input_schema: t.parameters
			}));
		}

		const response = await this.fetchWithRetry(
			endpoint,
			{
				'x-api-key': this.settings.apiKey!,
				'anthropic-version': '2023-06-01'
			},
			body
		);

		return this.parseAnthropicResponse(response);
	}

	/**
	 * Call OpenAI-compatible API
	 */
	private async callOpenAICompatible(
		messages: LlmMessage[],
		tools: ToolDefinition[] | undefined,
		provider: string,
		baseUrl?: string
	): Promise<LlmResponse> {
		let endpoint = '';

		if (provider === 'openai') {
			endpoint = 'https://api.openai.com/v1/chat/completions';
		} else if (provider === 'openrouter') {
			endpoint = baseUrl || 'https://openrouter.ai/api/v1/chat/completions';
		} else if (provider === 'ollama') {
			endpoint = `${baseUrl || 'http://localhost:11434'}/v1/chat/completions`;
		} else if (provider === 'zai') {
			endpoint = baseUrl || 'https://api.z.ai/api/coding/paas/v4/chat/completions';
		}

		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.settings.apiKey}`
		};

		if (provider === 'openrouter') {
			headers['HTTP-Referer'] = 'https://molos.app';
			headers['X-Title'] = 'MoLOS';
		}

		const body: Record<string, unknown> = {
			model: this.settings.modelName,
			temperature:
				this.settings.temperature !== undefined ? this.settings.temperature / 100 : undefined,
			top_p: this.settings.topP !== undefined ? this.settings.topP / 100 : undefined,
			max_tokens: this.settings.maxTokens || undefined,
			messages: messages.map((m) => ({
				role: m.role,
				content: m.content,
				tool_calls: m.toolCalls,
				tool_call_id: m.toolCallId,
				name: m.name
			}))
		};

		// Only include tools if provided (for function calling)
		if (tools && tools.length > 0) {
			body.tools = tools.map((t) => ({
				type: 'function',
				function: {
					name: t.name,
					description: t.description,
					parameters: t.parameters
				}
			}));
			body.tool_choice = 'auto';
		}

		const response = await this.fetchWithRetry(endpoint, headers, body);

		return this.parseOpenAIResponse(response);
	}

	/**
	 * Fetch with retry logic
	 */
	private async fetchWithRetry(
		endpoint: string,
		headers: Record<string, string>,
		body: Record<string, unknown>
	): Promise<unknown> {
		const payload = JSON.stringify(body);

		for (let attempt = 0; attempt <= this.runtime.retryMax; attempt++) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), this.runtime.llmTimeoutMs);

			try {
				const res = await fetch(endpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...headers
					},
					body: payload,
					signal: controller.signal
				});

				clearTimeout(timeout);

				if (!res.ok) {
					const errorBody = await this.parseErrorResponse(res);
					const status = res.status;

					// Log detailed error for debugging
					console.error(`[LLM Client] Request failed:`, {
						status,
						statusText: res.statusText,
						body: errorBody
					});

					if (this.shouldRetry(status) && attempt < this.runtime.retryMax) {
						await this.sleep(this.getBackoffDelay(attempt));
						continue;
					}

					// Create a more detailed error message
					let errorMessage = errorBody.message || 'API request failed';
					if (status === 401) {
						errorMessage = 'Invalid API key. Please check your AI settings.';
					} else if (status === 429) {
						errorMessage = 'Rate limit exceeded. Please try again later.';
					} else if (status >= 500) {
						errorMessage = 'AI provider service error. Please try again.';
					}

					// Throw error with code for agent to catch
					const error = new Error(errorMessage) as LlmError;
					error.code = 'llm_request_failed';
					error.status = status;
					throw error;
				}

				return await res.json();
			} catch (error) {
				clearTimeout(timeout);

				if (error instanceof Error && error.name === 'AbortError') {
					if (attempt < this.runtime.retryMax) {
						await this.sleep(this.getBackoffDelay(attempt));
						continue;
					}
					throw new Error('LLM request timed out');
				}

				if (attempt < this.runtime.retryMax) {
					await this.sleep(this.getBackoffDelay(attempt));
					continue;
				}

				throw error;
			}
		}

		throw new Error('Max retries exceeded');
	}

	/**
	 * Format message for Anthropic
	 */
	private formatMessageForAnthropic(message: LlmMessage): Record<string, unknown> {
		const msg: Record<string, unknown> = { role: message.role === 'tool' ? 'user' : message.role };

		if (message.role === 'assistant' && message.toolCalls) {
			msg.content = [
				{ type: 'text', text: (message.content as string) || '' },
				...(message.toolCalls as any[]).map((tc) => {
					let input = tc.function.arguments;
					if (typeof input === 'string') {
						try {
							input = JSON.parse(input);
						} catch {
							// keep as string
						}
					}
					return {
						type: 'tool_use',
						id: tc.id,
						name: tc.function.name,
						input
					};
				})
			];
		} else if (message.role === 'tool') {
			msg.content = [
				{
					type: 'tool_result',
					tool_use_id: message.toolCallId,
					content: message.content
				}
			];
		} else {
			msg.content = message.content;
		}

		return msg;
	}

	/**
	 * Parse Anthropic response
	 */
	private parseAnthropicResponse(data: unknown): LlmResponse {
		const anthropicData = data as { content: unknown[] };
		const contentParts = Array.isArray(anthropicData.content)
			? (anthropicData.content as Array<{ type: string; text?: string }>)
			: [];

		const text = contentParts.find((c) => c.type === 'text')?.text || '';

		const toolCalls = contentParts
			.filter((c: any) => c.type === 'tool_use')
			.map((tc: any) => ({
				id: tc.id,
				name: tc.name,
				parameters: tc.input || {}
			}));

		return {
			content: text,
			toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
			rawToolCalls:
				toolCalls.length > 0
					? toolCalls.map((tc) => ({
							id: tc.id,
							type: 'function',
							function: {
								name: tc.name,
								arguments: JSON.stringify(tc.parameters)
							}
						}))
					: undefined
		};
	}

	/**
	 * Parse OpenAI response
	 */
	private parseOpenAIResponse(data: unknown): LlmResponse {
		const openaiData = data as {
			choices?: Array<{ message?: { content?: string; tool_calls?: unknown[] } }>;
		};

		const choice = openaiData.choices?.[0];
		const message = choice?.message || {};

		const toolCalls = (message.tool_calls as Record<string, unknown>[])?.map(
			(tc: Record<string, unknown>) => {
				const func = tc.function as Record<string, unknown>;
				let parameters = {};

				try {
					parameters =
						typeof func.arguments === 'string' ? JSON.parse(func.arguments) : func.arguments;
				} catch {
					// keep as is
				}

				return {
					id: tc.id as string,
					name: func.name as string,
					parameters
				};
			}
		);

		return {
			content: (message.content as string) || '',
			toolCalls,
			rawToolCalls: message.tool_calls as unknown[]
		};
	}

	/**
	 * Parse error response
	 */
	private async parseErrorResponse(res: Response): Promise<{ message: string }> {
		try {
			const data = await res.json();
			return {
				message: data?.error?.message || data?.error || 'API request failed'
			};
		} catch {
			const text = await res.text().catch(() => '');
			return { message: text || 'API request failed' };
		}
	}

	/**
	 * Check if we should retry
	 */
	private shouldRetry(status: number): boolean {
		return status === 408 || status === 429 || status >= 500;
	}

	/**
	 * Get backoff delay
	 */
	private getBackoffDelay(attempt: number): number {
		const delay = Math.min(this.runtime.retryMaxDelayMs, this.runtime.retryBaseMs * 2 ** attempt);
		const jitter = Math.floor(delay * 0.2 * Math.random());
		return delay + jitter;
	}

	/**
	 * Sleep helper
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
