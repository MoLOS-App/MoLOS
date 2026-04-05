/**
 * MCP Security Configuration
 *
 * Centralized security settings for the MCP server.
 */

import { randomBytes } from 'crypto';

/**
 * Default salt for development only (never use in production)
 */
const DEV_DEFAULT_SALT = 'molos-mcp-dev-salt-change-in-production';

/**
 * Get or generate the API key salt
 */
function getApiKeySalt(): string {
	const salt = process.env.MCP_API_KEY_SALT;
	const isProduction = process.env.NODE_ENV === 'production';

	// No salt set - use default with a warning
	if (!salt) {
		console.warn(
			'[MCP Security] MCP_API_KEY_SALT not set. Using development default. This is NOT safe for production!'
		);
		return DEV_DEFAULT_SALT;
	}

	// Salt contains default placeholder - warn about it
	if (salt.includes('default') || salt.includes('change-in-production') || salt.includes('dev-')) {
		console.warn(
			'[MCP Security] MCP_API_KEY_SALT appears to be a default value. This is NOT safe for production!'
		);
	}

	return salt;
}

/**
 * Security configuration
 */
export const mcpSecurityConfig = {
	/**
	 * Salt for API key hashing
	 */
	apiKeySalt: getApiKeySalt(),

	/**
	 * Maximum request body size in bytes (default: 1MB)
	 */
	maxRequestSize: parseInt(process.env.MCP_MAX_REQUEST_SIZE || '1048576', 10),

	/**
	 * Default request timeout in milliseconds (default: 30s)
	 */
	defaultTimeout: parseInt(process.env.MCP_REQUEST_TIMEOUT || '30000', 10),

	/**
	 * Tool execution timeout in milliseconds (default: 60s)
	 */
	toolTimeout: parseInt(process.env.MCP_TOOL_TIMEOUT || '60000', 10),

	/**
	 * Resource read timeout in milliseconds (default: 15s)
	 */
	resourceTimeout: parseInt(process.env.MCP_RESOURCE_TIMEOUT || '15000', 10),

	/**
	 * Database query timeout in milliseconds (default: 10s)
	 */
	databaseTimeout: parseInt(process.env.MCP_DATABASE_TIMEOUT || '10000', 10),

	/**
	 * Enable CORS for MCP endpoint (default: false)
	 */
	enableCors: process.env.MCP_ENABLE_CORS === 'true',

	/**
	 * Allowed CORS origins (comma-separated)
	 */
	allowedOrigins: process.env.MCP_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) || [],

	/**
	 * Rate limiting configuration
	 */
	rateLimit: {
		/**
		 * Default rate limit: requests per window
		 */
		defaultMaxRequests: parseInt(process.env.MCP_RATE_LIMIT_MAX || '100', 10),

		/**
		 * Rate limit window in milliseconds (default: 60s)
		 */
		windowMs: parseInt(process.env.MCP_RATE_LIMIT_WINDOW || '60000', 10),

		/**
		 * Tool-specific rate limit
		 */
		tools: {
			maxRequests: parseInt(process.env.MCP_RATE_LIMIT_TOOLS || '60', 10)
		},

		/**
		 * Resource-specific rate limit
		 */
		resources: {
			maxRequests: parseInt(process.env.MCP_RATE_LIMIT_RESOURCES || '200', 10)
		}
	}
} as const;

/**
 * Type for security config
 */
export type MCPSecurityConfig = typeof mcpSecurityConfig;
