/**
 * MCP Resources Handler
 *
 * Handles resources/list and resources/read methods.
 */

import { listMcpResources, readMcpResource } from '../discovery/resources-discovery';
import { createSuccessResponse, errors } from '../json-rpc';
import type { MCPContext } from '$lib/models/ai/mcp';
import { ResourcesReadRequestParamsSchema, validateRequest } from '../validation/schemas';
import { withErrorHandling, MCP_ERROR_CODES } from './error-handler';

/**
 * Handle resources/list request
 */
export async function handleResourcesList(
	context: MCPContext,
	requestId: number | string
): Promise<ReturnType<typeof createSuccessResponse>> {
	return withErrorHandling(
		context,
		requestId,
		'resources/list',
		async () => {
			const result = await listMcpResources(context);
			return result;
		}
	);
}

/**
 * Handle resources/read request
 */
export async function handleResourcesRead(
	context: MCPContext,
	requestId: number | string,
	params: unknown
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof errors.invalidParams>> {
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
			// Read the resource
			const result = await readMcpResource(context, uri);
			return result;
		},
		{
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
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof errors.invalidParams> | ReturnType<typeof errors.methodNotFound>> {
	if (action === 'list') {
		return handleResourcesList(context, requestId);
	}

	if (action === 'read') {
		return handleResourcesRead(context, requestId, params);
	}

	return errors.methodNotFound(requestId);
}
