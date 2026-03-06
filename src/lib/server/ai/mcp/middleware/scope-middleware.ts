/**
 * MCP Scope Middleware (Hierarchical Permissions)
 *
 * Validates module/submodule/tool scope for MCP requests.
 * Supports hierarchical scopes: "module", "module:submodule", or "module:submodule:tool"
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
 * Parse scope string into components
 * "MoLOS-Tasks" -> { module: "MoLOS-Tasks", submodule: null, tool: null }
 * "MoLOS-Tasks:dashboard" -> { module: "MoLOS-Tasks", submodule: "dashboard", tool: null }
 * "MoLOS-Tasks:dashboard:get_task" -> { module: "MoLOS-Tasks", submodule: "dashboard", tool: "get_task" }
 */
function parseScope(scope: string): {
	module: string;
	submodule: string | null;
	tool: string | null;
} | null {
	const parts = scope.split(':');
	if (parts.length < 1 || parts.length > 3) return null;

	return {
		module: parts[0],
		submodule: parts[1] || null,
		tool: parts[2] || null
	};
}

/**
 * Check if a scope allows access to a specific module/submodule/tool
 *
 * Scopes are hierarchical:
 * - "module" allows all submodules and tools in that module
 * - "module:submodule" allows all tools in that submodule
 * - "module:submodule:tool" allows only that specific tool
 */
function isScopeAllowed(
	targetModule: string,
	targetSubmodule: string | null,
	targetTool: string | null,
	allowedScopes: string[]
): boolean {
	// If no scopes, allow all (for OAuth 'mcp:all' scope)
	if (allowedScopes.length === 0) {
		return true;
	}

	for (const scope of allowedScopes) {
		const parsed = parseScope(scope);
		if (!parsed) continue;

		// Check module match
		if (parsed.module !== targetModule) continue;

		// If scope is module-only ("MoLOS-Tasks"), allow all submodules/tools
		if (!parsed.submodule) return true;

		// Check submodule match
		if (parsed.submodule !== targetSubmodule) continue;

		// If scope is submodule-only ("MoLOS-Tasks:dashboard"), allow all tools
		if (!parsed.tool) return true;

		// Check tool match
		if (parsed.tool === targetTool) return true;
	}

	return false;
}

/**
 * Get submodule for a tool name
 * Looks up tool metadata to find which submodule it belongs to
 *
 * @param toolName - Full tool name (e.g., "MoLOS-Tasks_get_task")
 * @returns Submodule ID or null
 */
async function getSubmoduleForTool(toolName: string): Promise<string | null> {
	// Import dynamically to avoid circular dependency
	const { AiToolbox } = await import('../../toolbox');
	const toolbox = new (AiToolbox as any).AiToolbox();

	// Get all tools and find matching tool
	const tools = await toolbox.getTools('system', []);

	// Find the tool and return its submodule from metadata
	const tool = tools.find((t: any) => t.name === toolName);
	return tool?.metadata?.submodule || null;
}

/**
 * Check if a tool is allowed based on scope
 */
export async function isToolAllowed(toolName: string, allowedScopes: string[]): Promise<boolean> {
	// Extract module ID from tool name ("MoLOS-Tasks_get_task" -> "MoLOS-Tasks")
	const moduleId = extractModuleIdFromToolName(toolName);
	const toolShortName = toolName.split('_').slice(1).join('_'); // "get_task"

	// Get submodule from tool metadata
	const submodule = await getSubmoduleForTool(toolName);

	return isScopeAllowed(moduleId, submodule, toolShortName, allowedScopes);
}

/**
 * Check if a resource is allowed based on scope
 *
 * @param moduleId - Resource's module ID
 * @param submoduleId - Resource's submodule ID (can be null)
 * @param resourceName - Resource's name (for individual resource control, can be null)
 * @param allowedScopes - Array of allowed scopes
 */
export function isResourceAllowed(
	moduleId: string,
	submoduleId: string | null,
	resourceName: string | null,
	allowedScopes: string[]
): boolean {
	return isScopeAllowed(moduleId, submoduleId, resourceName, allowedScopes);
}

/**
 * Check if a prompt is allowed based on scope
 *
 * @param promptModuleId - Prompt's module ID (can be null)
 * @param promptSubmoduleId - Prompt's submodule ID (can be null)
 * @param promptName - Prompt's name (for individual prompt control, can be null)
 * @param allowedScopes - Array of allowed scopes
 */
export function isPromptAllowed(
	promptModuleId: string | null,
	promptSubmoduleId: string | null,
	promptName: string | null,
	allowedScopes: string[]
): boolean {
	// Allow prompts without module association
	if (!promptModuleId) return true;
	return isScopeAllowed(promptModuleId, promptSubmoduleId, promptName, allowedScopes);
}

/**
 * Validate scope for tool access
 */
export async function validateToolScope(
	context: MCPContext,
	toolName: string
): Promise<ScopeValidation> {
	const allowed = await isToolAllowed(toolName, context.allowedModules);

	if (!allowed) {
		const moduleId = extractModuleIdFromToolName(toolName);
		return {
			allowed: false,
			error: `Module '${moduleId}' is not allowed for this credential`
		};
	}

	return { allowed: true };
}

/**
 * Validate scope for resource access
 */
export function validateResourceScope(
	context: MCPContext,
	moduleId: string,
	submoduleId: string | null
): ScopeValidation {
	const allowed = isResourceAllowed(moduleId, submoduleId, null, context.allowedModules);

	if (!allowed) {
		return {
			allowed: false,
			error: `Resource in module '${moduleId}'${submoduleId ? `/${submoduleId}` : ''} is not allowed for this credential`
		};
	}

	return { allowed: true };
}

/**
 * Validate scope for prompt access
 */
export function validatePromptScope(
	context: MCPContext,
	promptModuleId: string | null,
	promptSubmoduleId: string | null
): ScopeValidation {
	const allowed = isPromptAllowed(promptModuleId, promptSubmoduleId, null, context.allowedModules);

	if (!allowed) {
		return {
			allowed: false,
			error: `Prompt in module '${promptModuleId}'${promptSubmoduleId ? `/${promptSubmoduleId}` : ''} is not allowed for this credential`
		};
	}

	return { allowed: true };
}

/**
 * Filter tools by scope
 *
 * @param tools - Array of tools to filter
 * @param allowedScopes - Array of allowed scopes
 * @returns Filtered array of tools
 */
export async function filterToolsByScope<T extends { name: string }>(
	tools: T[],
	allowedScopes: string[]
): Promise<T[]> {
	if (allowedScopes.length === 0) {
		return tools;
	}

	const filtered: T[] = [];

	for (const tool of tools) {
		const moduleId = extractModuleIdFromToolName(tool.name);
		const toolShortName = tool.name.split('_').slice(1).join('_');
		const submodule = await getSubmoduleForTool(tool.name);

		if (isScopeAllowed(moduleId, submodule, toolShortName, allowedScopes)) {
			filtered.push(tool);
		}
	}

	return filtered;
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
export async function withToolScope(
	handler: (context: MCPContext, toolName: string, params: unknown) => Promise<unknown>
) {
	return async (context: MCPContext, toolName: string, params: unknown) => {
		const validation = await validateToolScope(context, toolName);

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
		// Extract module ID and optional submodule/resource from URI
		// Format: mcp://molos/{moduleId}/... or mcp://molos/{moduleId}/{submoduleId}/... or mcp://molos/{moduleId}/{submoduleId}/{resourceName}/...
		const match = uri.match(/mcp:\/\/molos\/([^\/]+)/);
		if (!match) {
			return createScopeErrorResponse('Invalid resource URI format');
		}

		const moduleId = match[1];
		const parts = uri.slice(match[0].length).split('/').filter(Boolean);

		const submoduleId = parts[0] || null;
		const resourceName = parts[1] || null;

		const validation = validateResourceScope(context, moduleId, submoduleId);

		if (!validation.allowed) {
			return createScopeErrorResponse(validation.error ?? 'Scope validation failed');
		}

		return handler(context, uri);
	};
}

/**
 * Middleware: Validate scope for prompt access
 */
export function withPromptScope(
	handler: (context: MCPContext, promptName: string, args?: unknown) => Promise<unknown>
) {
	return async (context: MCPContext, promptName: string, args?: unknown) => {
		// For now, skip validation for prompts
		// TODO: Implement proper prompt validation when prompt module/submodule tracking is added
		return handler(context, promptName, args);
	};
}
