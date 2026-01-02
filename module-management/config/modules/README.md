# Module Configuration Directory

This directory contains standardized configurations for all application modules, following a consistent pattern for easy discovery, maintenance, and extensibility.

## Quick Navigation

- **[Parent Directory](../README.md)** - Configuration overview
- **[Layout Configuration](../LAYOUT_GUIDE.md)** - Layout customization guide
- **[Modules Structure](../../../../../../../MODULES_STRUCTURE.md)** - Module organization patterns
- **[Modules Configuration](../../../../../../../MODULES_CONFIGURATION.md)** - Configuration system details

## Directory Structure

```
src/lib/config/modules/
├── types.ts                    # Shared TypeScript interfaces
├── index.ts                    # Module registry and helper functions
├── README.md                   # This file
├── dashboard/
│   └── config.ts              # Dashboard module configuration
└── tasks/
    └── config.ts              # Tasks module configuration
```

## File Reference

### `types.ts`

Defines shared TypeScript interfaces used across all modules:

- `ModuleConfig` - Main module configuration interface
- `NavItem` - Navigation item interface

### `index.ts`

Central registry and helper functions:

- `MODULE_REGISTRY` - Record of all module configurations
- `getAllModules()` - Get all modules
- `getModuleById(id)` - Get module by ID
- `getModuleByPath(href)` - Get module by route path
- `getModuleNavigation(id)` - Get navigation items for a module

### Module Config Files

Each module folder contains `config.ts` with:

- Module ID, name, icon, and route
- Navigation items (subroutes)
- Module description

## Step-by-Step: Adding a New Module

### Step 1: Create Module Folder

```bash
mkdir src/lib/config/modules/your-module-name
```

Use kebab-case (lowercase with hyphens) for consistency.

### Step 2: Create Configuration File

Create `src/lib/config/modules/your-module-name/config.ts`:

```typescript
/**
 * Your Module Configuration
 * Defines routes, navigation items, and metadata for the Your Module
 */

import { FolderOpen, BarChart, Settings, Plus } from 'lucide-svelte';
import type { ModuleConfig } from '../types';

export const yourModuleConfig: ModuleConfig = {
	// Unique identifier (used in routes and lookups)
	id: 'your-module',

	// Display name shown in UI
	name: 'Your Module',

	// Base route path for this module
	href: '/ui/your-module',

	// Icon shown in sidebar (lucide-svelte)
	icon: FolderOpen,

	// Optional: Short description of the module
	description: 'Brief description of what this module does',

	// Navigation items (subroutes) within this module
	navigation: [
		{
			name: 'Overview',
			icon: FolderOpen,
			href: '/ui/your-module/overview'
		},
		{
			name: 'Analytics',
			icon: BarChart,
			href: '/ui/your-module/analytics',
			badge: 5 // Optional: Shows a badge with this number
		},
		{
			name: 'Add New',
			icon: Plus,
			href: '/ui/your-module/new'
		},
		{
			name: 'Settings',
			icon: Settings,
			href: '/ui/your-module/settings',
			disabled: false // Optional: Disable navigation item
		}
	]
};
```

### Step 3: Register in Module Registry

Update `src/lib/config/modules/index.ts`:

```typescript
// 1. Add import at the top
import { yourModuleConfig } from './your-module-name/config';

// 2. Add to MODULE_REGISTRY
export const MODULE_REGISTRY: Record<string, ModuleConfig> = {
	dashboard: dashboardConfig,
	tasks: tasksConfig,
	'your-module': yourModuleConfig // ← Add this line
};

// 3. Update getAvailableModules() if used
```

### Step 4: Create SvelteKit Routes

Create the following folder structure:

```
src/routes/ui/(modules)/your-module-name/
├── +layout.svelte              # Module layout (optional)
├── +page.svelte                # Default page (e.g., redirect)
├── overview/
│   └── +page.svelte
├── analytics/
│   └── +page.svelte
├── new/
│   └── +page.svelte
└── settings/
    └── +page.svelte
```

### Step 5: Create Optional Database Tables

If your module needs database tables, create them following the schema pattern:

```bash
mkdir src/lib/server/db/schema/your-module-name
```

See [src/lib/server/db/schema/IMPLEMENTATION_GUIDE.md](../../server/db/schema/IMPLEMENTATION_GUIDE.md) for details.

### Step 6: Done!

Your module will automatically appear in the sidebar with its navigation items. No manual registration in other files needed.

## Module Configuration Interface

```typescript
/**
 * Configuration for an application module
 */
interface ModuleConfig {
	// Unique identifier used for lookups
	// Format: lowercase, hyphenated (e.g., 'my-module')
	id: string;

	// Display name shown in UI
	name: string;

	// Base route path for the module
	// Format: /ui/{module-name}
	href: string;

	// Icon component from lucide-svelte
	// Used in sidebar and navigation
	icon: any;

	// Optional: Short description (shown in tooltips)
	description?: string;

	// Array of navigation items (subroutes)
	navigation: NavItem[];
}

/**
 * Navigation item within a module
 */
interface NavItem {
	// Display name
	name: string;

	// Icon component from lucide-svelte
	icon: any;

	// Optional: Route path for this item
	// If not provided, item won't be clickable
	href?: string;

	// Optional: Number badge (e.g., task count)
	badge?: number;

	// Optional: Disable this navigation item
	disabled?: boolean;
}
```

## Helper Functions

All helper functions are exported from `index.ts`:

```typescript
import {
	getAllModules,
	getModuleById,
	getModuleByPath,
	getModuleNavigation,
	MODULE_REGISTRY
} from '$lib/config/modules';

// Get all module configurations
const modules = getAllModules();
modules.forEach((mod) => console.log(mod.name));

// Get specific module
const config = getModuleById('tasks');
console.log(config.navigation); // Get subroutes

// Get module by route
const current = getModuleByPath('/ui/MoLOS-Tasks/all');

// Get navigation items for a module
const items = getModuleNavigation('dashboard');

// Direct access to registry
const dashConfig = MODULE_REGISTRY['dashboard'];
```

## Using Module Configuration in Components

### In Layout Component

```svelte
<script lang="ts">
	import { getAllModules } from '$lib/config/modules';

	const modules = getAllModules();
</script>

<div class="sidebar">
	{#each modules as module (module.id)}
		<a href={module.href}>
			<svelte:component this={module.icon} />
			<span>{module.name}</span>
		</a>
	{/each}
</div>
```

### In Page Component

```svelte
<script lang="ts">
	import { getModuleById } from '$lib/config/modules';

	const module = getModuleById('tasks');
</script>

<nav class="module-nav">
	{#each module.navigation as item (item.name)}
		<a href={item.href} class:disabled={item.disabled}>
			<svelte:component this={item.icon} />
			<span>{item.name}</span>
			{#if item.badge}
				<span class="badge">{item.badge}</span>
			{/if}
		</a>
	{/each}
</nav>
```

## Current Modules

### Dashboard

- **ID**: `dashboard`
- **Path**: `/ui/dashboard`
- **Config**: [config.ts](./dashboard/config.ts)
- **Navigation**:
  - Overview
  - Analytics
  - Reports
  - Trends

### Tasks

- **ID**: `tasks`
- **Path**: `/ui/MoLOS-Tasks`
- **Config**: [config.ts](./tasks/config.ts)
- **Database Tables**: `tasks_tasks`
- **Navigation**:
  - All Tasks
  - My Tasks
  - Completed
  - Scheduled

## Naming Conventions

| Item              | Convention               | Example                                |
| ----------------- | ------------------------ | -------------------------------------- |
| **Module ID**     | lowercase, hyphenated    | `my-module`, `project-tools`           |
| **Module Name**   | Title Case               | `My Module`, `Project Tools`           |
| **Route Path**    | `/ui/{id}`               | `/ui/my-module`, `/ui/project-tools`   |
| **Folder Name**   | kebab-case               | `my-module`, `project-tools`           |
| **Config Export** | `{id}Config` (camelCase) | `myModuleConfig`, `projectToolsConfig` |
| **File Name**     | `config.ts`              | Always `config.ts`                     |

## Best Practices

### ✅ Do

- Use kebab-case for folder and ID names
- Keep module names short and descriptive
- Group related navigation items together
- Use appropriate icons from lucide-svelte
- Add descriptions to modules
- Add badges for dynamic counts (tasks, notifications)
- Keep navigation items focused and relevant

### ❌ Don't

- Mix naming conventions (camelCase, snake_case, etc.)
- Create modules for single pages
- Add too many navigation items (5-6 is typical)
- Use non-standard icon libraries
- Forget to update the registry
- Create nested modules (flat structure only)

## Examples from Existing Modules

### Simple Module (Dashboard)

See [dashboard/config.ts](./dashboard/config.ts) for a straightforward module with multiple navigation items.

### Module with Database (Tasks)

See [tasks/config.ts](./tasks/config.ts) for a module that integrates with database tables.

## Advanced: Dynamic Navigation

You can make navigation dynamic by computing it from other data:

```typescript
import type { ModuleConfig } from '../types';

export const dynamicModuleConfig: ModuleConfig = {
	id: 'dynamic-module',
	name: 'Dynamic Module',
	href: '/ui/dynamic-module',
	icon: SomeIcon,
	navigation: [
		{ name: 'Overview', icon: OverviewIcon, href: '/ui/dynamic-module' },
		// Dynamically generate items
		...getTaskStatusItems(), // Custom function
		...getProjectCategories() // Custom function
	]
};

function getTaskStatusItems() {
	return ['pending', 'active', 'completed'].map((status) => ({
		name: `${status} Tasks`,
		icon: getIconForStatus(status),
		href: `/ui/dynamic-module/${status}`,
		badge: getCountForStatus(status)
	}));
}
```

## Troubleshooting

### Module doesn't appear in sidebar

- Check if module is registered in `index.ts`
- Verify module ID and path are correct
- Clear `.svelte-kit/generated` cache
- Rebuild with `npm run build`

### Navigation items not showing

- Verify navigation array is populated
- Check href values match your routes
- Ensure routes exist in `src/routes/ui/(modules)/`

### Icons not displaying

- Verify icons are imported from `lucide-svelte`
- Check icon names are correct
- Make sure lucide-svelte is installed

### Type errors

- Import `ModuleConfig` and `NavItem` types
- Verify all required fields are present
- Check types in `types.ts` for interface definitions

## Related Documentation

- **[Configuration Directory](../README.md)** - Configuration overview
- **[Layout Configuration](../LAYOUT_GUIDE.md)** - Layout customization
- **[MODULES_STRUCTURE.md](../../../../../../../MODULES_STRUCTURE.md)** - Organization patterns
- **[MODULES_CONFIGURATION.md](../../../../../../../MODULES_CONFIGURATION.md)** - System details
- **[QUICK_REFERENCE.md](../../../../../../../QUICK_REFERENCE.md)** - Common tasks
