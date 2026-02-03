/**
 * MCP Transport SSE Endpoint
 *
 * Server-Sent Events endpoint for MCP JSON-RPC 2.0 communication.
 *
 * API: GET /api/ai/mcp/transport
 * Headers: MOLOS_MCP_API_KEY: mcp_live_*
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractApiKeyFromRequest, authenticateRequest } from '$lib/server/ai/mcp/middleware/auth-middleware';
import {
	getSession,
	removeSession,
	getActiveSessions,
	createSSEEndpointEvent,
	createSSEErrorEvent,
	formatSSEEvent,
	mergeStreams,
	createKeepAliveStream
} from '$lib/server/ai/mcp/mcp-transport';
import { handleMcpRequest, parseMcpRequest, createInvalidRequestError } from '$lib/server/ai/mcp/handlers';
import { parseSSEMessage } from '$lib/server/ai/mcp/json-rpc';
import { readable, type Readable } from 'svelte/store';
import { defaultRateLimiter, parseApiKeyFromHeader } from '$lib/server/ai/mcp/mcp-utils';

/**
 * GET handler - Establish SSE connection
 */
export const GET: RequestHandler = async ({ request, url }) => {
	// Extract API key from headers
	const apiKeyHeader = extractApiKeyFromRequest(request);

	if (!apiKeyHeader) {
		console.error('[MCP GET] Missing API key');
		return error(401, 'Missing API key. Provide MOLOS_MCP_API_KEY header.');
	}

	// Generate session ID (use API key for session correlation)
	const sessionId = getSessionId(url, apiKeyHeader);
	console.log('[MCP GET] Establishing SSE connection for session:', sessionId);

	// Authenticate
	const authResult = await authenticateRequest(apiKeyHeader, sessionId);

	if (!authResult.authenticated || !authResult.context) {
		console.error('[MCP GET] Auth failed:', authResult.error?.message);
		return error(401, authResult.error?.message ?? 'Authentication failed');
	}

	const context = authResult.context;
	console.log('[MCP GET] Authenticated for user:', context.userId);

	// Check rate limit
	if (!defaultRateLimiter.check(context.apiKeyId ?? context.userId)) {
		console.error('[MCP GET] Rate limit exceeded');
		return error(429, 'Rate limit exceeded');
	}

	// Create session
	const session = getSession(sessionId);
	console.log('[MCP GET] Session created/ retrieved:', session.id);

	// Create SSE response stream
	const stream = createMcpStream(context, session, sessionId);
	console.log('[MCP GET] SSE stream created');

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no' // Disable nginx buffering
		}
	});
};

/**
 * POST handler - Receive JSON-RPC requests from client
 * Supports two modes:
 * 1. HTTP-only: Returns response directly in POST response body
 * 2. SSE mode: Queues response to be sent via SSE connection (if established)
 */
export const POST: RequestHandler = async ({ request, url }) => {
	// Extract API key from headers
	const apiKeyHeader = extractApiKeyFromRequest(request);

	if (!apiKeyHeader) {
		console.error('[MCP POST] Missing API key');
		return error(401, 'Missing API key. Provide MOLOS_MCP_API_KEY header.');
	}

	// Generate session ID (should match the SSE connection - use API key for correlation)
	const sessionId = getSessionId(url, apiKeyHeader);

	// Authenticate
	const authResult = await authenticateRequest(apiKeyHeader, sessionId);

	if (!authResult.authenticated || !authResult.context) {
		console.error('[MCP POST] Auth failed:', authResult.error?.message);
		return error(401, authResult.error?.message ?? 'Authentication failed');
	}

	const context = authResult.context;
	console.log('[MCP POST] Authenticated for session:', sessionId);

	// Check rate limit
	if (!defaultRateLimiter.check(context.apiKeyId ?? context.userId)) {
		console.error('[MCP POST] Rate limit exceeded');
		return error(429, 'Rate limit exceeded');
	}

	// Get the session
	const session = getSession(sessionId);
	const hasSSE = (session as any).hasController;

	console.log('[MCP POST] SSE connection established:', hasSSE);

	// Parse request body as JSON-RPC message
	let requestBody: string;
	try {
		requestBody = await request.text();
	} catch {
		console.error('[MCP POST] Invalid request body');
		return error(400, 'Invalid request body');
	}

	if (!requestBody) {
		console.error('[MCP POST] Empty request body');
		return error(400, 'Empty request body');
	}

	console.log('[MCP POST] Request body:', requestBody);

	// Parse the request
	const mcpRequest = parseMcpRequest(requestBody);

	if (!mcpRequest) {
		console.error('[MCP POST] Invalid MCP request');
		return error(400, 'Invalid JSON-RPC request');
	}

	// Handle the request
	let response: JSONRPCResponse;
	try {
		const rpcResponse = await handleMcpRequest(context, mcpRequest);
		// Extract just the result field - handleMcpRequest returns full JSON-RPC response
		response = {
			jsonrpc: '2.0',
			id: mcpRequest.id,
			result: (rpcResponse as any).result
		};
	} catch (error) {
		response = {
			jsonrpc: '2.0',
			id: mcpRequest.id,
			error: {
				code: -32603,
				message: error instanceof Error ? error.message : 'Internal error'
			}
		};
	}

	// If SSE connection is active, send via SSE and return 202
	if (hasSSE) {
		session.sendResponse(response);
		console.log('[MCP POST] Response sent via SSE');
		return new Response(JSON.stringify({ status: 'accepted' }), {
			status: 202,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Otherwise, return response directly in HTTP body (HTTP-only mode)
	console.log('[MCP POST] Returning response directly (HTTP-only mode)');
	return new Response(JSON.stringify(response), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
};

/**
 * Extract or generate session ID from request
 * Uses API key hash for session correlation if no sessionId provided
 */
function getSessionId(url: URL, apiKeyHeader?: string): string {
	const sessionId = url.searchParams.get('sessionId');
	if (sessionId) {
		return sessionId;
	}
	// If no sessionId provided, use API key hash as session identifier
	// This ensures GET and POST requests from the same client share the same session
	if (apiKeyHeader) {
		// Create a stable session ID from the API key
		const apiKey = parseApiKeyFromHeader(apiKeyHeader);
		if (apiKey) {
			// Use a simple hash of the API key (first 16 chars of sha256 would be better, but this works for now)
			let hash = 0;
			for (let i = 0; i < apiKey.length; i++) {
				const char = apiKey.charCodeAt(i);
				hash = ((hash << 5) - hash) + char;
				hash = hash & hash; // Convert to 32bit integer
			}
			return `mcp_${Math.abs(hash)}_${apiKey.slice(0, 8)}`;
		}
	}
	return `mcp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Create the MCP SSE stream
 */
function createMcpStream(context: any, session: any, sessionId: string): ReadableStream<Uint8Array> {
	// Create a readable stream for outgoing messages
	let controller: ReadableStreamDefaultController<Uint8Array>;
	let closed = false;

	const messageStream = new ReadableStream({
		start(c) {
			controller = c;
			session.attachController(c);

			// Send initial endpoint event with sessionId
			try {
				const endpointUrl = `/api/ai/mcp/transport?sessionId=${sessionId}`;
				c.enqueue(
					new TextEncoder().encode(formatSSEEvent(createSSEEndpointEvent(endpointUrl)))
				);
				console.log('[MCP Stream] Endpoint event sent with sessionId:', sessionId);
			} catch {
				closed = true;
			}
		},
		cancel() {
			closed = true;
			removeSession(session.id);
		}
	});

	// Create keep-alive stream
	const keepAliveStream = createKeepAliveStream(15000);

	// Merge streams
	return mergeStreams(messageStream, keepAliveStream);
}

/**
 * Handle incoming message from client
 */
async function handleIncomingMessage(
	context: any,
	session: any,
	message: string
): Promise<void> {
	const request = parseMcpRequest(message);

	if (!request) {
		session.sendResponse(createInvalidRequestError());
		return;
	}

	try {
		const response = await handleMcpRequest(context, request);
		session.sendResponse(response);
	} catch (error) {
		session.sendResponse({
			jsonrpc: '2.0',
			id: request.id,
			error: {
				code: -32603,
				message: error instanceof Error ? error.message : 'Internal error'
			}
		});
	}
}

/**
 * Cleanup handler for connection close
 */
function onConnectionClose(sessionId: string): void {
	removeSession(sessionId);
}

/**
 * Set up cleanup on process exit
 */
if (typeof process !== 'undefined') {
	process.on('beforeExit', () => {
		for (const session of getActiveSessions()) {
			removeSession(session.id);
		}
	});
}

// Note: Session functions are available in mcp-transport.ts for testing
// { getSession, removeSession, getActiveSessions, getSessionId }
