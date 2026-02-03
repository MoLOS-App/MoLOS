import { getAllModules } from '$lib/config';
import type { ToolDefinition } from '$lib/models/ai';
import { McpResourceRepository, McpPromptRepository } from '$lib/repositories/ai/mcp';
import type {
	CreateResourceInput,
	UpdateResourceInput,
	CreatePromptInput,
	UpdatePromptInput,
	PromptArgument
} from '$lib/models/ai/mcp';

/**
 * This file defines the global/system-level AI tools for MoLOS.
 * Module-specific tools are now defined in their respective module configurations.
 */

export function getCoreAiTools(userId: string): ToolDefinition[] {
	const resourceRepo = new McpResourceRepository();
	const promptRepo = new McpPromptRepository();
	return [
		{
			name: 'get_active_modules',
			description: 'Lists all currently active modules in the system.',
			parameters: {
				type: 'object',
				properties: {}
			},
			execute: async () => {
				const allModules = getAllModules();
				return allModules.map((m) => ({ id: m.id, name: m.name, description: m.description }));
			}
		},
		{
			name: 'get_user_profile',
			description:
				"Retrieves the current user's profile information, including their ID and any relevant settings.",
			parameters: {
				type: 'object',
				properties: {}
			},
			execute: async () => {
				return { userId };
			}
		},
		{
			name: 'get_current_time',
			description:
				'Returns the current date and time in ISO format. Use this to calculate relative dates or timestamps.',
			parameters: {
				type: 'object',
				properties: {}
			},
			execute: async () => {
				return { iso: new Date().toISOString(), timestamp: Math.floor(Date.now() / 1000) };
			}
		},
		{
			name: 'search_codebase',
			description:
				'Searches the codebase for specific patterns or keywords. Use this to understand how modules are implemented or to find specific logic.',
			parameters: {
				type: 'object',
				properties: {
					query: { type: 'string', description: 'The search query or regex pattern.' },
					path: { type: 'string', description: 'Optional subdirectory to limit the search.' }
				},
				required: ['query']
			},
			execute: async () => {
				return { message: 'Codebase search is handled by the system.' };
			}
		},
		{
			name: 'list_files',
			description: 'Lists files in a directory to understand the project structure.',
			parameters: {
				type: 'object',
				properties: {
					path: { type: 'string', description: 'The directory path.' },
					recursive: { type: 'boolean', description: 'Whether to list files recursively.' }
				},
				required: ['path']
			},
			execute: async () => {
				return { message: 'File listing is handled by the system.' };
			}
		},
		{
			name: 'save_memory',
			description:
				'Saves important information about the user, their preferences, or key context for future reference. Use this when the user shares something they want you to remember.',
			parameters: {
				type: 'object',
				properties: {
					content: { type: 'string', description: 'The information to remember.' },
					importance: {
						type: 'number',
						description: 'Importance level from 1 to 5 (5 being most important).',
						minimum: 1,
						maximum: 5
					}
				},
				required: ['content']
			},
			execute: async () => {
				// The actual implementation is handled in AiAgent.executeAction to avoid circular dependencies
				return { success: true, message: 'Memory saved.' };
			}
		},
		// ==================== MCP Resource Tools ====================
		{
			name: 'create_mcp_resource',
			description: 'Creates a new MCP resource. Resources provide data that AI assistants can access via the MCP protocol.',
			parameters: {
				type: 'object',
				properties: {
					name: {
						type: 'string',
						description: 'The name of the resource.'
					},
					uri: {
						type: 'string',
						description: 'The unique URI identifier for the resource (e.g., config://user/profile).'
					},
					description: {
						type: 'string',
						description: 'A description of what this resource provides.'
					},
					resourceType: {
						type: 'string',
						enum: ['static', 'url'],
						description: 'The type of resource: static (stored content) or url (fetched from HTTP/HTTPS).'
					},
					url: {
						type: 'string',
						description: 'The URL to fetch content from (required if resourceType is "url").'
					},
					moduleId: {
						type: 'string',
						description: 'Optional module ID to associate this resource with a specific module.'
					},
					enabled: {
						type: 'boolean',
						description: 'Whether the resource is enabled. Default is true.'
					}
				},
				required: ['name', 'uri', 'description']
			},
			execute: async (params) => {
				const input: CreateResourceInput = {
					name: params.name as string,
					uri: params.uri as string,
					description: params.description as string,
					resourceType: (params.resourceType as 'static' | 'url') ?? 'static',
					url: (params.url as string) ?? null,
					moduleId: (params.moduleId as string) ?? null,
					enabled: (params.enabled as boolean) ?? true
				};
				const resource = await resourceRepo.create(userId, input);
				return {
					success: true,
					resource: {
						id: resource.id,
						name: resource.name,
						uri: resource.uri,
						description: resource.description,
						resourceType: resource.resourceType,
						url: resource.url,
						moduleId: resource.moduleId,
						enabled: resource.enabled
					}
				};
			}
		},
		{
			name: 'list_mcp_resources',
			description: 'Lists all MCP resources for the current user, optionally filtered by module or enabled status.',
			parameters: {
				type: 'object',
				properties: {
					moduleId: {
						type: 'string',
						description: 'Optional module ID to filter resources.'
					},
					enabled: {
						type: 'boolean',
						description: 'Filter by enabled status.'
					},
					limit: {
						type: 'number',
						description: 'Maximum number of resources to return. Default is 50.'
					}
				}
			},
			execute: async (params) => {
				const filters: any = {};
				if (params.moduleId) filters.moduleId = params.moduleId;
				if (params.enabled !== undefined) filters.enabled = params.enabled;

				const pagination: any = {};
				if (params.limit) pagination.limit = params.limit;

				const result = await resourceRepo.listByUserId(userId, filters, pagination);
				return {
					success: true,
					resources: result.items.map((r) => ({
						id: r.id,
						name: r.name,
						uri: r.uri,
						description: r.description,
						resourceType: r.resourceType,
						url: r.url,
						moduleId: r.moduleId,
						enabled: r.enabled,
						createdAt: r.createdAt
					})),
					total: result.total
				};
			}
		},
		{
			name: 'get_mcp_resource',
			description: 'Gets a specific MCP resource by its ID.',
			parameters: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						description: 'The ID of the resource to retrieve.'
					}
				},
				required: ['id']
			},
			execute: async (params) => {
				const resource = await resourceRepo.getByUserIdAndId(userId, params.id as string);
				if (!resource) {
					return {
						success: false,
						error: 'Resource not found or you do not have permission to access it.'
					};
				}
				return {
					success: true,
					resource: {
						id: resource.id,
						name: resource.name,
						uri: resource.uri,
						description: resource.description,
						resourceType: resource.resourceType,
						url: resource.url,
						moduleId: resource.moduleId,
						enabled: resource.enabled,
						mimeType: resource.mimeType,
						metadata: resource.metadata,
						createdAt: resource.createdAt,
						updatedAt: resource.updatedAt
					}
				};
			}
		},
		{
			name: 'update_mcp_resource',
			description: 'Updates an existing MCP resource. Only include the fields you want to change.',
			parameters: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						description: 'The ID of the resource to update.'
					},
					name: {
						type: 'string',
						description: 'New name for the resource.'
					},
					uri: {
						type: 'string',
						description: 'New URI for the resource.'
					},
					description: {
						type: 'string',
						description: 'New description for the resource.'
					},
					resourceType: {
						type: 'string',
						enum: ['static', 'url'],
						description: 'New resource type.'
					},
					url: {
						type: 'string',
						description: 'New URL for URL-based resources.'
					},
					moduleId: {
						type: 'string',
						description: 'New module ID association.'
					},
					enabled: {
						type: 'boolean',
						description: 'New enabled status.'
					}
				},
				required: ['id']
			},
			execute: async (params) => {
				const input: UpdateResourceInput = {};
				if (params.name !== undefined) input.name = params.name as string;
				if (params.uri !== undefined) input.uri = params.uri as string;
				if (params.description !== undefined) input.description = params.description as string;
				if (params.resourceType !== undefined) input.resourceType = params.resourceType as 'static' | 'url';
				if (params.url !== undefined) input.url = params.url as string;
				if (params.moduleId !== undefined) input.moduleId = params.moduleId as string;
				if (params.enabled !== undefined) input.enabled = params.enabled as boolean;

				const resource = await resourceRepo.update(params.id as string, userId, input);
				if (!resource) {
					return {
						success: false,
						error: 'Resource not found or you do not have permission to update it.'
					};
				}
				return {
					success: true,
					resource: {
						id: resource.id,
						name: resource.name,
						uri: resource.uri,
						description: resource.description,
						resourceType: resource.resourceType,
						url: resource.url,
						moduleId: resource.moduleId,
						enabled: resource.enabled
					}
				};
			}
		},
		{
			name: 'delete_mcp_resource',
			description: 'Deletes an MCP resource. This action cannot be undone.',
			parameters: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						description: 'The ID of the resource to delete.'
					}
				},
				required: ['id']
			},
			execute: async (params) => {
				const success = await resourceRepo.delete(params.id as string, userId);
				if (!success) {
					return {
						success: false,
						error: 'Resource not found or you do not have permission to delete it.'
					};
				}
				return {
					success: true,
					message: 'Resource deleted successfully.'
				};
			}
		},
		// ==================== MCP Prompt Tools ====================
		{
			name: 'create_mcp_prompt',
			description: 'Creates a new MCP prompt template. Prompts define reusable message templates that AI assistants can use.',
			parameters: {
				type: 'object',
				properties: {
					name: {
						type: 'string',
						description: 'The name of the prompt.'
					},
					description: {
						type: 'string',
						description: 'A description of what this prompt does.'
					},
					arguments: {
						type: 'array',
						description: 'Array of argument definitions for the prompt.',
						items: {
							type: 'object',
							properties: {
								name: { type: 'string', description: 'Argument name.' },
								description: { type: 'string', description: 'Argument description.' },
								required: {
									type: 'boolean',
									description: 'Whether the argument is required.'
								}
							},
							required: ['name', 'description']
						}
					},
					moduleId: {
						type: 'string',
						description: 'Optional module ID to associate this prompt with a specific module.'
					},
					enabled: {
						type: 'boolean',
						description: 'Whether the prompt is enabled. Default is true.'
					}
				},
				required: ['name', 'description', 'arguments']
			},
			execute: async (params) => {
				const input: CreatePromptInput = {
					name: params.name as string,
					description: params.description as string,
					arguments: (params.arguments as PromptArgument[]).map((arg: any) => ({
						name: arg.name,
						description: arg.description,
						required: arg.required ?? false
					})),
					moduleId: (params.moduleId as string) ?? null,
					enabled: (params.enabled as boolean) ?? true
				};
				const prompt = await promptRepo.create(userId, input);
				return {
					success: true,
					prompt: {
						id: prompt.id,
						name: prompt.name,
						description: prompt.description,
						arguments: prompt.arguments,
						moduleId: prompt.moduleId,
						enabled: prompt.enabled
					}
				};
			}
		},
		{
			name: 'list_mcp_prompts',
			description: 'Lists all MCP prompts for the current user, optionally filtered by module or enabled status.',
			parameters: {
				type: 'object',
				properties: {
					moduleId: {
						type: 'string',
						description: 'Optional module ID to filter prompts.'
					},
					enabled: {
						type: 'boolean',
						description: 'Filter by enabled status.'
					},
					limit: {
						type: 'number',
						description: 'Maximum number of prompts to return. Default is 50.'
					}
				}
			},
			execute: async (params) => {
				const filters: any = {};
				if (params.moduleId) filters.moduleId = params.moduleId;
				if (params.enabled !== undefined) filters.enabled = params.enabled;

				const pagination: any = {};
				if (params.limit) pagination.limit = params.limit;

				const result = await promptRepo.listByUserId(userId, filters, pagination);
				return {
					success: true,
					prompts: result.items.map((p) => ({
						id: p.id,
						name: p.name,
						description: p.description,
						arguments: p.arguments,
						moduleId: p.moduleId,
						enabled: p.enabled,
						createdAt: p.createdAt
					})),
					total: result.total
				};
			}
		},
		{
			name: 'get_mcp_prompt',
			description: 'Gets a specific MCP prompt by its ID.',
			parameters: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						description: 'The ID of the prompt to retrieve.'
					}
				},
				required: ['id']
			},
			execute: async (params) => {
				const prompt = await promptRepo.getByUserIdAndId(userId, params.id as string);
				if (!prompt) {
					return {
						success: false,
						error: 'Prompt not found or you do not have permission to access it.'
					};
				}
				return {
					success: true,
					prompt: {
						id: prompt.id,
						name: prompt.name,
						description: prompt.description,
						arguments: prompt.arguments,
						moduleId: prompt.moduleId,
						enabled: prompt.enabled,
						createdAt: prompt.createdAt,
						updatedAt: prompt.updatedAt
					}
				};
			}
		},
		{
			name: 'update_mcp_prompt',
			description: 'Updates an existing MCP prompt. Only include the fields you want to change.',
			parameters: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						description: 'The ID of the prompt to update.'
					},
					name: {
						type: 'string',
						description: 'New name for the prompt.'
					},
					description: {
						type: 'string',
						description: 'New description for the prompt.'
					},
					arguments: {
						type: 'array',
						description: 'New array of argument definitions for the prompt.',
						items: {
							type: 'object',
							properties: {
								name: { type: 'string', description: 'Argument name.' },
								description: { type: 'string', description: 'Argument description.' },
								required: {
									type: 'boolean',
									description: 'Whether the argument is required.'
								}
							},
							required: ['name', 'description']
						}
					},
					moduleId: {
						type: 'string',
						description: 'New module ID association.'
					},
					enabled: {
						type: 'boolean',
						description: 'New enabled status.'
					}
				},
				required: ['id']
			},
			execute: async (params) => {
				const input: UpdatePromptInput = {};
				if (params.name !== undefined) input.name = params.name as string;
				if (params.description !== undefined) input.description = params.description as string;
				if (params.arguments !== undefined) {
					input.arguments = (params.arguments as PromptArgument[]).map((arg: any) => ({
						name: arg.name,
						description: arg.description,
						required: arg.required ?? false
					}));
				}
				if (params.moduleId !== undefined) input.moduleId = params.moduleId as string;
				if (params.enabled !== undefined) input.enabled = params.enabled as boolean;

				const prompt = await promptRepo.update(params.id as string, userId, input);
				if (!prompt) {
					return {
						success: false,
						error: 'Prompt not found or you do not have permission to update it.'
					};
				}
				return {
					success: true,
					prompt: {
						id: prompt.id,
						name: prompt.name,
						description: prompt.description,
						arguments: prompt.arguments,
						moduleId: prompt.moduleId,
						enabled: prompt.enabled
					}
				};
			}
		},
		{
			name: 'delete_mcp_prompt',
			description: 'Deletes an MCP prompt. This action cannot be undone.',
			parameters: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						description: 'The ID of the prompt to delete.'
					}
				},
				required: ['id']
			},
			execute: async (params) => {
				const success = await promptRepo.delete(params.id as string, userId);
				if (!success) {
					return {
						success: false,
						error: 'Prompt not found or you do not have permission to delete it.'
					};
				}
				return {
					success: true,
					message: 'Prompt deleted successfully.'
				};
			}
		}
	];
}
