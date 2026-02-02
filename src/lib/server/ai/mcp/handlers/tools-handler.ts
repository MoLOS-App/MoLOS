/**
 * MCP Tools Handler
 *
 * Handles tools/list and tools/call methods.
 */

import { AiToolbox } from '../toolbox';
import { formatToolResult, sanitizeErrorMessage } from '../mcp-utils';
import { createSuccessResponse, errors, parseMethod } from '../json-rpc';
import { listMcpTools } from '../discovery/tools-discovery';
import { McpLogRepository } from '$lib/repositories/ai/mcp';
import type { MCPContext, ToolsListRequest, ToolsCallRequest } from '$lib/models/ai/mcp';

/**
 * Handle tools/list request
 */
export async function handleToolsList(
	context: MCPContext,
	_requestId: number | string
): Promise<ReturnType<typeof createSuccessResponse>> {
	const result = await listMcpTools(context);
	return createSuccessResponse(_requestId, result);
}

/**
 * Handle tools/call request
 */
export async function handleToolsCall(
	context: MCPContext,
	requestId: number | string,
	params: ToolsCallRequest['params']
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof errors.invalidParams>> {
	const { name, arguments: args = {} } = params;

	if (!name) {
		return errors.invalidParams(requestId, {
			reason: 'Missing tool name'
		});
	}

	const startTime = Date.now();
	let logRepo: McpLogRepository | null = null;

	try {
		// Get the toolbox
		const toolbox = new AiToolbox();

		// Get all available tools for this user
		const tools = await toolbox.getTools(context.userId, context.allowedModules);

		// Find the tool
		const tool = tools.find((t) => t.name === name);

		if (!tool) {
			return errors.methodNotFound(requestId);
		}

		// Execute the tool
		const result = await tool.execute(args);

		// Format for MCP response
		const formatted = formatToolResult(result);

		// Log success
		logRepo = new McpLogRepository();
		await logRepo.create({
			userId: context.userId,
			apiKeyId: context.apiKeyId,
			sessionId: context.sessionId,
			requestId: String(requestId),
			method: 'tools/call',
			toolName: name,
			params: args,
			result,
			status: 'success',
			durationMs: Date.now() - startTime
		});

		return createSuccessResponse(requestId, formatted);
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
				method: 'tools/call',
				toolName: name,
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
		return createSuccessResponse(requestId, {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						error: sanitizeErrorMessage(error)
					})
				}
			],
			isError: true
		});
	}
}

/**
 * Handle any tools method
 */
export async function handleToolsMethod(
	context: MCPContext,
	requestId: number | string,
	params: unknown
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof errors.invalidParams> | ReturnType<typeof errors.methodNotFound>> {
	const { method, action } = parseMethod('tools');

	if (action === 'list') {
		return handleToolsList(context, requestId);
	}

	if (action === 'call') {
		return handleToolsCall(context, requestId, params as ToolsCallRequest['params']);
	}

	return errors.methodNotFound(requestId);
}
