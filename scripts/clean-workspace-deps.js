#!/usr/bin/env node
/**
 * Clean Workspace Dependencies Script
 *
 * Removes all @molos/module-* workspace dependencies from package.json.
 * This is used during Docker builds to ensure bun install doesn't fail
 * when modules haven't been fetched yet.
 *
 * After modules are fetched, sync-workspace-modules.ts adds them back.
 *
 * Usage:
 *   node scripts/clean-workspace-deps.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const PACKAGE_JSON_PATH = resolve(ROOT_DIR, 'package.json');

/**
 * Check if a dependency name is a MoLOS module package
 */
function isMolosModulePackage(name) {
	return name.startsWith('@molos/module-');
}

function cleanWorkspaceDeps() {
	console.log('[CleanDeps] Reading package.json...');

	// Read current package.json
	const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));

	// Ensure dependencies object exists
	if (!packageJson.dependencies) {
		console.log('[CleanDeps] No dependencies found');
		return;
	}

	// Find and remove @molos/module-* workspace dependencies
	const removed = [];

	for (const depName of Object.keys(packageJson.dependencies)) {
		const depValue = packageJson.dependencies[depName];

		// Only remove workspace dependencies for MoLOS modules
		if (isMolosModulePackage(depName) && depValue === 'workspace:*') {
			removed.push(depName);
			delete packageJson.dependencies[depName];
		}
	}

	// Sort dependencies alphabetically
	const sortedDeps = {};
	for (const key of Object.keys(packageJson.dependencies).sort()) {
		sortedDeps[key] = packageJson.dependencies[key];
	}
	packageJson.dependencies = sortedDeps;

	// Write back
	writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n');

	console.log('[CleanDeps] Summary:');
	if (removed.length > 0) {
		console.log(`  Removed ${removed.length} workspace dependencies:`);
		for (const name of removed) {
			console.log(`    - ${name}`);
		}
	} else {
		console.log('  No workspace dependencies to remove');
	}
}

// Run
cleanWorkspaceDeps();
