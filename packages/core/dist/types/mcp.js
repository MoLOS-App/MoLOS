/**
 * MCP (Model Context Protocol) Type Definitions
 *
 * This module contains all TypeScript type definitions for the MoLOS MCP integration.
 * Types are organized by feature area (API keys, resources, prompts, etc.)
 */
// ============================================================================
// Common MCP Types
// ============================================================================
/**
 * API Key Status Enum
 */
export var MCPApiKeyStatus = {
    ACTIVE: 'active',
    REVOKED: 'revoked',
    EXPIRED: 'expired'
};
/**
 * Log Status Enum
 */
export var MCPLogStatus = {
    PENDING: 'pending',
    SUCCESS: 'success',
    ERROR: 'error'
};
//# sourceMappingURL=mcp.js.map