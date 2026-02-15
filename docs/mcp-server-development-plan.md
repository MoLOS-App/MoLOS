# MCP Server for MoLOS - Development Plan

## Executive Summary

This plan outlines the development of a **Model Context Protocol (MCP) server** for MoLOS that will allow Claude Code (and other MCP-compatible clients) to interact with all the AI tools available in the MoLOS modular system.

## Context Analysis

### What is MoLOS?

MoLOS (Modular Life Organization System) is a plug-and-play modular application with:

- **Core modules** (built-in, in `src/lib/config/modules/`)
- **External modules** (dynamically loaded from `external_modules/`)
- **AI tools** defined per module in `lib/server/ai/ai-tools.ts`
- A `ToolDefinition` interface with `name`, `description`, `parameters` (JSON Schema), and `execute` function

### Tool Discovery Flow

```
AiToolbox.getTools(userId, activeModuleIds)
    |
    +-> getCoreAiTools(userId)        # Core tools (global/system)
    |
    +-> getAllModules()                # Discover all modules
    |
    +-> import.meta.glob('./external_modules/*/ai-tools.ts')  # Load module tools
    |
    +-> Prefix tool names: {moduleId}_{toolName}
```

### ToolDefinition Interface

```typescript
// Location: src/lib/models/ai/index.ts
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (params: any) => Promise<any>;
}
```

### Example: MoLOS-AI-Knowledge Module Tools

The `MoLOS-AI-Knowledge` external module provides:
- `list_prompts` - List saved prompts
- `create_prompt` - Create new prompt
- `update_prompt` - Update existing prompt
- `delete_prompt` - Soft-delete prompt
- `list_llm_files` - List LLM.txt files
- `create_llm_file` - Create LLM.txt entry
- `update_llm_file` - Update LLM.txt entry
- `list_playground_sessions` - List playground sessions
- `create_playground_session` - Create playground session
- `update_playground_session` - Update playground session
- `delete_playground_session` - Delete playground session
- `list_humanizer_jobs` - List humanizer jobs
- `humanize_text` - Run humanizer pipeline
- `delete_humanizer_job` - Delete humanizer job

---

## Architecture Design

### High-Level Architecture

```
+-----------------------------------------------------------------+
|                         Claude Code                             |
|                    (MCP Client)                                 |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                    MoLOS MCP Server                             |
|                   (Node.js/TypeScript)                          |
|  +-------------------------------------------------------------+ |
|  |              MCP Protocol Layer                             | |
|  |  - stdio transport                                          | |
|  |  - request/response handling                                | |
|  |  - tool registration                                        | |
|  +-------------------------------------------------------------+ |
|  +-------------------------------------------------------------+ |
|  |          Tool Discovery & Mapping Layer                     | |
|  |  - Connects to MoLOS API                                    | |
|  |  - Caches tool definitions                                  | |
|  |  - Maps MCP calls to MoLOS tools                            | |
|  +-------------------------------------------------------------+ |
|  +-------------------------------------------------------------+ |
|  |              Authentication Layer                           | |
|  |  - API key/Token management                                 | |
|  |  - User context injection                                   | |
|  +-------------------------------------------------------------+ |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                      MoLOS Application                          |
|                    (SvelteKit Backend)                          |
|  +-------------------------------------------------------------+ |
|  |              /api/mcp/* Endpoints                            | |
|  |  - GET /api/mcp/tools - List all tools                      | |
|  |  - POST /api/mcp/execute - Execute tool                     | |
|  |  - GET /api/mcp/modules - List active modules               | |
|  +-------------------------------------------------------------+ |
|                    AiToolbox / Module System                    |
+-----------------------------------------------------------------+
```

---

## Implementation Plan

### Phase 1: MoLOS API Endpoints (Server Side)

#### 1.1 Create MCP API Routes in MoLOS

**Location:** `src/routes/api/mcp/`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/mcp/tools` | GET | Returns all available tools in MCP format |
| `/api/mcp/execute` | POST | Executes a tool by name with parameters |
| `/api/mcp/modules` | GET | Lists available/active modules |
| `/api/mcp/schema` | GET | Returns JSON Schema for tool parameters |

**File Structure:**
```
src/routes/api/mcp/
+-- +server.ts                 # Main MCP endpoint
+-- tools/+server.ts           # Tool listing
+-- execute/+server.ts         # Tool execution
+-- modules/+server.ts         # Module listing
+-- schema/+server.ts          # Schema definitions
```

#### 1.2 Tool Definition Mapper

Create a mapper to convert MoLOS `ToolDefinition` to MCP tool format.

**MCP Tool Format:**
```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, JSONSchema>;
    required?: string[];
  };
}
```

**Location:** `src/lib/server/mcp/tool-mapper.ts`

---

### Phase 2: MCP Server Implementation

#### 2.1 Project Structure

Create a new package for the MCP server:

```
mcp-server-molos/
+-- package.json
+-- tsconfig.json
+-- src/
|   +-- index.ts              # Server entry point
|   +-- server.ts             # MCP server class
|   +-- tools/
|   |   +-- index.ts          # Tool registry
|   |   +-- core.ts           # Core tools mapping
|   |   +-- modules.ts        # Dynamic module tools
|   +-- transport/
|   |   +-- stdio.ts          # stdio transport handler
|   +-- types/
|   |   +-- index.ts          # TypeScript types
|   +-- config.ts             # Configuration
+-- README.md
+-- .env.example
```

#### 2.2 MCP Server Core

**Key Components:**

1. **Server Class** (`src/server.ts`)
   - Implements MCP protocol
   - Handles tool registration
   - Manages connection lifecycle

2. **Tool Registry** (`src/tools/index.ts`)
   - Fetches tools from MoLOS API
   - Caches tool definitions
   - Maps tool calls to API requests

3. **Transport Layer** (`src/transport/stdio.ts`)
   - stdio-based communication
   - Request/response parsing
   - Error handling

#### 2.3 Configuration

**Environment Variables:**
```env
MOLOS_API_URL=http://localhost:5173
MOLOS_API_KEY=your_api_key_here
MOLOS_USER_ID=user_id_here
MCP_SERVER_DEBUG=false
```

---

### Phase 3: Tool Execution Flow

```
Claude Code                  MCP Server                   MoLOS API
     |                            |                            |
     |  tools/list                |                            |
     |--------------------------->|                            |
     |                            |  GET /api/mcp/tools        |
     |                            |--------------------------->|
     |                            |  Tool definitions          |
     |                            |<---------------------------|
     |  MCP Tool List             |                            |
     |<---------------------------|                            |
     |                            |                            |
     |  tools/call                |                            |
     |  { name: "list_prompts",    |                            |
     |    params: {...} }          |                            |
     |--------------------------->|                            |
     |                            |  POST /api/mcp/execute      |
     |                            |  { toolName, params,        |
     |                            |    userId }                |
     |                            |--------------------------->|
     |                            |                            |
     |                            |  AiToolbox -> Repository    |
     |                            |                            |
     |                            |  Execution result           |
     |                            |<---------------------------|
     |  Tool Result               |                            |
     |<---------------------------|                            |
```

---

### Phase 4: Claude Code Integration

#### 4.1 MCP Server Configuration

**Claude Code MCP Config (`~/.config/claude-code/mcp_config.json`):**
```json
{
  "mcpServers": {
    "molos": {
      "command": "node",
      "args": ["/path/to/mcp-server-molos/dist/index.js"],
      "env": {
        "MOLOS_API_URL": "http://localhost:5173",
        "MOLOS_API_KEY": "your_api_key",
        "MOLOS_USER_ID": "user_id"
      }
    }
  }
}
```

#### 4.2 Tool Naming Convention

Tools will be exposed to Claude Code with the following naming:

| Source | Tool Name Format | Example |
|--------|------------------|---------|
| Core tools | `molos_{tool_name}` | `molos_get_active_modules` |
| Module tools | `molos_{module_id}_{tool_name}` | `molos_MoLOS-AI-Knowledge_list_prompts` |

---

## Detailed Implementation Steps

### Step 1: Create MoLOS MCP API Endpoints

**File: `src/routes/api/mcp/tools/+server.ts`**
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AiToolbox } from '$lib/server/ai/toolbox';

export const GET: RequestHandler = async ({ locals, url }) => {
  // Authentication check (API key for MCP)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate API key and get user ID
  const userId = await validateMcpApiKey(authHeader.slice(7));
  if (!userId) {
    return json({ error: 'Invalid API key' }, { status: 401 });
  }

  const activeModuleIds = url.searchParams.getAll('modules');

  const toolbox = new AiToolbox();
  const tools = await toolbox.getTools(userId, activeModuleIds);

  // Convert to MCP format
  const mcpTools = tools.map(tool => ({
    name: `molos_${tool.name}`,
    description: tool.description,
    inputSchema: tool.parameters
  }));

  return json({ tools: mcpTools });
};
```

**File: `src/routes/api/mcp/execute/+server.ts`**
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AiToolbox } from '$lib/server/ai/toolbox';

export const POST: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = await validateMcpApiKey(authHeader.slice(7));
  if (!userId) {
    return json({ error: 'Invalid API key' }, { status: 401 });
  }

  const { toolName, params } = await request.json();

  const toolbox = new AiToolbox();
  const tools = await toolbox.getTools(userId);

  // Remove molos_ prefix if present
  const baseToolName = toolName.replace(/^molos_/, '');

  const tool = tools.find(t => t.name === baseToolName);
  if (!tool) {
    return json({ error: 'Tool not found' }, { status: 404 });
  }

  try {
    const result = await tool.execute(params);
    return json({ result });
  } catch (error) {
    return json({
      error: 'Tool execution failed',
      details: error.message
    }, { status: 500 });
  }
};
```

### Step 2: Create MCP Server Package

**Initialize project:**
```bash
mkdir mcp-server-molos
cd mcp-server-molos
npm init -y
npm install @modelcontextprotocol/sdk
npm install -D typescript @types/node
```

**File: `src/index.ts`**
```typescript
#!/usr/bin/env node

import { MCPServer } from './server.js';
import { config } from './config.js';

const server = new MCPServer(config);

server.start().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
```

**File: `src/server.ts`**
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MoLOSApiClient } from './tools/modules.js';
import type { MCPServerConfig } from './types/index.js';

export class MCPServer {
  private server: Server;
  private apiClient: MoLOSApiClient;
  private config: MCPServerConfig;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.apiClient = new MoLOSApiClient(config);
    this.server = new Server(
      {
        name: 'mcp-server-molos',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const response = await this.apiClient.fetchTools();
      return {
        tools: response.tools,
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.apiClient.executeTool(name, args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MoLOS MCP server running on stdio');
  }
}
```

**File: `src/tools/modules.ts`**
```typescript
import type { MoLOSApiConfig } from '../types/index.js';

export class MoLOSApiClient {
  private baseUrl: string;
  private apiKey: string;
  private userId: string;

  constructor(config: MoLOSApiConfig) {
    this.baseUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.userId = config.userId;
  }

  async fetchTools() {
    const response = await fetch(`${this.baseUrl}/api/mcp/tools`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tools: ${response.statusText}`);
    }

    return response.json();
  }

  async executeTool(toolName: string, params: Record<string, unknown>) {
    const response = await fetch(`${this.baseUrl}/api/mcp/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toolName,
        params,
        userId: this.userId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Tool execution failed');
    }

    return response.json();
  }
}
```

### Step 3: Add API Key Authentication to MoLOS

**Database Schema: `src/lib/server/db/schema/mcp-schema.ts`** (New)
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const mcpApiKeys = sqliteTable('mcp_api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  key: text('key').notNull().unique(),
  scopes: text('scopes'), // JSON array of scopes
  expiresAt: integer('expires_at'),
  createdAt: integer('created_at').notNull(),
  lastUsedAt: integer('last_used_at'),
});
```

**File: `src/lib/server/mcp/auth.ts`** (New)
```typescript
import { db } from '$lib/server/db';
import { mcpApiKeys } from '$lib/server/db/schema/mcp-schema';
import { eq } from 'drizzle-orm';

export async function validateMcpApiKey(apiKey: string): Promise<string | null> {
  const result = await db
    .select()
    .from(mcpApiKeys)
    .where(eq(mcpApiKeys.key, apiKey))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const keyRecord = result[0];

  // Check if key is expired
  if (keyRecord.expiresAt && keyRecord.expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }

  // Update last used timestamp
  await db
    .update(mcpApiKeys)
    .set({ lastUsedAt: Math.floor(Date.now() / 1000) })
    .where(eq(mcpApiKeys.id, keyRecord.id));

  return keyRecord.userId;
}

export async function generateMcpApiKey(userId: string, name: string): Promise<string> {
  const key = `molos_mcp_${crypto.randomUUID()}`;

  await db.insert(mcpApiKeys).values({
    id: crypto.randomUUID(),
    userId,
    name,
    key,
    scopes: JSON.stringify(['read', 'write']),
    createdAt: Math.floor(Date.now() / 1000),
  });

  return key;
}
```

### Step 4: Create MCP API Key Management UI

**Location:** `src/routes/ui/settings/mcp/`

- List existing API keys
- Generate new API keys
- Revoke API keys
- View usage statistics

---

## Testing Strategy

### Unit Tests

```typescript
// src/lib/server/mcp/tool-mapper.test.ts
describe('ToolMapper', () => {
  it('should convert MoLOS ToolDefinition to MCP format', () => {
    const molosTool: ToolDefinition = {
      name: 'get_tasks',
      description: 'Get user tasks',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' }
        }
      },
      execute: async () => ({})
    };

    const mcpTool = toMCPTool(molosTool);
    expect(mcpTool.name).toBe('molos_get_tasks');
    expect(mcpTool.inputSchema).toEqual(molosTool.parameters);
  });
});
```

### Integration Tests

```typescript
// mcp-server-molos/test/integration.test.ts
describe('MCP Server Integration', () => {
  it('should list all available tools', async () => {
    const server = new MCPServer(mockConfig);
    const tools = await server.listTools();

    expect(tools).toContainEqual({
      name: 'molos_get_active_modules',
      description: expect.any(String),
      inputSchema: expect.any(Object)
    });
  });

  it('should execute a tool call', async () => {
    const result = await server.callTool('molos_get_active_modules', {});
    expect(result).toHaveProperty('content');
  });
});
```

### Manual Testing with Claude Code

1. Start MoLOS development server:
   ```bash
   npm run dev
   ```

2. Run MCP server in separate terminal:
   ```bash
   cd mcp-server-molos
   npm run dev
   ```

3. Configure Claude Code with MCP server

4. Test tool calls from Claude Code:
   - "List all available MoLOS modules"
   - "Create a new prompt in my AI Knowledge module"
   - "Humanize this text: ..."

---

## Security Considerations

1. **API Key Management**
   - Secure storage using crypto.randomUUID()
   - Optional expiration dates
   - Scope-based permissions (read/write)

2. **User Isolation**
   - API keys are bound to specific users
   - Tools only access data for authenticated user
   - No cross-user data leakage

3. **Rate Limiting**
   - Prevent abuse of MCP endpoints
   - Track usage per API key

4. **Input Validation**
   - Validate all parameters before execution
   - Sanitize tool names to prevent injection

5. **Audit Logging**
   - Log all tool executions
   - Track API key usage
   - Monitor for suspicious activity

---

## Success Criteria

- [ ] MCP server successfully connects to Claude Code
- [ ] All core tools are discoverable and callable
- [ ] Tools from active external modules are discoverable
- [ ] Tool execution returns correct results
- [ ] Authentication and authorization work correctly
- [ ] Error handling is robust
- [ ] Documentation is complete

---

## Appendix: Core Tools Reference

### Core Tools (Always Available)

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `get_active_modules` | Lists all currently active modules | None |
| `get_user_profile` | Retrieves current user's profile | None |
| `get_current_time` | Returns current date/time in ISO format | None |
| `search_codebase` | Searches codebase for patterns | `query`, `path?` |
| `list_files` | Lists files in a directory | `path`, `recursive?` |
| `save_memory` | Saves important user information | `content`, `importance?` |

---

**Document Version:** 1.0
**Last Updated:** 2026-01-31
**Author:** Generated for MoLOS MCP Server Development
