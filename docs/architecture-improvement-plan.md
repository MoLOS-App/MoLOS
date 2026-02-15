# MoLOS Phoenix Module System - Refined Architecture v2.0

## Executive Summary

After extensive research into SvelteKit capabilities, plugin architectures (VS Code, Eclipse/OSGi), and microkernel patterns, this refined plan proposes a **Microkernel-Based Module System** that builds upon MoLOS's existing strengths while addressing real limitations.

**Key Changes from Original Plan:**
- **Keep symlinks** - They work correctly for SvelteKit's filesystem routing
- **Focus on isolation** - Modules cannot communicate directly (security requirement)
- **Event bus via core** - Async communication mediated through `src/routes/api/ai/`
- **Microkernel pattern** - Core system with isolated plugin modules

---

## Research Findings Summary

### What We Learned

| Topic | Finding | Implication for MoLOS |
|-------|----------|----------------------|
| **SvelteKit Routing** | Filesystem-based, routes must exist at build/start time | Cannot do true runtime route loading |
| **VS Code Architecture** | Extensions run in isolated extension host process | Good model for isolation |
| **Eclipse/OSGi** | Mature plugin architecture with services registry | Event-driven communication pattern |
| **Module Federation** | Webpack-specific, doesn't apply to SvelteKit | Not viable for MoLOS |
| **Microkernel Pattern** | Core + isolated plugins with message passing | **Recommended architecture** |

### Critical Constraint: Module Isolation

> **Security Requirement**: Modules cannot talk to each other directly. Only `src/routes/api/ai/` can communicate with modules unidirectionally.

This is a **feature, not a bug**. It enables:
- Security isolation between modules
- Independent module updates
- No cascading failures
- Clear audit trails

---

## Current Architecture Analysis

### What Works Well (Keep)

```
✅ Symlink-based integration - Works perfectly for SvelteKit
✅ import.meta.glob() for module discovery - Fast at build/startup time
✅ Hot reload via watch: { followSymlinks: true } - Already working
✅ Module status tracking in database - Solid foundation
✅ AiToolbox pattern - Good example of unidirectional communication
✅ MCP integration with scoped keys - Security best practice
```

### What Needs Improvement

```
❌ No module lifecycle hooks (onInstall, onEnable, onDisable)
❌ No event bus for async communication
❌ Direct database access from modules (security risk)
❌ No sandboxed data access per module
❌ No module capability declarations
❌ No inter-module communication (even via core)
❌ No version pinning for dependencies
```

---

## Proposed Architecture: Phoenix Microkernel System

### Core Principles

1. **Microkernel Pattern** - Small core + isolated plugins
2. **Security by Isolation** - Modules cannot talk directly to each other
3. **Event-Driven Communication** - Async messaging via core event bus
4. **Sandboxed Data Access** - Scoped database tables per module
5. **Lifecycle Hooks** - Standardized module initialization
6. **Keep Symlinks** - They're the right solution for SvelteKit

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MoLOS Application                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    MICROKERNEL CORE                                  │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │  Module Registry & Lifecycle Manager                          │  │   │
│  │  │  - Discovers modules (symlinks + glob)                        │  │   │
│  │  │  - Manages lifecycle (init, enable, disable, uninstall)       │  │   │
│  │  │  - Validates manifests and capabilities                      │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │              Event Bus (Core-Only)                             │  │   │
│  │  │  - Modules publish events (via AI API)                        │  │   │
│  │  │  - Core routes to subscribed modules                          │  │   │
│  │  │  - Database-backed for reliability                            │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │              Data Sandbox Manager                             │  │   │
│  │  │  - Scoped table access (mod_{moduleId}_*)                     │  │   │
│  │  │  - Migration management per module                            │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                                     │ Unidirectional (AI API only)          │
│                                     ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      src/routes/api/ai/                               │   │
│  │                   (Communication Boundary)                           │   │
│  │  - Aggregates AI tools from all modules                              │   │
│  │  - Routes events to module handlers                                  │   │
│  │  - Enforces security boundaries                                      │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                    ┌────────────────┼────────────────┐                       │
│                    ▼                ▼                ▼                       │
│           ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │
│           │   Module    │   │   Module    │   │   Module    │               │
│           │  (Isolated) │   │  (Isolated) │   │  (Isolated) │      ...      │
│           └─────────────┘   └─────────────┘   └─────────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Enhanced Module Manifest

### File: `external_modules/{moduleId}/manifest.yaml`

```yaml
# Module identity
id: "MoLOS-Product-Owner"
name: "MoLOS Product Owner"
version: "2.0.0"
apiVersion: "2.0"
description: "Product Owner Operating System"
author: "MoLOS Team"
icon: "LayoutDashboard"

# NEW: Module entry point (optional, for v2.0 modules)
entryPoint: "./module.ts"

# NEW: Dependencies with version constraints
dependencies:
  - id: "MoLOS-Tasks"
    version: ">=1.0.0"
    optional: false

# NEW: Capabilities declaration (security & discovery)
capabilities:
  database:
    tables: ["projects", "workflows", "automation_rules"]
  api:
    routes: ["/api/projects/*", "/api/workflows/*"]
  ai-tools:
    tools: ["project_search", "workflow_execute"]
  ui-routes:
    routes: ["/ui/dashboard", "/ui/projects"]
  events:
    publishes:
      - "project.created"
      - "workflow.completed"
      - "automation.triggered"
    subscribes:
      - "task.completed"
      - "integration.ready"

# NEW: Permissions (security boundaries)
permissions:
  database:
    create: true
    read: true
    update: true
    delete: true
  network:
    allowedDomains:
      - "api.github.com"
      - "api.linear.app"
    maxRequestsPerMinute: 100
  filesystem:
    allowedPaths:
      - "/uploads/{moduleId}"
      - "/exports/{moduleId}"
    maxStorageMB: 100

# NEW: Lifecycle hooks (optional)
lifecycle:
  onInstall: "./hooks/install.ts"
  onEnable: "./hooks/enable.ts"
  onDisable: "./hooks/disable.ts"
  onUninstall: "./hooks/uninstall.ts"
  onUpgrade: "./hooks/upgrade.ts"
  onConfigChange: "./hooks/config-change.ts"

# Existing fields (unchanged for compatibility)
# href, navigation, etc.
```

---

## Module Entry Point (Optional for v2.0)

### File: `external_modules/{moduleId}/module.ts`

```typescript
import type {
	ModuleDefinition,
	ModuleContext,
	ModuleEventEmitter,
	ModuleDataSandbox
} from '$lib/server/modules/types';

export const module: ModuleDefinition = {
	// Lifecycle hooks
	async onInstall(context: ModuleContext): Promise<void> {
		// Create database tables
		const db = context.data.getDatabase();
		await db.schema.createTable('projects', (table) => {
			table.text('id').primary();
			table.text('name').notNull();
			table.timestamps();
		});

		// Run migrations
		await context.migrations.run();
	},

	async onEnable(context: ModuleContext): Promise<void> {
		// Subscribe to events from other modules
		context.events.subscribe('task.completed', async (data) => {
			// Handle task completion
			await this.handleTaskCompleted(data);
		});
	},

	async onDisable(context: ModuleContext): Promise<void> {
		// Cleanup: unsubscribe from events
		context.events.unsubscribeAll();
	},

	async onUninstall(context: ModuleContext): Promise<void> {
		// Drop database tables
		const db = context.data.getDatabase();
		await db.schema.dropTable('projects');
	},

	// Event handlers (optional)
	async handleTaskCompleted(data: unknown): Promise<void> {
		// Module-specific logic
	},

	// API exports (called via core, not directly by other modules)
	async getProjectStats(projectId: string): Promise<ProjectStats> {
		const db = this.data.getDatabase();
		return db.select().from('projects').where({ id: projectId }).first();
	}
};
```

---

## Implementation Plan

### Phase 1: Core Module System (Foundation)

**Files to Create:**

```
src/lib/server/modules/
├── types.ts                 # TypeScript definitions
├── registry.ts              # Module registry & lifecycle
├── event-bus.ts             # Event bus for async communication
├── sandbox.ts               # Data access sandbox
├── lifecycle.ts             # Lifecycle hook execution
└── validation.ts            # Manifest validation
```

#### Key Types

```typescript
// src/lib/server/modules/types.ts

export interface ModuleManifest {
	id: string;
	name: string;
	version: string;
	apiVersion: string;
	description: string;
	author: string;
	icon: string;
	entryPoint?: string;
	dependencies?: ModuleDependency[];
	capabilities?: ModuleCapabilities;
	permissions?: ModulePermissions;
	lifecycle?: ModuleLifecycleConfig;
}

export interface ModuleContext {
	readonly moduleId: string;
	readonly version: string;
	readonly config: Record<string, unknown>;

	// Event emission (one-way: module -> core)
	events: ModuleEventEmitter;

	// Data access (sandboxed)
	data: ModuleDataSandbox;

	// Migrations
	migrations: ModuleMigrationRunner;

	// Logging
	log: ModuleLogger;
}

export interface ModuleEventEmitter {
	publish(eventType: string, data: unknown): Promise<void>;
}

export interface ModuleDataSandbox {
	getDatabase(): Database; // Scoped to module's tables
	getTableName(table: string): string; // Returns mod_{moduleId}_{table}
	query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface ModuleDefinition {
	onInstall?(context: ModuleContext): Promise<void>;
	onEnable?(context: ModuleContext): Promise<void>;
	onDisable?(context: ModuleContext): Promise<void>;
	onUninstall?(context: ModuleContext): Promise<void>;
	onUpgrade?(context: ModuleContext, fromVersion: string, toVersion: string): Promise<void>;
}
```

#### Module Registry

```typescript
// src/lib/server/modules/registry.ts

export class ModuleRegistry {
	private modules = new Map<string, ModuleInstance>();
	private eventBus: ModuleEventBus;

	constructor(eventBus: ModuleEventBus) {
		this.eventBus = eventBus;
	}

	/**
	 * Discover all modules from external_modules directory
	 * Uses existing symlinks + import.meta.glob
	 */
	async discoverModules(): Promise<ModuleManifest[]> {
		const moduleConfigs = import.meta.glob(
			'../../../config/external_modules/*.ts',
			{ eager: true }
		);

		return Object.entries(moduleConfigs).map(([path, config]) => {
			// Parse manifest from module directory
			return this.loadModuleManifest(path);
		});
	}

	/**
	 * Load a module and execute its lifecycle hooks
	 */
	async loadModule(moduleId: string): Promise<ModuleInstance> {
		const manifest = await this.getManifest(moduleId);

		// Load module definition
		const def = await this.loadModuleDefinition(manifest);

		// Create module context
		const context = this.createContext(moduleId, manifest);

		// Execute onEnable hook
		if (def?.onEnable) {
			await def.onEnable(context);
		}

		const instance: ModuleInstance = {
			id: moduleId,
			manifest,
			definition: def,
			context,
			status: 'active'
		};

		this.modules.set(moduleId, instance);
		return instance;
	}

	/**
	 * Unload a module gracefully
	 */
	async unloadModule(moduleId: string): Promise<void> {
		const instance = this.modules.get(moduleId);
		if (!instance) return;

		// Execute onDisable hook
		if (instance.definition?.onDisable) {
			await instance.definition.onDisable(instance.context);
		}

		this.modules.delete(moduleId);
	}

	getModule(moduleId: string): ModuleInstance | undefined {
		return this.modules.get(moduleId);
	}

	getActiveModules(): ModuleInstance[] {
		return Array.from(this.modules.values()).filter(m => m.status === 'active');
	}
}
```

#### Event Bus

```typescript
// src/lib/server/modules/event-bus.ts

export class ModuleEventBus {
	private db: Database;

	constructor(db: Database) {
		this.db = db;
	}

	/**
	 * Publish an event from a module
	 * Events are stored in database for reliability
	 */
	async publish(
		sourceModule: string,
		eventType: string,
		data: unknown
	): Promise<void> {
		// Store event in database
		await this.db.insert(moduleEvents).values({
			sourceModule,
			eventType,
			data: JSON.stringify(data),
			createdAt: Date.now()
		});

		// Get all modules subscribed to this event type
		const subscribers = await this.getSubscribers(eventType);

		// Notify subscribers via AI API
		for (const subscriber of subscribers) {
			await this.notifyModule(subscriber, {
				type: eventType,
				source: sourceModule,
				data
			});
		}
	}

	/**
	 * Get modules subscribed to an event type
	 */
	private async getSubscribers(eventType: string): Promise<string[]> {
		const modules = await this.db
			.select({ id: settingsExternalModules.id })
			.from(settingsExternalModules)
			.where(eq(settingsExternalModules.status, 'active'));

		// Filter modules that subscribe to this event
		// (parsed from their manifest capabilities.events.subscribes)
		return modules
			.filter(m => this.moduleSubscribesTo(m.id, eventType))
			.map(m => m.id);
	}

	/**
	 * Notify a module via its AI tools or webhook
	 */
	private async notifyModule(moduleId: string, event: ModuleEvent): Promise<void> {
		// Call module's event handler via AI API
		// This maintains the unidirectional communication pattern
		const url = `/api/ai/modules/${moduleId}/events`;
		// ... implementation
	}
}
```

#### Data Sandbox

```typescript
// src/lib/server/modules/sandbox.ts

export class ModuleDataSandbox {
	constructor(
		private moduleId: string,
		private db: Database
	) {}

	/**
	 * Get a table name with module prefix
	 * Ensures table isolation between modules
	 */
	getTableName(table: string): string {
		return `mod_${this.moduleId}_${table}`;
	}

	/**
	 * Create a table for this module
	 */
	async createTable(
		tableName: string,
		definition: (table: any) => void
	): Promise<void> {
		const prefixedTable = this.getTableName(tableName);
		// Use Drizzle schema builder
		await this.db.schema.createTable(prefixedTable, definition);
	}

	/**
	 * Query this module's tables
	 */
	async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
		// Rewrite SQL to use prefixed table names
		const rewritten = this.rewriteSql(sql);
		return this.db.execute(rewritten, params);
	}

	/**
	 * Get/set module-scoped key-value data
	 */
	async getData(key: string): Promise<unknown> {
		const result = await this.db
			.select()
			.from(moduleKvStore)
			.where(
				and(
					eq(moduleKvStore.moduleId, this.moduleId),
					eq(moduleKvStore.key, key)
				)
			)
			.first();

		return result?.value ? JSON.parse(result.value) : undefined;
	}

	async setData(key: string, value: unknown): Promise<void> {
		await this.db
			.insert(moduleKvStore)
			.values({
				moduleId: this.moduleId,
				key,
				value: JSON.stringify(value),
				updatedAt: Date.now()
			})
			.onConflictDoUpdate({
				target: [moduleKvStore.moduleId, moduleKvStore.key],
				set: {
					value: JSON.stringify(value),
					updatedAt: Date.now()
				}
			});
	}

	private rewriteSql(sql: string): string {
		// Rewrite table names to use module prefix
		// e.g., "SELECT * FROM projects" -> "SELECT * FROM mod_MoLOS-Product-Owner_projects"
		return sql.replace(
			/\b(FROM|JOIN|INTO|UPDATE)\s+(\w+)/gi,
			(_, keyword, table) => `${keyword} ${this.getTableName(table)}`
		);
	}
}
```

---

### Phase 2: AI API Integration

**Files to Modify:**
- `src/lib/server/ai/toolbox.ts` - Enhanced module discovery
- `src/routes/api/ai/modules/+server.ts` - Module event delivery

#### Enhanced AiToolbox

```typescript
// src/lib/server/ai/toolbox.ts

export class AiToolbox {
	private registry: ModuleRegistry;

	constructor(registry: ModuleRegistry) {
		this.registry = registry;
	}

	/**
	 * Get all AI tools from active modules
	 * Enhanced to support v2.0 module definitions
	 */
	async getTools(userId: string, activeModuleIds: string[]): Promise<ToolDefinition[]> {
		const tools = getCoreAiTools(userId);

		for (const moduleId of activeModuleIds) {
			const module = this.registry.getModule(moduleId);
			if (!module) continue;

			// Try v2.0 module definition first
			if (module.definition?.aiTools) {
				const moduleTools = await module.definition.aiTools(userId);
				tools.push(...moduleTools.map(t => ({
					...t,
					name: `${moduleId}_${t.name}`
				})));
			}
			// Fallback to v1.0 ai-tools.ts
			else {
				const toolsPath = `./external_modules/${moduleId}/ai-tools.ts`;
				const loader = externalToolLoaders[toolsPath];
				if (loader) {
					const aiToolsModule = await loader();
					if (aiToolsModule.getAiTools) {
						const moduleTools = await aiToolsModule.getAiTools(userId);
						tools.push(...moduleTools.map(t => ({
							...t,
							name: `${moduleId}_${t.name}`
						})));
					}
				}
			}
		}

		return tools;
	}
}
```

#### Module Event Delivery API

```typescript
// src/routes/api/ai/modules/[id]/events/+server.ts

import { registry } from '$lib/server/modules/registry';

export async function POST(request: Request, { params }: { params: { id: string } }) {
	const { id: moduleId } = params;
	const event = await request.json();

	const module = registry.getModule(moduleId);
	if (!module) {
		return new Response('Module not found', { status: 404 });
	}

	// Call module's event handler if defined
	if (module.definition?.onEvent) {
		try {
			await module.definition.onEvent(event);
			return new Response(JSON.stringify({ success: true }), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error(`[ModuleEvent] Error in ${moduleId}:`, error);
			return new Response('Event handler error', { status: 500 });
		}
	}

	// No event handler defined
	return new Response(JSON.stringify({ success: true, message: 'No handler' }), {
		headers: { 'Content-Type': 'application/json' }
	});
}
```

---

### Phase 3: Database Schema

**New Tables:**

```sql
-- Module event log (for event bus)
CREATE TABLE module_events (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	source_module TEXT NOT NULL,
	event_type TEXT NOT NULL,
	data TEXT NOT NULL,
	created_at INTEGER NOT NULL
);
CREATE INDEX idx_module_events_type ON module_events(event_type);
CREATE INDEX idx_module_events_source ON module_events(source_module);

-- Module key-value store (for sandbox)
CREATE TABLE module_kv_store (
	module_id TEXT NOT NULL,
	key TEXT NOT NULL,
	value TEXT NOT NULL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (module_id, key)
);

-- Module subscription registry (cached from manifests)
CREATE TABLE module_subscriptions (
	module_id TEXT NOT NULL,
	event_type TEXT NOT NULL,
	handler_path TEXT,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (module_id, event_type)
);
```

---

### Phase 4: Lifecycle Hooks Implementation

**File:** `src/lib/server/modules/lifecycle.ts`

```typescript
export class ModuleLifecycleRunner {
	constructor(
		private registry: ModuleRegistry,
		private db: Database
	) {}

	/**
	 * Run onInstall hook for a new module
	 */
	async onInstall(moduleId: string): Promise<void> {
		const module = await this.registry.getModule(moduleId);
		if (!module?.definition?.onInstall) {
			return; // No install hook defined
		}

		const context = module.context;
		await module.definition.onInstall(context);

		// Record successful installation
		await this.db
			.insert(moduleInstallLog)
			.values({
				moduleId,
				version: module.manifest.version,
				installedAt: Date.now()
			});
	}

	/**
	 * Run onUpgrade hook when module version changes
	 */
	async onUpgrade(moduleId: string, fromVersion: string, toVersion: string): Promise<void> {
		const module = await this.registry.getModule(moduleId);
		if (!module?.definition?.onUpgrade) {
			return; // No upgrade hook defined
		}

		await module.definition.onUpgrade(module.context, fromVersion, toVersion);
	}

	/**
	 * Run onEnable hook
	 */
	async onEnable(moduleId: string): Promise<void> {
		const module = await this.registry.getModule(moduleId);
		if (module?.definition?.onEnable) {
			await module.definition.onEnable(module.context);
		}
	}

	/**
	 * Run onDisable hook
	 */
	async onDisable(moduleId: string): Promise<void> {
		const module = await this.registry.getModule(moduleId);
		if (module?.definition?.onDisable) {
			await module.definition.onDisable(module.context);
		}
	}

	/**
	 * Run onUninstall hook
	 */
	async onUninstall(moduleId: string): Promise<void> {
		const module = await this.registry.getModule(moduleId);
		if (module?.definition?.onUninstall) {
			await module.definition.onUninstall(module.context);
		}

		// Clean up database tables
		const tables = await this.db
			.select({
				name: sqliteMaster.name
			})
			.from(sqliteMaster)
			.where(like(sqliteMaster.name, `mod_${moduleId}_%`));

		for (const table of tables) {
			await this.db.schema.dropTable(table.name);
		}
	}
}
```

---

### Phase 5: Module CLI Updates

**File:** `scripts/module-dev-cli.ts`

Add new commands:
- `npm run module:migrate <id>` - Run module migrations
- `npm run module:events <id>` - Show events published by module
- `npm run module:validate-v2 <path>` - Validate v2.0 manifest

---

### Phase 6: Backward Compatibility

**File:** `src/lib/server/modules/compatibility.ts`

```typescript
/**
 * Adapter for v1.0 modules to work with v2.0 system
 */
export class ModuleV1Adapter {
	/**
	 * Convert v1.0 module to v2.0 format
	 */
	async adaptModule(moduleId: string): Promise<ModuleDefinition> {
		// Check if module has module.ts (v2.0)
		const hasEntryPoint = await this.checkEntryPoint(moduleId);

		if (hasEntryPoint) {
			// Load v2.0 definition
			return import(`../../../external_modules/${moduleId}/module.ts`);
		}

		// Return v1.0 compatible definition
		return {
			// No-op hooks for v1.0 modules
			onEnable: async () => {},
			onDisable: async () => {},

			// Existing ai-tools.ts still works
			aiTools: async (userId: string) => {
				const loader = externalToolLoaders[`./external_modules/${moduleId}/ai-tools.ts`];
				if (loader) {
					const mod = await loader();
					return mod.getAiTools?.(userId) || [];
				}
				return [];
			}
		};
	}
}
```

---

## Files Summary

### New Files to Create

```
src/lib/server/modules/
├── types.ts                 # Core type definitions
├── registry.ts              # Module registry
├── event-bus.ts             # Event bus
├── sandbox.ts               # Data sandbox
├── lifecycle.ts             # Lifecycle runner
├── validation.ts            # Manifest validation
└── compatibility.ts         # V1 to V2 adapter

drizzle/
└── schema/
    └── module-v2.ts         # New database tables
```

### Files to Modify

```
src/lib/server/ai/
└── toolbox.ts               # Enhanced module discovery

src/routes/api/ai/modules/
└── [id]/events/+server.ts   # New event delivery endpoint

src/hooks.server.ts          # Initialize registry on startup

scripts/
└── module-dev-cli.ts        # Add v2 commands

module-management/server/
└── core-manager.ts          # Integrate with lifecycle
```

### Files That Stay the Same

```
vite.config.ts               # Symlinks stay!
scripts/link-modules.ts      # Symlinks stay!
module-management/config/
└── symlink-config.ts        # Symlinks stay!
```

---

## Migration Strategy

### Gradual Rollout

| Phase | Duration | Description |
|-------|----------|-------------|
| **Week 1** | Foundation | Implement core types, registry, event bus |
| **Week 2** | Sandbox | Implement data sandbox and lifecycle |
| **Week 3** | Integration | Update AiToolbox and AI API |
| **Week 4** | Database | Add new tables and migrations |
| **Week 5** | Testing | Test with existing modules (v1 compatibility) |
| **Week 6** | Documentation | Document v2.0 module development |
| **Week 7** | Migration | Migrate one module to v2.0 as proof of concept |
| **Week 8** | Rollout | Enable v2.0 for new modules, v1 remains supported |

### Backward Compatibility

- **v1.0 modules continue to work** - No breaking changes
- **v2.0 features are opt-in** - Add `module.ts` to enable
- **Symlinks remain** - No changes to routing

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Module isolation | 100% | No direct module-to-module communication |
| Event delivery | <100ms p95 | Timing in event bus |
| Database sandboxing | 100% | All tables prefixed with mod_{moduleId}_ |
| v1 module compatibility | 100% | Existing modules work unchanged |
| Hot reload | Working | Module changes reflect without restart |
| Security | No bypasses | Modules cannot access other modules' data |

---

## FAQ

### Q: Why keep symlinks?

**A:** SvelteKit's filesystem routing requires routes to exist at build/startup time. Symlinks are the correct solution for this. They work well and are properly supported by Vite.

### Q: Can modules be installed at runtime?

**A:** No, and this is a SvelteKit limitation, not a MoLOS limitation. To add a new module, you need to:
1. Clone/download to `external_modules/`
2. Restart the SvelteKit server
3. Symlinks are created automatically

### Q: Why can't modules talk directly to each other?

**A:** This is a security design decision. Direct communication would:
- Create tight coupling between modules
- Enable security vulnerabilities
- Make independent updates impossible
- Create cascading failure risks

### Q: How do modules communicate then?

**A:** Via the event bus through the AI API:
1. Module A publishes an event
2. Core event bus stores the event
3. Core notifies subscribed modules via AI API
4. Module B receives event via its event handler

### Q: What if a module needs data from another module?

**A:** This should be done via:
1. **Events**: Module A publishes "data.requested", Module B responds with "data.available"
2. **Core coordination**: The AI agent can orchestrate data access between modules
3. **Shared database**: With proper sandboxing (read-only access to specific tables)

---

## Appendix: Architecture Patterns Reference

### Microkernel Architecture

**Similar Systems:**
- **Eclipse/OSGi** - Plugin architecture with services registry
- **VS Code** - Extension host with isolated processes
- **Linux** - Microkernel with userspace servers

**Benefits:**
- Core remains small and stable
- Plugins can crash without taking down the system
- Clear security boundaries
- Independent versioning

### Event-Driven Communication

**Similar Systems:**
- **AWS EventBridge** - Event bus for microservices
- **Kafka** - Distributed event streaming
- **Domain events** - DDD pattern for bounded contexts

**Benefits:**
- Loose coupling
- Async processing
- Audit trails
- Retry mechanisms

---

## Next Steps

1. **Review this plan** with the team
2. **Create tracking issues** for each phase
3. **Set up a proof-of-concept** module
4. **Begin Phase 1 implementation**

---

*Document Version: 2.0*
*Last Updated: 2025-02-07*
*Status: Ready for Review*
