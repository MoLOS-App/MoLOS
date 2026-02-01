import { ModuleManager } from '../module-management/server/module-manager';
import { ModuleInitialization } from '../module-management/server/initialization';
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { parse } from 'yaml';
import { validateModuleManifest, formatValidationErrors } from '../src/lib/config/module-types.ts';
import {
	hasModulesChanged,
	clearSyncState,
	saveSyncState,
	hashAllModules
} from '../module-management/utils/hash.js';
import { linkExternalModules } from '../scripts/link-modules.js';
import { execFileSync } from 'child_process';
import { SettingsRepository } from '../src/lib/repositories/settings/settings-repository.js';

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
		const items = readdirSync(externalModulesDir, { withFileTypes: true }).filter(
			(d) => d.isDirectory() || d.isSymbolicLink()
		);

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
		errors
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

	// Check for --force flag to bypass change detection
	const forceSync = process.argv.includes('--force');

	console.log('[SyncModules] Starting module synchronization...');

	// Check for changes using hash-based detection
	const externalModulesDir = path.resolve(process.cwd(), 'external_modules');
	if (!forceSync && !hasModulesChanged(externalModulesDir)) {
		console.log('[SyncModules] Skipping sync (no changes detected). Use --force to sync anyway.');
		process.exit(0);
	}

	if (forceSync) {
		console.log('[SyncModules] Force sync requested (--force flag)');
		clearSyncState();
	}

	// Sync external modules from database (git fetch and checkout)
	console.log('[SyncModules] Syncing external modules from database...');
	await syncExternalModulesFromDatabase();

	// Pre-validate modules first
	console.log('[SyncModules] Pre-validating module manifests...');
	const preValidation = await preValidateModules();

	if (!preValidation.valid) {
		reportValidationErrors(preValidation.errors);
		// Continue anyway to allow ModuleManager to handle errors with error states
		console.log(
			'[SyncModules] Continuing with full synchronization (modules with errors will be marked as errored)...'
		);
	} else {
		console.log('[SyncModules] ✓ All module manifests validated successfully');
	}

	try {
		await ModuleManager.init();

		// Link modules (create symlinks) after successful initialization
		console.log('[SyncModules] Linking modules...');
		await linkExternalModules();

		const failedModules = ModuleInitialization.consumeFailedModules();
		if (failedModules.length > 0) {
			console.warn(
				`[SyncModules] Modules failed to initialize and were removed: ${failedModules.join(', ')}`
			);
			console.warn('[SyncModules] Re-syncing modules after removal...');
			await ModuleManager.init();
			console.warn('[SyncModules] Requesting restart due to failed module initialization...');
			clearSyncState(); // Clear state to force rebuild
			process.exit(10);
		}
		console.log('[SyncModules] Module synchronization complete.');

		// Save sync state after successful sync
		const finalHash = hashAllModules(externalModulesDir);
		const modules = existsSync(externalModulesDir)
			? readdirSync(externalModulesDir, { withFileTypes: true })
					.filter((d) => d.isDirectory() || d.isSymbolicLink())
					.map((d) => d.name)
			: [];
		saveSyncState(finalHash, modules);

		process.exit(0);
	} catch (err) {
		console.error('[SyncModules] Failed to synchronize modules:', err);
		clearSyncState(); // Clear state on error to force retry
		process.exit(1);
	}
}

/**
 * Sync external modules from database
 * Fetches updates and checks out the specified git ref for each module
 * unless blockUpdates is true
 */
async function syncExternalModulesFromDatabase(): Promise<void> {
	const settingsRepo = new SettingsRepository();
	const externalModules = await settingsRepo.getExternalModules();
	const externalModulesDir = path.resolve(process.cwd(), 'external_modules');

	for (const mod of externalModules) {
		const modulePath = path.join(externalModulesDir, mod.id);

		// Skip if module directory doesn't exist
		if (!existsSync(modulePath)) {
			console.log(`[SyncModules] Module directory not found for ${mod.id}, skipping sync.`);
			continue;
		}

		// Skip local modules
		if (mod.repoUrl.startsWith('local://')) {
			console.log(`[SyncModules] Skipping git operations for local module ${mod.id}.`);
			continue;
		}

		// Skip if blockUpdates is true
		if (mod.blockUpdates) {
			console.log(`[SyncModules] Updates blocked for module ${mod.id}, skipping git operations.`);
			continue;
		}

		// Skip if module is in deleting status
		if (mod.status === 'deleting') {
			console.log(`[SyncModules] Module ${mod.id} is marked for deletion, skipping sync.`);
			continue;
		}

		try {
			// Fetch the latest refs
			console.log(`[SyncModules] Fetching latest refs for ${mod.id}...`);
			execFileSync('git', ['fetch', 'origin'], {
				cwd: modulePath,
				stdio: 'inherit'
			});

			// Get the current HEAD
			let currentHead = '';
			try {
				currentHead = execFileSync('git', ['rev-parse', 'HEAD'], {
					cwd: modulePath,
					encoding: 'utf-8'
				}).trim();
			} catch (e) {
				console.warn(`[SyncModules] Failed to get current HEAD for ${mod.id}`);
			}

			// Checkout the specified git ref
			const targetRef = mod.gitRef || 'main';
			console.log(`[SyncModules] Checking out ${targetRef} for ${mod.id}...`);
			execFileSync('git', ['checkout', targetRef], {
				cwd: modulePath,
				stdio: 'inherit'
			});

			// Get the new HEAD
			let newHead = '';
			try {
				newHead = execFileSync('git', ['rev-parse', 'HEAD'], {
					cwd: modulePath,
					encoding: 'utf-8'
				}).trim();
			} catch (e) {
				console.warn(`[SyncModules] Failed to get new HEAD for ${mod.id}`);
			}

			// If HEAD changed, mark for re-initialization
			if (currentHead && newHead && currentHead !== newHead) {
				console.log(`[SyncModules] Module ${mod.id} has updates, marking for re-initialization.`);
				await settingsRepo.updateExternalModuleStatus(mod.id, 'pending');
			}
		} catch (error) {
			console.error(`[SyncModules] Failed to sync module ${mod.id}:`, error);
			// Continue with other modules even if one fails
		}
	}
}

main();
