/**
 * MCP Prompt Type Definitions
 *
 * Types for MCP prompt template management.
 */

/**
 * Prompt argument definition
 */
export interface PromptArgument {
	name: string;
	description: string;
	required?: boolean;
}

/**
 * MCP Prompt entity
 */
export interface MCPPrompt {
	id: string;
	userId: string;
	name: string;
	description: string;
	arguments: PromptArgument[];
	moduleId: string | null;
	enabled: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Prompt creation input
 */
export interface CreatePromptInput {
	name: string;
	description: string;
	arguments: PromptArgument[];
	moduleId?: string | null;
	enabled?: boolean;
}

/**
 * Prompt update input
 */
export interface UpdatePromptInput {
	name?: string;
	description?: string;
	arguments?: PromptArgument[];
	moduleId?: string | null;
	enabled?: boolean;
}

/**
 * Prompt list filters
 */
export interface PromptFilters {
	moduleId?: string;
	enabled?: boolean;
	search?: string; // Search by name or description
}

/**
 * MCP Prompt as exposed via protocol
 */
export interface MCPProtocolPrompt {
	name: string;
	description: string;
	arguments: PromptArgument[];
}

/**
 * Prompt get request with arguments
 */
export interface PromptGetRequest {
	name: string;
	arguments?: Record<string, unknown>;
}

/**
 * Prompt message (result of prompt/get)
 */
export interface PromptMessage {
	role: 'user' | 'assistant' | 'system';
	content: {
		type: 'text';
		text: string;
	};
}
