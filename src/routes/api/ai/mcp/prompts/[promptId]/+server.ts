/**
 * MCP Prompt Individual Endpoint
 *
 * CRUD operations for individual MCP prompts.
 *
 * GET    /api/ai/mcp/prompts/:id     - Get prompt by ID
 * PUT    /api/ai/mcp/prompts/:id     - Update prompt
 * DELETE /api/ai/mcp/prompts/:id     - Delete prompt
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { McpPromptRepository } from '$lib/repositories/ai/mcp';
import type { UpdatePromptInput } from '$lib/models/ai/mcp';

/**
 * GET - Get prompt by ID
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const repo = new McpPromptRepository();
	const prompt = await repo.getByUserIdAndId(locals.user.id, params.promptId);

	if (!prompt) {
		throw error(404, 'Prompt not found');
	}

	return json(prompt);
};

/**
 * PUT - Update a prompt
 */
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const body = await request.json();

	// Validate input
	const input: UpdatePromptInput = {};

	if (body.name !== undefined) {
		if (!body.name || body.name.trim().length === 0) {
			return json({ error: 'Name is required' }, { status: 400 });
		}
		if (body.name.length > 200) {
			return json({ error: 'Name must be less than 200 characters' }, { status: 400 });
		}
		input.name = body.name;
	}

	if (body.description !== undefined) {
		if (body.description.length > 1000) {
			return json({ error: 'Description must be less than 1000 characters' }, { status: 400 });
		}
		input.description = body.description;
	}

	if (body.arguments !== undefined) {
		if (!Array.isArray(body.arguments)) {
			return json({ error: 'Arguments must be an array' }, { status: 400 });
		}

		// Validate each argument
		for (const arg of body.arguments) {
			if (arg.name && arg.name.length > 100) {
				return json({ error: 'Argument name must be less than 100 characters' }, { status: 400 });
			}
			if (arg.description && arg.description.length > 500) {
				return json({ error: 'Argument description must be less than 500 characters' }, { status: 400 });
			}
		}

		input.arguments = body.arguments;
	}

	if (body.moduleId !== undefined) {
		input.moduleId = body.moduleId;
	}

	if (body.enabled !== undefined) {
		input.enabled = body.enabled;
	}

	const repo = new McpPromptRepository();
	const prompt = await repo.update(params.promptId, locals.user.id, input);

	if (!prompt) {
		throw error(404, 'Prompt not found');
	}

	return json(prompt);
};

/**
 * DELETE - Delete a prompt
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const repo = new McpPromptRepository();
	const success = await repo.delete(params.promptId, locals.user.id);

	if (!success) {
		throw error(404, 'Prompt not found');
	}

	return json({ success: true });
};
