import {
	existsSync,
	readFileSync,
	writeFileSync,
	rmSync,
	readdirSync,
	realpathSync,
	lstatSync,
	copyFileSync,
	mkdirSync
} from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { parse } from 'yaml';
import { MigrationRunner } from './migration-runner';
import { ModulePaths } from './paths';
import {
	createSymlink,
	ensureSymlinkDirectories,
	getAllFiles,
	cleanupModuleArtifacts
} from './utils';
import { getModuleSymlinks, getModuleSymlinkSources } from '../config/symlink-config';
import { createModuleError, formatErrorForLogging } from './module-error-handler';
import type { ModuleManifest } from '../config/module-types.ts';

/**
 * Module initialization operations
 * Handles the core logic for setting up and initializing modules
 */

export class ModuleInitialization {
	private static isValidModuleId(moduleId: string): boolean {
		return /^[a-zA-Z0-9_-]+$/.test(moduleId);
	}

	private static isPathWithinRoots(targetPath: string, roots: string[]): boolean {
		let realTarget: string;
		try {
			realTarget = realpathSync(targetPath);
		} catch {
			return false;
		}

		return roots.some((root) => {
			let realRoot: string;
			try {
				realRoot = realpathSync(root);
			} catch {
				realRoot = path.resolve(root);
			}
			const relative = path.relative(realRoot, realTarget);
			return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
		});
	}

	private static resolveLocalSourcePath(repoUrl: string, moduleId: string): string | null {
		const prefix = 'local://';
		if (!repoUrl.startsWith(prefix)) {
			return null;
		}

		const pathPart = repoUrl.substring(prefix.length);
		if (!pathPart || pathPart === moduleId) {
			return path.join(ModulePaths.PARENT_DIR, moduleId);
		}

		return path.isAbsolute(pathPart) ? pathPart : path.resolve(ModulePaths.PARENT_DIR, pathPart);
	}

	private static copyLocalModule(source: string, target: string) {
		if (!existsSync(target)) {
			mkdirSync(target, { recursive: true });
		}
		const entries = readdirSync(source, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name === '.git' || entry.name === 'node_modules') continue;
			const srcPath = path.join(source, entry.name);
			const destPath = path.join(target, entry.name);
			if (entry.isDirectory()) {
				mkdirSync(destPath, { recursive: true });
				this.copyLocalModule(srcPath, destPath);
				continue;
			}
			copyFileSync(srcPath, destPath);
		}
	}

	/**
	 * Discover and register local modules in the external_modules directory
	 */
	static async discoverLocalModules(settingsRepo: any): Promise<void> {
		console.log(
			`[ModuleManager] Scanning external_modules directory for modules: ${ModulePaths.EXTERNAL_DIR}`
		);
		try {
			const items = readdirSync(ModulePaths.EXTERNAL_DIR, { withFileTypes: true });
			const molosModules = items.filter((item: any) => item.isDirectory() || item.isSymbolicLink());

			const existingModules = await settingsRepo.getExternalModules();
			const existingIds = new Set(existingModules.map((m: any) => m.id));

			for (const mod of molosModules) {
				if (!this.isValidModuleId(mod.name)) {
					console.warn(
						`[ModuleManager] Skipping module with invalid ID in external_modules: ${mod.name}`
					);
					continue;
				}
				if (!existingIds.has(mod.name)) {
					console.log(`[ModuleManager] Auto-registering local module: ${mod.name}`);
					// For local modules, we use a dummy repo URL or a local path indicator
					// Since the current logic expects a repoUrl for cloning, we'll provide a placeholder
					// but we'll need to adjust the init logic to skip cloning if it's already there
					const relativePath = path
						.relative(ModulePaths.PARENT_DIR, ModulePaths.getModulePath(mod.name))
						.split(path.sep)
						.join(path.posix.sep);
					await settingsRepo.registerExternalModule(mod.name, `local://${relativePath}`);
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
		if (!this.isValidModuleId(moduleId)) {
			throw new Error(`Invalid module ID: ${moduleId}`);
		}

		// Check if module is in an error state - skip initialization but keep in DB
		if (mod.status.startsWith('error_') || mod.status === 'disabled') {
			console.log(`[ModuleManager] Skipping module ${moduleId} (status: ${mod.status}).`);
			// Clean up any broken symlinks
			cleanupModuleArtifacts(moduleId);
			return;
		}

		// For local modules, if the source path is missing, mark for deletion
		const isLocal = mod.repoUrl.startsWith('local://');
		const localSourcePath = isLocal ? this.resolveLocalSourcePath(mod.repoUrl, moduleId) : null;
		const allowedRoots = [ModulePaths.EXTERNAL_DIR, ModulePaths.PARENT_DIR];
		if (isLocal && localSourcePath && !this.isPathWithinRoots(localSourcePath, allowedRoots)) {
			throw new Error(`Local module path is outside allowed roots: ${localSourcePath}`);
		}
		if (isLocal && !existsSync(modulePath)) {
			if (!localSourcePath || !existsSync(localSourcePath)) {
				console.log(
					`[ModuleManager] Local module ${moduleId} source missing, marking for deletion.`
				);
				await settingsRepo.updateExternalModuleStatus(mod.id, 'deleting');
				return;
			}
		}

		try {
			// 0. Clean Refresh: Remove and re-clone (unless it's a local module already in place)
			console.log(`[ModuleManager] Refreshing module ${moduleId} from ${mod.repoUrl}...`);
			cleanupModuleArtifacts(moduleId);

			if (isLocal && existsSync(modulePath) && !existsSync(localSourcePath || '')) {
				console.log(
					`[ModuleManager] Module ${moduleId} is already in external_modules, skipping refresh.`
				);
			} else if (isLocal && localSourcePath && existsSync(localSourcePath)) {
				console.log(`[ModuleManager] Using local source for ${moduleId}`);
				// Instead of symlinking, copy local source into external_modules.
				const isSymlink = lstatSync(localSourcePath).isSymbolicLink();
				const sourcePath = isSymlink ? realpathSync(localSourcePath) : localSourcePath;
				const resolvedSource = path.resolve(sourcePath);
				const resolvedTarget = path.resolve(modulePath);
				if (!isSymlink && resolvedSource === resolvedTarget) {
					console.log(
						`[ModuleManager] Module ${moduleId} already in external_modules, skipping copy.`
					);
				} else {
					if (existsSync(modulePath)) {
						rmSync(modulePath, { recursive: true, force: true });
					}
					this.copyLocalModule(sourcePath, modulePath);
				}
			} else {
				if (mod.repoUrl.trim().startsWith('-')) {
					throw new Error(`Invalid repository URL for ${moduleId}`);
				}
				if (existsSync(modulePath)) {
					rmSync(modulePath, { recursive: true, force: true });
				}
				try {
					execFileSync('git', ['clone', '--depth', '1', mod.repoUrl, modulePath], {
						stdio: 'inherit'
					});
				} catch (cloneError) {
					throw new Error(`Failed to clone repository: ${cloneError}`);
				}
			}

			const moduleRoots = isLocal ? allowedRoots : [ModulePaths.EXTERNAL_DIR];
			if (!this.isPathWithinRoots(modulePath, moduleRoots)) {
				throw new Error(`Module path resolves outside allowed roots: ${modulePath}`);
			}

			// 1. Validate Manifest
			const manifestPath = ModulePaths.getManifestPath(moduleId);
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
			const { category, message, details } = formatErrorForLogging(
				moduleId,
				error,
				'initialization'
			);
			const moduleError = createModuleError(category, message, { stack: details });

			console.error(`\n[ModuleManager] ⚠️ FAILED TO INITIALIZE MODULE: ${moduleId}`);
			console.error(`[ModuleManager] Error Type: ${category}`);
			console.error(`[ModuleManager] Error: ${message}`);
			console.error(
				`[ModuleManager] Status: Module marked as "${moduleError.status}" for manual recovery`
			);
			console.error(`[ModuleManager] Recovery Steps:`);
			moduleError.recoverySteps?.forEach((step: string) => console.error(`  - ${step}`));
			console.error('');

			await settingsRepo.log('error', 'ModuleManager', `Failed to initialize module ${moduleId}`, {
				errorType: category,
				message,
				stack: details
			});

			// Mark module in error state instead of deleting it
			await settingsRepo.updateExternalModuleStatus(
				moduleId,
				moduleError.status as any,
				moduleError
			);

			console.log(
				`[ModuleManager] Module ${moduleId} preserved in error state for inspection and recovery.`
			);

			// Cleanup symlinks and build artifacts so the module isn't partially loaded
			try {
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
		if (lstatSync(configPath).isSymbolicLink()) {
			throw new Error(`Refusing to modify symlinked config: ${configPath}`);
		}

		let content = readFileSync(configPath, 'utf-8');
		const modulePrefix = moduleId
			.replace(/^MoLOS-/i, '')
			.toLowerCase()
			.replace(/-/g, '');

		// Fix common export naming discrepancies
		if (
			content.includes('export const ') &&
			!content.includes('export const moduleConfig') &&
			!content.includes('export default')
		) {
			const match = content.match(/export const (\w+Config)/);
			if (match) {
				const configName = match[1];
				console.log(
					`[ModuleManager] Standardizing config export for ${moduleId}: ${configName} -> moduleConfig`
				);
				content += `\n\nexport const moduleConfig = ${configName};\nexport default ${configName};`;
			}
		}

		// Also fix hrefs to match the moduleId (folder name)
		const normalizedId = moduleId;
		// Match /ui/xxx or /api/xxx
		const uiHrefRegex = /href:\s*(['"])(\/ui\/[\w-/]+)\1/g;
		const apiHrefRegex = /(['"])(\/api\/[\w-/]+)\1/g;

		if (content.match(uiHrefRegex) || content.match(apiHrefRegex)) {
			console.log(`[ModuleManager] Standardizing hrefs and API calls for ${moduleId}`);
			content = content.replace(uiHrefRegex, (match, quote, full) => {
				const pathPart = full.replace('/ui/', '');
				const [first, ...rest] = pathPart.split('/');
				if (first.startsWith('MoLOS-')) return match;
				if (
					first === normalizedId ||
					first.toLowerCase() === normalizedId.toLowerCase() ||
					first.toLowerCase() === modulePrefix
				) {
					const subpath = rest.length ? `/${rest.join('/')}` : '';
					return `href: ${quote}/ui/${normalizedId}${subpath}${quote}`;
				}
				return match;
			});
			content = content.replace(apiHrefRegex, (match, quote, full) => {
				const pathPart = full.replace('/api/', '');
				const [first, ...rest] = pathPart.split('/');
				if (first.startsWith('MoLOS-')) return match;
				if (
					first === normalizedId ||
					first.toLowerCase() === normalizedId.toLowerCase() ||
					first.toLowerCase() === modulePrefix
				) {
					const subpath = rest.length ? `/${rest.join('/')}` : '';
					return `${quote}/api/${normalizedId}${subpath}${quote}`;
				}
				return match;
			});
		}

		// Fix legacy $lib paths to match external module layout
		const replaceIfModuleMatch = (regex: RegExp, basePath: string) => {
			if (!content.match(regex)) return;
			content = content.replace(regex, (match, p1) => {
				const normalized = p1?.toLowerCase();
				if (
					p1 === moduleId ||
					normalized === moduleId.toLowerCase() ||
					normalized === modulePrefix
				) {
					return `${basePath}/external_modules/${moduleId}`;
				}
				return match;
			});
		};

		replaceIfModuleMatch(/\$lib\/stores\/modules\/([\w-]+)/g, '$lib/stores');
		replaceIfModuleMatch(/\$lib\/components\/modules\/([\w-]+)/g, '$lib/components');
		replaceIfModuleMatch(/\$lib\/repositories\/([\w-]+)/g, '$lib/repositories');
		replaceIfModuleMatch(/\$lib\/models\/([\w-]+)/g, '$lib/models');
		replaceIfModuleMatch(/\$lib\/server\/db\/schema\/([\w-]+)/g, '$lib/server/db/schema');
		replaceIfModuleMatch(/\$lib\/server\/ai\/([\w-]+)/g, '$lib/server/ai');

		writeFileSync(configPath, content);

		// Also fix internal imports in all .svelte and .ts files within the module
		this.standardizeInternalImports(moduleId, modulePath);
	}

	/**
	 * Standardize internal imports within a module
	 */
	private static standardizeInternalImports(moduleId: string, modulePath: string): void {
		const files = getAllFiles(modulePath).filter(
			(f: string) => f.endsWith('.svelte') || f.endsWith('.ts')
		);
		const modulePrefix = moduleId
			.replace(/^MoLOS-/i, '')
			.toLowerCase()
			.replace(/-/g, '');

		for (const file of files) {
			let content = readFileSync(file, 'utf-8');
			let changed = false;

			// Fix corrupted external_modules paths (handle repeated module names)
			const duplicatedModuleRegex = new RegExp(`(${moduleId}/){2,}`, 'g');
			if (content.match(duplicatedModuleRegex)) {
				content = content.replaceAll(duplicatedModuleRegex, `${moduleId}/`);
				changed = true;
			}
			const duplicatedExternalModuleRegex = new RegExp(
				`\\$lib/(models|repositories|stores|components|server/ai|server/db/schema)/external_modules/${moduleId}/${moduleId}`,
				'g'
			);
			if (content.match(duplicatedExternalModuleRegex)) {
				content = content.replace(
					duplicatedExternalModuleRegex,
					`$lib/$1/external_modules/${moduleId}`
				);
				changed = true;
			}

			// Fix legacy module paths to match the external module layout
			const replaceIfModuleMatch = (regex: RegExp, basePath: string) => {
				if (!content.match(regex)) return;
				content = content.replace(regex, (match, p1) => {
					const normalized = p1?.toLowerCase();
					if (
						p1 === moduleId ||
						normalized === moduleId.toLowerCase() ||
						normalized === modulePrefix
					) {
						return `${basePath}/external_modules/${moduleId}`;
					}
					return match;
				});
				changed = true;
			};

			replaceIfModuleMatch(/\$lib\/stores\/modules\/([\w-]+)/g, '$lib/stores');
			replaceIfModuleMatch(/\$lib\/components\/modules\/([\w-]+)/g, '$lib/components');
			replaceIfModuleMatch(/\$lib\/repositories\/([\w-]+)/g, '$lib/repositories');
			replaceIfModuleMatch(/\$lib\/models\/([\w-]+)/g, '$lib/models');
			replaceIfModuleMatch(/\$lib\/server\/ai\/([\w-]+)/g, '$lib/server/ai');
			replaceIfModuleMatch(/\$lib\/server\/db\/schema\/([\w-]+)/g, '$lib/server/db/schema');

			const legacyModulePatterns: Array<[RegExp, string]> = [
				[
					new RegExp(`\\$lib/modules/${moduleId}/lib/repositories`, 'g'),
					`$lib/repositories/external_modules/${moduleId}`
				],
				[
					new RegExp(`\\$lib/modules/${moduleId}/lib/models`, 'g'),
					`$lib/models/external_modules/${moduleId}`
				],
				[
					new RegExp(`\\$lib/modules/${moduleId}/lib/stores`, 'g'),
					`$lib/stores/external_modules/${moduleId}`
				],
				[
					new RegExp(`\\$lib/modules/${moduleId}/lib/components`, 'g'),
					`$lib/components/external_modules/${moduleId}`
				],
				[
					new RegExp(`\\$lib/modules/${moduleId}/lib/server/db/schema`, 'g'),
					`$lib/server/db/schema/external_modules/${moduleId}`
				],
				[
					new RegExp(`\\$lib/modules/${moduleId}/lib/server/ai`, 'g'),
					`$lib/server/ai/external_modules/${moduleId}`
				]
			];

			for (const [regex, replacement] of legacyModulePatterns) {
				if (content.match(regex)) {
					content = content.replace(regex, replacement);
					changed = true;
				}
			}

			// Convert relative imports from routes to absolute $lib aliases
			const relativeLibRegex = /from\s+['"]\.\.\/\.\.\/lib\/([^'"]+)['"]/g;
			if (content.match(relativeLibRegex)) {
				content = content.replace(relativeLibRegex, (match, p1) => {
					if (p1.startsWith('repositories')) {
						return `from '$lib/repositories/external_modules/${moduleId}${p1.substring(12)}'`;
					}
					if (p1.startsWith('models')) {
						return `from '$lib/models/external_modules/${moduleId}${p1.substring(6)}'`;
					}
					if (p1.startsWith('stores')) {
						return `from '$lib/stores/external_modules/${moduleId}${p1.substring(6)}'`;
					}
					if (p1.startsWith('components')) {
						return `from '$lib/components/external_modules/${moduleId}${p1.substring(10)}'`;
					}
					if (p1.startsWith('server/ai')) {
						return `from '$lib/server/ai/external_modules/${moduleId}${p1.substring(9)}'`;
					}
					if (p1.startsWith('server/db/schema')) {
						return `from '$lib/server/db/schema/external_modules/${moduleId}${p1.substring(16)}'`;
					}
					return match;
				});
				changed = true;
			}

			// Fix relative imports that are missing the 'lib' part but are trying to reach it
			// e.g. import { ... } from '../../../repositories/task-repository'
			const relativeRepoRegex = /from ['"](\.\.\/)+(repositories|models|stores|components)/g;
			if (content.match(relativeRepoRegex)) {
				content = content.replace(relativeRepoRegex, (match, dots, target) => {
					return `from '$lib/${target}/external_modules/${moduleId}`;
				});
				changed = true;
			}

			// Redirect module-specific schema imports to module schema symlink
			const moduleSchemaImportRegex =
				/import\s*\{\s*([^}]+)\s*\}\s*from\s+['"]\$lib\/server\/db\/schema['"]/g;
			const schemaMatch = moduleSchemaImportRegex.exec(content);
			if (schemaMatch) {
				const imports = schemaMatch[1];
				if (imports.match(new RegExp(`\\b${modulePrefix}\\w+\\b`))) {
					content = content.replace(
						/from\s+['"]\$lib\/server\/db\/schema['"]/g,
						`from '$lib/server/db/schema/external_modules/${moduleId}'`
					);
					changed = true;
				}
			}

			if (changed) {
				console.log(`[ModuleManager] Standardized imports in ${path.relative(modulePath, file)}`);
				writeFileSync(file, content);
			}
		}
	}

	/**
	 * Setup symlinks for a module
	 */
	private static setupSymlinks(moduleId: string, modulePath: string): void {
		ensureSymlinkDirectories();

		const moduleRoot = realpathSync(modulePath);
		const destinations = getModuleSymlinks(moduleId);
		const sources = getModuleSymlinkSources(moduleId, modulePath);

		Object.entries(destinations).forEach(([key, dest]) => {
			const source = (sources as any)[key];
			if (source && dest && existsSync(source)) {
				createSymlink(source, dest, moduleRoot);
			}
		});
	}
}
