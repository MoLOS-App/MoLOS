/**
 * MCP Transport SSE Endpoint
 *
 * Server-Sent Events endpoint for MCP JSON-RPC 2.0 communication.
 *
 * API: GET /api/ai/mcp/transport
 * Headers: X-API-Key: mcp_live_*
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractApiKeyFromRequest, authenticateRequest } from '$lib/server/ai/mcp/middleware/auth-middleware';
import {
	getSession,
	removeSession,
	createSSEEndpointEvent,
	createSSEErrorEvent,
	formatSSEEvent,
	mergeStreams,
	createKeepAliveStream
} from '$lib/server/ai/mcp/mcp-transport';
import { handleMcpRequest, parseMcpRequest, createInvalidRequestError } from '$lib/server/ai/mcp/handlers';
import { parseSSEMessage } from '$lib/server/ai/mcp/json-rpc';
import { readable, type Readable } from 'svelte/store';
import { defaultRateLimiter } from '$lib/server/ai/mcp/mcp-utils';

/**
 * GET handler - Establish SSE connection
 */
export const GET: RequestHandler = async ({ request, url }) => {
	// Extract API key from headers
	const apiKeyHeader = extractApiKeyFromRequest(request);

	if (!apiKeyHeader) {
		return error(401, 'Missing API key. Provide X-API-Key header.');
	}

	// Generate session ID
	const sessionId = getSessionId(url);

	// Authenticate
	const authResult = await authenticateRequest(apiKeyHeader, sessionId);

	if (!authResult.authenticated || !authResult.context) {
		return error(401, authResult.error?.message ?? 'Authentication failed');
	}

	const context = authResult.context;

	// Check rate limit
	if (!defaultRateLimiter.check(context.apiKeyId ?? context.userId)) {
		return error(429, 'Rate limit exceeded');
	}

	// Create session
	const session = getSession(sessionId);

	// Create SSE response stream
	const stream = createMcpStream(context, session);

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
 * Extract or generate session ID from request
 */
function getSessionId(url: URL): string {
	const sessionId = url.searchParams.get('sessionId');
	if (sessionId) {
		return sessionId;
	}
	return `mcp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Create the MCP SSE stream
 */
function createMcpStream(context: any, session: any): ReadableStream<Uint8Array> {
	// Create a readable stream for outgoing messages
	let controller: ReadableStreamDefaultController<Uint8Array>;
	let closed = false;

	const messageStream = new ReadableStream({
		start(c) {
			controller = c;
			session.attachController(c);

			// Send initial endpoint event
			try {
				c.enqueue(
					new TextEncoder().encode(formatSSEEvent(createSSEEndpointEvent('/api/ai/mcp/transport')))
				);
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

// Export for testing
export { getSession, removeSession, getActiveSessions, getSessionId };
