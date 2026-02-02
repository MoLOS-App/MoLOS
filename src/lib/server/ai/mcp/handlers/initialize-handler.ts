/**
 * MCP Initialize Handler
 *
 * Handles the initialize method for MCP protocol handshake.
 */

import type { InitializeRequestParams, InitializeResult, MCPContext } from '$lib/models/ai/mcp';
import { createSuccessResponse, errors } from '../json-rpc';
import { getToolCountByModule } from '../discovery/tools-discovery';
import { getResourceCountByModule } from '../discovery/resources-discovery';
import { getPromptCountByModule } from '../discovery/prompts-discovery';

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
 */
export async function handleInitialize(
	context: MCPContext,
	params: InitializeRequestParams
): Promise<ReturnType<typeof createSuccessResponse>> {
	// Validate protocol version
	if (!params.protocolVersion.startsWith('2024-')) {
		return errors.invalidParams(null, {
			reason: 'Unsupported protocol version',
			supported: '2024-*'
		});
	}

	// Get capabilities based on available tools/resources/prompts
	const toolCounts = await getToolCountByModule(context);
	const resourceCounts = await getResourceCountByModule(context);
	const promptCounts = await getPromptCountByModule(context);

	const result: InitializeResult = {
		protocolVersion: '2024-11-05',
		capabilities: {
			tools: {},
			resources: {
				subscribe: false
			},
			prompts: {}
		},
		serverInfo: {
			...SERVER_INFO,
			// Add metadata about available resources
			metadata: {
				modules: {
					tools: toolCounts,
					resources: resourceCounts,
					prompts: promptCounts
				}
			}
		}
	};

	return createSuccessResponse(1, result);
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
