/**
 * Provider Factory for AI SDK
 *
 * Creates AI SDK provider instances based on configuration.
 * Supports: Anthropic, OpenAI, OpenRouter, Ollama, Zai
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LlmProvider, ProviderConfig } from '../types';

// ============================================================================
// DEBUG: HTTP Request Interceptor for 431 Error Investigation
// ============================================================================

/**
 * Calculate exact HTTP header size for a request
 * This helps identify if we're exceeding the 8KB (8192 byte) HTTP header limit
 */
function calculateHeaderSize(headers: Record<string, string | string[]>): number {
	let size = 0;
	for (const [key, value] of Object.entries(headers)) {
		const valueStr = Array.isArray(value) ? value.join(', ') : value;
		// Format: "Key: Value\r\n"
		size += key.length + valueStr.length + 4;
	}
	return size;
}

/**
 * Create a logging fetch wrapper that intercepts all HTTP requests
 * and logs detailed header information
 */
function createLoggingFetch(originalFetch: typeof fetch): typeof fetch {
	return async (url, options) => {
		const headers = (options?.headers as Record<string, string | string[]>) || {};

		console.log('\n[AI Agent HTTP Debug] === FETCH INFO ===');
		console.log('[AI Agent HTTP Debug] URL:', typeof url === 'string' ? url : url.url);
		console.log('[AI Agent HTTP Debug] Method:', options?.method || 'GET');

		// Log all headers
		console.log('[AI Agent HTTP Debug] Headers:');
		const headerEntries: Array<[string, string]> = [];
		for (const [key, value] of Object.entries(headers)) {
			const valueStr = Array.isArray(value) ? value.join(', ') : value;
			headerEntries.push([key, valueStr]);
			// Truncate very long values for readability
			const displayValue = valueStr.length > 100 ? valueStr.substring(0, 100) + '...' : valueStr;
			console.log(`  ${key}: ${displayValue}`);
		}

		// Calculate and log header size
		const headerSize = calculateHeaderSize(headers);
		console.log('[AI Agent HTTP Debug] Total header size:', headerSize, 'bytes');
		console.log('[AI Agent HTTP Debug] HTTP header limit: 8192 bytes (8KB)');
		console.log('[AI Agent HTTP Debug] Over limit?', headerSize > 8192 ? 'YES - ERROR!' : 'No');
		console.log(
			'[AI Agent HTTP Debug] Buffer to limit (8192 -',
			headerSize,
			') =',
			8192 - headerSize,
			'bytes'
		);

		// Log body size if present
		if (options?.body) {
			const bodySize =
				typeof options.body === 'string'
					? options.body.length
					: JSON.stringify(options.body).length;
			console.log('[AI Agent HTTP Debug] Body size:', bodySize, 'bytes');
			console.log('[AI Agent HTTP Debug] Total request size:', headerSize + bodySize, 'bytes');
		}

		// Check User-Agent specifically (often a culprit for header bloat)
		const userAgent = headers['user-agent'];
		if (userAgent) {
			const ua = Array.isArray(userAgent) ? userAgent.join(' ') : userAgent;
			console.log('[AI Agent HTTP Debug] User-Agent length:', ua.length, 'chars');
			console.log('[AI Agent HTTP Debug] User-Agent:', ua);
		}

		// Check Authorization header size
		const auth = headers['authorization'];
		if (auth) {
			const authStr = Array.isArray(auth) ? auth[0] : auth;
			console.log('[AI Agent HTTP Debug] Authorization type:', authStr.substring(0, 15) + '...');
			console.log('[AI Agent HTTP Debug] Authorization length:', authStr.length, 'chars');
		}

		console.log('[AI Agent HTTP Debug] ===========================\n');

		// Make the actual request
		const response = await originalFetch(url, options);

		// Log response status
		console.log('[AI Agent HTTP Debug] Response status:', response.status, response.statusText);
		if (response.status === 431) {
			console.error('[AI Agent HTTP Debug] ⚠️ 431 Error: Request Header Fields Too Large!');
			console.error('[AI Agent HTTP Debug] Header size was:', headerSize, 'bytes');
		}

		return response;
	};
}

// Create the logging fetch wrapper
const loggingFetch = createLoggingFetch(fetch);

// ============================================================================

/**
 * Create an AI SDK language model instance based on provider configuration
 */
export function createProvider(config: ProviderConfig) {
	// Common fetch options for all providers
	const fetchOptions = {
		fetch: loggingFetch // Use our logging fetch wrapper
	};

	switch (config.provider) {
		case 'anthropic':
			if (!config.apiKey) {
				throw new Error('API key is required for Anthropic provider');
			}
			return createAnthropic({
				apiKey: config.apiKey,
				...fetchOptions
			})(config.modelName);

		case 'openai':
			if (!config.apiKey) {
				throw new Error('API key is required for OpenAI provider');
			}
			return createOpenAI({
				apiKey: config.apiKey,
				...fetchOptions
			}).chat(config.modelName);

		case 'openrouter':
			return createOpenAI({
				name: 'openrouter',
				baseURL: 'https://openrouter.ai/api/v1',
				apiKey: config.apiKey,
				...fetchOptions
			}).chat(config.modelName);

		case 'ollama':
			return createOpenAI({
				name: 'ollama',
				baseURL: config.baseUrl || 'http://localhost:11434/v1',
				apiKey: 'ollama', // Ollama doesn't need a real API key
				...fetchOptions
			}).chat(config.modelName);

		case 'zai':
			return createOpenAI({
				name: 'zai',
				baseURL: config.baseUrl || 'https://api.z.ai/api/coding/paas/v4',
				apiKey: config.apiKey,
				...fetchOptions
			}).chat(config.modelName);

		default:
			throw new Error(`Unsupported provider: ${config.provider}`);
	}
}

/**
 * Map provider string to LlmProvider type
 */
export function mapProvider(provider: string): LlmProvider {
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
 * Get provider-specific options for AI SDK calls
 */
export function getProviderOptions(
	provider: LlmProvider,
	options: {
		thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high';
		temperature?: number;
		topP?: number;
		maxTokens?: number;
	}
): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	// Common options
	if (options.maxTokens !== undefined) {
		result.maxTokens = options.maxTokens;
	}
	if (options.temperature !== undefined) {
		result.temperature = options.temperature;
	}
	if (options.topP !== undefined) {
		result.topP = options.topP;
	}

	// Provider-specific options
	if (provider === 'anthropic' && options.thinkingLevel) {
		// Map thinking levels to token budgets
		const thinkingBudgets: Record<string, number> = {
			off: 0,
			minimal: 1024,
			low: 2048,
			medium: 4096,
			high: 8192
		};

		const budget = thinkingBudgets[options.thinkingLevel] || 0;
		if (budget > 0) {
			// Use providerOptions for Anthropic-specific settings
			result.providerOptions = {
				anthropic: {
					thinking: {
						type: 'enabled',
						budgetTokens: budget
					}
				}
			};
		}
	}

	return result;
}
