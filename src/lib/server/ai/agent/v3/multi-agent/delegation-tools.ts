/**
 * Delegation Tools - Multi-Agent Communication
 *
 * Creates tools that allow the central Architect agent to delegate
 * tasks to specialized module agents (e.g., MoLOS-Tasks, MoLOS-Calendar).
 */

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import type { ModuleAgentConfig, ModuleAgentResult } from '../types';

/**
 * Get authentication token for module communication
 */
function getModuleAuthToken(_moduleId: string): string {
	// In production, this would fetch from secure storage or generate JWT
	// For now, return a placeholder
	return `module-token-${_moduleId}`;
}

/**
 * Create a delegation tool for a single module agent
 */
export function createDelegationTool(module: ModuleAgentConfig) {
	return tool({
		description: `Delegate to ${module.name} module: ${module.description}. Capabilities: ${module.capabilities.join(', ')}`,
		inputSchema: z.object({
			task: z.string().describe('The specific task to perform'),
			context: z.record(z.string(), z.any()).optional().describe('Additional context for the task'),
		}),
		execute: async ({ task, context }): Promise<ModuleAgentResult> => {
			const startTime = Date.now();

			try {
				// HTTP call to external module agent
				const response = await fetch(`${module.baseUrl}/api/agent/delegate`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${getModuleAuthToken(module.id)}`,
					},
					body: JSON.stringify({ task, context }),
				});

				if (!response.ok) {
					return {
						success: false,
						result: null,
						message: `Module ${module.id} error: ${response.status} ${response.statusText}`,
					};
				}

				const result = (await response.json()) as ModuleAgentResult;

				return {
					...result,
					result: result.result,
				};
			} catch (error) {
				return {
					success: false,
					result: null,
					message: `Failed to delegate to ${module.id}: ${error instanceof Error ? error.message : String(error)}`,
				};
			}
		},
	});
}

/**
 * Create delegation tools for all registered module agents
 */
export function createModuleDelegationTools(modules: ModuleAgentConfig[]): ToolSet {
	const tools: ToolSet = {};

	for (const module of modules) {
		tools[`delegate_to_${module.id}`] = createDelegationTool(module);
	}

	return tools;
}

/**
 * Create a local module agent tool (for in-process module agents)
 */
export function createLocalModuleTool(
	moduleId: string,
	moduleName: string,
	description: string,
	handler: (task: string, context: Record<string, unknown> | undefined) => Promise<ModuleAgentResult>
) {
	return tool({
		description: `Use ${moduleName} module: ${description}`,
		inputSchema: z.object({
			task: z.string().describe('The specific task to perform'),
			context: z.record(z.string(), z.any()).optional().describe('Additional context for the task'),
		}),
		execute: async ({ task, context }): Promise<ModuleAgentResult> => {
			try {
				return await handler(task, context);
			} catch (error) {
				return {
					success: false,
					result: null,
					message: `Failed to execute ${moduleId} task: ${error instanceof Error ? error.message : String(error)}`,
				};
			}
		},
	});
}

/**
 * Generate descriptions of available modules for the system prompt
 */
export function generateModuleDescriptions(modules: ModuleAgentConfig[]): string {
	if (modules.length === 0) {
		return 'No external module agents are currently available.';
	}

	const lines: string[] = ['Available Module Agents:'];

	for (const module of modules) {
		lines.push(`- ${module.name} (${module.id}): ${module.description}`);
		lines.push(`  Capabilities: ${module.capabilities.join(', ')}`);
		lines.push(`  Tool: delegate_to_${module.id}`);
	}

	return lines.join('\n');
}
