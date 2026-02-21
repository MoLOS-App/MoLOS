# MoLOS AI Context Reference

> **Purpose**: Single comprehensive reference for AI assistants working on the MoLOS codebase.

---

## Project Overview

**MoLOS** (Modular Life Organization System) is a privacy-focused, deeply modular productivity suite built with SvelteKit. It uses a package-based module system where modules can be installed from npm, GitHub, or developed locally within the monorepo.

**Core Principles:**

- Privacy-first design (self-hostable)
- Modular architecture (install only what you need)
- Type-safe throughout (TypeScript + Drizzle ORM)
- Fast development experience (Bun + Turborepo)

---

## Tech Stack

| Component       | Technology    | Notes                            |
| --------------- | ------------- | -------------------------------- |
| Frontend/API    | SvelteKit 2.x | Svelte 5 with runes              |
| Database        | SQLite        | Via better-sqlite3               |
| ORM             | Drizzle       | Type-safe queries                |
| Styling         | Tailwind CSS  | With shadcn-svelte components    |
| Build           | Turborepo     | Monorepo task orchestration      |
| Package Manager | Bun           | Fast installs, workspace support |
| Auth            | better-auth   | Session-based authentication     |

---

## Directory Structure

```
MoLOS/
├── apps/
│   └── web/                    # Main SvelteKit application (future)
├── packages/
│   ├── core/                   # @molos/core - utilities and types
│   ├── database/               # @molos/database - schema and migrations
│   └── ui/                     # @molos/ui - shared components
├── modules/
│   ├── ai/                     # @molos/module-ai (internal)
│   └── tasks/                  # @molos/module-tasks
├── external_modules/           # External modules (migrated)
│   ├── MoLOS-Goals/
│   ├── MoLOS-Health/
│   ├── MoLOS-Finance/
│   ├── MoLOS-Meals/
│   ├── MoLOS-Google/
│   ├── MoLOS-AI-Knowledge/
│   └── MoLOS-Sample-Module/
├── src/                        # Main SvelteKit app
│   ├── lib/
│   │   ├── components/         # UI components
│   │   ├── server/             # Server-side code
│   │   ├── stores/             # Svelte stores
│   │   ├── models/             # TypeScript types
│   │   ├── repositories/       # Data access layer
│   │   └── config/             # App configuration
│   └── routes/                 # SvelteKit routes
├── scripts/                    # Build and utility scripts
├── drizzle/                    # Core database migrations
└── documentation/              # This documentation
```

---

## Module System Quick Reference

### Module Types

| Type     | ID Format      | Example           | Location                         |
| -------- | -------------- | ----------------- | -------------------------------- |
| Internal | lowercase      | `dashboard`, `ai` | `src/lib/config/`, `modules/ai/` |
| External | `MoLOS-{Name}` | `MoLOS-Tasks`     | `modules/`, `external_modules/`  |

### Module Structure (External)

```
modules/MoLOS-{Name}/
├── package.json              # @molos/module-{name}
├── manifest.yaml             # Module manifest
├── drizzle.config.ts         # Database config (if has DB)
├── drizzle/                  # Migrations (if has DB)
└── src/
    ├── config.ts             # ModuleConfig (REQUIRED)
    ├── index.ts              # Package exports
    ├── models/               # TypeScript types
    ├── server/
    │   ├── database/schema.ts
    │   └── repositories/
    ├── routes/
    │   ├── ui/               # SvelteKit UI routes
    │   └── api/              # API endpoints
    ├── components/           # Svelte components
    └── stores/               # Svelte stores
```

### Module Config Pattern

```typescript
// src/config.ts
import { SquareCheck } from 'lucide-svelte';
import type { ModuleConfig } from '$lib/config/types';

export const myModuleConfig: ModuleConfig = {
	id: 'MoLOS-Tasks', // REQUIRED: Must match module ID convention
	name: 'Tasks', // REQUIRED: Display name
	href: '/ui/MoLOS-Tasks', // REQUIRED: Base route
	icon: SquareCheck, // REQUIRED: Lucide icon
	description: 'Task management', // REQUIRED: Short description
	navigation: [
		// OPTIONAL: Sidebar navigation
		{ name: 'Dashboard', icon: ListTodo, href: '/ui/MoLOS-Tasks/dashboard' }
	]
};

export default myModuleConfig;
```

---

## Database Naming Convention

**CRITICAL**: All external module tables MUST follow this naming:

```
MoLOS-{ModuleName}_{table_name}
```

| Pattern                     | Example                     | Status                 |
| --------------------------- | --------------------------- | ---------------------- |
| `MoLOS-{Name}_{table}`      | `MoLOS-Tasks_tasks`         | Correct                |
| `MoLOS-{Name}_{table}`      | `MoLOS-Health_user_profile` | Correct                |
| `{module}_{table}`          | `health_user_profile`       | Wrong - missing prefix |
| `{module}_{module}_{table}` | `meals_meals_settings`      | Wrong - duplicated     |
| `{table}`                   | `tasks`                     | Wrong - no prefix      |

### Core Tables (No Prefix)

- `user` - User accounts
- `session` - Authentication sessions
- `settings` - Application settings
- `settings_external_modules` - Module activation state

---

## Import Patterns

### Within a Module (Use $lib alias)

```typescript
// From main app
import { db } from '$lib/server/db';
import { Button } from '$lib/components/ui/button';
```

### Cross-Module Imports

```typescript
// Pattern 1: $lib/modules/{ModuleName}
import { goalsStore } from '$lib/modules/MoLOS-Goals/stores';

// Pattern 2: $lib/{type}/external_modules/{ModuleName}
import { Goal } from '$lib/models/external_modules/MoLOS-Goals';
import { GoalRepository } from '$lib/repositories/external_modules/MoLOS-Goals';
```

### Route Imports (Use .js extension)

```typescript
// Always use .js for TypeScript imports in routes
import { TaskRepository } from '../../../server/repositories/task-repository.js';
```

---

## Common Commands

| Command               | Description                               |
| --------------------- | ----------------------------------------- |
| `bun run dev`         | Start dev server (auto-discovers modules) |
| `bun run build`       | Build for production                      |
| `bun run module:sync` | Sync and initialize modules               |
| `bun run module:link` | Create route symlinks                     |
| `bun run db:push`     | Push schema changes (dev)                 |
| `bun run db:migrate`  | Run migrations                            |
| `bun run db:generate` | Generate migrations                       |
| `bun run db:studio`   | Open Drizzle Studio                       |

---

## Key File Locations

| What                 | Where                                    |
| -------------------- | ---------------------------------------- |
| App entry point      | `src/app.html`                           |
| Module registry      | `src/lib/config/index.ts`                |
| Module types         | `src/lib/config/types.ts`                |
| Database client      | `src/lib/server/db/index.ts`             |
| Core schema          | `packages/database/src/schema/core/`     |
| Module schemas       | `packages/database/src/schema/external/` |
| Shared components    | `packages/ui/src/lib/components/`        |
| Module linker script | `scripts/link-modules.ts`                |

---

## Symlink Structure

Modules are linked to these locations:

| Target                                            | Points To                       |
| ------------------------------------------------- | ------------------------------- |
| `src/routes/ui/(modules)/(external_modules)/{id}` | `{module}/src/routes/ui`        |
| `src/routes/api/(external_modules)/{id}`          | `{module}/src/routes/api`       |
| `src/lib/modules/{id}`                            | `{module}/src/lib`              |
| `src/lib/models/external_modules/{id}`            | `{module}/src/lib/models`       |
| `src/lib/repositories/external_modules/{id}`      | `{module}/src/lib/repositories` |
| `src/lib/stores/external_modules/{id}`            | `{module}/src/lib/stores`       |
| `src/lib/components/external_modules/{id}`        | `{module}/src/lib/components`   |

---

## Environment Variables

```bash
# .env

# Empty = load all modules
VITE_MOLOS_AUTOLOAD_MODULES=

# Or filter specific modules (dashboard and ai always load)
VITE_MOLOS_AUTOLOAD_MODULES=MoLOS-Tasks,MoLOS-Finance

# Database path (default: ./molos.db)
DATABASE_URL=./molos.db
```

---

## Error Troubleshooting

### Module not in sidebar

1. Check `src/config.ts` exists with correct `id`, `name`, `href`
2. Run `bun run module:sync`
3. Check `VITE_MOLOS_AUTOLOAD_MODULES` env var

### 404 on routes

1. Check symlink exists: `ls -la src/routes/ui/(modules)/(external_modules)/`
2. Run `bun run module:sync`

### Database table not found

1. Generate migrations: `cd modules/{name} && npx drizzle-kit generate`
2. Apply migrations: `npx drizzle-kit migrate`
3. Check table prefix matches module ID

### Import errors ($lib/modules/...)

1. Run `bun run module:sync` to create symlinks
2. Check symlink: `ls -la src/lib/modules/{ModuleName}`

---

## Module Development Guide (Based on MoLOS-Tasks)

The MoLOS-Tasks module (`modules/MoLOS-Tasks/`) is the reference implementation. Use it as a template for new modules.

### Complete Module Structure

```
modules/MoLOS-Tasks/
├── package.json              # Package definition with exports
├── drizzle.config.ts         # Database migration config
├── drizzle/                  # Generated migrations
│   ├── 0000_initial.sql
│   └── meta/
└── src/
    ├── config.ts             # ModuleConfig (REQUIRED)
    ├── index.ts              # Package exports
    ├── models/
    │   ├── index.ts          # Re-exports from types
    │   └── types.ts          # TypeScript types and enums
    ├── server/
    │   ├── index.ts          # Server exports
    │   ├── database/
    │   │   ├── index.ts      # Schema exports
    │   │   └── schema.ts     # Drizzle table definitions
    │   ├── repositories/
    │   │   ├── index.ts      # Repository exports
    │   │   ├── base-repository.ts
    │   │   └── task-repository.ts
    │   └── ai/
    │       └── ai-tools.ts   # Optional AI tools
    ├── routes/
    │   ├── ui/               # SvelteKit UI routes
    │   │   ├── +layout.svelte
    │   │   ├── +layout.server.ts
    │   │   ├── +page.svelte
    │   │   ├── dashboard/
    │   │   │   ├── +page.svelte
    │   │   │   └── +page.server.ts
    │   │   └── settings/
    │   │       └── ...
    │   └── api/              # API endpoints
    │       ├── +server.ts    # Main API (GET/POST/PUT/DELETE)
    │       ├── projects/
    │       │   └── +server.ts
    │       └── settings/
    │           └── +server.ts
    ├── components/           # Svelte components
    └── stores/
        ├── index.ts
        ├── tasks.store.ts
        └── api.ts
```

### 1. Package Configuration

```json
// package.json
{
	"name": "@molos/module-tasks",
	"version": "1.0.0",
	"type": "module",
	"main": "./src/index.ts",
	"exports": {
		".": "./src/index.ts",
		"./server": "./src/server/index.ts",
		"./server/database/schema": "./src/server/database/schema.ts",
		"./config": "./src/config.ts",
		"./models": "./src/models/index.ts",
		"./stores": "./src/stores/index.ts"
	},
	"scripts": {
		"db:generate": "drizzle-kit generate",
		"db:migrate": "drizzle-kit migrate"
	},
	"dependencies": {
		"zod": "^4.3.6",
		"lucide-svelte": "^0.561.0"
	},
	"peerDependencies": {
		"svelte": "^5.45.0"
	}
}
```

### 2. Module Config

```typescript
// src/config.ts
import { SquareCheck, ListTodo, Briefcase, Settings } from 'lucide-svelte';
import type { ModuleConfig } from '$lib/config/types';

export const tasksConfig: ModuleConfig = {
	id: 'MoLOS-Tasks', // MUST match naming convention
	name: 'Tasks',
	href: '/ui/MoLOS-Tasks', // MUST match id
	icon: SquareCheck,
	description: 'Task management and project tracking',
	navigation: [
		{ name: 'Dashboard', icon: ListTodo, href: '/ui/MoLOS-Tasks/dashboard' },
		{ name: 'My Tasks', icon: SquareCheck, href: '/ui/MoLOS-Tasks/my' },
		{ name: 'Projects', icon: Briefcase, href: '/ui/MoLOS-Tasks/projects' },
		{ name: 'Settings', icon: Settings, href: '/ui/MoLOS-Tasks/settings' }
	]
};

export default tasksConfig;
```

### 3. Database Schema

```typescript
// src/server/database/schema.ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { textEnum } from '@molos/database/utils';
import { TaskStatus, TaskPriority } from '../../models';

// Table naming: MoLOS-{ModuleName}_{table_name}
export const tasksTasks = sqliteTable('MoLOS-Tasks_tasks', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id'),
	title: text('title').notNull(),
	description: text('description'),
	status: textEnum('status', TaskStatus).notNull().default(TaskStatus.TO_DO),
	priority: textEnum('priority', TaskPriority).notNull().default(TaskPriority.MEDIUM),
	dueDate: integer('due_date'), // Unix timestamp
	isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at')
		.notNull()
		.default(sql`(strftime('%s','now'))`),
	updatedAt: integer('updated_at')
		.notNull()
		.default(sql`(strftime('%s','now'))`)
});

export const tasksProjects = sqliteTable('MoLOS-Tasks_projects', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull(),
	name: text('name').notNull(),
	description: text('description'),
	createdAt: integer('created_at')
		.notNull()
		.default(sql`(strftime('%s','now'))`),
	updatedAt: integer('updated_at')
		.notNull()
		.default(sql`(strftime('%s','now'))`)
});
```

### 4. Models (TypeScript Types)

```typescript
// src/models/types.ts
export const TaskStatus = {
	TO_DO: 'to_do',
	IN_PROGRESS: 'in_progress',
	DONE: 'done',
	ARCHIVED: 'archived'
} as const;

export const TaskPriority = {
	HIGH: 'high',
	MEDIUM: 'medium',
	LOW: 'low'
} as const;

export interface Task {
	id: string;
	userId: string;
	title: string;
	description?: string;
	status: (typeof TaskStatus)[keyof typeof TaskStatus];
	priority: (typeof TaskPriority)[keyof typeof TaskPriority];
	dueDate?: number; // Unix timestamp
	isCompleted: boolean;
	createdAt: number;
	updatedAt: number;
}

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];
export type CreateTaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'userId'>>;
```

```typescript
// src/models/index.ts
export * from './types';
```

### 5. Base Repository Pattern

```typescript
// src/server/repositories/base-repository.ts
import { db as defaultDb } from '$lib/server/db';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export abstract class BaseRepository {
	protected db: BetterSQLite3Database<any>;

	constructor(db?: BetterSQLite3Database<any>) {
		this.db = (db as BetterSQLite3Database<any>) || defaultDb;
	}
}
```

### 6. Concrete Repository

```typescript
// src/server/repositories/task-repository.ts
import { eq, and } from 'drizzle-orm';
import { tasksTasks } from '../database/schema';
import type { Task } from '../../models';
import { BaseRepository } from './base-repository';

export class TaskRepository extends BaseRepository {
	async getByUserId(userId: string, limit: number = 50): Promise<Task[]> {
		const result = await this.db
			.select()
			.from(tasksTasks)
			.where(eq(tasksTasks.userId, userId))
			.limit(limit);
		return result as Task[];
	}

	async getById(id: string, userId: string): Promise<Task | null> {
		const result = await this.db
			.select()
			.from(tasksTasks)
			.where(and(eq(tasksTasks.id, id), eq(tasksTasks.userId, userId)))
			.limit(1);
		return (result[0] as Task) || null;
	}

	async create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
		const result = await this.db.insert(tasksTasks).values(task).returning();
		return result[0] as Task;
	}

	async update(id: string, userId: string, updates: Partial<Task>): Promise<Task | null> {
		const result = await this.db
			.update(tasksTasks)
			.set({ ...updates, updatedAt: Math.floor(Date.now() / 1000) })
			.where(and(eq(tasksTasks.id, id), eq(tasksTasks.userId, userId)))
			.returning();
		return (result[0] as Task) || null;
	}

	async delete(id: string, userId: string): Promise<boolean> {
		const result = await this.db
			.delete(tasksTasks)
			.where(and(eq(tasksTasks.id, id), eq(tasksTasks.userId, userId)));
		return result.changes > 0;
	}
}
```

### 7. API Endpoint

```typescript
// src/routes/api/+server.ts
import { TaskRepository } from '../../server/repositories/task-repository';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { TaskStatus, TaskPriority } from '../../models';
import { db } from '$lib/server/db';

const CreateTaskSchema = z.object({
	title: z.string().min(1, 'Title is required'),
	description: z.string().optional(),
	status: z.nativeEnum(TaskStatus).optional(),
	priority: z.nativeEnum(TaskPriority).optional()
});

// GET /api/MoLOS-Tasks
export const GET: RequestHandler = async ({ locals }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const taskRepo = new TaskRepository(db);
	const tasks = await taskRepo.getByUserId(userId, 100);
	return json(tasks);
};

// POST /api/MoLOS-Tasks
export const POST: RequestHandler = async ({ locals, request }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const body = await request.json();
	const result = CreateTaskSchema.safeParse(body);
	if (!result.success) throw error(400, result.error.issues[0].message);

	const taskRepo = new TaskRepository(db);
	const task = await taskRepo.create({
		userId,
		...result.data,
		status: result.data.status || TaskStatus.TO_DO,
		priority: result.data.priority || TaskPriority.MEDIUM,
		isCompleted: false
	});

	return json(task, { status: 201 });
};
```

### 8. Page Server Load

```typescript
// src/routes/ui/dashboard/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	// Use event's fetch for internal API calls
	const [tasks, projects, settings] = await Promise.all([
		fetch('/api/MoLOS-Tasks').then((r) => (r.ok ? r.json() : [])),
		fetch('/api/MoLOS-Tasks/projects').then((r) => (r.ok ? r.json() : [])),
		fetch('/api/MoLOS-Tasks/settings').then((r) => (r.ok ? r.json() : null))
	]);

	return { tasks, projects, settings };
};
```

### 9. Drizzle Config

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/server/database/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: { url: 'file:../../molos.db' }, // Relative to root DB
	verbose: true,
	strict: true
});
```

### Module Development Checklist

- [ ] `package.json` with correct `@molos/module-{name}` and exports
- [ ] `src/config.ts` with `ModuleConfig` (id, name, href, icon, description)
- [ ] `src/models/types.ts` with TypeScript interfaces and enums
- [ ] `src/server/database/schema.ts` with `MoLOS-{Name}_{table}` naming
- [ ] `src/server/repositories/` extending `BaseRepository`
- [ ] `src/routes/api/+server.ts` with CRUD endpoints
- [ ] `src/routes/ui/` with SvelteKit pages
- [ ] `drizzle.config.ts` pointing to root DB
- [ ] Run `cd modules/{name} && npx drizzle-kit generate`
- [ ] Run `bun run module:sync` from root

---

## Related Documentation

- [Module Standards](./modules/standards.md) - Detailed conventions
- [Module Development](./modules/development.md) - Creating modules
- [Architecture Overview](./architecture/overview.md) - System design
- [Quick Start](./getting-started/quick-start.md) - Getting started guide

---

_Last Updated: 2026-02-17_
