#!/usr/bin/env tsx
/**
 * Module Linker Script
 *
 * This script creates symlinks for external modules into the core application.
 * It can be run independently (via npm run module:link) or is called automatically
 * during the sync process.
 *
 * The module linking state is cached in .molo-module-links.json to avoid
 * unnecessary re-linking during development.
 */

import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
	readFileSync
} from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { SYMLINK_CONFIG } from '../module-management/config/symlink-config.js';

/**
 * Module link state file
 */
const STATE_FILE = path.resolve(process.cwd(), '.molo-module-links.json');

interface ModuleLinkState {
	linkedModules: string[];
	computedAt: string;
}

/**
 * Load the previous link state
 */
function loadLinkState(): ModuleLinkState | null {
	try {
		if (existsSync(STATE_FILE)) {
			const content = readFileSync(STATE_FILE, 'utf-8');
			return JSON.parse(content) as ModuleLinkState;
		}
	} catch (error) {
		console.warn('[ModuleLinker] Failed to load link state:', error);
	}
	return null;
}

/**
 * Save the current link state
 */
function saveLinkState(modules: string[]): void {
	try {
		const state: ModuleLinkState = {
			linkedModules: modules,
			computedAt: new Date().toISOString()
		};

		writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
	} catch (error) {
		console.warn('[ModuleLinker] Failed to save link state:', error);
	}
}

/**
 * Clear the link state (forces re-link)
 */
function clearLinkState(): void {
	try {
		if (existsSync(STATE_FILE)) {
			rmSync(STATE_FILE, { force: true });
			console.log('[ModuleLinker] Link state cleared');
		}
	} catch (error) {
		console.warn('[ModuleLinker] Failed to clear link state:', error);
	}
}

/**
 * Normalize database path
 */
function normalizeDbPath(raw: string): string {
	if (raw.startsWith('file:')) return raw.replace(/^file:/, '');
	if (raw.startsWith('sqlite://')) return raw.replace(/^sqlite:\/\//, '');
	if (raw.startsWith('sqlite:')) return raw.replace(/^sqlite:/, '');
	return raw;
}

/**
 * Quick validation for modules during linking
 */
function quickValidateModule(moduleId: string, modulePath: string): {
	valid: boolean;
	error?: string
} {
	// 1. Check manifest exists
	const manifestPath = path.join(modulePath, 'manifest.yaml');
	if (!existsSync(manifestPath)) {
		return { valid: false, error: 'Missing manifest.yaml' };
	}

	// 2. Check config exists
	const configPath = path.join(modulePath, 'config.ts');
	if (!existsSync(configPath)) {
		return { valid: false, error: 'Missing config.ts' };
	}

	// 3. Check for broken symlinks
	try {
		const stats = lstatSync(modulePath);
		if (stats.isSymbolicLink() && !existsSync(modulePath)) {
			return { valid: false, error: 'Broken symlink' };
		}
	} catch {
		return { valid: false, error: 'Cannot access module directory' };
	}

	return { valid: true };
}

/**
 * Get active modules from database (excluding disabled)
 */
function getActiveModulesFromDb(): Set<string> | null {
	const dbUrl = process.env.DATABASE_URL;
	if (!dbUrl) {
		console.warn('[ModuleLinker] DATABASE_URL not set, will link all modules');
		return null;
	}

	const dbPath = normalizeDbPath(dbUrl);

	// Check if database exists
	if (!existsSync(dbPath)) {
		console.warn('[ModuleLinker] Database does not exist yet, will link all modules');
		return null;
	}

	try {
		const require = createRequire(import.meta.url);
		const Database = require('better-sqlite3');
		const db = new Database(dbPath, { readonly: true, fileMustExist: true });
		const rows = db.prepare('select id, status from settings_external_modules').all();
		db.close();

		// Filter out disabled modules
		const activeModules = rows
			.filter((row: { status: string }) => row.status === 'active')
			.map((row: { id: string }) => row.id);

		// Log disabled modules being skipped
		const disabledModules = rows
			.filter((row: { status: string }) => row.status === 'disabled')
			.map((row: { id: string }) => row.id);

		if (disabledModules.length > 0) {
			console.log(`[ModuleLinker] Skipping ${disabledModules.length} disabled modules: ${disabledModules.join(', ')}`);
		}

		return new Set(activeModules);
	} catch (e) {
		console.warn('[ModuleLinker] Unable to read external module status from DB:', e);
		return null;
	}
}

/**
 * Mark a module as disabled in the database
 */
function markModuleDisabled(moduleId: string, error: string): void {
	const dbUrl = process.env.DATABASE_URL;
	if (!dbUrl) return;

	const dbPath = normalizeDbPath(dbUrl);

	if (!existsSync(dbPath)) {
		return;
	}

	try {
		const require = createRequire(import.meta.url);
		const Database = require('better-sqlite3');
		const db = new Database(dbPath);

		db.prepare(`
			UPDATE settings_external_modules
			SET status = 'disabled',
			    last_error = ?
			WHERE id = ?
		`).run(error, moduleId);

		db.close();
		console.warn(`[ModuleLinker] Module ${moduleId} marked as disabled: ${error}`);
	} catch (e) {
		console.warn(`[ModuleLinker] Could not mark module ${moduleId} as disabled:`, e);
	}
}

/**
 * Check if a path is within allowed roots
 */
function isPathWithinRoots(targetPath: string, roots: string[]): boolean {
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

/**
 * Main module linking function
 */
export async function linkExternalModules(
	options: { force?: boolean; verbose?: boolean } = {}
): Promise<void> {
	const { force = false, verbose = false } = options;
	const EXTERNAL_DIR = path.resolve('external_modules');
	const allowParentModules =
		process.env.MOLOS_ALLOW_PARENT_MODULES === 'true' || process.env.NODE_ENV !== 'production';
	const allowedRoots = [EXTERNAL_DIR];
	if (allowParentModules) {
		allowedRoots.push(path.resolve('..'));
	}

	const INTERNAL_CONFIG_DIR = path.resolve('src/lib/config/external_modules');
	const LEGACY_CONFIG_DIR = path.resolve('src/lib/config/modules');
	const UI_ROUTES_DIR = path.resolve('src/routes/ui/(modules)/(external_modules)');
	const API_ROUTES_DIR = path.resolve('src/routes/api/(external_modules)');
	const LIB_SYMLINK_DIRS = [
		SYMLINK_CONFIG.componentsDir,
		SYMLINK_CONFIG.modelsDir,
		SYMLINK_CONFIG.repositoriesDir,
		SYMLINK_CONFIG.storesDir,
		SYMLINK_CONFIG.utilsDir,
		SYMLINK_CONFIG.serverAiDir,
		SYMLINK_CONFIG.dbSchemaDir
	];

	// Helper to safely remove a path (including broken symlinks)
	const safeRemove = (p: string) => {
		try {
			rmSync(p, { recursive: true, force: true });
		} catch (e) {
			if (verbose) console.error(`[ModuleLinker] Failed to remove path ${p}:`, e);
		}
	};

	// 0. Cleanup broken or stale symlinks in the target directories first
	// This prevents ENOENT errors when Vite tries to stat broken links
	[
		INTERNAL_CONFIG_DIR,
		UI_ROUTES_DIR,
		API_ROUTES_DIR,
		LEGACY_CONFIG_DIR,
		...LIB_SYMLINK_DIRS
	].forEach((dir) => {
		if (existsSync(dir)) {
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				try {
					// Check if it's a symlink and if it's broken
					const stats = lstatSync(fullPath);
					if (stats.isSymbolicLink()) {
						if (!existsSync(fullPath)) {
							if (verbose) console.log(`[ModuleLinker] Removing broken symlink: ${fullPath}`);
							safeRemove(fullPath);
						} else if (dir === LEGACY_CONFIG_DIR) {
							if (verbose)
								console.log(`[ModuleLinker] Removing legacy module config symlink: ${fullPath}`);
							safeRemove(fullPath);
						}
					}
				} catch (e) {
					if (verbose) console.log(`[ModuleLinker] Error while removing path ${fullPath}:`, e);
					safeRemove(fullPath);
				}
			}
		}
	});

	if (!existsSync(EXTERNAL_DIR)) {
		console.log('[ModuleLinker] No external_modules directory found');
		saveLinkState([]);
		return;
	}

	let modules: string[] = [];
	try {
		modules = readdirSync(EXTERNAL_DIR, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory() || dirent.isSymbolicLink())
			.map((dirent) => dirent.name);
	} catch (e) {
		console.error('[ModuleLinker] Failed to read external modules directory:', e);
		return;
	}

	const activeModuleIds = getActiveModulesFromDb();
	if (activeModuleIds) {
		const pruneSymlinks = (dir: string, toModuleId: (name: string) => string) => {
			if (!existsSync(dir)) return;
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isSymbolicLink()) continue;
				const moduleId = toModuleId(entry.name);
				if (!activeModuleIds.has(moduleId)) {
					safeRemove(path.join(dir, entry.name));
				}
			}
		};

		pruneSymlinks(INTERNAL_CONFIG_DIR, (name) => name.replace(/\.ts$/, ''));
		pruneSymlinks(LEGACY_CONFIG_DIR, (name) => name.replace(/\.ts$/, ''));
		pruneSymlinks(UI_ROUTES_DIR, (name) => name);
		pruneSymlinks(API_ROUTES_DIR, (name) => name);
		LIB_SYMLINK_DIRS.forEach((dir) => pruneSymlinks(dir, (name) => name));

		modules = modules.filter((moduleId) => activeModuleIds.has(moduleId));
	}

	console.log(`[ModuleLinker] Linking ${modules.length} external modules...`);

	const linkedModules: string[] = [];

	for (const moduleId of modules) {
		if (!/^[a-zA-Z0-9_-]+$/.test(moduleId)) {
			console.warn(`[ModuleLinker] Skipping module with invalid ID: ${moduleId}`);
			continue;
		}

		const modulePath = path.join(EXTERNAL_DIR, moduleId);
		if (!isPathWithinRoots(modulePath, allowedRoots)) {
			console.warn(`[ModuleLinker] Skipping module outside allowed roots: ${moduleId}`);
			continue;
		}

		// Quick validation before linking
		const validation = quickValidateModule(moduleId, modulePath);
		if (!validation.valid) {
			console.warn(`[ModuleLinker] Skipping invalid module ${moduleId}: ${validation.error}`);
			markModuleDisabled(moduleId, validation.error || 'Validation failed');
			continue;
		}

		try {
			// 1. Link to config registry
			const configSource = path.join(modulePath, 'config.ts');
			if (existsSync(configSource)) {
				const configDest = path.join(INTERNAL_CONFIG_DIR, `${moduleId}.ts`);
				safeRemove(configDest);
				if (!existsSync(path.dirname(configDest)))
					mkdirSync(path.dirname(configDest), { recursive: true });
				symlinkSync(configSource, configDest, 'file');
			}

			// 2. Link UI routes
			const uiSource = path.join(modulePath, 'routes/ui');
			if (existsSync(uiSource)) {
				const uiDest = path.join(UI_ROUTES_DIR, moduleId);
				safeRemove(uiDest);
				if (!existsSync(path.dirname(uiDest))) mkdirSync(path.dirname(uiDest), { recursive: true });
				symlinkSync(uiSource, uiDest, 'dir');
			}

			// 3. Link API routes
			const apiSource = path.join(modulePath, 'routes/api');
			if (existsSync(apiSource)) {
				const apiDest = path.join(API_ROUTES_DIR, moduleId);
				safeRemove(apiDest);
				if (!existsSync(path.dirname(apiDest)))
					mkdirSync(path.dirname(apiDest), { recursive: true });
				symlinkSync(apiSource, apiDest, 'dir');
			}

			// 4. Link lib directories (stores, components, models, repositories, utils, server/ai, server/db/schema)
			const libMappings: Array<{ source: string; dest: string }> = [
				{
					source: path.join(modulePath, 'lib/stores'),
					dest: path.join(SYMLINK_CONFIG.storesDir, moduleId)
				},
				{
					source: path.join(modulePath, 'lib/components'),
					dest: path.join(SYMLINK_CONFIG.componentsDir, moduleId)
				},
				{
					source: path.join(modulePath, 'lib/models'),
					dest: path.join(SYMLINK_CONFIG.modelsDir, moduleId)
				},
				{
					source: path.join(modulePath, 'lib/repositories'),
					dest: path.join(SYMLINK_CONFIG.repositoriesDir, moduleId)
				},
				{
					source: path.join(modulePath, 'lib/utils'),
					dest: path.join(SYMLINK_CONFIG.utilsDir, moduleId)
				},
				{
					source: path.join(modulePath, 'lib/server/ai'),
					dest: path.join(SYMLINK_CONFIG.serverAiDir, moduleId)
				},
				{
					source: path.join(modulePath, 'lib/server/db/schema'),
					dest: path.join(SYMLINK_CONFIG.dbSchemaDir, moduleId)
				}
			];

			for (const { source, dest } of libMappings) {
				if (existsSync(source)) {
					safeRemove(dest);
					if (!existsSync(path.dirname(dest))) mkdirSync(path.dirname(dest), { recursive: true });
					symlinkSync(source, dest, 'dir');
				}
			}

			linkedModules.push(moduleId);
			if (verbose) console.log(`[ModuleLinker] ✓ Linked ${moduleId}`);
		} catch (e) {
			console.error(`[ModuleLinker] Failed to link module ${moduleId}:`, e);
		}
	}

	// Save link state
	saveLinkState(linkedModules);
	console.log(`[ModuleLinker] Successfully linked ${linkedModules.length} modules`);
}

/**
 * CLI entrypoint
 */
async function main() {
	const args = process.argv.slice(2);
	const force = args.includes('--force');
	const verbose = args.includes('--verbose') || args.includes('-v');

	if (force) {
		clearLinkState();
	}

	await linkExternalModules({ force, verbose });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error('[ModuleLinker] Fatal error:', err);
		process.exit(1);
	});
}
