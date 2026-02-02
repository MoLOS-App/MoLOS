import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

interface ModuleOptions {
	name: string;
	author?: string;
	description?: string;
	version?: string;
	icon?: string;
}

/**
 * Create Module Command
 * Handles the creation of new module scaffolds
 */
export class CreateCommand {
	/**
	 * Create a new module scaffold
	 */
	static async execute(moduleName: string, options: Partial<ModuleOptions> = {}): Promise<void> {
		// Validate module name
		if (!/^[a-zA-Z0-9_-]+$/.test(moduleName)) {
			console.error(
				'❌ Module name must contain only alphanumeric characters, hyphens, and underscores'
			);
			process.exit(1);
		}

		const moduleDir = path.join(process.cwd(), 'external_modules', moduleName);

		if (existsSync(moduleDir)) {
			console.error(`❌ Module directory already exists: ${moduleDir}`);
			process.exit(1);
		}

		console.log(`📦 Creating new module: ${moduleName}`);

		// Create directory structure
		const dirs = [
			'',
			'lib/components',
			'lib/models',
			'lib/repositories',
			'lib/stores',
			'lib/utils',
			'lib/server/db/schema',
			'lib/server/ai',
			'routes/ui',
			'routes/ui/dashboard',
			'routes/api',
			'drizzle'
		];

		for (const dir of dirs) {
			const dirPath = path.join(moduleDir, dir);
			mkdirSync(dirPath, { recursive: true });
		}

		// ============== CORE CONFIGURATION FILES ==============

		// Create manifest.yaml
		const manifest = `id: '${moduleName}'
name: '${options.name || this.pascalCase(moduleName)}'
version: '${options.version || '1.0.0'}'
description: '${options.description || 'A new MoLOS module'}'
author: '${options.author || 'Module Developer'}'
icon: '${options.icon || 'Zap'}'
`;

		writeFileSync(path.join(moduleDir, 'manifest.yaml'), manifest);
		console.log('  ✓ Created manifest.yaml');

		// Create config.ts
		const config = `import type { ModuleConfig } from '$lib/config/types';
import { ${options.icon || 'Zap'} } from 'lucide-svelte';

export const moduleConfig: ModuleConfig = {
	id: '${moduleName}',
	name: '${options.name || this.pascalCase(moduleName)}',
	href: '/ui/${moduleName}',
	icon: ${options.icon || 'Zap'},
	description: '${options.description || 'A new MoLOS module'}',
	navigation: [
		{
			name: 'Dashboard',
			icon: ${options.icon || 'Zap'},
			href: '/ui/${moduleName}/dashboard'
		}
	]
};

export const moduleConfigAlias = moduleConfig;
export default moduleConfig;
`;

		writeFileSync(path.join(moduleDir, 'config.ts'), config);
		console.log('  ✓ Created config.ts');

		// Create package.json
		const packageJson = {
			name: moduleName,
			version: options.version || '1.0.0',
			description: options.description || 'A new MoLOS module',
			type: 'module',
			scripts: {
				dev: 'vite dev',
				build: 'vite build',
				preview: 'vite preview',
				check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json',
				'db:generate': 'drizzle-kit generate',
				test: 'npm run test:unit -- --run',
				'test:unit': 'vitest',
				'db:push': 'drizzle-kit push',
				'db:studio': 'drizzle-kit studio'
			},
			devDependencies: {
				'@sveltejs/kit': '^2.49.2',
				svelte: '^5.46.1',
				'drizzle-kit': '^0.31.0',
				tsx: '^4.0.0',
				typescript: '^5.0.0',
				vitest: '^4.0.16'
			},
			dependencies: {
				'better-sqlite3': '^12.5.0',
				'drizzle-orm': '^0.41.0',
				'lucide-svelte': '^0.561.0',
				zod: '^4.2.1'
			}
		};

		writeFileSync(path.join(moduleDir, 'package.json'), JSON.stringify(packageJson, null, 2));
		console.log('  ✓ Created package.json');

		// ============== CONFIGURATION FILES ==============

		// Create drizzle.config.ts
		const drizzleConfig = `import type { Config } from 'drizzle-kit';

export default {
	schema: './lib/server/db/schema/tables.ts',
	out: './drizzle',
	driver: 'better-sqlite',
	dbCredentials: {
		url: '../.db/data.db'
	}
} satisfies Config;
`;

		writeFileSync(path.join(moduleDir, 'drizzle.config.ts'), drizzleConfig);
		console.log('  ✓ Created drizzle.config.ts');

		// Create svelte.config.js
		const svelteConfig = `import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		files: {
			lib: 'lib',
			routes: 'routes'
		}
	}
};

export default config;
`;

		writeFileSync(path.join(moduleDir, 'svelte.config.js'), svelteConfig);
		console.log('  ✓ Created svelte.config.js');

		// Create tsconfig.json
		const tsConfig = `{
	"extends": "../tsconfig.json",
	"compilerOptions": {
		"allowJs": true,
		"checkJs": true,
		"esModuleInterop": true,
		"forceConsistentCasingInFileNames": true,
		"resolveJsonModule": true,
		"skipLibCheck": true,
		"sourceMap": true,
		"strict": true,
		"moduleResolution": "bundler"
	},
	"include": ["lib", "routes"],
	"exclude": ["node_modules"]
}
`;

		writeFileSync(path.join(moduleDir, 'tsconfig.json'), tsConfig);
		console.log('  ✓ Created tsconfig.json');

		// Create vite.config.ts
		const viteConfig = `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()]
});
`;

		writeFileSync(path.join(moduleDir, 'vite.config.ts'), viteConfig);
		console.log('  ✓ Created vite.config.ts');

		// ============== LIB FILES ==============

		// Create lib/test-utils.ts
		const testUtils = `import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './server/db/schema/tables';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

/**
 * Creates an in-memory SQLite database for testing the ${moduleName} module with all migrations applied.
 */
export async function createTestDb() {
	const client = new Database(':memory:');
	const db = drizzle(client, { schema });

	// Apply migrations
	const migrationsPath = path.resolve('drizzle');
	migrate(db, { migrationsFolder: migrationsPath });

	return db;
}

/**
 * Helper to create a mock user for testing.
 */
export const createMockUser = (overrides = {}) => ({
	id: 'test-user-id',
	email: 'test@example.com',
	emailVerified: true,
	name: 'Test User',
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides
});
`;

		writeFileSync(path.join(moduleDir, 'lib/test-utils.ts'), testUtils);
		console.log('  ✓ Created lib/test-utils.ts');

		// Create lib/models/index.ts
		const modelsIndex = `/**
 * ${this.pascalCase(moduleName)} Module Types
 */

// Status Enums
export const ${this.camelCase(moduleName)}Status = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
	ARCHIVED: 'archived'
} as const;

export type ${this.camelCase(moduleName)}Status = (typeof ${this.camelCase(moduleName)}Status)[keyof typeof ${this.camelCase(moduleName)}Status];

// Main Entity Interface
export interface ${this.pascalCase(moduleName)}Entity {
	id: string;
	userId: string;
	name: string;
	description?: string;
	status: ${this.camelCase(moduleName)}Status;
	createdAt: number; // Unix timestamp
	updatedAt: number; // Unix timestamp
}

export type Create${this.pascalCase(moduleName)}Input = Omit<${this.pascalCase(moduleName)}Entity, 'id' | 'createdAt' | 'updatedAt'>;
export type Update${this.pascalCase(moduleName)}Input = Partial<Omit<Create${this.pascalCase(moduleName)}Input, 'userId'>>;

/**
 * AI Tool Types
 */
export interface ToolDefinition {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<string, unknown>;
		required?: string[];
	};
	execute: (params: unknown) => Promise<unknown>;
}
`;

		writeFileSync(path.join(moduleDir, 'lib/models/index.ts'), modelsIndex);
		console.log('  ✓ Created lib/models/index.ts');

		// Create lib/repositories/base-repository.ts
		const baseRepository = `import { db as defaultDb } from '../../../../../src/lib/server/db';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export abstract class BaseRepository {
	protected db: BetterSQLite3Database<any>;

	constructor(db?: BetterSQLite3Database<any>) {
		this.db = (db as BetterSQLite3Database<any>) || defaultDb;
	}
}
`;

		writeFileSync(path.join(moduleDir, 'lib/repositories/base-repository.ts'), baseRepository);
		console.log('  ✓ Created lib/repositories/base-repository.ts');

		// Create lib/repositories/${moduleName}-repository.ts
		const entityRepository = `import { eq, and } from 'drizzle-orm';
import { ${this.snakeCase(moduleName)}Entities } from '../server/db/schema/tables';
import { BaseRepository } from './base-repository';
import type { ${this.pascalCase(moduleName)}Entity, Create${this.pascalCase(moduleName)}Input, Update${this.pascalCase(moduleName)}Input } from '../models';

export class ${this.pascalCase(moduleName)}Repository extends BaseRepository {
	async getByUserId(userId: string, limit = 50): Promise<${this.pascalCase(moduleName)}Entity[]> {
		const rows = await this.db
			.select()
			.from(${this.snakeCase(moduleName)}Entities)
			.eq(${this.snakeCase(moduleName)}Entities.userId, userId)
			.limit(limit);

		return rows.map((row) => this.mapToEntity(row));
	}

	async getById(id: string, userId: string): Promise<${this.pascalCase(moduleName)}Entity | null> {
		const [row] = await this.db
			.select()
			.from(${this.snakeCase(moduleName)}Entities)
			.where(
				and(
					eq(${this.snakeCase(moduleName)}Entities.id, id),
					eq(${this.snakeCase(moduleName)}Entities.userId, userId)
				)
			);

		return row ? this.mapToEntity(row) : null;
	}

	async create(input: Create${this.pascalCase(moduleName)}Input, userId: string): Promise<${this.pascalCase(moduleName)}Entity> {
		const [row] = await this.db
			.insert(${this.snakeCase(moduleName)}Entities)
			.values({
				id: crypto.randomUUID(),
				userId,
				...input
			})
			.returning();

		return this.mapToEntity(row);
	}

	async update(id: string, userId: string, input: Update${this.pascalCase(moduleName)}Input): Promise<${this.pascalCase(moduleName)}Entity | null> {
		const [row] = await this.db
			.update(${this.snakeCase(moduleName)}Entities)
			.set(input)
			.where(
				and(
					eq(${this.snakeCase(moduleName)}Entities.id, id),
					eq(${this.snakeCase(moduleName)}Entities.userId, userId)
				)
			)
			.returning();

		return row ? this.mapToEntity(row) : null;
	}

	async delete(id: string, userId: string): Promise<boolean> {
		const result = await this.db
			.delete(${this.snakeCase(moduleName)}Entities)
			.where(
				and(
					eq(${this.snakeCase(moduleName)}Entities.id, id),
					eq(${this.snakeCase(moduleName)}Entities.userId, userId)
				)
			);

		return result.changes > 0;
	}

	private mapToEntity(row: Record<string, unknown>): ${this.pascalCase(moduleName)}Entity {
		return {
			id: row.id as string,
			userId: row.user_id as string,
			name: row.name as string,
			description: row.description as string | undefined,
			status: row.status as ${this.pascalCase(moduleName)}Entity['status'],
			createdAt: row.created_at as number,
			updatedAt: row.updated_at as number
		};
	}
}
`;

		writeFileSync(
			path.join(moduleDir, `lib/repositories/${moduleName}-repository.ts`),
			entityRepository
		);
		console.log(`  ✓ Created lib/repositories/${moduleName}-repository.ts`);

		// Create lib/repositories/index.ts
		const repositoriesIndex = `export { BaseRepository } from './base-repository';
export { ${this.pascalCase(moduleName)}Repository } from './${moduleName}-repository';
`;

		writeFileSync(path.join(moduleDir, 'lib/repositories/index.ts'), repositoriesIndex);
		console.log('  ✓ Created lib/repositories/index.ts');

		// Create lib/stores/api.ts
		const storesApi = `import type {
	${this.pascalCase(moduleName)}Entity,
	Create${this.pascalCase(moduleName)}Input,
	Update${this.pascalCase(moduleName)}Input
} from '$lib/models/external_modules/${moduleName}';

/**
 * ${this.pascalCase(moduleName)} API Client
 */

export async function fetch${this.pascalCase(moduleName)}Entities(): Promise<${this.pascalCase(moduleName)}Entity[]> {
	const res = await fetch('/api/${moduleName}');
	if (!res.ok) throw new Error('Failed to fetch entities');
	return await res.json();
}

export async function create${this.pascalCase(moduleName)}Entity(data: Create${this.pascalCase(moduleName)}Input): Promise<${this.pascalCase(moduleName)}Entity> {
	const res = await fetch('/api/${moduleName}', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	});
	if (!res.ok) throw new Error('Failed to create entity');
	return await res.json();
}

export async function update${this.pascalCase(moduleName)}Entity(id: string, updates: Update${this.pascalCase(moduleName)}Input): Promise<${this.pascalCase(moduleName)}Entity> {
	const res = await fetch('/api/${moduleName}', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ id, ...updates })
	});
	if (!res.ok) throw new Error('Failed to update entity');
	return await res.json();
}

export async function delete${this.pascalCase(moduleName)}Entity(id: string): Promise<void> {
	const res = await fetch('/api/${moduleName}', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ id })
	});
	if (!res.ok) throw new Error('Failed to delete entity');
}
`;

		writeFileSync(path.join(moduleDir, 'lib/stores/api.ts'), storesApi);
		console.log('  ✓ Created lib/stores/api.ts');

		// Create lib/stores/${moduleName}.store.ts
		const entityStore = `import { writable, derived } from 'svelte/store';
import type {
	${this.pascalCase(moduleName)}Entity,
	Create${this.pascalCase(moduleName)}Input,
	Update${this.pascalCase(moduleName)}Input
} from '$lib/models/external_modules/${moduleName}';
import * as api from './api';

/**
 * ${this.pascalCase(moduleName)} Module Store
 */

// Data Store
export const ${this.camelCase(moduleName)}EntitiesStore = writable<${this.pascalCase(moduleName)}Entity[]>([]);

// UI State Store
export const ${this.camelCase(moduleName)}UIState = writable({
	loading: false,
	error: null as string | null,
	lastLoaded: null as number | null
});

// Derived Stats
export const ${this.camelCase(moduleName)}Stats = derived(${this.camelCase(moduleName)}EntitiesStore, ($entities) => {
	const total = $entities.length;
	const active = $entities.filter((e) => e.status === 'active').length;
	return { total, active };
});

/**
 * Actions
 */

export async function load${this.pascalCase(moduleName)}Data() {
	${this.camelCase(moduleName)}UIState.update((s) => ({ ...s, loading: true, error: null }));

	try {
		const entities = await api.fetch${this.pascalCase(moduleName)}Entities();
		${this.camelCase(moduleName)}EntitiesStore.set(entities);

		${this.camelCase(moduleName)}UIState.update((s) => ({
			...s,
			loading: false,
			lastLoaded: Date.now()
		}));
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load data';
		${this.camelCase(moduleName)}UIState.update((s) => ({ ...s, loading: false, error: message }));
		console.error('${moduleName} store load error:', err);
	}
}

export function hydrate${this.pascalCase(moduleName)}Data(data: ${this.pascalCase(moduleName)}Entity[]) {
	${this.camelCase(moduleName)}EntitiesStore.set(data);
	${this.camelCase(moduleName)}UIState.update((s) => ({
		...s,
		loading: false,
		error: null,
		lastLoaded: Date.now()
	}));
}

export async function add${this.pascalCase(moduleName)}Entity(data: Create${this.pascalCase(moduleName)}Input) {
	try {
		const newEntity = await api.create${this.pascalCase(moduleName)}Entity(data);
		${this.camelCase(moduleName)}EntitiesStore.update((entities) => [newEntity, ...entities]);
		return newEntity;
	} catch (err) {
		console.error('Failed to add entity:', err);
		throw err;
	}
}

export async function update${this.pascalCase(moduleName)}EntityStore(id: string, updates: Update${this.pascalCase(moduleName)}Input) {
	try {
		const updated = await api.update${this.pascalCase(moduleName)}Entity(id, updates);
		${this.camelCase(moduleName)}EntitiesStore.update((entities) =>
			entities.map((e) => (e.id === id ? updated : e))
		);
		return updated;
	} catch (err) {
		console.error('Failed to update entity:', err);
		throw err;
	}
}

export async function delete${this.pascalCase(moduleName)}EntityStore(id: string) {
	try {
		await api.delete${this.pascalCase(moduleName)}Entity(id);
		${this.camelCase(moduleName)}EntitiesStore.update((entities) => entities.filter((e) => e.id !== id));
	} catch (err) {
		console.error('Failed to delete entity:', err);
		throw err;
	}
}
`;

		writeFileSync(path.join(moduleDir, `lib/stores/${moduleName}.store.ts`), entityStore);
		console.log(`  ✓ Created lib/stores/${moduleName}.store.ts`);

		// Create lib/stores/index.ts
		const storesIndex = `export * from './${moduleName}.store';
export * from './api';
`;

		writeFileSync(path.join(moduleDir, 'lib/stores/index.ts'), storesIndex);
		console.log('  ✓ Created lib/stores/index.ts');

		// Create lib/utils/index.ts
		const utilsIndex = `/**
 * ${this.pascalCase(moduleName)} Module Utilities
 * Add your module-specific utility functions here
 */

// Example utility function
export function formatDate(timestamp: number): string {
	return new Date(timestamp * 1000).toLocaleDateString();
}
`;

		writeFileSync(path.join(moduleDir, 'lib/utils/index.ts'), utilsIndex);
		console.log('  ✓ Created lib/utils/index.ts');

		// ============== SERVER FILES ==============

		// Create lib/server/ai/ai-tools.ts
		const aiTools = `import { ${this.pascalCase(moduleName)}Repository } from '$lib/repositories/external_modules/${moduleName}/${moduleName}-repository';
import type { ToolDefinition } from '$lib/models/external_modules/${moduleName}';
import { db } from '$lib/server/db';

export function getAiTools(userId: string): ToolDefinition[] {
	const repo = new ${this.pascalCase(moduleName)}Repository(db as any);

	return [
		{
			name: 'get_${moduleName}_entities',
			description: \`Retrieve ${moduleName} entities for the user\`,
			parameters: {
				type: 'object',
				properties: {
					limit: { type: 'number', default: 50 }
				}
			},
			execute: async (params) => {
				return await repo.getByUserId(userId, params.limit);
			}
		},
		{
			name: 'create_${moduleName}_entity',
			description: \`Create a new ${moduleName} entity\`,
			parameters: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					description: { type: 'string' }
				},
				required: ['name']
			},
			execute: async (params) => {
				return await repo.create(params, userId);
			}
		}
	];
}
`;

		writeFileSync(path.join(moduleDir, 'lib/server/ai/ai-tools.ts'), aiTools);
		console.log('  ✓ Created lib/server/ai/ai-tools.ts');

		// Create lib/server/db/schema/tables.ts
		const schemaTables = `import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { textEnum } from '$lib/server/db/utils';
import { ${this.camelCase(moduleName)}Status } from '$lib/models/external_modules/${moduleName}';

/**
 * ${this.pascalCase(moduleName)} module table schema
 * Table naming: ${moduleName}_{entity_type}
 * All timestamps are stored as unix timestamps (seconds)
 */

/**
 * Main entities table
 */
export const ${this.snakeCase(moduleName)}Entities = sqliteTable('${moduleName}_entities', {
	id: text('id')
		.primaryKey()
		.\$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull(),
	name: text('name').notNull(),
	description: text('description'),
	status: textEnum('status', ${this.camelCase(moduleName)}Status).notNull().default('active'),
	createdAt: integer('created_at')
		.notNull()
		.default(sql\`(strftime('%s','now'))\`),
	updatedAt: integer('updated_at')
		.notNull()
		.default(sql\`(strftime('%s','now'))\`)
});
`;

		writeFileSync(path.join(moduleDir, 'lib/server/db/schema/tables.ts'), schemaTables);
		console.log('  ✓ Created lib/server/db/schema/tables.ts');

		// Create lib/server/db/schema/index.ts
		const schemaIndex = `export * from './tables';
`;

		writeFileSync(path.join(moduleDir, 'lib/server/db/schema/index.ts'), schemaIndex);
		console.log('  ✓ Created lib/server/db/schema/index.ts');

		// ============== ROUTES ==============

		// Create routes/ui/+layout.svelte
		const layout = `<script lang="ts">
	import { page } from '$app/stores';
	import { moduleConfig } from '../../config';
</script>

<div class="module-container">
	<header>
		<h1>{moduleConfig.name}</h1>
		<nav>
			{#each moduleConfig.navigation as item}
				<a href={item.href} class:active={$page.url.pathname === item.href}>
					<svelte:component this={item.icon} />
					<span>{item.name}</span>
				</a>
			{/each}
		</nav>
	</header>

	<main>
		<slot />
	</main>
</div>

<style>
	.module-container {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	header {
		padding: 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	nav {
		display: flex;
		gap: 0.5rem;
	}

	nav a {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		text-decoration: none;
		color: #374151;
		transition: all 0.2s;
	}

	nav a:hover {
		background-color: #f3f4f6;
	}

	nav a.active {
		background-color: #dbeafe;
		color: #1d4ed8;
	}

	main {
		padding: 1.5rem;
		flex: 1;
		overflow-y: auto;
	}
</style>
`;

		writeFileSync(path.join(moduleDir, 'routes/ui/+layout.svelte'), layout);
		console.log('  ✓ Created routes/ui/+layout.svelte');

		// Create routes/ui/+page.svelte
		const indexPage = `<script lang="ts">
	import { onMount } from 'svelte';
	import { load${this.pascalCase(moduleName)}Data } from '$lib/stores/external_modules/${moduleName}';
	import { ${this.camelCase(moduleName)}EntitiesStore, ${this.camelCase(moduleName)}UIState } from '$lib/stores/external_modules/${moduleName}';

	onMount(() => {
		load${this.pascalCase(moduleName)}Data();
	});
</script>

<div class="dashboard">
	<h1>Dashboard</h1>

	{#if $$${this.camelCase(moduleName)}UIState.loading}
		<p>Loading...</p>
	{:else if $$${this.camelCase(moduleName)}UIState.error}
		<p class="error">{$$${this.camelCase(moduleName)}UIState.error}</p>
	{:else}
		<div class="entities-list">
			{#each $$${this.camelCase(moduleName)}EntitiesStore as entity}
				<div class="entity-card">
					<h3>{entity.name}</h3>
					<p>{entity.description || 'No description'}</p>
					<span class="status">{entity.status}</span>
				</div>
			{/each}
			{#if $$${this.camelCase(moduleName)}EntitiesStore.length === 0}
				<p>No entities yet. Create your first one!</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.dashboard {
		max-width: 1200px;
		margin: 0 auto;
	}

	.entities-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.entity-card {
		padding: 1rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		background: white;
	}

	.entity-card h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
	}

	.entity-card p {
		margin: 0 0 0.5rem 0;
		color: #6b7280;
	}

	.status {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		background: #dbeafe;
		color: #1d4ed8;
	}

	.error {
		color: #dc2626;
	}
</style>
`;

		writeFileSync(path.join(moduleDir, 'routes/ui/+page.svelte'), indexPage);
		console.log('  ✓ Created routes/ui/+page.svelte');

		// Create routes/ui/dashboard/+page.svelte
		const dashboardPage = `<script lang="ts">
	import { ${this.camelCase(moduleName)}Stats } from '$lib/stores/external_modules/${moduleName}';
</script>

<div class="stats-grid">
	<div class="stat-card">
		<h2>Total Entities</h2>
		<p class="value">$$${this.camelCase(moduleName)}Stats.total</p>
	</div>
	<div class="stat-card">
		<h2>Active</h2>
		<p class="value">$$${this.camelCase(moduleName)}Stats.active</p>
	</div>
</div>

<style>
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.stat-card {
		padding: 1.5rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		background: white;
	}

	.stat-card h2 {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.stat-card .value {
		margin: 0;
		font-size: 2rem;
		font-weight: 600;
	}
</style>
`;

		writeFileSync(path.join(moduleDir, 'routes/ui/dashboard/+page.svelte'), dashboardPage);
		console.log('  ✓ Created routes/ui/dashboard/+page.svelte');

		// Create routes/api/+server.ts
		const apiServer = `import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ${this.pascalCase(moduleName)}Repository } from '$lib/repositories/external_modules/${moduleName}';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const repo = new ${this.pascalCase(moduleName)}Repository();
		const entities = await repo.getByUserId(locals.user.id);
		return json({ data: entities });
	} catch (error) {
		console.error('Error fetching entities:', error);
		return json({ error: 'Failed to fetch entities' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const input = await request.json();
		const repo = new ${this.pascalCase(moduleName)}Repository();
		const entity = await repo.create(input, locals.user.id);
		return json({ data: entity }, { status: 201 });
	} catch (error) {
		console.error('Error creating entity:', error);
		return json({ error: 'Failed to create entity' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id, ...updates } = await request.json();
		const repo = new ${this.pascalCase(moduleName)}Repository();
		const entity = await repo.update(id, locals.user.id, updates);

		if (!entity) {
			return json({ error: 'Entity not found' }, { status: 404 });
		}

		return json({ data: entity });
	} catch (error) {
		console.error('Error updating entity:', error);
		return json({ error: 'Failed to update entity' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = await request.json();
		const repo = new ${this.pascalCase(moduleName)}Repository();
		const deleted = await repo.delete(id, locals.user.id);

		if (!deleted) {
			return json({ error: 'Entity not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting entity:', error);
		return json({ error: 'Failed to delete entity' }, { status: 500 });
	}
};
`;

		writeFileSync(path.join(moduleDir, 'routes/api/+server.ts'), apiServer);
		console.log('  ✓ Created routes/api/+server.ts');

		// ============== DRIZZLE ==============

		// Create drizzle/0000_schema.sql
		const migration = `-- ${this.pascalCase(moduleName)} module schema
-- This file is auto-generated by drizzle-kit
-- Run: npm run db:generate

-- ${moduleName}_entities table
CREATE TABLE IF NOT EXISTS "${moduleName}_entities" (
	"id" TEXT PRIMARY KEY,
	"user_id" TEXT NOT NULL,
	"name" TEXT NOT NULL,
	"description" TEXT,
	"status" TEXT DEFAULT 'active',
	"created_at" INTEGER DEFAULT (strftime('%s','now')),
	"updated_at" INTEGER DEFAULT (strftime('%s','now'))
);
`;

		writeFileSync(path.join(moduleDir, 'drizzle/0000_schema.sql'), migration);
		console.log('  ✓ Created drizzle/0000_schema.sql');

		// ============== README ==============

		// Create README.md
		const readme = `# ${this.pascalCase(moduleName)}

${options.description || 'A new MoLOS module'}

## Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## Database

\`\`\`bash
npm run db:generate  # Generate migrations
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
\`\`\`

## Testing

\`\`\`bash
npm run test         # Run all tests
\`\`\`

## Building

\`\`\`bash
npm run build
npm run preview
\`\`\`

## Module Structure

\`\`\`
lib/
├── components/      # Svelte components
├── models/          # TypeScript types and interfaces
├── repositories/    # Data access layer
├── stores/          # Svelte stores for state management
├── utils/           # Utility functions
└── server/
    ├── ai/          # AI tool definitions
    └── db/schema/   # Database schema

routes/
├── api/             # API endpoints
└── ui/              # UI routes
\`\`\`
`;

		writeFileSync(path.join(moduleDir, 'README.md'), readme);
		console.log('  ✓ Created README.md');

		console.log(`\n✅ Module created successfully at: ${moduleDir}`);
		console.log('\nNext steps:');
		console.log(`  1. cd external_modules/${moduleName}`);
		console.log('  2. npm install');
		console.log('  3. npm run dev');
		console.log(`\n💡 To enable AI tools, implement functions in lib/server/ai/ai-tools.ts`);
	}

	// Helper methods for naming conventions
	private static pascalCase(str: string): string {
		return str
			.split(/[-_]/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join('');
	}

	private static camelCase(str: string): string {
		const pascal = this.pascalCase(str);
		return pascal.charAt(0).toLowerCase() + pascal.slice(1);
	}

	private static snakeCase(str: string): string {
		return str
			.replace(/([A-Z])/g, '_$1')
			.toLowerCase()
			.replace(/^_/, '');
	}
}
