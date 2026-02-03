# MCP Server Tests

This directory is for comprehensive test coverage of the MCP implementation.

## TODO

### Unit Tests to Implement

1. **json-rpc.test.ts**
   - `isValidJSONRPCRequest()` - valid and invalid requests
   - `createSuccessResponse()` - response structure
   - `createErrorResponse()` - error responses
   - `parseMethod()` - method parsing

2. **validation/schemas.test.ts**
   - InitializeRequestParamsSchema validation
   - ToolsCallRequestParamsSchema validation
   - ResourcesReadRequestParamsSchema validation
   - PromptsGetRequestParamsSchema validation
   - Custom error messages for invalid data

3. **handlers.test.ts**
   - `handleInitialize()` - protocol version validation
   - `handleToolsMethod()` - list and call
   - `handleResourcesMethod()` - list and read
   - `handlePromptsMethod()` - list and get
   - Error handling paths

4. **auth-middleware.test.ts**
   - Valid API key authentication
   - Invalid API key rejection
   - Expired API key handling
   - `extractApiKeyFromRequest()` header parsing

5. **rate-limit/sliding-window-limiter.test.ts**
   - Sliding window algorithm accuracy
   - Rate limit enforcement
   - Reset functionality
   - Retry-After calculation

6. **cache/mcp-cache.test.ts**
   - Cache get/set operations
   - TTL expiration
   - Cache invalidation
   - Cache key generation

7. **timeout/timeout-handler.test.ts**
   - Timeout enforcement
   - TimeoutError handling
   - Timeout configuration

8. **logging/log-queue.test.ts**
   - Queue operations
   - Batch processing
   - Shutdown behavior

### Integration Tests

9. **transport.test.ts**
   - Full request/response flow
   - Authentication + rate limiting
   - Error responses
   - Content-Type validation

### Test Setup

```typescript
// mocks.ts
export const mockContext: MCPContext = {
	userId: 'test-user',
	apiKeyId: 'test-key',
	sessionId: 'test-session',
	allowedModules: []
};

export const mockMcpRequest: JSONRPCRequest = {
	jsonrpc: '2.0',
	id: 1,
	method: 'tools/list'
};
```

### Coverage Target

- Minimum 80% code coverage
- Focus on critical paths (auth, validation, error handling)
- Mock database with `better-sqlite3` in-memory

### Running Tests

```bash
# Run all MCP tests
npm run test src/lib/server/ai/mcp

# Run with coverage
npm run test -- --coverage src/lib/server/ai/mcp
```
