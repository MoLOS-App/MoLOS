import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';
import fs from 'fs';
import type { Plugin } from 'vite';

/**
 * Custom Vite plugin that provides a `$module` alias for module-internal imports.
 *
 * Usage in modules:
 * - `$module/server/repositories/task-repository` → resolves to `{module}/src/server/repositories/task-repository`
 * - `$module/lib/models/index` → resolves to `{module}/src/lib/models/index`
 * - `$module/server/database/schema` → resolves to `{module}/src/server/database/schema`
 *
 * The plugin automatically detects which module is importing and resolves accordingly.
 * Handles .js extensions in imports by stripping them (actual files may be .ts).
 */
function moduleAliasPlugin(): Plugin {
	return {
		name: 'molos-module-alias',
		enforce: 'pre',
		resolveId(source: string, importer: string | undefined) {
			// Only handle $module imports
			if (!source.startsWith('$module/')) {
				return null;
			}

			// Must have an importer to determine module context
			if (!importer) {
				return null;
			}

			// Find which module the importer belongs to
			// Handles both 'modules/MoLOS-XXX' and 'external_modules/MoLOS-XXX'
			const moduleMatch = importer.match(/(?:modules|external_modules)\/(MoLOS-[^/\\]+)/);

			if (!moduleMatch) {
				// Not inside a module, skip
				return null;
			}

			const moduleName = moduleMatch[1];
			let rest = source.slice('$module/'.length); // Remove '$module/' prefix

			// Strip .js extension if present (TypeScript files are imported with .js in ESM)
			if (rest.endsWith('.js')) {
				rest = rest.slice(0, -3);
			}

			// Resolve to the module's src directory
			const basePath = path.resolve(__dirname, 'modules', moduleName, 'src', rest);

			// Check for file with various extensions
			const extensions = ['.ts', '.js', '.svelte', '/index.ts', '/index.js'];

			// First check if the path exists exactly as-is (for directories with index)
			if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
				return basePath;
			}

			// Try adding extensions
			for (const ext of extensions) {
				const fullPath = basePath + ext;
				if (fs.existsSync(fullPath)) {
					return fullPath;
				}
			}

			// If nothing found, return the base path and let Vite handle the error
			return basePath;
		}
	};
}

export default defineConfig({
	plugins: [moduleAliasPlugin(), tailwindcss(), sveltekit()],

	resolve: {
		preserveSymlinks: false,
		alias: {
			'@molos/core': path.resolve(__dirname, 'packages/core/src'),
			'@molos/database': path.resolve(__dirname, 'packages/database/src'),
			'@molos/database/schema': path.resolve(__dirname, 'packages/database/src/schema'),
			'@molos/ui': path.resolve(__dirname, 'packages/ui/src'),
			'@molos/module-types': path.resolve(__dirname, 'packages/module-types/src')
		}
	},

	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					lucide: ['lucide-svelte']
				}
			}
		}
	},

	optimizeDeps: {
		include: ['lucide-svelte']
	},

	ssr: {
		noExternal: ['lucide-svelte']
	},

	server: {
		fs: {
			allow: [
				process.cwd(),
				path.resolve('modules'),
				path.resolve('packages'),
				path.resolve('node_modules/@molos')
			]
		},
		// Allow ngrok and other tunneling services for Telegram webhook development
		allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.ngrok.app', 'localhost']
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
					include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', '**/node_modules/**']
				}
			}
		]
	}
} as any);
