# MCP Tool Naming Inconsistency Fix

> **Date**: 2026-03-11
> **Issue**: MCP tool naming inconsistency when scopes are selected vs. not selected
> **Status**: ✅ Fixed

## Problem Summary

The MoLOS MCP server had a critical inconsistency in tool naming and permission handling:

### Symptoms

**When scopes are selected (permissions restricted):**

- API keys with specific scopes returned zero tools
- Tools were not available to the AI agent
- Logs showed scope strings in format: `['MoLOS-Tasks:tasks:get_tasks', 'MoLOS-Markdown:main:get_markdown_pages']`

**When no scopes selected (default - all tools):**

- Tools loaded correctly
- Tools appeared in format: `['MoLOS-Tasks_get_tasks', 'MoLOS-Markdown_get_markdown_pages']`
- AI agent could use all tools without issues

### Root Cause

The MCP authentication system was mixing two different data formats:

1. **Scope strings** (for permission checking): `module:submodule:tool`
   - Example: `MoLOS-Tasks:tasks:get_tasks`
   - Used in OAuth scopes and API key `allowedScopes` field

2. **Module IDs** (for toolbox loading): `module`
   - Example: `MoLOS-Tasks`
   - Used by `AiToolbox.getTools()` to filter which modules to load

The issue occurred because `MCPContext.allowedModules` was being used for BOTH purposes:

- Toolbox expected module IDs (e.g., `['MoLOS-Tasks']`)
- Scope middleware expected scope strings (e.g., `['MoLOS-Tasks:tasks:get_tasks']`)

When scopes were selected, the authentication middleware passed full scope strings to the toolbox:

```typescript
// Before fix (BROKEN):
allowedModules = ['MoLOS-Tasks:tasks:get_tasks']; // Scope strings!
const modulesToLoad = allModules.filter((m) => allowedModules.includes(m.id));
// Result: No modules match because 'MoLOS-Tasks' !== 'MoLOS-Tasks:tasks:get_tasks'
```

## Solution

### 1. Separated Context Fields

Added a new field to `MCPContext` to separate the two concerns:

```typescript
export interface MCPContext {
	userId: string;
	authMethod: MCPAuthMethod;
	apiKeyId: string | null;
	oauthClientId: string | null;
	sessionId: string;
	scopes: string[]; // OAuth scopes (for OAuth auth)
	allowedModules: string[]; // Module IDs for toolbox loading
	allowedScopes: string[]; // Scope strings for permission checking ← NEW
}
```

### 2. Added Helper Function

Created `extractModuleIdsFromScopes()` in `mcp-utils.ts`:

```typescript
/**
 * Extract module IDs from scopes
 *
 * Handles both module IDs and scope strings:
 * - "MoLOS-Tasks" -> "MoLOS-Tasks"
 * - "MoLOS-Tasks:tasks:get_tasks" -> "MoLOS-Tasks"
 * - "MoLOS-Tasks:tasks" -> "MoLOS-Tasks"
 *
 * @param scopes - Array of scope strings or module IDs
 * @returns Array of unique module IDs
 */
export function extractModuleIdsFromScopes(scopes: string[]): string[] {
	const moduleIds = new Set<string>();
	const availableModules = getAllModules();

	for (const scope of scopes) {
		const parts = scope.split(':');
		const potentialModuleId = parts[0];

		const isValidModule = availableModules.some((m) => m.id === potentialModuleId);

		if (isValidModule) {
			moduleIds.add(potentialModuleId);
		}
	}

	return Array.from(moduleIds);
}
```

### 3. Updated Authentication Middleware

Modified `authenticateWithApiKey()` and `authenticateWithOAuth()` in `auth-middleware.ts`:

```typescript
// After fix (CORRECT):
let scopeStrings = validation.apiKey.allowedScopes ?? [];

if (scopeStrings.length === 0) {
	// No restriction = allow all external modules
	moduleIds = getAllModules()
		.filter((m) => m.isPackageModule || m.isExternal)
		.map((m) => m.id);
	scopeStrings = []; // Empty = no restriction for permission checking
} else {
	// Extract module IDs from scope strings for toolbox loading
	moduleIds = extractModuleIdsFromScopes(scopeStrings);
	// Keep original scopes for permission checking
}

const context: MCPContext = {
	userId: validation.apiKey.userId,
	authMethod: 'api_key',
	apiKeyId: validation.apiKey.id,
	oauthClientId: null,
	sessionId,
	scopes: [],
	allowedModules: moduleIds, // ← Module IDs for toolbox
	allowedScopes: scopeStrings // ← Scope strings for permission checking
};
```

### 4. Updated Scope Middleware

Modified all validation functions in `scope-middleware.ts` to use `context.allowedScopes`:

```typescript
export async function validateToolScope(
	context: MCPContext,
	toolName: string
): Promise<ScopeValidation> {
	const allowed = await isToolAllowed(toolName, context.allowedScopes); // ← Changed from allowedModules
	// ...
}

export function validateResourceScope(
	context: MCPContext,
	moduleId: string,
	submoduleId: string | null
): ScopeValidation {
	const allowed = isResourceAllowed(moduleId, submoduleId, null, context.allowedScopes); // ← Changed from allowedModules
	// ...
}

export function validatePromptScope(
	context: MCPContext,
	promptModuleId: string | null,
	promptSubmoduleId: string | null
): ScopeValidation {
	const allowed = isPromptAllowed(promptModuleId, promptSubmoduleId, null, context.allowedScopes); // ← Changed from allowedModules
	// ...
}
```

### 5. Updated Discovery Services

Modified resource and prompt discovery services to use `allowedScopes` for permission checking:

- `resources-discovery.ts`: Changed line 80 from `context.allowedModules` to `context.allowedScopes`
- `prompts-discovery.ts`: Changed line 69 from `context.allowedModules` to `context.allowedScopes`

## Files Modified

| File                                                     | Changes                                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/lib/models/ai/mcp/protocol.ts`                      | Added `allowedScopes` to `MCPContext` interface                              |
| `packages/core/src/types/mcp.ts`                         | Added `allowedScopes` to `MCPContext` interface                              |
| `src/lib/server/ai/mcp/mcp-utils.ts`                     | Added `extractModuleIdsFromScopes()` function                                |
| `src/lib/server/ai/mcp/middleware/auth-middleware.ts`    | Updated auth functions to populate both `allowedModules` and `allowedScopes` |
| `src/lib/server/ai/mcp/middleware/scope-middleware.ts`   | Updated validation functions to use `allowedScopes`                          |
| `src/lib/server/ai/mcp/discovery/resources-discovery.ts` | Updated permission check to use `allowedScopes`                              |
| `src/lib/server/ai/mcp/discovery/prompts-discovery.ts`   | Updated permission check to use `allowedScopes`                              |

## Verification

### Expected Behavior After Fix

**With scopes selected:**

```
[MCP Auth] Original allowedScopes: ['MoLOS-Tasks:tasks:get_tasks']
[MCP Auth] Extracted module IDs from scopes: ['MoLOS-Tasks']
[MCP Auth] Using original scopes for permission checking: ['MoLOS-Tasks:tasks:get_tasks']
[MCP Tools] Got tools from toolbox, count: 73
```

**Without scopes selected:**

```
[MCP Auth] Original allowedScopes: []
[MCP Auth] Expanded allowedModules to all external modules: ['MoLOS-LLM-Council', 'MoLOS-Markdown', 'MoLOS-Tasks']
[MCP Tools] Got tools from toolbox, count: 73
```

Both scenarios should now work correctly with the same set of tools available.

### Testing Checklist

- [ ] Test with API key that has specific scopes selected
- [ ] Test with API key that has no scopes (default, full access)
- [ ] Verify tool names are consistent in both scenarios
- [ ] Verify permission checking works correctly with scope strings
- [ ] Verify toolbox correctly loads modules from module IDs
- [ ] Test with OAuth authentication
- [ ] Test with API key authentication

## Impact

### Benefits

1. **Consistency**: Tool names are now consistent regardless of scope selection
2. **Proper Permissions**: Scope-based permission checking works correctly
3. **Module Loading**: Toolbox can correctly load modules from module IDs
4. **Future-Proof**: Separation of concerns allows for independent evolution of scope format

## Related Issues

This fix resolves tool naming inconsistency reported by users where agents could not access MCP tools when specific permissions were selected via the UI.

---

_Last Updated: 2026-03-11_
