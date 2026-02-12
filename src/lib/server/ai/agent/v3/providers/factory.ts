/**
 * Provider Factory for AI SDK
 *
 * Creates AI SDK provider instances based on configuration.
 * Supports: Anthropic, OpenAI, OpenRouter, Ollama, Zai
 */

import { anthropic } from '@ai-sdk/anthropic';
import { openai, createOpenAI } from '@ai-sdk/openai';
import type { LlmProvider, ProviderConfig } from '../types';

/**
 * Create an AI SDK language model instance based on provider configuration
 */
export function createProvider(config: ProviderConfig) {
	switch (config.provider) {
		case 'anthropic':
			return anthropic(config.modelName);

		case 'openai':
			return openai(config.modelName);

		case 'openrouter':
			return createOpenAI({
				name: 'openrouter',
				baseURL: 'https://openrouter.ai/api/v1',
				apiKey: config.apiKey,
			})(config.modelName);

		case 'ollama':
			return createOpenAI({
				name: 'ollama',
				baseURL: config.baseUrl || 'http://localhost:11434/v1',
				apiKey: 'ollama', // Ollama doesn't need a real API key
			})(config.modelName);

		case 'zai':
			return createOpenAI({
				name: 'zai',
				baseURL: config.baseUrl || 'https://api.z.ai/api/coding/paas/v4',
				apiKey: config.apiKey,
			})(config.modelName);

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
		zai: 'zai',
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
			high: 8192,
		};

		const budget = thinkingBudgets[options.thinkingLevel] || 0;
		if (budget > 0) {
			// Use providerOptions for Anthropic-specific settings
			result.providerOptions = {
				anthropic: {
					thinking: {
						type: 'enabled',
						budgetTokens: budget,
					},
				},
			};
		}
	}

	return result;
}
