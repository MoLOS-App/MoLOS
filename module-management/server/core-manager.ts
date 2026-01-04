import { existsSync, mkdirSync } from 'fs';
import { MigrationRunner } from './migration-runner';
import { ModuleCleanup } from './cleanup';
import { ModuleInitialization } from './initialization';
import { ModulePaths } from './paths';
import { db } from '$lib/server/db';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';

/**
 * Core Module Manager
 * Main entry point for module management operations
 * Orchestrates the initialization, cleanup, and management of external modules
 */
export class ModuleManager {
	/**
	 * Initialize all external modules
	 * This is the main entry point called during application startup
	 */
	static async init(): Promise<void> {
		console.log('[ModuleManager] Initializing external modules...');

		// Ensure external_modules directory exists
		if (!existsSync(ModulePaths.EXTERNAL_DIR)) {
			mkdirSync(ModulePaths.EXTERNAL_DIR, { recursive: true });
		}

		const settingsRepo = new SettingsRepository();

		// 0. Discover modules in external_modules directory and register them if not in DB
		// Only if MOLOS_AUTOLOAD_MODULES is set to true
		const autoload = process.env.MOLOS_AUTOLOAD_MODULES === 'true';
		console.log(
			'[ModuleManager] MOLOS_AUTOLOAD_MODULES env var:',
			process.env.MOLOS_AUTOLOAD_MODULES,
			'autoload:',
			autoload
		);
		if (autoload) {
			await ModuleInitialization.discoverLocalModules(settingsRepo);
		} else {
			console.log('[ModuleManager] Autoload disabled. Skipping local module discovery.');
		}

		const migrationRunner = new MigrationRunner(db);

		// 1. Get all modules from DB
		const allExternalInDb = await settingsRepo.getExternalModules();

		// If autoload is disabled, mark auto-discovered local modules for deletion
		if (!autoload) {
			for (const mod of allExternalInDb) {
				if (mod.repoUrl.startsWith('local://')) {
					console.log(
						`[ModuleManager] Autoload disabled. Marking auto-discovered module ${mod.id} for deletion.`
					);
					await settingsRepo.updateExternalModuleStatus(mod.id, 'deleting');
				}
			}
		}

		// 2. Process Deletions first
		await ModuleCleanup.processDeletions(settingsRepo, allExternalInDb);

		// 3. Check for broken symlinks (for local modules where source was removed)
		await ModuleCleanup.checkBrokenSymlinks(settingsRepo, allExternalInDb);

		// 4. Cleanup orphaned folders (folders in external_modules not in DB)
		ModuleCleanup.cleanupOrphanedFolders(allExternalInDb);

		// If autoload is disabled, skip module initialization
		if (!autoload) {
			console.log('[ModuleManager] Autoload disabled. Skipping module initialization.');
			return;
		}

		// 5. Refresh and Initialize modules from DB
		const toInitialize = allExternalInDb.filter((m) => m.status !== 'deleting');

		// 6. Cleanup orphaned/broken symlinks under src
		ModuleCleanup.cleanupOrphanedSymlinksForActiveModules(toInitialize);

		// 7. Initialize each module
		for (const mod of toInitialize) {
			const moduleId = mod.id;
			await ModuleInitialization.initializeModule(moduleId, mod, settingsRepo, migrationRunner);
		}
	}
}
