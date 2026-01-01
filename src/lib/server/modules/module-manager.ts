import {
	existsSync,
	readdirSync,
	symlinkSync,
	mkdirSync,
	readFileSync,
	rmSync,
	utimesSync,
	lstatSync
} from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { parse } from 'yaml';
import { MigrationRunner } from './migration-runner';
import { db } from '../db';
import { SettingsRepository } from '../../repositories/settings/settings-repository';

export interface ModuleManifest {
	id: string;
	name: string;
	version: string;
	description?: string;
	author?: string;
	icon?: string;
}

export class ModuleManager {
	private static EXTERNAL_DIR = path.join(process.cwd(), 'external_modules');
	private static INTERNAL_CONFIG_DIR = path.join(process.cwd(), 'src/lib/config/modules');
	private static UI_ROUTES_DIR = path.join(
		process.cwd(),
		'src/routes/ui/(modules)/(external_modules)'
	);
	private static API_ROUTES_DIR = path.join(process.cwd(), 'src/routes/api/(external_modules)');

	static async init() {
		console.log('[ModuleManager] Initializing external modules...');

		if (!existsSync(this.EXTERNAL_DIR)) {
			mkdirSync(this.EXTERNAL_DIR, { recursive: true });
		}

		const settingsRepo = new SettingsRepository();
		const migrationRunner = new MigrationRunner(db);

		// 1. Get all modules from DB
		const allExternalInDb = await settingsRepo.getExternalModules();

		// 2. Process Deletions first
		const toDelete = allExternalInDb.filter((m) => m.status === 'deleting');
		for (const mod of toDelete) {
			console.log(`[ModuleManager] Processing pending deletion for module: ${mod.id}`);
			this.cleanupModuleArtifacts(mod.id);
			const modulePath = path.join(this.EXTERNAL_DIR, mod.id);
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

		// 3. Cleanup orphaned folders (folders in external_modules not in DB)
		const dbModuleIds = new Set(
			allExternalInDb.filter((m) => m.status !== 'deleting').map((m) => m.id)
		);
		try {
			const folders = readdirSync(this.EXTERNAL_DIR, { withFileTypes: true })
				.filter((dirent) => dirent.isDirectory())
				.map((dirent) => dirent.name);

			for (const folder of folders) {
				if (!dbModuleIds.has(folder)) {
					console.log(`[ModuleManager] Removing orphaned module folder: ${folder}`);
					const orphanPath = path.join(this.EXTERNAL_DIR, folder);
					this.cleanupModuleArtifacts(folder);
					rmSync(orphanPath, { recursive: true, force: true });
				}
			}
		} catch (e) {
			console.warn(`[ModuleManager] Could not cleanup orphaned modules. ${e}`);
		}

		// 4. Refresh and Initialize modules from DB
		const toInitialize = allExternalInDb.filter((m) => m.status !== 'deleting');

		for (const mod of toInitialize) {
			const moduleId = mod.id;
			const modulePath = path.join(this.EXTERNAL_DIR, moduleId);

			// Check if module is explicitly errored in DB
			if (mod.status === 'error') {
				console.log(`[ModuleManager] Skipping module ${moduleId} due to previous error.`);
				continue;
			}

			try {
				// 0. Clean Refresh: Remove and re-clone
				console.log(`[ModuleManager] Refreshing module ${moduleId} from ${mod.repoUrl}...`);
				this.cleanupModuleArtifacts(moduleId);
				if (existsSync(modulePath)) {
					rmSync(modulePath, { recursive: true, force: true });
				}

				try {
					execSync(`git clone ${mod.repoUrl} ${modulePath}`, { stdio: 'inherit' });
				} catch (cloneError) {
					throw new Error(`Failed to clone repository: ${cloneError}`);
				}

				// 1. Validate Manifest
				const manifestPath = path.join(modulePath, 'manifest.yaml');
				// 1. Validate Manifest
				if (!existsSync(manifestPath)) {
					throw new Error(`Missing manifest.yaml in ${moduleId}`);
				}

				const manifestContent = readFileSync(manifestPath, 'utf-8');
				const manifest = parse(manifestContent) as ModuleManifest;

				if (manifest.id !== moduleId) {
					throw new Error(
						`Module ID in manifest (${manifest.id}) does not match folder name (${moduleId})`
					);
				}

				console.log(`[ModuleManager] Initializing module: ${manifest.name} (${manifest.version})`);
				await settingsRepo.log('info', 'ModuleManager', `Initializing module: ${manifest.name}`, {
					moduleId,
					version: manifest.version
				});

				// 2. Run Tests (Basic validation)
				this.runBasicTests(moduleId, modulePath);

				// 3. Run Migrations
				const migrationsDir = path.join(modulePath, 'drizzle');
				await migrationRunner.runMigrations(moduleId, migrationsDir);

				// 4. Setup Symlinks (Runtime check/refresh)
				this.setupSymlinks(moduleId, modulePath);

				// 5. Update Status in DB
				await settingsRepo.updateExternalModuleStatus(moduleId, 'active');

				console.log(`[ModuleManager] Module ${moduleId} initialized successfully.`);
				await settingsRepo.log(
					'info',
					'ModuleManager',
					`Module ${moduleId} initialized successfully.`
				);
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				const errorStack = error instanceof Error ? error.stack : undefined;

				console.error(`\n[ModuleManager] ❌ FAILED TO INITIALIZE MODULE: ${moduleId}`);
				console.error(`[ModuleManager] Error: ${errorMessage}`);
				console.error(
					`[ModuleManager] Action: Removing module and database entry to prevent boot failure.\n`
				);

				await settingsRepo.log(
					'error',
					'ModuleManager',
					`Failed to initialize module ${moduleId}`,
					{ error: errorMessage, stack: errorStack }
				);

				// Cleanup artifacts
				this.cleanupModuleArtifacts(moduleId);

				// Remove the folder
				if (existsSync(modulePath)) {
					try {
						rmSync(modulePath, { recursive: true, force: true });
						console.log(`[ModuleManager] Successfully removed failed module folder: ${modulePath}`);
					} catch (rmError) {
						console.error(`[ModuleManager] Failed to remove folder ${modulePath}:`, rmError);
					}
				}

				// Completely remove from DB as requested ("remove it from the filesystem and database")
				await settingsRepo.deleteExternalModule(moduleId);
				console.log(`[ModuleManager] Removed module ${moduleId} from database.`);

				// Trigger an automatic reboot to return to a stable state
				console.log(
					'[ModuleManager] 🔄 Triggering automatic reboot to restore system stability...'
				);
				try {
					const configPath = path.resolve('vite.config.ts');
					const now = new Date();
					utimesSync(configPath, now, now);
				} catch (e) {
					console.warn('[ModuleManager] Failed to trigger Vite restart:', e);
				}

				if (process.env.NODE_ENV !== 'development') {
					setTimeout(() => {
						process.exit(10);
					}, 2000);
				} else {
					console.log('[ModuleManager] Development mode: Vite should restart automatically.');
				}
			}
		}
	}

	private static setupSymlinks(moduleId: string, modulePath: string) {
		// Link config.ts to src/lib/config/modules/[id]
		// We link the whole folder to make imports inside config.ts work
		const configDest = path.join(this.INTERNAL_CONFIG_DIR, moduleId);
		this.createSymlink(modulePath, configDest);

		// Link UI routes
		const uiSource = path.join(modulePath, 'routes/ui');
		if (existsSync(uiSource)) {
			const uiDest = path.join(this.UI_ROUTES_DIR, moduleId);
			this.createSymlink(uiSource, uiDest);
		}

		// Link API routes
		const apiSource = path.join(modulePath, 'routes/api');
		if (existsSync(apiSource)) {
			const apiDest = path.join(this.API_ROUTES_DIR, moduleId);
			this.createSymlink(apiSource, apiDest);
		}
	}

	private static runBasicTests(moduleId: string, modulePath: string) {
		// 1. Check for required files
		const required = ['manifest.yaml', 'config.ts'];
		for (const file of required) {
			if (!existsSync(path.join(modulePath, file))) {
				throw new Error(`Validation failed: Missing required file '${file}'`);
			}
		}

		// 2. Check for routes directory
		if (!existsSync(path.join(modulePath, 'routes'))) {
			console.warn(`[ModuleManager] Warning: Module ${moduleId} has no routes directory.`);
		}

		// 3. Check for lib directory
		if (!existsSync(path.join(modulePath, 'lib'))) {
			console.warn(`[ModuleManager] Warning: Module ${moduleId} has no lib directory.`);
		}
	}

	private static createSymlink(source: string, dest: string) {
		try {
			// Use rmSync with force to remove existing file/dir/symlink (even if broken)
			rmSync(dest, { recursive: true, force: true });

			const parent = path.dirname(dest);
			if (!existsSync(parent)) {
				mkdirSync(parent, { recursive: true });
			}

			const absoluteSource = path.resolve(source);
			const absoluteDest = path.resolve(dest);

			symlinkSync(absoluteSource, absoluteDest, 'dir');
		} catch (e: unknown) {
			const errorMessage = e instanceof Error ? e.message : String(e);
			throw new Error(`Failed to create symlink from ${source} to ${dest}: ${errorMessage}`);
		}
	}

	public static cleanupModuleArtifacts(moduleId: string) {
		const paths = [
			// Source Symlinks
			path.join(this.INTERNAL_CONFIG_DIR, moduleId),
			path.join(this.UI_ROUTES_DIR, moduleId),
			path.join(this.API_ROUTES_DIR, moduleId),

			// SvelteKit Generated Artifacts (based on user find output)
			path.join(
				process.cwd(),
				'.svelte-kit/output/server/entries/pages/ui/(modules)/(external_modules)',
				moduleId
			),
			path.join(
				process.cwd(),
				'.svelte-kit/output/server/entries/endpoints/api/(external_modules)',
				moduleId
			),
			path.join(process.cwd(), '.svelte-kit/types/src/routes/api', moduleId),
			path.join(process.cwd(), '.svelte-kit/types/src/routes/api/(external_modules)', moduleId),
			path.join(process.cwd(), '.svelte-kit/types/src/routes/ui/(modules)', moduleId),
			path.join(
				process.cwd(),
				'.svelte-kit/types/src/routes/ui/(modules)/(external_modules)',
				moduleId
			),
			path.join(process.cwd(), '.svelte-kit/types/src/routes/ui/(external_modules)', moduleId),
			path.join(
				process.cwd(),
				'.svelte-kit/adapter-node/entries/pages/ui/(modules)/(external_modules)',
				moduleId
			),
			path.join(
				process.cwd(),
				'.svelte-kit/adapter-node/entries/endpoints/api/(external_modules)',
				moduleId
			)
		];

		for (const p of paths) {
			try {
				// Use lstatSync to detect symlinks even if they are broken (existsSync returns false for broken symlinks)
				// Also handles normal files and directories
				if (existsSync(p) || this.isBrokenSymlink(p)) {
					rmSync(p, { recursive: true, force: true });
					console.log(`[ModuleManager] Cleaned up artifact: ${p}`);
				}
			} catch {
				// Path doesn't exist or couldn't be accessed, which is fine for cleanup
			}
		}
	}

	private static isBrokenSymlink(p: string): boolean {
		try {
			lstatSync(p);
			return true;
		} catch {
			return false;
		}
	}
}
