/**
 * Common MCP Type Definitions
 *
 * Shared types used across multiple MCP features.
 */

import type { MCPApiKeyStatus, MCPLogStatus } from '$lib/server/db/schema';

/**
 * API Key Status Enum
 */
export type ApiKeyStatus = (typeof MCPApiKeyStatus)[keyof typeof MCPApiKeyStatus];

/**
 * Log Status Enum
 */
export type LogStatus = (typeof MCPLogStatus)[keyof typeof MCPLogStatus];

/**
 * MCP Error Types
 */
export type MCPErrorCode =
	| 'invalid_request'
	| 'invalid_params'
	| 'not_found'
	| 'authentication_error'
	| 'authorization_error'
	| 'rate_limit_error'
	| 'internal_error'
	| 'tool_execution_error';

/**
 * Standard MCP Error Response
 */
export interface MCPError {
	code: MCPErrorCode;
	message: string;
	details?: Record<string, unknown>;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
	page?: number;
	limit?: number;
	offset?: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
	items: T[];
	total: number;
	page: number;
	limit: number;
	hasMore: boolean;
}

/**
 * Module access scope
 */
export interface ModuleScope {
	moduleId: string;
	allowed: boolean;
}
