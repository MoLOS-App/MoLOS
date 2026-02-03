/**
 * MoLOS MCP Server Implementation
 *
 * Official Model Context Protocol server using @modelcontextprotocol/sdk
 *
 * Based on: https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/src/examples/server/simpleStreamableHttp.ts
 */

import { randomUUID } from 'node:crypto';
import * as z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import type { Tool } from '$lib/models/ai';
import { getAllModules } from '$lib/config';
import type { McpContext } from '$lib/models/ai/mcp';
import { ApiKeyRepository } from '$lib/repositories/ai/mcp';

/**
 * Server info and configuration
 */
const SERVER_INFO = {
	name: 'MoLOS MCP Server',
	version: '1.0.0',
	websiteUrl: 'https://github.com/MoLOS-org/MoLOS'
};

/**
 * Server capabilities
 */
const SERVER_CAPABILITIES = {
	logging: {},
	tools: {} // Enable tools support
};

/**
 * Transport storage by session ID
 */
const transports: Map<string, StreamableHTTPServerTransport> = new Map();

/**
 * Convert MoLOS ToolDefinition to MCP Tool registration
 */
function convertToolToMcpTool(tool: Tool): {
	name: string;
	title: string;
	description: string;
	inputSchema: z.ZodType;
	execute: (args: Record<string, unknown>) => Promise<{
		content: Array<{ type: string; text?: string }>;
	}>;
} {
	// Convert parameters to Zod schema
	const schemaProperties: Record<string, z.ZodTypeAny> = {};
	const required: string[] = [];

	if (tool.parameters?.properties) {
		for (const [name, prop] of Object.entries(tool.parameters.properties)) {
			let zodType: z.ZodTypeAny;

			// Map JSON Schema types to Zod types
			switch (prop.type) {
				case 'string':
					zodType = z.string();
					break;
				case 'number':
				case 'integer':
					zodType = z.number();
					break;
				case 'boolean':
					zodType = z.boolean();
					break;
				case 'array':
					zodType = z.array(z.any());
					break;
				case 'object':
					zodType = z.object(z.any());
					break;
				default:
					zodType = z.any();
			}

			// Add description if available
			if (prop.description) {
				zodType = zodType.describe(prop.description);
			}

			// Make optional if not required
			if (!tool.parameters?.required?.includes(name)) {
				zodType = zodType.optional();
			} else {
				required.push(name);
			}

			schemaProperties[name] = zodType;
		}
	}

	const inputSchema = z.object(schemaProperties).partial();

	return {
		name: tool.name,
		title: tool.title || tool.name,
		description: tool.description,
		inputSchema,
		execute: async (args: Record<string, unknown>) => {
			// Execute the tool function
			const result = await tool.execute(args);

			// Format result for MCP response
			if (typeof result === 'string') {
				return {
					content: [{ type: 'text', text: result }]
				};
			}

			if (result && typeof result === 'object') {
				return {
					content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
				};
			}

			return {
				content: [{ type: 'text', text: 'Operation completed' }]
			};
		}
	};
}

/**
 * Get MCP context from API key header
 */
async function getContextFromApiKey(
	apiKeyHeader: string | undefined
): Promise<{ context: McpContext; userId: string } | null> {
	if (!apiKeyHeader) {
		return null;
	}

	// Parse API key (remove "Bearer " prefix if present)
	const apiKey = apiKeyHeader.replace(/^Bearer\s+/i, '').trim();

	// Validate API key
	const apiKeyRepo = new ApiKeyRepository();
	const validation = await apiKeyRepo.validateApiKey(apiKey);

	if (!validation.valid || !validation.apiKey) {
		return null;
	}

	const context: McpContext = {
		userId: validation.apiKey.userId,
		apiKeyId: validation.apiKey.id,
		sessionId: randomUUID(),
		allowedModules: validation.apiKey.allowedModules ?? []
	};

	return { context, userId: context.userId };
}

/**
 * Get tools for a given context
 */
async function getToolsForContext(context: McpContext): Promise<Tool[]> {
	// Import the AiToolbox dynamically
	const { AiToolbox } = await import('../../toolbox.js');

	const toolbox = new AiToolbox();

	// Get tools based on user's allowed modules
	const tools = await toolbox.getTools(context.userId, context.allowedModules);

	return tools;
}

/**
 * Create and configure the MCP server
 */
export function createMcpServer() {
	const server = new McpServer(
		SERVER_INFO,
		{ capabilities: SERVER_CAPABILITIES }
	);

	// Tool registration will be done dynamically based on context
	return server;
}

/**
 * Get or create a singleton server instance
 */
let serverInstance: McpServer | null = null;

export function getMcpServer(): McpServer {
	if (!serverInstance) {
		serverInstance = createMcpServer();
	}
	return serverInstance;
}

/**
 * Register tools for a specific context/session
 */
export async function registerToolsForContext(
	server: McpServer,
	context: McpContext
): Promise<void> {
	const tools = await getToolsForContext(context);

	// Unregister all existing tools first (to handle module changes)
	// Note: The SDK doesn't provide a way to list/unregister tools yet,
	// so tools accumulate. This is a known limitation.

	for (const tool of tools) {
		const mcpTool = convertToolToMcpTool(tool);

		try {
			// @ts-ignore - registerTool accepts the tool registration format
			server.registerTool(
				mcpTool.name,
				{
					title: mcpTool.title,
					description: mcpTool.description,
					inputSchema: mcpTool.inputSchema
				},
				mcpTool.execute
			);
		} catch (error) {
			// Tool might already be registered, ignore
			if (error instanceof Error && !error.message.includes('already registered')) {
				console.error(`Failed to register tool ${mcpTool.name}:`, error);
			}
		}
	}
}

/**
 * Create Express app with MCP endpoints
 */
export async function createMcpExpressApp() {
	const { default: express } = await import('express');
	const app = createMcpExpressApp({ host: 'localhost' });

	// MCP POST endpoint - handles all MCP requests
	const mcpPostHandler = async (req: any, res: any) => {
		const apiKeyHeader = req.headers['molos-mcp-api-key'] || req.headers['x-api-key'];

		// Authenticate and get context
		const authResult = await getContextFromApiKey(apiKeyHeader);
		if (!authResult) {
			res.status(401).json({
				jsonrpc: '2.0',
				error: { code: -32000, message: 'Unauthorized: Invalid or missing API key' },
				id: null
			});
			return;
		}

		const { context } = authResult;
		const sessionId = req.headers['mcp-session-id'] as string | undefined;

		if (sessionId) {
			console.log(`[MCP] Request for session: ${sessionId}`);
		} else {
			console.log('[MCP] New initialize request:', req.body?.method);
		}

		try {
			let transport: StreamableHTTPServerTransport;
			const server = getMcpServer();

			// Register tools for this context
			await registerToolsForContext(server, context);

			if (sessionId && transports.has(sessionId)) {
				// Reuse existing transport
				transport = transports.get(sessionId)!;
			} else if (!sessionId && req.body?.method === 'initialize') {
				// New initialization request - create transport
				transport = new StreamableHTTPServerTransport({
					sessionIdGenerator: () => randomUUID(),
					onsessioninitialized: (newSessionId) => {
						console.log(`[MCP] Session initialized: ${newSessionId}`);
						transports.set(newSessionId, transport);
					}
				});

				// Set up onclose handler
				transport.onclose = () => {
					const sid = transport.sessionId;
					if (sid) {
						console.log(`[MCP] Session closed: ${sid}`);
						transports.delete(sid);
					}
				};

				// Connect transport to server
				await server.connect(transport);
			} else {
				// Invalid request
				res.status(400).json({
					jsonrpc: '2.0',
					error: { code: -32000, message: 'Bad Request: No valid session' },
					id: null
				});
				return;
			}

			// Handle the request
			await transport.handleRequest(req, res, req.body);
		} catch (error) {
			console.error('[MCP] Error handling request:', error);
			if (!res.headersSent) {
				res.status(500).json({
					jsonrpc: '2.0',
					error: { code: -32603, message: 'Internal server error' },
					id: null
				});
			}
		}
	};

	// MCP GET endpoint - SSE streams for notifications
	const mcpGetHandler = async (req: any, res: any) => {
		const apiKeyHeader = req.headers['molos-mcp-api-key'] || req.headers['x-api-key'];

		// Authenticate
		const authResult = await getContextFromApiKey(apiKeyHeader);
		if (!authResult) {
			res.status(401).send('Unauthorized');
			return;
		}

		const sessionId = req.headers['mcp-session-id'] as string | undefined;
		if (!sessionId || !transports.has(sessionId)) {
			res.status(400).send('Invalid or missing session ID');
			return;
		}

		const transport = transports.get(sessionId)!;
		await transport.handleRequest(req, res);
	};

	// MCP DELETE endpoint - session termination
	const mcpDeleteHandler = async (req: any, res: any) => {
		const apiKeyHeader = req.headers['molos-mcp-api-key'] || req.headers['x-api-key'];

		// Authenticate
		const authResult = await getContextFromApiKey(apiKeyHeader);
		if (!authResult) {
			res.status(401).send('Unauthorized');
			return;
		}

		const sessionId = req.headers['mcp-session-id'] as string | undefined;
		if (!sessionId || !transports.has(sessionId)) {
			res.status(400).send('Invalid or missing session ID');
			return;
		}

		console.log(`[MCP] Session termination: ${sessionId}`);
		const transport = transports.get(sessionId)!;
		await transport.handleRequest(req, res);
	};

	// Register routes
	app.post('/mcp', mcpPostHandler);
	app.get('/mcp', mcpGetHandler);
	app.delete('/mcp', mcpDeleteHandler);

	// Cleanup on shutdown
	process.on('SIGINT', async () => {
		console.log('[MCP] Shutting down...');
		for (const [sessionId, transport] of transports.entries()) {
			try {
				await transport.close();
			} catch (error) {
				console.error(`[MCP] Error closing transport for ${sessionId}:`, error);
			}
		}
		transports.clear();
		console.log('[MCP] Shutdown complete');
	});

	return app;
}

/**
 * Get active transports count (for monitoring)
 */
export function getActiveTransportsCount(): number {
	return transports.size;
}
