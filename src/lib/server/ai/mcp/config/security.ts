/**
 * MCP Security Configuration
 *
 * Centralized security settings for the MCP server.
 */

/**
 * Validate required security environment variables
 */
function validateSecurityConfig(): void {
	const salt = process.env.MCP_API_KEY_SALT;

	if (!salt) {
		throw new Error(
			'MCP_API_KEY_SALT environment variable is required. Set it to a secure random string.'
		);
	}

	if (salt.includes('default') || salt.includes('change-in-production')) {
		if (process.env.NODE_ENV === 'production') {
			throw new Error(
				'MCP_API_KEY_SALT must be set to a secure random string in production. The default value is not safe.'
			);
		}
		// Warn in development
		console.warn(
			'[MCP Security] Using default MCP_API_KEY_SALT. This is not safe for production!'
		);
	}
}

// Validate on import
validateSecurityConfig();

/**
 * Security configuration
 */
export const mcpSecurityConfig = {
	/**
	 * Salt for API key hashing (from env var, validated above)
	 */
	apiKeySalt: process.env.MCP_API_KEY_SALT!,

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
