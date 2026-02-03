/**
 * MCP Transport Endpoint (HTTP-only mode)
 *
 * Simplified endpoint for MCP JSON-RPC 2.0 communication via HTTP POST.
 * Supports mcp-remote and other HTTP-based MCP clients.
 *
 * API: POST /api/ai/mcp/transport
 * Headers: MOLOS_MCP_API_KEY: mcp_live_*
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	extractApiKeyFromRequest,
	authenticateRequest
} from '$lib/server/ai/mcp/middleware/auth-middleware';
import { handleMcpRequest, parseMcpRequest } from '$lib/server/ai/mcp/handlers';
import { mcpRateLimiters } from '$lib/server/ai/mcp/rate-limit/sliding-window-limiter';
import { mcpSecurityConfig } from '$lib/server/ai/mcp/config/security';
import { createErrorResponse } from '$lib/server/ai/mcp/json-rpc';

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
	return `req_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Get CORS headers for the response
 */
function getCorsHeaders(origin: string | null): Record<string, string> {
	if (!mcpSecurityConfig.enableCors) {
		return {};
	}

	// Check if origin is allowed
	const allowedOrigin =
		mcpSecurityConfig.allowedOrigins.length > 0
			? mcpSecurityConfig.allowedOrigins.find((allowed) => {
					if (allowed === '*') return true;
					try {
						if (!origin) return false;
						const allowedUrl = new URL(allowed);
						const originUrl = new URL(origin);
						return allowedUrl.origin === originUrl.origin;
					} catch {
						return false;
					}
				})
			: null;

	if (!allowedOrigin) {
		return {};
	}

	return {
		'Access-Control-Allow-Origin': allowedOrigin === '*' ? '*' : origin || '',
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, MOLOS_MCP_API_KEY, X-API-Key, Authorization',
		'Access-Control-Max-Age': '86400' // 24 hours
	};
}

/**
 * OPTIONS handler - CORS preflight
 */
export const OPTIONS: RequestHandler = async ({ request }) => {
	const origin = request.headers.get('origin');
	const corsHeaders = getCorsHeaders(origin);

	return new Response(null, {
		status: 204,
		headers: corsHeaders
	});
};

/**
 * POST handler - Process JSON-RPC requests
 *
 * Handles all MCP methods (initialize, tools/list, tools/call, etc.)
 * Returns responses directly in HTTP body (no SSE needed for basic operation)
 */
export const POST: RequestHandler = async ({ request }) => {
	const requestId = generateRequestId();
	const origin = request.headers.get('origin');

	// Validate Content-Type header
	const contentType = request.headers.get('content-type');
	if (!contentType || !contentType.includes('application/json')) {
		return error(415, {
			code: 'UNSUPPORTED_MEDIA_TYPE',
			message: 'Content-Type must be application/json'
		} as any);
	}

	// Extract API key from headers
	const apiKeyHeader = extractApiKeyFromRequest(request);

	if (!apiKeyHeader) {
		return error(401, 'Missing API key. Provide MOLOS_MCP_API_KEY header.');
	}

	// Authenticate
	const authResult = await authenticateRequest(apiKeyHeader, getSessionId(request.url));

	if (!authResult.authenticated || !authResult.context) {
		return error(401, authResult.error?.message ?? 'Authentication failed');
	}

	const context = authResult.context;

	// Check rate limit (returns JSON-RPC error if rate limited)
	const rateLimitKey = context.apiKeyId ?? context.userId;
	const rateLimitCheck = mcpRateLimiters.default.check(rateLimitKey);

	if (!rateLimitCheck.allowed) {
		// Return JSON-RPC error response for rate limit
		const rateLimitErrorResponse = createErrorResponse(
			1, // Will be replaced with actual request ID
			-32001, // MCP rate limit error code
			'Rate limit exceeded',
			{
				retryAfter: rateLimitCheck.retryAfter,
				limit: mcpSecurityConfig.rateLimit.defaultMaxRequests,
				window: `${mcpSecurityConfig.rateLimit.windowMs / 1000}s`
			}
		);

		return new Response(JSON.stringify(rateLimitErrorResponse), {
			status: 200, // Always return 200 for JSON-RPC
			headers: {
				'Content-Type': 'application/json',
				'X-Request-ID': requestId,
				'Retry-After': String(rateLimitCheck.retryAfter),
				...getCorsHeaders(origin)
			}
		});
	}

	// Parse request body with size limit
	let requestBody: string;
	try {
		// Get content length for validation
		const contentLength = request.headers.get('content-length');
		if (contentLength) {
			const size = parseInt(contentLength, 10);
			if (size > mcpSecurityConfig.maxRequestSize) {
				return error(
					413,
					`Request body too large. Maximum size is ${mcpSecurityConfig.maxRequestSize} bytes`
				);
			}
		}

		requestBody = await request.text();

		// Double-check actual size
		if (requestBody.length > mcpSecurityConfig.maxRequestSize) {
			return error(
				413,
				`Request body too large. Maximum size is ${mcpSecurityConfig.maxRequestSize} bytes`
			);
		}
	} catch {
		return error(400, 'Invalid request body');
	}

	if (!requestBody) {
		return error(400, 'Empty request body');
	}

	// Parse the request
	const mcpRequest = parseMcpRequest(requestBody);

	if (!mcpRequest) {
		return error(400, 'Invalid JSON-RPC request');
	}

	// Handle the request
	const response = await handleMcpRequest(context, mcpRequest);

	// Prepare response headers
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'X-Request-ID': requestId
	};

	// Add rate limit info headers
	headers['X-RateLimit-Remaining'] = String(rateLimitCheck.remaining);
	headers['X-RateLimit-Reset'] = new Date(rateLimitCheck.resetAt).toISOString();

	// Add CORS headers if enabled
	const corsHeaders = getCorsHeaders(origin);
	Object.assign(headers, corsHeaders);

	// Return the JSON-RPC response directly
	return new Response(JSON.stringify(response), {
		status: 200,
		headers
	});
};

/**
 * Generate session ID from request URL string
 */
function getSessionId(urlString: string): string {
	const url = new URL(urlString);
	const sessionId = url.searchParams.get('sessionId');
	if (sessionId) {
		return sessionId;
	}
	return `mcp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

// GET, DELETE, and SSE endpoints are not needed for HTTP-only mode
// mcp-remote's http-first mode only uses POST
