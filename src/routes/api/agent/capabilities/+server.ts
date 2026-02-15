/**
 * Agent Capabilities Endpoint
 *
 * Exposes the MoLOS Architect agent's capabilities for
 * service discovery and module agent compatibility.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getModuleRegistry } from '$lib/server/ai/agent/v3/multi-agent';
import { getAllModules } from '$lib/config';

export const GET: RequestHandler = async () => {
	const moduleRegistry = getModuleRegistry();
	const allModules = getAllModules();

	// Get module descriptions for capabilities
	const moduleCapabilities = moduleRegistry.getAll().map((m) => ({
		id: m.id,
		name: m.name,
		description: m.description,
		capabilities: m.capabilities,
		baseUrl: m.baseUrl,
	}));

	// Get core modules from MoLOS
	const coreModules = allModules
		.filter((m) => !m.isExternal)
		.map((m) => ({
			id: m.id,
			name: m.name,
			description: m.description,
		}));

	return json({
		id: 'molos-architect',
		name: 'MoLOS Architect',
		description:
			'The central MoLOS agent that orchestrates user requests and delegates to specialized module agents',
		version: '3.0.0',
		capabilities: [
			'natural_language_understanding',
			'task_planning',
			'tool_execution',
			'module_delegation',
			'context_management',
			'streaming_responses',
		],
		modules: {
			core: coreModules,
			external: moduleCapabilities,
		},
		endpoints: {
			chat: '/api/chat',
			capabilities: '/api/agent/capabilities',
		},
		features: {
			streaming: true,
			multiStepTools: true,
			hooks: true,
			telemetry: true,
			multiAgent: moduleCapabilities.length > 0,
		},
	});
};
