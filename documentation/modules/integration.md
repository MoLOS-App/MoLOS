# Module Interaction

This document describes how modules communicate and interact in MoLOS, including the event bus system, data namespacing, cross-module communication patterns, and security boundaries.

## Core Principle: Isolation

MoLOS modules are **isolated by design**. Modules cannot directly import or call code from other modules. All communication flows through the core system.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Communication Rule                          │
│                                                                  │
│   ❌ Direct communication is NOT allowed                        │
│   ┌─────────────┐         ┌─────────────┐                       │
│   │  Module A   │ ──────▶ │  Module B   │  (forbidden)          │
│   └─────────────┘         └─────────────┘                       │
│                                                                  │
│   ✅ Communication must go through core                          │
│   ┌─────────────┐         ┌─────────────┐         ┌───────────┐ │
│   │  Module A   │ ──────▶ │ Core Event  │ ──────▶ │ Module B  │ │
│   │             │  event  │    Bus      │  notify │           │ │
│   └─────────────┘         └─────────────┘         └───────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Why Isolation Matters

| Benefit                 | Description                                        |
| ----------------------- | -------------------------------------------------- |
| **Security**            | Modules can't access other modules' internal state |
| **Stability**           | A module crash doesn't cascade to other modules    |
| **Independent Updates** | Modules can be updated without affecting others    |
| **Clear Boundaries**    | Well-defined interfaces between modules            |
| **Auditability**        | All module communication is traceable              |

## Event Bus System

The event bus is the primary mechanism for asynchronous communication between modules.

### Architecture

```
                         Event Bus (Core)
                    ┌─────────────────────┐
                    │                     │
   publish          │  ┌───────────────┐  │          notify
  ─────────────────▶│  │ Event Queue   │  │──────────────────▶
   Module A         │  │               │  │          Module B
                    │  │ task.created  │  │
                    │  │ task.updated  │  │
                    │  │ ...           │  │
                    │  └───────────────┘  │
                    │         │           │
                    │         ▼           │
                    │  ┌───────────────┐  │
                    │  │ Subscription  │  │
                    │  │ Registry      │  │
                    │  │               │  │
                    │  │ task.* -> C   │  │
                    │  │ * -> logger   │  │
                    │  └───────────────┘  │
                    │                     │
                    └─────────────────────┘
```

### Event Types

```typescript
// packages/core/src/modules/events/types.ts

/**
 * A module event
 */
export interface ModuleEvent<T = unknown> {
	/** Event type (e.g., "task.created", "project.updated") */
	type: string;

	/** Module ID that published the event */
	source: string;

	/** Event payload */
	data: T;

	/** Timestamp when event was created */
	timestamp: number;

	/** Optional correlation ID for tracing */
	correlationId?: string;
}

/**
 * Event handler function signature
 */
export type EventHandler<T = unknown> = (event: ModuleEvent<T>) => void | Promise<void>;
```

### Event Bus Implementation

```typescript
// packages/core/src/modules/events/bus.ts

import { EventEmitter } from 'events';
import type { ModuleEvent, EventHandler } from './types';

/**
 * Simple in-memory event bus for module communication
 */
export class ModuleEventBus {
	private emitter: EventEmitter;
	private subscriptions = new Map<string, EventSubscription[]>();

	constructor() {
		this.emitter = new EventEmitter();
		// Allow many listeners for many modules
		this.emitter.setMaxListeners(1000);
	}

	/**
	 * Publish an event from a module
	 */
	publish<T = unknown>(source: string, type: string, data: T): void {
		const event: ModuleEvent<T> = {
			type,
			source,
			data,
			timestamp: Date.now()
		};

		// Emit to all subscribers of this event type
		this.emitter.emit(type, event);

		// Also emit to wildcard subscribers
		this.emitter.emit('*', event);
	}

	/**
	 * Subscribe to an event type
	 * @returns Unsubscribe function
	 */
	subscribe<T = unknown>(moduleId: string, type: string, handler: EventHandler<T>): () => void {
		// Track subscription
		if (!this.subscriptions.has(type)) {
			this.subscriptions.set(type, []);
		}
		this.subscriptions.get(type)!.push({ moduleId, type, handler });

		// Register with emitter
		this.emitter.on(type, handler);

		// Return unsubscribe function
		return () => this.unsubscribe(moduleId, type, handler);
	}

	/**
	 * Unsubscribe from an event type
	 */
	unsubscribe<T = unknown>(moduleId: string, type: string, handler: EventHandler<T>): void {
		const subs = this.subscriptions.get(type);
		if (!subs) return;

		// Remove from tracking
		const index = subs.findIndex((s) => s.moduleId === moduleId && s.handler === handler);
		if (index !== -1) {
			subs.splice(index, 1);
		}

		// Remove from emitter
		this.emitter.off(type, handler);
	}

	/**
	 * Unsubscribe all handlers for a module
	 */
	unsubscribeAll(moduleId: string): void {
		for (const [type, subs] of this.subscriptions.entries()) {
			const toRemove = subs.filter((s) => s.moduleId === moduleId);
			for (const sub of toRemove) {
				this.emitter.off(type, sub.handler);
			}
			this.subscriptions.set(
				type,
				subs.filter((s) => s.moduleId !== moduleId)
			);
		}
	}

	/**
	 * Get subscriber count for an event type
	 */
	getSubscriberCount(type: string): number {
		return this.subscriptions.get(type)?.length ?? 0;
	}
}

// Singleton instance
let globalBus: ModuleEventBus | null = null;

export function getEventBus(): ModuleEventBus {
	if (!globalBus) {
		globalBus = new ModuleEventBus();
	}
	return globalBus;
}
```

### Module Context for Events

```typescript
// packages/core/src/modules/context.ts

import type { ModuleEventBus } from './events/bus';
import type { EventHandler } from './events/types';

export interface ModuleEventContext {
	/** Publish an event */
	publish<T = unknown>(type: string, data: T): void;

	/** Subscribe to events (returns unsubscribe function) */
	subscribe<T = unknown>(type: string, handler: EventHandler<T>): () => void;
}

export function createModuleEventContext(
	moduleId: string,
	eventBus: ModuleEventBus
): ModuleEventContext {
	return {
		publish: <T = unknown>(type: string, data: T) => {
			eventBus.publish(moduleId, type, data);
		},

		subscribe: <T = unknown>(type: string, handler: EventHandler<T>) => {
			return eventBus.subscribe(moduleId, type, handler);
		}
	};
}
```

### Usage Examples

#### Publishing Events

```typescript
// modules/product-owner/src/routes/api/projects/+server.ts

export const POST: RequestHandler = async ({ request, locals }) => {
	const data = await request.json();

	// Create the project
	const project = await projectRepository.create(data);

	// Publish event
	locals.modules.get('product-owner').events.publish('project.created', {
		projectId: project.id,
		name: project.name,
		createdBy: locals.user.id
	});

	return json(project);
};
```

#### Subscribing to Events

```typescript
// modules/analytics/src/module.ts

import type { ModuleDefinition, ModuleContext } from '@molos/core/modules';

export const module: ModuleDefinition = {
	async onEnable(context: ModuleContext) {
		// Subscribe to project events
		context.events.subscribe('project.created', async (event) => {
			await trackEvent('ProjectCreated', {
				projectId: event.data.projectId,
				source: event.source
			});
		});

		context.events.subscribe('project.deleted', async (event) => {
			await trackEvent('ProjectDeleted', {
				projectId: event.data.projectId
			});
		});
	},

	async onDisable(context: ModuleContext) {
		// Subscriptions are automatically cleaned up
		// But you can also manually unsubscribe
	}
};
```

#### Using Inline Event Handlers

```typescript
// modules/notifications/src/module.ts

import type { ModuleDefinition } from '@molos/core/modules';

export const module: ModuleDefinition = {
	// Define event handlers inline
	eventHandlers: {
		'project.created': async (event) => {
			await sendNotification({
				type: 'project',
				message: `New project: ${event.data.name}`,
				userId: event.data.createdBy
			});
		},

		'task.completed': async (event) => {
			await sendNotification({
				type: 'task',
				message: `Task completed: ${event.data.title}`,
				userId: event.data.assignee
			});
		}
	}
};
```

### Event Naming Convention

Use a consistent naming pattern to avoid conflicts:

```
{domain}.{entity}.{action}
```

| Pattern                         | Example                          | Description            |
| ------------------------------- | -------------------------------- | ---------------------- |
| `{entity}.{action}`             | `task.created`                   | Standard entity action |
| `{entity}.{subentity}.{action}` | `project.task.added`             | Nested entity action   |
| `{module}.{entity}.{action}`    | `product-owner.project.imported` | Module-qualified event |

#### Reserved Prefixes

| Prefix     | Purpose                                     |
| ---------- | ------------------------------------------- |
| `system.*` | System lifecycle events (startup, shutdown) |
| `module.*` | Module lifecycle events (loaded, unloaded)  |
| `user.*`   | User events (login, logout, updated)        |
| `db.*`     | Database events (migration, backup)         |

### Event Patterns

#### Request-Response Pattern

For operations that need a response:

```typescript
// Publisher: Request
context.events.publish('cache.invalidate', {
	key: 'user:123',
	requestId: crypto.randomUUID()
});

// Subscriber: Response
context.events.subscribe('cache.invalidate', async (event) => {
	await cache.delete(event.data.key);

	// Publish response
	context.events.publish('cache.invalidated', {
		requestId: event.data.requestId,
		success: true
	});
});
```

#### Broadcast Pattern

For notifying multiple modules:

```typescript
// Publisher
context.events.publish('settings.changed', {
	key: 'theme',
	value: 'dark'
});

// Multiple subscribers can react
// - UI module updates theme
// - Analytics module tracks preference change
// - Cache module invalidates theme cache
```

## Data Namespacing

### Table Prefixing

All module database tables are automatically prefixed to prevent collisions:

```
mod_{moduleId}_{tableName}
```

| Module        | Base Table | Prefixed Table                |
| ------------- | ---------- | ----------------------------- |
| product-owner | projects   | `mod_product_owner_projects`  |
| product-owner | workflows  | `mod_product_owner_workflows` |
| tasks         | tasks      | `mod_tasks_tasks`             |
| tasks         | categories | `mod_tasks_categories`        |

### Namespace Helper

```typescript
// packages/database/src/utils/namespace.ts

/**
 * Get the prefixed table name for a module
 */
export function getTableName(moduleId: string, tableName: string): string {
	const sanitized = tableName.replace(/[^a-zA-Z0-9_]/g, '');
	return `mod_${moduleId}_${sanitized}`;
}

/**
 * Check if a table name belongs to a specific module
 */
export function isModuleTable(fullTableName: string, moduleId: string): boolean {
	return fullTableName.startsWith(`mod_${moduleId}_`);
}

/**
 * Get pattern for matching module tables
 */
export function getModuleTablePattern(moduleId: string): string {
	return `mod_${moduleId}_%`;
}
```

### Usage in Schema

```typescript
// modules/product-owner/src/lib/server/db/schema/tables.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { getTableName } from '@molos/database';

const MODULE_ID = 'product-owner';

export const projects = sqliteTable(getTableName(MODULE_ID, 'projects'), {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	createdAt: integer('created_at').notNull()
});
```

### Data Isolation Benefits

```sql
-- Safe: Module tables are isolated
SELECT * FROM mod_product_owner_projects;  -- OK
SELECT * FROM mod_tasks_tasks;              -- OK

-- Collision prevented:
-- If two modules tried to create "projects" table:
-- mod_product_owner_projects  -- Different tables
-- mod_other_projects          -- Different tables
```

## Cross-Module Communication Patterns

### Pattern 1: Event-Based Notification

**Use Case:** Notify other modules when something happens

```typescript
// Publisher (Product Owner module)
async function createProject(data) {
	const project = await db.insert(projects).values(data);

	context.events.publish('project.created', {
		projectId: project.id,
		name: project.name
	});

	return project;
}

// Subscriber (Tasks module)
context.events.subscribe('project.created', async (event) => {
	// Create default task list for new project
	await createDefaultTaskList(event.data.projectId);
});
```

### Pattern 2: Request-Response via Events

**Use Case:** Get data from another module without direct import

```typescript
// Requester
async function getProjectStats(projectId: string) {
	const requestId = crypto.randomUUID();

	// Subscribe to response
	const responsePromise = new Promise((resolve) => {
		const unsubscribe = context.events.subscribe('project.stats.response', (event) => {
			if (event.data.requestId === requestId) {
				unsubscribe();
				resolve(event.data.stats);
			}
		});
	});

	// Publish request
	context.events.publish('project.stats.request', {
		projectId,
		requestId
	});

	// Wait for response with timeout
	return Promise.race([responsePromise, sleep(5000).then(() => ({ error: 'timeout' }))]);
}

// Responder (Product Owner module)
context.events.subscribe('project.stats.request', async (event) => {
	const stats = await calculateProjectStats(event.data.projectId);

	context.events.publish('project.stats.response', {
		requestId: event.data.requestId,
		stats
	});
});
```

### Pattern 3: AI Agent Orchestration

**Use Case:** Use the AI agent to coordinate between modules

```typescript
// The AI agent can call tools from different modules
// and combine their results

// User asks: "What's the status of my projects and tasks?"

// AI calls:
const projects = await project_list(); // From product-owner
const tasks = await task_list(); // From tasks

// AI combines and responds:
return `You have ${projects.length} projects and ${tasks.length} tasks.`;
```

### Pattern 4: Shared Core Services

**Use Case:** Access shared functionality through core packages

```typescript
// Multiple modules can use shared services
import { logger } from '@molos/core/logging';
import { cache } from '@molos/core/cache';
import { queue } from '@molos/core/queue';

// In any module:
logger.info('Module operation', { moduleId, action });
await cache.set('key', value, { ttl: 3600 });
await queue.enqueue('email', { to, subject, body });
```

## Security Boundaries

### Module Sandbox

```typescript
// packages/core/src/modules/sandbox.ts

export interface ModuleSandbox {
	/** Module ID */
	id: string;

	/** Allowed capabilities */
	capabilities: {
		database: boolean;
		network: string[];
		filesystem: string[];
	};

	/** Validate operation is allowed */
	validate(operation: string, resource: string): boolean;
}
```

### Network Restrictions

```typescript
// Module manifest declares allowed domains
// manifest.yaml
permissions: network: allowedDomains: -'api.github.com' - 'api.linear.app';
maxRequestsPerMinute: 100;

// Enforcement in module context
export class ModuleNetworkContext {
	private allowedDomains: string[];
	private rateLimiter: RateLimiter;

	async fetch(url: string, options?: RequestInit): Promise<Response> {
		const domain = new URL(url).hostname;

		// Check if domain is allowed
		if (!this.allowedDomains.includes(domain)) {
			throw new Error(`Domain ${domain} is not allowed for this module`);
		}

		// Check rate limit
		if (!this.rateLimiter.check()) {
			throw new Error('Rate limit exceeded');
		}

		return fetch(url, options);
	}
}
```

### Filesystem Restrictions

```typescript
// Module manifest declares allowed paths
permissions: filesystem: allowedPaths: -'/uploads/{moduleId}' - '/exports/{moduleId}';
maxStorageMB: 100;

// Enforcement
export class ModuleFilesystemContext {
	private allowedPaths: string[];
	private moduleId: string;

	private validatePath(path: string): void {
		const resolved = resolve(path);
		const allowed = this.allowedPaths.some((p) =>
			resolved.startsWith(p.replace('{moduleId}', this.moduleId))
		);

		if (!allowed) {
			throw new Error(`Path ${path} is not allowed for this module`);
		}
	}

	async readFile(path: string): Promise<string> {
		this.validatePath(path);
		return fs.readFile(path, 'utf-8');
	}

	async writeFile(path: string, content: string): Promise<void> {
		this.validatePath(path);
		return fs.writeFile(path, content);
	}
}
```

### Audit Logging

All cross-module communication is logged:

```typescript
// packages/core/src/modules/audit.ts

export class ModuleAuditLog {
	log(event: {
		type: 'publish' | 'subscribe' | 'api_call';
		sourceModule: string;
		targetModule?: string;
		eventType?: string;
		data?: unknown;
		timestamp: number;
	}): void {
		// Write to audit log
		this.db.insert(auditLog).values({
			type: event.type,
			sourceModule: event.sourceModule,
			targetModule: event.targetModule,
			eventType: event.eventType,
			data: JSON.stringify(event.data),
			timestamp: event.timestamp
		});
	}
}
```

## Best Practices

### 1. Use Events, Never Direct Imports

```typescript
// ❌ Bad: Direct import
import { getProject } from '@molos/module-product-owner';

// ✅ Good: Use events
context.events.publish('project.get', { projectId });
```

### 2. Design for Async Communication

```typescript
// Events are async by nature - design accordingly
context.events.publish('notification.send', {
	userId,
	message
});
// Don't wait for response - fire and forget
```

### 3. Handle Missing Subscribers

```typescript
// Not every event will have a subscriber
// Design your publishers to not expect responses
context.events.publish('analytics.track', { event: 'page_view' });
// If no analytics module is active, this is a no-op
```

### 4. Use Correlation IDs

```typescript
// For tracing related events across modules
const correlationId = crypto.randomUUID();

context.events.publish('order.created', {
	orderId,
	correlationId
});

// Other events can include the same correlationId
context.events.publish('payment.processed', {
	orderId,
	correlationId
});
```

### 5. Version Your Events

```typescript
// Include event version for backward compatibility
context.events.publish('user.created', {
	version: 2,
	user: {
		id,
		email,
		// v2 adds name field
		name
	}
});
```

---

_Last Updated: 2025-02-15_
_Version: 1.0_
