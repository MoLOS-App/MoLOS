# 7. Module Configuration

This section describes how to configure and register your module within the MoLOS application. Module configuration typically involves defining navigation items and registering the module in a central registry. Configuration files are usually located in `src/lib/config/modules/{module-name}/config.ts`.

## Configuration Structure

Each module's configuration file should export an object that defines its properties, such as its name, icon, and navigation items.

### Example: Tasks Module - `src/lib/config/modules/tasks/config.ts`

```typescript
import { BookText, LayoutDashboard, ListTodo, Settings, Users } from 'lucide-svelte';
import type { ModuleConfig } from '../types';

export const tasksModuleConfig: ModuleConfig = {
	name: 'Tasks',
	id: 'tasks',
	icon: ListTodo,
	color: '#4CAF50', // Example color
	navigation: [
		{
			id: 'dashboard',
			title: 'Dashboard',
			href: '/ui/MoLOS-Tasks/dashboard',
			icon: LayoutDashboard
		},
		{
			id: 'my-tasks',
			title: 'My Tasks',
			href: '/ui/MoLOS-Tasks/my',
			icon: Users // Using Users as an example, replace with appropriate icon
		},
		{
			id: 'projects',
			title: 'Projects',
			href: '/ui/MoLOS-Tasks/projects',
			icon: BookText // Using BookText as an example, replace with appropriate icon
		},
		{
			id: 'areas',
			title: 'Areas',
			href: '/ui/MoLOS-Tasks/areas',
			icon: BookText // Using BookText as an example, replace with appropriate icon
		},
		{
			id: 'daily-log',
			title: 'Daily Log',
			href: '/ui/MoLOS-Tasks/daily-log',
			icon: BookText // Using BookText as an example, replace with appropriate icon
		},
		{
			id: 'settings',
			title: 'Settings',
			href: '/ui/MoLOS-Tasks/settings',
			icon: Settings
		}
	]
};
```

## Navigation Definition

The `navigation` array within the module configuration defines the menu items that will be displayed for the module. Each item should have an `id`, `title`, `href`, and `icon`.

## Registration in Module Registry

Modules need to be registered in a central module registry so the application can discover and display them. This typically involves adding the module's configuration object to an array of all module configurations.

### Example: `src/lib/config/modules/index.ts` (Conceptual)

```typescript
import { tasksModuleConfig } from './tasks/config';
import { financeModuleConfig } from './finance/config';
// ... import other module configs

export const modules = [
	tasksModuleConfig,
	financeModuleConfig,
	// ... other module configs
];
```

## Configuration Patterns

- **Centralized Registry**: Maintain a single point of truth for all module registrations.
- **Type Safety**: Use TypeScript interfaces (e.g., `ModuleConfig`) to ensure consistency and type safety across all module configurations.
- **Extensibility**: Design the configuration structure to be easily extensible for future module properties.
