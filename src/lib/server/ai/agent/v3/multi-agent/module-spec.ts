/**
 * Module Agent Specification
 *
 * Defines the interface that external module agents must implement
 * to be compatible with the MoLOS Architect agent.
 */

import type { AgentAction } from '../types';

/**
 * Health check response
 */
export interface ModuleHealthResponse {
	status: 'ok' | 'degraded' | 'error';
	version: string;
	uptime?: number;
}

/**
 * Delegation request from architect
 */
export interface DelegationRequest {
	task: string;
	context?: Record<string, unknown>;
	correlationId?: string;
}

/**
 * Delegation response from module agent
 */
export interface DelegationResponse {
	success: boolean;
	result: unknown;
	message: string;
	actions?: AgentAction[];
	metadata?: {
		durationMs?: number;
		tokensUsed?: number;
		[model: string]: unknown;
	};
}

/**
 * Module capabilities response
 */
export interface ModuleCapabilitiesResponse {
	id: string;
	name: string;
	description: string;
	capabilities: string[];
	version: string;
	endpoints: {
		health: string;
		delegate: string;
		capabilities: string;
	};
}

/**
 * Module Agent API Specification
 *
 * External module agents (e.g., MoLOS-Tasks, MoLOS-Calendar) must implement
 * the following endpoints to be compatible with the MoLOS Architect.
 *
 * ENDPOINTS:
 *
 * 1. GET /api/agent/health
 *    Returns module health status
 *    Response: ModuleHealthResponse
 *
 * 2. POST /api/agent/delegate
 *    Handle delegation from architect
 *    Request: DelegationRequest
 *    Response: DelegationResponse
 *
 * 3. GET /api/agent/capabilities
 *    Get module capabilities
 *    Response: ModuleCapabilitiesResponse
 *
 * EXAMPLE IMPLEMENTATION (SvelteKit):
 *
 * ```typescript
 * // src/routes/api/agent/health/+server.ts
 * import { json } from '@sveltejs/kit';
 *
 * export async function GET() {
 *   return json({
 *     status: 'ok',
 *     version: '1.0.0',
 *     uptime: process.uptime()
 *   });
 * }
 *
 * // src/routes/api/agent/delegate/+server.ts
 * import { json } from '@sveltejs/kit';
 *
 * export async function POST({ request }) {
 *   const { task, context } = await request.json();
 *
 *   // Process the delegated task
 *   const result = await processTask(task, context);
 *
 *   return json({
 *     success: true,
 *     result: result.data,
 *     message: result.message,
 *     actions: result.actions
 *   });
 * }
 *
 * // src/routes/api/agent/capabilities/+server.ts
 * import { json } from '@sveltejs/kit';
 *
 * export async function GET() {
 *   return json({
 *     id: 'molos-tasks',
 *     name: 'Tasks',
 *     description: 'Manages tasks, projects, and to-do lists',
 *     capabilities: ['create_task', 'list_tasks', 'update_task', 'delete_task', 'search_tasks'],
 *     version: '1.0.0',
 *     endpoints: {
 *       health: '/api/agent/health',
 *       delegate: '/api/agent/delegate',
 *       capabilities: '/api/agent/capabilities'
 *     }
 *   });
 * }
 * ```
 */
export interface ModuleAgentEndpoint {
	// Type definition only - see documentation above
}
