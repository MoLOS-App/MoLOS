import {
	existsSync,
	readFileSync,
	writeFileSync,
	rmSync,
	readdirSync,
	realpathSync,
	lstatSync,
	copyFileSync,
	cpSync,
	mkdirSync,
	renameSync
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
import {
	loadRetryConfig,
	calculateRetryDelay,
	shouldRetryModule as checkShouldRetry,
	type ModuleRetryConfig
} from '../config/retry-config.js';

/**
 * Module initialization operations
 * Handles the core logic for setting up and initializing modules
 */

export class ModuleInitialization {
	private static failedModuleIds = new Set<string>();
	private static retryConfig: ModuleRetryConfig = loadRetryConfig();

	/** Configure retry behavior (overrides config file and env vars) */
	static configureRetries(config: Partial<ModuleRetryConfig>) {
		this.retryConfig = { ...this.retryConfig, ...config };
	}

	/** Reload retry configuration from file and env vars */
	static reloadRetryConfig() {
		this.retryConfig = loadRetryConfig();
	}

	static consumeFailedModules(): string[] {
		const failed = Array.from(this.failedModuleIds);
		this.failedModuleIds.clear();
		return failed;
	}

	/**
	 * Determine if an error is transient (retriable) or permanent
	 */
	private static isTransientError(error: unknown): boolean {
		if (error instanceof Error) {
			const errorMsg = error.message.toLowerCase();

			// Network-related errors (transient)
			if (
				errorMsg.includes('network') ||
				errorMsg.includes('timeout') ||
				errorMsg.includes('econnrefused') ||
				errorMsg.includes('etimedout') ||
				errorMsg.includes('enotfound') ||
				errorMsg.includes('fetch failed') ||
				errorMsg.includes('clone failed')
			) {
				return true;
			}

			// File lock errors (transient)
			if (
				errorMsg.includes('ebusy') ||
				errorMsg.includes('locked') ||
				errorMsg.includes('ebusy') ||
				errorMsg.includes('file in use')
			) {
				return true;
			}

			// Database connection issues (transient)
			if (
				errorMsg.includes('database is locked') ||
				errorMsg.includes('sqlite_busy') ||
				errorMsg.includes('connection')
			) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Calculate delay for next retry with exponential backoff
	 */
	private static calculateRetryDelay(attemptNumber: number): number {
		return calculateRetryDelay(attemptNumber, this.retryConfig);
	}

	/**
	 * Wait for specified delay
	 */
	private static async delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

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
		const wasActive = mod.status === 'active';
		const hadExistingModule = existsSync(modulePath);
		const stagingPath = path.join(ModulePaths.EXTERNAL_DIR, `.staging-${moduleId}-${Date.now()}`);
		const backupPath = hadExistingModule
			? path.join(ModulePaths.EXTERNAL_DIR, `.backup-${moduleId}-${Date.now()}`)
			: null;
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
			// For git modules with blockUpdates that are already active, skip refresh entirely
			// to preserve any local uncommitted changes
			const existingGitPath = path.join(modulePath, '.git');
			const shouldSkipRefresh =
				wasActive &&
				hadExistingModule &&
				existsSync(existingGitPath) &&
				mod.blockUpdates &&
				!isLocal;

			if (shouldSkipRefresh) {
				console.log(
					`[ModuleManager] blockUpdates enabled for ${moduleId} - skipping refresh to preserve local state`
				);
				// Just ensure symlinks are set up correctly
				this.setupSymlinks(moduleId, modulePath);
				// Update status to ensure it's marked as active
				await settingsRepo.updateExternalModuleStatus(moduleId, 'active');
				console.log(`[ModuleManager] Module ${moduleId} preserved with blockUpdates enabled.`);
				return;
			}

			// 0. Stage refresh to avoid breaking a previously-active module
			console.log(`[ModuleManager] Refreshing module ${moduleId} from ${mod.repoUrl}...`);
			if (!wasActive || !hadExistingModule) {
				cleanupModuleArtifacts(moduleId);
			}
			if (existsSync(stagingPath)) {
				rmSync(stagingPath, { recursive: true, force: true });
			}

			if (isLocal && (!localSourcePath || !existsSync(localSourcePath))) {
				throw new Error(`Local module source missing for ${moduleId}`);
			}

			if (isLocal && localSourcePath && existsSync(localSourcePath)) {
				console.log(`[ModuleManager] Using local source for ${moduleId}`);
				const isSymlink = lstatSync(localSourcePath).isSymbolicLink();
				const sourcePath = isSymlink ? realpathSync(localSourcePath) : localSourcePath;
				this.copyLocalModule(sourcePath, stagingPath);
			} else {
				if (mod.repoUrl.trim().startsWith('-')) {
					throw new Error(`Invalid repository URL for ${moduleId}`);
				}
				try {
					// For git modules with blockUpdates that are not yet active or don't have existing content,
					// we need to handle specially to prevent pulling updates
					if (mod.blockUpdates && existsSync(existingGitPath)) {
						console.log(
							`[ModuleManager] blockUpdates enabled for ${moduleId} - using existing .git folder without remote operations`
						);
						// Use the existing module directly, no staging needed
						// Just verify symlinks and update status
						this.setupSymlinks(moduleId, modulePath);
						await settingsRepo.updateExternalModuleStatus(moduleId, 'active');
						console.log(
							`[ModuleManager] Module ${moduleId} initialized with existing local state.`
						);
						return;
					}

					// If blockUpdates is enabled but there's no existing git state, we cannot proceed
					// (we can't clone because that would pull updates, and we have nothing to restore from)
					if (mod.blockUpdates) {
						console.log(
							`[ModuleManager] blockUpdates enabled for ${moduleId} but no existing .git folder found - skipping initialization to prevent pulling updates.`
						);
						// Clean up any broken symlinks and return
						cleanupModuleArtifacts(moduleId);
						return;
					}

					// Standard clone operation
					execFileSync('git', ['clone', '--depth', '1', mod.repoUrl, stagingPath], {
						stdio: 'inherit'
					});

					// Checkout the specified git ref if it exists and is not 'main'
					if (mod.gitRef && mod.gitRef !== 'main') {
						console.log(`[ModuleManager] Checking out git ref: ${mod.gitRef}`);
						try {
							execFileSync('git', ['checkout', mod.gitRef], {
								cwd: stagingPath,
								stdio: 'inherit'
							});
						} catch (checkoutError) {
							console.warn(
								`[ModuleManager] Failed to checkout ${mod.gitRef}, using default branch: ${checkoutError}`
							);
						}
					}
				} catch (cloneError) {
					throw new Error(`Failed to clone repository: ${cloneError}`);
				}
			}

			const moduleRoots = isLocal ? allowedRoots : [ModulePaths.EXTERNAL_DIR];
			if (!this.isPathWithinRoots(stagingPath, moduleRoots)) {
				throw new Error(`Module path resolves outside allowed roots: ${stagingPath}`);
			}

			// 1. Validate Manifest
			const manifestPath = path.join(stagingPath, 'manifest.yaml');
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
			this.runBasicTests(moduleId, stagingPath);

			// 3. Run Migrations
			const migrationsDir = path.join(stagingPath, 'drizzle');
			await migrationRunner.runMigrations(moduleId, migrationsDir);

			// 4. Standardize Exports
			this.standardizeModuleExports(moduleId, stagingPath);

			// 5. Swap staged module into place (rollback-capable)
			if (backupPath && existsSync(modulePath)) {
				renameSync(modulePath, backupPath);
			}
			renameSync(stagingPath, modulePath);

			// Verify .git folder exists after swap (important for forcePull functionality)
			const gitPath = path.join(modulePath, '.git');
			if (!existsSync(gitPath)) {
				console.warn(
					`[ModuleManager] WARNING: .git folder not found after swap for ${moduleId}. This may affect forcePull functionality.`
				);
			} else {
				console.log(`[ModuleManager] Verified .git folder exists for ${moduleId}`);
			}

			// 6. Setup Symlinks (Runtime check/refresh)
			this.setupSymlinks(moduleId, modulePath);

			// 7. Update Status in DB and reset retry count
			await settingsRepo.updateExternalModuleStatus(moduleId, 'active');
			await settingsRepo.resetRetryCount(moduleId);

			// 8. Cleanup backup after successful swap
			if (backupPath && existsSync(backupPath)) {
				rmSync(backupPath, { recursive: true, force: true });
			}

			console.log(`[ModuleManager] Module ${moduleId} initialized successfully.`);
			await settingsRepo.log(
				'info',
				'ModuleManager',
				`Module ${moduleId} initialized successfully.`
			);
		} catch (error: unknown) {
			if (existsSync(stagingPath)) {
				rmSync(stagingPath, { recursive: true, force: true });
			}

			const { category, message, details } = formatErrorForLogging(
				moduleId,
				error,
				'initialization'
			);
			const moduleError = createModuleError(category, message, { stack: details });

			const isTransient = this.isTransientError(error);
			const currentRetryCount = mod.retryCount || 0;
			const lastRetryAt = mod.lastRetryAt ? new Date(mod.lastRetryAt).getTime() : null;
			const shouldRetry =
				isTransient && checkShouldRetry(currentRetryCount, lastRetryAt, this.retryConfig);

			console.error(`\n[ModuleManager] ⚠️ FAILED TO INITIALIZE MODULE: ${moduleId}`);
			console.error(`[ModuleManager] Error Type: ${category}`);
			console.error(`[ModuleManager] Error: ${message}`);
			console.error(`[ModuleManager] Transient Error: ${isTransient}`);
			console.error(`[ModuleManager] Should Retry: ${shouldRetry}`);

			// Increment retry count
			await settingsRepo.incrementRetryCount(moduleId);

			await settingsRepo.log('error', 'ModuleManager', `Failed to initialize module ${moduleId}`, {
				errorType: category,
				message,
				stack: details,
				isTransient,
				shouldRetry
			});

			// If error is transient and within retry limits, don't uninstall
			if (isTransient && shouldRetry) {
				console.log(
					`[ModuleManager] Module ${moduleId} will be retried (transient error, retries remaining: ${this.retryConfig.maxRetries - (mod.retryCount || 0)})`
				);
				// Keep module in pending state for retry
				await settingsRepo.updateExternalModuleStatus(moduleId, 'pending', moduleError);

				// Clean up only staging artifacts, keep the module
				cleanupModuleArtifacts(moduleId);

				// Don't add to failed modules (will be retried on next sync)
				return;
			}

			// For permanent errors or max retries exceeded, mark for deletion
			console.error(
				`[ModuleManager] Status: Module marked as "${moduleError.status}" for manual recovery`
			);
			console.error(`[ModuleManager] Recovery Steps:`);
			moduleError.recoverySteps?.forEach((step: string) => console.error(`  - ${step}`));
			console.error('');

			// Mark the module as errored and uninstall to prevent broken startups
			await settingsRepo.updateExternalModuleStatus(
				moduleId,
				moduleError.status as any,
				moduleError
			);
			try {
				await settingsRepo.log(
					'warn',
					'ModuleManager',
					`Uninstalling module ${moduleId} due to initialization failure.`,
					{ errorType: category, message, isTransient, shouldRetry }
				);
			} catch {
				// non-fatal
			}
			try {
				cleanupModuleArtifacts(moduleId);
				if (existsSync(modulePath)) {
					rmSync(modulePath, { recursive: true, force: true });
				}
				if (backupPath && existsSync(backupPath)) {
					rmSync(backupPath, { recursive: true, force: true });
				}
				console.log(`[ModuleManager] Module ${moduleId} removed after failed initialization.`);
				await settingsRepo.log(
					'warn',
					'ModuleManager',
					`Module ${moduleId} auto-uninstalled after failed initialization.`,
					{ status: moduleError.status }
				);
			} catch (cleanupError) {
				console.warn(`[ModuleManager] Failed to cleanup artifacts for ${moduleId}:`, cleanupError);
			}
			this.failedModuleIds.add(moduleId);

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
		if (!existsSync(path.join(modulePath, 'routes'))) {
			console.warn(`[ModuleManager] Warning: Module ${moduleId} has no routes directory.`);
		}

		// 3. Check for lib directory
		if (!existsSync(path.join(modulePath, 'lib'))) {
			console.warn(`[ModuleManager] Warning: Module ${moduleId} has no lib directory.`);
		}
	}

	/**
	 * Standardize module configuration and exports
	 */
	private static standardizeModuleExports(moduleId: string, modulePath: string): void {
		const configPath = path.join(modulePath, 'config.ts');
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
