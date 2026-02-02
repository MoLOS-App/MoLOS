/**
 * MCP Resources Discovery Service
 *
 * Discovers and formats resources for MCP protocol.
 */

import { McpResourceRepository } from '$lib/repositories/ai/mcp';
import type { MCPProtocolResource, ResourceContent, MCPContext } from '$lib/models/ai/mcp';

/**
 * Get available resources for MCP protocol
 *
 * Returns resources that match the context's allowed modules.
 */
export async function getMcpResources(context: MCPContext): Promise<MCPProtocolResource[]> {
	const repo = new McpResourceRepository();

	// Get enabled resources scoped to user and allowed modules
	const resources = await repo.listEnabledForMcp(context.userId, context.allowedModules);

	return resources.map((r) => ({
		uri: r.uri,
		name: r.name,
		description: r.description,
		mimeType: r.mimeType ?? 'application/json'
	}));
}

/**
 * List resources for MCP resources/list endpoint
 */
export async function listMcpResources(context: MCPContext): Promise<{
	resources: MCPProtocolResource[];
}> {
	const resources = await getMcpResources(context);
	return { resources };
}

/**
 * Read a resource by URI
 */
export async function readMcpResource(context: MCPContext, uri: string): Promise<{
	contents: ResourceContent[];
}> {
	const repo = new McpResourceRepository();

	// Find the resource
	const resource = await repo.getByUri(uri);

	if (!resource) {
		throw new Error(`Resource not found: ${uri}`);
	}

	// Verify ownership
	if (resource.userId !== context.userId) {
		throw new Error('Access denied to this resource');
	}

	// Check if enabled
	if (!resource.enabled) {
		throw new Error('Resource is disabled');
	}

	// Check module scope
	if (context.allowedModules.length > 0 && !context.allowedModules.includes(resource.moduleId)) {
		throw new Error('Module not allowed for this API key');
	}

	// In a full implementation, we would:
	// 1. Call the module's resource handler to get actual data
	// 2. Format the response based on the resource type
	// For now, return a placeholder response
	const content: ResourceContent = {
		uri,
		mimeType: resource.mimeType ?? 'application/json',
		text: JSON.stringify({
			_id: resource.id,
			_name: resource.name,
			_module: resource.moduleId,
			_description: resource.description,
			_metadata: resource.metadata
		}, null, 2),
		metadata: resource.metadata ?? undefined
	};

	return { contents: [content] };
}

/**
 * Get resources by module
 */
export async function getResourcesByModule(
	context: MCPContext,
	moduleId: string
): Promise<MCPProtocolResource[]> {
	const allResources = await getMcpResources(context);
	return allResources.filter((r) => r.uri.startsWith(`mcp://molos/${moduleId}/`));
}

/**
 * Get resource count by module
 */
export async function getResourceCountByModule(context: MCPContext): Promise<
Record<string, number>
> {
	const resources = await getMcpResources(context);

	const counts: Record<string, number> = {};

	for (const resource of resources) {
		const match = resource.uri.match(/mcp:\/\/molos\/([^\/]+)/);
		if (match) {
			const moduleId = match[1];
			counts[moduleId] = (counts[moduleId] ?? 0) + 1;
		}
	}

	return counts;
}
