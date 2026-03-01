import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],

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
