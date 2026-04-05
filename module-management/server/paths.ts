import path from 'path';
import { existsSync } from 'fs';

/**
 * Centralized path configuration for module management
 * All hardcoded paths used by the module system are defined here
 * for easy maintenance and consistency.
 *
 * Supports modules from:
 * - Local modules/ directory (development)
 * - npm-installed @molos/module-* packages
 */
export class ModulePaths {
	// Base directories
	static readonly MODULES_DIR = path.join(process.cwd(), 'modules');
	static readonly NODE_MODULES_DIR = path.join(process.cwd(), 'node_modules', '@molos');
	static readonly PARENT_DIR = path.join(process.cwd(), '..');

	/**
	 * Check if a module is an npm-installed package
	 */
	static isNpmModule(moduleId: string): boolean {
		const npmPath = path.join(this.NODE_MODULES_DIR, `module-${moduleId}`);
		return existsSync(npmPath);
	}

	/**
	 * Get the path to a module's directory
	 * Checks npm-installed modules first, then local modules/
	 */
	static getModulePath(moduleId: string): string {
		// Check for npm-installed module first
		const npmPath = path.join(this.NODE_MODULES_DIR, `module-${moduleId}`);
		if (existsSync(npmPath)) {
			return npmPath;
		}
		// Fall back to local modules directory
		return path.join(this.MODULES_DIR, moduleId);
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
		const modulePath = this.getModulePath(moduleId);
		// Check for src/config.ts first (new package structure)
		const srcConfigPath = path.join(modulePath, 'src/config.ts');
		if (existsSync(srcConfigPath)) {
			return srcConfigPath;
		}
		return path.join(modulePath, 'config.ts');
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
		const modulePath = this.getModulePath(moduleId);
		// Check for src/lib first (new package structure)
		const srcLibPath = path.join(modulePath, 'src/lib');
		if (existsSync(srcLibPath)) {
			return srcLibPath;
		}
		return path.join(modulePath, 'lib');
	}

	/**
	 * Get the path to a module's routes directory
	 */
	static getRoutesPath(moduleId: string): string {
		const modulePath = this.getModulePath(moduleId);
		// Check for src/routes first (new package structure)
		const srcRoutesPath = path.join(modulePath, 'src/routes');
		if (existsSync(srcRoutesPath)) {
			return srcRoutesPath;
		}
		return path.join(modulePath, 'routes');
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
