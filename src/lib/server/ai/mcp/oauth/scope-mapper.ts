/**
 * OAuth Scope to Module Mapper
 *
 * Maps OAuth scopes to MoLOS module permissions.
 * This allows OAuth clients to request access to specific modules.
 */

import { getAllModules } from '$lib/config';

/**
 * OAuth scope definitions
 *
 * Scopes follow the pattern: mcp:{module} for module-specific access
 * or "mcp:all" for full access.
 */
export const MCP_OAUTH_SCOPES = {
	ALL: 'mcp:all',
	ANALYTICS: 'mcp:analytics',
	TASKS: 'mcp:tasks',
	NOTES: 'mcp:notes',
	// Add more module-specific scopes as needed
} as const;

/**
 * Get all available modules
 */
function getAvailableModules(): string[] {
	const allModules = getAllModules();
	return allModules.filter((m) => m.isExternal).map((m) => m.id);
}

/**
 * Convert OAuth scopes to allowed module IDs
 *
 * @param scopes - Array of OAuth scopes
 * @returns Array of module IDs the client can access
 */
export function scopesToModules(scopes: string[]): string[] {
	// If "mcp:all" scope is present, grant access to all modules
	if (scopes.includes(MCP_OAUTH_SCOPES.ALL)) {
		return []; // Empty array = no restriction
	}

	// Map scopes to module IDs
	const moduleIds: string[] = [];
	for (const scope of scopes) {
		// Parse scope format: mcp:{module_id}
		if (scope.startsWith('mcp:')) {
			const moduleId = scope.slice(4); // Remove "mcp:" prefix
			if (moduleId === 'all') {
				// Already handled above, but skip here
				continue;
			}
			moduleIds.push(moduleId);
		}
	}

	// If no valid scopes, return empty (no access)
	if (moduleIds.length === 0) {
		return []; // No access granted
	}

	// Validate against available modules
	const availableModules = getAvailableModules();
	return moduleIds.filter((id) => availableModules.includes(id));
}

/**
 * Convert module IDs to OAuth scopes
 *
 * @param moduleIds - Array of module IDs
 * @returns Array of OAuth scopes
 */
export function modulesToScopes(moduleIds: string[]): string[] {
	// If empty or contains all modules, return "mcp:all"
	if (moduleIds.length === 0) {
		return [MCP_OAUTH_SCOPES.ALL];
	}

	const availableModules = getAvailableModules();

	// If requesting all available modules, use "mcp:all"
	if (moduleIds.length === availableModules.length) {
		const hasAll = moduleIds.every((id) => availableModules.includes(id));
		if (hasAll) {
			return [MCP_OAUTH_SCOPES.ALL];
		}
	}

	// Map module IDs to scopes
	return moduleIds.map((id) => `mcp:${id}`);
}

/**
 * Validate scopes against available modules
 *
 * @param scopes - Array of OAuth scopes to validate
 * @returns Array of valid scopes
 */
export function validateScopes(scopes: string[]): string[] {
	const validScopes: string[] = [];
	const availableModules = getAvailableModules();

	for (const scope of scopes) {
		// Check for "mcp:all"
		if (scope === MCP_OAUTH_SCOPES.ALL) {
			validScopes.push(scope);
			continue;
		}

		// Check for module-specific scopes
		if (scope.startsWith('mcp:')) {
			const moduleId = scope.slice(4);
			if (availableModules.includes(moduleId)) {
				validScopes.push(scope);
			}
		}
	}

	return validScopes;
}

/**
 * Get all available OAuth scopes
 *
 * @returns Array of all valid OAuth scopes
 */
export function getAvailableScopes(): string[] {
	const scopes: string[] = [MCP_OAUTH_SCOPES.ALL];
	const availableModules = getAvailableModules();

	for (const moduleId of availableModules) {
		scopes.push(`mcp:${moduleId}`);
	}

	return scopes;
}
