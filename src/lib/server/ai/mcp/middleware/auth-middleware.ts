/**
 * MCP Authentication Middleware
 *
 * Validates API keys and extracts user context for MCP requests.
 */

import { ApiKeyRepository } from '$lib/repositories/ai/mcp';
import { parseApiKeyFromHeader } from '../mcp-utils';
import type { MCPContext, ApiKeyValidation } from '$lib/models/ai/mcp';

/**
 * Authentication result
 */
export interface AuthResult {
	authenticated: boolean;
	context?: MCPContext;
	error?: {
		code: number;
		message: string;
	};
}

/**
 * Authenticate an MCP request using API key from header
 */
export async function authenticateRequest(
	apiKeyHeader: string | null,
	sessionId: string
): Promise<AuthResult> {
	const apiKey = parseApiKeyFromHeader(apiKeyHeader);

	if (!apiKey) {
		return {
			authenticated: false,
			error: {
				code: 401,
				message: 'Missing API key'
			}
		};
	}

	// Validate API key
	const apiKeyRepo = new ApiKeyRepository();
	const validation: ApiKeyValidation = await apiKeyRepo.validateApiKey(apiKey);

	if (!validation.valid || !validation.apiKey) {
		return {
			authenticated: false,
			error: {
				code: 401,
				message: validation.error ?? 'Invalid API key'
			}
		};
	}

	// Create context
	const context: MCPContext = {
		userId: validation.apiKey.userId,
		apiKeyId: validation.apiKey.id,
		sessionId,
		allowedModules: validation.apiKey.allowedModules ?? []
	};

	// Record usage
	await apiKeyRepo.recordUsage(validation.apiKey.id);

	return {
		authenticated: true,
		context
	};
}

/**
 * Extract API key from request headers
 */
export function extractApiKeyFromRequest(request: Request): string | null {
	return request.headers.get('X-API-Key') ?? request.headers.get('Authorization');
}

/**
 * Create authentication error response
 */
export function createAuthErrorResponse(message: string = 'Authentication required') {
	return {
		jsonrpc: '2.0',
		id: null,
		error: {
			code: -32000,
			message: 'Authentication error',
			data: {
				reason: message
			}
		}
	};
}

/**
 * Middleware: Authenticate MCP request
 *
 * Use this in your SSE endpoint to validate the API key before processing requests.
 */
export function withAuth<T extends { apiKeyHeader: string | null; sessionId: string }>(
	handler: (context: MCPContext, request: T) => Promise<unknown>
) {
	return async (request: T) => {
		const authResult = await authenticateRequest(request.apiKeyHeader, request.sessionId);

		if (!authResult.authenticated || !authResult.context) {
			return createAuthErrorResponse(authResult.error?.message ?? 'Authentication failed');
		}

		return handler(authResult.context, request);
	};
}
