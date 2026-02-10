/**
 * MCP Tools Handler
 *
 * Handles tools/list and tools/call methods.
 */

import { AiToolbox } from '../../toolbox';
import { formatToolResult } from '../mcp-utils';
import { createSuccessResponse, createErrorResponse, errors } from '../json-rpc';
import { listMcpTools } from '../discovery/tools-discovery';
import type { MCPContext, ToolsCallRequest, JSONRPCResponse } from '$lib/models/ai/mcp';
import { ToolsCallRequestParamsSchema, validateRequest } from '../validation/schemas';
import {
	withErrorHandling,
	createToolExecutionError,
	createToolParameterValidationError,
	MCP_ERROR_CODES
} from './error-handler';
import { withToolTimeout, TimeoutError } from '../timeout/timeout-handler';
import { normalizeToolParams, validateToolParams } from '../../agent-utils';

/**
 * Handle tools/list request
 */
export async function handleToolsList(
	context: MCPContext,
	requestId: number | string
): Promise<JSONRPCResponse> {
	return withErrorHandling(context, requestId, 'tools/list', async () => {
		const result = await listMcpTools(context);
		return result;
	});
}

/**
 * Handle tools/call request
 */
export async function handleToolsCall(
	context: MCPContext,
	requestId: number | string,
	params: unknown
): Promise<JSONRPCResponse> {
	// Validate params first (outside of error handling wrapper)
	const validation = validateRequest(ToolsCallRequestParamsSchema, params, requestId);

	if (!validation.success) {
		return validation.error;
	}

	const { name, arguments: args } = validation.data;

	// Get the toolbox
	const toolbox = new AiToolbox();

	// Get all available tools for this user
	const tools = await toolbox.getTools(context.userId, context.allowedModules);

	// Find the tool
	const tool = tools.find((t) => t.name === name);

	if (!tool) {
		// Return error immediately
		return createErrorResponse(
			requestId,
			MCP_ERROR_CODES.TOOL_NOT_FOUND,
			`Tool not found: ${name}`
		);
	}

	// Validate tool parameters BEFORE execution
	const normalizedParams = normalizeToolParams(args);
	const paramValidation = validateToolParams(tool, normalizedParams);

	if (!paramValidation.ok) {
		// Return validation error immediately
		return createToolParameterValidationError(requestId, name, {
			missing: paramValidation.missing,
			toolSchema: {
				name: tool.name,
				parameters: tool.parameters
			}
		});
	}

	// Use error handling wrapper for the actual execution only
	return withErrorHandling(
		context,
		requestId,
		'tools/call',
		async () => {
			// Execute the tool with timeout
			try {
				const result = await withToolTimeout(tool.execute(normalizedParams), name);

				// Format for MCP response
				return formatToolResult(result);
			} catch (error) {
				// Handle timeout errors specifically
				if (error instanceof TimeoutError) {
					const timeoutError = new Error(`Tool execution timed out: ${name}`);
					(timeoutError as any).code = MCP_ERROR_CODES.TIMEOUT;
					(timeoutError as any).timeout = error.timeout;
					throw timeoutError;
				}
				throw error;
			}
		},
		{
			method: 'tools/call',
			toolName: name,
			params: normalizedParams
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
): Promise<
	| ReturnType<typeof createSuccessResponse>
	| ReturnType<typeof errors.invalidParams>
	| ReturnType<typeof errors.methodNotFound>
> {
	if (action === 'list') {
		return handleToolsList(context, requestId);
	}

	if (action === 'call') {
		return handleToolsCall(context, requestId, params);
	}

	return errors.methodNotFound(requestId);
}
