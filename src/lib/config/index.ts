/**
 * Module Configuration Registry
 * Central point for importing and managing all module configurations
 *
 * Modules can be loaded from:
 * - Core configs: ./dashboard/config.ts, ./settings/config.ts, etc.
 * - Package modules: from modules/ directory (local development)
 * - npm modules: from node_modules/@molos/module-{name}/src/config.ts
 *
 * Configs are loaded eagerly to prevent SSR reloads during navigation.
 *
 * Error handling: Failed modules are caught and logged, preventing
 * one bad module from breaking the entire application.
 */

import type { ModuleConfig } from './types';

/**
 * Modules that must always be loaded (cannot be filtered out by env variable)
 * These are essential for core functionality
 */
const MANDATORY_MODULES = ['dashboard', 'ai'] as const;

/**
 * Queue for modules that failed to load (processed by server hooks)
 */
export const failedModulesQueue: Array<{ moduleId: string; error: Error }> = [];

/**
 * Parse MOLOS_AUTOLOAD_MODULES environment variable
 * Returns array of module IDs to load, or null if all modules should be loaded
 *
 * For client-side exposure in Vite, use VITE_MOLOS_AUTOLOAD_MODULES
 * For server-side only, use MOLOS_AUTOLOAD_MODULES
 */
function getAutoloadModulesFilter(): string[] | null {
	// Check VITE_ prefixed version (exposed to client) first, then non-prefixed (server only)
	const env = import.meta.env.VITE_MOLOS_AUTOLOAD_MODULES || import.meta.env.MOLOS_AUTOLOAD_MODULES;
	if (!env || typeof env !== 'string') {
		return null;
	}
	return env
		.split(',')
		.map((id: string) => id.trim())
		.filter(Boolean);
}

/**
 * All module configs loaded eagerly via import.meta.glob
 * This includes:
 * - Core configs: ./dashboard/config.ts, ./settings/config.ts, etc.
 * - Package module configs: from modules/ directory
 * - npm-installed modules: from node_modules/@molos/module-XXX
 *
 * Eager loading prevents Vite from detecting "new" SSR dependencies during navigation.
 */
const allModuleConfigs = import.meta.glob(
	[
		'./**/config.ts',
		'/modules/*/src/config.ts',
		'../../node_modules/@molos/module-*/src/config.ts'
	],
	{ eager: true }
) as Record<string, any>;

/**
 * Extract module ID from import path
 * './dashboard/config.ts' -> 'dashboard'
 * '/modules/ai-knowledge/src/config.ts' -> 'ai-knowledge'
 * '/node_modules/@molos/module-finance/src/config.ts' -> 'finance'
 */
function extractModuleIdFromPath(importPath: string): string {
	// Handle npm module paths (node_modules/@molos/module-*)
	const npmModuleMatch = importPath.match(
		/\/node_modules\/@molos\/module-([^/]+)\/src\/config\.ts$/
	);
	if (npmModuleMatch) {
		return npmModuleMatch[1];
	}

	// Handle package module paths
	const moduleMatch = importPath.match(/\/modules\/([^/]+)\/src\/config\.ts$/);
	if (moduleMatch) {
		return moduleMatch[1];
	}

	// Handle core module paths
	const parts = importPath.split('/');
	const lastPart = parts[parts.length - 1];
	if (lastPart === 'config.ts') {
		return parts[parts.length - 2];
	}
	return lastPart.replace(/\.ts$/, '');
}

/**
 * Check if a path is from a package module (modules/ directory)
 */
function isPackageModulePath(importPath: string): boolean {
	return importPath.includes('/modules/') && importPath.includes('/src/config.ts');
}

/**
 * Check if a path is from an npm-installed module
 */
function isNpmModulePath(importPath: string): boolean {
	return importPath.includes('/node_modules/@molos/module-');
}

/**
 * Build the module registry with optional filtering
 * Includes error handling to prevent one bad module from breaking the entire registry
 */
function buildModuleRegistry(): Record<string, ModuleConfig> {
	const autoloadFilter = getAutoloadModulesFilter();

	return Object.entries(allModuleConfigs).reduce(
		(acc, [path, module]) => {
			const moduleId = extractModuleIdFromPath(path);

			try {
				if (!module) {
					console.warn(`[ModuleRegistry] Module ${moduleId} loaded as null/undefined`);
					failedModulesQueue.push({ moduleId, error: new Error('Module loaded as null') });
					return acc;
				}

				// Find the config object in the module exports (either default or named like 'xxxConfig')
				const config =
					module.default ||
					Object.values(module).find(
						(val: any) => val && typeof val === 'object' && val.id && val.name && val.href
					);

				if (moduleId && config && config.id) {
					// Mark as package module if it's from the modules/ directory OR npm package
					// This ensures both local modules (e.g., modules/MoLOS-Tasks) and
					// npm-installed modules (e.g., node_modules/@molos/module-tasks) are recognized
					if (isPackageModulePath(path) || isNpmModulePath(path)) {
						config.isPackageModule = true;
					}

					// Skip filter for mandatory modules (always load regardless of env filter)
					const isMandatory = MANDATORY_MODULES.includes(
						config.id as (typeof MANDATORY_MODULES)[number]
					);

					// Apply autoload filter if set (but not for mandatory modules)
					if (!isMandatory && autoloadFilter && !autoloadFilter.includes(config.id)) {
						return acc;
					}

					acc[config.id] = config;
				}
			} catch (error) {
				// Catch errors during config processing to isolate bad modules
				console.error(`[ModuleRegistry] Error processing module ${moduleId}:`, error);
				failedModulesQueue.push({
					moduleId,
					error: error instanceof Error ? error : new Error(String(error))
				});
			}
			return acc;
		},
		{} as Record<string, ModuleConfig>
	);
}

/**
 * Registry of all available modules
 * Built from eagerly-loaded configs to prevent SSR reloads
 */
export const MODULE_REGISTRY: Record<string, ModuleConfig> = buildModuleRegistry();

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
