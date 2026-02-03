/**
 * MCP API Key Type Definitions
 *
 * Types for API key management and authentication.
 */

import type { ApiKeyStatus } from './common';

/**
 * Full API Key entity from database
 */
export interface MCPApiKey {
	id: string;
	userId: string;
	name: string;
	keyPrefix: string;
	keyHash: string;
	status: ApiKeyStatus;
	allowedModules: string[];
	expiresAt: Date | null;
	lastUsedAt: Date | null;
	usageCount: number;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * API Key creation input
 */
export interface CreateApiKeyInput {
	name: string;
	allowedModules: string[];
	expiresAt?: Date | null;
}

/**
 * API Key update input
 */
export interface UpdateApiKeyInput {
	name?: string;
	status?: ApiKeyStatus;
	allowedModules?: string[];
	expiresAt?: Date | null;
}

/**
 * API Key response (includes full key on creation)
 */
export interface ApiKeyResponse {
	apiKey: MCPApiKey;
	// Full key only returned on creation
	fullKey?: string;
}

/**
 * API Key list filters
 */
export interface ApiKeyFilters {
	status?: ApiKeyStatus;
	search?: string; // Search by name
}

/**
 * API Key format types
 */
export type ApiKeyEnvironment = 'live' | 'test';

/**
 * Generate a new API key
 * @internal Used by repository only
 */
export interface GeneratedApiKey {
	fullKey: string; // mcp_live_abc12345_xyz67890
	prefix: string; // abc12345
	suffix: string; // xyz67890
	hash: string; // SHA-256 hash
}

/**
 * API Key validation result
 */
export interface ApiKeyValidation {
	valid: boolean;
	apiKey?: MCPApiKey;
	error?: string;
}
