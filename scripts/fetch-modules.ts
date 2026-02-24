#!/usr/bin/env tsx
/**
 * Module Fetch Script
 *
 * Clones modules from git repositories based on modules.config.ts.
 * This script is run during Docker build process to populate modules/ directory.
 *
 * Usage:
 *   bun run fetch:modules              - Fetch all modules from config
 *   bun run fetch:modules --single <id> - Fetch specific module by ID
 *
 * Process:
 *   1. Read modules.config.ts
 *   2. Clone each module to modules/{id}/ if it doesn't exist
 *   3. Fetch and checkout specified tag
 *   4. Run bun install in module directory
 *   5. Run drizzle-kit generate if module has drizzle config
 *   6. Validate required files exist
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { modulesConfig, type ModuleConfigEntry } from '../modules.config';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const MODULES_DIR = path.resolve(ROOT_DIR, 'modules');

interface FetchResult {
	moduleId: string;
	success: boolean;
	skipped: boolean;
	error?: string;
	message: string;
}

function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
	const timestamp = new Date().toISOString();
	const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
	console.log(`[FetchModules] [${timestamp}] ${prefix} ${message}`);
}

/**
 * Run a command synchronously and return the output
 */
function runCommand(command: string, cwd: string, silent = false): string {
	try {
		const options: any = { cwd, stdio: silent ? 'pipe' : 'inherit' };
		const output = execSync(command, options);
		return output.toString();
	} catch (error) {
		if (silent && error instanceof Error) {
			throw error;
		}
		throw error;
	}
}

/**
 * Check if a command is available
 */
function commandExists(command: string): boolean {
	try {
		execSync(`which ${command}`, { stdio: 'pipe' });
		return true;
	} catch {
		return false;
	}
}

/**
 * Clone or update a module from git
 */
async function fetchModule(moduleEntry: ModuleConfigEntry): Promise<FetchResult> {
	const { id, git, tag, required } = moduleEntry;
	const modulePath = path.join(MODULES_DIR, id);

	log(`Processing module: ${id} from ${git}#${tag}`);

	const result: FetchResult = {
		moduleId: id,
		success: false,
		skipped: false,
		message: ''
	};

	try {
		if (existsSync(modulePath)) {
			log(`Module ${id} already exists, updating...`, 'info');
			try {
				runCommand('git fetch origin', modulePath, true);
				runCommand(`git checkout ${tag}`, modulePath, true);
				runCommand('git pull origin', modulePath, true);
				result.message = 'Updated existing module';
			} catch (error) {
				log(`Failed to update ${id}, will reinstall: ${error}`, 'warn');
				runCommand(`rm -rf ${modulePath}`, ROOT_DIR);
			}
		}

		if (!existsSync(modulePath)) {
			log(`Cloning ${id}...`, 'info');
			runCommand(`git clone --depth 1 --branch ${tag} ${git} ${id}`, ROOT_DIR);
			result.message = 'Cloned new module';
		}

		const packageJsonPath = path.join(modulePath, 'package.json');
		if (!existsSync(packageJsonPath)) {
			throw new Error('package.json not found');
		}

		log(`Installing dependencies for ${id}...`, 'info');
		try {
			runCommand('bun install', modulePath, true);
		} catch (error) {
			log(`Warning: bun install failed for ${id}: ${error}`, 'warn');
		}

		const drizzleConfigPath = path.join(modulePath, 'drizzle.config.ts');
		if (existsSync(drizzleConfigPath)) {
			log(`Generating migrations for ${id}...`, 'info');
			try {
				runCommand('npx drizzle-kit generate', modulePath, true);
			} catch (error) {
				log(`Warning: drizzle-kit generate failed for ${id}: ${error}`, 'warn');
			}
		}

		const configPath = path.join(modulePath, 'src/config.ts');
		if (!existsSync(configPath)) {
			throw new Error('src/config.ts not found');
		}

		result.success = true;
		result.message += ' and validated successfully';
		log(`Successfully processed ${id}`, 'info');
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		result.error = errorMessage;
		result.message = `Failed: ${errorMessage}`;

		if (required) {
			log(`Required module ${id} failed: ${errorMessage}`, 'error');
			result.success = false;
		} else {
			log(`Optional module ${id} failed, skipping: ${errorMessage}`, 'warn');
			result.skipped = true;
		}
	}

	return result;
}

/**
 * Validate git is available
 */
function validateEnvironment(): void {
	if (!commandExists('git')) {
		throw new Error('git is not installed. Please install git to fetch modules.');
	}

	if (!commandExists('bun')) {
		throw new Error('bun is not installed. Please install bun to install module dependencies.');
	}
}

/**
 * Main function
 */
async function main(): Promise<void> {
	log('Starting module fetch process...');

	try {
		validateEnvironment();

		if (!existsSync(MODULES_DIR)) {
			mkdirSync(MODULES_DIR, { recursive: true });
			log(`Created modules directory: ${MODULES_DIR}`);
		}

		const args = process.argv.slice(2);
		const singleModuleId = args.includes('--single') ? args[args.indexOf('--single') + 1] : null;

		let modulesToFetch: ModuleConfigEntry[] = modulesConfig;

		if (singleModuleId) {
			modulesToFetch = modulesConfig.filter((m) => m.id === singleModuleId);
			if (modulesToFetch.length === 0) {
				log(`Module ${singleModuleId} not found in modules.config.ts`, 'error');
				process.exit(1);
			}
			log(`Fetching single module: ${singleModuleId}`);
		} else {
			log(`Fetching ${modulesConfig.length} modules from config`);
		}

		const results: FetchResult[] = [];

		for (const moduleEntry of modulesToFetch) {
			const result = await fetchModule(moduleEntry);
			results.push(result);
		}

		const successful = results.filter((r) => r.success);
		const failed = results.filter((r) => !r.success && !r.skipped);
		const skipped = results.filter((r) => r.skipped);

		log('\n=== Fetch Summary ===');
		log(`Successfully fetched: ${successful.length}`);
		log(`Failed: ${failed.length}`);
		log(`Skipped: ${skipped.length}`);

		if (failed.length > 0) {
			log('\nFailed modules:', 'error');
			for (const result of failed) {
				log(`  - ${result.moduleId}: ${result.error}`, 'error');
			}
		}

		if (skipped.length > 0) {
			log('\nSkipped modules:', 'warn');
			for (const result of skipped) {
				log(`  - ${result.moduleId}: ${result.message}`, 'warn');
			}
		}

		if (failed.some((r) => modulesConfig.find((m) => m.id === r.moduleId)?.required)) {
			log('\n❌ Required modules failed to fetch. Build cannot continue.', 'error');
			process.exit(1);
		}

		log('\n✅ Module fetch completed successfully');
	} catch (error) {
		log(`Fatal error: ${error}`, 'error');
		process.exit(1);
	}
}

main().catch((error) => {
	log(`Unhandled error: ${error}`, 'error');
	process.exit(1);
});
