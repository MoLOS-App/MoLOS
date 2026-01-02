import path from 'path';

/**
 * Centralized path configuration for module management
 * All hardcoded paths used by the module system are defined here
 * for easy maintenance and consistency.
 */
export class ModulePaths {
	// Base directories
	static readonly EXTERNAL_DIR = path.join(process.cwd(), 'external_modules');
	static readonly PARENT_DIR = path.join(process.cwd(), '..');

	// Internal MoLOS directories
	static readonly INTERNAL_CONFIG_DIR = path.join(process.cwd(), 'src/lib/config/modules');
	static readonly UI_ROUTES_DIR = path.join(
		process.cwd(),
		'src/routes/ui/(modules)/(external_modules)'
	);
	static readonly API_ROUTES_DIR = path.join(process.cwd(), 'src/routes/api/(external_modules)');
	static readonly INTERNAL_MODULES_DIR = path.join(process.cwd(), 'src/lib/modules');

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

	/**
	 * Get the symlink destination for a module's config
	 */
	static getConfigSymlinkDest(moduleId: string): string {
		return path.join(this.INTERNAL_CONFIG_DIR, moduleId);
	}

	/**
	 * Get the symlink destination for a module's lib
	 */
	static getLibSymlinkDest(moduleId: string): string {
		return path.join(this.INTERNAL_MODULES_DIR, moduleId);
	}

	/**
	 * Get the symlink destination for a module's UI routes
	 */
	static getUIRoutesSymlinkDest(moduleId: string): string {
		return path.join(this.UI_ROUTES_DIR, moduleId);
	}

	/**
	 * Get the symlink destination for a module's API routes
	 */
	static getAPIRoutesSymlinkDest(moduleId: string): string {
		return path.join(this.API_ROUTES_DIR, moduleId);
	}
}
