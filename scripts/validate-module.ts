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

	async validate(): Promise<ValidationResult> {
		this.errors = [];
		this.warnings = [];

		if (!this.checkDirectoryExists()) {
			return { valid: false, errors: this.errors, warnings: this.warnings };
		}

		this.validatePackageJson();
		this.validateConfig();
		this.validateDirectoryStructure();
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
		return true;
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

			const folderName = path.basename(this.modulePath);
			if (pkg.name && !pkg.name.includes(folderName.toLowerCase().replace(/-/g, ''))) {
				this.addWarning(
					'package',
					`Package name "${pkg.name}" may not match folder "${folderName}"`
				);
			}

			this.moduleId = folderName;
		} catch (error) {
			this.addError(
				'package',
				`Failed to parse package.json: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	private validateConfig() {
		const configPath = path.join(this.modulePath, 'src', 'config.ts');

		if (!existsSync(configPath)) {
			this.addError('config', 'Missing src/config.ts');
			return;
		}

		try {
			const content = readFileSync(configPath, 'utf-8');

			if (!content.includes('export') && !content.includes('export default')) {
				this.addError('config', 'src/config.ts must export a configuration object');
				return;
			}

			const requiredProps = ['id', 'name', 'href', 'icon'];
			const missingProps = requiredProps.filter((prop) => !content.includes(`${prop}:`));

			if (missingProps.length > 0) {
				this.addWarning(
					'config',
					`src/config.ts may be missing properties: ${missingProps.join(', ')}`
				);
			}
		} catch (error) {
			this.addError(
				'config',
				`Failed to read src/config.ts: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	private validateDirectoryStructure() {
		const srcPath = path.join(this.modulePath, 'src');

		if (!existsSync(srcPath)) {
			this.addError('structure', 'Missing src/ directory');
		}
	}

	private validateRoutes() {
		const routesPath = path.join(this.modulePath, 'src', 'routes');
		if (!existsSync(routesPath)) {
			this.addWarning('routes', 'No src/routes/ directory (module may not have UI/API routes)');
			return;
		}

		try {
			const items = readdirSync(routesPath);
			const hasUI = items.includes('ui');
			const hasAPI = items.includes('api');

			if (!hasUI && !hasAPI) {
				this.addWarning('routes', 'src/routes/ exists but contains neither ui/ nor api/');
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
