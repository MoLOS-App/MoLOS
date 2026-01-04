import path from 'path';
import { SYMLINK_CONFIG } from '../config/symlink-config';

/**
 * Centralized path configuration for module management
 * All hardcoded paths used by the module system are defined here
 * for easy maintenance and consistency.
 */
export class ModulePaths {
	// Base directories
	static readonly EXTERNAL_DIR = SYMLINK_CONFIG.externalModulesDir;
	static readonly PARENT_DIR = SYMLINK_CONFIG.parentDir;

	/**
	 * Get the path to a module's directory in external_modules
	 */
	static getModulePath(moduleId: string): string {
		return path.join(this.EXTERNAL_DIR, moduleId);
	}

	/**
	 * Get the path to a module's manifest file
	 */
	static getManifestPath(moduleId: string): string {
		return path.join(this.getModulePath(moduleId), 'manifest.yaml');
	}

	/**
	 * Get the path to a module's config file
	 */
	static getConfigPath(moduleId: string): string {
		return path.join(this.getModulePath(moduleId), 'config.ts');
	}

	/**
	 * Get the path to a module's drizzle migrations directory
	 */
	static getMigrationsPath(moduleId: string): string {
		return path.join(this.getModulePath(moduleId), 'drizzle');
	}

	/**
	 * Get the path to a module's lib directory
	 */
	static getLibPath(moduleId: string): string {
		return path.join(this.getModulePath(moduleId), 'lib');
	}

	/**
	 * Get the path to a module's routes directory
	 */
	static getRoutesPath(moduleId: string): string {
		return path.join(this.getModulePath(moduleId), 'routes');
	}

	/**
	 * Get the path to a module's UI routes
	 */
	static getUIRoutesPath(moduleId: string): string {
		return path.join(this.getRoutesPath(moduleId), 'ui');
	}

	/**
	 * Get the path to a module's API routes
	 */
	static getAPIRoutesPath(moduleId: string): string {
		return path.join(this.getRoutesPath(moduleId), 'api');
	}
}
