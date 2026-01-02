import { ModuleManager } from '../src/lib/server/modules/module-manager';
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { parse } from 'yaml';
import { validateModuleManifest, formatValidationErrors } from '../src/lib/config/module-types';

// Load .env file manually for CLI
function loadEnv() {
	const envPath = path.resolve(process.cwd(), '.env');
	if (existsSync(envPath)) {
		const envContent = readFileSync(envPath, 'utf-8');
		envContent.split('\n').forEach((line) => {
			const [key, ...valueParts] = line.split('=');
			if (key && valueParts.length > 0) {
				const value = valueParts
					.join('=')
					.trim()
					.replace(/^["']|["']$/g, '');
				process.env[key.trim()] = value;
			}
		});
	}
}

/**
 * Pre-validation of all modules before full initialization
 * Catches manifest and structure errors early with detailed reporting
 */
async function preValidateModules(): Promise<{ valid: boolean; errors: Map<string, string[]> }> {
	const errors = new Map<string, string[]>();
	const externalModulesDir = path.resolve(process.cwd(), 'external_modules');

	if (!existsSync(externalModulesDir)) {
		return { valid: true, errors };
	}

	try {
		const items = readdirSync(externalModulesDir, { withFileTypes: true }).filter((d) => d.isDirectory());

		for (const item of items) {
			const modulePath = path.join(externalModulesDir, item.name);
			const manifestPath = path.join(modulePath, 'manifest.yaml');

			if (!existsSync(manifestPath)) {
				errors.set(item.name, ['Missing manifest.yaml file']);
				continue;
			}

			try {
				const manifestContent = readFileSync(manifestPath, 'utf-8');
				const manifest = parse(manifestContent);

				const validation = validateModuleManifest(manifest);
				if (!validation.valid) {
					const formattedErrors = formatValidationErrors(validation.error);
					errors.set(item.name, formattedErrors);
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				errors.set(item.name, [`Failed to parse manifest.yaml: ${errorMsg}`]);
			}
		}
	} catch (error) {
		console.error('[SyncModules] Error during pre-validation:', error);
		// Don't fail hard on pre-validation, let ModuleManager handle it
	}

	return {
		valid: errors.size === 0,
		errors,
	};
}

/**
 * Format pre-validation errors for output
 */
function reportValidationErrors(errors: Map<string, string[]>): void {
	if (errors.size === 0) return;

	console.error('\n[SyncModules] ⚠️  Validation errors detected in modules:');
	console.error('='.repeat(60));

	for (const [moduleId, moduleErrors] of errors.entries()) {
		console.error(`\n  Module: ${moduleId}`);
		moduleErrors.forEach((error) => {
			console.error(`    • ${error}`);
		});
	}

	console.error('\n' + '='.repeat(60));
	console.error('[SyncModules] Please fix the above errors and try again.\n');
}

async function main() {
	loadEnv();
	// Ensure MOLOS_AUTOLOAD_MODULES is set to true for sync script if not explicitly set
	if (process.env.MOLOS_AUTOLOAD_MODULES === undefined) {
		process.env.MOLOS_AUTOLOAD_MODULES = 'true';
	}

	console.log('[SyncModules] Starting module synchronization...');

	// Pre-validate modules first
	console.log('[SyncModules] Pre-validating module manifests...');
	const preValidation = await preValidateModules();

	if (!preValidation.valid) {
		reportValidationErrors(preValidation.errors);
		// Continue anyway to allow ModuleManager to handle errors with error states
		console.log('[SyncModules] Continuing with full synchronization (modules with errors will be marked as errored)...');
	} else {
		console.log('[SyncModules] ✓ All module manifests validated successfully');
	}

	try {
		await ModuleManager.init();
		console.log('[SyncModules] Module synchronization complete.');
		process.exit(0);
	} catch (err) {
		console.error('[SyncModules] Failed to synchronize modules:', err);
		process.exit(1);
	}
}

main();
