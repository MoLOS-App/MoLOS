import { existsSync, readFileSync, readdirSync, realpathSync } from 'fs';
import path from 'path';
import { ModulePaths } from './paths';
import {
	createSymlink,
	ensureSymlinkDirectories,
	cleanupModuleArtifacts,
	getModuleRouteSymlinks,
	getModuleRouteSources
} from './utils';

/**
 * Module initialization for workspace-based package modules
 * Modules are discovered from the modules/ directory and registered in the database
 */
export class ModuleInitialization {
	/**
	 * Discover modules from modules/ directory and sync with database
	 * - Registers new modules found in modules/
	 * - Removes database entries for modules that no longer exist
	 * - Sets up route symlinks for active modules
	 */
	static async discoverAndSyncModules(settingsRepo: any): Promise<void> {
		console.log(`[ModuleManager] Scanning modules directory: ${ModulePaths.MODULES_DIR}`);

		// Get modules currently in the database
		const dbModules = await settingsRepo.getExternalModules();
		const dbModuleIds = new Set(dbModules.map((m: any) => m.id));

		// Get modules from the modules/ directory
		const diskModules = this.discoverModulesFromDisk();
		const diskModuleIds = new Set(diskModules.map((m) => m.id));

		// Register new modules
		for (const mod of diskModules) {
			if (!dbModuleIds.has(mod.id)) {
				console.log(`[ModuleManager] Registering new module: ${mod.id}`);
				await settingsRepo.registerExternalModule(mod.id, `package://modules/${mod.directory}`);
			} else {
				// Ensure existing module is active
				const existing = dbModules.find((m: any) => m.id === mod.id);
				if (existing && existing.status !== 'active') {
					console.log(`[ModuleManager] Re-activating module: ${mod.id}`);
					await settingsRepo.updateExternalModuleStatus(mod.id, 'active');
				}
			}

			// Setup route symlinks for the module
			const modulePath = ModulePaths.getModulePath(mod.directory);
			if (existsSync(modulePath)) {
				this.setupSymlinks(mod.id, modulePath);
			}
		}

		// Remove stale database entries (modules in DB but not on disk)
		for (const dbMod of dbModules) {
			if (!diskModuleIds.has(dbMod.id)) {
				console.log(`[ModuleManager] Removing stale module entry: ${dbMod.id}`);
				cleanupModuleArtifacts(dbMod.id);
				await settingsRepo.deleteExternalModule(dbMod.id);
			}
		}

		console.log(
			`[ModuleManager] Module sync complete. Active modules: ${diskModules.map((m) => m.id).join(', ') || 'none'}`
		);
	}

	/**
	 * Discover modules from the modules/ directory by reading their config.ts
	 */
	private static discoverModulesFromDisk(): Array<{ id: string; directory: string }> {
		const modules: Array<{ id: string; directory: string }> = [];

		if (!existsSync(ModulePaths.MODULES_DIR)) {
			return modules;
		}

		try {
			const entries = readdirSync(ModulePaths.MODULES_DIR, { withFileTypes: true });
			const directories = entries.filter((e) => e.isDirectory());

			for (const dir of directories) {
				const configPath = path.join(ModulePaths.MODULES_DIR, dir.name, 'src', 'config.ts');
				if (!existsSync(configPath)) {
					continue;
				}

				try {
					const configContent = readFileSync(configPath, 'utf-8');
					const idMatch = configContent.match(/id:\s*['"]([^'"]+)['"]/);
					if (idMatch) {
						modules.push({
							id: idMatch[1],
							directory: dir.name
						});
					}
				} catch (err) {
					console.warn(`[ModuleManager] Failed to read config for ${dir.name}:`, err);
				}
			}
		} catch (err) {
			console.warn(`[ModuleManager] Failed to scan modules directory:`, err);
		}

		return modules;
	}

	/**
	 * Setup route symlinks for a module
	 */
	private static setupSymlinks(moduleId: string, modulePath: string): void {
		ensureSymlinkDirectories();

		try {
			const moduleRoot = realpathSync(modulePath);
			const destinations = getModuleRouteSymlinks(moduleId);
			const sources = getModuleRouteSources(moduleId, modulePath);

			Object.entries(destinations).forEach(([key, dest]) => {
				const source = (sources as any)[key];
				if (source && dest && existsSync(source)) {
					createSymlink(source, dest, moduleRoot);
				}
			});
		} catch (err) {
			console.warn(`[ModuleManager] Failed to setup symlinks for ${moduleId}:`, err);
		}
	}
}
