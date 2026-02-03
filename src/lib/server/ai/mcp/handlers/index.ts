/**
 * MCP Main Handler
 *
 * Routes MCP JSON-RPC requests to the appropriate handler.
 */

import type { JSONRPCRequest, JSONRPCResponse, MCPContext } from '$lib/models/ai/mcp';
import { isValidJSONRPCRequest, parseMethod, isNotification, errors } from '../json-rpc';
import { handleInitialize } from './initialize-handler';
import { handleToolsMethod } from './tools-handler';
import { handleResourcesMethod } from './resources-handler';
import { handlePromptsMethod } from './prompts-handler';
import { McpLogRepository } from '$lib/repositories/ai/mcp';
import { sanitizeErrorMessage } from '../mcp-utils';

/**
 * Handle an MCP JSON-RPC request
 */
export async function handleMcpRequest(
	context: MCPContext,
	request: JSONRPCRequest | { jsonrpc: '2.0'; method: string; params?: unknown }
): Promise<JSONRPCResponse> {
	const startTime = Date.now();
	let logRepo: McpLogRepository | null = null;

	// Check if this is a notification (no id, no response expected)
	const isNotificationRequest = !('id' in request) || request.id === undefined;

	if (isNotificationRequest) {
		// Notifications don't get responses
		// But we still process them for side effects
		try {
			await routeRequest(context, request as JSONRPCRequest);
		} catch {
			// Ignore errors for notifications
		}
		// Return empty response for notifications
		return {
			jsonrpc: '2.0',
			id: '',
			result: null
		};
	}

	// At this point, we know it's a request with an id
	const req = request as JSONRPCRequest;

	// Log the request
	try {
		logRepo = new McpLogRepository();
		// We'll update this after we get the result
	} catch {
		// Ignore logging errors
	}

	try {
		// Route and handle the request
		const response = await routeRequest(context, req);

		// Extract result for logging
		const result = (response as any).result;

		// Log success (excluding initialize which is logged separately)
		if (logRepo && req.method !== 'initialize') {
			try {
				await logRepo.create({
					userId: context.userId,
					apiKeyId: context.apiKeyId,
					sessionId: context.sessionId,
					requestId: String(req.id),
					method: req.method,
					params: req.params,
					result,
					status: 'success',
					durationMs: Date.now() - startTime
				});
			} catch {
				// Ignore logging errors
			}
		}

		return response as JSONRPCResponse;
	} catch (error) {
		const errorMessage = sanitizeErrorMessage(error);

		// Log error
		if (logRepo) {
			try {
				await logRepo.create({
					userId: context.userId,
					apiKeyId: context.apiKeyId,
					sessionId: context.sessionId,
					requestId: String(req.id),
					method: req.method,
					params: req.params,
					result: null,
					status: 'error',
					errorMessage,
					durationMs: Date.now() - startTime
				});
			} catch {
				// Ignore logging errors
			}
		}

		// Return error response
		return {
			jsonrpc: '2.0',
			id: req.id,
			error: {
				code: -32603,
				message: errorMessage
			}
		};
	}
}

/**
 * Route request to appropriate handler
 */
async function routeRequest(context: MCPContext, request: JSONRPCRequest): Promise<unknown> {
	const { method, action } = parseMethod(request.method);

	switch (method) {
		case 'initialize':
			return handleInitialize(context, request.id, request.params as any);

		case 'tools':
			return handleToolsMethod(context, request.id, request.params, action);

		case 'resources':
			return handleResourcesMethod(context, request.id, request.params, action);

		case 'prompts':
			return handlePromptsMethod(context, request.id, request.params, action);

		default:
			return errors.methodNotFound(request.id);
	}
}

/**
 * Validate and parse MCP request from HTTP POST data
 */
export function parseMcpRequest(data: string): JSONRPCRequest | null {
	try {
		const parsed = JSON.parse(data);
		if (isValidJSONRPCRequest(parsed)) {
			return parsed;
		}
		return null;
	} catch {
		return null;
	}
}
