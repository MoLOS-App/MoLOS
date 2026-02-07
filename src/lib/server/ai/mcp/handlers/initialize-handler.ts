/**
 * MCP Initialize Handler
 *
 * Handles the initialize method for MCP protocol handshake.
 */

import type { InitializeRequestParams, InitializeResult, MCPContext } from '$lib/models/ai/mcp';
import { getToolCountByModule } from '../discovery/tools-discovery';
import { getResourceCountByModule } from '../discovery/resources-discovery';
import { getPromptCountByModule } from '../discovery/prompts-discovery';
import { createSuccessResponse, errors } from '../json-rpc';
import { InitializeRequestParamsSchema, validateRequest } from '../validation/schemas';

/**
 * MCP Server info
 */
const SERVER_INFO = {
	name: 'MoLOS MCP',
	version: '1.0.0'
};

/**
 * MCP Server capabilities
 */
const SERVER_CAPABILITIES = {
	tools: {},
	resources: {
		subscribe: false
	},
	prompts: {}
};

/**
 * Handle initialize request
 * Returns a full JSON-RPC response
 */
export async function handleInitialize(
	context: MCPContext,
	requestId: number | string,
	params: unknown
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof errors.invalidParams>> {
	// Validate params
	const validation = validateRequest(InitializeRequestParamsSchema, params, requestId);

	if (!validation.success) {
		return validation.error;
	}

	const { protocolVersion } = validation.data;

	// Validate protocol version - accept 2024-* and 2025-* spec
	// Note: Schema already validates format
	if (!protocolVersion.startsWith('2024-') && !protocolVersion.startsWith('2025-')) {
		return errors.invalidParams(requestId, {
			reason: 'Unsupported protocol version. Supported: 2024-* or 2025-*'
		});
	}

	// Get capabilities based on available tools/resources/prompts
	const toolCounts = await getToolCountByModule(context);
	const resourceCounts = await getResourceCountByModule(context);
	const promptCounts = await getPromptCountByModule(context);

	// Return the highest protocol version we support that's compatible with client's request
	// If client sends 2024-*, we respond with 2024-11-05
	// If client sends 2025-*, we respond with 2025-06-18
	const responseProtocolVersion = protocolVersion.startsWith('2025-') ? '2025-06-18' : '2024-11-05';

	const result: InitializeResult = {
		protocolVersion: responseProtocolVersion,
		capabilities: {
			tools: {},
			resources: {}
		},
		serverInfo: {
			...SERVER_INFO
		}
	};

	return createSuccessResponse(requestId, result);
}

/**
 * Get server info
 */
export function getServerInfo() {
	return {
		info: SERVER_INFO,
		capabilities: SERVER_CAPABILITIES
	};
}
