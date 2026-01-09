import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex()],

	kit: {
		adapter: adapter(),
		csrf: {
			trustedOrigins: (() => {
				const defaults = ['http://localhost:4173', 'http://127.0.0.1:4173'];
				const raw = process.env.CSRF_TRUSTED_ORIGINS;
				if (!raw) return defaults;
				const parsed = raw
					.split(',')
					.map((origin) => origin.trim())
					.filter(Boolean);
				return parsed.length > 0 ? parsed : defaults;
			})()
		}
	},
	extensions: ['.svelte', '.svx']
};

export default config;
