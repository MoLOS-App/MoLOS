/**
 * MCP Tools Handler
 *
 * Handles tools/list and tools/call methods.
 */

import { AiToolbox } from '../../toolbox';
import { formatToolResult } from '../mcp-utils';
import { createSuccessResponse, errors } from '../json-rpc';
import { listMcpTools } from '../discovery/tools-discovery';
import type { MCPContext, ToolsCallRequest } from '$lib/models/ai/mcp';
import { ToolsCallRequestParamsSchema, validateRequest } from '../validation/schemas';
import { withErrorHandling, createToolExecutionError, MCP_ERROR_CODES } from './error-handler';

/**
 * Handle tools/list request
 */
export async function handleToolsList(
	context: MCPContext,
	requestId: number | string
): Promise<ReturnType<typeof createSuccessResponse>> {
	return withErrorHandling(
		context,
		requestId,
		'tools/list',
		async () => {
			const result = await listMcpTools(context);
			return result;
		}
	);
}

/**
 * Handle tools/call request
 */
export async function handleToolsCall(
	context: MCPContext,
	requestId: number | string,
	params: unknown
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof errors.invalidParams>> {
	// Validate params first (outside of error handling wrapper)
	const validation = validateRequest(ToolsCallRequestParamsSchema, params, requestId);

	if (!validation.success) {
		return validation.error;
	}

	const { name, arguments: args } = validation.data;

	// Use error handling wrapper for the actual execution
	return withErrorHandling(
		context,
		requestId,
		'tools/call',
		async () => {
			// Get the toolbox
			const toolbox = new AiToolbox();

			// Get all available tools for this user
			const tools = await toolbox.getTools(context.userId, context.allowedModules);

			// Find the tool
			const tool = tools.find((t) => t.name === name);

			if (!tool) {
				// Throw to be caught by error handler
				const error = new Error(`Tool not found: ${name}`);
				(error as any).code = MCP_ERROR_CODES.TOOL_NOT_FOUND;
				throw error;
			}

			// Execute the tool
			const result = await tool.execute(args);

			// Format for MCP response
			return formatToolResult(result);
		},
		{
			toolName: name,
			params: args
		}
	);
}

/**
 * Handle any tools method
 */
export async function handleToolsMethod(
	context: MCPContext,
	requestId: number | string,
	params: unknown,
	action?: string
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof errors.invalidParams> | ReturnType<typeof errors.methodNotFound>> {
	if (action === 'list') {
		return handleToolsList(context, requestId);
	}

	if (action === 'call') {
		return handleToolsCall(context, requestId, params);
	}

	return errors.methodNotFound(requestId);
}
