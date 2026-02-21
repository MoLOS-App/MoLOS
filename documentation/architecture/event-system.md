# Module Event System - Implementation Plan

## Overview

Add a simple, in-memory event bus to enable asynchronous communication between modules via the core. Modules cannot talk to each other directly - all communication flows through the event bus.

**Status:** Future Task
**Priority:** High
**Estimated Effort:** 1-2 days

---

## Problem Statement

Currently, MoLOS modules are completely isolated:

- Module A cannot notify Module B when something happens
- No standard way for modules to react to system-wide events
- The "no direct communication" security requirement has no implementation

This leads to:

- Tight coupling (modules importing each other directly)
- Duplicated logic (each module polling for state changes)
- No audit trail of module interactions

---

## Proposed Solution

A minimal `EventEmitter`-based event bus that:

1. Modules publish events (one-way: module → core)
2. Core routes events to subscribed modules
3. Simple in-memory delivery (no database)
4. Optional persistence only if needed

### Architecture

```
┌─────────────┐         publish           ┌─────────────┐
│  Module A   │ ──────────────────────────▶│   Core      │
│             │                            │  Event Bus  │
└─────────────┘                            └──────┬──────┘
                                                 │
                                              subscribe
                                                 │
                                                 ▼
┌─────────────┐         notify            ┌─────────────┐
│  Module B   │ ◀──────────────────────────│   Core      │
│             │    (via AI API or handler) │  Event Bus  │
└─────────────┘                            └─────────────┘
```

---

## Implementation

### File 1: Core Event Types

**Path:** `src/lib/server/modules/events/types.ts`

```typescript
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
	/** Timestamp */
	timestamp: number;
}

/**
 * Event handler function signature
 */
export type EventHandler<T = unknown> = (event: ModuleEvent<T>) => void | Promise<void>;

/**
 * Event subscription
 */
export interface EventSubscription {
	/** Module ID that is subscribing */
	moduleId: string;
	/** Event type to subscribe to */
	eventType: string;
	/** Handler function */
	handler: EventHandler;
}
```

---

### File 2: Event Bus

**Path:** `src/lib/server/modules/events/bus.ts`

```typescript
import { EventEmitter } from 'events';
import type { ModuleEvent, EventHandler, EventSubscription } from './types';

/**
 * Simple in-memory event bus for module communication
 *
 * Design principles:
 * - One-way communication: modules can only publish, not call each other
 * - In-memory: fast, simple, no database (yet)
 * - Fire-and-forget: no delivery guarantees (add later if needed)
 */
export class ModuleEventBus {
	private emitter: EventEmitter;
	private subscriptions = new Map<string, EventSubscription[]>();

	constructor() {
		this.emitter = new EventEmitter();
		// Allow up to 1000 listeners (default is 10, too low for many modules)
		this.emitter.setMaxListeners(1000);
	}

	/**
	 * Publish an event from a module
	 *
	 * @param source - Module ID publishing the event
	 * @param type - Event type (e.g., "task.created")
	 * @param data - Event payload
	 */
	publish<T = unknown>(source: string, type: string, data: T): void {
		const event: ModuleEvent<T> = {
			type,
			source,
			data,
			timestamp: Date.now()
		};

		// Emit to all subscribers
		this.emitter.emit(type, event);

		// Also emit a wildcard for debugging/monitoring
		this.emitter.emit('*', event);
	}

	/**
	 * Subscribe to an event type
	 *
	 * @param moduleId - Module ID subscribing (for tracking/authorization)
	 * @param type - Event type to subscribe to (or '*' for all events)
	 * @param handler - Function to call when event occurs
	 * @returns Unsubscribe function
	 */
	subscribe<T = unknown>(moduleId: string, type: string, handler: EventHandler<T>): () => void {
		const subscription: EventSubscription = {
			moduleId,
			eventType: type,
			handler: handler as EventHandler
		};

		// Track subscription
		if (!this.subscriptions.has(type)) {
			this.subscriptions.set(type, []);
		}
		this.subscriptions.get(type)!.push(subscription);

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
	 * Call this when a module is disabled
	 */
	unsubscribeAll(moduleId: string): void {
		for (const [type, subs] of this.subscriptions.entries()) {
			const toRemove = subs.filter((s) => s.moduleId === moduleId);
			for (const sub of toRemove) {
				this.emitter.off(type, sub.handler);
			}
			// Update tracked list
			this.subscriptions.set(
				type,
				subs.filter((s) => s.moduleId !== moduleId)
			);
		}
	}

	/**
	 * Get all active subscriptions (for debugging/admin)
	 */
	getSubscriptions(): Map<string, EventSubscription[]> {
		return new Map(this.subscriptions);
	}

	/**
	 * Get subscriber count for an event type
	 */
	getSubscriberCount(type: string): number {
		return this.subscriptions.get(type)?.length ?? 0;
	}

	/**
	 * Clear all subscriptions (useful for testing)
	 */
	clear(): void {
		this.emitter.removeAllListeners();
		this.subscriptions.clear();
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

---

### File 3: Module Context Integration

**Path:** `src/lib/server/modules/context.ts`

```typescript
import type { ModuleEventBus } from './events/bus';
import type { EventHandler } from './events/types';

/**
 * Context given to a module when it's loaded
 */
export interface ModuleContext {
	/** Module ID */
	readonly id: string;
	/** Event bus (for publishing and subscribing) */
	readonly events: {
		/** Publish an event */
		publish<T = unknown>(type: string, data: T): void;
		/** Subscribe to events */
		subscribe<T = unknown>(type: string, handler: EventHandler<T>): () => void;
	};
}

/**
 * Create module context
 */
export function createModuleContext(moduleId: string, eventBus: ModuleEventBus): ModuleContext {
	return {
		id: moduleId,
		events: {
			publish: <T = unknown>(type: string, data: T) => {
				eventBus.publish(moduleId, type, data);
			},
			subscribe: <T = unknown>(type: string, handler: EventHandler<T>) => {
				return eventBus.subscribe(moduleId, type, handler);
			}
		}
	};
}
```

---

### File 4: Module Definition Enhancement

**Path:** `src/lib/server/modules/definition.ts`

```typescript
import type { ModuleContext } from './context';

/**
 * Module definition
 * Modules can optionally implement these hooks
 */
export interface ModuleDefinition {
	/**
	 * Called when module is loaded/initialized
	 * Use this to subscribe to events
	 */
	onInit?(context: ModuleContext): void | Promise<void>;

	/**
	 * Called when module is unloaded/disabled
	 * Use this to cleanup (subscriptions will be auto-unsubscribed)
	 */
	onDestroy?(context: ModuleContext): void | Promise<void>;

	/**
	 * Optional: define event handlers inline
	 */
	eventHandlers?: Record<string, (data: unknown) => void | Promise<void>>;
}
```

---

### File 5: Integration with Module Registry

**Path:** `src/lib/server/modules/registry.ts`

```typescript
import { getEventBus } from './events/bus';
import { createModuleContext } from './context';
import type { ModuleDefinition, ModuleContext } from './types';

const eventBus = getEventBus();

/**
 * Load and initialize a module
 */
export async function loadModule(
	moduleId: string,
	definition: ModuleDefinition
): Promise<ModuleInstance> {
	// Create context with event access
	const context = createModuleContext(moduleId, eventBus);

	// Call init hook if defined
	if (definition.onInit) {
		await definition.onInit(context);
	}

	// Register inline event handlers if defined
	if (definition.eventHandlers) {
		for (const [eventType, handler] of Object.entries(definition.eventHandlers)) {
			context.events.subscribe(eventType, handler);
		}
	}

	return {
		id: moduleId,
		definition,
		context,
		status: 'active'
	};
}

/**
 * Unload a module
 */
export async function unloadModule(instance: ModuleInstance): Promise<void> {
	// Call destroy hook if defined
	if (instance.definition.onDestroy) {
		await instance.definition.onDestroy(instance.context);
	}

	// Unsubscribe all event handlers for this module
	eventBus.unsubscribeAll(instance.id);
}

interface ModuleInstance {
	id: string;
	definition: ModuleDefinition;
	context: ModuleContext;
	status: 'active' | 'inactive';
}
```

---

## Module Usage Examples

### Example 1: Publishing Events

```typescript
// external_modules/MoLOS-Tasks/module.ts

import type { ModuleDefinition, ModuleContext } from '$lib/server/modules/types';

export const module: ModuleDefinition = {
	async onInit(context: ModuleContext) {
		// Publish when a task is created
		// (this would be called from your API routes)
		context.events.publish('task.created', {
			taskId: '123',
			title: 'Fix bug',
			assignee: 'user@example.com'
		});
	}
};
```

### Example 2: Subscribing to Events

```typescript
// external_modules/MoLOS-Notifications/module.ts

import type { ModuleDefinition, ModuleContext } from '$lib/server/modules/types';

export const module: ModuleDefinition = {
	async onInit(context: ModuleContext) {
		// Subscribe to task creation events
		const unsubscribe = context.events.subscribe('task.created', async (event) => {
			// Send notification
			await sendNotification({
				message: `New task: ${event.data.title}`,
				to: event.data.assignee
			});
		});

		// Store unsubscribe function for cleanup
		context._eventUnsubscribes ??= [];
		context._eventUnsubscribes.push(unsubscribe);
	},

	async onDestroy(context: ModuleContext) {
		// Cleanup all subscriptions
		context._eventUnsubscribes?.forEach((fn) => fn());
	}
};
```

### Example 3: Using Inline Event Handlers

```typescript
// external_modules/MoLOS-Analytics/module.ts

import type { ModuleDefinition } from '$lib/server/modules/types';

export const module: ModuleDefinition = {
	eventHandlers: {
		// Automatically subscribed on load
		'task.created': async (event) => {
			await trackEvent('TaskCreated', {
				taskId: event.data.taskId,
				source: event.source
			});
		},
		'task.completed': async (event) => {
			await trackEvent('TaskCompleted', {
				taskId: event.data.taskId
			});
		}
	}
};
```

---

## Event Naming Convention

To avoid conflicts, use this naming pattern:

```
{domain}.{entity}.{action}
```

Examples:

- `task.created` - A new task was created
- `task.completed` - A task was completed
- `project.deleted` - A project was deleted
- `user.login` - A user logged in
- `integration.synced` - An external integration finished syncing

Reserved prefixes (core system events):

- `system.*` - System lifecycle events
- `module.*` - Module lifecycle events

---

## Optional Enhancements (Defer to Later)

### 1. Event Persistence

If you need event sourcing/audit trails:

```typescript
// Add to ModuleEventBus class
private db: Database;

async publish<T>(source: string, type: string, data: T): Promise<void> {
    const event = { type, source, data, timestamp: Date.now() };

    // Store in database
    await this.db.insert(moduleEvents).values({
        sourceModule: source,
        eventType: type,
        eventData: JSON.stringify(data),
        createdAt: event.timestamp
    });

    // Emit to subscribers
    this.emitter.emit(type, event);
}
```

New table needed:

```sql
CREATE TABLE module_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_module TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_module_events_type ON module_events(event_type);
```

### 2. Delivery Guarantees

If you need reliable event delivery:

```typescript
// Add retry logic
private async deliverWithRetry(moduleId: string, event: ModuleEvent): Promise<void> {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            await this.deliverToModule(moduleId, event);
            return;
        } catch (error) {
            attempts++;
            if (attempts >= maxAttempts) {
                await this.logFailedDelivery(moduleId, event, error);
                throw error;
            }
            await sleep(2 ** attempts * 1000); // Exponential backoff
        }
    }
}
```

### 3. Event Filtering/Wildcards

```typescript
// Subscribe to all events in a domain
context.events.subscribe('task.*', handler); // All task events

// Subscribe to multiple specific events
context.events.subscribe(['task.created', 'task.completed'], handler);
```

---

## Testing

```typescript
// tests/modules/event-bus.test.ts

import { describe, it, expect } from 'vitest';
import { ModuleEventBus } from '$lib/server/modules/events/bus';

describe('ModuleEventBus', () => {
	it('should publish and receive events', async () => {
		const bus = new ModuleEventBus();
		const received: unknown[] = [];

		bus.subscribe('module-a', 'test.event', (event) => {
			received.push(event.data);
		});

		bus.publish('module-b', 'test.event', { hello: 'world' });

		expect(received).toEqual([{ hello: 'world' }]);
	});

	it('should support multiple subscribers', async () => {
		const bus = new ModuleEventBus();
		const results: string[] = [];

		bus.subscribe('module-a', 'test.event', () => results.push('a'));
		bus.subscribe('module-b', 'test.event', () => results.push('b'));

		bus.publish('module-c', 'test.event', {});

		expect(results).toEqual(['a', 'b']);
	});

	it('should unsubscribe correctly', async () => {
		const bus = new ModuleEventBus();
		let count = 0;

		const unsubscribe = bus.subscribe('mod', 'test', () => count++);
		bus.publish('other', 'test', {});
		expect(count).toBe(1);

		unsubscribe();
		bus.publish('other', 'test', {});
		expect(count).toBe(1); // Not incremented
	});
});
```

---

## Migration Path

1. **Week 1:** Implement core event bus and types
2. **Week 1:** Integrate with existing module loading
3. **Week 2:** Update one existing module to use events (proof of concept)
4. **Week 2:** Document event naming conventions and best practices

---

## Success Criteria

- [x] Modules can publish events
- [x] Modules can subscribe to events
- [x] Unsubscribing works correctly
- [x] Multiple modules can subscribe to same event
- [x] No direct module-to-module imports required
- [x] Tests pass

---

## Files to Create

| File                                     | Lines | Purpose                   |
| ---------------------------------------- | ----- | ------------------------- |
| `src/lib/server/modules/events/types.ts` | ~50   | Type definitions          |
| `src/lib/server/modules/events/bus.ts`   | ~150  | Core event bus            |
| `src/lib/server/modules/context.ts`      | ~40   | Module context            |
| `src/lib/server/modules/definition.ts`   | ~30   | Module definition         |
| `src/lib/server/modules/registry.ts`     | ~100  | Integration with registry |
| `tests/modules/event-bus.test.ts`        | ~100  | Tests                     |

**Total:** ~500 lines of code

---

_Last Updated: 2025-02-09_
_Status: Ready for Implementation_
