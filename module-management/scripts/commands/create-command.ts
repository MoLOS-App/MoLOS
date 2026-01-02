import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

interface ModuleOptions {
	name: string;
	author?: string;
	description?: string;
	version?: string;
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
			console.error('❌ Module name must contain only alphanumeric characters, hyphens, and underscores');
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
			'lib/server/db',
			'lib/stores',
			'routes/ui',
			'routes/api',
			'drizzle'
		];

		for (const dir of dirs) {
			const dirPath = path.join(moduleDir, dir);
			mkdirSync(dirPath, { recursive: true });
		}

		// Create manifest.yaml
		const manifest = `id: "${moduleName}"
name: "${options.name || moduleName}"
version: "${options.version || '1.0.0'}"
description: "${options.description || 'A new MoLOS module'}"
author: "${options.author || 'Module Developer'}"
icon: "Zap"
minMolosVersion: "0.1.0"
enabled: true
`;

		writeFileSync(path.join(moduleDir, 'manifest.yaml'), manifest);
		console.log('  ✓ Created manifest.yaml');

		// Create config.ts
		const config = `import type { ModuleConfig } from '$lib/config/module-types';
import { Zap } from 'lucide-svelte';

export const moduleConfig: ModuleConfig = {
	id: '${moduleName}',
	name: '${options.name || moduleName}',
	href: '/ui/${moduleName}',
	icon: Zap,
	description: '${options.description || 'A new MoLOS module'}',
	navigation: [
		{
			name: 'Dashboard',
			icon: Zap,
			href: '/ui/${moduleName}/dashboard'
		}
	]
};

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
				dev: 'vite',
				build: 'vite build',
				preview: 'vite preview',
				'db:generate': 'drizzle-kit generate:sqlite --out drizzle --schema ./lib/server/db/schema.ts',
				'db:migrate': 'drizzle-kit migrate:sqlite',
				'db:studio': 'drizzle-kit studio'
			},
			devDependencies: {
				'@sveltejs/kit': '^2.0.0',
				svelte: '^4.0.0',
				'lucide-svelte': '^0.263.1',
				zod: '^4.2.1'
			},
			dependencies: {}
		};

		writeFileSync(path.join(moduleDir, 'package.json'), JSON.stringify(packageJson, null, 2));
		console.log('  ✓ Created package.json');

		// Create basic UI route
		const layout = `<script>
	import { getModuleNavigation } from '$lib/config/modules';
	import type { LayoutData } from './$types';

	export let data: LayoutData;

	const navigation = getModuleNavigation('${moduleName}');
</script>

<div>
	<h1>Module: ${moduleName}</h1>
	<nav>
		{#each navigation as item}
			<a href={item.href}>{item.name}</a>
		{/each}
	</nav>
	<slot />
</div>
`;

		writeFileSync(path.join(moduleDir, 'routes/ui/+layout.svelte'), layout);
		console.log('  ✓ Created routes/ui/+layout.svelte');

		// Create basic API route
		const apiServer = `import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	return json({
		message: 'Hello from ${moduleName} API',
		timestamp: new Date().toISOString()
	});
};
`;

		writeFileSync(path.join(moduleDir, 'routes/api/+server.ts'), apiServer);
		console.log('  ✓ Created routes/api/+server.ts');

		// Create placeholder migration
		const migration = `-- ${moduleName} schema
-- Add your module tables here

-- CREATE TABLE ${moduleName}_example (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   name TEXT NOT NULL,
--   created_at INTEGER DEFAULT (strftime('%s', 'now'))
-- );
`;

		writeFileSync(path.join(moduleDir, 'drizzle/0000_schema.sql'), migration);
		console.log('  ✓ Created drizzle/0000_schema.sql');

		// Create README
		const readme = `# ${moduleName}

${options.description || 'A new MoLOS module'}

## Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## Database

\`\`\`bash
npm run db:generate
npm run db:migrate
npm run db:studio
\`\`\`

## Building

\`\`\`bash
npm run build
npm run preview
\`\`\`
`;

		writeFileSync(path.join(moduleDir, 'README.md'), readme);
		console.log('  ✓ Created README.md');

		console.log(`\n✅ Module created successfully at: ${moduleDir}`);
		console.log('\nNext steps:');
		console.log(`  1. cd external_modules/${moduleName}`);
		console.log('  2. npm install');
		console.log('  3. npm run dev');
	}
}