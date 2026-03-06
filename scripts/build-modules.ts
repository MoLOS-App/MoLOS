#!/usr/bin/env tsx
/**
 * Module Build Preparation Script
 *
 * Prepares modules for production build by:
 *   1. Syncing module dependencies to workspace
 *   2. Cleaning up broken symlinks
 *   3. Linking module routes into app structure
 *   4. Running svelte-kit sync to generate types
 *   5. Validating all linked modules
 *
 * This script is run during Docker build after modules are fetched.
 *
 * Usage:
 *   bun run build:prepare - Prepare all modules for build
 */

import { execSync } from 'child_process';
import path from 'path';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
	const timestamp = new Date().toISOString();
	const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
	console.log(`[BuildModules] [${timestamp}] ${prefix} ${message}`);
}

/**
 * Run a script and return whether it succeeded
 */
function runScript(name: string, command: string): boolean {
	try {
		log(`Running ${name}...`, 'info');
		execSync(command, { cwd: ROOT_DIR, stdio: 'inherit' });
		log(`${name} completed successfully`, 'info');
		return true;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		log(`${name} failed: ${errorMessage}`, 'error');
		return false;
	}
}

/**
 * Main function
 */
async function main(): Promise<void> {
	log('Starting module build preparation...');

	const steps = [
		{ name: 'Module dependency sync', command: 'bun run module:sync-deps', required: true },
		{ name: 'Module symlink cleanup', command: 'bun run module:cleanup', required: true },
		{ name: 'Module route linking', command: 'bun run module:link', required: true },
		{ name: 'SvelteKit sync', command: 'npx svelte-kit sync', required: true }
	];

	const failedSteps: string[] = [];

	for (const step of steps) {
		const success = runScript(step.name, step.command);
		if (!success && step.required) {
			failedSteps.push(step.name);
		}
	}

	if (failedSteps.length > 0) {
		log(`\n❌ Required steps failed: ${failedSteps.join(', ')}`, 'error');
		log('Build preparation cannot continue.', 'error');
		process.exit(1);
	}

	log('\n✅ Module build preparation completed successfully');
	log('You can now run: npm run build');
}

main().catch((error) => {
	log(`Fatal error: ${error}`, 'error');
	process.exit(1);
});
