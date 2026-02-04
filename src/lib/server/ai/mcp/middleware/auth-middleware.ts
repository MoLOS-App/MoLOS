/**
 * MCP Authentication Middleware
 *
 * Validates API keys and OAuth bearer tokens for MCP requests.
 * Supports hybrid authentication: API key OR OAuth Bearer token.
 */

import { ApiKeyRepository } from '$lib/repositories/ai/mcp';
import { parseApiKeyFromHeader } from '../mcp-utils';
import { mcpOAuthProvider } from '../oauth';
import type { MCPContext, ApiKeyValidation, MCPAuthMethod } from '$lib/models/ai/mcp';
import { scopesToModules } from '../oauth/scope-mapper';
import { getAllModules } from '$lib/config';

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
 * Detect the authentication method from the Authorization header
 */
function detectAuthMethod(authHeader: string | null): MCPAuthMethod | null {
	if (!authHeader) {
		return null;
	}

	// Check for Bearer token (OAuth)
	if (authHeader.startsWith('Bearer ')) {
		return 'oauth_bearer';
	}

	// Check for API key formats
	// mcp_live_*, mcp_test_*, or sk_* prefixes
	if (
		authHeader.startsWith('mcp_live_') ||
		authHeader.startsWith('mcp_test_') ||
		authHeader.startsWith('sk_') ||
		// Also handle case where "MOLOS_MCP_API_KEY" header contains just the key
		authHeader.startsWith('mcp_')
	) {
		return 'api_key';
	}

	// If it has Bearer but we couldn't determine, return null
	return null;
}

/**
 * Authenticate using API key
 */
async function authenticateWithApiKey(
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

	// Determine allowed modules - if not set or empty, allow all external modules
	let allowedModules = validation.apiKey.allowedModules ?? [];
	console.log('[MCP Auth] Original allowedModules:', allowedModules);

	if (allowedModules.length === 0) {
		// No restriction = allow all external modules
		allowedModules = getAllModules()
			.filter((m) => m.isExternal)
			.map((m) => m.id);
		console.log('[MCP Auth] Expanded allowedModules to all external modules:', allowedModules);
	}

	// Create context
	const context: MCPContext = {
		userId: validation.apiKey.userId,
		authMethod: 'api_key',
		apiKeyId: validation.apiKey.id,
		oauthClientId: null,
		sessionId,
		scopes: [], // API keys don't use OAuth scopes
		allowedModules
	};

	console.log('[MCP Auth] Created context with allowedModules:', context.allowedModules);

	// Record usage
	await apiKeyRepo.recordUsage(validation.apiKey.id);

	return {
		authenticated: true,
		context
	};
}

/**
 * Authenticate using OAuth Bearer token
 */
async function authenticateWithOAuth(authHeader: string | null, sessionId: string): Promise<AuthResult> {
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return {
			authenticated: false,
			error: {
				code: 401,
				message: 'Missing or invalid Authorization header'
			}
		};
	}

	const token = authHeader.slice(7); // Remove "Bearer " prefix

	// Verify token with OAuth provider
	try {
		const authInfo = await mcpOAuthProvider.verifyAccessToken(token);

		// Map OAuth scopes to allowed modules
		let allowedModules = scopesToModules(authInfo.scopes ?? []);

		// If no scopes specified, allow all external modules (full access)
		if (allowedModules.length === 0) {
			allowedModules = getAllModules()
				.filter((m) => m.isExternal)
				.map((m) => m.id);
		}

		// Get user ID from token - we need to look up the token to get the userId
		const { oauthTokenService } = await import('../oauth');
		const tokenInfo = await oauthTokenService.verifyAccessToken(token);

		if (!tokenInfo) {
			return {
				authenticated: false,
				error: {
					code: 401,
					message: 'Invalid access token'
				}
			};
		}

		const context: MCPContext = {
			userId: tokenInfo.userId,
			authMethod: 'oauth_bearer',
			apiKeyId: null,
			oauthClientId: authInfo.clientId,
			sessionId,
			scopes: authInfo.scopes ?? [],
			allowedModules
		};

		return {
			authenticated: true,
			context
		};
	} catch (error) {
		return {
			authenticated: false,
			error: {
				code: 401,
				message: error instanceof Error ? error.message : 'Invalid access token'
			}
		};
	}
}

/**
 * Authenticate an MCP request using API key or OAuth Bearer token
 *
 * This function automatically detects the authentication method:
 * - Bearer token → OAuth authentication
 * - Otherwise → API key authentication
 */
export async function authenticateRequest(
	authHeader: string | null,
	sessionId: string
): Promise<AuthResult> {
	if (!authHeader) {
		return {
			authenticated: false,
			error: {
				code: 401,
				message: 'Missing authentication credentials'
			}
		};
	}

	// Detect auth method
	const authMethod = detectAuthMethod(authHeader);

	if (authMethod === 'oauth_bearer') {
		return authenticateWithOAuth(authHeader, sessionId);
	}

	// Default to API key auth
	return authenticateWithApiKey(authHeader, sessionId);
}

/**
 * Extract API key from request headers
 * @deprecated Use extractAuthHeader instead for OAuth support
 */
export function extractApiKeyFromRequest(request: Request): string | null {
	return (
		request.headers.get('MOLOS_MCP_API_KEY') ??
		request.headers.get('X-API-Key') ??
		request.headers.get('Authorization')
	);
}

/**
 * Extract Authorization header from request
 * Checks multiple headers for compatibility
 */
export function extractAuthHeader(request: Request): string | null {
	return (
		request.headers.get('Authorization') ??
		request.headers.get('MOLOS_MCP_API_KEY') ??
		request.headers.get('X-API-Key')
	);
}
