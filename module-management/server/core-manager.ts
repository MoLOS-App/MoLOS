import { existsSync, mkdirSync } from 'fs';
import { ModuleInitialization } from './initialization';
import { ModulePaths } from './paths';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';

/**
 * Core Module Manager
 * Handles initialization of package modules using workspace imports
 */
export class ModuleManager {
	/**
	 * Initialize all package modules
	 */
	static async init(): Promise<void> {
		console.log('[ModuleManager] Initializing package modules...');

		// Ensure modules directory exists
		if (!existsSync(ModulePaths.MODULES_DIR)) {
			mkdirSync(ModulePaths.MODULES_DIR, { recursive: true });
		}

		const settingsRepo = new SettingsRepository();

		// Discover and sync modules from modules/ directory
		await ModuleInitialization.discoverAndSyncModules(settingsRepo);
	}
}
