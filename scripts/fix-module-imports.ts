#!/usr/bin/env bun
/**
 * Script to fix relative import paths in modules
 *
 * This script fixes imports that incorrectly reference:
 * - ../models → should be relative to src/
 * - ../server → should be relative to src/
 * - ../../models → should be relative to src/
 * - etc.
 */

import { glob } from 'glob';
import fs from 'fs';
import path from 'path';

const modulesDir = 'modules';

// Get module name from command line or process all
const targetModule = process.argv[2];

async function fixImportsInModule(moduleName: string) {
	const modulePath = path.join(modulesDir, moduleName);
	const srcPath = path.join(modulePath, 'src');

	if (!fs.existsSync(srcPath)) {
		console.log(`Skipping ${moduleName} - no src directory`);
		return;
	}

	// Find all .ts and .svelte files
	const files = await glob('**/*.{ts,svelte}', { cwd: srcPath });

	let fixedCount = 0;

	for (const file of files) {
		const filePath = path.join(srcPath, file);
		let content = fs.readFileSync(filePath, 'utf-8');
		let modified = false;

		// Calculate the depth from src directory
		const relativeToSrc = path.dirname(file);
		const depth = relativeToSrc === '.' ? 0 : relativeToSrc.split(path.sep).length;
		const prefixToSrc = '../'.repeat(depth + 1);

		// Fix imports for models - pattern: from '../models' or '../../models' etc
		// Should become: from '../../../models/index.js' (relative to src)
		const modelsPattern = /from\s+['"](\.\.\/)+models['"]/g;
		if (modelsPattern.test(content)) {
			content = content.replace(modelsPattern, `from '${prefixToSrc}models/index.js'`);
			modified = true;
		}

		// Fix imports for stores - pattern: from '../stores' or '../../stores' etc
		const storesPattern = /from\s+['"](\.\.\/)+stores\/api['"]/g;
		if (storesPattern.test(content)) {
			content = content.replace(storesPattern, `from '${prefixToSrc}stores/api.js'`);
			modified = true;
		}

		// Fix imports for stores - pattern: from '../stores/xxx.store'
		const storePattern = /from\s+['"](\.\.\/)+stores\/([a-z-]+\.store)['"]/g;
		if (storePattern.test(content)) {
			content = content.replace(storePattern, `from '${prefixToSrc}stores/$2.js'`);
			modified = true;
		}

		// Fix imports for server/repositories - pattern: from '../server/repositories/xxx'
		const serverPattern = /from\s+['"](\.\.\/)+server\/repositories\/([a-z-]+)['"]/g;
		if (serverPattern.test(content)) {
			content = content.replace(serverPattern, `from '${prefixToSrc}server/repositories/$2.js'`);
			modified = true;
		}

		// Fix imports for lib/components - pattern: from '../lib/components/xxx'
		const libComponentsPattern = /from\s+['"](\.\.\/)+lib\/components\/([a-z-]+\.svelte)['"]/g;
		if (libComponentsPattern.test(content)) {
			content = content.replace(libComponentsPattern, `from '${prefixToSrc}lib/components/$2'`);
			modified = true;
		}

		if (modified) {
			fs.writeFileSync(filePath, content);
			fixedCount++;
			console.log(`Fixed: ${file}`);
		}
	}

	console.log(`\nFixed ${fixedCount} files in ${moduleName}`);
}

async function main() {
	if (targetModule) {
		await fixImportsInModule(targetModule);
	} else {
		// Process all modules
		const modules = fs
			.readdirSync(modulesDir, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory() && dirent.name.startsWith('MoLOS-'))
			.map((dirent) => dirent.name);

		for (const moduleName of modules) {
			console.log(`\n=== Processing ${moduleName} ===`);
			await fixImportsInModule(moduleName);
		}
	}
}

main().catch(console.error);
