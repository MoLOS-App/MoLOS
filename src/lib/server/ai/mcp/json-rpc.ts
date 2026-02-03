/**
 * JSON-RPC 2.0 Utilities
 *
 * Helper functions for creating and handling JSON-RPC 2.0 messages.
 * See: https://www.jsonrpc.org/specification
 */

import type {
	JSONRPCRequest,
	JSONRPCResponse,
	JSONRPCSuccessResponse,
	JSONRPCErrorResponse,
	JSONRPCNotification
} from '$lib/models/ai/mcp';

/**
 * Standard JSON-RPC error codes
 */
export const JSONRPC_ERROR_CODES = {
	PARSE_ERROR: -32700,
	INVALID_REQUEST: -32600,
	METHOD_NOT_FOUND: -32601,
	INVALID_PARAMS: -32602,
	INTERNAL_ERROR: -32603
} as const;

/**
 * Create a JSON-RPC success response
 */
export function createSuccessResponse(
	id: number | string,
	result: unknown
): JSONRPCSuccessResponse {
	return {
		jsonrpc: '2.0',
		id,
		result
	};
}

/**
 * Create a JSON-RPC error response
 */
export function createErrorResponse(
	id: number | string | null,
	code: number,
	message: string,
	data?: unknown
): JSONRPCErrorResponse {
	return {
		jsonrpc: '2.0',
		id,
		error: {
			code,
			message,
			...(data !== undefined && { data })
		}
	};
}

/**
 * Create standard error responses
 */
export const errors = {
	parseError: (id: number | string | null = null) =>
		createErrorResponse(id, JSONRPC_ERROR_CODES.PARSE_ERROR, 'Parse error'),
	invalidRequest: (id: number | string | null = null) =>
		createErrorResponse(id, JSONRPC_ERROR_CODES.INVALID_REQUEST, 'Invalid Request'),
	methodNotFound: (id: number | string | null = null) =>
		createErrorResponse(id, JSONRPC_ERROR_CODES.METHOD_NOT_FOUND, 'Method not found'),
	invalidParams: (id: number | string | null = null, data?: unknown) =>
		createErrorResponse(id, JSONRPC_ERROR_CODES.INVALID_PARAMS, 'Invalid params', data),
	internalError: (id: number | string | null = null, data?: unknown) =>
		createErrorResponse(id, JSONRPC_ERROR_CODES.INTERNAL_ERROR, 'Internal error', data)
};

/**
 * Validate JSON-RPC request
 */
export function isValidJSONRPCRequest(data: unknown): data is JSONRPCRequest {
	if (typeof data !== 'object' || data === null) {
		return false;
	}

	const req = data as Record<string, unknown>;

	return (
		req.jsonrpc === '2.0' &&
		typeof req.method === 'string' &&
		(req.id === undefined || typeof req.id === 'string' || typeof req.id === 'number')
	);
}

/**
 * Check if request is a notification (no id, no response expected)
 */
export function isNotification(
	request: JSONRPCRequest | JSONRPCNotification
): request is JSONRPCNotification {
	return request.id === undefined;
}

/**
 * Extract method name from request (e.g., "tools/list" -> method="tools", action="list")
 */
export function parseMethod(method: string): { method: string; action?: string } {
	const parts = method.split('/');
	return {
		method: parts[0],
		action: parts[1]
	};
}

/**
 * Create a notification message (no response expected)
 */
export function createNotification(method: string, params?: unknown): JSONRPCNotification {
	return {
		jsonrpc: '2.0',
		method,
		...(params !== undefined && { params })
	};
}
