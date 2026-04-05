#!/usr/bin/env bun
/**
 * Update modules.config.ts with latest module versions from their package.json files
 *
 * This script is run during the release process to ensure modules.config.ts
 * reflects the latest released versions of each module.
 *
 * Usage:
 *   bun run scripts/update-modules-config.ts
 *   bun run scripts/update-modules-config.ts --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';

interface ModuleConfigEntry {
	id: string;
	git: string;
	tag: string;
	required?: boolean;
}

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MODULES_CONFIG_PATH = path.join(ROOT_DIR, 'modules.config.ts');
const MODULES_DIR = path.join(ROOT_DIR, 'modules');

// Parse arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-n');

/**
 * Extract module ID from package name
 * @molos/module-tasks -> MoLOS-Tasks
 */
function packageNameToModuleId(packageName: string): string | null {
	const match = packageName.match(/@molos\/module-(.+)/);
	if (!match) return null;

	const name = match[1];
	// Convert kebab-case to MoLOS-PascalCase
	const pascalCase = name
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');

	return `MoLOS-${pascalCase}`;
}

/**
 * Get version from a module's package.json
 */
function getModuleVersion(modulePath: string): string | null {
	const packageJsonPath = path.join(modulePath, 'package.json');

	if (!fs.existsSync(packageJsonPath)) {
		console.warn(`  ⚠️  No package.json found at ${modulePath}`);
		return null;
	}

	try {
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
		return packageJson.version || null;
	} catch (error) {
		console.warn(`  ⚠️  Failed to parse ${packageJsonPath}: ${error}`);
		return null;
	}
}

/**
 * Get module ID from package.json name
 */
function getModuleIdFromPackage(modulePath: string): string | null {
	const packageJsonPath = path.join(modulePath, 'package.json');

	if (!fs.existsSync(packageJsonPath)) {
		return null;
	}

	try {
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
		return packageNameToModuleId(packageJson.name);
	} catch {
		return null;
	}
}

/**
 * Parse current modules.config.ts and extract entries
 */
function parseModulesConfig(): ModuleConfigEntry[] {
	if (!fs.existsSync(MODULES_CONFIG_PATH)) {
		console.error('❌ modules.config.ts not found');
		process.exit(1);
	}

	const content = fs.readFileSync(MODULES_CONFIG_PATH, 'utf-8');
	const entries: ModuleConfigEntry[] = [];

	// Simple regex-based parsing for the config array
	const entryRegex =
		/\{\s*id:\s*['"]([^'"]+)['"]\s*,\s*git:\s*['"]([^'"]+)['"]\s*,\s*tag:\s*['"]([^'"]+)['"]\s*(,\s*required:\s*(true|false))?\s*\}/g;

	let match;
	while ((match = entryRegex.exec(content)) !== null) {
		entries.push({
			id: match[1],
			git: match[2],
			tag: match[3],
			required: match[5] === 'true'
		});
	}

	return entries;
}

/**
 * Generate updated modules.config.ts content
 */
function generateModulesConfig(entries: ModuleConfigEntry[]): string {
	const entriesStr = entries
		.map((entry) => {
			const requiredStr = entry.required !== undefined ? `\n\t\trequired: ${entry.required}` : '';
			return `\t{\n\t\tid: '${entry.id}',\n\t\tgit: '${entry.git}',\n\t\ttag: '${entry.tag}'${requiredStr}\n\t}`;
		})
		.join(',\n');

	return `/**
 * Module Configuration
 *
 * Defines which modules should be included in the production build.
 * Modules are cloned from git at build time using the specified tags.
 *
 * To add a module: Add an entry to the modulesConfig array.
 * To remove a module: Remove the entry or set required: false (if optional).
 *
 * Format:
 * - id: The module identifier (used as folder name in modules/)
 * - git: The git repository URL
 * - tag: The specific tag or branch to checkout
 * - required: If true, build fails if module cannot be cloned (default: false)
 *
 * This file is automatically updated by the release system when module versions change.
 */

export interface ModuleConfigEntry {
	id: string;
	git: string;
	tag: string;
	required?: boolean;
}

export const modulesConfig: ModuleConfigEntry[] = [
${entriesStr}
];
`;
}

/**
 * Main function
 */
function main() {
	console.log('🔄 Updating modules.config.ts with latest module versions...\n');

	if (isDryRun) {
		console.log('📋 DRY RUN - No changes will be written\n');
	}

	// Get current config
	const currentEntries = parseModulesConfig();
	console.log(`📁 Found ${currentEntries.length} modules in config\n`);

	// Track changes
	const changes: { id: string; oldTag: string; newTag: string }[] = [];

	// Check each module directory
	const updatedEntries = currentEntries.map((entry) => {
		const modulePath = path.join(MODULES_DIR, entry.id);

		if (!fs.existsSync(modulePath)) {
			console.log(`  ⏭️  ${entry.id}: Module directory not found, keeping ${entry.tag}`);
			return entry;
		}

		const version = getModuleVersion(modulePath);
		if (!version) {
			console.log(`  ⏭️  ${entry.id}: Could not determine version, keeping ${entry.tag}`);
			return entry;
		}

		const newTag = `v${version}`;
		const moduleId = getModuleIdFromPackage(modulePath);

		// Verify module ID matches
		if (moduleId && moduleId !== entry.id) {
			console.log(`  ⚠️  ${entry.id}: Package name doesn't match (${moduleId}), skipping`);
			return entry;
		}

		if (entry.tag !== newTag) {
			console.log(`  ✨ ${entry.id}: ${entry.tag} → ${newTag}`);
			changes.push({ id: entry.id, oldTag: entry.tag, newTag });
			return { ...entry, tag: newTag };
		}

		console.log(`  ✓  ${entry.id}: ${entry.tag} (up to date)`);
		return entry;
	});

	// Check for modules in directory not in config
	console.log('\n📂 Checking for untracked modules...');
	if (fs.existsSync(MODULES_DIR)) {
		const dirs = fs.readdirSync(MODULES_DIR, { withFileTypes: true });
		for (const dir of dirs) {
			if (!dir.isDirectory()) continue;
			if (!dir.name.startsWith('MoLOS-')) continue;

			const exists = currentEntries.some((e) => e.id === dir.name);
			if (!exists) {
				console.log(`  ⚠️  ${dir.name}: Found in modules/ but not in config`);
			}
		}
	}

	// Write changes if any
	if (changes.length > 0) {
		console.log(`\n📝 ${changes.length} module(s) updated`);

		if (!isDryRun) {
			const newContent = generateModulesConfig(updatedEntries);
			fs.writeFileSync(MODULES_CONFIG_PATH, newContent, 'utf-8');
			console.log('✅ modules.config.ts updated successfully');
		} else {
			console.log('📋 Would write the following changes:');
			changes.forEach((c) => console.log(`   ${c.id}: ${c.oldTag} → ${c.newTag}`));
		}
	} else {
		console.log('\n✅ All modules are up to date');
	}
}

main();
