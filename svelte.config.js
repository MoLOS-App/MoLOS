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
			trustedOrigins: process.env.CSRF_TRUSTED_ORIGINS ? process.env.CSRF_TRUSTED_ORIGINS.split(',') : ['http://localhost:4173', 'http://127.0.0.1:4173']
		}
	},
	extensions: ['.svelte', '.svx']
};

export default config;
