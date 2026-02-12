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
 * Safe external module loading with error handling
 * When a module fails to load, it's skipped and marked for auto-disable
 */
async function loadExternalConfigs(): Promise<Record<string, any>> {
	const results: Record<string, any> = {};
	const modulesToDisable: Array<{ moduleId: string; error: Error }> = [];

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

			// Queue for auto-disable (don't await to avoid blocking)
			const errorObj = error instanceof Error ? error : new Error(String(error));
			modulesToDisable.push({ moduleId, error: errorObj });
		}
	}

	// Auto-disable failed modules (async, non-blocking)
	if (modulesToDisable.length > 0) {
		markFailedModulesForDisable(modulesToDisable).catch((err) => {
			console.warn('[ModuleRegistry] Failed to auto-disable modules:', err);
		});
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

/**
 * Mark failed modules as disabled in the database
 * This is done async to avoid blocking the module loading process
 */
async function markFailedModulesForDisable(
	modules: Array<{ moduleId: string; error: Error }>
): Promise<void> {
	try {
		// Dynamic import to avoid issues at build time
		const { markModuleForDisable } = await import(
			'../../../module-management/server/module-auto-disable.js'
		);

		// Mark each failed module for disable
		for (const { moduleId, error } of modules) {
			await markModuleForDisable(moduleId, error);
		}
	} catch (err) {
		console.warn('[ModuleRegistry] Could not import auto-disable utility:', err);
	}
}

// Load external configs with error handling
const externalConfigs = await loadExternalConfigs();
const allConfigs = { ...coreConfigs, ...externalConfigs };

/**
 * Registry of all available modules
 */
export const MODULE_REGISTRY: Record<string, ModuleConfig> = Object.entries(allConfigs).reduce(
	(acc, [path, module]) => {
		// Extract module ID from path
		// './dashboard/config.ts' -> 'dashboard'
		// './external_modules/MoLOS-Tasks' -> 'MoLOS-Tasks'
		const parts = path.split('/');
		const lastPart = parts[parts.length - 1];
		const moduleId =
			lastPart === 'config.ts' ? parts[parts.length - 2] : lastPart.replace(/\.ts$/, '');

		// Find the config object in the module exports (either default or named like 'xxxConfig')
		const config =
			module.default ||
			Object.values(module).find(
				(val: any) => val && typeof val === 'object' && val.id && val.name && val.href
			);

		if (moduleId && config && config.id) {
			// Mark as external if it's in the external_modules directory
			if (path.includes('external_modules')) {
				config.isExternal = true;
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
