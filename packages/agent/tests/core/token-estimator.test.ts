/**
 * Tests for Token Estimator
 */

import { describe, it, expect } from 'vitest';
import {
	tokenEstimator,
	estimateMessageTokens,
	estimateToolDefsTokens,
	isOverContextBudget,
	estimateMediaTokens
} from '../../src/core/token-estimator';
import type { AgentMessage, ToolDefinition } from '../../src/types/index.js';

describe('tokenEstimator', () => {
	describe('estimateMessageTokens', () => {
		it('should estimate string content correctly', () => {
			const msg: AgentMessage = { role: 'user', content: 'Hello world' };
			const tokens = estimateMessageTokens(msg);
			// 'Hello world' = 11 chars + 12 overhead = 23 / 2.5 = 9.2 -> ceil = 10
			expect(tokens).toBeGreaterThan(0);
			expect(tokens).toBeLessThan(20);
		});

		it('should estimate empty string correctly', () => {
			const msg: AgentMessage = { role: 'user', content: '' };
			const tokens = estimateMessageTokens(msg);
			// 0 chars + 12 overhead = 12 / 2.5 = 4.8 -> ceil = 5
			expect(tokens).toBe(5);
		});

		it('should handle text content blocks', () => {
			const msg: AgentMessage = {
				role: 'user',
				content: [{ type: 'text', text: 'Hello world' }]
			};
			const tokens = estimateMessageTokens(msg);
			expect(tokens).toBeGreaterThan(0);
			expect(tokens).toBeLessThan(20);
		});

		it('should handle tool_call content blocks', () => {
			const msg: AgentMessage = {
				role: 'assistant',
				content: [{ type: 'tool_call', id: 'call_123', name: 'test', input: { arg: 'value' } }]
			};
			const tokens = estimateMessageTokens(msg);
			// 'call_123' + 'test' + JSON.stringify({arg: 'value'}) + 12 overhead
			// = 8 + 4 + 16 + 12 = 40 / 2.5 = 16 -> ceil = 16
			expect(tokens).toBeGreaterThan(10);
		});

		it('should handle tool_result content blocks', () => {
			const msg: AgentMessage = {
				role: 'tool',
				content: [{ type: 'tool_result', toolCallId: 'call_123', content: 'result' }]
			};
			const tokens = estimateMessageTokens(msg);
			expect(tokens).toBeGreaterThan(5);
		});

		it('should handle mixed content blocks', () => {
			const msg: AgentMessage = {
				role: 'assistant',
				content: [
					{ type: 'text', text: 'Hello' },
					{ type: 'tool_call', id: 'call_1', name: 'test', input: {} }
				]
			};
			const tokens = estimateMessageTokens(msg);
			expect(tokens).toBeGreaterThan(5);
		});

		it('should handle system role', () => {
			const msg: AgentMessage = { role: 'system', content: 'You are a helpful assistant' };
			const tokens = estimateMessageTokens(msg);
			expect(tokens).toBeGreaterThan(0);
		});

		it('should handle assistant role', () => {
			const msg: AgentMessage = { role: 'assistant', content: 'I will help you.' };
			const tokens = estimateMessageTokens(msg);
			expect(tokens).toBeGreaterThan(0);
		});
	});

	describe('estimateToolDefsTokens', () => {
		it('should estimate empty tool definitions', () => {
			const tokens = estimateToolDefsTokens([]);
			expect(tokens).toBe(0);
		});

		it('should estimate single tool definition', () => {
			const toolDef: ToolDefinition = {
				name: 'get_weather',
				description: 'Get weather for a location',
				parameters: {
					type: 'object',
					properties: {
						location: { type: 'string', description: 'City name' }
					},
					required: ['location']
				}
			};
			const tokens = estimateToolDefsTokens([toolDef]);
			// name + description + JSON.stringify(parameters) + 20 overhead
			// = 11 + 26 + 90 + 20 = 147 / 2.5 = 58.8 -> ceil = 59
			expect(tokens).toBeGreaterThan(50);
		});

		it('should estimate multiple tool definitions', () => {
			const toolDefs: ToolDefinition[] = [
				{
					name: 'tool1',
					description: 'First tool',
					parameters: { type: 'object', properties: {} }
				},
				{
					name: 'tool2',
					description: 'Second tool',
					parameters: { type: 'object', properties: {} }
				}
			];
			const tokens = estimateToolDefsTokens(toolDefs);
			expect(tokens).toBeGreaterThan(estimateToolDefsTokens([toolDefs[0]!]));
		});

		it('should handle complex parameter schemas', () => {
			const toolDef: ToolDefinition = {
				name: 'complex_tool',
				description: 'A tool with complex parameters',
				parameters: {
					type: 'object',
					properties: {
						name: { type: 'string' },
						age: { type: 'number' },
						active: { type: 'boolean' },
						items: { type: 'array', items: { type: 'string' } }
					},
					required: ['name', 'age']
				}
			};
			const tokens = estimateToolDefsTokens([toolDef]);
			expect(tokens).toBeGreaterThan(50);
		});
	});

	describe('estimateMediaTokens', () => {
		it('should return 0 for 0 media items', () => {
			const tokens = estimateMediaTokens(0);
			expect(tokens).toBe(0);
		});

		it('should return 256 per media item', () => {
			const tokens = estimateMediaTokens(1);
			expect(tokens).toBe(256);
		});

		it('should scale linearly with media count', () => {
			const tokens1 = estimateMediaTokens(1);
			const tokens5 = estimateMediaTokens(5);
			expect(tokens5).toBe(tokens1 * 5);
		});
	});

	describe('isOverContextBudget', () => {
		it('should return true when over budget', () => {
			const messages: AgentMessage[] = Array(100)
				.fill(null)
				.map((_, i) => ({
					role: 'user' as const,
					content: 'x'.repeat(5000)
				}));
			const result = isOverContextBudget(10000, messages, [], 1000);
			expect(result).toBe(true);
		});

		it('should return false when under budget', () => {
			const messages: AgentMessage[] = [{ role: 'user', content: 'Hello' }];
			const result = isOverContextBudget(100000, messages, [], 1000);
			expect(result).toBe(false);
		});

		it('should account for tool definitions in budget', () => {
			const messages: AgentMessage[] = [{ role: 'user', content: 'Hello' }];
			const toolDefs: ToolDefinition[] = [
				{
					name: 'test_tool',
					description: 'A test tool',
					parameters: { type: 'object', properties: {} }
				}
			];
			// With a very small budget, even a single tool def should push over
			const result = isOverContextBudget(10, messages, toolDefs, 5);
			expect(result).toBe(true);
		});

		it('should return false with empty messages and tool defs', () => {
			const result = isOverContextBudget(10000, [], [], 1000);
			expect(result).toBe(false);
		});

		it('should return true when maxTokens alone exceeds budget', () => {
			const result = isOverContextBudget(500, [], [], 1000);
			expect(result).toBe(true);
		});
	});

	describe('tokenEstimator object', () => {
		it('should have all required methods', () => {
			expect(typeof tokenEstimator.estimateMessageTokens).toBe('function');
			expect(typeof tokenEstimator.estimateToolDefsTokens).toBe('function');
			expect(typeof tokenEstimator.estimateMediaTokens).toBe('function');
			expect(typeof tokenEstimator.isOverContextBudget).toBe('function');
		});

		it('should produce consistent results with standalone functions', () => {
			const msg: AgentMessage = { role: 'user', content: 'Test message' };
			const toolDefs: ToolDefinition[] = [
				{
					name: 'test',
					description: 'Test tool',
					parameters: { type: 'object', properties: {} }
				}
			];

			expect(tokenEstimator.estimateMessageTokens(msg)).toBe(estimateMessageTokens(msg));
			expect(tokenEstimator.estimateToolDefsTokens(toolDefs)).toBe(
				estimateToolDefsTokens(toolDefs)
			);
			expect(tokenEstimator.isOverContextBudget(100000, [msg], toolDefs, 1000)).toBe(
				isOverContextBudget(100000, [msg], toolDefs, 1000)
			);
		});
	});
});
