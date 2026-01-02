import {
	existsSync,
	readdirSync,
	symlinkSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	rmSync,
	utimesSync,
	lstatSync
} from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { parse } from 'yaml';
import { MigrationRunner } from './migration-runner';
import { db } from '../../src/lib/server/db';
import { SettingsRepository } from '../../src/lib/repositories/settings/settings-repository';
import { categorizeError, createModuleError, formatErrorForLogging } from './module-error-handler';
import type { ModuleError } from '../../config/module-types';

export interface ModuleManifest {
	id: string;
	name: string;
	version: string;
	description?: string;
	author?: string;
	icon?: string;
}

export class ModuleManager {
	private static EXTERNAL_DIR = path.join(process.cwd(), 'external_modules');
	private static PARENT_DIR = path.join(process.cwd(), '..');
	private static INTERNAL_CONFIG_DIR = path.join(process.cwd(), 'src/lib/config/modules');
	private static UI_ROUTES_DIR = path.join(
		process.cwd(),
		'src/routes/ui/(modules)/(external_modules)'
	);
	private static API_ROUTES_DIR = path.join(process.cwd(), 'src/routes/api/(external_modules)');

	static async init() {
		console.log('[ModuleManager] Initializing external modules...');

		if (!existsSync(this.EXTERNAL_DIR)) {
			mkdirSync(this.EXTERNAL_DIR, { recursive: true });
		}

		const settingsRepo = new SettingsRepository();

		// 0. Discover modules in external_modules directory and register them if not in DB
		// Only if MOLOS_AUTOLOAD_MODULES is set to true
		const autoload = process.env.MOLOS_AUTOLOAD_MODULES === 'true';
		if (autoload) {
			await this.discoverLocalModules(settingsRepo);
		} else {
			console.log('[ModuleManager] Autoload disabled. Skipping local module discovery.');
		}

		const migrationRunner = new MigrationRunner(db);

		// 1. Get all modules from DB
		const allExternalInDb = await settingsRepo.getExternalModules();

		// If autoload is disabled, mark auto-discovered local modules for deletion
		if (!autoload) {
			for (const mod of allExternalInDb) {
				if (mod.repoUrl.startsWith('local://')) {
					console.log(`[ModuleManager] Autoload disabled. Marking auto-discovered module ${mod.id} for deletion.`);
					await settingsRepo.updateExternalModuleStatus(mod.id, 'deleting');
				}
			}
		}

		// 2. Process Deletions first
		const toDelete = allExternalInDb.filter((m) => m.status === 'deleting');
		for (const mod of toDelete) {
			console.log(`[ModuleManager] Processing pending deletion for module: ${mod.id}`);
			this.cleanupModuleArtifacts(mod.id);
			const modulePath = path.join(this.EXTERNAL_DIR, mod.id);
			if (existsSync(modulePath)) {
				try {
					rmSync(modulePath, { recursive: true, force: true });
					console.log(`[ModuleManager] Removed folder for deleted module: ${mod.id}`);
				} catch (e) {
					console.error(`[ModuleManager] Failed to remove folder for ${mod.id}:`, e);
				}
			}
			await settingsRepo.deleteExternalModule(mod.id);
			console.log(`[ModuleManager] Removed module ${mod.id} from database.`);
		}

		// 3. Check for broken symlinks (for local modules where source was removed)
		for (const mod of allExternalInDb) {
			if (mod.repoUrl.startsWith('local://') && mod.status !== 'deleting') {
				const modulePath = path.join(this.EXTERNAL_DIR, mod.id);
				try {
					if (this.isBrokenSymlink(modulePath)) {
						console.log(`[ModuleManager] Local module source removed, marking ${mod.id} for deletion.`);
						await settingsRepo.updateExternalModuleStatus(mod.id, 'deleting');
					}
				} catch (e) {
					console.warn(`[ModuleManager] Error checking symlink for ${mod.id}: ${e}`);
				}
			}
		}

		// 4. Cleanup orphaned folders (folders in external_modules not in DB)
		const dbModuleIds = new Set(
			allExternalInDb.filter((m) => m.status !== 'deleting').map((m) => m.id)
		);
		try {
			const folders = readdirSync(this.EXTERNAL_DIR, { withFileTypes: true })
				.filter((dirent) => dirent.isDirectory())
				.map((dirent) => dirent.name);

			for (const folder of folders) {
				if (!dbModuleIds.has(folder)) {
					console.log(`[ModuleManager] Removing orphaned module folder: ${folder}`);
					const orphanPath = path.join(this.EXTERNAL_DIR, folder);
					this.cleanupModuleArtifacts(folder);
					rmSync(orphanPath, { recursive: true, force: true });
				}
			}
		} catch (e) {
			console.warn(`[ModuleManager] Could not cleanup orphaned modules. ${e}`);
		}

		// If autoload is disabled, skip module initialization
		if (!autoload) {
			console.log('[ModuleManager] Autoload disabled. Skipping module initialization.');
			return;
		}

		// 4. Refresh and Initialize modules from DB
		const toInitialize = allExternalInDb.filter((m) => m.status !== 'deleting');

		// 5. Cleanup orphaned/broken symlinks under src
		const activeModuleIds = new Set(toInitialize.map((m) => m.id));
		this.cleanupOrphanedSymlinks(activeModuleIds);

		for (const mod of toInitialize) {
			const moduleId = mod.id;
			const modulePath = path.join(this.EXTERNAL_DIR, moduleId);

			// Check if module is in an error state - skip initialization but keep in DB
			if (mod.status.startsWith('error_') || mod.status === 'disabled') {
				console.log(`[ModuleManager] Skipping module ${moduleId} (status: ${mod.status}).`);
				this.cleanupModuleArtifacts(moduleId); // Clean up any broken symlinks
				continue;
			}

			// For local modules, if the symlink in external_modules was manually removed, mark for deletion
			const isLocal = mod.repoUrl.startsWith('local://');
			if (isLocal && !existsSync(modulePath) && mod.status !== 'pending') {
				console.log(`[ModuleManager] Local module ${moduleId} symlink removed, marking for deletion.`);
				await settingsRepo.updateExternalModuleStatus(mod.id, 'deleting');
				continue;
			}

			try {
				// 0. Clean Refresh: Remove and re-clone (unless it's a local module already in place)
				let localSourcePath: string | null = null;
				if (isLocal) {
					const pathPart = mod.repoUrl.substring(8);
					if (pathPart === moduleId || pathPart === '') {
						localSourcePath = path.join(this.PARENT_DIR, moduleId);
					} else {
						localSourcePath = path.isAbsolute(pathPart) ? pathPart : path.resolve(this.PARENT_DIR, pathPart);
					}
				}

				console.log(`[ModuleManager] Refreshing module ${moduleId} from ${mod.repoUrl}...`);
				this.cleanupModuleArtifacts(moduleId);

				if (isLocal && existsSync(modulePath) && !existsSync(localSourcePath || '')) {
					console.log(`[ModuleManager] Module ${moduleId} is already in external_modules, skipping refresh.`);
				} else if (isLocal && localSourcePath && existsSync(localSourcePath)) {
					console.log(`[ModuleManager] Using local source for ${moduleId}`);
					// Instead of cloning, we symlink the local source to the external_modules dir
					// to keep the rest of the logic (migrations, etc.) consistent
					if (existsSync(modulePath)) {
						rmSync(modulePath, { recursive: true, force: true });
					}
					symlinkSync(localSourcePath, modulePath, 'dir');
				} else {
					if (existsSync(modulePath)) {
						rmSync(modulePath, { recursive: true, force: true });
					}
					try {
						execSync(`git clone ${mod.repoUrl} ${modulePath}`, { stdio: 'inherit' });
					} catch (cloneError) {
						throw new Error(`Failed to clone repository: ${cloneError}`);
					}
				}

				// 1. Validate Manifest
				const manifestPath = path.join(modulePath, 'manifest.yaml');
				// 1. Validate Manifest
				if (!existsSync(manifestPath)) {
					throw new Error(`Missing manifest.yaml in ${moduleId}`);
				}

				const manifestContent = readFileSync(manifestPath, 'utf-8');
				const manifest = parse(manifestContent) as ModuleManifest;

				if (manifest.id !== moduleId) {
					throw new Error(
						`Module ID in manifest (${manifest.id}) does not match folder name (${moduleId})`
					);
				}

				console.log(`[ModuleManager] Initializing module: ${manifest.name} (${manifest.version})`);
				await settingsRepo.log('info', 'ModuleManager', `Initializing module: ${manifest.name}`, {
					moduleId,
					version: manifest.version
				});

				// 2. Run Tests (Basic validation)
				this.runBasicTests(moduleId, modulePath);

				// 3. Run Migrations
				const migrationsDir = path.join(modulePath, 'drizzle');
				await migrationRunner.runMigrations(moduleId, migrationsDir);

				// 4. Standardize Exports
				this.standardizeModuleExports(moduleId, modulePath);

				// 5. Setup Symlinks (Runtime check/refresh)
				this.setupSymlinks(moduleId, modulePath);

				// 6. Update Status in DB
				await settingsRepo.updateExternalModuleStatus(moduleId, 'active');

				console.log(`[ModuleManager] Module ${moduleId} initialized successfully.`);
				await settingsRepo.log(
					'info',
					'ModuleManager',
					`Module ${moduleId} initialized successfully.`
				);
			} catch (error: unknown) {
				const { category, message, details } = formatErrorForLogging(moduleId, error, 'initialization');
				const moduleError = createModuleError(category, message, { stack: details });

				console.error(`\n[ModuleManager] ⚠️ FAILED TO INITIALIZE MODULE: ${moduleId}`);
				console.error(`[ModuleManager] Error Type: ${category}`);
				console.error(`[ModuleManager] Error: ${message}`);
				console.error(`[ModuleManager] Status: Module marked as "${moduleError.status}" for manual recovery`);
				console.error(`[ModuleManager] Recovery Steps:`);
				moduleError.recoverySteps?.forEach((step) => console.error(`  - ${step}`));
				console.error('');

				await settingsRepo.log('error', 'ModuleManager', `Failed to initialize module ${moduleId}`, {
					errorType: category,
					message,
					stack: details
				});

				// Mark module in error state instead of deleting it
				await settingsRepo.updateExternalModuleStatus(moduleId, moduleError.status as any, moduleError);

				console.log(
					`[ModuleManager] Module ${moduleId} preserved in error state for inspection and recovery.`
				);

				// Cleanup symlinks and build artifacts so the module isn't partially loaded
				try {
					this.cleanupModuleArtifacts(moduleId);
					console.log(`[ModuleManager] Cleaned up broken symlinks and artifacts for ${moduleId}`);
				} catch (cleanupError) {
					console.warn(`[ModuleManager] Failed to cleanup artifacts for ${moduleId}:`, cleanupError);
				}

				// Don't trigger reboot - other modules may still be valid
				// Only exit with error code if this is the last module being processed
			}
		}
	}

	private static async discoverLocalModules(settingsRepo: SettingsRepository) {
		console.log(`[ModuleManager] Scanning external_modules directory for modules: ${this.EXTERNAL_DIR}`);
		try {
			const items = readdirSync(this.EXTERNAL_DIR, { withFileTypes: true });
			const molosModules = items.filter(
				(item) =>
					item.isDirectory() || item.isSymbolicLink()
			);

			const existingModules = await settingsRepo.getExternalModules();
			const existingIds = new Set(existingModules.map((m) => m.id));

			for (const mod of molosModules) {
				if (!existingIds.has(mod.name)) {
					console.log(`[ModuleManager] Auto-registering local module: ${mod.name}`);
					// For local modules, we use a dummy repo URL or a local path indicator
					// Since the current logic expects a repoUrl for cloning, we'll provide a placeholder
					// but we'll need to adjust the init logic to skip cloning if it's already there
					await settingsRepo.registerExternalModule(mod.name, `local://${mod.name}`);
				}
			}
		} catch (e) {
			console.warn(`[ModuleManager] Failed to discover local modules: ${e}`);
		}
	}

	private static setupSymlinks(moduleId: string, modulePath: string) {
		// Ensure parent directories exist BEFORE creating symlinks
		// This is critical for SvelteKit type generation
		const parentDirs = [
			this.INTERNAL_CONFIG_DIR,
			this.UI_ROUTES_DIR,
			this.API_ROUTES_DIR,
			path.join(process.cwd(), 'src/lib/modules')
		];

		for (const dir of parentDirs) {
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
		}

		// Link config.ts to src/lib/config/modules/[id]
		// We link the whole folder to make imports inside config.ts work
		const configDest = path.join(this.INTERNAL_CONFIG_DIR, moduleId);
		this.createSymlink(modulePath, configDest);

		// Link lib to src/lib/modules/[id] to support $lib/modules/[id] imports
		const libSource = path.join(modulePath, 'lib');
		if (existsSync(libSource)) {
			const libDest = path.join(process.cwd(), 'src/lib/modules', moduleId);
			this.createSymlink(libSource, libDest);
		}

		// Link UI routes
		const uiSource = path.join(modulePath, 'routes/ui');
		if (existsSync(uiSource)) {
			const uiDest = path.join(this.UI_ROUTES_DIR, moduleId);
			this.createSymlink(uiSource, uiDest);
		}

		// Link API routes
		const apiSource = path.join(modulePath, 'routes/api');
		if (existsSync(apiSource)) {
			const apiDest = path.join(this.API_ROUTES_DIR, moduleId);
			this.createSymlink(apiSource, apiDest);
		}
	}

	private static runBasicTests(moduleId: string, modulePath: string) {
		// 1. Check for required files
		const required = ['manifest.yaml', 'config.ts'];
		for (const file of required) {
			if (!existsSync(path.join(modulePath, file))) {
				throw new Error(`Validation failed: Missing required file '${file}'`);
			}
		}

		// 2. Check for routes directory
		if (!existsSync(path.join(modulePath, 'routes'))) {
			console.warn(`[ModuleManager] Warning: Module ${moduleId} has no routes directory.`);
		}

		// 3. Check for lib directory
		if (!existsSync(path.join(modulePath, 'lib'))) {
			console.warn(`[ModuleManager] Warning: Module ${moduleId} has no lib directory.`);
		}
	}

	/**
	 * Standardizes module configuration and exports for the core application.
	 */
	private static standardizeModuleExports(moduleId: string, modulePath: string) {
		const configPath = path.join(modulePath, 'config.ts');
		if (!existsSync(configPath)) return;

		let content = readFileSync(configPath, 'utf-8');
		
		// Fix common export naming discrepancies
		if (content.includes('export const ') && !content.includes('export const moduleConfig') && !content.includes('export default')) {
			const match = content.match(/export const (\w+Config)/);
			if (match) {
				const configName = match[1];
				console.log(`[ModuleManager] Standardizing config export for ${moduleId}: ${configName} -> moduleConfig`);
				content += `\n\nexport const moduleConfig = ${configName};\nexport default ${configName};`;
			}
		}

		// Also fix hrefs to match the moduleId (folder name)
		const normalizedId = moduleId;
		// Match /ui/xxx or /api/xxx
		const uiHrefRegex = new RegExp(`href:\\s*['"]/ui/([\\w-]+)`, 'g');
		const apiHrefRegex = new RegExp(`(['"])/api/([\\w-]+)`, 'g');
				
		if (content.match(uiHrefRegex) || content.match(apiHrefRegex)) {
			console.log(`[ModuleManager] Standardizing hrefs and API calls for ${moduleId}`);
			content = content.replace(uiHrefRegex, (match, p1) => {
				if (p1.startsWith('MoLOS-')) return match;
				const fullMatch = match.match(/href:\s*['"]\/ui\/([\w-/]+)/);
				if (!fullMatch) return match;
				const fullPath = fullMatch[1];
				
				// Check if the path starts with the module ID (e.g., 'health' or 'health/')
				if (fullPath === p1 || fullPath.startsWith(p1 + '/')) {
					const subpath = fullPath.substring(p1.length);
					return `href: '/ui/${normalizedId}${subpath}`;
				}
				return match;
			});
			content = content.replace(apiHrefRegex, (match, quote, p1) => {
				if (p1.startsWith('MoLOS-')) return match;
				const fullMatch = match.match(new RegExp(`${quote}/api/([\\w-/]+)`));
				if (!fullMatch) return match;
				const fullPath = fullMatch[1];
				
				if (fullPath === p1 || fullPath.startsWith(p1 + '/')) {
					const subpath = fullPath.substring(p1.length);
					return `${quote}/api/${normalizedId}${subpath}`;
				}
				return match;
			});
		}

		// 3. Fix $lib/stores/modules/[module_name] -> $lib/modules/[moduleId]/stores
		const storeRegex = /\$lib\/stores\/modules\/([\w-]+)/g;
		if (content.match(storeRegex)) {
			content = content.replace(storeRegex, (match, p1) => {
				// If it's already standardized, skip
				if (match.includes(`$lib/modules/${moduleId}`)) return match;
				// If it's a subpath like $lib/stores/modules/tasks/api
				const subpath = match.substring(`$lib/stores/modules/${p1}`.length);
				return `$lib/modules/${moduleId}/stores${subpath}`;
			});
		}

		// 4. Fix $lib/components/modules/[module_name] -> $lib/modules/[moduleId]/components
		const componentRegex = /\$lib\/components\/modules\/([\w-]+)/g;
		if (content.match(componentRegex)) {
			content = content.replace(componentRegex, (match, p1) => {
				if (match.includes(`$lib/modules/${moduleId}`)) return match;
				const subpath = match.substring(`$lib/components/modules/${p1}`.length);
				return `$lib/modules/${moduleId}/components${subpath}`;
			});
		}

		// 5. Fix $lib/repositories/[module_name] -> $lib/modules/[moduleId]/lib/repositories
		const repoRegex = /\$lib\/repositories\/([\w-]+)/g;
		if (content.match(repoRegex)) {
			content = content.replace(repoRegex, (match, p1) => {
				if (match.includes(`$lib/modules/${moduleId}`)) return match;
				const subpath = match.substring(`$lib/repositories/${p1}`.length);
				return `$lib/modules/${moduleId}/lib/repositories${subpath}`;
			});
		}

		// 6. Fix $lib/server/db/schema/[module_name] -> $lib/modules/[moduleId]/lib/server/db/schema
		const schemaRegex = /\$lib\/server\/db\/schema\/([\w-]+)/g;
		if (content.match(schemaRegex)) {
			content = content.replace(schemaRegex, (match, p1) => {
				if (match.includes(`$lib/modules/${moduleId}`)) return match;
				const subpath = match.substring(`$lib/server/db/schema/${p1}`.length);
				return `$lib/modules/${moduleId}/lib/server/db/schema${subpath}`;
			});
		}

		// 7. Fix $lib/models/[module_name] -> $lib/modules/[moduleId]/lib/models
		const modelRegex = /\$lib\/models\/([\w-]+)/g;
		if (content.match(modelRegex)) {
			content = content.replace(modelRegex, (match, p1) => {
				if (match.includes(`$lib/modules/${moduleId}`)) return match;
				const subpath = match.substring(`$lib/models/${p1}`.length);
				return `$lib/modules/${moduleId}/lib/models${subpath}`;
			});
		}

		writeFileSync(configPath, content);

		// Also fix internal imports in all .svelte and .ts files within the module
		this.standardizeInternalImports(moduleId, modulePath);
	}

	/**
		* Standardizes internal imports within a module to use the new $lib/modules/[id] alias.
		*/
	private static standardizeInternalImports(moduleId: string, modulePath: string) {
		const files = this.getAllFiles(modulePath).filter(f => f.endsWith('.svelte') || f.endsWith('.ts'));
		
		for (const file of files) {
			let content = readFileSync(file, 'utf-8');
			let changed = false;

			// For routes (api and ui), convert relative imports to $lib/modules aliases
			// This is critical because symlinked routes have different path depths
			const isRoute = file.includes('/routes/');
			
			if (isRoute) {
				// 1. Replace relative imports to lib from routes
				// ../../lib/repositories -> $lib/modules/[id]/repositories
				// This handles: routes/api/+server.ts importing from ../../lib/repositories
				const relativeLibRegex = /from\s+['"]\.\.\/\.\.\/lib\/([^'"]+)['"]/g;
				if (content.match(relativeLibRegex)) {
					content = content.replace(relativeLibRegex, (match, p1) => {
						return `from '$lib/modules/${moduleId}/${p1}'`;
					});
					changed = true;
				}

				// 2. Replace relative imports to model files
				// ../../lib/models -> $lib/modules/[id]/lib/models
				const relativeModelRegex = /from\s+['"]\.\.\/\.\.\/lib\/models([^'"]*)['"]/g;
				if (content.match(relativeModelRegex)) {
					content = content.replace(relativeModelRegex, (match, p1) => {
						return `from '$lib/modules/${moduleId}/lib/models${p1}'`;
					});
					changed = true;
				}
			}

			// Handle relative imports from lib directory files
			// ../../server/db/schema -> $lib/server/db/schema (these are typically in lib/repositories)
			const relativeServerDbRegex = /from\s+['"]\.\.\/\.\.\/server\/db\/schema([^'"]*)['"]/g;
			if (content.match(relativeServerDbRegex)) {
				content = content.replace(relativeServerDbRegex, (match, p1) => {
					return `from '$lib/server/db/schema${p1}'`;
				});
				changed = true;
			}

			// Handle relative imports from lib/repositories to lib/server/db/schema
			// ../lib/server/db/schema -> $lib/modules/[moduleId]/lib/server/db/schema
			const relativeModuleSchemaRegex = /from\s+['"]\.\.\/lib\/server\/db\/schema([^'"]*)['"]/g;
			if (content.match(relativeModuleSchemaRegex)) {
				content = content.replace(relativeModuleSchemaRegex, (match, p1) => {
					return `from '$lib/modules/${moduleId}/lib/server/db/schema${p1}'`;
				});
				changed = true;
			}

			// Handle other relative imports from lib directory
			// ../../models -> $lib/modules/[id]/lib/models
			const relativeModelsRegex = /from\s+['"]\.\.\/\.\.\/models([^'"]*)['"]/g;
			if (content.match(relativeModelsRegex)) {
				content = content.replace(relativeModelsRegex, (match, p1) => {
					return `from '$lib/modules/${moduleId}/lib/models${p1}'`;
				});
				changed = true;
			}

			// For module-specific schema tables, redirect to module's own schema
			// e.g., tasksTasks, tasksProjects -> $lib/modules/MoLOS-Tasks/lib/server/db/schema
			// This handles imports like: import { tasksTasks } from '$lib/server/db/schema'
			const modulePrefix = moduleId.toLowerCase().replace(/-tasks$/, '').replace(/-/g, '');
			const moduleTableRegex = new RegExp(`from\\s+['"]\\$lib/server/db/schema['"]`, 'g');
			if (moduleTableRegex.test(content)) {
				// Check if importing any module-specific tables (ones that start with the module prefix)
				const importRegex = /import\s*\{\s*([^}]+)\s*\}\s*from\s+['"]\\$lib\/server\/db\/schema['"]/g;
				const match = importRegex.exec(content);
				if (match) {
					const imports = match[1];
					// Check if any imports start with module prefix (e.g., tasks, project)
					if (imports.match(new RegExp(`\\b${modulePrefix}\\w+\\b`))) {
						// Redirect the import to module's own schema
						content = content.replace(
							moduleTableRegex,
							`from '$lib/modules/${moduleId}/lib/server/db/schema'`
						);
						changed = true;
					}
				}
			}

			// 1. Replace $lib/stores/modules/[module_name] with $lib/modules/[moduleId]/stores
			const storeRegex = /\$lib\/stores\/modules\/[\w-]+/g;
			if (content.match(storeRegex)) {
				content = content.replace(storeRegex, `$lib/modules/${moduleId}/stores`);
				changed = true;
			}

			// 2. Replace $lib/components/modules/[module_name] with $lib/modules/[moduleId]/components
			const componentRegex = /\$lib\/components\/modules\/[\w-]+/g;
			if (content.match(componentRegex)) {
				content = content.replace(componentRegex, `$lib/modules/${moduleId}/components`);
				changed = true;
			}

			// 3. Replace $lib/repositories/[module_name] with $lib/modules/[moduleId]/lib/repositories
			const repoRegex = /\$lib\/repositories\/[\w-]+/g;
			if (content.match(repoRegex)) {
				content = content.replace(repoRegex, `$lib/modules/${moduleId}/lib/repositories`);
				changed = true;
			}

			// 4. Replace $lib/models/[module_name] with $lib/modules/[moduleId]/lib/models
			const modelRegex = /\$lib\/models\/[\w-]+/g;
			if (content.match(modelRegex)) {
				content = content.replace(modelRegex, `$lib/modules/${moduleId}/lib/models`);
				changed = true;
			}

			// 4.1. Replace $lib/modules/[moduleId]/models with $lib/modules/[moduleId]/lib/models
			const moduleModelRegex = new RegExp(`\\$lib/modules/${moduleId}/models`, 'g');
			if (content.match(moduleModelRegex)) {
				content = content.replace(moduleModelRegex, `$lib/modules/${moduleId}/lib/models`);
				changed = true;
			}

			// 5. Replace $lib/server/db/schema/[module_name] with $lib/modules/[moduleId]/lib/server/db/schema
			const schemaRegex = /\$lib\/server\/db\/schema\/[\w-]+/g;
			if (content.match(schemaRegex)) {
				content = content.replace(schemaRegex, `$lib/modules/${moduleId}/lib/server/db/schema`);
				changed = true;
			}

			// 6. Replace $lib/server/db with local relative path if it's a repository or schema file
			// This is a bit more complex as it depends on the file depth.
			// For now, let's handle the most common case: $lib/server/db in lib/repositories/base-repository.ts
			if (file.endsWith('base-repository.ts') && content.includes("from '$lib/server/db'")) {
				// Calculate depth to src/lib/server/db
				// modulePath is MoLOS/external_modules/MoLOS-xxx
				// file is MoLOS/external_modules/MoLOS-xxx/lib/repositories/base-repository.ts
				// src/lib/server/db is at MoLOS/src/lib/server/db
				// From external_modules/MoLOS-xxx/lib/repositories/base-repository.ts:
				// ../ (repositories)
				// ../ (lib)
				// ../ (MoLOS-xxx)
				// ../ (external_modules)
				// ../src/lib/server/db
				content = content.replace("from '$lib/server/db'", "from '../../../../../src/lib/server/db'");
				changed = true;
			}

			// 6.1. Fix $lib/server/db/utils in schema files
			if (file.includes('lib/server/db/schema/')) {
				// Handle both $lib alias and deep relative paths from standalone modules
				const dbUtilsRegex = /from\s+['"](\$lib\/server\/db\/utils|\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/src\/lib\/server\/db\/utils)['"]/g;
				if (content.match(dbUtilsRegex)) {
					// When running in core, we want to use the $lib alias which is correctly resolved
					content = content.replace(dbUtilsRegex, "from '$lib/server/db/utils'");
					changed = true;
				}
			}

			// 7. Fix TaskStatus/TaskPriority imports from schema in API routes
			if (file.includes('routes/api') && content.includes('$lib/server/db/schema/tasks/tables')) {
				content = content.replace(/\$lib\/server\/db\/schema\/tasks\/tables/g, '../../lib/models');
				changed = true;
			}

			// 8. Fix relative imports that are too deep for the core app structure
			if (content.includes('../../../../lib/modules/')) {
				content = content.replace(/\.\.\/\.\.\/\.\.\/\.\.\/lib\/modules\/([\w-]+)\/lib\/repositories/g, '$lib/modules/$1/lib/repositories');
				changed = true;
			}

			// 9. Fix direct imports from 'MoLOS' core in standalone modules
			// Modules should use relative paths or $lib aliases that are resolved by the core
			const coreImportRegex = /from\s+['"]MoLOS\/src\/lib\/server\/db['"]/g;
			if (content.match(coreImportRegex)) {
				content = content.replace(coreImportRegex, "from '$lib/server/db'");
				changed = true;
			}

			// 10. Fix $lib/modules/[moduleId]/lib/repositories -> $lib/modules/[moduleId]/repositories
			// The symlink for lib is to src/lib/modules/[id], so lib/repositories becomes [id]/repositories
			const libRepoRegex = new RegExp(`\\$lib/modules/${moduleId}/lib/repositories`, 'g');
			if (content.match(libRepoRegex)) {
				content = content.replace(libRepoRegex, `$lib/modules/${moduleId}/repositories`);
				changed = true;
			}

			if (changed) {
				console.log(`[ModuleManager] Standardized imports in ${path.relative(modulePath, file)}`);
				writeFileSync(file, content);
			}
		}
	}

	private static getAllFiles(dir: string): string[] {
		let results: string[] = [];
		const list = readdirSync(dir);
		list.forEach((file) => {
			file = path.join(dir, file);
			const stat = lstatSync(file);
			if (stat && stat.isDirectory()) {
				results = results.concat(this.getAllFiles(file));
			} else {
				results.push(file);
			}
		});
		return results;
	}

	private static createSymlink(source: string, dest: string) {
		try {
			// Use rmSync with force to remove existing file/dir/symlink (even if broken)
			rmSync(dest, { recursive: true, force: true });

			const parent = path.dirname(dest);
			if (!existsSync(parent)) {
				mkdirSync(parent, { recursive: true });
			}

			const absoluteSource = path.resolve(source);
			const absoluteDest = path.resolve(dest);

			symlinkSync(absoluteSource, absoluteDest, 'dir');
		} catch (e: unknown) {
			const errorMessage = e instanceof Error ? e.message : String(e);
			throw new Error(`Failed to create symlink from ${source} to ${dest}: ${errorMessage}`);
		}
	}

	public static cleanupOrphanedSymlinks(activeModuleIds: Set<string>) {
		const symlinkDirs = [
			this.INTERNAL_CONFIG_DIR,
			path.join(process.cwd(), 'src/lib/modules'),
			this.UI_ROUTES_DIR,
			this.API_ROUTES_DIR
		];

		for (const dir of symlinkDirs) {
			if (!existsSync(dir)) continue;

			try {
				const items = readdirSync(dir, { withFileTypes: true });
				for (const item of items) {
					const itemPath = path.join(dir, item.name);
					const isSymlink = item.isSymbolicLink();
					const isBroken = this.isBrokenSymlink(itemPath);
					const isOrphaned = !activeModuleIds.has(item.name);

					if (isSymlink && (isBroken || isOrphaned)) {
						try {
							rmSync(itemPath, { recursive: true, force: true });
							console.log(`[ModuleManager] Removed orphaned/broken symlink: ${itemPath}`);
						} catch (e) {
							console.warn(`[ModuleManager] Failed to remove ${itemPath}: ${e}`);
						}
					}
				}
			} catch (e) {
				console.warn(`[ModuleManager] Error scanning directory ${dir}: ${e}`);
			}
		}
	}

	public static cleanupModuleArtifacts(moduleId: string) {
		// Only clean up source symlinks. SvelteKit-generated artifacts (.svelte-kit) will be
		// automatically regenerated by SvelteKit, and manually removing them causes race conditions
		// where SvelteKit tries to write to directories that have been deleted.
		const paths = [
			// Source Symlinks (these need cleanup)
			path.join(this.INTERNAL_CONFIG_DIR, moduleId),
			path.join(this.UI_ROUTES_DIR, moduleId),
			path.join(this.API_ROUTES_DIR, moduleId)
		];

		for (const p of paths) {
			try {
				// Use lstatSync to detect symlinks even if they are broken (existsSync returns false for broken symlinks)
				// Also handles normal files and directories
				if (existsSync(p) || this.isBrokenSymlink(p)) {
					rmSync(p, { recursive: true, force: true });
					console.log(`[ModuleManager] Cleaned up artifact: ${p}`);
				}
			} catch {
				// Path doesn't exist or couldn't be accessed, which is fine for cleanup
			}
		}
		// Note: We do NOT clean up .svelte-kit directories. SvelteKit manages these internally
		// and removing them while the dev server is running causes file write race conditions.
	}

	private static isBrokenSymlink(p: string): boolean {
		try {
			const stats = lstatSync(p);
			if (stats.isSymbolicLink()) {
				// Check if the target exists
				return !existsSync(p);
			}
			return false;
		} catch {
			return false;
		}
	}
}
