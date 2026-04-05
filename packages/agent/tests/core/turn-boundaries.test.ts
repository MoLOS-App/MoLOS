/**
 * Tests for Turn Boundaries
 */

import { describe, it, expect } from 'vitest';
import {
	parseTurnBoundaries,
	isSafeBoundary,
	findSafeBoundary,
	findMiddleBoundary
} from '../../src/core/turn-boundaries';
import type { AgentMessage } from '../../src/types/index.js';

describe('turnBoundaries', () => {
	describe('parseTurnBoundaries', () => {
		it('should return indices of user messages', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi' },
				{ role: 'user', content: 'How are you?' },
				{ role: 'assistant', content: 'Fine' }
			];
			const boundaries = parseTurnBoundaries(messages);
			expect(boundaries).toEqual([0, 2]);
		});

		it('should return empty array for no user messages', () => {
			const messages: AgentMessage[] = [
				{ role: 'assistant', content: 'Hi' },
				{ role: 'assistant', content: 'How are you?' }
			];
			expect(parseTurnBoundaries(messages)).toEqual([]);
		});

		it('should return empty array for empty messages', () => {
			expect(parseTurnBoundaries([])).toEqual([]);
		});

		it('should return index 0 for first user message', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'First' },
				{ role: 'assistant', content: 'Second' }
			];
			expect(parseTurnBoundaries(messages)).toEqual([0]);
		});

		it('should handle multiple consecutive user messages', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'First' },
				{ role: 'user', content: 'Second' },
				{ role: 'assistant', content: 'Response' }
			];
			expect(parseTurnBoundaries(messages)).toEqual([0, 1]);
		});

		it('should handle tool roles (not included)', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi' },
				{ role: 'tool', content: 'Tool result' },
				{ role: 'user', content: 'Bye' }
			];
			expect(parseTurnBoundaries(messages)).toEqual([0, 3]);
		});

		it('should handle system roles (not included)', () => {
			const messages: AgentMessage[] = [
				{ role: 'system', content: 'You are a helpful assistant' },
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi' }
			];
			expect(parseTurnBoundaries(messages)).toEqual([1]);
		});
	});

	describe('isSafeBoundary', () => {
		it('should return true for index 0', () => {
			const messages: AgentMessage[] = [{ role: 'user', content: 'Hi' }];
			expect(isSafeBoundary(messages, 0)).toBe(true);
		});

		it('should return true at end (messages.length)', () => {
			const messages: AgentMessage[] = [{ role: 'user', content: 'Hi' }];
			expect(isSafeBoundary(messages, messages.length)).toBe(true);
		});

		it('should return true at user message', () => {
			const messages: AgentMessage[] = [
				{ role: 'assistant', content: 'Hi' },
				{ role: 'user', content: 'Hello' }
			];
			expect(isSafeBoundary(messages, 1)).toBe(true);
		});

		it('should return false at assistant message', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'Hi' },
				{ role: 'assistant', content: 'Hello' }
			];
			expect(isSafeBoundary(messages, 1)).toBe(false);
		});

		it('should return false at tool message', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'Hi' },
				{ role: 'tool', content: 'Tool result' }
			];
			expect(isSafeBoundary(messages, 1)).toBe(false);
		});

		it('should return false for negative index', () => {
			const messages: AgentMessage[] = [{ role: 'user', content: 'Hi' }];
			expect(isSafeBoundary(messages, -1)).toBe(false);
		});

		it('should return false for out of bounds index', () => {
			const messages: AgentMessage[] = [{ role: 'user', content: 'Hi' }];
			expect(isSafeBoundary(messages, 10)).toBe(false);
		});

		it('should return true for empty array at index 0', () => {
			expect(isSafeBoundary([], 0)).toBe(true);
		});
	});

	describe('findSafeBoundary', () => {
		it('should return 0 for empty messages', () => {
			expect(findSafeBoundary([], 0)).toBe(0);
		});

		it('should return 0 when no user messages exist', () => {
			const messages: AgentMessage[] = [
				{ role: 'assistant', content: 'Hi' },
				{ role: 'assistant', content: 'Hello' }
			];
			expect(findSafeBoundary(messages, 1)).toBe(0);
		});

		it('should prefer backward boundary at target when target is a user message', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: '1' },
				{ role: 'assistant', content: '2' },
				{ role: 'tool', content: '3' },
				{ role: 'user', content: '4' },
				{ role: 'assistant', content: '5' }
			];
			// Target index 3 is a user message, so boundary at 3 is returned
			const boundary = findSafeBoundary(messages, 3);
			expect(boundary).toBe(3); // Index 3 is a user message (safe boundary)
		});

		it('should return first boundary after target when no boundary at or before target exists', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: '1' },
				{ role: 'assistant', content: '2' },
				{ role: 'tool', content: '3' },
				{ role: 'user', content: '4' },
				{ role: 'assistant', content: '5' }
			];
			// Target index 2 is a tool message (not a boundary)
			// No boundary exists at or before 2, so returns first boundary after 2
			const boundary = findSafeBoundary(messages, 2);
			expect(boundary).toBe(3); // First boundary after 2
		});

		it('should return exact match for user message index', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: '1' },
				{ role: 'assistant', content: '2' },
				{ role: 'user', content: '3' }
			];
			expect(findSafeBoundary(messages, 2)).toBe(2);
		});

		it('should return next forward boundary if no backward available', () => {
			const messages: AgentMessage[] = [
				{ role: 'assistant', content: '1' },
				{ role: 'user', content: '2' },
				{ role: 'assistant', content: '3' }
			];
			// Target index 0, but only boundary is at index 1
			expect(findSafeBoundary(messages, 0)).toBe(1);
		});

		it('should return 0 if no boundaries found at all', () => {
			const messages: AgentMessage[] = [
				{ role: 'assistant', content: '1' },
				{ role: 'assistant', content: '2' }
			];
			expect(findSafeBoundary(messages, 1)).toBe(0);
		});

		it('should handle single user message at index 0', () => {
			const messages: AgentMessage[] = [{ role: 'user', content: 'Hello' }];
			expect(findSafeBoundary(messages, 0)).toBe(0);
		});
	});

	describe('findMiddleBoundary', () => {
		it('should find middle of multiple turns', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: '1' },
				{ role: 'assistant', content: '2' },
				{ role: 'user', content: '3' },
				{ role: 'assistant', content: '4' },
				{ role: 'user', content: '5' }
			];
			const middle = findMiddleBoundary(messages);
			expect(middle).toBe(2); // Middle turn boundary
		});

		it('should return 0 for single turn', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi' }
			];
			expect(findMiddleBoundary(messages)).toBe(0);
		});

		it('should return 0 for no user messages', () => {
			const messages: AgentMessage[] = [
				{ role: 'assistant', content: 'Hi' },
				{ role: 'assistant', content: 'Hello' }
			];
			expect(findMiddleBoundary(messages)).toBe(0);
		});

		it('should handle even number of turns', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: '1' },
				{ role: 'assistant', content: '2' },
				{ role: 'user', content: '3' },
				{ role: 'assistant', content: '4' }
			];
			// boundaries = [0, 2], middleIndex = floor(2/2) = 1, boundaries[1] = 2
			const middle = findMiddleBoundary(messages);
			expect(middle).toBe(2);
		});

		it('should handle many turns', () => {
			const messages: AgentMessage[] = [
				{ role: 'user', content: '1' },
				{ role: 'assistant', content: '2' },
				{ role: 'user', content: '3' },
				{ role: 'assistant', content: '4' },
				{ role: 'user', content: '5' },
				{ role: 'assistant', content: '6' },
				{ role: 'user', content: '7' },
				{ role: 'assistant', content: '8' }
			];
			// boundaries = [0, 2, 4, 6], middleIndex = floor(4/2) = 2, boundaries[2] = 4
			const middle = findMiddleBoundary(messages);
			expect(middle).toBe(4);
		});

		it('should return safe boundary for empty messages', () => {
			expect(findMiddleBoundary([])).toBe(0);
		});
	});
});
