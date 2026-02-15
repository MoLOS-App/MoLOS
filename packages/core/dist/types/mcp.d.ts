/**
 * MCP (Model Context Protocol) Type Definitions
 *
 * This module contains all TypeScript type definitions for the MoLOS MCP integration.
 * Types are organized by feature area (API keys, resources, prompts, etc.)
 */
/**
 * API Key Status Enum
 */
export declare const MCPApiKeyStatus: {
    readonly ACTIVE: "active";
    readonly REVOKED: "revoked";
    readonly EXPIRED: "expired";
};
export type ApiKeyStatus = (typeof MCPApiKeyStatus)[keyof typeof MCPApiKeyStatus];
/**
 * Log Status Enum
 */
export declare const MCPLogStatus: {
    readonly PENDING: "pending";
    readonly SUCCESS: "success";
    readonly ERROR: "error";
};
export type LogStatus = (typeof MCPLogStatus)[keyof typeof MCPLogStatus];
/**
 * MCP Error Types
 */
export type MCPErrorCode = 'invalid_request' | 'invalid_params' | 'not_found' | 'authentication_error' | 'authorization_error' | 'rate_limit_error' | 'internal_error' | 'tool_execution_error';
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
/**
 * Full API Key entity from database
 */
export interface MCPApiKey {
    id: string;
    userId: string;
    name: string;
    keyPrefix: string;
    keyHash: string;
    status: ApiKeyStatus;
    allowedModules: string[];
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    usageCount: number;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * API Key creation input
 */
export interface CreateApiKeyInput {
    name: string;
    allowedModules: string[];
    expiresAt?: Date | null;
}
/**
 * API Key update input
 */
export interface UpdateApiKeyInput {
    name?: string;
    status?: ApiKeyStatus;
    allowedModules?: string[];
    expiresAt?: Date | null;
}
/**
 * API Key response (includes full key on creation)
 */
export interface ApiKeyResponse {
    apiKey: MCPApiKey;
    fullKey?: string;
}
/**
 * API Key list filters
 */
export interface ApiKeyFilters {
    status?: ApiKeyStatus;
    search?: string;
}
/**
 * API Key format types
 */
export type ApiKeyEnvironment = 'live' | 'test';
/**
 * Generate a new API key
 * @internal Used by repository only
 */
export interface GeneratedApiKey {
    fullKey: string;
    prefix: string;
    suffix: string;
    hash: string;
}
/**
 * API Key validation result
 */
export interface ApiKeyValidation {
    valid: boolean;
    apiKey?: MCPApiKey;
    error?: string;
}
export type MCPResourceType = 'static' | 'url';
/**
 * MCP Resource entity
 */
export interface MCPResource {
    id: string;
    userId: string;
    name: string;
    uri: string;
    moduleId: string | null;
    description: string;
    resourceType: MCPResourceType;
    url?: string | null;
    mimeType: string;
    metadata: Record<string, unknown> | null;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Resource creation input
 */
export interface CreateResourceInput {
    name: string;
    uri: string;
    moduleId?: string | null;
    description: string;
    resourceType?: MCPResourceType;
    url?: string | null;
    mimeType?: string;
    metadata?: Record<string, unknown>;
    enabled?: boolean;
}
/**
 * Resource update input
 */
export interface UpdateResourceInput {
    name?: string;
    uri?: string;
    moduleId?: string | null;
    description?: string;
    resourceType?: MCPResourceType;
    url?: string | null;
    mimeType?: string;
    metadata?: Record<string, unknown>;
    enabled?: boolean;
}
/**
 * Resource list filters
 */
export interface ResourceFilters {
    moduleId?: string;
    enabled?: boolean;
    search?: string;
}
/**
 * MCP Resource as exposed via protocol
 */
export interface MCPProtocolResource {
    uri: string;
    name: string;
    description: string;
    mimeType?: string;
}
/**
 * Resource content response
 */
export interface ResourceContent {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
    metadata?: Record<string, unknown>;
}
/**
 * Prompt argument definition
 */
export interface PromptArgument {
    name: string;
    description: string;
    required: boolean;
    type: string;
}
/**
 * MCP Prompt entity
 */
export interface MCPPrompt {
    id: string;
    userId: string;
    name: string;
    description: string;
    arguments: PromptArgument[];
    moduleId: string | null;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Prompt creation input
 */
export interface CreatePromptInput {
    name: string;
    description: string;
    arguments: PromptArgument[];
    moduleId?: string | null;
    enabled?: boolean;
}
/**
 * Prompt update input
 */
export interface UpdatePromptInput {
    name?: string;
    description?: string;
    arguments?: PromptArgument[];
    moduleId?: string | null;
    enabled?: boolean;
}
/**
 * Prompt list filters
 */
export interface PromptFilters {
    moduleId?: string;
    enabled?: boolean;
    search?: string;
}
/**
 * MCP Prompt as exposed via protocol
 */
export interface MCPProtocolPrompt {
    name: string;
    description: string;
    arguments: PromptArgument[];
}
/**
 * Prompt get request with arguments
 */
export interface PromptGetRequest {
    name: string;
    arguments?: Record<string, unknown>;
}
/**
 * Prompt message (result of prompt/get)
 */
export interface PromptMessage {
    role: 'user' | 'assistant' | 'system';
    content: {
        type: 'text';
        text: string;
    };
}
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
/**
 * Authentication method used for the request
 */
export type MCPAuthMethod = 'api_key' | 'oauth_bearer';
/**
 * MCP Request context (passed to handlers)
 */
export interface MCPContext {
    userId: string;
    authMethod: MCPAuthMethod;
    apiKeyId: string | null;
    oauthClientId: string | null;
    sessionId: string;
    scopes: string[];
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
//# sourceMappingURL=mcp.d.ts.map