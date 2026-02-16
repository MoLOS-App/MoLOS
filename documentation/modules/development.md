# Module Development Guide

This guide covers everything you need to know about developing modules for MoLOS in the monorepo architecture.

## Overview

A MoLOS module is a self-contained workspace package that adds functionality to the core application. Modules live in `modules/<module-id>/` and are imported via `@molos/module-*` package names. Each module can provide:

- **UI Routes** - Pages and layouts accessible via the web interface
- **API Routes** - RESTful endpoints for data access
- **AI Tools** - Tools that extend the AI assistant's capabilities
- **Database Schema** - Tables and migrations for persistent storage
- **Components** - Reusable UI components
- **Event Handlers** - Respond to system-wide events

## Creating a New Module

### Using the CLI (Recommended)

```bash
# Create a new module
npm run module:create -- --name="my-module" --template=basic

# This creates:
modules/my-module/
├── src/
│   ├── index.ts           # Module entry point
│   ├── config.ts          # Module configuration
│   ├── routes/            # UI and API routes
│   │   ├── ui/
│   │   │   └── +page.svelte
│   │   └── api/
│   │       └── +server.ts
│   └── lib/
│       ├── components/
│       ├── server/
│       │   ├── ai/        # AI tools
│       │   └── db/        # Database schema
│       └── utils/
├── manifest.yaml          # Module metadata
├── package.json           # Package definition
└── tsconfig.json          # TypeScript config
```

### Manual Creation

```bash
# Create module directory structure
mkdir -p modules/my-module/src/{routes/{ui,api},lib/{components,server/{ai,db}}}

# Copy template files
cp modules/product-owner/package.json modules/my-module/
cp modules/product-owner/tsconfig.json modules/my-module/
cp modules/product-owner/manifest.yaml modules/my-module/

# Edit the files for your module
```

## Module Structure and Conventions

### Directory Layout

```
modules/my-module/
├── manifest.yaml              # Required: Module metadata
├── package.json               # Required: Package definition
├── tsconfig.json              # Required: TypeScript configuration
├── drizzle.config.ts          # Optional: Drizzle configuration
│
└── src/
    ├── index.ts               # Required: Module exports
    ├── config.ts              # Required: Module configuration
    ├── module.ts              # Optional: Lifecycle hooks
    │
    ├── routes/
    │   ├── ui/                # UI routes (SvelteKit pages)
    │   │   ├── +page.svelte
    │   │   ├── +page.server.ts
    │   │   └── +layout.svelte
    │   │
    │   └── api/               # API routes
    │       ├── +server.ts
    │       └── [id]/+server.ts
    │
    └── lib/
        ├── components/        # Svelte components
        │   ├── index.ts
        │   └── MyComponent.svelte
        │
        ├── models/            # Data models and types
        │   └── index.ts
        │
        ├── repositories/      # Data access layer
        │   └── my-repository.ts
        │
        ├── stores/            # Svelte stores
        │   └── index.ts
        │
        ├── utils/             # Utility functions
        │   └── helpers.ts
        │
        └── server/
            ├── ai/            # AI tools
            │   ├── index.ts
            │   └── my-tools.ts
            │
            └── db/
                └── schema/    # Database schema
                    ├── index.ts
                    └── tables.ts
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Module ID | kebab-case | `product-owner`, `task-manager` |
| Package name | @molos/module-{id} | `@molos/module-product-owner` |
| Components | PascalCase | `ProjectCard.svelte` |
| Routes | lowercase | `/ui/product-owner/settings` |
| Database tables | snake_case (auto-prefixed) | `mod_product_owner_projects` |
| AI tools | snake_case | `project_create`, `task_list` |

## manifest.yaml Specification

The manifest file defines module metadata and capabilities:

```yaml
# Required fields
id: "my-module"                           # Unique module identifier
name: "My Module"                         # Human-readable name
version: "1.0.0"                          # Semantic version
description: "Module description"         # Brief description
author: "MoLOS Team"                      # Author name

# Optional: Icon from lucide-svelte
icon: "Package"

# Optional: Entry point for lifecycle hooks (v2.0)
entryPoint: "./src/module.ts"

# Optional: Dependencies on other modules
dependencies:
  - id: "core-utils"
    version: ">=1.0.0"
    optional: true

# Optional: Capabilities declaration
capabilities:
  # Database tables this module creates
  database:
    tables:
      - "projects"
      - "tasks"

  # API routes this module provides
  api:
    routes:
      - "/api/my-module/*"

  # AI tools this module provides
  ai-tools:
    tools:
      - "project_create"
      - "project_list"
      - "task_create"

  # UI routes this module provides
  ui-routes:
    routes:
      - "/ui/my-module"
      - "/ui/my-module/settings"

  # Events this module publishes and subscribes to
  events:
    publishes:
      - "project.created"
      - "project.updated"
      - "project.deleted"
    subscribes:
      - "user.logged_in"
      - "settings.changed"

# Optional: Permissions required
permissions:
  database:
    create: true
    read: true
    update: true
    delete: true
  network:
    allowedDomains:
      - "api.github.com"
    maxRequestsPerMinute: 100

# Optional: Lifecycle hooks
lifecycle:
  onInstall: "./src/hooks/install.ts"
  onEnable: "./src/hooks/enable.ts"
  onDisable: "./src/hooks/disable.ts"
  onUninstall: "./src/hooks/uninstall.ts"
```

## config.ts Patterns

The config file exports module configuration for the navigation and routing system:

```typescript
// src/config.ts

import { Settings, ListTodo, BarChart3 } from 'lucide-svelte';
import type { ModuleConfig } from '@molos/core/types';

export const moduleConfig: ModuleConfig = {
  // Module identifier (must match manifest.yaml)
  id: 'my-module',

  // Display name
  name: 'My Module',

  // Base URL path for the module
  href: '/ui/my-module',

  // Icon component (from lucide-svelte)
  icon: Settings,

  // Description shown in module list
  description: 'A module for managing things',

  // Navigation items shown in sidebar
  navigation: [
    {
      name: 'Dashboard',
      icon: BarChart3,
      href: '/ui/my-module/dashboard'
    },
    {
      name: 'Items',
      icon: ListTodo,
      href: '/ui/my-module/items'
    },
    {
      name: 'Settings',
      icon: Settings,
      href: '/ui/my-module/settings'
    }
  ]
};

export default moduleConfig;
```

### Conditional Navigation

```typescript
// src/config.ts

export const moduleConfig: ModuleConfig = {
  // ... basic config

  // Navigation can be a function for conditional items
  navigation: (user) => [
    {
      name: 'Dashboard',
      icon: BarChart3,
      href: '/ui/my-module/dashboard'
    },
    // Only show admin items to admins
    ...(user.role === 'admin' ? [
      {
        name: 'Admin',
        icon: Shield,
        href: '/ui/my-module/admin'
      }
    ] : [])
  ]
};
```

## Routes, Components, and Lib Organization

### UI Routes

```svelte
<!-- src/routes/ui/+page.svelte -->

<script lang="ts">
  import { page } from '$app/stores';
  import { ModuleLayout } from '@molos/ui/components';
  import { Dashboard } from '$lib/components';

  // Access module configuration
  const moduleId = 'my-module';
</script>

<ModuleLayout moduleId={moduleId}>
  <Dashboard />
</ModuleLayout>
```

### API Routes

```typescript
// src/routes/api/items/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { itemRepository } from '$lib/repositories';
import { getTableName } from '@molos/database';

export const GET: RequestHandler = async ({ url, locals }) => {
  const items = await itemRepository.findAll(locals.db);
  return json(items);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const data = await request.json();
  const item = await itemRepository.create(locals.db, data);
  return json(item, { status: 201 });
};
```

### Components

```svelte
<!-- src/lib/components/ItemCard.svelte -->

<script lang="ts">
  import { Card, Button } from '@molos/ui';

  interface Props {
    item: {
      id: string;
      name: string;
      description?: string;
    };
    onEdit?: () => void;
    onDelete?: () => void;
  }

  let { item, onEdit, onDelete }: Props = $props();
</script>

<Card>
  <h3>{item.name}</h3>
  {#if item.description}
    <p>{item.description}</p>
  {/if}

  <div class="actions">
    {#if onEdit}
      <Button variant="outline" onclick={onEdit}>Edit</Button>
    {/if}
    {#if onDelete}
      <Button variant="destructive" onclick={onDelete}>Delete</Button>
    {/if}
  </div>
</Card>
```

### Repositories

```typescript
// src/lib/repositories/item-repository.ts

import { eq } from 'drizzle-orm';
import { getTableName } from '@molos/database';
import { items } from '$lib/server/db/schema';
import type { Database } from '@molos/database';

export class ItemRepository {
  private db: Database;
  private table;

  constructor(db: Database) {
    this.db = db;
    this.table = items;
  }

  async findAll() {
    return this.db.select().from(this.table);
  }

  async findById(id: string) {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);
    return results[0] ?? null;
  }

  async create(data: { name: string; description?: string }) {
    const result = await this.db
      .insert(this.table)
      .values({
        id: crypto.randomUUID(),
        ...data,
        createdAt: Date.now()
      })
      .returning();
    return result[0];
  }

  async update(id: string, data: Partial<{ name: string; description: string }>) {
    const result = await this.db
      .update(this.table)
      .set(data)
      .where(eq(this.table.id, id))
      .returning();
    return result[0];
  }

  async delete(id: string) {
    await this.db.delete(this.table).where(eq(this.table.id, id));
  }
}

export const itemRepository = new ItemRepository();
```

## Database Schema Integration

### Schema Definition

```typescript
// src/lib/server/db/schema/tables.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { getTableName } from '@molos/database';

const MODULE_ID = 'my-module';

// Use the namespaced table name
export const items = sqliteTable(
  getTableName(MODULE_ID, 'items'),
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status', { enum: ['active', 'inactive', 'archived'] })
      .notNull()
      .default('active'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
  }
);

export const itemTags = sqliteTable(
  getTableName(MODULE_ID, 'item_tags'),
  {
    id: text('id').primaryKey(),
    itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
  }
);
```

### Schema Index

```typescript
// src/lib/server/db/schema/index.ts

export * from './tables';

// Export a schema object for the module
import { items, itemTags } from './tables';

export const schema = {
  items,
  itemTags
};
```

### Migrations

```typescript
// drizzle/0001_initial_schema.ts

import { getTableName } from '@molos/database';

const MODULE_ID = 'my-module';

export async function up(db: Database) {
  await db.execute(sql`
    CREATE TABLE ${sql.identifier(getTableName(MODULE_ID, 'items'))} (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER
    )
  `);

  await db.execute(sql`
    CREATE INDEX idx_items_status ON ${sql.identifier(getTableName(MODULE_ID, 'items'))}(status)
  `);
}

export async function down(db: Database) {
  await db.execute(sql`
    DROP TABLE IF EXISTS ${sql.identifier(getTableName(MODULE_ID, 'items'))}
  `);
}
```

## Testing Modules Locally

### Unit Tests

```typescript
// src/lib/repositories/item-repository.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { ItemRepository } from './item-repository';
import { createTestDatabase } from '@molos/database/testing';

describe('ItemRepository', () => {
  let db: Database;
  let repo: ItemRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    repo = new ItemRepository(db);
  });

  it('should create an item', async () => {
    const item = await repo.create({
      name: 'Test Item',
      description: 'A test item'
    });

    expect(item.id).toBeDefined();
    expect(item.name).toBe('Test Item');
  });

  it('should find item by id', async () => {
    const created = await repo.create({ name: 'Test' });
    const found = await repo.findById(created.id);

    expect(found).toEqual(created);
  });
});
```

### Integration Tests

```typescript
// src/routes/api/items/+server.test.ts

import { describe, it, expect } from 'vitest';
import { GET, POST } from './+server';
import { setupTestApp } from '@molos/core/testing';

describe('Items API', () => {
  it('should list items', async () => {
    const { request, locals } = await setupTestApp();

    const response = await GET({ url: new URL('/api/items'), locals });
    const data = await response.json();

    expect(Array.isArray(data)).toBe(true);
  });

  it('should create an item', async () => {
    const { request, locals } = await setupTestApp();

    const response = await POST({
      request: new Request('/api/items', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' })
      }),
      locals
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.name).toBe('Test');
  });
});
```

### Running Tests

```bash
# Run tests for a specific module
npm run test --filter=@molos/module-my-module

# Run tests with coverage
npm run test --filter=@molos/module-my-module -- --coverage

# Run tests in watch mode
npm run test --filter=@molos/module-my-module -- --watch
```

### Manual Testing

```bash
# Start the development server
npm run dev

# Navigate to your module
open http://localhost:5173/ui/my-module

# Test API endpoints
curl http://localhost:5173/api/my-module/items
```

## Module Entry Point (Optional)

For modules that need lifecycle management:

```typescript
// src/module.ts

import type { ModuleDefinition, ModuleContext } from '@molos/core/modules';

export const module: ModuleDefinition = {
  // Called when module is installed
  async onInstall(context: ModuleContext) {
    console.log(`Installing ${context.id}...`);
    // Run database migrations
    await context.migrations.run();
  },

  // Called when module is enabled
  async onEnable(context: ModuleContext) {
    console.log(`Enabling ${context.id}...`);
    // Subscribe to events
    context.events.subscribe('user.logged_in', async (event) => {
      console.log('User logged in:', event.data);
    });
  },

  // Called when module is disabled
  async onDisable(context: ModuleContext) {
    console.log(`Disabling ${context.id}...`);
    // Cleanup subscriptions
    context.events.unsubscribeAll();
  },

  // Called when module is uninstalled
  async onUninstall(context: ModuleContext) {
    console.log(`Uninstalling ${context.id}...`);
    // Drop module tables
    await context.data.dropAllTables();
  },

  // Define AI tools
  async getAiTools(userId: string) {
    return [
      {
        name: 'item_create',
        description: 'Create a new item',
        parameters: { /* ... */ },
        execute: async (params) => { /* ... */ }
      }
    ];
  }
};
```

## Best Practices

### 1. Keep Modules Isolated

```typescript
// ❌ Bad: Importing from another module
import { something } from '@molos/module-product-owner';

// ✅ Good: Use events for communication
context.events.publish('item.created', { itemId });
```

### 2. Use Namespaced Tables

```typescript
// ❌ Bad: Direct table name
export const items = sqliteTable('items', { /* ... */ });

// ✅ Good: Namespaced table
export const items = sqliteTable(
  getTableName('my-module', 'items'),
  { /* ... */ }
);
```

### 3. Export Clean APIs

```typescript
// src/index.ts

// Export public API
export { moduleConfig } from './config';
export { ItemCard, ItemList } from './lib/components';
export { itemRepository } from './lib/repositories';

// Don't export internal modules
// export { internalHelper } from './lib/utils/internal'; // ❌
```

### 4. Handle Errors Gracefully

```typescript
// src/routes/api/items/[id]/+server.ts

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const item = await itemRepository.findById(params.id);

    if (!item) {
      return json({ error: 'Item not found' }, { status: 404 });
    }

    return json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
```

### 5. Write Documentation

```typescript
/**
 * Repository for managing items.
 *
 * @example
 * ```typescript
 * const items = await itemRepository.findAll();
 * const item = await itemRepository.create({ name: 'New Item' });
 * ```
 */
export class ItemRepository {
  // ...
}
```

## Next Steps

- Learn about [Module Activation](./04-module-activation.md)
- Understand [Module Interaction](./05-module-interaction.md)
- See [Deployment](./06-deployment.md) for production

---

*Last Updated: 2025-02-15*
*Version: 1.0*
