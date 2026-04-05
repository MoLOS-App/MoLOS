/**
 * Tests for History Sanitization
 */

import { describe, it, expect } from 'vitest';
import { sanitizeHistory } from '../../src/core/session';
import type { AgentMessage } from '../../src/types/index.js';

describe('sanitizeHistory', () => {
	describe('dropping system messages', () => {
		it('should drop system messages', () => {
			const messages: AgentMessage[] = [
				{ role: 'system', content: 'You are a helpful assistant' },
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi there!' }
			];

			const sanitized = sanitizeHistory(messages);

			expect(sanitized.find((m) => m.role === 'system')).toBeUndefined();
			expect(sanitized).toHaveLength(2);
			expect(sanitized[0]!.role).toBe('user');
			expect(sanitized[1]!.role).toBe('assistant');
		});

		it('should drop multiple system messages', () => {
			const messages: AgentMessage[] = [
				{ role: 'system', content: 'System 1' },
				{ role: 'system', content: 'System 2' },
				{ role: 'user', content: 'Hello' }
			];

			const sanitized = sanitizeHistory(messages);

			expect(sanitized.find((m) => m.role === 'system')).toBeUndefined();
			expect(sanitized).toHaveLength(1);
		});
	});

	describe('dropping orphaned tool messages', () => {
		it('should drop tool message without preceding assistant with tool_calls', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'Hello' },
				{ role: 'tool', content: 'Orphaned tool result', toolCallId: 'call_1' }
			];

			const sanitized = sanitizeHistory(messages);

			// Tool message should be dropped because no assistant with tool_calls precedes it
			expect(sanitized).toHaveLength(1);
			expect(sanitized[0]!.role).toBe('user');
		});

		it('should keep tool message when preceded by assistant with tool_calls', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'What is the weather?' },
				{
					role: 'assistant',
					content: [{ type: 'tool_call', id: 'call_1', name: 'get_weather', input: {} }]
				},
				{ role: 'tool', content: 'Sunny, 72F', toolCallId: 'call_1' }
			];

			const sanitized = sanitizeHistory(messages);

			expect(sanitized).toHaveLength(3);
			expect(sanitized[2]!.role).toBe('tool');
			expect(sanitized[2]!.toolCallId).toBe('call_1');
		});

		it('should drop tool message when assistant has no tool_calls', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi there!' },
				{ role: 'tool', content: 'Orphaned', toolCallId: 'call_1' }
			];

			const sanitized = sanitizeHistory(messages);

			expect(sanitized).toHaveLength(2);
			expect(sanitized.find((m) => m.role === 'tool')).toBeUndefined();
		});
	});

	describe('deduplicating tool results', () => {
		it('should drop duplicate tool results with same toolCallId', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'Hello' },
				{
					role: 'assistant',
					content: [{ type: 'tool_call', id: 'call_1', name: 'test', input: {} }]
				},
				{ role: 'tool', content: 'First result', toolCallId: 'call_1' },
				{ role: 'tool', content: 'Duplicate result', toolCallId: 'call_1' }
			];

			const sanitized = sanitizeHistory(messages);

			expect(sanitized).toHaveLength(3);
			const toolMessages = sanitized.filter((m) => m.role === 'tool');
			expect(toolMessages).toHaveLength(1);
			expect(toolMessages[0]!.content).toBe('First result');
		});

		it('should keep tool results with different toolCallIds', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'Hello' },
				{
					role: 'assistant',
					content: [
						{ type: 'tool_call', id: 'call_1', name: 'tool1', input: {} },
						{ type: 'tool_call', id: 'call_2', name: 'tool2', input: {} }
					]
				},
				{ role: 'tool', content: 'Result 1', toolCallId: 'call_1' },
				{ role: 'tool', content: 'Result 2', toolCallId: 'call_2' }
			];

			const sanitized = sanitizeHistory(messages);

			expect(sanitized).toHaveLength(4);
			const toolMessages = sanitized.filter((m) => m.role === 'tool');
			expect(toolMessages).toHaveLength(2);
		});
	});

	describe('dropping incomplete tool call sequences', () => {
		it('should handle assistant with tool_calls but missing tool result', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'Hello' },
				{
					role: 'assistant',
					content: [{ type: 'tool_call', id: 'call_1', name: 'test', input: {} }]
				}
				// No tool result following
			];

			const sanitized = sanitizeHistory(messages);

			// Assistant message should still be kept
			expect(sanitized).toHaveLength(2);
			expect(sanitized[1]!.role).toBe('assistant');
		});
	});

	describe('preserving user and assistant messages', () => {
		it('should keep all user messages', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'First message' },
				{ role: 'assistant', content: 'Response 1' },
				{ role: 'user', content: 'Second message' },
				{ role: 'assistant', content: 'Response 2' }
			];

			const sanitized = sanitizeHistory(messages);

			const userMessages = sanitized.filter((m) => m.role === 'user');
			expect(userMessages).toHaveLength(2);
			expect(userMessages[0]!.content).toBe('First message');
			expect(userMessages[1]!.content).toBe('Second message');
		});

		it('should keep assistant messages without tool calls', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Just a regular response' }
			];

			const sanitized = sanitizeHistory(messages);

			expect(sanitized).toHaveLength(2);
			expect(sanitized[1]!.role).toBe('assistant');
			expect(sanitized[1]!.content).toBe('Just a regular response');
		});
	});

	describe('edge cases', () => {
		it('should handle empty array', () => {
			const sanitized = sanitizeHistory([]);
			expect(sanitized).toEqual([]);
		});

		it('should handle single user message', () => {
			const messages: AgentMessage[] = [{ role: 'user', content: 'Hello' }];
			const sanitized = sanitizeHistory(messages);
			expect(sanitized).toHaveLength(1);
		});

		it('should handle single assistant message', () => {
			const messages: AgentMessage[] = [{ role: 'assistant', content: 'Hello' }];
			const sanitized = sanitizeHistory(messages);
			expect(sanitized).toHaveLength(1);
		});

		it('should not break on tool role looking backward through other tool messages', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'Hello' },
				{
					role: 'assistant',
					content: [{ type: 'tool_call', id: 'call_1', name: 'test', input: {} }]
				},
				{ role: 'tool', content: 'Result 1', toolCallId: 'call_1' },
				// Second tool call sequence
				{
					role: 'assistant',
					content: [{ type: 'tool_call', id: 'call_2', name: 'test2', input: {} }]
				},
				{ role: 'tool', content: 'Result 2', toolCallId: 'call_2' }
			];

			const sanitized = sanitizeHistory(messages);

			expect(sanitized).toHaveLength(5);
			const toolMessages = sanitized.filter((m) => m.role === 'tool');
			expect(toolMessages).toHaveLength(2);
		});

		it('should handle assistant with mixed content (text + tool_calls)', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'Hello' },
				{
					role: 'assistant',
					content: [
						{ type: 'text', text: 'Let me check that for you.' },
						{ type: 'tool_call', id: 'call_1', name: 'search', input: {} }
					]
				},
				{ role: 'tool', content: 'Search result', toolCallId: 'call_1' }
			];

			const sanitized = sanitizeHistory(messages);

			expect(sanitized).toHaveLength(3);
			expect(sanitized[1]!.role).toBe('assistant');
			expect(sanitized[2]!.role).toBe('tool');
		});
	});

	describe('message ordering preservation', () => {
		it('should maintain original message order', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: '1' },
				{ role: 'assistant', content: '2' },
				{ role: 'user', content: '3' },
				{ role: 'assistant', content: '4' },
				{ role: 'user', content: '5' }
			];

			const sanitized = sanitizeHistory(messages);

			expect(sanitized.map((m) => m.content)).toEqual(['1', '2', '3', '4', '5']);
		});
	});
});
