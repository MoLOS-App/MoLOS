/**
 * MCP Prompts Handler
 *
 * Handles prompts/list and prompts/get methods.
 */

import { listMcpPrompts, getMcpPrompt } from '../discovery/prompts-discovery';
import { createSuccessResponse, errors } from '../json-rpc';
import type { MCPContext } from '$lib/models/ai/mcp';
import { PromptsGetRequestParamsSchema, validateRequest } from '../validation/schemas';
import { withErrorHandling, MCP_ERROR_CODES } from './error-handler';

/**
 * Handle prompts/list request
 */
export async function handlePromptsList(
	context: MCPContext,
	requestId: number | string
): Promise<ReturnType<typeof createSuccessResponse>> {
	return withErrorHandling(
		context,
		requestId,
		'prompts/list',
		async () => {
			const result = await listMcpPrompts(context);
			return result;
		}
	);
}

/**
 * Handle prompts/get request
 */
export async function handlePromptsGet(
	context: MCPContext,
	requestId: number | string,
	params: unknown
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof errors.invalidParams>> {
	// Validate params first
	const validation = validateRequest(PromptsGetRequestParamsSchema, params, requestId);

	if (!validation.success) {
		return validation.error;
	}

	const { name, arguments: args } = validation.data;

	// Use error handling wrapper
	return withErrorHandling(
		context,
		requestId,
		'prompts/get',
		async () => {
			// Get the prompt
			const result = await getMcpPrompt(context, name, args);
			return result;
		},
		{
			promptName: name,
			params: args
		}
	);
}

/**
 * Handle any prompts method
 */
export async function handlePromptsMethod(
	context: MCPContext,
	requestId: number | string,
	params: unknown,
	action?: string
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof errors.invalidParams> | ReturnType<typeof errors.methodNotFound>> {
	if (action === 'list') {
		return handlePromptsList(context, requestId);
	}

	if (action === 'get') {
		return handlePromptsGet(context, requestId, params);
	}

	return errors.methodNotFound(requestId);
}
