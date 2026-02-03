/**
 * MCP Error Handler
 *
 * Centralized error handling for MCP requests.
 */

import type { JSONRPCResponse, MCPContext } from '$lib/models/ai/mcp';
import { createErrorResponse, createSuccessResponse } from '../json-rpc';
import { sanitizeErrorMessage } from '../mcp-utils';
import { logRequest } from '../logging/log-queue';

/**
 * MCP-specific error codes (in JSON-RPC custom error range -32000 to -32099)
 */
export const MCP_ERROR_CODES = {
	// Rate limiting
	RATE_LIMITED: -32001,

	// Authentication/Authorization
	AUTHENTICATION_FAILED: -32002,
	MODULE_NOT_ALLOWED: -32003,

	// Tools
	TOOL_NOT_FOUND: -32004,
	TOOL_EXECUTION_FAILED: -32005,

	// Resources
	RESOURCE_NOT_FOUND: -32006,
	RESOURCE_ACCESS_DENIED: -32007,
	RESOURCE_DISABLED: -32008,

	// Prompts
	PROMPT_NOT_FOUND: -32009,
	PROMPT_DISABLED: -32010,
	PROMPT_ARGUMENTS_INVALID: -32011,

	// Timeouts
	TIMEOUT: -32012,

	// Request validation
	REQUEST_TOO_LARGE: -32013,
	INVALID_CONTENT_TYPE: -32014
} as const;

/**
 * MCP error details
 */
export interface MCPErrorDetails {
	code: number;
	message: string;
	data?: Record<string, unknown>;
}

/**
 * Log entry data
 */
export interface LogData {
	method: string;
	toolName?: string;
	resourceName?: string;
	promptName?: string;
	params?: unknown;
	result?: unknown;
	errorMessage?: string;
}

/**
 * Base handler wrapper that handles logging and errors
 *
 * Uses async logging queue for non-blocking log writes.
 *
 * @param context - MCP request context
 * @param requestId - JSON-RPC request ID
 * @param method - MCP method name (for logging)
 * @param handler - The actual handler function
 * @param logData - Optional additional log data
 * @returns JSON-RPC response
 */
export async function withErrorHandling<T>(
	context: MCPContext,
	requestId: number | string,
	method: string,
	handler: () => Promise<T>,
	logData?: LogData
): Promise<JSONRPCResponse> {
	const startTime = Date.now();

	try {
		// Execute the handler
		const result = await handler();

		// Log success asynchronously (excluding initialize which is less critical)
		if (method !== 'initialize') {
			logRequest(
				context,
				String(requestId),
				method,
				result,
				'success',
				Date.now() - startTime,
				undefined,
				logData
			);
		}

		// Return success response
		return createSuccessResponse(requestId, result);
	} catch (error) {
		const errorMessage = sanitizeErrorMessage(error);

		// Log error asynchronously (excluding initialize)
		if (method !== 'initialize') {
			logRequest(
				context,
				String(requestId),
				method,
				null,
				'error',
				Date.now() - startTime,
				errorMessage,
				logData
			);
		}

		// Determine error code based on error message
		let errorCode = -32603; // Internal error
		let errorData: Record<string, unknown> | undefined;

		if (errorMessage.includes('not found')) {
			if (method.startsWith('tools/')) {
				errorCode = MCP_ERROR_CODES.TOOL_NOT_FOUND;
			} else if (method.startsWith('resources/')) {
				errorCode = MCP_ERROR_CODES.RESOURCE_NOT_FOUND;
			} else if (method.startsWith('prompts/')) {
				errorCode = MCP_ERROR_CODES.PROMPT_NOT_FOUND;
			}
		} else if (errorMessage.includes('access denied') || errorMessage.includes('not allowed')) {
			errorCode = MCP_ERROR_CODES.RESOURCE_ACCESS_DENIED;
		} else if (errorMessage.includes('disabled')) {
			if (method.startsWith('resources/')) {
				errorCode = MCP_ERROR_CODES.RESOURCE_DISABLED;
			} else if (method.startsWith('prompts/')) {
				errorCode = MCP_ERROR_CODES.PROMPT_DISABLED;
			}
		} else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
			errorCode = MCP_ERROR_CODES.TIMEOUT;
			const timeoutError = error as { timeout?: number };
			errorData = { timeout: timeoutError.timeout };
		}

		// Return error response
		return createErrorResponse(requestId, errorCode, errorMessage, errorData);
	}
}

/**
 * Create an MCP error response
 */
export function createMCPError(
	requestId: number | string,
	code: number,
	message: string,
	data?: Record<string, unknown>
): JSONRPCResponse {
	return createErrorResponse(requestId, code, message, data);
}

/**
 * Create a rate limit error response
 */
export function createRateLimitError(
	requestId: number | string,
	retryAfter: number,
	limit: number,
	windowMs: number
): JSONRPCResponse {
	return createErrorResponse(requestId, MCP_ERROR_CODES.RATE_LIMITED, 'Rate limit exceeded', {
		retryAfter,
		limit,
		window: `${windowMs / 1000}s`
	});
}

/**
 * Create a timeout error response
 */
export function createTimeoutError(
	requestId: number | string,
	operation: string,
	timeout: number
): JSONRPCResponse {
	return createErrorResponse(
		requestId,
		MCP_ERROR_CODES.TIMEOUT,
		`Operation timed out: ${operation}`,
		{
			operation,
			timeout
		}
	);
}

/**
 * Create a module not allowed error response
 */
export function createModuleNotAllowedError(
	requestId: number | string,
	module: string
): JSONRPCResponse {
	return createErrorResponse(
		requestId,
		MCP_ERROR_CODES.MODULE_NOT_ALLOWED,
		`Module not allowed for this API key: ${module}`,
		{ module }
	);
}

/**
 * Create a tool execution error response (returns success with isError flag for tool errors)
 */
export function createToolExecutionError(
	requestId: number | string,
	errorMessage: string
): JSONRPCResponse {
	// Tool errors in MCP are returned as success with isError: true
	return createSuccessResponse(requestId, {
		content: [
			{
				type: 'text',
				text: JSON.stringify({ error: errorMessage })
			}
		],
		isError: true
	});
}
