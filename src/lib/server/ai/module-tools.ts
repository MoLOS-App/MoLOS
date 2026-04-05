import type { ToolDefinition } from '$lib/models/ai';

/**
 * Registry of AI tool fetching functions for each module.
 * This is kept on the server side to avoid importing server-only code into the client.
 */
export const MODULE_AI_TOOLS: Record<
	string,
	(userId: string) => ToolDefinition[] | Promise<ToolDefinition[]>
> = {};
