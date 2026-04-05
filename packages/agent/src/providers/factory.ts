/**
 * Provider Factory - Creates and Configures AI Provider Instances
 *
 * ## Purpose
 * Abstracts over different AI provider APIs (OpenAI, Anthropic, Google, OpenRouter, etc.)
 * providing a unified `LanguageModelV3` interface for the agent loop. This enables seamless
 * provider switching, multi-provider failover, and provider-specific option handling.
 *
 * ## Provider Abstraction Pattern
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    Agent Loop (AI SDK)                      │
 * └─────────────────────────────────────────────────────────────┘
 *                              │
 *                              ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    Provider Factory                          │
 * │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
 * │  │OpenAI   │  │Anthropic│  │ Google  │  │ Open    │       │
 * │  │Provider │  │Provider │  │Provider │  │ Router  │       │
 * │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
 * │       │            │            │            │             │
 * └───────┼────────────┼────────────┼────────────┼─────────────┘
 *         │            │            │            │
 *         ▼            ▼            ▼            ▼
 *      Standard    Anthropic     Google       OpenAI-Compatible
 *      AI SDK      HTTP API      HTTP API        HTTP API
 * ```
 *
 * ## Supported Providers
 * | Provider       | API Type        | Thinking Support | Notes                    |
 * |----------------|-----------------|------------------|--------------------------|
 * | `openai`       | AI SDK          | Yes (ext)        | Default for most models  |
 * | `anthropic`    | AI SDK + HTTP   | Native           | Claude models            |
 * | `openrouter`   | OpenAI-compat   | Yes (ext)        | Gateway to many providers|
 * | `google`       | HTTP            | Yes (budget)     | Gemini models            |
 * | `groq`         | OpenAI-compat   | Yes (ext)        | Fast inference           |
 * | `deepseek`     | OpenAI-compat   | Yes (ext)        | Cost-effective           |
 * | `minimax`      | Dual endpoint   | Yes              | Has Anthropic-compatible |
 * | `ollama`       | OpenAI-compat   | Yes (ext)        | Local models             |
 * | `zai`          | OpenAI-compat   | Yes (ext)        | Custom provider          |
 *
 * ## Multi-Key Support
 * For high-volume workloads, multiple API keys can be configured:
 * - Keys are expanded into separate `ModelConfig` entries during initialization
 * - Each key gets its own provider instance (indexed for disambiguation)
 * - Keys are tried in order during fallback, distributing load
 *
 * ## Model Configuration Pattern
 * ```typescript
 * // Protocol format: "provider/model-name"
 * const model = "openai/gpt-4o"           // OpenAI GPT-4o
 * const model = "anthropic/claude-sonnet-4-20250514"  // Anthropic Claude
 * const model = "openrouter/anthropic/claude-sonnet-4" // Via OpenRouter
 * ```
 *
 * ## Thinking Levels
 * Configurable extended thinking budgets per provider:
 * | Level    | Budget Tokens | Use Case                    |
 * |----------|---------------|-----------------------------|
 * | `off`    | 0             | Fast responses, no thinking |
 * | `minimal`| 1,024         | Simple tasks                |
 * | `low`    | 4,096         | Light reasoning             |
 * | `medium` | 8,192         | Complex reasoning (default)  |
 * | `high`   | 16,384        | Maximum reasoning           |
 *
 * ## AI Context Optimization Tips
 * 1. **Cache Provider Instances**: Factory creates provider objects - reuse them
 * 2. **Use Multi-Key for Rate Limits**: Expand keys to distribute token volume
 * 3. **Protocol Defaults**: Most providers have sensible defaults in `PROTOCOL_DEFAULTS`
 * 4. **Extra Body Injection**: Use `wrapModelWithExtraBody()` to inject provider-specific params
 * 5. **MiniMax Dual Endpoint**: MiniMax uses different endpoints - HTTP vs Anthropic-compatible
 *
 * ## Provider-Specific Options
 * - **Anthropic**: Thinking via `beta: anthropic-thinking` header
 * - **Google**: Thinking via `thinking: { type: 'enabled', budgetTokens }`
 * - **OpenAI-compatible**: Thinking via `thinking: { type: 'enabled', budget_tokens }`
 *
 * @example
 * // Create a provider with config
 * const provider = await createProvider({
 *   provider: 'openai',
 *   modelName: 'gpt-4o',
 *   apiKey: process.env.OPENAI_API_KEY,
 *   temperature: 0.7,
 *   thinkingLevel: 'medium'
 * });
 *
 * @example
 * // Multi-key expansion for high volume
 * const configs = expandMultiKeyModels([{
 *   name: 'gpt-4o',
 *   provider: 'openai',
 *   model: 'openai/gpt-4o',
 *   _apiKeys: ['key1', 'key2', 'key3']  // Expands to 3 configs
 * }]);
 */

import type { LanguageModelV2, LanguageModelV3 } from '@ai-sdk/provider';
import { TOKEN } from '../constants.js';
import { ProviderConfigSchema } from '../config/schemas.js';
import { validateConfigOrThrow } from '../config/validation.js';

// =============================================================================
// Provider Types
// =============================================================================

export type LlmProvider =
	| 'anthropic'
	| 'openai'
	| 'openrouter'
	| 'ollama'
	| 'zai'
	| 'groq'
	| 'deepseek'
	| 'google'
	| 'mistral'
	| 'moonshot'
	| 'xai'
	| 'minimax'
	| 'minimax-coding';

export interface ProviderConfig {
	provider: LlmProvider;
	modelName: string;
	apiKey?: string;
	baseUrl?: string;
	/** Multiple keys for failover */
	apiKeys?: string[];
	/** Provider-specific options */
	thinkingLevel?: ThinkingLevel;
	temperature?: number;
	topP?: number;
	maxTokens?: number;
	extraBody?: Record<string, unknown>;
}

export interface ModelConfig {
	/** Display name (e.g., "gpt-4o") */
	name: string;
	/** Provider identifier */
	provider: LlmProvider;
	/** Protocol identifier (e.g., "openai/gpt-4o") */
	model: string;
	/** Custom API base URL */
	apiBase?: string;
	/** Proxy URL */
	proxy?: string;
	/** References to fallback model names */
	fallbacks?: string[];
	/** Auth method (e.g., "oauth", "token") */
	authMethod?: string;
	/** Connection mode (e.g., "grpc", "http") */
	connectMode?: string;
	/** Workspace path for CLI providers */
	workspace?: string;
	/** Requests per minute limit */
	rpm?: number;
	/** Custom max tokens field name */
	maxTokensField?: string;
	/** Request timeout in seconds */
	requestTimeout?: number;
	/** Thinking level */
	thinkingLevel?: ThinkingLevel;
	/** Extra body parameters */
	extraBody?: Record<string, unknown>;
	/** Security (private, not serialized) */
	_apiKeys: string[];
}

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high';

export interface ProviderOptions {
	thinkingLevel?: ThinkingLevel;
	temperature?: number;
	topP?: number;
	maxTokens?: number;
	[key: string]: unknown;
}

// =============================================================================
// Protocol Defaults
// =============================================================================

/**
 * Default API base URLs for known protocols.
 */
export const PROTOCOL_DEFAULTS: Record<string, string> = {
	openai: 'https://api.openai.com/v1',
	anthropic: 'https://api.anthropic.com/v1',
	openrouter: 'https://openrouter.ai/api/v1',
	ollama: 'http://localhost:11434/v1',
	groq: 'https://api.groq.com/openai/v1',
	deepseek: 'https://api.deepseek.com/v1',
	google: 'https://generativelanguage.googleapis.com/v1beta',
	mistral: 'https://api.mistral.ai/v1',
	moonshot: 'https://api.moonshot.cn/v1',
	xai: 'https://api.x.ai/v1',
	minimax: 'https://api.minimaxi.com/v1',
	'minimax-coding': 'https://api.minimaxi.com/v1',
	zai: 'https://api.z.ai/v1'
};

// =============================================================================
// Provider Factory
// =============================================================================

/**
 * Create a language model provider instance.
 *
 * Supports:
 * - Direct AI SDK providers (via dynamic import)
 * - OpenAI-compatible HTTP providers
 * - Custom provider configurations
 *
 * @throws Error if configuration validation fails
 */
export async function createProvider(config: ProviderConfig): Promise<LanguageModelV3> {
	// Validate configuration with Zod
	const validatedConfig = validateConfigOrThrow(
		ProviderConfigSchema,
		config,
		'Provider configuration is invalid'
	);

	const {
		provider,
		modelName,
		apiKey,
		baseUrl,
		thinkingLevel,
		temperature,
		topP,
		maxTokens,
		extraBody
	} = validatedConfig as ProviderConfig & {
		provider: LlmProvider;
		modelName: string;
		apiKey?: string;
		baseUrl?: string;
		apiKeys?: string[];
		thinkingLevel?: ThinkingLevel;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		extraBody?: Record<string, unknown>;
	};

	// Build provider options
	const options: Record<string, unknown> = {
		...(extraBody ?? {})
	};

	if (temperature !== undefined) {
		options.temperature = temperature;
	}
	if (topP !== undefined) {
		options.topP = topP;
	}
	if (maxTokens !== undefined) {
		options.maxTokens = maxTokens;
	}
	if (thinkingLevel && thinkingLevel !== 'off') {
		options.thinkingLevel = thinkingLevel;
	}

	// Determine API base URL
	const resolvedBaseUrl = baseUrl ?? PROTOCOL_DEFAULTS[provider];
	const apiBase = resolvedBaseUrl ?? '';

	// Get API key from config or first available key
	const key = apiKey ?? config.apiKeys?.[0] ?? '';

	// Create provider based on type
	switch (provider) {
		case 'anthropic':
			return createAnthropicProvider(key, apiBase || undefined, modelName, options);

		case 'openai':
			return createOpenAIProvider(key, apiBase || undefined, modelName, options);

		case 'openrouter':
		case 'groq':
		case 'deepseek':
		case 'mistral':
		case 'moonshot':
		case 'xai':
		case 'zai':
		case 'ollama':
			return createOpenAICompatibleProvider(
				provider,
				key,
				apiBase || undefined,
				modelName,
				options
			);

		case 'google':
			return createGoogleProvider(key, apiBase || undefined, modelName, options);

		case 'minimax':
		case 'minimax-coding':
			return createMinimaxProvider(key, apiBase || undefined, modelName, options);

		default:
			throw new Error(`Unsupported provider: ${provider}`);
	}
}

/**
 * Map a provider string to LlmProvider type.
 */
export function mapProvider(provider: string): LlmProvider {
	const normalized = provider.toLowerCase().trim();

	const knownProviders: Record<string, LlmProvider> = {
		openai: 'openai',
		anthropic: 'anthropic',
		openrouter: 'openrouter',
		ollama: 'ollama',
		zai: 'zai',
		groq: 'groq',
		deepseek: 'deepseek',
		google: 'google',
		gemini: 'google',
		mistral: 'mistral',
		moonshot: 'moonshot',
		xai: 'xai',
		minimax: 'minimax',
		'minimax-coding': 'minimax-coding'
	};

	return knownProviders[normalized] ?? 'openai';
}

/**
 * Get provider-specific options for the AI SDK.
 */
export function getProviderOptions(
	provider: LlmProvider,
	options: ProviderOptions
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...options };

	// Provider-specific option mapping
	switch (provider) {
		case 'anthropic':
			// Map thinking level to Anthropic's beta header
			if (options.thinkingLevel && options.thinkingLevel !== 'off') {
				result.extraBody = {
					...((result.extraBody as Record<string, unknown>) || {}),
					beta: 'anthropic-thinking;2025-05-14'
				};
			}
			break;

		case 'google':
			// Google uses thinking blob
			if (options.thinkingLevel && options.thinkingLevel !== 'off') {
				result.thinking = {
					type: 'enabled' as const,
					budgetTokens: getThinkingBudget(options.thinkingLevel)
				};
			}
			break;

		case 'openai':
		case 'openrouter':
		case 'groq':
		case 'deepseek':
		case 'mistral':
		case 'moonshot':
		case 'xai':
		case 'zai':
		case 'ollama':
		case 'minimax':
		case 'minimax-coding':
			// OpenAI-compatible providers use thinking extension
			if (options.thinkingLevel && options.thinkingLevel !== 'off') {
				result.extraBody = {
					...((result.extraBody as Record<string, unknown>) || {}),
					thinking: {
						type: 'enabled' as const,
						budget_tokens: getThinkingBudget(options.thinkingLevel)
					}
				};
			}
			break;
	}

	return result;
}

/**
 * Expand multi-key configurations into multiple model configs.
 * Each API key gets its own ModelConfig entry for failover.
 */
export function expandMultiKeyModels(models: ModelConfig[]): ModelConfig[] {
	const expanded: ModelConfig[] = [];

	for (const model of models) {
		if (!model._apiKeys || model._apiKeys.length <= 1) {
			// Single key - no expansion needed
			expanded.push(model);
			continue;
		}

		// Expand each key into its own model config
		for (const apiKey of model._apiKeys) {
			const expandedModel: ModelConfig = {
				...model,
				_apiKeys: [apiKey],
				// Add key index to name for disambiguation
				name:
					model._apiKeys.length > 1
						? `${model.name} [${model._apiKeys.indexOf(apiKey) + 1}]`
						: model.name
			};
			expanded.push(expandedModel);
		}
	}

	// Sort: primary models first, then fallbacks
	return sortByPriority(expanded, models);
}

/**
 * Sort expanded models by priority (primary first, then fallbacks).
 */
function sortByPriority(expanded: ModelConfig[], original: ModelConfig[]): ModelConfig[] {
	const result: ModelConfig[] = [];
	const seen = new Set<string>();

	// First add all primary models
	for (const model of original) {
		const primaryExpanded = expanded.filter(
			(m) => m.provider === model.provider && m.model === model.model && !seen.has(m.name)
		);
		for (const m of primaryExpanded) {
			result.push(m);
			seen.add(m.name);
		}
	}

	// Then add any remaining models not yet added
	for (const m of expanded) {
		if (!seen.has(m.name)) {
			result.push(m);
			seen.add(m.name);
		}
	}

	return result;
}

// =============================================================================
// Provider Implementations
// =============================================================================

async function createAnthropicProvider(
	apiKey: string,
	apiBase: string | undefined,
	model: string,
	options: Record<string, unknown>
): Promise<LanguageModelV3> {
	try {
		const { createAnthropic } = await import('@ai-sdk/anthropic');
		const anthropic = createAnthropic({ apiKey, baseURL: apiBase });
		return anthropic(model);
	} catch {
		// Fallback to HTTP provider if AI SDK not available
		return createHTTPProvider(
			apiKey,
			apiBase || PROTOCOL_DEFAULTS['anthropic'] || '',
			model,
			options
		);
	}
}

async function createOpenAIProvider(
	apiKey: string,
	apiBase: string | undefined,
	model: string,
	options: Record<string, unknown>
): Promise<LanguageModelV3> {
	try {
		const { createOpenAI } = await import('@ai-sdk/openai');
		const openai = createOpenAI({ apiKey, baseURL: apiBase });
		return openai(model);
	} catch {
		return createHTTPProvider(apiKey, apiBase || PROTOCOL_DEFAULTS['openai'] || '', model, options);
	}
}

async function createGoogleProvider(
	apiKey: string,
	apiBase: string | undefined,
	model: string,
	_options: Record<string, unknown>
): Promise<LanguageModelV3> {
	// Note: @ai-sdk/google is not installed, use HTTP provider directly
	// Google AI API is compatible with OpenAI's format
	return createHTTPProvider(apiKey, apiBase || PROTOCOL_DEFAULTS['google'] || '', model, _options);
}

async function createMinimaxProvider(
	apiKey: string,
	apiBase: string | undefined,
	model: string,
	options: Record<string, unknown>
): Promise<LanguageModelV3> {
	// Determine which endpoint to use based on baseUrl
	const baseUrl = apiBase ?? PROTOCOL_DEFAULTS.minimax ?? 'https://api.minimaxi.com/v1';

	// Check if using Anthropic-compatible endpoint
	const isAnthropicEndpoint = baseUrl.includes('/anthropic');

	if (isAnthropicEndpoint) {
		// Use @ai-sdk/anthropic for Anthropic-compatible API
		// MiniMax's Anthropic endpoint is compatible with the Anthropic SDK
		return createMinimaxAnthropicProvider(apiKey, baseUrl, model, options);
	}

	// Use OpenAI-compatible /v1/chat/completions endpoint
	// IMPORTANT: MiniMax does NOT support the /v1/responses endpoint (OpenAI Responses API).
	// It only supports /v1/chat/completions. @ai-sdk/openai uses Responses API by default,
	// so we MUST use createHTTPProvider directly to ensure /v1/chat/completions is called.
	const extraBody = {
		...((options.extraBody as Record<string, unknown>) || {}),
		reasoning_split: true
	};

	return createHTTPProvider(apiKey, baseUrl, model, {
		...options,
		extraBody
	});
}

/**
 * Create a provider for MiniMax's Anthropic-compatible endpoint.
 * Uses @ai-sdk/anthropic with custom baseURL.
 */
async function createMinimaxAnthropicProvider(
	apiKey: string,
	baseUrl: string,
	model: string,
	options: Record<string, unknown>
): Promise<LanguageModelV3> {
	try {
		const { createAnthropic } = await import('@ai-sdk/anthropic');
		// Transform baseUrl to proper Anthropic format
		// e.g., https://api.minimax.io/anthropic -> https://api.minimax.io/anthropic/v1
		const anthropicBaseUrl = baseUrl.endsWith('/anthropic') ? `${baseUrl}/v1` : baseUrl;

		const anthropic = createAnthropic({
			apiKey,
			baseURL: anthropicBaseUrl
		});
		return anthropic(model);
	} catch {
		// Fallback to HTTP provider if AI SDK not available
		return createAnthropicHTTPProvider(apiKey, baseUrl, model, options);
	}
}

/**
 * Create an HTTP-based provider for Anthropic-compatible APIs.
 */
function createAnthropicHTTPProvider(
	apiKey: string,
	baseURL: string,
	model: string,
	options: Record<string, unknown>
): LanguageModelV3 {
	const extraBody = (options.extraBody as Record<string, unknown>) || {};

	const provider = {
		modelId: model,
		provider: 'anthropic',
		metadata: {
			providerName: 'Anthropic (MiniMax)'
		},
		specificationVersion: 'v3' as const,
		supportedUrls: {},
		doGenerate: async (params: { prompt: unknown[]; tools?: unknown[] }) => {
			// Anthropic uses a different message format
			const messages = params.prompt as Array<{ role: string; content: string }>;
			const response = await fetch(`${baseURL}/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01'
				},
				body: JSON.stringify({
					model,
					messages,
					max_tokens: 1024,
					...extraBody
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			const data = (await response.json()) as Record<string, unknown>;
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(data) }],
				finishReason: 'stop' as const,
				usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
				rawCall: { prompt: params.prompt }
			};
		},
		doStream: async (params: { prompt: unknown[]; tools?: unknown[] }) => {
			const messages = params.prompt as Array<{ role: string; content: string }>;
			const response = await fetch(`${baseURL}/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01'
				},
				body: JSON.stringify({
					model,
					messages,
					max_tokens: 1024,
					stream: true,
					...extraBody
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			if (!response.body) {
				throw new Error('Response body is null - streaming not supported');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			let fullContent = '';

			const stream = new ReadableStream({
				async pull(controller) {
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							if (buffer.trim()) {
								controller.enqueue({
									type: 'finish',
									finishReason: 'stop',
									usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
									rawCall: { prompt: params.prompt }
								});
							}
							controller.close();
							return;
						}

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() || '';

						for (const line of lines) {
							const trimmed = line.trim();
							if (!trimmed || !trimmed.startsWith('data:')) continue;
							const data = trimmed.slice(5).trim();
							if (data === '[DONE]') {
								controller.close();
								return;
							}
							try {
								const parsed = JSON.parse(data);
								if (parsed.type === 'content_block_delta') {
									const text = parsed.delta?.text || '';
									if (text) {
										fullContent += text;
										controller.enqueue({
											type: 'text-delta',
											textDelta: text
										});
									}
								} else if (parsed.type === 'message_delta') {
									controller.enqueue({
										type: 'finish',
										finishReason: parsed.content_block_constrained ? 'stop' : 'unknown',
										usage: {
											inputTokens: parsed.usage?.input_tokens || 0,
											outputTokens: parsed.usage?.output_tokens || 0,
											reasoningTokens: 0
										},
										rawCall: { prompt: params.prompt }
									});
								}
							} catch {
								// Skip malformed JSON
							}
						}
					}
				},
				cancel() {
					reader.cancel();
				}
			});

			return {
				stream,
				rawCall: { prompt: params.prompt }
			};
		}
	};

	return provider as unknown as LanguageModelV3;
}

/**
 * Wrap a model to inject extraBody parameters into each request.
 * This ensures extraBody is passed to both doGenerate and doStream calls.
 */
function wrapModelWithExtraBody(
	model: LanguageModelV3,
	extraBody: Record<string, unknown>
): LanguageModelV3 {
	// Cast params to allow extraBody injection
	// The AI SDK's LanguageModelV3 type doesn't expose extraBody in the public API
	// but it is passed through internally
	type ProviderParams = Parameters<typeof model.doGenerate>[0];
	type StreamParams = Parameters<typeof model.doStream>[0];

	return {
		...model,
		doGenerate: async (params: ProviderParams) => {
			return model.doGenerate({
				...params,
				extraBody: {
					...((params as { extraBody?: Record<string, unknown> }).extraBody || {}),
					...extraBody
				}
			} as ProviderParams);
		},
		doStream: async (params: StreamParams) => {
			return model.doStream({
				...params,
				extraBody: {
					...((params as { extraBody?: Record<string, unknown> }).extraBody || {}),
					...extraBody
				}
			} as StreamParams);
		}
	};
}

async function createOpenAICompatibleProvider(
	_provider: string,
	apiKey: string,
	apiBase: string | undefined,
	model: string,
	options: Record<string, unknown>
): Promise<LanguageModelV3> {
	try {
		const { createOpenAI } = await import('@ai-sdk/openai');
		const openai = createOpenAI({ apiKey, baseURL: apiBase });
		return openai(model);
	} catch {
		return createHTTPProvider(apiKey, apiBase || '', model, options);
	}
}

/**
 * Create an HTTP-based provider for OpenAI-compatible APIs.
 * This is a fallback when AI SDK provider packages aren't available.
 */
function createHTTPProvider(
	apiKey: string,
	baseURL: string,
	model: string,
	options: Record<string, unknown>
): LanguageModelV3 {
	const extraBody = (options.extraBody as Record<string, unknown>) || {};

	const provider = {
		modelId: model,
		provider: 'http',
		metadata: {
			providerName: 'HTTP'
		},
		specificationVersion: 'v3' as const,
		supportedUrls: {},
		doGenerate: async (params: { prompt: unknown[]; tools?: unknown[] }) => {
			const response = await fetch(`${baseURL}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
				},
				body: JSON.stringify({
					model,
					messages: params.prompt,
					...(params.tools ? { tools: params.tools } : {}),
					...extraBody
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			const data = (await response.json()) as Record<string, unknown>;
			return {
				content: [{ type: 'text' as const, text: JSON.stringify(data) }],
				finishReason: 'stop' as const,
				usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
				rawCall: { prompt: params.prompt }
			};
		},
		doStream: async (params: { prompt: unknown[]; tools?: unknown[] }) => {
			const response = await fetch(`${baseURL}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
				},
				body: JSON.stringify({
					model,
					messages: params.prompt,
					...(params.tools ? { tools: params.tools } : {}),
					stream: true,
					...extraBody
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			if (!response.body) {
				throw new Error('Response body is null - streaming not supported');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			let fullContent = '';
			let inputTokens = 0;
			let outputTokens = 0;

			const stream = new ReadableStream({
				async pull(controller) {
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							if (buffer.trim()) {
								controller.enqueue({
									type: 'finish',
									finishReason: 'stop',
									usage: { inputTokens, outputTokens, reasoningTokens: 0 },
									rawCall: { prompt: params.prompt }
								});
							}
							controller.close();
							return;
						}

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() || '';

						for (const line of lines) {
							const trimmed = line.trim();
							if (!trimmed || !trimmed.startsWith('data:')) continue;
							const data = trimmed.slice(5).trim();
							if (data === '[DONE]') {
								controller.close();
								return;
							}
							try {
								const parsed = JSON.parse(data);
								const choice = parsed.choices?.[0];
								if (choice?.delta?.content) {
									fullContent += choice.delta.content;
									controller.enqueue({
										type: 'text-delta',
										textDelta: choice.delta.content
									});
								}
								if (parsed.usage) {
									inputTokens = parsed.usage.prompt_tokens || 0;
									outputTokens = parsed.usage.completion_tokens || 0;
								}
							} catch {
								// Skip malformed JSON
							}
						}
					}
				},
				cancel() {
					reader.cancel();
				}
			});

			return {
				stream,
				rawCall: { prompt: params.prompt }
			};
		}
	};

	return provider as unknown as LanguageModelV3;
}

// =============================================================================
// Thinking Budget Helper
// =============================================================================

/**
 * Get thinking budget in tokens based on thinking level.
 */
function getThinkingBudget(level: ThinkingLevel): number {
	switch (level) {
		case 'off':
			return TOKEN.THINKING_BUDGET_OFF;
		case 'minimal':
			return TOKEN.THINKING_BUDGET_MINIMAL;
		case 'low':
			return TOKEN.THINKING_BUDGET_LOW;
		case 'medium':
			return TOKEN.THINKING_BUDGET_MEDIUM;
		case 'high':
			return TOKEN.THINKING_BUDGET_HIGH;
		default:
			return TOKEN.THINKING_BUDGET_MEDIUM;
	}
}

// =============================================================================
// Model Config Helpers
// =============================================================================

/**
 * Extract protocol prefix and model identifier from a model string.
 *
 * Examples:
 * - "openai/gpt-4o" -> ("openai", "gpt-4o")
 * - "anthropic/claude-sonnet-4.6" -> ("anthropic", "claude-sonnet-4.6")
 * - "gpt-4o" -> ("openai", "gpt-4o")
 */
export function extractProtocol(model: string): { protocol: string; modelId: string } {
	const trimmed = model.trim();
	const slashIndex = trimmed.indexOf('/');

	if (slashIndex === -1) {
		return { protocol: 'openai', modelId: trimmed };
	}

	return {
		protocol: trimmed.substring(0, slashIndex),
		modelId: trimmed.substring(slashIndex + 1)
	};
}

/**
 * Create a ModelConfig from a simple model string.
 * Uses protocol prefix or defaults to openai.
 */
export function modelConfigFromString(modelString: string, apiKeys?: string[]): ModelConfig {
	const { protocol, modelId } = extractProtocol(modelString);
	const provider = mapProvider(protocol);

	return {
		name: modelId,
		provider,
		model: modelString,
		apiBase: PROTOCOL_DEFAULTS[provider],
		_apiKeys: apiKeys ?? []
	};
}

/**
 * Validate a model configuration.
 */
export function validateModelConfig(config: ModelConfig): string[] {
	const errors: string[] = [];

	if (!config.name) {
		errors.push('Model name is required');
	}

	if (!config.provider) {
		errors.push('Provider is required');
	}

	if (!config.model) {
		errors.push('Model identifier is required');
	}

	if (!config._apiKeys || config._apiKeys.length === 0) {
		errors.push('At least one API key is required');
	}

	return errors;
}

// =============================================================================
// Provider Creation Helpers
// =============================================================================

/**
 * Create a provider configuration from environment variables.
 */
export function createProviderConfigFromEnv(
	provider: LlmProvider,
	modelName: string
): ProviderConfig {
	const envKeyMap: Partial<Record<LlmProvider, string>> = {
		openai: process.env.OPENAI_API_KEY,
		anthropic: process.env.ANTHROPIC_API_KEY,
		openrouter: process.env.OPENROUTER_API_KEY,
		groq: process.env.GROQ_API_KEY,
		deepseek: process.env.DEEPSEEK_API_KEY,
		google: process.env.GOOGLE_API_KEY,
		mistral: process.env.MISTRAL_API_KEY,
		moonshot: process.env.MOONSHOT_API_KEY,
		xai: process.env.XAI_API_KEY,
		minimax: process.env.MINIMAX_API_KEY,
		'minimax-coding': process.env.MINIMAX_API_KEY,
		ollama: process.env.OLLAMA_API_KEY,
		zai: process.env.ZAI_API_KEY
	};

	const apiKey = envKeyMap[provider];
	const apiKeys = apiKey ? [apiKey] : undefined;

	return {
		provider,
		modelName,
		apiKeys
	};
}

/**
 * Get all available API keys for a provider from environment.
 */
export function getProviderApiKeys(provider: LlmProvider): string[] {
	const envVar = `${provider.toUpperCase()}_API_KEY`;
	const value = process.env[envVar];

	if (!value) return [];

	// Support comma-separated keys for multi-key failover
	return value
		.split(',')
		.map((k) => k.trim())
		.filter(Boolean);
}
