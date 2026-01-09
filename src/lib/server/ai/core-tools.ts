import { getAllModules } from '$lib/config';
import type { ToolDefinition } from '$lib/models/ai';

/**
 * This file defines the global/system-level AI tools for MoLOS.
 * Module-specific tools are now defined in their respective module configurations.
 */

export function getCoreAiTools(userId: string): ToolDefinition[] {

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
		}
	];
}
