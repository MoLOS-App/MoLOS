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
 *   3. Fetch and checkout specified tag or branch
 *   4. Validate required files exist
 *
 * Note: Modules must include their migrations in the drizzle/ directory.
 * Migrations are NOT auto-generated during fetch. Use `bun run db:migration:create`
 * to create new migrations manually.
 *
 * Dependencies are resolved at the monorepo root level via workspace:* protocol.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import {
	modulesConfig,
	type ModuleConfigEntry,
	validateModuleConfigEntry,
	getModuleRef,
	getModuleRefType
} from '../modules.config';

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
		return output?.toString() ?? '';
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
 * Check if a ref exists on the remote repository
 */
function refExists(gitUrl: string, ref: string, refType: 'tag' | 'branch'): boolean {
	try {
		const refPath = refType === 'tag' ? `refs/tags/${ref}` : `refs/heads/${ref}`;
		const output = execSync(`git ls-remote ${gitUrl} ${refPath}`, { stdio: 'pipe' });
		return output.toString().trim().length > 0;
	} catch {
		return false;
	}
}

/**
 * Get list of available tags from remote
 */
function getAvailableTags(gitUrl: string): string[] {
	try {
		const output = execSync(`git ls-remote --tags ${gitUrl}`, { stdio: 'pipe' });
		const lines = output.toString().trim().split('\n');
		return lines
			.filter((line) => line.includes('refs/tags/'))
			.map((line) => {
				const match = line.match(/refs\/tags\/(.+)$/);
				return match ? match[1] : '';
			})
			.filter((tag) => tag && !tag.endsWith('^{}'));
	} catch {
		return [];
	}
}

/**
 * Clone or update a module from git
 */
async function fetchModule(moduleEntry: ModuleConfigEntry): Promise<FetchResult> {
	const { id, git, required } = moduleEntry;
	const modulePath = path.join(MODULES_DIR, id);
	const ref = getModuleRef(moduleEntry);
	const refType = getModuleRefType(moduleEntry);

	// Validate config entry
	const validationError = validateModuleConfigEntry(moduleEntry);
	if (validationError) {
		return {
			moduleId: id,
			success: false,
			skipped: false,
			error: validationError,
			message: `Configuration error: ${validationError}`
		};
	}

	log(`Processing module: ${id} from ${git} (${refType}: ${ref})`);

	// Check if ref exists before attempting to clone
	if (!refExists(git, ref, refType)) {
		const errorMsg =
			refType === 'tag'
				? `Tag '${ref}' not found on remote. Available tags: ${getAvailableTags(git).slice(0, 5).join(', ')}${getAvailableTags(git).length > 5 ? '...' : ''}`
				: `Branch '${ref}' not found on remote`;
		return {
			moduleId: id,
			success: false,
			skipped: false,
			error: errorMsg,
			message: `Failed: ${errorMsg}`
		};
	}

	const result: FetchResult = {
		moduleId: id,
		success: false,
		skipped: false,
		message: ''
	};

	try {
		// For branch-based modules, skip if already exists (preserve local changes)
		// For tag-based modules, always re-clone (ensure exact version)
		if (existsSync(modulePath)) {
			if (refType === 'branch') {
				log(
					`Module ${id} already exists (branch: ${ref}), skipping clone to preserve local changes`,
					'info'
				);
				result.success = true;
				result.skipped = true;
				result.message = `Skipped (already exists, branch: ${ref})`;
				return result;
			}
			// Tag-based: remove for clean clone
			log(`Removing existing ${id} for clean clone (tag: ${ref})...`, 'info');
			runCommand(`rm -rf ${modulePath}`, ROOT_DIR);
		}

		log(`Cloning ${id}...`, 'info');
		// For tags: git clone --depth 1 --branch <tag> works for tags too
		// Suppress detached HEAD warning
		runCommand(
			`git -c advice.detachedHead=false clone --depth 1 --branch ${ref} ${git} ${id}`,
			MODULES_DIR
		);
		result.message = 'Cloned new module';

		const packageJsonPath = path.join(modulePath, 'package.json');
		if (!existsSync(packageJsonPath)) {
			throw new Error('package.json not found');
		}

		// Note: We don't run `bun install` here because modules may have
		// workspace:* dependencies that can only be resolved from the monorepo root.
		// The root-level `bun install` (after module:sync-deps) handles all dependencies.

		// Note: Migrations are NOT auto-generated. Modules must include their
		// migrations in the drizzle/ directory. Use `bun run db:migration:create`
		// to create new migrations manually.

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
		throw new Error('bun is not installed.');
	}
}

/**
 * Main function
 */
async function main(): Promise<void> {
	log('Starting module fetch process...');

	try {
		validateEnvironment();

		// Validate all module config entries first
		const configErrors: string[] = [];
		for (const entry of modulesConfig) {
			const error = validateModuleConfigEntry(entry);
			if (error) {
				configErrors.push(error);
			}
		}

		if (configErrors.length > 0) {
			log('Configuration errors found:', 'error');
			configErrors.forEach((err) => log(`  - ${err}`, 'error'));
			process.exit(1);
		}

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
