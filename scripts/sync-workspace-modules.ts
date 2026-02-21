#!/usr/bin/env tsx
/**
 * Sync Workspace Modules Script
 *
 * Auto-discovers all modules in modules/ directory and ensures they are
 * added as workspace dependencies in package.json.
 *
 * Usage:
 *   bun run module:sync-deps
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT_DIR = resolve(import.meta.dirname, '..');
const MODULES_DIR = resolve(ROOT_DIR, 'modules');
const PACKAGE_JSON_PATH = resolve(ROOT_DIR, 'package.json');

interface PackageJson {
	name: string;
	workspaces?: string[];
	dependencies?: Record<string, string>;
	[key: string]: unknown;
}

function discoverModules(): Array<{ name: string; path: string }> {
	const modules: Array<{ name: string; path: string }> = [];

	if (!existsSync(MODULES_DIR)) {
		return modules;
	}

	const entries = readdirSync(MODULES_DIR, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const modulePath = resolve(MODULES_DIR, entry.name);
		const packageJsonPath = resolve(modulePath, 'package.json');

		if (existsSync(packageJsonPath)) {
			try {
				const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
				if (packageJson.name) {
					modules.push({
						name: packageJson.name,
						path: modulePath
					});
				}
			} catch (e) {
				console.warn(`[SyncDeps] Warning: Could not parse ${packageJsonPath}`);
			}
		}
	}

	return modules;
}

function syncDependencies(): void {
	console.log('[SyncDeps] Discovering modules...');

	const modules = discoverModules();

	if (modules.length === 0) {
		console.log('[SyncDeps] No modules found');
		return;
	}

	console.log(`[SyncDeps] Found ${modules.length} modules:`);
	for (const mod of modules) {
		console.log(`  - ${mod.name}`);
	}

	// Read current package.json
	const packageJson: PackageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));

	// Ensure dependencies object exists
	if (!packageJson.dependencies) {
		packageJson.dependencies = {};
	}

	// Track changes
	const added: string[] = [];
	const existing: string[] = [];

	// Add all modules as workspace dependencies
	for (const mod of modules) {
		if (packageJson.dependencies[mod.name] === 'workspace:*') {
			existing.push(mod.name);
		} else if (!packageJson.dependencies[mod.name]?.startsWith('github:')) {
			// Don't override GitHub dependencies
			packageJson.dependencies[mod.name] = 'workspace:*';
			added.push(mod.name);
		} else {
			existing.push(`${mod.name} (from GitHub)`);
		}
	}

	// Sort dependencies alphabetically
	const sortedDeps: Record<string, string> = {};
	for (const key of Object.keys(packageJson.dependencies).sort()) {
		sortedDeps[key] = packageJson.dependencies[key];
	}
	packageJson.dependencies = sortedDeps;

	// Write back
	writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n');

	console.log('\n[SyncDeps] Summary:');
	if (added.length > 0) {
		console.log(`  Added: ${added.join(', ')}`);
	}
	if (existing.length > 0) {
		console.log(`  Existing: ${existing.join(', ')}`);
	}

	if (added.length > 0) {
		console.log('\n[SyncDeps] Run `bun install` to install new dependencies');
	}
}

// Run
syncDependencies();
