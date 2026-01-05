import type { ToolDefinition } from '$lib/models/ai';

export type ToolCall = {
	id: string;
	name: string;
	parameters: Record<string, unknown>;
};

type CacheEntry<T> = { value: T; expiresAt: number };

export class TtlCache<T> {
	private store = new Map<string, CacheEntry<T>>();
	private maxSize: number;

	constructor(maxSize: number) {
		this.maxSize = maxSize;
	}

	get(key: string, now = Date.now()): T | undefined {
		const entry = this.store.get(key);
		if (!entry) return;
		if (entry.expiresAt <= now) {
			this.store.delete(key);
			return;
		}
		return entry.value;
	}

	set(key: string, value: T, ttlMs: number, now = Date.now()): void {
		if (this.store.size >= this.maxSize) {
			const firstKey = this.store.keys().next().value as string | undefined;
			if (firstKey) this.store.delete(firstKey);
		}
		this.store.set(key, { value, expiresAt: now + ttlMs });
	}

	clear(): void {
		this.store.clear();
	}
}

export function stableStringify(value: unknown): string {
	return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown, seen = new Set<unknown>()): unknown {
	if (value === null || typeof value !== 'object') return value;
	if (seen.has(value)) return '[Circular]';
	seen.add(value);

	if (Array.isArray(value)) {
		return value.map((item) => sortValue(item, seen));
	}

	const obj = value as Record<string, unknown>;
	const sortedKeys = Object.keys(obj).sort();
	const result: Record<string, unknown> = {};
	for (const key of sortedKeys) {
		result[key] = sortValue(obj[key], seen);
	}
	return result;
}

export function normalizeToolParams(params: unknown): Record<string, unknown> {
	if (!params || typeof params !== 'object' || Array.isArray(params)) return {};
	return params as Record<string, unknown>;
}

export function validateToolParams(tool: ToolDefinition, params: Record<string, unknown>): {
	ok: boolean;
	missing: string[];
} {
	const required = tool.parameters.required || [];
	const missing = required.filter((key) => params[key] === undefined);
	return { ok: missing.length === 0, missing };
}

export function isWriteTool(toolName: string): boolean {
	return (
		toolName.startsWith('create') ||
		toolName.startsWith('add') ||
		toolName.startsWith('log') ||
		toolName.startsWith('update') ||
		toolName.startsWith('bulk') ||
		toolName.startsWith('delete')
	);
}

export function dedupeToolCalls(toolCalls: ToolCall[]): ToolCall[] {
	const seen = new Set<string>();
	const unique: ToolCall[] = [];
	for (const call of toolCalls) {
		const key = `${call.name}:${stableStringify(call.parameters)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(call);
	}
	return unique;
}

export function createToolCacheKey(
	userId: string,
	toolName: string,
	params: Record<string, unknown>
): string {
	return `${userId}:${toolName}:${stableStringify(params)}`;
}
