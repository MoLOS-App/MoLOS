/**
 * MCP Resource Type Definitions
 *
 * Types for MCP resource management.
 */

export type MCPResourceType = 'static' | 'url';

/**
 * MCP Resource entity
 */
export interface MCPResource {
	id: string;
	userId: string;
	name: string;
	uri: string;
	moduleId: string | null;
	description: string;
	resourceType: MCPResourceType;
	url?: string | null;
	mimeType: string;
	metadata: Record<string, unknown> | null;
	enabled: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Resource creation input
 */
export interface CreateResourceInput {
	name: string;
	uri: string;
	moduleId?: string | null;
	description: string;
	resourceType?: MCPResourceType;
	url?: string | null;
	mimeType?: string;
	metadata?: Record<string, unknown>;
	enabled?: boolean;
}

/**
 * Resource update input
 */
export interface UpdateResourceInput {
	name?: string;
	uri?: string;
	moduleId?: string | null;
	description?: string;
	resourceType?: MCPResourceType;
	url?: string | null;
	mimeType?: string;
	metadata?: Record<string, unknown>;
	enabled?: boolean;
}

/**
 * Resource list filters
 */
export interface ResourceFilters {
	moduleId?: string;
	enabled?: boolean;
	search?: string; // Search by name or description
}

/**
 * MCP Resource as exposed via protocol
 */
export interface MCPProtocolResource {
	uri: string;
	name: string;
	description: string;
	mimeType?: string;
}

/**
 * Resource content response
 */
export interface ResourceContent {
	uri: string;
	mimeType?: string;
	text?: string;
	blob?: string; // Base64 encoded binary data
	metadata?: Record<string, unknown>;
}
