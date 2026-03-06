/**
 * Mock Module Utilities for Testing
 *
 * Provides utilities for creating mock modules for testing the module system
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import type { ModuleConfig } from '../../src/lib/config/types';

/**
 * Creates a temporary mock module for testing
 */
export class MockModuleBuilder {
	private config: Partial<ModuleConfig>;
	private routes: Array<{ path: string; content: string }> = [];
	private migrations: Array<{ name: string; sql: string }> = [];

	constructor(id: string = 'test-module') {
		this.config = {
			id,
			name: 'Test Module',
			href: `/test-module`,
			icon: {} as any,
			description: 'A test module for testing',
			navigation: []
		};
	}

	withName(name: string): this {
		this.config.name = name;
		return this;
	}

	withHref(href: string): this {
		this.config.href = href;
		return this;
	}

	withDescription(description: string): this {
		this.config.description = description;
		return this;
	}

	withNavigation(navigation: Array<{ name: string; href: string; icon: any }>): this {
		this.config.navigation = navigation;
		return this;
	}

	addRoute(path: string, content: string): this {
		this.routes.push({ path, content });
		return this;
	}

	addMigration(name: string, sql: string): this {
		this.migrations.push({ name, sql });
		return this;
	}

	/**
	 * Builds the mock module on disk
	 */
	build(basePath: string = join(process.cwd(), 'modules', 'temp-test-module')): string {
		// Clean up if exists
		if (existsSync(basePath)) {
			rmSync(basePath, { recursive: true, force: true });
		}

		// Create directory structure
		mkdirSync(join(basePath, 'src'), { recursive: true });
		mkdirSync(join(basePath, 'src', 'routes'), { recursive: true });

		// Create package.json
		const packageJson = {
			name: `@molos/module-${this.config.id?.toLowerCase()}`,
			version: '1.0.0',
			type: 'module',
			exports: {
				'.': './src/index.ts',
				'./config': './src/config.ts'
			}
		};
		writeFileSync(join(basePath, 'package.json'), JSON.stringify(packageJson, null, 2));

		// Create config.ts
		const configContent = `
import type { ModuleConfig } from '../../src/lib/config/types';

export const ${this.config.id?.replace(/-/g, '_')}Config: ModuleConfig = ${JSON.stringify(this.config, null, 2)};

export default ${this.config.id?.replace(/-/g, '_')}Config;
`;
		writeFileSync(join(basePath, 'src', 'config.ts'), configContent);

		// Create index.ts
		const indexContent = `export * from './config';`;
		writeFileSync(join(basePath, 'src', 'index.ts'), indexContent);

		// Create routes
		for (const route of this.routes) {
			const routePath = join(basePath, 'src', 'routes', route.path);
			mkdirSync(routePath.split('/').slice(0, -1).join('/'), { recursive: true });
			writeFileSync(routePath, route.content);
		}

		// Create migrations
		if (this.migrations.length > 0) {
			mkdirSync(join(basePath, 'drizzle'), { recursive: true });
			mkdirSync(join(basePath, 'drizzle', 'meta'), { recursive: true });

			for (const migration of this.migrations) {
				writeFileSync(join(basePath, 'drizzle', migration.name), migration.sql);
			}
		}

		return basePath;
	}

	/**
	 * Gets the module config without creating files
	 */
	getConfig(): ModuleConfig {
		return this.config as ModuleConfig;
	}

	/**
	 * Cleanup the mock module
	 */
	static cleanup(basePath: string) {
		if (existsSync(basePath)) {
			rmSync(basePath, { recursive: true, force: true });
		}
	}
}

/**
 * Creates a simple mock module config
 */
export function createMockModuleConfig(
	id: string = 'test-module',
	overrides: Partial<ModuleConfig> = {}
): ModuleConfig {
	return {
		id,
		name: 'Test Module',
		href: `/test-module`,
		icon: {} as any,
		description: 'A test module',
		navigation: [],
		...overrides
	};
}

/**
 * Creates a set of mock modules for testing
 */
export function createMockModuleSet(count: number = 3): ModuleConfig[] {
	return Array.from({ length: count }, (_, i) =>
		createMockModuleConfig(`test-module-${i}`, {
			name: `Test Module ${i}`,
			href: `/test-module-${i}`,
			description: `Test module number ${i}`
		})
	);
}

/**
 * Creates a mock module with routes
 */
export function createMockModuleWithRoutes(): {
	config: ModuleConfig;
	routes: Array<{ path: string; content: string }>;
} {
	const config = createMockModuleConfig('test-module-with-routes', {
		navigation: [
			{ name: 'Dashboard', href: '/test-module-with-routes/dashboard', icon: {} as any },
			{ name: 'Settings', href: '/test-module-with-routes/settings', icon: {} as any }
		]
	});

	const routes = [
		{
			path: '+page.svelte',
			content: '<script>export let data;</script><h1>Test Module</h1>'
		},
		{
			path: '+page.server.ts',
			content: `
export async function load() {
	return { title: 'Test Module' };
}
`
		},
		{
			path: 'dashboard/+page.svelte',
			content: '<script>export let data;</script><h1>Dashboard</h1>'
		},
		{
			path: 'settings/+page.svelte',
			content: '<script>export let data;</script><h1>Settings</h1>'
		}
	];

	return { config, routes };
}

/**
 * Creates a mock module with database schema
 */
export function createMockModuleWithSchema(): {
	modulePath: string;
	schemaContent: string;
	migrationContent: string;
} {
	const schemaContent = `
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const testItems = sqliteTable('test_items', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
`;

	const migrationContent = `
CREATE TABLE \`test_items\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`name\` text NOT NULL,
	\`description\` text,
	\`created_at\` integer NOT NULL
);
`;

	return {
		modulePath: 'test-module-with-schema',
		schemaContent,
		migrationContent
	};
}
