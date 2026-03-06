#!/usr/bin/env node
/**
 * Remove workspace:* dependencies from package.json
 * They will be re-added by module:sync-deps after modules are fetched
 */

import { readFileSync, writeFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

if (pkg.dependencies) {
	const removed = [];
	Object.keys(pkg.dependencies).forEach((key) => {
		if (pkg.dependencies[key] === 'workspace:*') {
			removed.push(key);
			delete pkg.dependencies[key];
		}
	});

	if (removed.length > 0) {
		console.log(`Removed ${removed.length} workspace dependencies from package.json`);
	}
}

writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
