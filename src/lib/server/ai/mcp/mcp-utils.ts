/**
 * MCP Utility Functions
 *
 * Helper functions for MCP operations.
 */

import type { MCPTool } from '$lib/models/ai/mcp';
import type { ToolDefinition } from '$lib/models/ai';
import { getAllModules } from '$lib/config';

/**
 * Convert MoLOS ToolDefinition to MCP Tool format
 */
export function toolDefinitionToMCPTool(tool: ToolDefinition): MCPTool {
	return {
		name: tool.name,
		description: tool.description,
		inputSchema: {
			type: 'object',
			properties: tool.parameters.properties as Record<string, unknown>,
			...(tool.parameters.required && { required: tool.parameters.required })
		}
	};
}

/**
 * Extract module ID from tool name
 * Tool names are prefixed with module ID (e.g., "MoLOS-Tasks_get_tasks")
 */
export function extractModuleIdFromToolName(toolName: string): string {
	const parts = toolName.split('_');
	if (parts.length >= 2) {
		return parts.slice(0, -1).join('_');
	}
	return toolName;
}

/**
 * Filter tools by allowed modules
 */
export function filterToolsByModules(
	tools: MCPTool[],
	allowedModules: string[]
): MCPTool[] {
	if (allowedModules.length === 0) {
		return tools;
	}

	return tools.filter((tool) => {
		const moduleId = extractModuleIdFromToolName(tool.name);
		return allowedModules.includes(moduleId);
	});
}

/**
 * Get available module IDs for scoping
 */
export function getAvailableModuleIds(): string[] {
	const modules = getAllModules();
	return modules.filter((m) => m.isExternal).map((m) => m.id);
}

/**
 * Generate a session ID
 */
export function generateSessionId(): string {
	return `mcp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Parse API key from header
 * Supports both "Bearer" prefix and raw key
 */
export function parseApiKeyFromHeader(headerValue: string | null): string | null {
	if (!headerValue) {
		return null;
	}

	const trimmed = headerValue.trim();

	// Remove "Bearer " prefix if present
	if (trimmed.toLowerCase().startsWith('bearer ')) {
		return trimmed.slice(7).trim();
	}

	return trimmed;
}

/**
 * Validate module IDs against available modules
 */
export function validateModuleIds(moduleIds: string[]): {
	valid: string[];
	invalid: string[];
} {
	const available = getAvailableModuleIds();
	const valid: string[] = [];
	const invalid: string[] = [];

	for (const moduleId of moduleIds) {
		if (available.includes(moduleId)) {
			valid.push(moduleId);
		} else {
			invalid.push(moduleId);
		}
	}

	return { valid, invalid };
}

/**
 * Sanitize error message for client response
 * Don't leak sensitive information
 */
export function sanitizeErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		// Return generic error for internal errors
		if (
			error.message.includes('database') ||
			error.message.includes('SQL') ||
			error.message.includes('ECONNREFUSED')
		) {
			return 'An internal error occurred';
		}
		return error.message;
	}

	if (typeof error === 'string') {
		return error;
	}

	return 'An unknown error occurred';
}

/**
 * Format tool result for MCP response
 */
export function formatToolResult(result: unknown): {
	content: Array<{ type: string; text?: string }>;
} {
	if (result === null || result === undefined) {
		return {
			content: [
				{
					type: 'text',
					text: 'Operation completed successfully'
				}
			]
		};
	}

	if (typeof result === 'string') {
		return {
			content: [
				{
					type: 'text',
					text: result
				}
			]
		};
	}

	if (typeof result === 'object' && result !== null) {
		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(result, null, 2)
				}
			]
		};
	}

	return {
		content: [
			{
				type: 'text',
				text: String(result)
			}
		]
	};
}

/**
 * Create a rate limiter for API keys
 */
export class RateLimiter {
	private requests: Map<string, number[]> = new Map();
	private windowMs: number;
	private maxRequests: number;

	constructor(windowMs: number = 60000, maxRequests: number = 100) {
		this.windowMs = windowMs;
		this.maxRequests = maxRequests;
	}

	/**
	 * Check if a request should be rate limited
	 */
	check(identifier: string): boolean {
		const now = Date.now();
		const windowStart = now - this.windowMs;

		// Get existing timestamps
		let timestamps = this.requests.get(identifier) ?? [];

		// Remove old timestamps outside the window
		timestamps = timestamps.filter((ts) => ts > windowStart);

		// Check if limit exceeded
		if (timestamps.length >= this.maxRequests) {
			return false;
		}

		// Add current timestamp
		timestamps.push(now);
		this.requests.set(identifier, timestamps);

		return true;
	}

	/**
	 * Clear all rate limit data
	 */
	clear(): void {
		this.requests.clear();
	}

	/**
	 * Clear data for a specific identifier
	 */
	clearIdentifier(identifier: string): void {
		this.requests.delete(identifier);
	}
}

/**
 * Default rate limiter (100 requests per minute per API key)
 */
export const defaultRateLimiter = new RateLimiter(60000, 100);
