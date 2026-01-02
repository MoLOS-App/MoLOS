/**
 * Module Configuration Registry
 * Central point for importing and managing all module configurations
 */

import type { ModuleConfig } from './types';

/**
 * Dynamic Module Discovery
 * Automatically imports all module configurations from subdirectories
 */
const coreConfigs = import.meta.glob('./**/config.ts', {
	eager: true
}) as Record<string, any>;

const externalConfigs = import.meta.glob('./external_modules/*.ts', {
	eager: true
}) as Record<string, any>;

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
		const moduleId =
			parts[parts.length - 1] === 'config.ts' ? parts[parts.length - 2] : parts[parts.length - 1];

		// Find the config object in the module exports (either default or named like 'xxxConfig')
		const config =
			module.default ||
			Object.values(module).find(
				(val: any) => val && typeof val === 'object' && val.id && val.name && val.href
			);

		if (moduleId && config && config.id) {
			// We'll handle isExternal marking in the load functions to avoid DB dependency here
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
