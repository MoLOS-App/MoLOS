# Module Development Guide

Complete guide for developing MoLOS modules.

## Module Types

### Internal Modules

- Always loaded, cannot be filtered
- Examples: `dashboard`, `ai`
- Location: `modules/ai/` or `src/lib/config/dashboard/`

### External Modules

- Installable from GitHub/npm
- Examples: `MoLOS-Tasks`, `MoLOS-Finance`
- Developed in `modules/`, published to separate repos

## Creating a New Module

### Step 1: Create Directory Structure

```bash
cd MoLOS/modules
mkdir my-module
cd my-module

mkdir -p src/{routes/{ui,api},server/{db/schema,repositories,ai},models,lib/components,stores}
touch src/index.ts
touch src/config.ts
touch src/server/db/schema/index.ts
touch src/server/db/schema/tables.ts
touch src/models/index.ts
touch src/stores/index.ts
touch src/server/repositories/base-repository.ts
touch src/server/ai/ai-tools.ts
touch package.json
touch drizzle.config.ts
```

### Step 2: Create package.json

```json
{
	"name": "@molos/module-my-module",
	"version": "1.0.0",
	"type": "module",
	"description": "My Module Description",
	"main": "./src/index.ts",
	"exports": {
		".": "./src/index.ts",
		"./config": "./src/config.ts",
		"./models": "./src/models/index.ts",
		"./ai": "./src/server/ai/ai-tools.ts"
	},
	"files": ["src", "manifest.yaml", "drizzle"],
	"peerDependencies": {
		"svelte": "^5.45.0"
	},
	"dependencies": {
		"lucide-svelte": "^0.561.0",
		"zod": "^3.0.0"
	}
}
```

### Step 3: Create Config (REQUIRED)

```typescript
// src/config.ts
import { MyIcon } from 'lucide-svelte';
import type { ModuleConfig } from '$lib/config/types';

export const myModuleConfig: ModuleConfig = {
	// External modules: MoLOS-{Name}
	// Internal modules: lowercase
	id: 'MoLOS-MyModule',

	name: 'My Module',
	href: '/ui/MoLOS-MyModule',
	icon: MyIcon,
	description: 'Description of my module',

	navigation: [
		{
			name: 'Dashboard',
			icon: MyIcon,
			href: '/ui/MoLOS-MyModule/dashboard'
		}
	]
};

export default myModuleConfig;
```

### Step 4: Create Database Schema

```typescript
// src/server/db/schema/tables.ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { textEnum } from '@molos/database/utils';
import { MyStatus } from '../../../models/index.js';

// Table names MUST be prefixed with module ID
export const myModuleItems = sqliteTable('MoLOS-MyModule_items', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id'),
	name: text('name').notNull(),
	status: textEnum('status', MyStatus).default('active'),
	createdAt: integer('created_at').default(sql`(strftime('%s','now'))`),
	updatedAt: integer('updated_at').default(sql`(strftime('%s','now'))`)
});
```

```typescript
// src/server/db/schema/index.ts
export * from './tables.js';
```

### Step 5: Create Models

```typescript
// src/models/index.ts
export const MyStatus = {
	ACTIVE: 'active',
	INACTIVE: 'inactive'
} as const;

export type MyStatusType = (typeof MyStatus)[keyof typeof MyStatus];
```

### Step 6: Create Drizzle Config

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/server/db/schema/tables.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: { url: 'file:../../molos.db' },
	verbose: true,
	strict: true
});
```

### Step 7: Create Routes

```svelte
<!-- src/routes/ui/+layout.svelte -->
<script lang="ts">
	let { children } = $props();
</script>

<div class="module-layout">
	<nav>
		<a href="/ui/MoLOS-MyModule/dashboard">Dashboard</a>
	</nav>
	<main>
		{@render children()}
	</main>
</div>
```

```svelte
<!-- src/routes/ui/dashboard/+page.svelte -->
<script lang="ts">
	let { data } = $props();
</script>

<h1>Dashboard</h1>
```

```typescript
// src/routes/ui/dashboard/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const response = await fetch('/api/MoLOS-MyModule/items');
	const items = await response.json();
	return { items };
};
```

### Step 8: Create API Routes

```typescript
// src/routes/api/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { myModuleItems } from '../server/database/schema.js';

export const GET: RequestHandler = async () => {
	const items = await db.select().from(myModuleItems);
	return json(items);
};

export const POST: RequestHandler = async ({ request }) => {
	const data = await request.json();
	const result = await db.insert(myModuleItems).values(data).returning();
	return json(result[0]);
};
```

## Import Rules (CRITICAL)

### From Main App

```typescript
// ✅ ALWAYS use $lib alias
import { db } from '$lib/server/db';
import { Button } from '$lib/components/ui/button';

// ❌ NEVER use relative paths (breaks in node_modules)
import { db } from '../../../../../src/lib/server/db';
```

### Within Module

```typescript
// Use relative paths with .js extension
import { MyRepository } from '../server/repositories/my-repository.js';
import { MyStatus } from '../../models/index.js';
import { myModuleItems } from '../server/db/schema.js';
```

## Generate Migrations

```bash
# From module directory
cd modules/my-module

# Generate migration
npx drizzle-kit generate

# Apply migration
npx drizzle-kit migrate
```

## Test in Main App

```bash
# Add as workspace dependency
# In MoLOS/package.json:
# "@molos/module-my-module": "workspace:*"

bun install
bun run module:sync
bun run dev
```

## Publish to GitHub

```bash
# Create repo in MoLOS-org
cd ../../..  # MoLOS-org root
mkdir MoLOS-MyModule
cd MoLOS-MyModule
git init

# Copy files
cp -r ../MoLOS/modules/my-module/* .

# Push
git add .
git commit -m "Initial module"
git remote add origin https://github.com/MoLOS-App/MoLOS-MyModule.git
git push -u origin main
```

## Development Checklist

- [ ] `src/config.ts` with correct module ID (`MoLOS-{Name}` for external)
- [ ] `package.json` with `@molos/module-{name}` and exports
- [ ] `drizzle.config.ts` for migrations
- [ ] Database tables prefixed with module ID
- [ ] Routes under `/ui/{ModuleID}/`
- [ ] API routes under `/api/{ModuleID}/`
- [ ] All imports use `$lib` alias (not relative paths to main app)
- [ ] TypeScript imports use `.js` extension
