/**
 * MCP Prompts Management Endpoint
 *
 * CRUD operations for MCP prompts.
 *
 * GET    /api/ai/mcp/prompts        - List all prompts for user
 * POST   /api/ai/mcp/prompts        - Create new prompt
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { McpPromptRepository } from '$lib/repositories/ai/mcp';
import type { CreatePromptInput, UpdatePromptInput, PromptFilters } from '$lib/models/ai/mcp';

/**
 * GET - List prompts for the authenticated user
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const repo = new McpPromptRepository();

	// Parse query parameters
	const filters: PromptFilters = {
		moduleId: url.searchParams.get('moduleId') ?? undefined,
		enabled: url.searchParams.get('enabled') === 'true'
			? true
			: url.searchParams.get('enabled') === 'false'
				? false
				: undefined,
		search: url.searchParams.get('search') ?? undefined
	};

	const page = parseInt(url.searchParams.get('page') ?? '1');
	const limit = parseInt(url.searchParams.get('limit') ?? '50');

	const result = await repo.listByUserId(locals.user.id, filters, { page, limit });

	return json(result);
};

/**
 * POST - Create a new prompt
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const body = await request.json();

	// Validate input
	const input: CreatePromptInput = {
		name: body.name,
		description: body.description ?? '',
		arguments: body.arguments ?? [],
		moduleId: body.moduleId ?? null,
		enabled: body.enabled ?? true
	};

	// Validate name
	if (!input.name || input.name.trim().length === 0) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	if (input.name.length > 200) {
		return json({ error: 'Name must be less than 200 characters' }, { status: 400 });
	}

	// Validate description
	if (input.description && input.description.length > 1000) {
		return json({ error: 'Description must be less than 1000 characters' }, { status: 400 });
	}

	// Validate arguments array
	if (!Array.isArray(input.arguments)) {
		return json({ error: 'Arguments must be an array' }, { status: 400 });
	}

	// Validate each argument
	for (const arg of input.arguments) {
		if (!arg.name || arg.name.trim().length === 0) {
			return json({ error: 'Each argument must have a name' }, { status: 400 });
		}
		if (arg.name.length > 100) {
			return json({ error: 'Argument name must be less than 100 characters' }, { status: 400 });
		}
		if (arg.description && arg.description.length > 500) {
			return json({ error: 'Argument description must be less than 500 characters' }, { status: 400 });
		}
	}

	const repo = new McpPromptRepository();
	const prompt = await repo.create(locals.user.id, input);

	return json(prompt, { status: 201 });
};
