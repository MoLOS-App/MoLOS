import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	TtlCache,
	stableStringify,
	validateToolParams,
	dedupeToolCalls,
	isWriteTool
} from './agent-utils';
import type { ToolDefinition } from '$lib/models/ai';

describe('agent-utils', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('stableStringify sorts object keys deterministically', () => {
		const a = { b: 1, a: 2 };
		const b = { a: 2, b: 1 };
		expect(stableStringify(a)).toEqual(stableStringify(b));
	});

	it('TtlCache returns undefined after expiry', () => {
		const cache = new TtlCache<number>(2);
		cache.set('key', 42, 10, 0);
		expect(cache.get('key', 5)).toBe(42);
		expect(cache.get('key', 11)).toBeUndefined();
	});

	it('validateToolParams detects missing required fields', () => {
		const tool: ToolDefinition = {
			name: 'create_task',
			description: 'Create a task',
			parameters: {
				type: 'object',
				properties: { title: { type: 'string' } },
				required: ['title']
			},
			execute: async () => ({})
		};
		const result = validateToolParams(tool, {});
		expect(result.ok).toBe(false);
		expect(result.missing).toEqual(['title']);
	});

	it('dedupeToolCalls removes identical calls', () => {
		const calls = [
			{ id: '1', name: 'get_tasks', parameters: { status: 'to_do' } },
			{ id: '2', name: 'get_tasks', parameters: { status: 'to_do' } },
			{ id: '3', name: 'get_tasks', parameters: { status: 'done' } }
		];
		const deduped = dedupeToolCalls(calls);
		expect(deduped).toHaveLength(2);
	});

	it('isWriteTool flags write operations', () => {
		expect(isWriteTool('create_task')).toBe(true);
		expect(isWriteTool('update_task')).toBe(true);
		expect(isWriteTool('get_tasks')).toBe(false);
	});
});
