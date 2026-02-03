/**
 * MCP Scope Middleware
 *
 * Validates module scope for MCP requests.
 */

import { extractModuleIdFromToolName } from '../mcp-utils';
import type { MCPContext } from '$lib/models/ai/mcp';

/**
 * Scope validation result
 */
export interface ScopeValidation {
	allowed: boolean;
	error?: string;
}

/**
 * Check if a tool is allowed based on module scope
 */
export function isToolAllowed(toolName: string, allowedModules: string[]): boolean {
	// If no modules are specified, allow all tools
	if (allowedModules.length === 0) {
		return true;
	}

	const moduleId = extractModuleIdFromToolName(toolName);
	return allowedModules.includes(moduleId);
}

/**
 * Check if a resource is allowed based on module scope
 */
export function isResourceAllowed(moduleId: string, allowedModules: string[]): boolean {
	// If no modules are specified, allow all resources
	if (allowedModules.length === 0) {
		return true;
	}

	return allowedModules.includes(moduleId);
}

/**
 * Check if a prompt is allowed based on module scope
 */
export function isPromptAllowed(promptModuleId: string | null, allowedModules: string[]): boolean {
	// If no modules are specified, allow all prompts
	if (allowedModules.length === 0) {
		return true;
	}

	// Allow prompts without module association
	if (!promptModuleId) {
		return true;
	}

	return allowedModules.includes(promptModuleId);
}

/**
 * Validate scope for tool access
 */
export function validateToolScope(context: MCPContext, toolName: string): ScopeValidation {
	if (!isToolAllowed(toolName, context.allowedModules)) {
		const moduleId = extractModuleIdFromToolName(toolName);
		return {
			allowed: false,
			error: `Module '${moduleId}' is not allowed for this API key`
		};
	}

	return { allowed: true };
}

/**
 * Validate scope for resource access
 */
export function validateResourceScope(context: MCPContext, moduleId: string): ScopeValidation {
	if (!isResourceAllowed(moduleId, context.allowedModules)) {
		return {
			allowed: false,
			error: `Module '${moduleId}' is not allowed for this API key`
		};
	}

	return { allowed: true };
}

/**
 * Validate scope for prompt access
 */
export function validatePromptScope(
	context: MCPContext,
	promptModuleId: string | null
): ScopeValidation {
	if (!isPromptAllowed(promptModuleId, context.allowedModules)) {
		return {
			allowed: false,
			error: `Module '${promptModuleId}' is not allowed for this API key`
		};
	}

	return { allowed: true };
}

/**
 * Filter tools by module scope
 */
export function filterToolsByScope<T extends { name: string }>(
	tools: T[],
	allowedModules: string[]
): T[] {
	if (allowedModules.length === 0) {
		return tools;
	}

	return tools.filter((tool) => {
		const moduleId = extractModuleIdFromToolName(tool.name);
		return allowedModules.includes(moduleId);
	});
}

/**
 * Create scope error response
 */
export function createScopeErrorResponse(message: string) {
	return {
		jsonrpc: '2.0',
		id: null,
		error: {
			code: -32001,
			message: 'Scope error',
			data: {
				reason: message
			}
		}
	};
}

/**
 * Middleware: Validate scope for tool execution
 *
 * Use this to ensure a tool can be accessed by the current API key's scope.
 */
export function withToolScope(
	handler: (context: MCPContext, toolName: string, params: unknown) => Promise<unknown>
) {
	return async (context: MCPContext, toolName: string, params: unknown) => {
		const validation = validateToolScope(context, toolName);

		if (!validation.allowed) {
			return createScopeErrorResponse(validation.error ?? 'Scope validation failed');
		}

		return handler(context, toolName, params);
	};
}

/**
 * Middleware: Validate scope for resource access
 */
export function withResourceScope(handler: (context: MCPContext, uri: string) => Promise<unknown>) {
	return async (context: MCPContext, uri: string) => {
		// Extract module ID from URI (format: mcp://molos/{moduleId}/...)
		const match = uri.match(/mcp:\/\/molos\/([^\/]+)/);
		if (!match) {
			return createScopeErrorResponse('Invalid resource URI format');
		}

		const moduleId = match[1];
		const validation = validateResourceScope(context, moduleId);

		if (!validation.allowed) {
			return createScopeErrorResponse(validation.error ?? 'Scope validation failed');
		}

		return handler(context, uri);
	};
}
