/**
 * MCP Resources Handler
 *
 * Handles resources/list and resources/read methods.
 */

import { listMcpResources, readMcpResource } from '../discovery/resources-discovery';
import { McpLogRepository } from '$lib/repositories/ai/mcp';
import { createSuccessResponse, errors, parseMethod } from '../json-rpc';
import { sanitizeErrorMessage } from '../mcp-utils';
import type { MCPContext, ResourcesListRequest, ResourcesReadRequest } from '$lib/models/ai/mcp';

/**
 * Handle resources/list request
 */
export async function handleResourcesList(
	context: MCPContext,
	_requestId: number | string
): Promise<ReturnType<typeof createSuccessResponse>> {
	const result = await listMcpResources(context);
	return createSuccessResponse(_requestId, result);
}

/**
 * Handle resources/read request
 */
export async function handleResourcesRead(
	context: MCPContext,
	requestId: number | string,
	params: ResourcesReadRequest['params']
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof errors.invalidParams>> {
	const { uri } = params;

	if (!uri) {
		return errors.invalidParams(requestId, {
			reason: 'Missing URI'
		});
	}

	const startTime = Date.now();
	let logRepo: McpLogRepository | null = null;

	try {
		// Read the resource
		const result = await readMcpResource(context, uri);

		// Log success
		logRepo = new McpLogRepository();
		await logRepo.create({
			userId: context.userId,
			apiKeyId: context.apiKeyId,
			sessionId: context.sessionId,
			requestId: String(requestId),
			method: 'resources/read',
			resourceName: uri,
			params,
			result,
			status: 'success',
			durationMs: Date.now() - startTime
		});

		return createSuccessResponse(requestId, result);
	} catch (error) {
		// Log error
		if (!logRepo) {
			logRepo = new McpLogRepository();
		}

		try {
			await logRepo.create({
				userId: context.userId,
				apiKeyId: context.apiKeyId,
				sessionId: context.sessionId,
				requestId: String(requestId),
				method: 'resources/read',
				resourceName: uri,
				params,
				result: null,
				status: 'error',
				errorMessage: sanitizeErrorMessage(error),
				durationMs: Date.now() - startTime
			});
		} catch {
			// Ignore logging errors
		}

		// Return error response
		return errors.internalError(requestId, {
			reason: sanitizeErrorMessage(error)
		});
	}
}

/**
 * Handle any resources method
 */
export async function handleResourcesMethod(
	context: MCPContext,
	requestId: number | string,
	params: unknown
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof errors.invalidParams> | ReturnType<typeof errors.methodNotFound>> {
	const { action } = parseMethod('resources');

	if (action === 'list') {
		return handleResourcesList(context, requestId);
	}

	if (action === 'read') {
		return handleResourcesRead(context, requestId, params as ResourcesReadRequest['params']);
	}

	return errors.methodNotFound(requestId);
}
