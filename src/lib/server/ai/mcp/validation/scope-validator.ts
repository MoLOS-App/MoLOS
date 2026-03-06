/**
 * MCP Scope Validation Utilities
 *
 * Shared validation functions for MCP API scopes and inputs.
 */

import { getAvailableModuleIds } from '../mcp-utils.js';

/**
 * Validation result
 */
export interface ValidationResult {
	valid: string[];
	invalid: string[];
}

/**
 * Validation error
 */
export interface ValidationError {
	field: string;
	message: string;
}

/**
 * Validate scopes against available modules
 * Supports hierarchical scopes: "module", "module:submodule", or "module:submodule:tool"
 */
export function validateScopes(scopes: string[]): ValidationResult {
	const available = getAvailableModuleIds();
	const valid: string[] = [];
	const invalid: string[] = [];

	for (const scope of scopes) {
		const parts = scope.split(':');

		// Validate format (1-3 parts)
		if (parts.length < 1 || parts.length > 3) {
			invalid.push(scope);
			continue;
		}

		// Validate module
		if (!available.includes(parts[0])) {
			invalid.push(scope);
			continue;
		}

		// Validate submodule (if present)
		if (parts.length > 1) {
			// For now, accept any submodule
			// TODO: Add submodule validation
		}

		// Validate tool name (if present)
		if (parts.length > 2) {
			// For now, accept any tool name
			// TODO: Add tool validation
		}

		valid.push(scope);
	}

	return { valid, invalid };
}

/**
 * Validate API key name
 */
export function validateKeyName(name: string): ValidationError | null {
	if (!name || name.trim().length === 0) {
		return { field: 'name', message: 'Name is required' };
	}

	if (name.length > 100) {
		return { field: 'name', message: 'Name must be less than 100 characters' };
	}

	return null;
}

/**
 * Validate API key expiration date
 */
export function validateKeyExpiry(expiresAt: Date | null): ValidationError | null {
	if (expiresAt && new Date(expiresAt) < new Date()) {
		return { field: 'expiresAt', message: 'Expiration date must be in the future' };
	}

	return null;
}

/**
 * Validate resource name
 */
export function validateResourceName(name: string): ValidationError | null {
	if (!name || name.trim().length === 0) {
		return { field: 'name', message: 'Name is required' };
	}

	if (name.length > 255) {
		return { field: 'name', message: 'Name must be less than 255 characters' };
	}

	return null;
}

/**
 * Validate prompt name
 */
export function validatePromptName(name: string): ValidationError | null {
	if (!name || name.trim().length === 0) {
		return { field: 'name', message: 'Name is required' };
	}

	if (name.length > 255) {
		return { field: 'name', message: 'Name must be less than 255 characters' };
	}

	return null;
}

/**
 * Validate URI format
 */
export function validateUri(uri: string): ValidationError | null {
	if (!uri || uri.trim().length === 0) {
		return { field: 'uri', message: 'URI is required' };
	}

	try {
		new URL(uri);
		return null;
	} catch {
		return { field: 'uri', message: 'Invalid URI format' };
	}
}
