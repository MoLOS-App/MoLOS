import { describe, it, expect } from 'vitest';
import { createProvider, mapProvider, getProviderOptions } from './factory';
import type { LlmProvider } from '../types';

describe('Provider Factory', () => {
	describe('mapProvider', () => {
		it('should map provider strings to LlmProvider type', () => {
			expect(mapProvider('openai')).toBe('openai');
			expect(mapProvider('anthropic')).toBe('anthropic');
			expect(mapProvider('ollama')).toBe('ollama');
			expect(mapProvider('openrouter')).toBe('openrouter');
			expect(mapProvider('zai')).toBe('zai');
		});

		it('should default to openai for unknown providers', () => {
			expect(mapProvider('unknown')).toBe('openai');
			expect(mapProvider('')).toBe('openai');
			expect(mapProvider('claude')).toBe('openai');
		});
	});

	describe('createProvider', () => {
		it('should create Anthropic provider', () => {
			const model = createProvider({
				provider: 'anthropic',
				modelName: 'claude-3-opus-20240229'
			});

			expect(model).toBeDefined();
			expect(model.modelId).toBe('claude-3-opus-20240229');
		});

		it('should create OpenAI provider', () => {
			const model = createProvider({
				provider: 'openai',
				modelName: 'gpt-4o'
			});

			expect(model).toBeDefined();
			expect(model.modelId).toBe('gpt-4o');
		});

		it('should create OpenRouter provider with API key', () => {
			const model = createProvider({
				provider: 'openrouter',
				modelName: 'anthropic/claude-3-opus',
				apiKey: 'test-key'
			});

			expect(model).toBeDefined();
			expect(model.modelId).toBe('anthropic/claude-3-opus');
		});

		it('should create Ollama provider with default URL', () => {
			const model = createProvider({
				provider: 'ollama',
				modelName: 'llama2'
			});

			expect(model).toBeDefined();
			expect(model.modelId).toBe('llama2');
		});

		it('should create Ollama provider with custom URL', () => {
			const model = createProvider({
				provider: 'ollama',
				modelName: 'llama2',
				baseUrl: 'http://custom-ollama:11434/v1'
			});

			expect(model).toBeDefined();
			expect(model.modelId).toBe('llama2');
		});

		it('should create Zai provider with API key', () => {
			const model = createProvider({
				provider: 'zai',
				modelName: 'glm-4',
				apiKey: 'test-key'
			});

			expect(model).toBeDefined();
			expect(model.modelId).toBe('glm-4');
		});

		it('should create Zai provider with custom base URL', () => {
			const model = createProvider({
				provider: 'zai',
				modelName: 'glm-4',
				apiKey: 'test-key',
				baseUrl: 'https://custom.zai.api/v1'
			});

			expect(model).toBeDefined();
			expect(model.modelId).toBe('glm-4');
		});

		it('should throw for unsupported provider', () => {
			expect(() =>
				createProvider({
					provider: 'unsupported' as LlmProvider,
					modelName: 'test'
				})
			).toThrow('Unsupported provider: unsupported');
		});
	});

	describe('getProviderOptions', () => {
		it('should return common options', () => {
			const options = getProviderOptions('openai', {
				maxTokens: 1000,
				temperature: 0.7,
				topP: 0.9
			});

			expect(options.maxTokens).toBe(1000);
			expect(options.temperature).toBe(0.7);
			expect(options.topP).toBe(0.9);
		});

		it('should not include undefined options', () => {
			const options = getProviderOptions('openai', {
				maxTokens: 1000
			});

			expect(options.maxTokens).toBe(1000);
			expect(options.temperature).toBeUndefined();
			expect(options.topP).toBeUndefined();
		});

		it('should add Anthropic thinking options when thinkingLevel is set', () => {
			const options = getProviderOptions('anthropic', {
				thinkingLevel: 'medium'
			});

			expect(options.providerOptions).toBeDefined();
			expect((options.providerOptions as any).anthropic.thinking.type).toBe('enabled');
			expect((options.providerOptions as any).anthropic.thinking.budgetTokens).toBe(4096);
		});

		it('should not add thinking options when thinkingLevel is off', () => {
			const options = getProviderOptions('anthropic', {
				thinkingLevel: 'off'
			});

			expect(options.providerOptions).toBeUndefined();
		});

		it('should map thinking levels to correct token budgets', () => {
			const levels: Array<{ level: 'off' | 'minimal' | 'low' | 'medium' | 'high'; budget: number }> = [
				{ level: 'minimal', budget: 1024 },
				{ level: 'low', budget: 2048 },
				{ level: 'medium', budget: 4096 },
				{ level: 'high', budget: 8192 }
			];

			for (const { level, budget } of levels) {
				const options = getProviderOptions('anthropic', { thinkingLevel: level });
				expect((options.providerOptions as any).anthropic.thinking.budgetTokens).toBe(budget);
			}
		});

		it('should not add thinking options for non-Anthropic providers', () => {
			const options = getProviderOptions('openai', {
				thinkingLevel: 'high'
			});

			expect(options.providerOptions).toBeUndefined();
		});

		it('should handle empty options', () => {
			const options = getProviderOptions('openai', {});

			expect(Object.keys(options)).toHaveLength(0);
		});

		it('should combine common and provider-specific options', () => {
			const options = getProviderOptions('anthropic', {
				thinkingLevel: 'low',
				temperature: 0.5,
				maxTokens: 2000
			});

			expect(options.maxTokens).toBe(2000);
			expect(options.temperature).toBe(0.5);
			expect(options.providerOptions).toBeDefined();
		});
	});
});
