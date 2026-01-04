import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { existsSync, readdirSync, symlinkSync, mkdirSync, rmSync, lstatSync } from 'fs';
import path from 'path';

/**
 * MoLOS Module Linker
 * This runs during Vite config load to ensure external modules are symlinked
 * before SvelteKit starts its route discovery.
 */
function linkExternalModules() {
	const EXTERNAL_DIR = path.resolve('external_modules');
	const INTERNAL_CONFIG_DIR = path.resolve('src/lib/config/external_modules');
	const LEGACY_CONFIG_DIR = path.resolve('src/lib/config/modules');
	const UI_ROUTES_DIR = path.resolve('src/routes/ui/(modules)/(external_modules)');
	const API_ROUTES_DIR = path.resolve('src/routes/api/(external_modules)');

	// Helper to safely remove a path (including broken symlinks)
	const safeRemove = (p: string) => {
		try {
			rmSync(p, { recursive: true, force: true });
		} catch (e) {
			console.error(`[Vite] Failed to remove path ${p}:`, e);
		}
	};

	// 0. Cleanup broken or stale symlinks in the target directories first
	// This prevents ENOENT errors when Vite tries to stat broken links
	[INTERNAL_CONFIG_DIR, UI_ROUTES_DIR, API_ROUTES_DIR, LEGACY_CONFIG_DIR].forEach((dir) => {
		if (existsSync(dir)) {
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				try {
					// Check if it's a symlink and if it's broken
					const stats = lstatSync(fullPath);
					if (stats.isSymbolicLink()) {
						if (!existsSync(fullPath)) {
							console.log(`[Vite] Removing broken symlink: ${fullPath}`);
							safeRemove(fullPath);
						} else if (dir === LEGACY_CONFIG_DIR) {
							console.log(`[Vite] Removing legacy module config symlink: ${fullPath}`);
							safeRemove(fullPath);
						}
					}
				} catch (e) {
					console.log(`[Vite] Error while removing path ${fullPath}:`, e);
					safeRemove(fullPath);
				}
			}
		}
	});

	if (!existsSync(EXTERNAL_DIR)) return;

	let modules: string[] = [];
	try {
		modules = readdirSync(EXTERNAL_DIR, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory() || dirent.isSymbolicLink())
			.map((dirent) => dirent.name);
	} catch (e) {
		console.error('[Vite] Failed to read external modules directory:', e);
		return;
	}

	console.log(`[Vite] Linking ${modules.length} external modules...`);

	for (const moduleId of modules) {
		const modulePath = path.join(EXTERNAL_DIR, moduleId);

		// We only link if a manifest exists (basic validation)
		if (!existsSync(path.join(modulePath, 'manifest.yaml'))) continue;

		try {
			// 1. Link to config registry
			const configSource = path.join(modulePath, 'config.ts');
			if (existsSync(configSource)) {
				const configDest = path.join(INTERNAL_CONFIG_DIR, `${moduleId}.ts`);
				safeRemove(configDest);
				if (!existsSync(path.dirname(configDest)))
					mkdirSync(path.dirname(configDest), { recursive: true });
				symlinkSync(configSource, configDest, 'file');
			}

			// 2. Link UI routes
			const uiSource = path.join(modulePath, 'routes/ui');
			if (existsSync(uiSource)) {
				const uiDest = path.join(UI_ROUTES_DIR, moduleId);
				safeRemove(uiDest);
				if (!existsSync(path.dirname(uiDest))) mkdirSync(path.dirname(uiDest), { recursive: true });
				symlinkSync(uiSource, uiDest, 'dir');
			}

			// 3. Link API routes
			const apiSource = path.join(modulePath, 'routes/api');
			if (existsSync(apiSource)) {
				const apiDest = path.join(API_ROUTES_DIR, moduleId);
				safeRemove(apiDest);
				if (!existsSync(path.dirname(apiDest)))
					mkdirSync(path.dirname(apiDest), { recursive: true });
				symlinkSync(apiSource, apiDest, 'dir');
			}
		} catch (e) {
			console.error(`[Vite] Failed to link module ${moduleId}:`, e);
		}
	}
}

// Execute linking immediately
linkExternalModules();

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],

	resolve: {
		preserveSymlinks: true
	},

	server: {
		fs: {
			allow: ['external_modules', '..']
		},
		watch: {
			ignored: [
				'**/external_modules/**/svelte.config.js',
				'**/external_modules/**/tsconfig.json',
				'**/external_modules/**/tsconfig.*.json'
			]
		}
	},

	test: {
		expect: { requireAssertions: true },

		projects: [
			{
				extends: './vite.config.ts',

				resolve: {
					preserveSymlinks: false
				},

				test: {
					name: 'client',

					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},

					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',

				resolve: {
					preserveSymlinks: false
				},

				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', '**/node_modules/**']
				}
			}
		]
	}
} as any);
