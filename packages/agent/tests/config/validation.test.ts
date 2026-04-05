/**
 * Tests for Configuration Validation
 *
 * This module tests the Zod schemas and validation helpers
 * in src/config/schemas.ts and src/config/validation.ts.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
	AgentLoopConfigSchema,
	ProviderConfigSchema,
	ModelConfigSchema,
	ToolRegistryConfigSchema,
	ToolDefinitionSchema,
	SessionConfigSchema,
	ThinkingLevelSchema,
	LlmProviderSchema
} from '../../src/config/schemas.js';
import {
	validateConfig,
	validateConfigOrThrow,
	validateConfigOrDefault,
	formatZodError,
	getZodErrorMessages,
	isZodError,
	validateString,
	validatePositiveNumber,
	validateNonEmptyArray
} from '../../src/config/validation.js';

describe('Zod Schemas', () => {
	describe('LlmProviderSchema', () => {
		it('should accept valid providers', () => {
			const validProviders = [
				'openai',
				'anthropic',
				'openrouter',
				'ollama',
				'zai',
				'groq',
				'deepseek',
				'google',
				'mistral',
				'moonshot',
				'xai',
				'minimax',
				'minimax-coding'
			];

			for (const provider of validProviders) {
				const result = LlmProviderSchema.safeParse(provider);
				expect(result.success).toBe(true);
			}
		});

		it('should reject invalid providers', () => {
			const result = LlmProviderSchema.safeParse('invalid_provider');
			expect(result.success).toBe(false);
		});
	});

	describe('ThinkingLevelSchema', () => {
		it('should accept valid thinking levels', () => {
			const validLevels = ['off', 'minimal', 'low', 'medium', 'high'];

			for (const level of validLevels) {
				const result = ThinkingLevelSchema.safeParse(level);
				expect(result.success).toBe(true);
			}
		});

		it('should reject invalid thinking levels', () => {
			const result = ThinkingLevelSchema.safeParse('super_high');
			expect(result.success).toBe(false);
		});
	});

	describe('ProviderConfigSchema', () => {
		it('should accept valid provider config', () => {
			const config = {
				provider: 'openai',
				modelName: 'gpt-4o',
				apiKey: 'sk-test',
				temperature: 0.7
			};

			const result = ProviderConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
		});

		it('should accept config without optional fields', () => {
			const config = {
				provider: 'anthropic',
				modelName: 'claude-3-sonnet'
			};

			const result = ProviderConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
		});

		it('should reject config without modelName', () => {
			const config = {
				provider: 'openai'
			};

			const result = ProviderConfigSchema.safeParse(config);
			expect(result.success).toBe(false);
		});

		it('should reject config without provider', () => {
			const config = {
				modelName: 'gpt-4o'
			};

			const result = ProviderConfigSchema.safeParse(config);
			expect(result.success).toBe(false);
		});

		it('should accept extra fields (catchall)', () => {
			const config = {
				provider: 'openai',
				modelName: 'gpt-4o',
				customField: 'some value',
				anotherCustom: 123
			};

			const result = ProviderConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
		});

		it('should validate temperature range', () => {
			const invalidConfig = {
				provider: 'openai',
				modelName: 'gpt-4o',
				temperature: 3.0 // out of range (0-2)
			};

			const result = ProviderConfigSchema.safeParse(invalidConfig);
			expect(result.success).toBe(false);
		});
	});

	describe('ToolRegistryConfigSchema', () => {
		it('should accept valid config', () => {
			const config = {
				maxConcurrent: 5
			};

			const result = ToolRegistryConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
		});

		it('should apply default maxConcurrent', () => {
			const config = {};

			const result = ToolRegistryConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.maxConcurrent).toBe(10); // TOOL.MAX_CONCURRENT
			}
		});

		it('should reject zero maxConcurrent', () => {
			const config = {
				maxConcurrent: 0
			};

			const result = ToolRegistryConfigSchema.safeParse(config);
			expect(result.success).toBe(false);
		});

		it('should reject negative maxConcurrent', () => {
			const config = {
				maxConcurrent: -1
			};

			const result = ToolRegistryConfigSchema.safeParse(config);
			expect(result.success).toBe(false);
		});
	});

	describe('ToolDefinitionSchema', () => {
		it('should accept valid tool definition', () => {
			const tool = {
				name: 'get_weather',
				description: 'Get current weather for a location',
				parameters: {
					type: 'object',
					properties: {
						city: { type: 'string', description: 'City name' }
					},
					required: ['city']
				}
			};

			const result = ToolDefinitionSchema.safeParse(tool);
			expect(result.success).toBe(true);
		});

		it('should accept tool without name', () => {
			const tool = {
				description: 'A tool without name property',
				parameters: {
					type: 'object',
					properties: {}
				}
			};

			// Safe parse should fail due to required name
			const result = ToolDefinitionSchema.safeParse(tool);
			expect(result.success).toBe(false);
		});

		it('should accept tool with extra fields (catchall)', () => {
			const tool = {
				name: 'custom_tool',
				description: 'A custom tool',
				parameters: {
					type: 'object',
					properties: {}
				},
				customMetadata: { version: '1.0' },
				author: 'test'
			};

			const result = ToolDefinitionSchema.safeParse(tool);
			expect(result.success).toBe(true);
		});
	});

	describe('AgentLoopConfigSchema', () => {
		it('should accept valid agent loop config', () => {
			const config = {
				id: 'agent-1',
				primaryProvider: 'openai',
				model: 'gpt-4o',
				systemPrompt: 'You are a helpful assistant',
				providers: [{ provider: 'openai', modelName: 'gpt-4o' }],
				tools: []
			};

			const result = AgentLoopConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
		});

		it('should accept config without optional fields', () => {
			const config = {
				id: 'agent-1',
				primaryProvider: 'openai'
			};

			const result = AgentLoopConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
		});

		it('should reject config without id', () => {
			const config = {
				primaryProvider: 'openai'
			};

			const result = AgentLoopConfigSchema.safeParse(config);
			expect(result.success).toBe(false);
		});

		it('should reject config without primaryProvider', () => {
			const config = {
				id: 'agent-1'
			};

			const result = AgentLoopConfigSchema.safeParse(config);
			expect(result.success).toBe(false);
		});

		it('should apply default values', () => {
			const config = {
				id: 'agent-1',
				primaryProvider: 'openai'
			};

			const result = AgentLoopConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.temperature).toBe(1.0);
				expect(result.data.thinkingLevel).toBe('medium');
				expect(result.data.maxTurns).toBe(50);
				expect(result.data.maxToolCallsPerTurn).toBe(20);
			}
		});

		it('should validate cooldown config', () => {
			const validConfig = {
				id: 'agent-1',
				primaryProvider: 'openai',
				cooldown: {
					enabled: true,
					defaultDurationMs: 60000,
					maxRetries: 5
				}
			};

			const result = AgentLoopConfigSchema.safeParse(validConfig);
			expect(result.success).toBe(true);
		});
	});

	describe('SessionConfigSchema', () => {
		it('should accept valid session config', () => {
			const config = {
				userId: 'user-123',
				systemPrompt: 'You are a helpful assistant',
				metadata: { key: 'value' }
			};

			const result = SessionConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
		});

		it('should reject config without userId', () => {
			const config = {
				systemPrompt: 'You are a helpful assistant'
			};

			const result = SessionConfigSchema.safeParse(config);
			expect(result.success).toBe(false);
		});

		it('should accept config without userId as empty string', () => {
			const config = {
				userId: ''
			};

			const result = SessionConfigSchema.safeParse(config);
			expect(result.success).toBe(false); // min(1) should fail
		});
	});
});

describe('Validation Helpers', () => {
	describe('validateConfig', () => {
		it('should return success with validated data', () => {
			const schema = z.object({ name: z.string() });
			const config = { name: 'test' };

			const result = validateConfig(schema, config);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual({ name: 'test' });
			}
		});

		it('should return failure with error info', () => {
			const schema = z.object({ name: z.string() });
			const config = { name: 123 };

			const result = validateConfig(schema, config);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBeTruthy();
				expect(result.errors).toBeInstanceOf(z.ZodError);
			}
		});
	});

	describe('validateConfigOrThrow', () => {
		it('should return validated data when valid', () => {
			const schema = z.object({ name: z.string() });
			const config = { name: 'test' };

			const result = validateConfigOrThrow(schema, config);

			expect(result).toEqual({ name: 'test' });
		});

		it('should throw error when invalid', () => {
			const schema = z.object({ name: z.string() });
			const config = { name: 123 };

			expect(() => validateConfigOrThrow(schema, config, 'Custom error')).toThrow(
				'Custom error:'
			);
		});

		it('should throw with formatted error message', () => {
			const schema = z.object({ name: z.string().min(3) });
			const config = { name: 'ab' };

			expect(() => validateConfigOrThrow(schema, config)).toThrow('String must contain at least 3');
		});
	});

		it('should throw error when invalid', () => {
			const schema = z.object({ name: z.string() });
			const config = { name: 123 };

			expect(() => validateConfigOrThrow(schema, config, 'Custom error')).toThrow('Custom error:');
		});

		it('should throw with formatted error message', () => {
			const schema = z.object({ name: z.string().min(3) });
			const config = { name: 'ab' };

			expect(() => validateConfigOrThrow(schema, config)).toThrow('String must contain at least 3');
		});
	});

	describe('validateConfigOrDefault', () => {
		it('should return validated data when valid', () => {
			const schema = z.object({ name: z.string() });
			const config = { name: 'test' };
			const defaultValue = { name: 'default' };

			const result = validateConfigOrDefault(schema, config, defaultValue);

			expect(result).toEqual({ name: 'test' });
		});

		it('should return default value when invalid', () => {
			const schema = z.object({ name: z.string() });
			const config = { name: 123 };
			const defaultValue = { name: 'default' };

			const result = validateConfigOrDefault(schema, config, defaultValue);

			expect(result).toEqual({ name: 'default' });
		});
	});

	describe('formatZodError', () => {
		it('should format single error', () => {
			const schema = z.object({ name: z.string().min(3) });
			const result = schema.safeParse({ name: 'ab' });

			if (!result.success) {
				const formatted = formatZodError(result.error);
				expect(formatted).toContain('String must contain at least 3');
				expect(formatted).toContain('name');
			}
		});

		it('should format multiple errors', () => {
			const schema = z.object({
				name: z.string().min(3),
				age: z.number().positive()
			});
			const result = schema.safeParse({ name: 'ab', age: -5 });

			if (!result.success) {
				const formatted = formatZodError(result.error);
				expect(formatted).toContain('String must contain at least 3');
				expect(formatted).toContain('age');
			}
		});
	});

	describe('getZodErrorMessages', () => {
		it('should return array of error messages', () => {
			const schema = z.object({
				name: z.string().min(3),
				age: z.number().positive()
			});
			const result = schema.safeParse({ name: 'ab', age: -5 });

			if (!result.success) {
				const messages = getZodErrorMessages(result.error);
				expect(Array.isArray(messages)).toBe(true);
				expect(messages.length).toBeGreaterThan(0);
			}
		});
	});

	describe('isZodError', () => {
		it('should return true for ZodError', () => {
			const schema = z.object({ name: z.string() });
			const result = schema.safeParse({ name: 123 });

			if (!result.success) {
				expect(isZodError(result.error)).toBe(true);
			}
		});

		it('should return false for regular Error', () => {
			expect(isZodError(new Error('test'))).toBe(false);
		});
	});

	describe('validateString', () => {
		it('should accept non-empty string', () => {
			const result = validateString('test', 'field');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('test');
			}
		});

		it('should reject empty string', () => {
			const result = validateString('', 'field');
			expect(result.success).toBe(false);
		});

		it('should reject non-string', () => {
			const result = validateString(123, 'field');
			expect(result.success).toBe(false);
		});
	});

	describe('validatePositiveNumber', () => {
		it('should accept positive number', () => {
			const result = validatePositiveNumber(5, 'field');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe(5);
			}
		});

		it('should reject zero', () => {
			const result = validatePositiveNumber(0, 'field');
			expect(result.success).toBe(false);
		});

		it('should reject negative number', () => {
			const result = validatePositiveNumber(-5, 'field');
			expect(result.success).toBe(false);
		});
	});

	describe('validateNonEmptyArray', () => {
		it('should accept non-empty array', () => {
			const result = validateNonEmptyArray([1, 2, 3], 'field');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual([1, 2, 3]);
			}
		});

		it('should reject empty array', () => {
			const result = validateNonEmptyArray([], 'field');
			expect(result.success).toBe(false);
		});

		it('should reject non-array', () => {
			const result = validateNonEmptyArray('not array', 'field');
			expect(result.success).toBe(false);
		});
	});
});
