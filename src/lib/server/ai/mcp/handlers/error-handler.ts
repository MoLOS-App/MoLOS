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
	INVALID_CONTENT_TYPE: -32014,
	INVALID_TOOL_PARAMETERS: -32015,

	// Database/Validation errors
	DATABASE_VALIDATION_ERROR: -32016
} as const;

/**
 * Categorize an error based on its message
 */
function categorizeError(errorMessage: string): { code: number; data?: Record<string, unknown> } {
	const lowerMessage = errorMessage.toLowerCase();

	// Database validation errors (enum, constraint violations)
	if (
		lowerMessage.includes('invalid value for column') ||
		lowerMessage.includes('expected:') ||
		lowerMessage.includes('constraint') ||
		lowerMessage.includes('violates')
	) {
		// Extract helpful information from the error
		const columnMatch = errorMessage.match(/column\s+(\w+)/i);
		const expectedMatch = errorMessage.match(/expected:\s*([^|]+)/i);
		const foundMatch = errorMessage.match(/found:\s*(\w+)/i);
		const suggestionMatch = errorMessage.match(/did you mean:\s*([^?]+)/i);

		return {
			code: MCP_ERROR_CODES.DATABASE_VALIDATION_ERROR,
			data: {
				type: 'validation_error',
				column: columnMatch?.[1],
				expected: expectedMatch?.[1]
					?.trim()
					.split(',')
					.map((s) => s.trim()),
				found: foundMatch?.[1],
				suggestions: suggestionMatch?.[1]
					?.trim()
					.split(',')
					.map((s) => s.trim())
			}
		};
	}

	// Not found errors
	if (lowerMessage.includes('not found')) {
		return { code: MCP_ERROR_CODES.TOOL_NOT_FOUND };
	}

	// Access denied
	if (lowerMessage.includes('access denied') || lowerMessage.includes('not allowed')) {
		return { code: MCP_ERROR_CODES.RESOURCE_ACCESS_DENIED };
	}

	// Disabled resources
	if (lowerMessage.includes('disabled')) {
		return { code: MCP_ERROR_CODES.RESOURCE_DISABLED };
	}

	// Timeout
	if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
		return { code: MCP_ERROR_CODES.TIMEOUT };
	}

	// Default to internal error
	return { code: -32603 };
}

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
				'error',
				Date.now() - startTime,
				errorMessage,
				logData
			);
		}

		// Categorize the error for better error codes
		const { code: errorCode, data: errorData } = categorizeError(errorMessage);

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

/**
 * Create a tool parameter validation error response
 * Returns a structured error that helps the AI understand what's missing
 */
export function createToolParameterValidationError(
	requestId: number | string,
	toolName: string,
	validation: {
		missing: string[];
		toolSchema: {
			name: string;
			parameters: {
				type: 'object';
				properties: Record<string, unknown>;
				required?: string[];
			};
		};
	}
): JSONRPCResponse {
	const { missing, toolSchema } = validation;

	// Build a clear error message
	let message = `Tool "${toolName}" is missing required parameters`;
	if (missing.length > 0) {
		message += `: ${missing.join(', ')}`;
	}

	// Include schema hints in the error data
	const errorData = {
		toolName,
		missingParameters: missing,
		expectedSchema: {
			required: toolSchema.parameters.required || [],
			properties: Object.keys(toolSchema.parameters.properties)
		}
	};

	return createErrorResponse(
		requestId,
		MCP_ERROR_CODES.INVALID_TOOL_PARAMETERS,
		message,
		errorData
	);
}
