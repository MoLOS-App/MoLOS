/**
 * Module Validator - Pre-Build Validation
 *
 * Validates modules before importing to prevent build failures.
 * This is a lightweight validation layer that runs during the build process
 * to detect and report module issues before they break the entire build.
 */

import { existsSync, readFileSync, readdirSync, lstatSync } from 'fs';
import path from 'path';
import { parse } from 'yaml';
import type { ModuleManifest } from '../config/module-types';
import { ModulePaths } from './paths';
import { validateSchemaExports } from './schema-validator';

/**
 * Validation result for a single check
 */
export interface ValidationResult {
	valid: boolean;
	error?: string;
	details?: string;
}

/**
 * Complete module validation result
 */
export interface ModuleValidationResult {
	valid: boolean;
	moduleId: string;
	checks: {
		manifest: ValidationResult;
		config: ValidationResult;
		structure: ValidationResult;
		schema?: ValidationResult;
	};
}

/**
 * Quick validation result for build-time filtering
 */
export interface QuickValidationResult {
	valid: boolean;
	moduleId: string;
	error?: string;
}

/**
 * Validate module manifest.yaml
 */
export function validateModuleManifest(
	moduleId: string,
	modulePath: string
): ValidationResult {
	try {
		const manifestPath = path.join(modulePath, 'manifest.yaml');

		if (!existsSync(manifestPath)) {
			return {
				valid: false,
				error: 'Missing manifest.yaml',
				details: `Required file not found: ${manifestPath}`
			};
		}

		const content = readFileSync(manifestPath, 'utf-8');

		// Basic YAML syntax check
		try {
			const manifest = parse(content) as ModuleManifest;

			// Check required fields
			if (!manifest.id) {
				return { valid: false, error: 'Missing required field: id' };
			}
			if (!manifest.name) {
				return { valid: false, error: 'Missing required field: name' };
			}
			if (!manifest.version) {
				return { valid: false, error: 'Missing required field: version' };
			}

			// Check ID matches folder name
			if (manifest.id !== moduleId) {
				return {
					valid: false,
					error: 'Module ID mismatch',
					details: `Manifest ID (${manifest.id}) does not match folder name (${moduleId})`
				};
			}

			// Check ID format
			if (!/^[a-zA-Z0-9_-]+$/.test(manifest.id)) {
				return {
					valid: false,
					error: 'Invalid module ID format',
					details: 'Module ID must contain only alphanumeric characters, hyphens, and underscores'
				};
			}

			// Check version format (basic semver check)
			if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
				return {
					valid: false,
					error: 'Invalid version format',
					details: 'Version must follow semver format (e.g., 1.0.0)'
				};
			}

			return { valid: true };
		} catch (yamlError) {
			return {
				valid: false,
				error: 'Invalid YAML syntax',
				details: yamlError instanceof Error ? yamlError.message : String(yamlError)
			};
		}
	} catch (error) {
		return {
			valid: false,
			error: 'Failed to read manifest',
			details: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Validate module config.ts exists and has expected exports
 */
export function validateModuleConfig(
	moduleId: string,
	modulePath: string
): ValidationResult {
	try {
		const configPath = path.join(modulePath, 'config.ts');

		if (!existsSync(configPath)) {
			return {
				valid: false,
				error: 'Missing config.ts',
				details: `Required file not found: ${configPath}`
			};
		}

		const content = readFileSync(configPath, 'utf-8');

		// Check for required exports using regex (faster than parsing)
		// Look for: export default, export const moduleConfig, or export const <prefix>Config
		const hasDefaultExport = /export\s+default\s+/.test(content);
		const hasModuleConfigExport = /export\s+(const|let|var)\s+moduleConfig\s*=/.test(content);

		// Check for named config export pattern (e.g., export const tasksConfig)
		const namedConfigMatch = content.match(/export\s+(const|let|var)\s+(\w+Config)\s*=/);
		const hasNamedConfigExport = namedConfigMatch !== null;

		if (!hasDefaultExport && !hasModuleConfigExport && !hasNamedConfigExport) {
			return {
				valid: false,
				error: 'Missing required exports',
				details: 'config.ts must export default, moduleConfig, or a named *Config object'
			};
		}

		// Check for required config fields if we can parse them
		// This is a basic check - actual validation happens during import
		const hasId = /id:\s*['"]/.test(content) || /id:\s*[\w]/.test(content);
		const hasName = /name:\s*['"]/.test(content);
		const hasHref = /href:\s*['"]\/ui\//.test(content);

		if (!hasId || !hasName || !hasHref) {
			return {
				valid: false,
				error: 'Missing required config fields',
				details: 'Config must include id, name, and href (starting with /ui/)'
			};
		}

		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: 'Failed to validate config',
			details: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Validate module directory structure
 */
export function validateModuleStructure(
	moduleId: string,
	modulePath: string
): ValidationResult {
	try {
		// Check if module path exists and is a directory
		if (!existsSync(modulePath)) {
			return {
				valid: false,
				error: 'Module directory not found',
				details: `Path does not exist: ${modulePath}`
			};
		}

		let stats: import('fs').Stats;
		try {
			stats = lstatSync(modulePath);
		} catch (e) {
			return {
				valid: false,
				error: 'Cannot access module directory',
				details: e instanceof Error ? e.message : String(e)
			};
		}

		if (!stats.isDirectory()) {
			return {
				valid: false,
				error: 'Module path is not a directory',
				details: `Path is not a directory: ${modulePath}`
			};
		}

		// Check for broken symlinks
		if (stats.isSymbolicLink()) {
			// Try to read the link target
			if (!existsSync(modulePath)) {
				return {
					valid: false,
					error: 'Broken symlink',
					details: 'Module directory is a broken symlink'
				};
			}
		}

		// Check required files exist
		const requiredFiles = ['manifest.yaml', 'config.ts'];
		for (const file of requiredFiles) {
			const filePath = path.join(modulePath, file);
			if (!existsSync(filePath)) {
				return {
					valid: false,
					error: `Missing required file: ${file}`,
					details: `Required file not found: ${filePath}`
				};
			}
		}

		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: 'Failed to validate structure',
			details: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Validate module schema exports (if schema directory exists)
 */
export function validateModuleSchema(
	moduleId: string,
	modulePath: string
): ValidationResult | null {
	const schemaDir = path.join(modulePath, 'lib/server/db/schema');

	// Schema is optional - if it doesn't exist, skip validation
	if (!existsSync(schemaDir)) {
		return null;
	}

	// Look for schema files
	const schemaFiles = readdirSync(schemaDir)
		.filter((f) => f.endsWith('.ts') && f !== 'index.ts')
		.map((f) => path.join(schemaDir, f));

	if (schemaFiles.length === 0) {
		return null; // No schema files to validate
	}

	// Validate each schema file
	for (const schemaFile of schemaFiles) {
		const validation = validateSchemaExports(moduleId, schemaFile);
		if (!validation.valid) {
			return {
				valid: false,
				error: 'Schema export validation failed',
				details: `File: ${path.basename(schemaFile)} - Missing exports: ${validation.missingExports.join(', ')}`
			};
		}
	}

	return { valid: true };
}

/**
 * Perform complete validation of a module
 */
export function validateModule(moduleId: string): ModuleValidationResult {
	const modulePath = ModulePaths.getModulePath(moduleId);

	return {
		valid: true,
		moduleId,
		checks: {
			manifest: validateModuleManifest(moduleId, modulePath),
			config: validateModuleConfig(moduleId, modulePath),
			structure: validateModuleStructure(moduleId, modulePath),
			schema: validateModuleSchema(moduleId, modulePath) || undefined
		}
	};
}

/**
 * Quick validation for build-time filtering
 * Returns a simple valid/invalid result with optional error message
 */
export function validateModuleQuick(moduleId: string): QuickValidationResult {
	const validation = validateModule(moduleId);

	// Check if any validation failed
	const failedCheck = Object.values(validation.checks).find(
		(check) => check && !check.valid
	);

	if (!failedCheck) {
		return { valid: true, moduleId };
	}

	return {
		valid: false,
		moduleId,
		error: failedCheck.error || 'Unknown validation error'
	};
}

/**
 * Validate all modules in the external_modules directory
 */
export function validateAllModules(): Map<string, ModuleValidationResult> {
	const results = new Map<string, ModuleValidationResult>();

	if (!existsSync(ModulePaths.EXTERNAL_DIR)) {
		return results;
	}

	try {
		const modules = readdirSync(ModulePaths.EXTERNAL_DIR, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory() || dirent.isSymbolicLink())
			.map((dirent) => dirent.name);

		for (const moduleId of modules) {
			results.set(moduleId, validateModule(moduleId));
		}
	} catch (error) {
		console.error('[ModuleValidator] Failed to scan external_modules directory:', error);
	}

	return results;
}

/**
 * Format validation results for console output
 */
export function formatValidationResult(result: ModuleValidationResult): string {
	const lines = [`Module: ${result.moduleId}`, `Status: ${result.valid ? '✓ VALID' : '✗ INVALID'}`, ''];

	if (!result.valid) {
		for (const [checkName, checkResult] of Object.entries(result.checks)) {
			if (checkResult && !checkResult.valid) {
				lines.push(`  [${checkName}] ${checkResult.error}`);
				if (checkResult.details) {
					lines.push(`    Details: ${checkResult.details}`);
				}
			}
		}
	}

	return lines.join('\n');
}

/**
 * Check if a module should be skipped based on validation
 */
export function shouldSkipModule(moduleId: string): boolean {
	const validation = validateModuleQuick(moduleId);
	return !validation.valid;
}

/**
 * Get validation error message for a module
 */
export function getValidationError(moduleId: string): string | null {
	const validation = validateModuleQuick(moduleId);
	return validation.error || null;
}
