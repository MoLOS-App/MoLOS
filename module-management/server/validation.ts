/**
 * Module Pre-Validation System
 *
 * Validates modules before linking to catch common issues that would cause
 * runtime errors when Vite tries to load the module.
 *
 * Key validations:
 * - tsconfig.json extends check - verifies referenced paths exist
 * - Required files exist (src/config.ts)
 * - src/ directory exists
 * - Config.ts can be parsed (basic syntax check)
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';

/**
 * Validation error - prevents module from being linked
 */
export interface ValidationError {
	code: string;
	message: string;
	file?: string;
	fixSuggestion?: string;
}

/**
 * Validation warning - module can still be linked but may have issues
 */
export interface ValidationWarning {
	code: string;
	message: string;
	file?: string;
	suggestion?: string;
}

/**
 * Result of validating a module
 */
export interface ModuleValidationResult {
	valid: boolean;
	moduleId: string;
	modulePath: string;
	errors: ValidationError[];
	warnings: ValidationWarning[];
	/**
	 * true if safe to link despite warnings (no errors)
	 */
	canProceed: boolean;
}

/**
 * Validation check function type
 */
type ValidationCheck = (
	modulePath: string,
	moduleId: string
) => { errors: ValidationError[]; warnings: ValidationWarning[] };

/**
 * Check: tsconfig.json extends path exists
 *
 * If tsconfig.json has "extends": "./.svelte-kit/tsconfig.json",
 * verify that .svelte-kit/tsconfig.json exists.
 */
const checkTsconfigExtends: ValidationCheck = (modulePath, moduleId) => {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];

	const tsconfigPath = path.join(modulePath, 'tsconfig.json');

	if (!existsSync(tsconfigPath)) {
		// No tsconfig is a warning, not an error (module might work without it)
		warnings.push({
			code: 'TSCONFIG_MISSING',
			message: 'No tsconfig.json found',
			suggestion: 'Consider adding a tsconfig.json for better IDE support'
		});
		return { errors, warnings };
	}

	try {
		const content = readFileSync(tsconfigPath, 'utf-8');
		const tsconfig = JSON.parse(content);

		if (tsconfig.extends && typeof tsconfig.extends === 'string') {
			const extendsPath = tsconfig.extends;

			// Check for relative extends
			if (extendsPath.startsWith('./')) {
				const resolvedPath = path.resolve(modulePath, extendsPath);

				if (!existsSync(resolvedPath)) {
					errors.push({
						code: 'TSCONFIG_EXTENDS_MISSING',
						message: `tsconfig.json extends "${extendsPath}" but this file does not exist`,
						file: 'tsconfig.json',
						fixSuggestion:
							extendsPath.includes('.svelte-kit')
								? 'Run `bun run dev` in the module directory first to generate SvelteKit files, or remove the extends'
								: `Create the referenced file or fix the extends path`
					});
				}
			}
		}
	} catch (e) {
		warnings.push({
			code: 'TSCONFIG_PARSE_ERROR',
			message: `Failed to parse tsconfig.json: ${e instanceof Error ? e.message : String(e)}`,
			file: 'tsconfig.json',
			suggestion: 'Fix the JSON syntax in tsconfig.json'
		});
	}

	return { errors, warnings };
};

/**
 * Check: src/ directory exists
 */
const checkSourceDirectory: ValidationCheck = (modulePath, moduleId) => {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];

	const srcPath = path.join(modulePath, 'src');

	if (!existsSync(srcPath)) {
		errors.push({
			code: 'SRC_DIR_MISSING',
			message: 'Source directory (src/) not found',
			fixSuggestion: 'Create a src/ directory with your module code'
		});
	}

	return { errors, warnings };
};

/**
 * Check: src/config.ts exists and has required exports
 */
const checkConfigFile: ValidationCheck = (modulePath, moduleId) => {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];

	const configPath = path.join(modulePath, 'src/config.ts');

	if (!existsSync(configPath)) {
		errors.push({
			code: 'CONFIG_MISSING',
			message: 'Module config file (src/config.ts) not found',
			file: 'src/config.ts',
			fixSuggestion: 'Create src/config.ts with a ModuleConfig export'
		});
		return { errors, warnings };
	}

	try {
		const content = readFileSync(configPath, 'utf-8');

		// Basic syntax checks (without full TypeScript parsing)
		// Check for id property
		if (!content.includes('id:')) {
			warnings.push({
				code: 'CONFIG_NO_ID',
				message: 'Config file does not appear to have an "id" property',
				file: 'src/config.ts',
				suggestion: 'Ensure the config exports an object with an "id" property'
			});
		}

		// Check for obvious syntax errors (unclosed braces, brackets, parens)
		const openBraces = (content.match(/{/g) || []).length;
		const closeBraces = (content.match(/}/g) || []).length;
		const openBrackets = (content.match(/\[/g) || []).length;
		const closeBrackets = (content.match(/\]/g) || []).length;
		const openParens = (content.match(/\(/g) || []).length;
		const closeParens = (content.match(/\)/g) || []).length;

		if (openBraces !== closeBraces || openBrackets !== closeBrackets || openParens !== closeParens) {
			errors.push({
				code: 'CONFIG_SYNTAX_ERROR',
				message: 'Config file appears to have unbalanced braces, brackets, or parentheses',
				file: 'src/config.ts',
				fixSuggestion: 'Check for syntax errors in the config file'
			});
		}
	} catch (e) {
		errors.push({
			code: 'CONFIG_READ_ERROR',
			message: `Failed to read config file: ${e instanceof Error ? e.message : String(e)}`,
			file: 'src/config.ts',
			fixSuggestion: 'Ensure the file exists and is readable'
		});
	}

	return { errors, warnings };
};

/**
 * Check: package.json exists (optional but recommended)
 */
const checkPackageJson: ValidationCheck = (modulePath, moduleId) => {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];

	const packagePath = path.join(modulePath, 'package.json');

	if (!existsSync(packagePath)) {
		warnings.push({
			code: 'PACKAGE_JSON_MISSING',
			message: 'No package.json found',
			suggestion: 'Consider adding a package.json for dependency management'
		});
	}

	return { errors, warnings };
};

/**
 * Check: drizzle.config.ts exists if module has database schema
 */
const checkDrizzleConfig: ValidationCheck = (modulePath, moduleId) => {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];

	const drizzlePath = path.join(modulePath, 'drizzle.config.ts');
	const schemaPath = path.join(modulePath, 'src/server/database/schema.ts');
	const altSchemaPath = path.join(modulePath, 'src/lib/server/database/schema.ts');

	const hasSchema = existsSync(schemaPath) || existsSync(altSchemaPath);
	const hasDrizzleConfig = existsSync(drizzlePath);

	if (hasSchema && !hasDrizzleConfig) {
		warnings.push({
			code: 'DRIZZLE_CONFIG_MISSING',
			message: 'Module has database schema but no drizzle.config.ts',
			suggestion: 'Add a drizzle.config.ts for database migrations'
		});
	}

	return { errors, warnings };
};

/**
 * Check: Database table naming convention
 *
 * Tables must follow: MoLOS-{ModuleName}_{table_name}
 * - Module ID uses HYPHENS: MoLOS-LLM-Council
 * - Separator is UNDERSCORE: _
 * - Table name uses UNDERSCORES: conversations
 *
 * Example: MoLOS-LLM-Council_conversations
 */
const checkTableNamingConvention: ValidationCheck = (modulePath, moduleId) => {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];

	// Check common schema locations
	const schemaPaths = [
		path.join(modulePath, 'src/server/database/schema'),
		path.join(modulePath, 'src/server/db/schema'),
		path.join(modulePath, 'src/lib/server/database/schema')
	];

	let schemaContent = '';
	let foundSchemaPath = '';

	for (const schemaDir of schemaPaths) {
		// Try both .ts files and subdirectories with tables.ts
		const possibleFiles = [
			path.join(schemaDir + '.ts'),
			path.join(schemaDir, 'tables.ts'),
			path.join(schemaDir, 'index.ts')
		];

		for (const filePath of possibleFiles) {
			if (existsSync(filePath)) {
				try {
					schemaContent = readFileSync(filePath, 'utf-8');
					foundSchemaPath = filePath;
					break;
				} catch {
					// Continue to next file
				}
			}
		}
		if (schemaContent) break;
	}

	if (!schemaContent) {
		// No schema found - that's fine, module might not have database tables
		return { errors, warnings };
	}

	// Extract table names from sqliteTable("TableName", ...) calls
	// Match patterns like: sqliteTable("MoLOS-Module_table", or sqliteTable('MoLOS-Module_table',
	const tableMatches = schemaContent.matchAll(/sqliteTable\s*\(\s*["']([^"']+)["']/g);

	for (const match of tableMatches) {
		const tableName = match[1];

		// Check if table starts with module ID
		const expectedPrefix = `${moduleId}_`;
		if (!tableName.startsWith(expectedPrefix)) {
			// Check if they used underscores instead of hyphens in module ID
			const underscoreModuleId = moduleId.replace(/-/g, '_');
			if (tableName.startsWith(`${underscoreModuleId}_`)) {
				errors.push({
					code: 'TABLE_NAMING_UNDERSCORES',
					message: `Table "${tableName}" uses underscores in module ID. Use hyphens: "${moduleId}_${tableName.slice(underscoreModuleId.length + 1)}"`,
					file: foundSchemaPath.replace(modulePath + '/', ''),
					fixSuggestion: `Change table name from "${tableName}" to "${moduleId}_${tableName.slice(underscoreModuleId.length + 1)}" (use hyphens in module ID, underscore separator, then table name)`
				});
			} else if (!tableName.startsWith(moduleId)) {
				warnings.push({
					code: 'TABLE_NAMING_NO_PREFIX',
					message: `Table "${tableName}" does not start with module ID "${moduleId}_"`,
					file: foundSchemaPath.replace(modulePath + '/', ''),
					suggestion: `Rename to "${moduleId}_${tableName}" following the naming convention`
				});
			}
		}
	}

	return { errors, warnings };
};

/**
 * All validation checks to run
 */
const VALIDATION_CHECKS: ValidationCheck[] = [
	checkSourceDirectory,
	checkConfigFile,
	checkTsconfigExtends,
	checkPackageJson,
	checkDrizzleConfig,
	checkTableNamingConvention
];

/**
 * Validate a module before linking
 *
 * @param modulePath - Absolute path to the module directory
 * @param moduleId - The module's ID (from config or folder name)
 * @returns Validation result with errors and warnings
 */
export async function validateModule(
	modulePath: string,
	moduleId: string
): Promise<ModuleValidationResult> {
	const allErrors: ValidationError[] = [];
	const allWarnings: ValidationWarning[] = [];

	for (const check of VALIDATION_CHECKS) {
		try {
			const { errors, warnings } = check(modulePath, moduleId);
			allErrors.push(...errors);
			allWarnings.push(...warnings);
		} catch (e) {
			// If a check throws unexpectedly, treat it as a warning
			allWarnings.push({
				code: 'CHECK_ERROR',
				message: `Validation check failed: ${e instanceof Error ? e.message : String(e)}`,
				suggestion: 'This may be a bug in the validation system'
			});
		}
	}

	return {
		valid: allErrors.length === 0,
		moduleId,
		modulePath,
		errors: allErrors,
		warnings: allWarnings,
		canProceed: allErrors.length === 0
	};
}

/**
 * Format validation result for console output
 */
export function formatValidationResult(result: ModuleValidationResult): string {
	const lines: string[] = [];

	lines.push(`Module: ${result.moduleId}`);
	lines.push(`Path: ${result.modulePath}`);
	lines.push(`Status: ${result.valid ? 'VALID' : 'INVALID'}`);
	lines.push('');

	if (result.errors.length > 0) {
		lines.push('Errors:');
		for (const error of result.errors) {
			lines.push(`  [${error.code}] ${error.message}`);
			if (error.file) {
				lines.push(`    File: ${error.file}`);
			}
			if (error.fixSuggestion) {
				lines.push(`    Fix: ${error.fixSuggestion}`);
			}
		}
		lines.push('');
	}

	if (result.warnings.length > 0) {
		lines.push('Warnings:');
		for (const warning of result.warnings) {
			lines.push(`  [${warning.code}] ${warning.message}`);
			if (warning.suggestion) {
				lines.push(`    Suggestion: ${warning.suggestion}`);
			}
		}
		lines.push('');
	}

	return lines.join('\n');
}
