/**
 * MCP Resources Handler
 *
 * Handles resources/list and resources/read methods.
 */

import { listMcpResources, readMcpResource } from '../discovery/resources-discovery';
import { createSuccessResponse, errors } from '../json-rpc';
import type { MCPContext, JSONRPCResponse } from '$lib/models/ai/mcp';
import { ResourcesReadRequestParamsSchema, validateRequest } from '../validation/schemas';
import { withErrorHandling, MCP_ERROR_CODES } from './error-handler';
import { withResourceTimeout, TimeoutError } from '../timeout/timeout-handler';

/**
 * Handle resources/list request
 */
export async function handleResourcesList(
	context: MCPContext,
	requestId: number | string
): Promise<JSONRPCResponse> {
	return withErrorHandling(context, requestId, 'resources/list', async () => {
		const result = await listMcpResources(context);
		return result;
	});
}

/**
 * Handle resources/read request
 */
export async function handleResourcesRead(
	context: MCPContext,
	requestId: number | string,
	params: unknown
): Promise<JSONRPCResponse> {
	// Validate params first
	const validation = validateRequest(ResourcesReadRequestParamsSchema, params, requestId);

	if (!validation.success) {
		return validation.error;
	}

	const { uri } = validation.data;

	// Use error handling wrapper
	return withErrorHandling(
		context,
		requestId,
		'resources/read',
		async () => {
			// Read the resource with timeout
			try {
				const result = await withResourceTimeout(readMcpResource(context, uri), uri);
				return result;
			} catch (error) {
				// Handle timeout errors specifically
				if (error instanceof TimeoutError) {
					const timeoutError = new Error(`Resource read timed out: ${uri}`);
					(timeoutError as any).code = MCP_ERROR_CODES.TIMEOUT;
					(timeoutError as any).timeout = error.timeout;
					throw timeoutError;
				}
				throw error;
			}
		},
		{
			method: 'resources/read',
			resourceName: uri,
			params
		}
	);
}

/**
 * Handle any resources method
 */
export async function handleResourcesMethod(
	context: MCPContext,
	requestId: number | string,
	params: unknown,
	action?: string
): Promise<JSONRPCResponse> {
	if (action === 'list') {
		return handleResourcesList(context, requestId);
	}

	if (action === 'read') {
		return handleResourcesRead(context, requestId, params);
	}

	return errors.methodNotFound(requestId);
}
