# Product Requirements Document (PRD) - MoLOS MCP Server Integration

## Module: AI Module - MCP Submodule

### 1. Executive Summary
**Project Name:** MoLOS MCP Server (Integrated into AI Module)
**Module ID:** `ai` (existing module) → New MCP submodule
**Target Routes:**
- Dashboard: `/ui/ai/mcp`
- API Keys: `/ui/ai/mcp/keys`
- Resources: `/ui/ai/mcp/resources`
- Prompts: `/ui/ai/mcp/prompts`
- Logs: `/ui/ai/mcp/logs`

**API Routes:**
- Transport: `/api/ai/mcp/transport`
- Keys Management: `/api/ai/mcp/keys`

**Key Decisions:**
| Question | Decision |
|----------|----------|
| Active Module Selection | **Option B:** MCP-specific module toggle per API key |
| Authentication | **Option B:** Scoped API tokens with module-level access control |
| Resources/Prompts | **Phase 1:** Implement both endpoints now |
| Tool Naming | **Keep existing prefix:** `MoLOS-Tasks_get_tasks` |

---

### 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MoLOS MCP Architecture                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  External AI Client (Claude Desktop, etc.)                           │
│         │                                                             │
│         │ X-API-Key: mcp_live_xxxxx (scoped to specific modules)     │
│         ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              SSE Endpoint: /api/ai/mcp/transport             │    │
│  │                    (JSON-RPC 2.0)                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│         │                                                             │
│         ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    MCP Handler                               │    │
│  │  - Validates API Key & Scope                                 │    │
│  │  - Routes to: Tools | Resources | Prompts                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│         │                                                             │
│         ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                 AiToolbox (existing)                         │    │
│  │  - Filters tools by API key's allowed modules                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3. Database Schema Updates

Add to `src/lib/server/db/schema/ai-schema.ts`:

#### 3.1 Table: `ai_mcp_api_keys`
Scoped API keys for MCP access.

```typescript
export const MCPApiKeyStatus = {
	ACTIVE: 'active',
	DISABLED: 'disabled',
	REVOKED: 'revoked'
} as const;

export const aiMcpApiKeys = sqliteTable('ai_mcp_api_keys', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull().describe('User-defined name for this key'),
	keyPrefix: text('key_prefix').notNull().describe('First 8 chars for display'),
	keyHash: text('key_hash').notNull().describe('SHA-256 hash of full key'),
	status: textEnum('status', MCPApiKeyStatus).notNull().default(MCPApiKeyStatus.ACTIVE),

	// Scoping - which modules this key can access
	allowedModules: text('allowed_modules', { mode: 'json' })
		.notNull()
		.$type<string[]>()

	// Optional expiration
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),

	// Last used tracking
	lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
	usageCount: integer('usage_count').notNull().default(0),

	// Audit
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
});
```

#### 3.2 Table: `ai_mcp_logs`
Request/response logging with API key tracking.

```typescript
export const MCPLogStatus = {
	SUCCESS: 'success',
	ERROR: 'error'
} as const;

export const aiMcpLogs = sqliteTable('ai_mcp_logs', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	apiKeyId: text('api_key_id').references(() => aiMcpApiKeys.id),
	sessionId: text('session_id').notNull(),
	requestId: text('request_id').notNull(),
	method: text('method').notNull(),
	toolName: text('tool_name'),
	resourceName: text('resource_name'),
	promptName: text('prompt_name'),
	params: text('params', { mode: 'json' }),
	result: text('result'),
	errorMessage: text('error_message'),
	status: textEnum('status', MCPLogStatus).notNull(),
	durationMs: integer('duration_ms'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
});
```

#### 3.3 Table: `ai_mcp_resources`
User-defined resources for MCP access.

```typescript
export const aiMcpResources = sqliteTable('ai_mcp_resources', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull().describe('Resource identifier (e.g., "tasks://active")'),
	uri: text('uri').notNull().describe('Full URI (e.g., "mcp://molos/tasks/active")'),
	moduleId: text('module_id').notNull().describe('Source module for this resource'),
	description: text('description').notNull(),
	mimeType: text('mime_type').default('application/json'),
	metadata: text('metadata', { mode: 'json' }),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
});
```

#### 3.4 Table: `ai_mcp_prompts`
User-defined prompt templates for MCP.

```typescript
export const aiMcpPrompts = sqliteTable('ai_mcp_prompts', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull().describe('Prompt identifier'),
	description: text('description').notNull(),
	arguments: text('arguments', { mode: 'json' })
		.notNull()
		.$type<Array<{ name: string; description: string; required?: boolean }>>(),
	moduleId: text('module_id').describe('Associated module (optional)'),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
});
```

---

### 4. File Structure

```
src/
├── lib/
│   ├── config/
│   │   └── modules/
│   │       └── ai/
│   │           └── config.ts              # UPDATE: Add MCP nav items
│   ├── models/
│   │   └── ai/
│   │       ├── mcp/
│   │       │   ├── index.ts               # MCP types
│   │       │   ├── api-key.ts             # API key types
│   │       │   ├── resource.ts            # Resource types
│   │       │   └── prompt.ts              # Prompt types
│   ├── repositories/
│   │   └── ai/
│   │       ├── mcp/
│   │       │   ├── api-key-repository.ts
│   │       │   ├── mcp-log-repository.ts
│   │       │   ├── resource-repository.ts
│   │       │   └── prompt-repository.ts
│   └── server/
│       ├── ai/
│       │   ├── mcp/
│       │   │   ├── handlers/
│       │   │   │   ├── index.ts           # Main handler router
│       │   │   │   ├── tools-handler.ts   # tools/list, tools/call
│       │   │   │   ├── resources-handler.ts  # resources/list, resources/read
│       │   │   │   ├── prompts-handler.ts    # prompts/list, prompts/get
│       │   │   │   └── initialize-handler.ts  # initialize handshake
│       │   │   ├── middleware/
│       │   │   │   ├── auth-middleware.ts     # API key validation
│       │   │   │   └── scope-middleware.ts    # Module scope checking
│       │   │   ├── discovery/
│       │   │   │   ├── tools-discovery.ts     # Wrap AiToolbox for MCP
│       │   │   │   ├── resources-discovery.ts # Discover resources
│       │   │   │   └── prompts-discovery.ts   # Discover prompts
│       │   │   ├── mcp-transport.ts       # SSE transport layer
│       │   │   ├── json-rpc.ts            # JSON-RPC 2.0 utilities
│       │   │   └── mcp-utils.ts           # Helper functions
│       └── db/
│           └── schema/
│               └── ai-schema.ts           # UPDATE: Add MCP tables
├── routes/
│   ├── api/
│   │   └── ai/
│   │       └── mcp/
│   │           ├── transport/
│   │           │   └── +server.ts         # SSE endpoint
│   │           └── keys/
│   │               ├── +server.ts         # CRUD for API keys
│   │               └── [keyId]/
│   │                   └── +server.ts     # Individual key operations
│   └── ui/
│       └── (modules)/
│           └── ai/
│               └── mcp/
│                   ├── +page.svelte        # MCP dashboard (overview)
│                   ├── +page.server.ts
│                   ├── keys/
│                   │   ├── +page.svelte    # API keys management
│                   │   └── +page.server.ts
│                   ├── resources/
│                   │   ├── +page.svelte    # Resources management
│                   │   └── +page.server.ts
│                   ├── prompts/
│                   │   ├── +page.svelte    # Prompts management
│                   │   └── +page.server.ts
│                   └── logs/
│                       ├── +page.svelte    # Activity logs
│                       └── +page.server.ts
```

---

### 5. MCP Protocol Methods (Phase 1)

#### 5.1 Initialize
```json
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": { "name": "client-name", "version": "1.0.0" }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {},
      "resources": { "subscribe": false },
      "prompts": {}
    },
    "serverInfo": { "name": "MoLOS MCP", "version": "1.0.0" }
  }
}
```

#### 5.2 Tools Methods
**tools/list** - Returns available tools (filtered by API key scope)

**tools/call** - Executes a tool with arguments

#### 5.3 Resources Methods
**resources/list** - Returns available resources

**resources/read** - Reads a resource's content

#### 5.4 Prompts Methods
**prompts/list** - Returns available prompts

**prompts/get** - Gets a prompt with arguments filled

---

### 6. API Key Format

```
mcp_live_[prefix]_[suffix]

Examples:
- mcp_live_abc12345_xyz67890 (live key)
- mcp_test_def67890_abc12345 (test key)
```

- **Prefix:** 8 characters (stored, shown in UI)
- **Suffix:** 8 characters (shown once at creation)
- **Hash:** SHA-256(prefix + suffix + secret salt) stored in DB

---

### 7. Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                     Security Flow                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Client Request with X-API-Key header                     │
│         │                                                     │
│         ▼                                                     │
│  2. Auth Middleware: Validate key hash & status              │
│         │                                                     │
│         ▼                                                     │
│  3. Scope Middleware: Check allowedModules[]                 │
│         │                                                     │
│         ▼                                                     │
│  4. Tool Discovery: Filter AiToolbox by allowed modules      │
│         │                                                     │
│         ▼                                                     │
│  5. Execution: Pass userId + allowedModules to tool          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

### 8. UI Components

#### 8.1 MCP Dashboard (`/ui/ai/mcp`)
- Connection status indicator
- Quick stats (active keys, tool calls today)
- Recent activity log
- Quick actions (create key, view docs)

#### 8.2 API Keys (`/ui/ai/mcp/keys`)
- List of API keys with status
- Create new key dialog
- Edit key (name, module scope, expiration)
- Revoke key
- Show key prefix (last 4 of prefix for identification)

#### 8.3 Resources (`/ui/ai/mcp/resources`)
- List of MCP resources
- Create/edit/delete resources
- Associate with modules

#### 8.4 Prompts (`/ui/ai/mcp/prompts`)
- List of prompt templates
- Create/edit/delete prompts
- Define arguments schema

#### 8.5 Logs (`/ui/ai/mcp/logs`)
- Paginated request/response log
- Filter by method, status, API key
- View full request/response

---

### 9. Implementation Steps

1. **Database Schema & Migrations** - Add all MCP tables
2. **Repositories** - Create data access layer
3. **Models/Types** - Define TypeScript interfaces
4. **MCP Core** - JSON-RPC handler, transport layer
5. **Middleware** - Auth & scope validation
6. **Handlers** - Tools, Resources, Prompts endpoints
7. **API Endpoint** - SSE transport at `/api/ai/mcp/transport`
8. **API Keys API** - CRUD for API keys
9. **UI Components** - All pages under `/ui/ai/mcp/`
10. **AI Module Config** - Update navigation

---

### 10. Success Criteria

1. **Protocol Compliance:** Valid JSON-RPC 2.0 implementation over SSE
2. **Scoped Access:** API keys can only access configured modules
3. **Tool Discovery:** Successfully lists tools from enabled modules
4. **Tool Execution:** External MCP client can call tools
5. **User Isolation:** Complete separation between users
6. **Observability:** Dashboard shows all activity
