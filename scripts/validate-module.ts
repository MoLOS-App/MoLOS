/**
 * Module Validation Script
 *
 * Comprehensive validation of module structure, manifest, configuration, and database schema.
 * Runs before module initialization to catch issues early.
 *
 * Usage: tsx scripts/validate-module.ts <module-path> [--fix]
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { parse } from 'yaml';
import { validateModuleManifest, formatValidationErrors } from '../src/lib/config/module-types';

interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationWarning[];
	moduleId?: string;
}

interface ValidationError {
	category: string;
	message: string;
	severity: 'error';
}

interface ValidationWarning {
	category: string;
	message: string;
	severity: 'warning';
}

class ModuleValidator {
	private modulePath: string;
	private errors: ValidationError[] = [];
	private warnings: ValidationWarning[] = [];
	private moduleId?: string;

	constructor(modulePath: string) {
		this.modulePath = modulePath;
	}

	/**
	 * Run all validation checks
	 */
	async validate(): Promise<ValidationResult> {
		this.errors = [];
		this.warnings = [];

		// 1. Check directory exists
		if (!this.checkDirectoryExists()) {
			return { valid: false, errors: this.errors, warnings: this.warnings };
		}

		// 2. Validate manifest.yaml
		this.validateManifest();

		// 3. Validate config.ts
		this.validateConfig();

		// 4. Validate directory structure
		this.validateDirectoryStructure();

		// 5. Validate package.json
		this.validatePackageJson();

		// 6. Validate database schema (drizzle)
		this.validateDatabaseSchema();

		// 7. Validate routes structure
		this.validateRoutes();

		return {
			valid: this.errors.length === 0,
			errors: this.errors,
			warnings: this.warnings,
			moduleId: this.moduleId
		};
	}

	private checkDirectoryExists(): boolean {
		if (!existsSync(this.modulePath)) {
			this.addError('structure', `Module directory does not exist: ${this.modulePath}`);
			return false;
		}
		if (!existsSync(path.join(this.modulePath, '.'))) {
			this.addError('structure', `Module directory is not accessible: ${this.modulePath}`);
			return false;
		}
		return true;
	}

	private validateManifest() {
		const manifestPath = path.join(this.modulePath, 'manifest.yaml');

		if (!existsSync(manifestPath)) {
			this.addError('manifest', 'Missing manifest.yaml in module root');
			return;
		}

		try {
			const content = readFileSync(manifestPath, 'utf-8');
			const manifest = parse(content);

			const validation = validateModuleManifest(manifest);
			if (!validation.valid) {
				const errors = formatValidationErrors(validation.error);
				errors.forEach((error) => this.addError('manifest', error));
			} else {
				this.moduleId = validation.data.id;

				// Check module ID matches folder name
				const folderName = path.basename(this.modulePath);
				if (validation.data.id !== folderName) {
					this.addError(
						'manifest',
						`Module ID "${validation.data.id}" does not match folder name "${folderName}"`
					);
				}

				// Validate version format
				if (!validation.data.version.match(/^\d+\.\d+\.\d+/)) {
					this.addError('manifest', `Invalid version format: ${validation.data.version}`);
				}
			}
		} catch (error) {
			this.addError(
				'manifest',
				`Failed to parse manifest.yaml: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	private validateConfig() {
		const configPath = path.join(this.modulePath, 'config.ts');

		if (!existsSync(configPath)) {
			this.addError('config', 'Missing config.ts in module root');
			return;
		}

		try {
			const content = readFileSync(configPath, 'utf-8');

			// Check for required exports
			if (!content.includes('export') && !content.includes('export default')) {
				this.addError('config', 'config.ts must export a configuration object');
				return;
			}

			// Basic validation that it looks like valid TypeScript
			if (
				!content.includes('moduleConfig') &&
				!content.includes('export default') &&
				!content.includes('export const')
			) {
				this.addError('config', 'config.ts does not appear to contain module configuration export');
				return;
			}

			// Check for required properties in config
			const requiredProps = ['id', 'name', 'href', 'icon', 'navigation'];
			const missingProps = requiredProps.filter((prop) => !content.includes(`${prop}:`));

			if (missingProps.length > 0) {
				this.addWarning(
					'config',
					`config.ts may be missing properties: ${missingProps.join(', ')} (this might be intentional)`
				);
			}

			// Check href format
			if (content.match(/href:\s*['"`]\/ui\//)) {
				const match = content.match(/href:\s*['"`](.+?)['"`]/);
				if (match && !match[1].startsWith('/ui/')) {
					this.addError('config', `Invalid href format: "${match[1]}" (must start with /ui/)`);
				}
			}
		} catch (error) {
			this.addError(
				'config',
				`Failed to parse config.ts: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	private validateDirectoryStructure() {
		const requiredDirs = ['routes'];
		const optionalDirs = ['lib', 'drizzle'];

		for (const dir of requiredDirs) {
			const dirPath = path.join(this.modulePath, dir);
			if (!existsSync(dirPath)) {
				this.addError('structure', `Missing required directory: ${dir}/`);
			}
		}

		for (const dir of optionalDirs) {
			const dirPath = path.join(this.modulePath, dir);
			if (!existsSync(dirPath)) {
				this.addWarning(
					'structure',
					`Missing optional directory: ${dir}/ (might be needed for your module)`
				);
			}
		}

		// Check routes structure
		const routesPath = path.join(this.modulePath, 'routes');
		if (existsSync(routesPath)) {
			if (!existsSync(path.join(routesPath, 'ui')) && !existsSync(path.join(routesPath, 'api'))) {
				this.addWarning('routes', 'routes/ directory exists but contains neither ui/ nor api/');
			}
		}
	}

	private validatePackageJson() {
		const packageJsonPath = path.join(this.modulePath, 'package.json');

		if (!existsSync(packageJsonPath)) {
			this.addError('package', 'Missing package.json');
			return;
		}

		try {
			const content = readFileSync(packageJsonPath, 'utf-8');
			const pkg = JSON.parse(content);

			if (!pkg.name) {
				this.addError('package', 'package.json missing "name" field');
			}
			if (!pkg.version) {
				this.addError('package', 'package.json missing "version" field');
			}
			if (pkg.type !== 'module') {
				this.addWarning('package', 'package.json should have "type": "module" for ES modules');
			}
		} catch (error) {
			this.addError(
				'package',
				`Failed to parse package.json: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	private validateDatabaseSchema() {
		const drizzlePath = path.join(this.modulePath, 'drizzle');
		if (!existsSync(drizzlePath)) {
			this.addWarning('database', 'No drizzle/ directory found (module has no database schema)');
			return;
		}

		try {
			const files = readdirSync(drizzlePath).filter((f) => f.endsWith('.sql'));

			if (files.length === 0) {
				this.addWarning(
					'database',
					'drizzle/ directory exists but contains no .sql migration files'
				);
				return;
			}

			// Check table naming convention
			const moduleId = this.moduleId || path.basename(this.modulePath);
			const expectedPrefix = `${moduleId}_`;

			for (const file of files) {
				const filePath = path.join(drizzlePath, file);
				const content = readFileSync(filePath, 'utf-8');

				// Check for CREATE TABLE statements
				const tableMatches = content.match(
					/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["'`]?([\w-]+)["'`]?/gi
				);

				if (tableMatches) {
					for (const match of tableMatches) {
						const tableName = match.match(/["'`]?([\w-]+)["'`]?$/)?.[1] || '';

						// Check for proper prefix
						if (!tableName.startsWith(moduleId) && !tableName.startsWith('molos_')) {
							this.addError(
								'database',
								`Table "${tableName}" in ${file} must start with "${expectedPrefix}" or "molos_"`
							);
						}
					}
				}
			}
		} catch (error) {
			this.addWarning(
				'database',
				`Failed to validate schema: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	private validateRoutes() {
		const routesPath = path.join(this.modulePath, 'routes');
		if (!existsSync(routesPath)) {
			return;
		}

		try {
			const items = readdirSync(routesPath);
			const hasUI = items.includes('ui');
			const hasAPI = items.includes('api');

			if (!hasUI && !hasAPI) {
				this.addWarning('routes', 'routes/ directory exists but contains neither ui/ nor api/');
				return;
			}

			// Check for +page.svelte in ui routes
			if (hasUI) {
				const uiPath = path.join(routesPath, 'ui');
				const items = readdirSync(uiPath);
				if (!items.some((f) => f === '+layout.svelte' || f === '+page.svelte')) {
					this.addWarning('routes', 'ui/ routes exist but no +layout.svelte or +page.svelte found');
				}
			}

			// Check for +server.ts in api routes
			if (hasAPI) {
				const apiPath = path.join(routesPath, 'api');
				if (!existsSync(path.join(apiPath, '+server.ts'))) {
					this.addWarning('routes', 'api/ routes exist but no +server.ts found');
				}
			}
		} catch (error) {
			this.addWarning(
				'routes',
				`Failed to validate routes: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	private addError(category: string, message: string) {
		this.errors.push({ category, message, severity: 'error' });
	}

	private addWarning(category: string, message: string) {
		this.warnings.push({ category, message, severity: 'warning' });
	}
}

/**
 * Format and print validation results
 */
function printResults(result: ValidationResult) {
	console.log('\n' + '='.repeat(60));
	console.log(`Module Validation: ${result.moduleId || 'Unknown'}`);
	console.log('='.repeat(60));

	if (result.errors.length > 0) {
		console.error('\n❌ ERRORS:');
		result.errors.forEach((error) => {
			console.error(`  [${error.category}] ${error.message}`);
		});
	}

	if (result.warnings.length > 0) {
		console.warn('\n⚠️  WARNINGS:');
		result.warnings.forEach((warning) => {
			console.warn(`  [${warning.category}] ${warning.message}`);
		});
	}

	if (result.valid) {
		console.log('\n✅ Module validation passed!');
	} else {
		console.error('\n❌ Module validation failed. Please fix the errors above.');
		process.exit(1);
	}

	console.log('='.repeat(60) + '\n');
}

/**
 * Main entry point
 */
async function main() {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.error('Usage: tsx scripts/validate-module.ts <module-path>');
		process.exit(1);
	}

	const modulePath = path.resolve(args[0]);
	const validator = new ModuleValidator(modulePath);

	const result = await validator.validate();
	printResults(result);

	process.exit(result.valid ? 0 : 1);
}

main().catch((error) => {
	console.error('Validation error:', error);
	process.exit(1);
});
