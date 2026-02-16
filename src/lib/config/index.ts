/**
 * Module Configuration Registry
 * Central point for importing and managing all module configurations
 *
 * Includes safe import handling to gracefully skip modules with errors
 * and mark them for auto-disable to prevent build failures.
 */

import type { ModuleConfig } from './types';

/**
 * Dynamic Module Discovery
 * Automatically imports all module configurations from subdirectories
 */
const coreConfigs = import.meta.glob('./**/config.ts', {
	eager: true
}) as Record<string, any>;

/**
 * Queue for modules that failed to load (processed by server hooks)
 */
export const failedModulesQueue: Array<{ moduleId: string; error: Error }> = [];

/**
 * Safe external module loading with error handling
 * When a module fails to load, it's skipped and queued for auto-disable
 */
async function loadExternalConfigs(): Promise<Record<string, any>> {
	const results: Record<string, any> = {};

	// Get all external module config files
	const externalModulePaths = import.meta.glob('./external_modules/*.ts', {
		eager: false
	});

	// Load each module config with error handling
	for (const [path, importer] of Object.entries(externalModulePaths)) {
		try {
			const module = await importer();
			results[path] = module;
		} catch (error) {
			const moduleId = extractModuleIdFromPath(path);
			console.warn(`[ModuleRegistry] Failed to load module ${moduleId}:`, error);

			// Queue for auto-disable (will be processed by server hooks)
			const errorObj = error instanceof Error ? error : new Error(String(error));
			failedModulesQueue.push({ moduleId, error: errorObj });
		}
	}

	return results;
}

/**
 * Load configs from @molos/module-* packages
 * These are installed via npm workspaces and don't use symlinks
 */
async function loadPackageConfigs(): Promise<Record<string, any>> {
	const results: Record<string, any> = {};

	// Only run on server side
	if (typeof window !== 'undefined') {
		return results; // Skip on client
	}

	try {
		// Read root package.json to find module packages
		const { readFile } = await import('fs/promises');
		const packageJsonPath = new URL('../../../package.json', import.meta.url).pathname;
		const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
		const packageJson = JSON.parse(packageJsonContent);

		const packageModules = Object.keys(packageJson.dependencies || {})
			.filter(d => d.startsWith('@molos/module-'));

		console.log('[ModuleRegistry] Loading package module configs:', packageModules);

		// Load config from each package
		for (const packageName of packageModules) {
			try {
				// @vite-ignore - Dynamic import needed for package module discovery
				const config = await import(`${packageName}/config`);
				const moduleId = packageName.replace('@molos/module-', '');
				results[`package:${moduleId}`] = config;
				console.log(`[ModuleRegistry] Loaded config for package module: ${moduleId}`);
			} catch (e) {
				console.warn(`[ModuleRegistry] Failed to load config for ${packageName}:`, e);
			}
		}
	} catch (e) {
		console.warn('[ModuleRegistry] Could not load package configs:', e);
	}

	return results;
}

/**
 * Extract module ID from import path
 * './external_modules/MoLOS-Tasks.ts' -> 'MoLOS-Tasks'
 */
function extractModuleIdFromPath(importPath: string): string {
	const parts = importPath.split('/');
	const lastPart = parts[parts.length - 1];
	return lastPart.replace(/\.ts$/, '');
}

// Load external configs with error handling
const externalConfigs = await loadExternalConfigs();
const packageConfigs = await loadPackageConfigs();
const allConfigs = { ...coreConfigs, ...externalConfigs, ...packageConfigs };

/**
 * Registry of all available modules
 */
export const MODULE_REGISTRY: Record<string, ModuleConfig> = Object.entries(allConfigs).reduce(
	(acc, [path, module]) => {
		// Extract module ID from path
		// './dashboard/config.ts' -> 'dashboard'
		// './external_modules/MoLOS-Tasks' -> 'MoLOS-Tasks'
		// 'package:tasks' -> 'tasks'
		let moduleId: string;

		if (path.startsWith('package:')) {
			moduleId = path.replace('package:', '');
		} else {
			const parts = path.split('/');
			const lastPart = parts[parts.length - 1];
			moduleId =
				lastPart === 'config.ts' ? parts[parts.length - 2] : lastPart.replace(/\.ts$/, '');
		}

		// Find the config object in the module exports (either default or named like 'xxxConfig')
		const config =
			module.default ||
			Object.values(module).find(
				(val: any) => val && typeof val === 'object' && val.id && val.name && val.href
			);

		if (moduleId && config && config.id) {
			// Mark as external if it's in the external_modules directory
			if (path.includes('external_modules') || path.startsWith('package:')) {
				config.isExternal = true;
				config.isPackage = path.startsWith('package:');
			}
			acc[config.id] = config;
		}
		return acc;
	},
	{} as Record<string, ModuleConfig>
);

/**
 * Get module config by ID
 */
export function getModuleById(id: string): ModuleConfig | undefined {
	return MODULE_REGISTRY[id];
}

/**
 * Get module config by href path
 */
export function getModuleByPath(href: string): ModuleConfig | undefined {
	return Object.values(MODULE_REGISTRY).find((m) => m.href === href || href.startsWith(m.href));
}

/**
 * Get all available modules
 */
export function getAllModules(): ModuleConfig[] {
	return Object.values(MODULE_REGISTRY);
}

/**
 * Get navigation items for a specific module
 */
export function getModuleNavigation(id: string) {
	const module = MODULE_REGISTRY[id];
	return module?.navigation || [];
}

// Re-export types for convenience
export type { ModuleConfig } from './types';
export type { NavItem } from './types';
