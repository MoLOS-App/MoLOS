/**
 * OAuth Scope to Module Mapper
 *
 * Maps OAuth scopes to MoLOS module scope permissions.
 * Supports hierarchical scopes: "module", "module:submodule", or "module:submodule:tool"
 */

import { getAllModules } from '$lib/config';

/**
 * OAuth scope definitions
 *
 * Scopes follow pattern: "mcp:{module}" for module-specific access
 * or "mcp:all" for full access.
 * Extended scopes: "mcp:{module}:{submodule}" or "mcp:{module}:{submodule}:{tool}"
 */
export const MCP_OAUTH_SCOPES = {
	ALL: 'mcp:all',
	ANALYTICS: 'mcp:analytics',
	TASKS: 'mcp:tasks',
	NOTES: 'mcp:notes'
} as const;

/**
 * Get all available modules (both package modules and legacy external modules)
 */
function getAvailableModules(): string[] {
	const allModules = getAllModules();
	return allModules.filter((m) => m.isPackageModule || m.isExternal).map((m) => m.id);
}

/**
 * Convert OAuth scopes to allowed scopes
 *
 * @param scopes - Array of OAuth scopes
 * @returns Array of allowed scopes
 */
export function scopesToAllowedScopes(scopes: string[]): string[] {
	// If "mcp:all" scope is present, grant access to all modules
	if (scopes.includes(MCP_OAUTH_SCOPES.ALL)) {
		return []; // Empty array = no restriction
	}

	const allowedScopes: string[] = [];

	// Map scopes to module/submodule/tool format
	for (const scope of scopes) {
		if (scope === MCP_OAUTH_SCOPES.ALL) {
			// Already handled above
			continue;
		}

		// Parse scope format: "mcp:{module}" or "mcp:{module}:{submodule}" or "mcp:{module}:{submodule}:{tool}"
		if (scope.startsWith('mcp:')) {
			const scopeValue = scope.slice(4); // Remove "mcp:" prefix
			allowedScopes.push(scopeValue);
		}
	}

	// Validate against available modules
	const availableModules = getAvailableModules();
	const validScopes = allowedScopes.filter((scope) => {
		// Check if scope's module part is available
		const parts = scope.split(':');
		if (parts.length > 0) {
			return availableModules.includes(parts[0]);
		}
		// No colon = module-level scope
		return availableModules.includes(scope);
	});

	return validScopes;
}

/**
 * Convert module/submodule/tool scopes to OAuth scopes
 *
 * @param moduleScopes - Array of module/submodule/tool scopes
 * @returns Array of OAuth scopes
 */
export function scopesToOAuthScopes(moduleScopes: string[]): string[] {
	// If empty or contains all modules, return "mcp:all"
	if (moduleScopes.length === 0) {
		return ['mcp:all'];
	}

	const availableModules = getAvailableModules();

	// Check if requesting all available modules
	const hasAll = moduleScopes.every((scope) => {
		const parts = scope.split(':');
		if (parts.length === 1) {
			// Module-level scope
			return availableModules.includes(scope);
		}
		return false;
	});

	if (hasAll) {
		return ['mcp:all'];
	}

	// Map to OAuth scope format
	return moduleScopes.map((scope) => {
		// Already has "mcp:" prefix, just return as-is
		if (scope.includes(':')) {
			return scope;
		}
		// Module-level scope
		return `mcp:${scope}`;
	});
}

/**
 * Validate scopes against available modules
 *
 * @param scopes - Array of OAuth scopes to validate
 * @returns Array of valid scopes
 */
export function validateOAuthScopes(scopes: string[]): string[] {
	const validScopes: string[] = [];
	const availableModules = getAvailableModules();

	for (const scope of scopes) {
		// Check for "mcp:all" first
		if (scope === MCP_OAUTH_SCOPES.ALL) {
			validScopes.push(scope);
			continue;
		}

		// Parse scope format
		if (scope.startsWith('mcp:')) {
			const scopeValue = scope.slice(4);
			const parts = scopeValue.split(':');

			// Validate module
			if (!availableModules.includes(parts[0])) {
				continue;
			}

			// For extended scopes (with submodule/tool), skip validation for now
			// TODO: Add validation for submodule/tool format
			validScopes.push(scope);
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

	// Add module-level scopes
	for (const moduleId of availableModules) {
		scopes.push(`mcp:${moduleId}`);
	}

	return scopes;
}
