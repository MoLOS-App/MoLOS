# MoLOS Module Development Guide

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Module Architecture](#module-architecture)
4. [Project Structure](#project-structure)
5. [Import System](#import-system)
6. [Development Workflow](#development-workflow)
7. [Database Schema](#database-schema)
8. [Repository Layer](#repository-layer)
9. [API Endpoints](#api-endpoints)
10. [UI Routes & Components](#ui-routes--components)
11. [Configuration](#configuration)
12. [Testing](#testing)
13. [Deployment](#deployment)
14. [FAQ](#faq)
15. [Best Practices](#best-practices)
16. [Troubleshooting](#troubleshooting)

---

## Overview

MoLOS uses a sophisticated **plug-and-play module system** that allows developers to create self-contained feature modules that integrate seamlessly with the core application. Each module:

- ✅ Maintains its own database schema
- ✅ Provides its own API endpoints
- ✅ Contributes UI routes and components
- ✅ Manages its own business logic and state
- ✅ Registers automatically on startup
- ✅ Can be deployed independently

### Module System Architecture

```
MoLOS (Core Application)
├── Symlinks Module into Runtime
├── Auto-discovers Module Routes
├── Registers Module in Database
├── Initializes Module Resources
└── Provides Module with Core Services
    ├── Database Access ($lib/server/db)
    ├── Auth Services ($lib/server/auth)
    ├── AI Tools ($lib/server/ai)
    └── Shared UI Components ($lib/components/ui)
```

---

## Quick Start

### Generate a New Module

```bash
npm run module:create my-feature-module --name "My Feature" --author "Your Name"
```

This creates a complete module scaffold with:
- Directory structure
- `manifest.yaml` configuration
- TypeScript models and types
- Database schema files
- Repository layer
- API endpoints
- UI routes
- Configuration file

### Validate Your Module

```bash
npm run module:validate ./external_modules/my-feature-module
```

### Test Your Module

```bash
npm run module:test ./external_modules/my-feature-module
```

### Run Development Server

```bash
npm run dev
```

The dev server will:
1. Auto-discover your module
2. Create symlinks to routes and configs
3. Initialize database schemas
4. Start the dev environment

---

## Module Architecture

### How Modules are Discovered

1. **Scanning Phase**: ModuleManager scans `external_modules/` directory
2. **Manifest Validation**: Each module's `manifest.yaml` is validated against schema
3. **Registration**: Module is registered in the database (status = "pending")
4. **Initialization**: Routes are symlinked, migrations run, configuration loaded
5. **Activation**: Module becomes available (status = "active")

### Error Handling

Modules support granular error states:

- `active` - Module is working normally
- `error_manifest` - Manifest validation failed
- `error_migration` - Database migration failed
- `error_config` - Configuration loading failed
- `disabled` - User manually disabled the module
- `deleting` - Module marked for deletion

**Important**: Failed modules are **preserved** (not deleted) so you can investigate and fix issues.

---

## Project Structure

### Recommended Directory Layout

```
my-feature-module/
├── manifest.yaml                 # Module metadata and configuration
├── config.ts                     # Runtime configuration and navigation
├── package.json                  # Dependencies
├── README.md                     # Module documentation
│
├── lib/
│   ├── models/                   # TypeScript interfaces and types
│   │   ├── index.ts
│   │   └── tasks.ts
│   │
│   ├── repositories/             # Data access layer
│   │   ├── base-repository.ts
│   │   ├── task-repository.ts
│   │   └── settings-repository.ts
│   │
│   ├── stores/                   # Svelte stores for client state
│   │   ├── tasks.store.ts
│   │   └── settings.store.ts
│   │
│   ├── components/               # Reusable Svelte components
│   │   ├── task-item.svelte
│   │   ├── task-form.svelte
│   │   └── task-list.svelte
│   │
│   ├── utils.ts                  # Utility functions
│   │
│   └── server/
│       ├── ai/                   # AI tool definitions
│       │   └── ai-tools.ts
│       │
│       └── db/
│           ├── schema/
│           │   ├── tables.ts     # Database schema definitions
│           │   └── index.ts      # Schema exports
│           │
│           └── migrations/       # (Optional) Drizzle migrations
│               └── 0000_initial.sql
│
├── routes/
│   ├── api/                      # API endpoints (server-only)
│   │   ├── +server.ts
│   │   ├── tasks/
│   │   │   └── +server.ts
│   │   └── settings/
│   │       └── +server.ts
│   │
│   └── ui/                       # UI routes (SvelteKit pages)
│       ├── +layout.svelte
│       ├── +page.svelte
│       ├── dashboard/
│       │   └── +page.svelte
│       └── settings/
│           └── +page.svelte
│
└── drizzle/                      # (Optional) Database migrations
    └── 0000_initial.sql
```

### Minimal Module Structure

At minimum, you need:

```
minimal-module/
├── manifest.yaml
├── config.ts
├── package.json
├── lib/
│   └── server/
│       └── db/
│           └── schema/
│               └── tables.ts
└── routes/
    └── api/
        └── +server.ts
```

---

## Import System

### Critical: Import Paths

MoLOS uses a sophisticated symlink-based import system. **Always follow these conventions**:

### ✅ Correct Import Patterns

#### From Repositories (lib/repositories/*.ts)

```typescript
// Import module's own schema
import { tasksTasks, tasksSettings } from '../server/db/schema/tables';

// Import core database
import { db } from '$lib/server/db';

// Import core schemas/enums
import { user } from '$lib/server/db/schema/auth-schema';

// Import module models
import type { Task, TaskStatus } from '../models';

// Relative within repositories
import { BaseRepository } from './base-repository';
```

#### From Models (lib/models/*.ts)

```typescript
// Relative within module
import type { Task } from './tasks';
import { TaskStatus, TaskPriority } from './tasks';

// Core utilities
import { z } from 'zod';
```

#### From API Routes (routes/api/*.ts)

```typescript
// Import repositories using $lib alias
import { TaskRepository } from '$lib/modules/MoLOS-Tasks/repositories';

// Import models
import type { Task } from '$lib/modules/MoLOS-Tasks/models';

// Import core services
import { json, error } from '@sveltejs/kit';
```

#### From UI Routes (routes/ui/*.ts)

```typescript
// Import module components
import TaskList from '$lib/modules/MoLOS-Tasks/components/task-list.svelte';

// Import stores
import { tasksStore } from '$lib/modules/MoLOS-Tasks/stores';

// Import core UI components
import { Button } from '$lib/components/ui/button';
```

#### From Components (lib/components/*.svelte)

```typescript
// Relative imports within components
<script lang="ts">
  import TaskItem from './task-item.svelte';
  import { tasksStore } from '../stores/tasks.store';
  import type { Task } from '../models';
</script>
```

### ❌ WRONG Import Patterns

```typescript
// ❌ DON'T use hardcoded paths
import { db } from '../../../../../src/lib/server/db'; // Use $lib/server/db instead

// ❌ DON'T use relative paths like this in repositories
import { tasksTasks } from '$lib/server/db/schema';  // Wrong for module tables!

// ❌ DON'T use circular module references
import { moduleConfig } from '$lib/modules/other-module/config';

// ❌ DON'T import from node_modules without package.json entry
import something from 'some-package';  // Must be in package.json

// ❌ DON'T use wildcard exports in repositories
import * from './repositories';
```

### Understanding the Symlink System

The core app creates symlinks for each module:

```
Symlink Creation:
src/lib/modules/MoLOS-Tasks → external_modules/MoLOS-Tasks/lib
src/lib/config/modules/MoLOS-Tasks → external_modules/MoLOS-Tasks
src/routes/api/(external_modules)/MoLOS-Tasks → external_modules/MoLOS-Tasks/routes/api
src/routes/ui/(modules)/(external_modules)/MoLOS-Tasks → external_modules/MoLOS-Tasks/routes/ui
```

This means:
- `$lib/modules/MoLOS-Tasks` resolves to your module's `lib/` directory
- `$lib/modules/MoLOS-Tasks/models` = `lib/models/`
- `$lib/modules/MoLOS-Tasks/repositories` = `lib/repositories/`
- `$lib/modules/MoLOS-Tasks/server/db/schema` = `lib/server/db/schema/`

---

## Development Workflow

### Phase 1: Setup & Planning

```
1. Create module scaffold
   npm run module:create my-module

2. Edit manifest.yaml with your module details
   
3. Plan your data model
   - What entities do you need?
   - What are their relationships?
   - What operations will you perform?

4. Design API endpoints
   - What data should the API expose?
   - What operations should be available?
   - Authentication/authorization?
```

### Phase 2: Database Schema

```
1. Define tables in lib/server/db/schema/tables.ts
   - Use snake_case for table names (prefix with module name)
   - Use consistent column naming
   - Add proper relationships and constraints

2. Export tables from lib/server/db/schema/index.ts

3. Run validation
   npm run module:validate ./external_modules/my-module
```

### Phase 3: Models & Types

```
1. Create TypeScript models in lib/models/
   - Enums for statuses/types
   - Interfaces for entities
   - Zod schemas for validation

2. Export models from lib/models/index.ts
```

### Phase 4: Repository Layer

```
1. Create base repository extending BaseRepository
   
2. Create specific repositories for each entity
   - Query methods
   - Create/Update/Delete operations
   - Complex queries

3. Inject database in constructor
```

### Phase 5: API Endpoints

```
1. Create routes/api/+server.ts for main endpoints
   
2. Create nested routes for specific operations
   - routes/api/tasks/+server.ts
   - routes/api/tasks/[id]/+server.ts
   - routes/api/settings/+server.ts

3. Handle request validation and errors
   
4. Return proper HTTP status codes
```

### Phase 6: UI Routes & Components

```
1. Create routes/ui/+layout.svelte for module layout
   
2. Create routes/ui/+page.svelte for main view
   
3. Create nested routes for sub-pages
   
4. Build reusable components in lib/components/
   
5. Manage client state with stores in lib/stores/
```

### Phase 7: Configuration

```
1. Update config.ts with:
   - Module navigation items
   - Route structure
   - Exported features

2. Test module discovery
   npm run dev
```

### Phase 8: Testing

```
1. Write unit tests for repositories
   
2. Test API endpoints
   
3. Test UI components
   
4. End-to-end testing
```

---

## Database Schema

### Naming Conventions

```typescript
// Table names: module_entity (snake_case)
export const tasksTasks = sqliteTable('tasks_tasks', { ... });
export const tasksProjects = sqliteTable('tasks_projects', { ... });
export const tasksSettings = sqliteTable('tasks_settings', { ... });

// Column names: snake_case
id: text('id').primaryKey(),
user_id: text('user_id').notNull(),
created_at: integer('created_at'),  // Unix timestamp
updated_at: integer('updated_at'),
is_active: boolean('is_active'),
```

### Schema Pattern

```typescript
import { integer, sqliteTable, text, boolean } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from '$lib/server/db/schema/auth-schema';

// Reference core user table
export const moduleUsers = sqliteTable('module_users', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at')
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer('updated_at')
    .$onUpdate(() => sql`(unixepoch())`),
});
```

### Relationships

```typescript
// One-to-Many: User has many tasks
export const moduleTasks = sqliteTable('module_tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  projectId: text('project_id')
    .references(() => moduleProjects.id),
});

// Many-to-Many (junction table)
export const taskTags = sqliteTable('task_tags', {
  taskId: text('task_id')
    .notNull()
    .references(() => moduleTasks.id),
  tagId: text('tag_id')
    .notNull()
    .references(() => moduleTags.id),
});
```

---

## Repository Layer

### BaseRepository Pattern

```typescript
import { db as defaultDb } from '$lib/server/db';
import type { Database } from '$lib/server/db';

export abstract class BaseRepository {
  protected db: Database;

  constructor(db?: Database) {
    this.db = db || defaultDb;
  }
}
```

### Implementation Example

```typescript
import { eq, and, count } from 'drizzle-orm';
import { tasksTasks, tasksProjects } from '../server/db/schema/tables';
import { BaseRepository } from './base-repository';
import type { Task, CreateTaskInput, UpdateTaskInput } from '../models';

export class TaskRepository extends BaseRepository {
  async getTasksByUserId(userId: string): Promise<Task[]> {
    const rows = await this.db
      .select()
      .from(tasksTasks)
      .where(eq(tasksTasks.userId, userId));
    
    return rows.map(row => this.mapToTask(row));
  }

  async getTaskById(id: string, userId: string): Promise<Task | null> {
    const [row] = await this.db
      .select()
      .from(tasksTasks)
      .where(
        and(
          eq(tasksTasks.id, id),
          eq(tasksTasks.userId, userId)
        )
      );
    
    return row ? this.mapToTask(row) : null;
  }

  async createTask(input: CreateTaskInput, userId: string): Promise<Task> {
    const [row] = await this.db
      .insert(tasksTasks)
      .values({
        id: generateId(),
        userId,
        ...input,
      })
      .returning();
    
    return this.mapToTask(row);
  }

  async updateTask(
    id: string,
    userId: string,
    input: UpdateTaskInput
  ): Promise<Task | null> {
    const [row] = await this.db
      .update(tasksTasks)
      .set(input)
      .where(
        and(
          eq(tasksTasks.id, id),
          eq(tasksTasks.userId, userId)
        )
      )
      .returning();
    
    return row ? this.mapToTask(row) : null;
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(tasksTasks)
      .where(
        and(
          eq(tasksTasks.id, id),
          eq(tasksTasks.userId, userId)
        )
      );
    
    return result.changes > 0;
  }

  private mapToTask(row: Record<string, unknown>): Task {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      title: row.title as string,
      // ... map other fields
    };
  }
}
```

### Best Practices

- ✅ Always validate user_id (check ownership)
- ✅ Use typed return values
- ✅ Implement error handling
- ✅ Use database transactions for atomic operations
- ✅ Add methods for common queries
- ❌ Don't expose raw database rows
- ❌ Don't perform heavy computations in repositories

---

## API Endpoints

### Route Structure

```
routes/api/
├── +server.ts              # GET /api/module-name
├── tasks/
│   ├── +server.ts          # GET/POST /api/module-name/tasks
│   └── [id]/
│       └── +server.ts      # GET/PUT/DELETE /api/module-name/tasks/[id]
├── projects/
│   ├── +server.ts          # GET/POST /api/module-name/projects
│   └── [id]/
│       └── +server.ts      # GET/PUT/DELETE /api/module-name/projects/[id]
```

### Example Implementation

```typescript
// routes/api/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TaskRepository } from '$lib/modules/MoLOS-Tasks/repositories';

export const GET: RequestHandler = async ({ locals }) => {
  // Check authentication
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const taskRepo = new TaskRepository();
    const tasks = await taskRepo.getTasksByUserId(locals.user.id);
    
    return json({ data: tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
};
```

### Validation Pattern

```typescript
import { z } from 'zod';

const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  projectId: z.string().optional(),
});

export const POST: RequestHandler = async ({ request, locals }) => {
  const data = await request.json();
  
  // Validate input
  const result = CreateTaskSchema.safeParse(data);
  if (!result.success) {
    return json(
      { error: 'Validation failed', details: result.error.errors },
      { status: 400 }
    );
  }

  // Process validated data
  const taskRepo = new TaskRepository();
  const task = await taskRepo.createTask(result.data, locals.user.id);
  
  return json({ data: task }, { status: 201 });
};
```

---

## UI Routes & Components

### Route Layout Pattern

```typescript
// routes/ui/+layout.svelte
<script lang="ts">
  import { page } from '$app/stores';
</script>

<div class="module-container">
  <header>
    <h1>My Module</h1>
    <nav>
      <a href="/ui/my-module">Dashboard</a>
      <a href="/ui/my-module/settings">Settings</a>
    </nav>
  </header>
  
  <main>
    <slot />
  </main>
</div>

<style>
  .module-container {
    /* Your styles */
  }
</style>
```

### Component Example

```svelte
<!-- lib/components/task-item.svelte -->
<script lang="ts">
  import type { Task } from '../models';
  import { Button } from '$lib/components/ui/button';

  export let task: Task;
  export let onDelete: (id: string) => void;
  export let onComplete: (id: string) => void;
</script>

<div class="task-item">
  <h3>{task.title}</h3>
  <p>{task.description}</p>
  
  <div class="actions">
    <Button 
      variant="outline"
      on:click={() => onComplete(task.id)}
    >
      Complete
    </Button>
    <Button 
      variant="destructive"
      on:click={() => onDelete(task.id)}
    >
      Delete
    </Button>
  </div>
</div>

<style>
  .task-item {
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
</style>
```

### Store Pattern

```typescript
// lib/stores/tasks.store.ts
import { writable, derived } from 'svelte/store';
import type { Task } from '../models';

export const tasksStore = writable<Task[]>([]);

export const completedTasksCount = derived(
  tasksStore,
  $tasks => $tasks.filter(t => t.status === 'completed').length
);

export const pendingTasks = derived(
  tasksStore,
  $tasks => $tasks.filter(t => t.status === 'pending')
);
```

---

## Configuration

### manifest.yaml

```yaml
id: my-feature-module
name: My Feature Module
version: 1.0.0
description: A comprehensive feature module for MoLOS
author: Your Name
icon: 📋

# Minimum MoLOS version required
minMolosVersion: "1.0.0"

# Module dependencies (optional)
dependencies:
  - core-module

# Configuration options
config:
  enableNotifications: true
  maxItemsPerPage: 50
```

### config.ts

```typescript
import type { ModuleConfig } from '$lib/config/module-types';

export const moduleConfig: ModuleConfig = {
  id: 'my-feature-module',
  name: 'My Feature Module',
  
  navigation: [
    {
      href: '/ui/my-module',
      label: 'Dashboard',
      icon: '📋',
    },
    {
      href: '/ui/my-module/settings',
      label: 'Settings',
      icon: '⚙️',
    },
  ],
  
  // API routes exposed by this module
  apiRoutes: [
    '/api/my-module/tasks',
    '/api/my-module/projects',
  ],
  
  // UI routes exposed by this module
  uiRoutes: [
    '/ui/my-module',
    '/ui/my-module/settings',
  ],
};

export default moduleConfig;
```

---

## Testing

### Unit Tests for Repositories

```typescript
// lib/repositories/task-repository.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskRepository } from './task-repository';

describe('TaskRepository', () => {
  let taskRepo: TaskRepository;

  beforeEach(() => {
    taskRepo = new TaskRepository();
  });

  it('should create a task', async () => {
    const task = await taskRepo.createTask(
      {
        title: 'Test Task',
        description: 'Test Description',
      },
      'user-123'
    );

    expect(task.id).toBeDefined();
    expect(task.title).toBe('Test Task');
    expect(task.userId).toBe('user-123');
  });

  it('should retrieve task by id', async () => {
    const created = await taskRepo.createTask(
      { title: 'Test Task' },
      'user-123'
    );

    const retrieved = await taskRepo.getTaskById(created.id, 'user-123');
    expect(retrieved).toEqual(created);
  });

  it('should not allow users to access other users tasks', async () => {
    const created = await taskRepo.createTask(
      { title: 'Secret Task' },
      'user-123'
    );

    const result = await taskRepo.getTaskById(created.id, 'other-user');
    expect(result).toBeNull();
  });
});
```

### API Endpoint Tests

```typescript
// routes/api/tasks/+server.test.ts
import { describe, it, expect } from 'vitest';
import { GET, POST } from './+server';

describe('GET /api/my-module/tasks', () => {
  it('should return 401 without authentication', async () => {
    const response = await GET({
      locals: { user: null },
    } as any);

    expect(response.status).toBe(401);
  });

  it('should return user tasks', async () => {
    const response = await GET({
      locals: { user: { id: 'user-123' } },
    } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.data)).toBe(true);
  });
});
```

---

## Deployment

### Pre-Deployment Checklist

- ✅ Module validates without errors
- ✅ All tests pass
- ✅ Database schema is correct
- ✅ Error handling is comprehensive
- ✅ Security: All endpoints check user authentication
- ✅ All imports use correct paths
- ✅ No hardcoded URLs or configuration
- ✅ README.md is complete
- ✅ manifest.yaml is accurate

### Build Process

```bash
# Validate module
npm run module:validate ./external_modules/my-module

# Run tests
npm run module:test ./external_modules/my-module

# Build
npm run build

# If build succeeds, module is ready to deploy
```

### Production Considerations

1. **Database Backups**: Ensure module uses proper migrations
2. **Performance**: Index frequently queried columns
3. **Error Logging**: Implement comprehensive error tracking
4. **Rate Limiting**: Protect API endpoints from abuse
5. **Security**: Validate all user input
6. **Monitoring**: Add health checks and metrics

---

## FAQ

### Q: Can I use external npm packages?

**A**: Yes, add them to your `package.json`. However:
- Keep dependencies minimal
- Avoid conflicting versions with core app
- Large packages should be bundled separately
- All packages must be OSS-compatible

### Q: Can I access core app databases?

**A**: Yes, through `$lib/server/db`. You can:
- Read from core tables (user, etc.)
- Write to core tables only if designed for modules
- Reference core tables in relationships
- Share schemas with other modules if needed

### Q: How do I add migrations for my module?

**A**: Place `.sql` files in `drizzle/` or handle via Drizzle schema files:
- Migrations run automatically on module init
- Must follow naming convention: `0000_name.sql`
- Test migrations thoroughly before deployment

### Q: Can modules depend on other modules?

**A**: Define in `manifest.yaml`:
```yaml
dependencies:
  - other-module-id
```
The core will enforce load order, but circular dependencies will fail.

### Q: How do I handle authentication?

**A**: MoLOS provides authentication via `locals.user`:
```typescript
if (!locals.user) {
  return json({ error: 'Unauthorized' }, { status: 401 });
}

// Access user data
const userId = locals.user.id;
```

### Q: Can I add navigation items to the main menu?

**A**: Yes, through `config.ts`:
```typescript
navigation: [
  {
    href: '/ui/my-module',
    label: 'My Module',
    icon: '📋',
  },
],
```

### Q: What if my module initialization fails?

**A**: The module will be marked with an error state but NOT deleted:
- `error_manifest` - Validation failed
- `error_migration` - Migration failed
- `error_config` - Config loading failed

The module folder is preserved so you can fix and retry.

### Q: Can I have submodules within my module?

**A**: Yes, organize complex functionality within your module structure:
```
lib/
  ├── features/
  │   ├── tasks/
  │   │   ├── models/
  │   │   ├── repositories/
  │   │   └── components/
  │   └── projects/
```

### Q: How do I debug my module?

**A**: Use several techniques:
```typescript
// Console logging
console.log('Debug info:', data);

// Browser DevTools
export let debugData = data;  // Expose to window

// Server logs
import { error } from '@sveltejs/kit';
error(500, 'Detailed error message');

// Database inspection
npm run db:inspect  // If available
```

### Q: Can I customize the module discovery?

**A**: No, the core handles this automatically. However:
- Module location: `external_modules/` (required)
- Manifest file: `manifest.yaml` (required)
- Config file: `config.ts` (required)

### Q: What's the performance impact of modules?

**A**: Minimal when properly implemented:
- Symlinks are fast
- Database access is optimized
- Routes are lazy-loaded
- Unused modules don't impact performance

---

## Best Practices

### 1. Follow TypeScript Strictly

```typescript
// ✅ Good
export interface Task {
  id: string;
  userId: string;
  title: string;
  status: 'pending' | 'completed';
}

// ❌ Bad
export interface Task {
  [key: string]: any;
}
```

### 2. Always Validate Input

```typescript
// ✅ Good
const schema = z.object({
  title: z.string().min(1),
  dueDate: z.number().optional(),
});

const result = schema.safeParse(input);
if (!result.success) {
  // Handle validation error
}

// ❌ Bad
const task = input as Task;  // Dangerous!
```

### 3. Implement Proper Error Handling

```typescript
// ✅ Good
try {
  const task = await taskRepo.getTaskById(id, userId);
  if (!task) {
    return json({ error: 'Task not found' }, { status: 404 });
  }
  return json({ data: task });
} catch (error) {
  console.error('Error fetching task:', error);
  return json({ error: 'Internal server error' }, { status: 500 });
}

// ❌ Bad
const task = await taskRepo.getTaskById(id, userId);
return json({ data: task });  // No error handling!
```

### 4. Ensure Data Ownership

```typescript
// ✅ Good
const task = await taskRepo.getTaskById(id, userId);
if (!task || task.userId !== userId) {
  return json({ error: 'Unauthorized' }, { status: 403 });
}

// ❌ Bad
const task = await taskRepo.getTaskById(id);
// No ownership check!
```

### 5. Use Consistent Naming

```
// ✅ Good
- Tables: tasks_tasks, tasks_projects
- Columns: user_id, created_at, is_active
- Routes: /api/my-module/tasks, /ui/my-module/dashboard
- Components: TaskItem.svelte, TaskList.svelte
- Stores: tasksStore, settingsStore

// ❌ Bad
- Mixed naming conventions
- Abbreviations (tsk, prj)
- Inconsistent prefixes
```

### 6. Keep Components Reusable

```svelte
<!-- ✅ Good - Reusable component -->
<script lang="ts">
  export let tasks: Task[];
  export let onSelect: (id: string) => void;
</script>

<!-- ❌ Bad - Tightly coupled component -->
<script lang="ts">
  let tasks = [];
  onMount(async () => {
    const response = await fetch('/api/tasks');
    tasks = await response.json();
  });
</script>
```

### 7. Document Complex Logic

```typescript
// ✅ Good
/**
 * Calculates task priority based on due date and complexity
 * @param dueDate - Unix timestamp for task due date
 * @param complexity - 1-5 scale
 * @returns Priority score (higher = more urgent)
 */
function calculatePriority(dueDate: number, complexity: number): number {
  const daysUntilDue = (dueDate - Date.now()) / (1000 * 60 * 60 * 24);
  return Math.max(1, 10 - daysUntilDue) * (complexity / 5);
}

// ❌ Bad
function calcPri(d, c) {
  return Math.max(1, 10 - (d - Date.now()) / 86400000) * (c / 5);
}
```

### 8. Use Transactions for Multi-step Operations

```typescript
// ✅ Good
async function moveTask(taskId: string, newProjectId: string) {
  return await db.transaction(async (tx) => {
    // Update task
    await tx.update(tasks).set({ projectId: newProjectId });
    
    // Update project statistics
    await tx.update(projects).set({ taskCount: sql`task_count + 1` });
    
    // Log action
    await tx.insert(activityLog).values({ ... });
  });
}
```

### 9. Optimize Database Queries

```typescript
// ✅ Good - Single query with join
const tasks = await db
  .select({
    task: tasksTasks,
    project: tasksProjects,
  })
  .from(tasksTasks)
  .leftJoin(tasksProjects, eq(tasksTasks.projectId, tasksProjects.id))
  .where(eq(tasksTasks.userId, userId));

// ❌ Bad - N+1 queries
const tasks = await db.select().from(tasksTasks);
for (const task of tasks) {
  task.project = await db.select().from(tasksProjects)
    .where(eq(tasksProjects.id, task.projectId));
}
```

### 10. Test Edge Cases

```typescript
// ✅ Good test coverage
it('should handle empty user ID', async () => { ... });
it('should handle duplicate task IDs', async () => { ... });
it('should validate null values', async () => { ... });
it('should handle concurrent operations', async () => { ... });
it('should clean up on errors', async () => { ... });
```

---

## Troubleshooting

### Issue: Module not discovered on startup

**Symptoms**: Module folder exists but doesn't appear in database

**Solutions**:
1. Check `manifest.yaml` is valid and in root directory
2. Run `npm run module:validate ./external_modules/my-module`
3. Check database migrations ran: `npm run db:migrate`
4. Look for "error_manifest" status in database
5. Check `npm run dev` logs for validation errors

### Issue: Imports not resolving

**Symptoms**: "Cannot find module" errors

**Solutions**:
1. Verify symlinks created: `ls -la src/lib/modules/`
2. Check import paths match your structure exactly
3. Ensure files use `.ts` extension, not `.js`
4. Restart dev server: `npm run dev`
5. Clear `.svelte-kit` cache and rebuild

### Issue: Database migration fails

**Symptoms**: "error_migration" status

**Solutions**:
1. Check migration files in `drizzle/`
2. Ensure table names follow convention (module_entity)
3. Run migrations manually: `npm run db:migrate`
4. Check for SQL syntax errors
5. Verify foreign key constraints are valid

### Issue: API endpoint returns 404

**Symptoms**: Routes not accessible at `/api/my-module/...`

**Solutions**:
1. Verify symlink created: `ls -la src/routes/api/\(external_modules\)/`
2. Check route file exists: `routes/api/+server.ts`
3. Ensure correct SvelteKit route syntax
4. Restart dev server
5. Check for name conflicts with core routes

### Issue: Component styling not applied

**Symptoms**: UI loads but styling missing

**Solutions**:
1. Ensure Tailwind classes are in allowed content paths
2. Check `tailwind.config.js` includes module paths
3. Use `<style>` blocks for scoped CSS
4. Import shared UI component styles from `$lib/components/ui`

### Issue: Authentication not working

**Symptoms**: All endpoints return 401

**Solutions**:
1. Check `locals.user` is being set by auth middleware
2. Verify auth server file exists and initializes
3. Check session/JWT token is valid
4. Ensure hooks.server.ts sets user in locals
5. Test with known valid user ID

### Issue: Memory leaks in stores

**Symptoms**: App slows down over time

**Solutions**:
```typescript
// ✅ Cleanup subscriptions
onDestroy(() => {
  tasksStore.unsubscribe?.();
});

// ✅ Use readable/derived stores for computed values
export const completedCount = derived(tasksStore, $tasks => 
  $tasks.filter(t => t.status === 'completed').length
);
```

---

## Resources

- [MoLOS Architecture Guide](./README.md)
- [Database Schema Reference](./SCHEMA_REFERENCE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [SvelteKit Documentation](https://kit.svelte.dev)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## Support

For issues or questions:
1. Check this guide's FAQ section
2. Review module examples in `docs/guides/developing-new-modules/`
3. Check existing modules in `external_modules/`
4. Refer to MoLOS community documentation
5. Open an issue on GitHub

---

**Last Updated**: January 2026  
**MoLOS Version**: 1.0.0+  
**Module System Version**: 2.0 (with error state management)
