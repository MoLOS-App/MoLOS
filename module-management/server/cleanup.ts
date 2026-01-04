import { existsSync, readdirSync, rmSync } from 'fs';
import { ModulePaths } from './paths';
import { cleanupModuleArtifacts, cleanupOrphanedSymlinks, isBrokenSymlink } from './utils';

/**
 * Module cleanup operations
 * Handles deletion of modules, cleanup of artifacts, and removal of orphaned symlinks
 */

export class ModuleCleanup {
	/**
	 * Process modules marked for deletion
	 */
	static async processDeletions(settingsRepo: any, allExternalInDb: any[]): Promise<void> {
		const toDelete = allExternalInDb.filter((m) => m.status === 'deleting');
		for (const mod of toDelete) {
			console.log(`[ModuleManager] Processing pending deletion for module: ${mod.id}`);
			this.cleanupModuleArtifacts(mod.id);
			const modulePath = ModulePaths.getModulePath(mod.id);
			if (existsSync(modulePath)) {
				try {
					rmSync(modulePath, { recursive: true, force: true });
					console.log(`[ModuleManager] Removed folder for deleted module: ${mod.id}`);
				} catch (e) {
					console.error(`[ModuleManager] Failed to remove folder for ${mod.id}:`, e);
				}
			}
			await settingsRepo.deleteExternalModule(mod.id);
			console.log(`[ModuleManager] Removed module ${mod.id} from database.`);
		}
	}

	/**
	 * Check for broken symlinks from removed local modules
	 */
	static async checkBrokenSymlinks(settingsRepo: any, allExternalInDb: any[]): Promise<void> {
		for (const mod of allExternalInDb) {
			if (mod.repoUrl.startsWith('local://') && mod.status !== 'deleting') {
				const modulePath = ModulePaths.getModulePath(mod.id);
				try {
					if (isBrokenSymlink(modulePath)) {
						console.log(
							`[ModuleManager] Local module source removed, marking ${mod.id} for deletion.`
						);
						await settingsRepo.updateExternalModuleStatus(mod.id, 'deleting');
					}
				} catch (e) {
					console.warn(`[ModuleManager] Error checking symlink for ${mod.id}: ${e}`);
				}
			}
		}
	}

	/**
	 * Clean up orphaned folders in external_modules that don't exist in DB
	 */
	static cleanupOrphanedFolders(allExternalInDb: any[]): void {
		const dbModuleIds = new Set(
			allExternalInDb.filter((m) => m.status !== 'deleting').map((m) => m.id)
		);
		try {
			const folders = readdirSync(ModulePaths.EXTERNAL_DIR, { withFileTypes: true })
				.filter((dirent) => dirent.isDirectory() || dirent.isSymbolicLink())
				.map((dirent) => dirent.name);

			for (const folder of folders) {
				if (!dbModuleIds.has(folder)) {
					console.log(`[ModuleManager] Removing orphaned module folder: ${folder}`);
					const orphanPath = ModulePaths.getModulePath(folder);
					cleanupModuleArtifacts(folder);
					rmSync(orphanPath, { recursive: true, force: true });
				}
			}
		} catch (e) {
			console.warn(`[ModuleManager] Could not cleanup orphaned modules. ${e}`);
		}
	}

	/**
	 * Clean up orphaned symlinks for active modules
	 */
	static cleanupOrphanedSymlinksForActiveModules(toInitialize: any[]): void {
		const activeModuleIds = new Set(toInitialize.map((m) => m.id));
		cleanupOrphanedSymlinks(activeModuleIds);
	}

	/**
	 * Clean up artifacts for a specific module
	 */
	static cleanupModuleArtifacts(moduleId: string): void {
		cleanupModuleArtifacts(moduleId);
	}
}
