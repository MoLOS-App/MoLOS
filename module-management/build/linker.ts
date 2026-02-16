/**
 * Module Linker
 *
 * Handles creating, removing, and managing symlinks for external modules.
 * This is used by vite.config.ts during the build/dev process.
 */

import { existsSync, lstatSync, readdirSync, readFileSync, rmSync, mkdirSync, symlinkSync, statSync } from 'fs';
import path from 'path';
import { SYMLINK_CONFIG, getModuleSymlinks, getModuleSymlinkSources } from '../config/symlink-config';

/**
 * Create a symlink, ensuring the parent directory exists
 */
function createSymlink(target: string, linkPath: string): boolean {
	try {
		// Ensure target exists
		if (!existsSync(target)) {
			return false;
		}

		// Ensure parent directory exists
		const parentDir = path.dirname(linkPath);
		if (!existsSync(parentDir)) {
			mkdirSync(parentDir, { recursive: true });
		}

		// Remove existing link/file if present
		if (existsSync(linkPath) || lstatSync(linkPath).isSymbolicLink()) {
			rmSync(linkPath, { recursive: true, force: true });
		}

		// Create symlink
		symlinkSync(target, linkPath);
		return true;
	} catch (error) {
		console.warn(`[Linker] Failed to create symlink: ${linkPath} -> ${target}`, error);
		return false;
	}
}

/**
 * Remove a symlink if it exists
 */
function removeSymlink(linkPath: string): boolean {
	try {
		if (existsSync(linkPath) || lstatSync(linkPath).isSymbolicLink()) {
			rmSync(linkPath, { recursive: true, force: true });
			return true;
		}
		return false;
	} catch (error) {
		// File doesn't exist or can't be accessed
		return false;
	}
}

/**
 * Check if a symlink is broken (points to non-existent target)
 */
function isBrokenSymlink(linkPath: string): boolean {
	try {
		const stats = lstatSync(linkPath);
		if (stats.isSymbolicLink()) {
			// Check if target exists
			return !existsSync(linkPath);
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Link a single module
 */
function linkModule(moduleId: string): boolean {
	const modulePath = path.join(SYMLINK_CONFIG.externalModulesDir, moduleId);

	// Check module exists
	if (!existsSync(modulePath)) {
		console.warn(`[Linker] Module path does not exist: ${modulePath}`);
		return false;
	}

	const symlinks = getModuleSymlinks(moduleId);
	const sources = getModuleSymlinkSources(moduleId, modulePath);

	let success = true;

	// Link config (required)
	if (sources.config && symlinks.config) {
		if (existsSync(sources.config)) {
			if (!createSymlink(sources.config, symlinks.config)) {
				console.warn(`[Linker] Failed to link config for ${moduleId}`);
				success = false;
			}
		}
	}

	// Link optional directories
	const optionalLinks: Array<{ source?: string; target?: string; name: string }> = [
		{ source: sources.components, target: symlinks.components, name: 'components' },
		{ source: sources.models, target: symlinks.models, name: 'models' },
		{ source: sources.repositories, target: symlinks.repositories, name: 'repositories' },
		{ source: sources.stores, target: symlinks.stores, name: 'stores' },
		{ source: sources.utils, target: symlinks.utils, name: 'utils' },
		{ source: sources.serverAi, target: symlinks.serverAi, name: 'serverAi' },
		{ source: sources.dbSchema, target: symlinks.dbSchema, name: 'dbSchema' },
		{ source: sources.uiRoutes, target: symlinks.uiRoutes, name: 'uiRoutes' },
		{ source: sources.apiRoutes, target: symlinks.apiRoutes, name: 'apiRoutes' }
	];

	for (const link of optionalLinks) {
		if (link.source && link.target && existsSync(link.source)) {
			if (!createSymlink(link.source, link.target)) {
				console.warn(`[Linker] Failed to link ${link.name} for ${moduleId}`);
				// Don't mark as failure for optional links
			}
		}
	}

	return success;
}

/**
 * Unlink a single module (remove all its symlinks)
 */
function unlinkModuleById(moduleId: string): void {
	const symlinks = getModuleSymlinks(moduleId);

	// Remove all symlinks
	const allLinks = [
		symlinks.config,
		symlinks.components,
		symlinks.models,
		symlinks.repositories,
		symlinks.stores,
		symlinks.utils,
		symlinks.serverAi,
		symlinks.dbSchema,
		symlinks.uiRoutes,
		symlinks.apiRoutes
	];

	for (const linkPath of allLinks) {
		if (linkPath) {
			removeSymlink(linkPath);
		}
	}

	console.log(`[Linker] Unlinked module: ${moduleId}`);
}

/**
 * Clean up broken symlinks in all module directories
 */
function cleanupBrokenSymlinks(): number {
	let cleanedCount = 0;

	const dirsToCheck = [
		SYMLINK_CONFIG.componentsDir,
		SYMLINK_CONFIG.configDir,
		SYMLINK_CONFIG.modelsDir,
		SYMLINK_CONFIG.repositoriesDir,
		SYMLINK_CONFIG.storesDir,
		SYMLINK_CONFIG.utilsDir,
		SYMLINK_CONFIG.serverAiDir,
		SYMLINK_CONFIG.dbSchemaDir,
		SYMLINK_CONFIG.uiRoutesDir,
		SYMLINK_CONFIG.apiRoutesDir
	];

	for (const dir of dirsToCheck) {
		if (!existsSync(dir)) continue;

		try {
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				if (isBrokenSymlink(fullPath)) {
					rmSync(fullPath, { recursive: true, force: true });
					cleanedCount++;
					console.log(`[Linker] Cleaned broken symlink: ${fullPath}`);
				}
			}
		} catch (error) {
			// Ignore errors reading directories
		}
	}

	return cleanedCount;
}

/**
 * Clean up legacy symlinks (old-style symlinks that are no longer used)
 */
function cleanupLegacySymlinks(): number {
	let cleanedCount = 0;

	// Legacy symlink locations that are no longer used
	const legacyPaths = [
		// Add any legacy paths here
	];

	for (const legacyPath of legacyPaths) {
		if (existsSync(legacyPath)) {
			try {
				rmSync(legacyPath, { recursive: true, force: true });
				cleanedCount++;
				console.log(`[Linker] Cleaned legacy symlink: ${legacyPath}`);
			} catch (error) {
				// Ignore errors
			}
		}
	}

	return cleanedCount;
}

// Export the public API
export function linkModules(moduleIds: string[]): { linked: string[]; failed: string[] } {
	const linked: string[] = [];
	const failed: string[] = [];

	for (const moduleId of moduleIds) {
		if (linkModule(moduleId)) {
			linked.push(moduleId);
		} else {
			failed.push(moduleId);
		}
	}

	return { linked, failed };
}

export function unlinkModule(moduleId: string): void {
	unlinkModuleById(moduleId);
}

export { cleanupBrokenSymlinks, cleanupLegacySymlinks };
