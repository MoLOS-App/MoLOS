/**
 * Module Diagnostics & Health Monitoring
 *
 * Provides comprehensive health checks and diagnostics for modules.
 * Helps administrators and developers identify and troubleshoot issues.
 */

import { existsSync, readdirSync, lstatSync } from 'fs';
import path from 'path';
import type { SettingsRepository } from '../../repositories/settings/settings-repository';

export interface SymlinkStatus {
	path: string;
	exists: boolean;
	isBroken: boolean;
	isSymlink: boolean;
	target?: string;
}

export interface RouteStatus {
	ui: boolean;
	api: boolean;
	details: string[];
}

export interface DatabaseStatus {
	hasMigrations: boolean;
	migrationCount: number;
	files: string[];
	issues: string[];
}

export interface ModuleDiagnostics {
	moduleId: string;
	status: string;
	timestamp: string;
	health: 'healthy' | 'degraded' | 'error';

	// File system checks
	sourceExists: boolean;
	sourcePath?: string;
	sourceStats?: {
		size: number;
		files: number;
	};

	// Symlink checks
	symlinks: Record<string, SymlinkStatus>;

	// Route checks
	routes: RouteStatus;

	// Database checks
	database: DatabaseStatus;

	// Configuration checks
	config: {
		manifest: { valid: boolean; errors: string[] };
		exports: { valid: boolean; errors: string[] };
	};

	// Recent errors/logs
	recentErrors: Array<{ timestamp: string; message: string }>;

	// Recommendations
	recommendations: string[];
}

export class ModuleDiagnosticsService {
	constructor(private settingsRepo: SettingsRepository) {}

	/**
	 * Run comprehensive diagnostics on a module
	 */
	async diagnoseModule(moduleId: string): Promise<ModuleDiagnostics> {
		const externalDir = path.join(process.cwd(), 'external_modules', moduleId);
		const diagnostics: ModuleDiagnostics = {
			moduleId,
			status: 'pending',
			timestamp: new Date().toISOString(),
			health: 'healthy',
			sourceExists: false,
			symlinks: {},
			routes: { ui: false, api: false, details: [] },
			database: { hasMigrations: false, migrationCount: 0, files: [], issues: [] },
			config: { manifest: { valid: false, errors: [] }, exports: { valid: false, errors: [] } },
			recentErrors: [],
			recommendations: []
		};

		try {
			// Get module status from DB
			const moduleRecord = await this.settingsRepo.getExternalModuleById(moduleId);
			if (moduleRecord) {
				diagnostics.status = moduleRecord.status;
			}

			// 1. Check source directory
			diagnostics.sourceExists = existsSync(externalDir);
			if (diagnostics.sourceExists) {
				diagnostics.sourcePath = externalDir;
				diagnostics.sourceStats = this.getDirectoryStats(externalDir);
			} else {
				diagnostics.recommendations.push(`Module source directory not found: ${externalDir}`);
				diagnostics.health = 'error';
			}

			// 2. Check symlinks
			diagnostics.symlinks = this.checkSymlinks(moduleId);

			// 3. Check routes
			diagnostics.routes = this.checkRoutes(moduleId, externalDir);

			// 4. Check database
			diagnostics.database = this.checkDatabase(moduleId, externalDir);

			// 5. Check config
			diagnostics.config = this.checkConfiguration(moduleId, externalDir);

			// 6. Determine health status
			diagnostics.health = this.calculateHealth(diagnostics);

			// 7. Generate recommendations
			diagnostics.recommendations = this.generateRecommendations(diagnostics);
		} catch (error) {
			diagnostics.health = 'error';
			diagnostics.recommendations.push(`Failed to run diagnostics: ${error instanceof Error ? error.message : String(error)}`);
		}

		return diagnostics;
	}

	/**
	 * Check all symlinks for a module
	 */
	private checkSymlinks(moduleId: string): Record<string, SymlinkStatus> {
		const symlinks: Record<string, SymlinkStatus> = {};
		const baseDir = process.cwd();

		const locations = {
			config: path.join(baseDir, 'src/lib/config/modules', moduleId),
			lib: path.join(baseDir, 'src/lib/modules', moduleId),
			uiRoutes: path.join(baseDir, 'src/routes/ui/(modules)/(external_modules)', moduleId),
			apiRoutes: path.join(baseDir, 'src/routes/api/(external_modules)', moduleId)
		};

		for (const [key, symlinkPath] of Object.entries(locations)) {
			const status: SymlinkStatus = {
				path: symlinkPath,
				exists: existsSync(symlinkPath),
				isBroken: false,
				isSymlink: false
			};

			try {
				const stats = lstatSync(symlinkPath);
				status.isSymlink = stats.isSymbolicLink();

				if (status.isSymlink) {
					status.isBroken = !existsSync(symlinkPath);
				}
			} catch {
				status.isBroken = true;
			}

			symlinks[key] = status;
		}

		return symlinks;
	}

	/**
	 * Check route structure
	 */
	private checkRoutes(moduleId: string, modulePath: string): RouteStatus {
		const routesPath = path.join(modulePath, 'routes');
		const uiPath = path.join(routesPath, 'ui');
		const apiPath = path.join(routesPath, 'api');

		const status: RouteStatus = {
			ui: existsSync(uiPath),
			api: existsSync(apiPath),
			details: []
		};

		if (existsSync(uiPath)) {
			const files = readdirSync(uiPath);
			if (files.includes('+layout.svelte') || files.includes('+page.svelte')) {
				status.details.push('✓ UI routes have SvelteKit page/layout');
			} else {
				status.details.push('⚠️ UI routes missing SvelteKit page/layout');
			}
		}

		if (existsSync(apiPath)) {
			const hasServer = existsSync(path.join(apiPath, '+server.ts'));
			if (hasServer) {
				status.details.push('✓ API routes have +server.ts');
			} else {
				status.details.push('⚠️ API routes missing +server.ts');
			}
		}

		return status;
	}

	/**
	 * Check database schema
	 */
	private checkDatabase(moduleId: string, modulePath: string): DatabaseStatus {
		const drizzlePath = path.join(modulePath, 'drizzle');
		const status: DatabaseStatus = {
			hasMigrations: existsSync(drizzlePath),
			migrationCount: 0,
			files: [],
			issues: []
		};

		if (status.hasMigrations) {
			const files = readdirSync(drizzlePath).filter((f) => f.endsWith('.sql'));
			status.files = files;
			status.migrationCount = files.length;

			// Check for table naming issues
			for (const file of files) {
				const filePath = path.join(drizzlePath, file);
				try {
					const content = require('fs').readFileSync(filePath, 'utf-8');

					const tableMatches = content.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["'`]?(\w+)["'`]?/gi);
					if (tableMatches) {
						for (const match of tableMatches) {
							const tableName = match.match(/["'`]?(\w+)["'`]?$/)?.[1] || '';
							if (!tableName.startsWith(moduleId) && !tableName.startsWith('molos_')) {
								status.issues.push(
									`⚠️ ${file}: Table "${tableName}" doesn't follow naming convention`
								);
							}
						}
					}
				} catch (e) {
					status.issues.push(`❌ ${file}: Failed to parse`);
				}
			}
		} else {
			status.issues.push('No drizzle/ directory (module has no database schema)');
		}

		return status;
	}

	/**
	 * Check configuration files
	 */
	private checkConfiguration(
		moduleId: string,
		modulePath: string
	): { manifest: { valid: boolean; errors: string[] }; exports: { valid: boolean; errors: string[] } } {
		const fs = require('fs');
		const { parse } = require('yaml');

		const result = {
			manifest: { valid: false, errors: [] as string[] },
			exports: { valid: false, errors: [] as string[] }
		};

		// Check manifest
		const manifestPath = path.join(modulePath, 'manifest.yaml');
		if (fs.existsSync(manifestPath)) {
			try {
				const content = fs.readFileSync(manifestPath, 'utf-8');
				const manifest = parse(content);

				if (manifest.id === moduleId) {
					result.manifest.valid = true;
				} else {
					result.manifest.errors.push(`ID mismatch: manifest has "${manifest.id}", directory is "${moduleId}"`);
				}

				if (!manifest.version) {
					result.manifest.errors.push('Missing version field');
				}
			} catch (error) {
				result.manifest.errors.push(`Failed to parse: ${error instanceof Error ? error.message : String(error)}`);
			}
		} else {
			result.manifest.errors.push('Missing manifest.yaml');
		}

		// Check config exports
		const configPath = path.join(modulePath, 'config.ts');
		if (fs.existsSync(configPath)) {
			try {
				const content = fs.readFileSync(configPath, 'utf-8');

				if (content.includes('export') && (content.includes('moduleConfig') || content.includes('export default'))) {
					result.exports.valid = true;
				} else {
					result.exports.errors.push('config.ts missing moduleConfig or default export');
				}
			} catch (error) {
				result.exports.errors.push(`Failed to read: ${error instanceof Error ? error.message : String(error)}`);
			}
		} else {
			result.exports.errors.push('Missing config.ts');
		}

		return result;
	}

	/**
	 * Calculate overall health
	 */
	private calculateHealth(diagnostics: ModuleDiagnostics): 'healthy' | 'degraded' | 'error' {
		if (diagnostics.status.startsWith('error_') || diagnostics.status === 'disabled') {
			return 'error';
		}

		let issues = 0;

		// Check symlinks
		for (const symlink of Object.values(diagnostics.symlinks)) {
			if (symlink.isBroken) issues += 2;
			if (!symlink.exists) issues += 1;
		}

		// Check routes
		if (!diagnostics.routes.ui && !diagnostics.routes.api) issues += 2;

		// Check config
		if (!diagnostics.config.manifest.valid) issues += 2;
		if (!diagnostics.config.exports.valid) issues += 2;

		if (issues >= 4) return 'error';
		if (issues >= 2) return 'degraded';
		return 'healthy';
	}

	/**
	 * Generate recommendations based on diagnostics
	 */
	private generateRecommendations(diagnostics: ModuleDiagnostics): string[] {
		const recommendations: string[] = [];

		// Symlink issues
		for (const [name, symlink] of Object.entries(diagnostics.symlinks)) {
			if (symlink.isBroken) {
				recommendations.push(`Fix broken symlink: ${name} at ${symlink.path}`);
			}
			if (!symlink.exists && name !== 'lib' && name !== 'apiRoutes') {
				recommendations.push(`Create missing symlink: ${name}`);
			}
		}

		// Route issues
		if (!diagnostics.routes.ui && !diagnostics.routes.api) {
			recommendations.push('Create routes/ directory with ui/ and/or api/ subdirectories');
		}

		// Config issues
		if (!diagnostics.config.manifest.valid) {
			recommendations.push(`Fix manifest.yaml: ${diagnostics.config.manifest.errors.join(', ')}`);
		}
		if (!diagnostics.config.exports.valid) {
			recommendations.push(`Fix config.ts exports: ${diagnostics.config.exports.errors.join(', ')}`);
		}

		// Database issues
		if (diagnostics.database.issues.length > 0) {
			recommendations.push(`Fix database issues: ${diagnostics.database.issues.join(', ')}`);
		}

		return recommendations;
	}

	/**
	 * Get directory statistics
	 */
	private getDirectoryStats(dirPath: string): { size: number; files: number } {
		let size = 0;
		let files = 0;

		try {
			const walkDir = (dir: string) => {
				const items = readdirSync(dir);
				for (const item of items) {
					const itemPath = path.join(dir, item);
					const stats = lstatSync(itemPath);

					if (stats.isFile()) {
						size += stats.size;
						files += 1;
					} else if (stats.isDirectory() && !item.startsWith('.')) {
						walkDir(itemPath);
					}
				}
			};

			walkDir(dirPath);
		} catch (error) {
			// Silently fail on stat errors
		}

		return { size, files };
	}
}
