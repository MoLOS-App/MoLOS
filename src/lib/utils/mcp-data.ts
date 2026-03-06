/**
 * MCP Data Fetching Utilities
 *
 * Centralized data fetching with error handling and type safety.
 */

import type {
	MCPApiKey,
	CreateApiKeyInput,
	UpdateApiKeyInput,
	ApiKeyFilters
} from '$lib/models/ai/mcp';

export interface PaginatedResult<T> {
	items: T[];
	total: number;
	page: number;
	limit: number;
	hasMore: boolean;
}

/**
 * Fetch API keys with filters and pagination
 */
export async function fetchApiKeys(
	filters?: ApiKeyFilters,
	pagination?: { page?: number; limit?: number }
): Promise<PaginatedResult<MCPApiKey>> {
	const params = new URLSearchParams();

	if (filters?.status) {
		params.set('status', filters.status);
	}
	if (filters?.search) {
		params.set('search', filters.search);
	}
	if (pagination?.page) {
		params.set('page', pagination.page.toString());
	}
	if (pagination?.limit) {
		params.set('limit', pagination.limit.toString());
	}

	const response = await fetch(`/api/ai/mcp/keys?${params.toString()}`);

	if (!response.ok) {
		throw new Error(`Failed to fetch API keys: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Create a new API key
 */
export async function createApiKey(input: CreateApiKeyInput): Promise<{
	apiKey: MCPApiKey;
	fullKey: string;
}> {
	const response = await fetch('/api/ai/mcp/keys', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to create API key');
	}

	return response.json();
}

/**
 * Update an API key
 */
export async function updateApiKey(keyId: string, input: UpdateApiKeyInput): Promise<MCPApiKey> {
	const response = await fetch(`/api/ai/mcp/keys/${keyId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Failed to update API key');
	}

	const result = await response.json();
	return result.apiKey;
}

/**
 * Delete/revoke an API key
 */
export async function deleteApiKey(keyId: string): Promise<void> {
	const response = await fetch(`/api/ai/mcp/keys/${keyId}`, {
		method: 'DELETE'
	});

	if (!response.ok) {
		throw new Error(`Failed to delete API key: ${response.statusText}`);
	}
}
