#!/usr/bin/env tsx
/**
 * Module Route Linker Script
 *
 * Creates symlinks for module routes into the main application routes.
 * SvelteKit requires routes to be in src/routes/, so module routes are symlinked.
 *
 * Supports:
 * - Local modules in modules/ directory
 * - npm-installed @molos/module-* packages
 * - Database-aware linking with status tracking (when --with-db flag is used)
 * - Error recording and retry logic
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';

// Lazy-load database dependencies only when needed
let db: any = null;
let settingsExternalModules: any = null;
let ExternalModuleStatus: any = null;

async function loadDatabase() {
	if (db) return;
	const dbModule = await import('@molos/database');
	const schemaModule = await import('@molos/database/schema/core');
	db = dbModule.db;
	settingsExternalModules = schemaModule.settingsExternalModules;
	ExternalModuleStatus = schemaModule.ExternalModuleStatus;
}

import {
	validateModule,
	formatValidationResult,
	type ModuleValidationResult
} from '../module-management/server/validation';

const MODULES_DIR = path.resolve('modules');
const NODE_MODULES_MOLOS_DIR = path.resolve('node_modules/@molos');
const UI_ROUTES_DIR = path.resolve('src/routes/ui/(modules)/(external_modules)');
const API_ROUTES_DIR = path.resolve('src/routes/api/(external_modules)');
const LIB_MODULES_DIR = path.resolve('src/lib/modules');

// Lib subdirectories that need external_modules symlinks
const LIB_SUBDIRS = ['models', 'repositories', 'server', 'stores', 'components', 'utils'];

/**
 * Result of linking a single module
 */
export interface ModuleLinkResult {
	moduleId: string;
	success: boolean;
	error?: Error;
	errorType?: string;
	linkedPaths: string[];
	skipped: boolean;
	skipReason?: string;
	/**
	 * Validation result if validation was performed
	 */
	validation?: ModuleValidationResult;
}

/**
 * Module discovery info
 */
interface DiscoveredModule {
	moduleId: string;
	modulePath: string;
}

/**
 * Extract module ID from config file
 * Returns the module ID or falls back to folder name
 */
function extractModuleIdFromConfig(configPath: string, fallbackId: string): string {
	try {
		if (!existsSync(configPath)) {
			return fallbackId;
		}
		const content = readFileSync(configPath, 'utf-8');
		// Match id: "MoLOS-Tasks" or id: 'MoLOS-Tasks'
		const match = content.match(/id:\s*["']([^"']+)["']/);
		return match ? match[1] : fallbackId;
	} catch {
		return fallbackId;
	}
}

/**
 * Discover all available modules
 * Returns array of { moduleId, modulePath }
 */
function discoverModules(): DiscoveredModule[] {
	const modules: DiscoveredModule[] = [];

	// Discover local modules
	if (existsSync(MODULES_DIR)) {
		const localModules = readdirSync(MODULES_DIR, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => {
				const folderName = dirent.name;
				const modulePath = path.join(MODULES_DIR, folderName);
				const configPath = path.join(modulePath, 'src/config.ts');
				const moduleId = extractModuleIdFromConfig(configPath, folderName);
				return { moduleId, modulePath };
			});
		modules.push(...localModules);
	}

	// Discover npm-installed @molos/module-* packages
	if (existsSync(NODE_MODULES_MOLOS_DIR)) {
		const npmModules = readdirSync(NODE_MODULES_MOLOS_DIR, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory() && dirent.name.startsWith('module-'))
			.map((dirent) => {
				const folderName = dirent.name.replace(/^module-/, '');
				const modulePath = path.join(NODE_MODULES_MOLOS_DIR, dirent.name);
				const configPath = path.join(modulePath, 'src/config.ts');
				const moduleId = extractModuleIdFromConfig(configPath, folderName);
				return { moduleId, modulePath };
			});

		// Only add npm modules that aren't already found locally
		for (const npmModule of npmModules) {
			if (!modules.find((m) => m.moduleId === npmModule.moduleId)) {
				modules.push(npmModule);
			}
		}
	}

	return modules;
}

/**
 * Check if module should be linked based on database status
 */
async function shouldLinkModule(
	moduleId: string
): Promise<{ shouldLink: boolean; reason?: string }> {
	try {
		await loadDatabase();
		const result = await db
			.select()
			.from(settingsExternalModules)
			.where(eq(settingsExternalModules.id, moduleId))
			.limit(1);

		const module = result[0];

		if (!module) {
			// New module, should attempt linking
			return { shouldLink: true };
		}

		// Skip explicitly disabled modules
		if (module.status === ExternalModuleStatus.DISABLED) {
			return { shouldLink: false, reason: 'Module is disabled' };
		}

		// Skip modules with error status (don't auto-retry)
		if (module.status.startsWith('error_')) {
			return { shouldLink: false, reason: `Module has error status: ${module.status}` };
		}

		// Active modules can be re-linked (idempotent)
		return { shouldLink: true };
	} catch (error) {
		// If database query fails, log but allow linking attempt
		console.warn(
			`[ModuleLinker] Database query failed for ${moduleId}, allowing link attempt:`,
			error
		);
		return { shouldLink: true };
	}
}

/**
 * Categorize error based on context
 */
function categorizeError(
	error: Error,
	context: {
		hasSource: boolean;
		hasConfig: boolean;
		hasRoutes: boolean;
	}
): { errorType: string; errorDetails: Record<string, unknown> } {
	if (!context.hasSource) {
		return {
			errorType: ExternalModuleStatus.ERROR_MANIFEST,
			errorDetails: { issue: 'missing_source_directory', originalError: error.message }
		};
	}
	if (!context.hasConfig) {
		return {
			errorType: ExternalModuleStatus.ERROR_CONFIG,
			errorDetails: { issue: 'missing_config_file', originalError: error.message }
		};
	}
	if (error.message.includes('symlink') || error.message.includes('EACCES')) {
		return {
			errorType: ExternalModuleStatus.ERROR_CONFIG,
			errorDetails: { issue: 'symlink_creation_failed', originalError: error.message }
		};
	}
	return {
		errorType: ExternalModuleStatus.ERROR_CONFIG,
		errorDetails: { issue: 'unknown', originalError: error.message }
	};
}

/**
 * Register module in database if not exists
 */
async function registerModuleIfNeeded(moduleId: string, modulePath: string): Promise<void> {
	try {
		await loadDatabase();
		const result = await db
			.select()
			.from(settingsExternalModules)
			.where(eq(settingsExternalModules.id, moduleId))
			.limit(1);

		if (!result[0]) {
			// Determine repo URL from path
			let repoUrl = 'local';
			if (modulePath.includes('node_modules/@molos/')) {
				repoUrl = `npm:@molos/module-${moduleId}`;
			} else if (existsSync(path.join(modulePath, '.git'))) {
				// It's a git repo
				repoUrl = `git:${moduleId}`;
			}

			await db.insert(settingsExternalModules).values({
				id: moduleId,
				repoUrl,
				status: ExternalModuleStatus.PENDING,
				gitRef: 'main'
			});

			console.log(`[ModuleLinker] Registered new module: ${moduleId}`);
		}
	} catch (error) {
		console.warn(`[ModuleLinker] Failed to register module ${moduleId}:`, error);
		// Non-fatal, continue with linking
	}
}

/**
 * Update database with link result
 */
async function recordLinkResult(moduleId: string, result: ModuleLinkResult): Promise<void> {
	try {
		if (result.skipped) {
			// Record validation failures in the database for tracking
			if (result.validation && !result.validation.canProceed) {
				const errorDetails = result.validation.errors.map((e) => ({
					code: e.code,
					message: e.message,
					file: e.file,
					fixSuggestion: e.fixSuggestion
				}));

				await db
					.update(settingsExternalModules)
					.set({
						status: ExternalModuleStatus.ERROR_MANIFEST,
						lastError: result.skipReason || 'Validation failed',
						errorType: 'validation_failed',
						errorDetails: JSON.stringify(errorDetails),
						recoverySteps: JSON.stringify(
							result.validation.errors.filter((e) => e.fixSuggestion).map((e) => e.fixSuggestion)
						),
						retryCount: 0,
						updatedAt: new Date()
					})
					.where(eq(settingsExternalModules.id, moduleId));
			}
			// Don't update database for other skipped modules (disabled, error status)
			return;
		}

		if (result.success) {
			await db
				.update(settingsExternalModules)
				.set({
					status: ExternalModuleStatus.ACTIVE,
					lastError: null,
					errorDetails: null,
					errorType: null,
					recoverySteps: null,
					retryCount: 0,
					updatedAt: new Date()
				})
				.where(eq(settingsExternalModules.id, moduleId));
		} else if (result.errorType) {
			const { errorType, errorDetails } = categorizeError(result.error!, {
				hasSource: existsSync(path.join(MODULES_DIR, moduleId, 'src')),
				hasConfig: existsSync(path.join(MODULES_DIR, moduleId, 'src/config.ts')),
				hasRoutes: existsSync(path.join(MODULES_DIR, moduleId, 'src/routes'))
			});

			await db
				.update(settingsExternalModules)
				.set({
					status: errorType,
					lastError: result.error?.message || 'Unknown error',
					errorType,
					errorDetails: JSON.stringify(errorDetails),
					recoverySteps: JSON.stringify([
						'Check module structure is complete',
						'Ensure source directories exist',
						'Verify file permissions',
						'Re-run module sync after fixing issues'
					]),
					retryCount: 1,
					lastRetryAt: new Date(),
					updatedAt: new Date()
				})
				.where(eq(settingsExternalModules.id, moduleId));
		}
	} catch (error) {
		console.error(`[ModuleLinker] Critical: Failed to update database for ${moduleId}:`, error);
		// Database update failure is critical
		throw new Error(`Database update failed for module ${moduleId}: ${error}`);
	}
}

/**
 * Link a single module with tracking
 */
async function linkSingleModule(moduleId: string, modulePath: string): Promise<ModuleLinkResult> {
	const result: ModuleLinkResult = {
		moduleId,
		success: false,
		skipped: false,
		linkedPaths: []
	};

	try {
		// Register module in database if needed
		await registerModuleIfNeeded(moduleId, modulePath);

		// Check if we should link this module
		const shouldLink = await shouldLinkModule(moduleId);
		if (!shouldLink.shouldLink) {
			result.skipped = true;
			result.skipReason = shouldLink.reason;
			console.log(`[ModuleLinker] Skipping ${moduleId}: ${shouldLink.reason}`);
			return result;
		}

		// NEW: Validate module before attempting to link
		const validation = await validateModule(modulePath, moduleId);
		result.validation = validation;

		if (!validation.canProceed) {
			result.skipped = true;
			result.skipReason = `Validation failed: ${validation.errors.map((e) => e.message).join('; ')}`;
			console.log(`[ModuleLinker] Skipping ${moduleId}: Validation failed`);
			console.log(formatValidationResult(validation));
			return result;
		}

		if (validation.warnings.length > 0) {
			console.warn(`[ModuleLinker] Warnings for ${moduleId}:`);
			for (const warning of validation.warnings) {
				console.warn(`  - [${warning.code}] ${warning.message}`);
			}
		}

		const moduleSrcPath = path.join(modulePath, 'src');

		// Check if source directory exists
		if (!existsSync(moduleSrcPath)) {
			throw new Error(`Source directory not found: ${moduleSrcPath}`);
		}

		// Link UI routes
		const uiSource = path.join(moduleSrcPath, 'routes/ui');
		if (existsSync(uiSource)) {
			const uiDest = path.join(UI_ROUTES_DIR, moduleId);
			rmSync(uiDest, { recursive: true, force: true });
			if (!existsSync(path.dirname(uiDest))) {
				mkdirSync(path.dirname(uiDest), { recursive: true });
			}
			symlinkSync(uiSource, uiDest, 'dir');
			result.linkedPaths.push(uiDest);
		}

		// Link API routes
		const apiSource = path.join(moduleSrcPath, 'routes/api');
		if (existsSync(apiSource)) {
			const apiDest = path.join(API_ROUTES_DIR, moduleId);
			rmSync(apiDest, { recursive: true, force: true });
			if (!existsSync(path.dirname(apiDest))) {
				mkdirSync(path.dirname(apiDest), { recursive: true });
			}
			symlinkSync(apiSource, apiDest, 'dir');
			result.linkedPaths.push(apiDest);
		}

		// Link lib directory for $lib/modules/{moduleId} imports
		const libSource = path.join(moduleSrcPath, 'lib');
		if (existsSync(libSource)) {
			const libDest = path.join(LIB_MODULES_DIR, moduleId);
			rmSync(libDest, { recursive: true, force: true });
			if (!existsSync(path.dirname(libDest))) {
				mkdirSync(path.dirname(libDest), { recursive: true });
			}
			symlinkSync(libSource, libDest, 'dir');
			result.linkedPaths.push(libDest);

			// Link lib subdirectories for $lib/{subdir}/external_modules/{moduleId} imports
			for (const subdir of LIB_SUBDIRS) {
				const subSource = path.join(libSource, subdir);
				if (existsSync(subSource)) {
					const subDestDir = path.resolve(`src/lib/${subdir}/external_modules`);
					const subDest = path.join(subDestDir, moduleId);
					rmSync(subDest, { recursive: true, force: true });
					if (!existsSync(subDestDir)) {
						mkdirSync(subDestDir, { recursive: true });
					}
					symlinkSync(subSource, subDest, 'dir');
					result.linkedPaths.push(subDest);
				}
			}
		}

		// Link server directory for module server code (repositories, etc.)
		const serverSource = path.join(moduleSrcPath, 'server');
		if (existsSync(serverSource)) {
			const serverDestDir = path.resolve('src/lib/server/external_modules');
			const serverDest = path.join(serverDestDir, moduleId);
			rmSync(serverDest, { recursive: true, force: true });
			if (!existsSync(serverDestDir)) {
				mkdirSync(serverDestDir, { recursive: true });
			}
			symlinkSync(serverSource, serverDest, 'dir');
			result.linkedPaths.push(serverDest);
		}

		// Link models directory for module types/interfaces
		const modelsSource = path.join(moduleSrcPath, 'models');
		if (existsSync(modelsSource)) {
			const modelsDestDir = path.resolve('src/lib/models/external_modules');
			const modelsDest = path.join(modelsDestDir, moduleId);
			rmSync(modelsDest, { recursive: true, force: true });
			if (!existsSync(modelsDestDir)) {
				mkdirSync(modelsDestDir, { recursive: true });
			}
			symlinkSync(modelsSource, modelsDest, 'dir');
			result.linkedPaths.push(modelsDest);
		}

		result.success = true;
		console.log(
			`[ModuleLinker] Successfully linked ${moduleId} (${result.linkedPaths.length} paths)`
		);
	} catch (error) {
		result.success = false;
		result.error = error as Error;
		console.error(`[ModuleLinker] Failed to link ${moduleId}:`, error);
	}

	return result;
}

/**
 * Cleanup broken symlinks in route and lib directories
 */
function cleanupBrokenSymlinks(): void {
	const dirsToClean = [UI_ROUTES_DIR, API_ROUTES_DIR, LIB_MODULES_DIR];

	// Also clean external_modules subdirs
	for (const subdir of LIB_SUBDIRS) {
		dirsToClean.push(path.resolve(`src/lib/${subdir}/external_modules`));
	}

	dirsToClean.forEach((dir) => {
		if (existsSync(dir)) {
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				try {
					if (entry.isSymbolicLink() && !existsSync(fullPath)) {
						rmSync(fullPath, { recursive: true, force: true });
					}
				} catch {
					rmSync(fullPath, { recursive: true, force: true });
				}
			}
		}
	});
}

/**
 * Link all modules with database tracking
 *
 * This is the new main entry point that integrates with the database
 * to track module linking status and errors.
 */
export async function linkAllModules(): Promise<ModuleLinkResult[]> {
	console.log('[ModuleLinker] Starting database-aware module linking...');

	// Cleanup broken symlinks first
	cleanupBrokenSymlinks();

	// Discover all modules
	const modules = discoverModules();

	if (modules.length === 0) {
		console.log('[ModuleLinker] No modules found');
		return [];
	}

	console.log(`[ModuleLinker] Processing ${modules.length} modules...`);

	const results: ModuleLinkResult[] = [];

	// Process each module independently
	for (const { moduleId, modulePath } of modules) {
		const result = await linkSingleModule(moduleId, modulePath);
		results.push(result);

		// Record result in database
		await recordLinkResult(moduleId, result);
	}

	// Print summary
	const successful = results.filter((r) => r.success && !r.skipped);
	const failed = results.filter((r) => !r.success && !r.skipped);
	const skipped = results.filter((r) => r.skipped);

	console.log(`[ModuleLinker] Linking complete:`);
	console.log(`  - Successfully linked: ${successful.length}`);
	console.log(`  - Failed: ${failed.length}`);
	console.log(`  - Skipped: ${skipped.length}`);

	if (failed.length > 0) {
		console.warn('[ModuleLinker] Failed modules:');
		failed.forEach((r) => {
			console.warn(`  - ${r.moduleId}: ${r.error?.message}`);
		});
	}

	return results;
}

/**
 * Legacy function for backward compatibility
 *
 * @deprecated Use linkAllModules() instead for database-aware linking
 */
export async function linkModuleRoutes(): Promise<void> {
	// Cleanup broken symlinks
	cleanupBrokenSymlinks();

	const modules = discoverModules();

	if (modules.length === 0) {
		console.log('[ModuleLinker] No modules found');
		return;
	}

	console.log(`[ModuleLinker] Linking routes for ${modules.length} modules...`);

	let linked = 0;

	for (const { moduleId, modulePath } of modules) {
		const moduleSrcPath = path.join(modulePath, 'src');

		if (!existsSync(moduleSrcPath)) {
			continue;
		}

		// Link UI routes
		const uiSource = path.join(moduleSrcPath, 'routes/ui');
		if (existsSync(uiSource)) {
			const uiDest = path.join(UI_ROUTES_DIR, moduleId);
			rmSync(uiDest, { recursive: true, force: true });
			if (!existsSync(path.dirname(uiDest))) {
				mkdirSync(path.dirname(uiDest), { recursive: true });
			}
			symlinkSync(uiSource, uiDest, 'dir');
			linked++;
		}

		// Link API routes
		const apiSource = path.join(moduleSrcPath, 'routes/api');
		if (existsSync(apiSource)) {
			const apiDest = path.join(API_ROUTES_DIR, moduleId);
			rmSync(apiDest, { recursive: true, force: true });
			if (!existsSync(path.dirname(apiDest))) {
				mkdirSync(path.dirname(apiDest), { recursive: true });
			}
			symlinkSync(apiSource, apiDest, 'dir');
			linked++;
		}

		// Link lib directory for $lib/modules/{moduleId} imports
		const libSource = path.join(moduleSrcPath, 'lib');
		if (existsSync(libSource)) {
			const libDest = path.join(LIB_MODULES_DIR, moduleId);
			rmSync(libDest, { recursive: true, force: true });
			if (!existsSync(path.dirname(libDest))) {
				mkdirSync(path.dirname(libDest), { recursive: true });
			}
			symlinkSync(libSource, libDest, 'dir');
			linked++;

			// Link lib subdirectories for $lib/{subdir}/external_modules/{moduleId} imports
			for (const subdir of LIB_SUBDIRS) {
				const subSource = path.join(libSource, subdir);
				if (existsSync(subSource)) {
					const subDestDir = path.resolve(`src/lib/${subdir}/external_modules`);
					const subDest = path.join(subDestDir, moduleId);
					rmSync(subDest, { recursive: true, force: true });
					if (!existsSync(subDestDir)) {
						mkdirSync(subDestDir, { recursive: true });
					}
					symlinkSync(subSource, subDest, 'dir');
					linked++;
				}
			}
		}

		// Link server directory for module server code (repositories, etc.)
		const serverSource = path.join(moduleSrcPath, 'server');
		if (existsSync(serverSource)) {
			const serverDestDir = path.resolve('src/lib/server/external_modules');
			const serverDest = path.join(serverDestDir, moduleId);
			rmSync(serverDest, { recursive: true, force: true });
			if (!existsSync(serverDestDir)) {
				mkdirSync(serverDestDir, { recursive: true });
			}
			symlinkSync(serverSource, serverDest, 'dir');
			linked++;
		}

		// Link models directory for module types/interfaces
		const modelsSource = path.join(moduleSrcPath, 'models');
		if (existsSync(modelsSource)) {
			const modelsDestDir = path.resolve('src/lib/models/external_modules');
			const modelsDest = path.join(modelsDestDir, moduleId);
			rmSync(modelsDest, { recursive: true, force: true });
			if (!existsSync(modelsDestDir)) {
				mkdirSync(modelsDestDir, { recursive: true });
			}
			symlinkSync(modelsSource, modelsDest, 'dir');
			linked++;
		}
	}

	console.log(`[ModuleLinker] Linked ${linked} route directories`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const useNewLinking = process.argv.includes('--with-db');

	if (useNewLinking) {
		linkAllModules()
			.then((results) => {
				const failed = results.filter((r) => !r.success && !r.skipped);
				if (failed.length > 0) {
					process.exit(1);
				}
			})
			.catch((err) => {
				console.error('[ModuleLinker] Fatal error:', err);
				process.exit(1);
			});
	} else {
		linkModuleRoutes().catch((err) => {
			console.error('[ModuleLinker] Fatal error:', err);
			process.exit(1);
		});
	}
}
