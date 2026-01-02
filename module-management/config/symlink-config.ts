/**
 * Centralized Module Symlink Configuration
 *
 * This file manages all hardcoded symlink paths used by the module system.
 * By centralizing these paths, we ensure consistency and enable easy reconfiguration
 * if the project structure changes.
 */

import path from 'path';

/**
 * Base directories
 */
export const SYMLINK_CONFIG = {
	// Base workspace directories
	workspace: process.cwd(),
	parentDir: path.join(process.cwd(), '..'),

	// Module directories
	externalModulesDir: path.join(process.cwd(), 'external_modules'),
	internalConfigDir: path.join(process.cwd(), 'src/lib/config/modules'),
	internalModulesDir: path.join(process.cwd(), 'src/lib/modules'),

	// Route directories
	uiRoutesDir: path.join(process.cwd(), 'src/routes/ui/(modules)/(external_modules)'),
	apiRoutesDir: path.join(process.cwd(), 'src/routes/api/(external_modules)'),

	// Database directories
	migrationsPattern: 'drizzle',
	moduleMigrationsDir: (moduleId: string) =>
		path.join(process.cwd(), 'external_modules', moduleId, 'drizzle'),

	// Module file patterns
	requiredFiles: ['manifest.yaml', 'config.ts'],
	optionalDirs: ['routes', 'lib', 'drizzle']
};

/**
 * Symlink destinations for a specific module
 */
export interface ModuleSymlinks {
	config: string;
	lib?: string;
	uiRoutes?: string;
	apiRoutes?: string;
}

/**
 * Calculate all symlink destinations for a module
 */
export function getModuleSymlinks(moduleId: string): ModuleSymlinks {
	return {
		config: path.join(SYMLINK_CONFIG.internalConfigDir, moduleId),
		lib: path.join(SYMLINK_CONFIG.internalModulesDir, moduleId),
		uiRoutes: path.join(SYMLINK_CONFIG.uiRoutesDir, moduleId),
		apiRoutes: path.join(SYMLINK_CONFIG.apiRoutesDir, moduleId)
	};
}

/**
 * Symlink sources for a specific module (where to symlink FROM)
 */
export interface ModuleSymlinkSources {
	config: string;
	lib?: string;
	uiRoutes?: string;
	apiRoutes?: string;
}

/**
 * Calculate all symlink sources for a module
 */
export function getModuleSymlinkSources(
	moduleId: string,
	modulePath: string
): ModuleSymlinkSources {
	return {
		config: modulePath,
		lib: path.join(modulePath, 'lib'),
		uiRoutes: path.join(modulePath, 'routes/ui'),
		apiRoutes: path.join(modulePath, 'routes/api')
	};
}

/**
 * Mapping of environment variable overrides for paths
 * Allows configuration via environment variables
 */
export const PATH_ENV_OVERRIDES: Record<string, string> = {
	MOLOS_EXTERNAL_MODULES_DIR: 'externalModulesDir',
	MOLOS_INTERNAL_CONFIG_DIR: 'internalConfigDir',
	MOLOS_INTERNAL_MODULES_DIR: 'internalModulesDir',
	MOLOS_UI_ROUTES_DIR: 'uiRoutesDir',
	MOLOS_API_ROUTES_DIR: 'apiRoutesDir'
};

/**
 * Apply environment variable overrides to configuration
 */
export function applyPathOverrides(): void {
	Object.entries(PATH_ENV_OVERRIDES).forEach(([envVar, configKey]) => {
		const envValue = process.env[envVar];
		if (envValue) {
			(SYMLINK_CONFIG as any)[configKey] = envValue;
			console.log(`[SymlinkConfig] Override from ${envVar}: ${envValue}`);
		}
	});
}

/**
 * Validate that all required directories exist
 */
export function validateSymlinkDirs(): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Check workspace
	const fs = require('fs');
	if (!fs.existsSync(SYMLINK_CONFIG.workspace)) {
		errors.push(`Workspace directory does not exist: ${SYMLINK_CONFIG.workspace}`);
	}

	// Check route directories
	[
		SYMLINK_CONFIG.uiRoutesDir,
		SYMLINK_CONFIG.apiRoutesDir,
		SYMLINK_CONFIG.internalConfigDir
	].forEach((dir) => {
		if (!fs.existsSync(dir)) {
			errors.push(`Required directory does not exist: ${dir}`);
		}
	});

	return {
		valid: errors.length === 0,
		errors
	};
}
