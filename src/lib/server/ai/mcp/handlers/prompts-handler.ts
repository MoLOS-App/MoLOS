/**
 * MCP Prompts Handler
 *
 * Handles prompts/list and prompts/get methods.
 */

import { listMcpPrompts, getMcpPrompt } from '../discovery/prompts-discovery';
import { McpLogRepository } from '$lib/repositories/ai/mcp';
import { createSuccessResponse, errors, parseMethod } from '../json-rpc';
import { sanitizeErrorMessage } from '../mcp-utils';
import type { MCPContext, PromptsListRequest, PromptsGetRequest } from '$lib/models/ai/mcp';

/**
 * Handle prompts/list request
 */
export async function handlePromptsList(
	context: MCPContext,
	_requestId: number | string
): Promise<ReturnType<typeof createSuccessResponse>> {
	const result = await listMcpPrompts(context);
	return createSuccessResponse(_requestId, result);
}

/**
 * Handle prompts/get request
 */
export async function handlePromptsGet(
	context: MCPContext,
	requestId: number | string,
	params: PromptsGetRequest['params']
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof errors.invalidParams>> {
	const { name, arguments: args = {} } = params;

	if (!name) {
		return errors.invalidParams(requestId, {
			reason: 'Missing prompt name'
		});
	}

	const startTime = Date.now();
	let logRepo: McpLogRepository | null = null;

	try {
		// Get the prompt
		const result = await getMcpPrompt(context, name, args);

		// Log success
		logRepo = new McpLogRepository();
		await logRepo.create({
			userId: context.userId,
			apiKeyId: context.apiKeyId,
			sessionId: context.sessionId,
			requestId: String(requestId),
			method: 'prompts/get',
			promptName: name,
			params: args,
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
				method: 'prompts/get',
				promptName: name,
				params: args,
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
 * Handle any prompts method
 */
export async function handlePromptsMethod(
	context: MCPContext,
	requestId: number | string,
	params: unknown
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof errors.invalidParams> | ReturnType<typeof errors.methodNotFound>> {
	const { action } = parseMethod('prompts');

	if (action === 'list') {
		return handlePromptsList(context, requestId);
	}

	if (action === 'get') {
		return handlePromptsGet(context, requestId, params as PromptsGetRequest['params']);
	}

	return errors.methodNotFound(requestId);
}
