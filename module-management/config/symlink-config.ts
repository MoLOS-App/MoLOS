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

	// Granular Lib Directories
	componentsDir: path.join(process.cwd(), 'src/lib/components/external_modules'),
	configDir: path.join(process.cwd(), 'src/lib/config/external_modules'),
	modelsDir: path.join(process.cwd(), 'src/lib/models/external_modules'),
	repositoriesDir: path.join(process.cwd(), 'src/lib/repositories/external_modules'),
	storesDir: path.join(process.cwd(), 'src/lib/stores/external_modules'),
	utilsDir: path.join(process.cwd(), 'src/lib/utils/external_modules'),
	serverAiDir: path.join(process.cwd(), 'src/lib/server/ai/external_modules'),
	dbSchemaDir: path.join(process.cwd(), 'src/lib/server/db/schema/external_modules'),

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
	components?: string;
	config: string;
	models?: string;
	repositories?: string;
	stores?: string;
	utils?: string;
	serverAi?: string;
	dbSchema?: string;
	uiRoutes?: string;
	apiRoutes?: string;
}

/**
 * Calculate all symlink destinations for a module
 */
export function getModuleSymlinks(moduleId: string): ModuleSymlinks {
	return {
		components: path.join(SYMLINK_CONFIG.componentsDir, moduleId),
		config: path.join(SYMLINK_CONFIG.configDir, `${moduleId}.ts`),
		models: path.join(SYMLINK_CONFIG.modelsDir, moduleId),
		repositories: path.join(SYMLINK_CONFIG.repositoriesDir, moduleId),
		stores: path.join(SYMLINK_CONFIG.storesDir, moduleId),
		utils: path.join(SYMLINK_CONFIG.utilsDir, moduleId),
		serverAi: path.join(SYMLINK_CONFIG.serverAiDir, moduleId),
		dbSchema: path.join(SYMLINK_CONFIG.dbSchemaDir, moduleId),
		uiRoutes: path.join(SYMLINK_CONFIG.uiRoutesDir, moduleId),
		apiRoutes: path.join(SYMLINK_CONFIG.apiRoutesDir, moduleId)
	};
}

/**
 * Symlink sources for a specific module (where to symlink FROM)
 */
export interface ModuleSymlinkSources {
	components?: string;
	config: string;
	models?: string;
	repositories?: string;
	stores?: string;
	utils?: string;
	serverAi?: string;
	dbSchema?: string;
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
		components: path.join(modulePath, 'lib/components'),
		config: path.join(modulePath, 'config.ts'),
		models: path.join(modulePath, 'lib/models'),
		repositories: path.join(modulePath, 'lib/repositories'),
		stores: path.join(modulePath, 'lib/stores'),
		utils: path.join(modulePath, 'lib/utils'),
		serverAi: path.join(modulePath, 'lib/server/ai'),
		dbSchema: path.join(modulePath, 'lib/server/db/schema'),
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
	MOLOS_COMPONENTS_DIR: 'componentsDir',
	MOLOS_CONFIG_DIR: 'configDir',
	MOLOS_MODELS_DIR: 'modelsDir',
	MOLOS_REPOSITORIES_DIR: 'repositoriesDir',
	MOLOS_STORES_DIR: 'storesDir',
	MOLOS_UTILS_DIR: 'utilsDir',
	MOLOS_SERVER_AI_DIR: 'serverAiDir',
	MOLOS_DB_SCHEMA_DIR: 'dbSchemaDir',
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
		SYMLINK_CONFIG.configDir,
		SYMLINK_CONFIG.componentsDir,
		SYMLINK_CONFIG.modelsDir,
		SYMLINK_CONFIG.repositoriesDir,
		SYMLINK_CONFIG.storesDir,
		SYMLINK_CONFIG.utilsDir,
		SYMLINK_CONFIG.serverAiDir,
		SYMLINK_CONFIG.dbSchemaDir
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
