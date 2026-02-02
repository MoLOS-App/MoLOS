/**
 * MCP Protocol Type Definitions
 *
 * Types for the Model Context Protocol (JSON-RPC 2.0 based).
 * See: https://spec.modelcontextprotocol.io/
 */

import type { MCPProtocolResource, ResourceContent, MCPProtocolPrompt, PromptMessage } from './index';

// ============================================================================
// JSON-RPC 2.0 Base Types
// ============================================================================

/**
 * JSON-RPC 2.0 Request
 */
export interface JSONRPCRequest {
	jsonrpc: '2.0';
	id: number | string;
	method: string;
	params?: unknown;
}

/**
 * JSON-RPC 2.0 Response (Success)
 */
export interface JSONRPCSuccessResponse {
	jsonrpc: '2.0';
	id: number | string;
	result: unknown;
}

/**
 * JSON-RPC 2.0 Response (Error)
 */
export interface JSONRPCErrorResponse {
	jsonrpc: '2.0';
	id: number | string | null;
	error: {
		code: number;
		message: string;
		data?: unknown;
	};
}

/**
 * JSON-RPC 2.0 Response (Union)
 */
export type JSONRPCResponse = JSONRPCSuccessResponse | JSONRPCErrorResponse;

/**
 * JSON-RPC 2.0 Notification (no id, no response expected)
 */
export interface JSONRPCNotification {
	jsonrpc: '2.0';
	method: string;
	params?: unknown;
}

// ============================================================================
// MCP Protocol - Initialize
// ============================================================================

/**
 * Initialize request parameters
 */
export interface InitializeRequestParams {
	protocolVersion: string;
	capabilities: ClientCapabilities;
	clientInfo: ClientInfo;
}

/**
 * Client capabilities
 */
export interface ClientCapabilities {
	roots?: {
		listChanged?: boolean;
	};
	sampling?: {};
	tools?: {};
	resources?: {
		subscribe?: boolean;
		listChanged?: boolean;
	};
	prompts?: {};
}

/**
 * Client information
 */
export interface ClientInfo {
	name: string;
	version: string;
}

/**
 * Initialize result
 */
export interface InitializeResult {
	protocolVersion: string;
	capabilities: ServerCapabilities;
	serverInfo: ServerInfo;
}

/**
 * Server capabilities
 */
export interface ServerCapabilities {
	tools?: {};
	resources?: {
		subscribe?: boolean;
		listChanged?: boolean;
	};
	prompts?: {};
}

/**
 * Server information
 */
export interface ServerInfo {
	name: string;
	version: string;
}

// ============================================================================
// MCP Protocol - Tools
// ============================================================================

/**
 * Tool definition as exposed via MCP
 */
export interface MCPTool {
	name: string;
	description: string;
	inputSchema: {
		type: 'object';
		properties: Record<string, unknown>;
		required?: string[];
		[key: string]: unknown;
	};
}

/**
 * tools/list request
 */
export interface ToolsListRequest {
	method: 'tools/list';
}

/**
 * tools/list result
 */
export interface ToolsListResult {
	tools: MCPTool[];
}

/**
 * tools/call request
 */
export interface ToolsCallRequest {
	method: 'tools/call';
	params: {
		name: string;
		arguments?: Record<string, unknown>;
	};
}

/**
 * tools/call result
 */
export interface ToolsCallResult {
	content: Array<{
		type: 'text' | 'image' | 'resource';
		text?: string;
		data?: string;
		uri?: string;
	}>;
	isError?: boolean;
}

// ============================================================================
// MCP Protocol - Resources
// ============================================================================

/**
 * resources/list request
 */
export interface ResourcesListRequest {
	method: 'resources/list';
}

/**
 * resources/list result
 */
export interface ResourcesListResult {
	resources: MCPProtocolResource[];
}

/**
 * resources/read request
 */
export interface ResourcesReadRequest {
	method: 'resources/read';
	params: {
		uri: string;
	};
}

/**
 * resources/read result
 */
export interface ResourcesReadResult {
	contents: ResourceContent[];
}

// ============================================================================
// MCP Protocol - Prompts
// ============================================================================

/**
 * prompts/list request
 */
export interface PromptsListRequest {
	method: 'prompts/list';
}

/**
 * prompts/list result
 */
export interface PromptsListResult {
	prompts: MCPProtocolPrompt[];
}

/**
 * prompts/get request
 */
export interface PromptsGetRequest {
	method: 'prompts/get';
	params: {
		name: string;
		arguments?: Record<string, unknown>;
	};
}

/**
 * prompts/get result
 */
export interface PromptsGetResult {
	description?: string;
	messages: PromptMessage[];
}

// ============================================================================
// MCP Context Types
// ============================================================================

/**
 * MCP Request context (passed to handlers)
 */
export interface MCPContext {
	userId: string;
	apiKeyId: string | null;
	sessionId: string;
	allowedModules: string[];
}

/**
 * MCP Handler result
 */
export interface MCPHandlerResult {
	success: boolean;
	data?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

/**
 * MCP Log entry
 */
export interface MCPLogEntry {
	id: string;
	userId: string;
	apiKeyId: string | null;
	sessionId: string;
	requestId: string;
	method: string;
	toolName?: string;
	resourceName?: string;
	promptName?: string;
	params: unknown;
	result: unknown;
	status: 'success' | 'error';
	errorMessage?: string;
	durationMs: number;
	createdAt: Date;
}

// ============================================================================
// SSE Event Types
// ============================================================================

/**
 * SSE event types for MCP communication
 */
export type SSEEventType = 'message' | 'endpoint' | 'error' | 'close';

/**
 * SSE message event
 */
export interface SSEMessageEvent {
	event: 'message';
	data: JSONRPCResponse;
}

/**
 * SSE endpoint event (connection info)
 */
export interface SSEEndpointEvent {
	event: 'endpoint';
	data: {
		url: string;
	};
}

/**
 * SSE error event
 */
export interface SSEErrorEvent {
	event: 'error';
	data: {
		message: string;
		code?: number;
	};
}

/**
 * SSE close event
 */
export interface SSECloseEvent {
	event: 'close';
	data?: {
		reason?: string;
	};
}

/**
 * Union of all SSE events
 */
export type SSEEvent = SSEMessageEvent | SSEEndpointEvent | SSEErrorEvent | SSECloseEvent;
