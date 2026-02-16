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
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'fs';
import path from 'path';

const MODULES_DIR = path.resolve('modules');
const NODE_MODULES_MOLOS_DIR = path.resolve('node_modules/@molos');
const UI_ROUTES_DIR = path.resolve('src/routes/ui/(modules)/(external_modules)');
const API_ROUTES_DIR = path.resolve('src/routes/api/(external_modules)');

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
function discoverModules(): Array<{ moduleId: string; modulePath: string }> {
	const modules: Array<{ moduleId: string; modulePath: string }> = [];

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
 * Link module routes
 */
export async function linkModuleRoutes(): Promise<void> {
	// Cleanup broken symlinks
	[UI_ROUTES_DIR, API_ROUTES_DIR].forEach((dir) => {
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
	}

	console.log(`[ModuleLinker] Linked ${linked} route directories`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	linkModuleRoutes().catch((err) => {
		console.error('[ModuleLinker] Fatal error:', err);
		process.exit(1);
	});
}
