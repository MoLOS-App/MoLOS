# Developing External Modules for MoLOS

MoLOS supports a modular architecture where you can develop features in a separate git repository and install them into any MoLOS instance.

A sample module can be found at the [https://github.com/MoLOS-App/MoLOS-sample-module](MoLOS Sample Module Git).

## Module Structure

An external module must follow this directory structure:

```text
my-cool-module/
├── manifest.yaml          # Metadata (Required)
├── config.ts              # Navigation & Icon config (Required)
├── lib/                   # Module logic (Components, Repos, Models)
├── routes/                # SvelteKit routes
│   ├── api/               # API endpoints (+server.ts)
│   └── ui/                # UI pages (+page.svelte)
└── drizzle/               # Database migrations (.sql files)
```

### 1. `manifest.yaml`

Defines the module metadata.

```yaml
id: 'my-analytics' # Must match the git repo name
name: 'Advanced Analytics'
version: '1.0.0'
description: 'Adds charts and insights to your dashboard'
author: 'Jane Doe'
icon: 'BarChart3' # Lucide icon name
```

### 2. `config.ts`

Standard MoLOS module configuration.

```typescript
import { BarChart3 } from 'lucide-svelte';
import type { ModuleConfig } from '$lib/config/modules/types';

export const moduleConfig: ModuleConfig = {
	id: 'my-analytics',
	name: 'Analytics',
	description: 'Advanced data visualization',
	href: '/ui/my-analytics',
	icon: BarChart3,
	navigation: [{ name: 'Dashboard', icon: BarChart3, href: '/ui/my-analytics/dashboard' }]
};
```

### 3. Database Migrations

Place your `.sql` files in the `drizzle/` folder.
**CRITICAL RULE**: All tables created by your module MUST be prefixed with your module ID to avoid collisions.

Example `drizzle/0001_init.sql`:

```sql
CREATE TABLE IF NOT EXISTS my_analytics_reports (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    data JSON,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

## Installation Workflow

1.  **Clone**: User enters your git URL in the MoLOS Settings.
2.  **Restart**: The user restarts the MoLOS server.
3.  **Initialize**: On boot, MoLOS:
    - Validates your `manifest.yaml`.
    - Runs your SQL migrations.
    - Symlinks your `routes/` and `lib/` into the main application.
4.  **Activate**: Your module appears in the sidebar!

## Best Practices

- **Isolation**: Never try to modify tables belonging to other modules.
- **Paths**: Use `$lib/` aliases for shared MoLOS utilities, but keep your module-specific logic inside your own `lib/` folder.
- **Error Handling**: If your migration fails, MoLOS will deactivate your module and show the error in the settings page.
- **Testing**: When running tests, ensure `node_modules` folders are excluded to avoid running dependency test files. Configure your test runner (e.g., Vitest) with `exclude: ['**/node_modules/**']` in the test configuration.
