# Module Activation

This document explains how module activation works in MoLOS, including configuration formats, environment-based settings, runtime toggling, and the UI for module management.

## Overview

Module activation in MoLOS is the process of enabling or disabling specific modules at runtime. Unlike traditional plugin systems that require restarts, MoLOS allows dynamic module activation through database configuration.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Module Activation Flow                        │
│                                                                  │
│  1. Startup     2. Database Query    3. Module Loading          │
│  ┌────────┐     ┌────────────────┐    ┌────────────────────┐    │
│  │SvelteKit│────▶│ SELECT * FROM  │───▶│ Load active modules│    │
│  │ starts  │     │ modules WHERE  │    │ into context       │    │
│  └────────┘     │ status='active'│    └────────────────────┘    │
│                 └────────────────┘              │               │
│                                                 ▼               │
│  4. Context Creation          5. Event Subscription             │
│  ┌────────────────────┐       ┌────────────────────────┐       │
│  │ Create module      │──────▶│ Subscribe to events    │       │
│  │ context per module │       │ defined in manifest    │       │
│  └────────────────────┘       └────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## How Module Activation Works

### Database Schema

Module activation state is stored in the database:

```sql
CREATE TABLE settings_external_modules (
    id TEXT PRIMARY KEY,           -- Module ID (e.g., "product-owner")
    name TEXT NOT NULL,            -- Display name
    status TEXT NOT NULL           -- 'active', 'disabled', 'error', 'installing'
        DEFAULT 'disabled',
    version TEXT,                  -- Installed version
    installed_at INTEGER,          -- Installation timestamp
    last_error TEXT,               -- Last error message (if status='error')
    config TEXT,                   -- JSON configuration override
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_modules_status ON settings_external_modules(status);
```

### Status Values

| Status        | Description              | Routes Loaded? | Event Handlers? |
| ------------- | ------------------------ | -------------- | --------------- |
| `active`      | Module is fully enabled  | Yes            | Yes             |
| `disabled`    | Module is turned off     | No             | No              |
| `error`       | Module failed to load    | No             | No              |
| `error_build` | Build/compile error      | No             | No              |
| `installing`  | Installation in progress | No             | No              |

### Activation Flow

```typescript
// apps/web/src/hooks.server.ts

import { discoverModules } from '$lib/server/modules/loader';
import { getActiveModuleIds } from '$lib/server/db/queries/modules';
import { createModuleContexts } from '$lib/server/modules/context';

export async function handle({ event, resolve }) {
	// 1. Get active module IDs from database
	const activeModuleIds = await getActiveModuleIds(event.locals.db);

	// 2. Discover all available modules
	const allModules = await discoverModules();

	// 3. Filter to active modules
	const activeModules = allModules.filter((m) => activeModuleIds.includes(m.id));

	// 4. Create contexts for active modules
	event.locals.modules = await createModuleContexts(activeModules);

	// 5. Continue with request handling
	return resolve(event);
}
```

## modules.config.ts Format

The `modules.config.ts` file defines module activation defaults and environment overrides:

```typescript
// apps/web/modules.config.ts

import type { ModulesConfig } from '@molos/core/types';

export const modulesConfig: ModulesConfig = {
	// Default activation mode
	// 'all' - All discovered modules are active by default
	// 'none' - No modules are active by default
	// 'explicit' - Only modules listed in 'modules' are active
	mode: 'explicit',

	// Explicitly enabled modules (used when mode='explicit')
	modules: {
		// Core module - always active
		core: {
			enabled: true,
			required: true // Cannot be disabled
		},

		// Product Owner module
		'product-owner': {
			enabled: true,
			required: false,
			dependencies: ['core']
		},

		// Tasks module - conditionally enabled
		tasks: {
			enabled: process.env.ENABLE_TASKS === 'true',
			required: false
		},

		// Experimental module - off by default
		'experimental-features': {
			enabled: false,
			required: false
		}
	},

	// Environment-based overrides
	environments: {
		development: {
			mode: 'all', // Enable all modules in development
			modules: {
				'debug-tools': { enabled: true }
			}
		},

		production: {
			mode: 'explicit',
			modules: {
				'debug-tools': { enabled: false }
			}
		},

		test: {
			mode: 'none' // No modules in test environment
		}
	}
};

export default modulesConfig;
```

### Configuration Options

```typescript
interface ModuleActivationConfig {
	// Whether the module is enabled
	enabled: boolean;

	// If true, module cannot be disabled at runtime
	required?: boolean;

	// Module dependencies (must be enabled for this module to work)
	dependencies?: string[];

	// Environment-specific overrides
	environments?: Record<string, Partial<ModuleActivationConfig>>;

	// Custom configuration passed to the module
	config?: Record<string, unknown>;
}
```

## Environment-Based Configuration

### Using Environment Variables

```typescript
// modules.config.ts

export const modulesConfig: ModulesConfig = {
	mode: 'explicit',
	modules: {
		'product-owner': {
			enabled: true
		},

		// Enable based on environment variable
		analytics: {
			enabled: process.env.MOLOS_ENABLE_ANALYTICS === 'true',
			config: {
				trackingId: process.env.ANALYTICS_TRACKING_ID
			}
		},

		// Feature flag integration
		'experimental-ai': {
			enabled: process.env.MOLOS_FEATURE_FLAGS?.includes('experimental-ai') ?? false
		}
	}
};
```

### Environment-Specific Files

```
apps/web/
├── modules.config.ts           # Base configuration
├── modules.config.development.ts  # Development overrides
├── modules.config.production.ts   # Production overrides
└── modules.config.test.ts         # Test configuration
```

```typescript
// apps/web/modules.config.production.ts

import { modulesConfig as baseConfig } from './modules.config';

export const modulesConfig = {
	...baseConfig,
	mode: 'explicit',
	modules: {
		...baseConfig.modules,
		'debug-tools': { enabled: false },
		'performance-monitoring': { enabled: true }
	}
};
```

## Runtime Module Toggling

### Enable a Module

```typescript
// src/routes/api/admin/modules/[id]/enable/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleRegistry } from '$lib/server/modules/registry';

export const POST: RequestHandler = async ({ params, locals }) => {
	const moduleId = params.id;

	// 1. Check if module exists
	const module = await moduleRegistry.getModule(moduleId);
	if (!module) {
		return json({ error: 'Module not found' }, { status: 404 });
	}

	// 2. Check dependencies
	const missingDeps = await moduleRegistry.checkDependencies(moduleId);
	if (missingDeps.length > 0) {
		return json(
			{
				error: 'Missing dependencies',
				missing: missingDeps
			},
			{ status: 400 }
		);
	}

	// 3. Update database
	await locals.db
		.update(settingsExternalModules)
		.set({ status: 'active', updatedAt: Date.now() })
		.where(eq(settingsExternalModules.id, moduleId));

	// 4. Load module
	await moduleRegistry.loadModule(moduleId);

	return json({ success: true, module: moduleId });
};
```

### Disable a Module

```typescript
// src/routes/api/admin/modules/[id]/disable/+server.ts

export const POST: RequestHandler = async ({ params, locals }) => {
	const moduleId = params.id;

	// 1. Check if module is required
	const module = await moduleRegistry.getModule(moduleId);
	if (module?.required) {
		return json({ error: 'Cannot disable required module' }, { status: 400 });
	}

	// 2. Check if other modules depend on it
	const dependents = await moduleRegistry.getDependents(moduleId);
	if (dependents.length > 0) {
		return json(
			{
				error: 'Other modules depend on this module',
				dependents
			},
			{ status: 400 }
		);
	}

	// 3. Unload module
	await moduleRegistry.unloadModule(moduleId);

	// 4. Update database
	await locals.db
		.update(settingsExternalModules)
		.set({ status: 'disabled', updatedAt: Date.now() })
		.where(eq(settingsExternalModules.id, moduleId));

	return json({ success: true, module: moduleId });
};
```

### Module Registry

```typescript
// apps/web/src/lib/server/modules/registry.ts

import { getEventBus } from './events/bus';

export class ModuleRegistry {
	private modules = new Map<string, ModuleInstance>();
	private eventBus = getEventBus();

	async loadModule(moduleId: string): Promise<void> {
		const manifest = await this.loadManifest(moduleId);
		const definition = await this.loadDefinition(moduleId);

		// Create module context
		const context = createModuleContext(moduleId, this.eventBus);

		// Call onEnable hook
		if (definition?.onEnable) {
			await definition.onEnable(context);
		}

		// Register event handlers
		if (manifest.capabilities?.events?.subscribes) {
			for (const eventType of manifest.capabilities.events.subscribes) {
				context.events.subscribe(eventType, async (event) => {
					await definition?.onEvent?.(event);
				});
			}
		}

		this.modules.set(moduleId, {
			id: moduleId,
			manifest,
			definition,
			context,
			status: 'active'
		});
	}

	async unloadModule(moduleId: string): Promise<void> {
		const instance = this.modules.get(moduleId);
		if (!instance) return;

		// Call onDisable hook
		if (instance.definition?.onDisable) {
			await instance.definition.onDisable(instance.context);
		}

		// Unsubscribe from events
		this.eventBus.unsubscribeAll(moduleId);

		this.modules.delete(moduleId);
	}

	getActiveModules(): ModuleInstance[] {
		return Array.from(this.modules.values()).filter((m) => m.status === 'active');
	}

	async checkDependencies(moduleId: string): Promise<string[]> {
		const manifest = await this.loadManifest(moduleId);
		const missing: string[] = [];

		for (const dep of manifest.dependencies ?? []) {
			if (!dep.optional && !this.modules.has(dep.id)) {
				missing.push(dep.id);
			}
		}

		return missing;
	}

	async getDependents(moduleId: string): Promise<string[]> {
		const dependents: string[] = [];

		for (const [id, instance] of this.modules) {
			const deps = instance.manifest.dependencies ?? [];
			if (deps.some((d) => d.id === moduleId && !d.optional)) {
				dependents.push(id);
			}
		}

		return dependents;
	}
}

export const moduleRegistry = new ModuleRegistry();
```

## UI for Module Management

### Module List Page

```svelte
<!-- src/routes/ui/settings/modules/+page.svelte -->

<script lang="ts">
	import { onMount } from 'svelte';
	import { Card, Button, Badge, Switch } from '@molos/ui';
	import type { ModuleInfo } from '@molos/core/types';

	let modules: ModuleInfo[] = $state([]);
	let loading = $state(true);

	onMount(async () => {
		const response = await fetch('/api/admin/modules');
		modules = await response.json();
		loading = false;
	});

	async function toggleModule(moduleId: string, enabled: boolean) {
		const action = enabled ? 'enable' : 'disable';
		const response = await fetch(`/api/admin/modules/${moduleId}/${action}`, {
			method: 'POST'
		});

		if (response.ok) {
			modules = modules.map((m) => (m.id === moduleId ? { ...m, enabled } : m));
		}
	}
</script>

{#if loading}
	<p>Loading modules...</p>
{:else}
	<div class="module-list">
		{#each modules as module (module.id)}
			<Card>
				<div class="module-header">
					<h3>{module.name}</h3>
					<Badge variant={module.enabled ? 'success' : 'secondary'}>
						{module.enabled ? 'Active' : 'Disabled'}
					</Badge>
				</div>

				<p class="description">{module.description}</p>

				<div class="module-meta">
					<span>Version: {module.version}</span>
					<span>Author: {module.author}</span>
				</div>

				{#if module.status === 'error'}
					<div class="error-message">
						<p>Error: {module.lastError}</p>
					</div>
				{/if}

				<div class="module-actions">
					<Switch
						checked={module.enabled}
						disabled={module.required}
						onchange={(e) => toggleModule(module.id, e.target.checked)}
					/>

					{#if !module.required}
						<Button variant="outline" size="sm" href="/ui/settings/modules/{module.id}">
							Configure
						</Button>
					{/if}
				</div>
			</Card>
		{/each}
	</div>
{/if}

<style>
	.module-list {
		display: grid;
		gap: 1rem;
	}

	.module-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.module-meta {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
		color: var(--muted);
	}

	.module-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 1rem;
	}

	.error-message {
		padding: 0.5rem;
		background: var(--destructive-soft);
		border-radius: 0.25rem;
		margin-top: 0.5rem;
	}
</style>
```

### Module Detail Page

```svelte
<!-- src/routes/ui/settings/modules/[id]/+page.svelte -->

<script lang="ts">
	import { page } from '$app/stores';
	import { Card, Button, Tabs, Tab } from '@molos/ui';

	$: moduleId = $page.params.id;

	// Load module details
	let module = $state(null);
	let config = $state({});

	onMount(async () => {
		const response = await fetch(`/api/admin/modules/${moduleId}`);
		module = await response.json();
		config = module.config ?? {};
	});

	async function saveConfig() {
		await fetch(`/api/admin/modules/${moduleId}/config`, {
			method: 'PUT',
			body: JSON.stringify(config)
		});
	}
</script>

{#if module}
	<h1>{module.name}</h1>

	<Tabs>
		<Tab label="Overview">
			<Card>
				<h3>Module Information</h3>
				<dl>
					<dt>ID</dt>
					<dd>{module.id}</dd>

					<dt>Version</dt>
					<dd>{module.version}</dd>

					<dt>Status</dt>
					<dd>{module.status}</dd>
				</dl>
			</Card>

			<Card>
				<h3>Capabilities</h3>
				<ul>
					{#each Object.entries(module.capabilities ?? {}) as [key, value]}
						<li><strong>{key}:</strong> {JSON.stringify(value)}</li>
					{/each}
				</ul>
			</Card>
		</Tab>

		<Tab label="Configuration">
			<Card>
				<h3>Module Configuration</h3>
				<!-- Module-specific configuration form -->
				<form
					onsubmit={(e) => {
						e.preventDefault();
						saveConfig();
					}}
				>
					<!-- Render config fields based on module schema -->
					<Button type="submit">Save Configuration</Button>
				</form>
			</Card>
		</Tab>

		<Tab label="Events">
			<Card>
				<h3>Published Events</h3>
				<ul>
					{#each module.capabilities?.events?.publishes ?? [] as eventType}
						<li>{eventType}</li>
					{/each}
				</ul>

				<h3>Subscribed Events</h3>
				<ul>
					{#each module.capabilities?.events?.subscribes ?? [] as eventType}
						<li>{eventType}</li>
					{/each}
				</ul>
			</Card>
		</Tab>

		<Tab label="Logs">
			<Card>
				<!-- Module logs viewer -->
			</Card>
		</Tab>
	</Tabs>
{/if}
```

## Disabling Modules Safely

### Pre-Disable Checks

```typescript
// src/lib/server/modules/safety.ts

export async function canDisableModule(moduleId: string): Promise<{
	canDisable: boolean;
	reasons: string[];
	warnings: string[];
}> {
	const reasons: string[] = [];
	const warnings: string[] = [];

	const module = await moduleRegistry.getModule(moduleId);

	// 1. Check if module is required
	if (module?.required) {
		reasons.push('Module is marked as required and cannot be disabled');
	}

	// 2. Check for dependent modules
	const dependents = await moduleRegistry.getDependents(moduleId);
	if (dependents.length > 0) {
		reasons.push(`Modules depend on this: ${dependents.join(', ')}`);
	}

	// 3. Check for pending operations
	if (module?.hasPendingOperations) {
		warnings.push('Module has pending operations that will be cancelled');
	}

	// 4. Check for unsaved data
	if (module?.hasUnsavedData) {
		warnings.push('Module has unsaved data that may be lost');
	}

	return {
		canDisable: reasons.length === 0,
		reasons,
		warnings
	};
}
```

### Graceful Shutdown

```typescript
// src/lib/server/modules/registry.ts

async unloadModule(moduleId: string): Promise<void> {
  const instance = this.modules.get(moduleId);
  if (!instance) return;

  // 1. Stop accepting new requests
  instance.status = 'shutting_down';

  // 2. Wait for pending operations (with timeout)
  await Promise.race([
    instance.waitForPendingOperations(),
    sleep(5000)  // 5 second timeout
  ]);

  // 3. Call onDisable hook
  if (instance.definition?.onDisable) {
    try {
      await instance.definition.onDisable(instance.context);
    } catch (error) {
      console.error(`Error in onDisable hook for ${moduleId}:`, error);
    }
  }

  // 4. Unsubscribe from events
  this.eventBus.unsubscribeAll(moduleId);

  // 5. Remove from registry
  this.modules.delete(moduleId);
}
```

## Error Recovery

### Automatic Recovery

```typescript
// apps/web/src/lib/server/modules/recovery.ts

export async function recoverFailedModules(): Promise<void> {
	const failedModules = await db
		.select()
		.from(settingsExternalModules)
		.where(eq(settingsExternalModules.status, 'error'));

	for (const module of failedModules) {
		console.log(`Attempting to recover module: ${module.id}`);

		try {
			// Try to reload the module
			await moduleRegistry.loadModule(module.id);

			// Update status
			await db
				.update(settingsExternalModules)
				.set({ status: 'active', lastError: null })
				.where(eq(settingsExternalModules.id, module.id));

			console.log(`Successfully recovered module: ${module.id}`);
		} catch (error) {
			console.error(`Failed to recover module ${module.id}:`, error);
		}
	}
}
```

### Error Handling in Vite

The `moduleBuildErrorHandler` plugin in `vite.config.ts` catches build errors:

```typescript
function moduleBuildErrorHandler(): Plugin {
	return {
		name: 'module-build-error-handler',
		enforce: 'pre',

		buildEnd(error) {
			if (!error) return;

			const errorMessage = error.message || String(error);
			const moduleId = extractModuleIdFromErrorPath(errorMessage);

			if (moduleId) {
				console.error(`Build error in module ${moduleId}:`, errorMessage);

				// Mark module as failed in database
				markModuleBuildErrorSync(moduleId, errorMessage);

				// Remove symlinks to prevent recurrence
				unlinkModule(moduleId);
			}
		}
	};
}
```

## Next Steps

- Learn about [Module Interaction](./05-module-interaction.md)
- See [Deployment](./06-deployment.md) for production configurations

---

_Last Updated: 2025-02-15_
_Version: 1.0_
