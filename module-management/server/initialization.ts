import { existsSync, execSync } from 'fs';
import path from 'path';
import { parse } from 'yaml';
import { MigrationRunner } from './migration-runner';
import { ModulePaths } from './paths';
import { createSymlink, ensureSymlinkDirectories, getAllFiles } from './utils';
import { categorizeError, createModuleError, formatErrorForLogging } from './module-error-handler';
import type { ModuleManifest } from '../config/module-types';

/**
 * Module initialization operations
 * Handles the core logic for setting up and initializing modules
 */

export class ModuleInitialization {
	/**
	 * Discover and register local modules in the external_modules directory
	 */
	static async discoverLocalModules(settingsRepo: any): Promise<void> {
		console.log(`[ModuleManager] Scanning external_modules directory for modules: ${ModulePaths.EXTERNAL_DIR}`);
		try {
			const { readdirSync } = require('fs');
			const items = readdirSync(ModulePaths.EXTERNAL_DIR, { withFileTypes: true });
			const molosModules = items.filter(
				(item: any) =>
					item.isDirectory() || item.isSymbolicLink()
			);

			const existingModules = await settingsRepo.getExternalModules();
			const existingIds = new Set(existingModules.map((m: any) => m.id));

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

	/**
	 * Initialize a single module
	 */
	static async initializeModule(
		moduleId: string,
		mod: any,
		settingsRepo: any,
		migrationRunner: MigrationRunner
	): Promise<void> {
		const modulePath = ModulePaths.getModulePath(moduleId);

		// Check if module is in an error state - skip initialization but keep in DB
		if (mod.status.startsWith('error_') || mod.status === 'disabled') {
			console.log(`[ModuleManager] Skipping module ${moduleId} (status: ${mod.status}).`);
			// Clean up any broken symlinks
			const { cleanupModuleArtifacts } = require('./utils');
			cleanupModuleArtifacts(moduleId);
			return;
		}

		// For local modules, if the symlink in external_modules was manually removed, mark for deletion
		const isLocal = mod.repoUrl.startsWith('local://');
		if (isLocal && !existsSync(modulePath)) {
			console.log(`[ModuleManager] Local module ${moduleId} symlink removed, marking for deletion.`);
			await settingsRepo.updateExternalModuleStatus(mod.id, 'deleting');
			return;
		}

		try {
			// 0. Clean Refresh: Remove and re-clone (unless it's a local module already in place)
			const localSourcePath = isLocal ? path.join(ModulePaths.PARENT_DIR, moduleId) : null;

			console.log(`[ModuleManager] Refreshing module ${moduleId} from ${mod.repoUrl}...`);
			const { cleanupModuleArtifacts } = require('./utils');
			cleanupModuleArtifacts(moduleId);

			if (isLocal && existsSync(modulePath) && !existsSync(localSourcePath || '')) {
				console.log(`[ModuleManager] Module ${moduleId} is already in external_modules, skipping refresh.`);
			} else if (isLocal && localSourcePath && existsSync(localSourcePath)) {
				console.log(`[ModuleManager] Using local source for ${moduleId}`);
				// Instead of cloning, we symlink the local source to the external_modules dir
				// to keep the rest of the logic (migrations, etc.) consistent
				const { rmSync, symlinkSync } = require('fs');
				if (existsSync(modulePath)) {
					rmSync(modulePath, { recursive: true, force: true });
				}
				symlinkSync(localSourcePath, modulePath, 'dir');
			} else {
				const { rmSync } = require('fs');
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
			const manifestPath = ModulePaths.getManifestPath(moduleId);
			if (!existsSync(manifestPath)) {
				throw new Error(`Missing manifest.yaml in ${moduleId}`);
			}

			const manifestContent = require('fs').readFileSync(manifestPath, 'utf-8');
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
			const migrationsDir = ModulePaths.getMigrationsPath(moduleId);
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
				const { cleanupModuleArtifacts } = require('./utils');
				cleanupModuleArtifacts(moduleId);
				console.log(`[ModuleManager] Cleaned up broken symlinks and artifacts for ${moduleId}`);
			} catch (cleanupError) {
				console.warn(`[ModuleManager] Failed to cleanup artifacts for ${moduleId}:`, cleanupError);
			}

			// Don't trigger reboot - other modules may still be valid
			// Only exit with error code if this is the last module being processed
		}
	}

	/**
	 * Run basic validation tests on a module
	 */
	private static runBasicTests(moduleId: string, modulePath: string): void {
		const { existsSync } = require('fs');
		// 1. Check for required files
		const required = ['manifest.yaml', 'config.ts'];
		for (const file of required) {
			if (!existsSync(path.join(modulePath, file))) {
				throw new Error(`Validation failed: Missing required file '${file}'`);
			}
		}

		// 2. Check for routes directory
		if (!existsSync(ModulePaths.getRoutesPath(moduleId))) {
			console.warn(`[ModuleManager] Warning: Module ${moduleId} has no routes directory.`);
		}

		// 3. Check for lib directory
		if (!existsSync(ModulePaths.getLibPath(moduleId))) {
			console.warn(`[ModuleManager] Warning: Module ${moduleId} has no lib directory.`);
		}
	}

	/**
	 * Standardize module configuration and exports
	 */
	private static standardizeModuleExports(moduleId: string, modulePath: string): void {
		const configPath = ModulePaths.getConfigPath(moduleId);
		if (!existsSync(configPath)) return;

		let content = require('fs').readFileSync(configPath, 'utf-8');

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

		// Fix $lib paths (simplified version - full implementation in original)
		const storeRegex = /\$lib\/stores\/modules\/([\w-]+)/g;
		if (content.match(storeRegex)) {
			content = content.replace(storeRegex, (match, p1) => {
				if (match.includes(`$lib/modules/${moduleId}`)) return match;
				const subpath = match.substring(`$lib/stores/modules/${p1}`.length);
				return `$lib/modules/${moduleId}/stores${subpath}`;
			});
		}

		require('fs').writeFileSync(configPath, content);

		// Also fix internal imports in all .svelte and .ts files within the module
		this.standardizeInternalImports(moduleId, modulePath);
	}

	/**
	 * Standardize internal imports within a module
	 */
	private static standardizeInternalImports(moduleId: string, modulePath: string): void {
		const files = getAllFiles(modulePath).filter((f: string) => f.endsWith('.svelte') || f.endsWith('.ts'));

		for (const file of files) {
			let content = require('fs').readFileSync(file, 'utf-8');
			let changed = false;

			// Simplified import standardization (full implementation in original)
			const storeRegex = /\$lib\/stores\/modules\/[\w-]+/g;
			if (content.match(storeRegex)) {
				content = content.replace(storeRegex, `$lib/modules/${moduleId}/stores`);
				changed = true;
			}

			const componentRegex = /\$lib\/components\/modules\/[\w-]+/g;
			if (content.match(componentRegex)) {
				content = content.replace(componentRegex, `$lib/modules/${moduleId}/components`);
				changed = true;
			}

			if (changed) {
				console.log(`[ModuleManager] Standardized imports in ${path.relative(modulePath, file)}`);
				require('fs').writeFileSync(file, content);
			}
		}
	}

	/**
	 * Setup symlinks for a module
	 */
	private static setupSymlinks(moduleId: string, modulePath: string): void {
		// Ensure parent directories exist
		ensureSymlinkDirectories();

		// Link config.ts to src/lib/config/modules/[id]
		const configDest = ModulePaths.getConfigSymlinkDest(moduleId);
		createSymlink(modulePath, configDest);

		// Link lib to src/lib/modules/[id]
		const libSource = ModulePaths.getLibPath(moduleId);
		if (existsSync(libSource)) {
			const libDest = ModulePaths.getLibSymlinkDest(moduleId);
			createSymlink(libSource, libDest);
		}

		// Link UI routes
		const uiSource = ModulePaths.getUIRoutesPath(moduleId);
		if (existsSync(uiSource)) {
			const uiDest = ModulePaths.getUIRoutesSymlinkDest(moduleId);
			createSymlink(uiSource, uiDest);
		}

		// Link API routes
		const apiSource = ModulePaths.getAPIRoutesPath(moduleId);
		if (existsSync(apiSource)) {
			const apiDest = ModulePaths.getAPIRoutesSymlinkDest(moduleId);
			createSymlink(apiSource, apiDest);
		}
	}
}