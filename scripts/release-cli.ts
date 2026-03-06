#!/usr/bin/env bun
/**
 * MoLOS Release CLI
 *
 * A simple CLI for creating releases manually when the PR label workflow
 * isn't appropriate (e.g., hotfixes, initial setup).
 *
 * Usage:
 *   bun run release patch   # Bug fixes
 *   bun run release minor   # New features
 *   bun run release major   # Breaking changes
 *   bun run release --help  # Show help
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Parse arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h') || args.length === 0) {
	console.log(`
MoLOS Release CLI

Usage:
  bun run release <version-type> [options]

Version Types:
  patch     Bug fixes, small changes (0.0.x)
  minor     New features, backwards compatible (0.x.0)
  major     Breaking changes (x.0.0)

Options:
  --dry-run, -n    Show what would happen without making changes
  --skip-tests     Skip running tests before release
  --help, -h       Show this help message

Examples:
  bun run release patch
  bun run release minor --dry-run
  bun run release major --skip-tests
`);
	process.exit(0);
}

const versionType = args[0];
const isDryRun = args.includes('--dry-run') || args.includes('-n');
const skipTests = args.includes('--skip-tests');

// Validate version type
if (!['patch', 'minor', 'major'].includes(versionType)) {
	console.error(`❌ Invalid version type: ${versionType}`);
	console.error('   Must be one of: patch, minor, major');
	process.exit(1);
}

/**
 * Run a command and return output
 */
function run(command: string, options?: { silent?: boolean }): string {
	if (!isDryRun) {
		try {
			const output = execSync(command, {
				cwd: ROOT_DIR,
				encoding: 'utf-8',
				stdio: options?.silent ? 'pipe' : 'inherit'
			});
			return output;
		} catch (error) {
			if (!options?.silent) {
				console.error(`❌ Command failed: ${command}`);
			}
			throw error;
		}
	} else {
		console.log(`  [DRY RUN] ${command}`);
		return '';
	}
}

/**
 * Get current version from package.json
 */
function getCurrentVersion(): string {
	const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
	return packageJson.version;
}

/**
 * Calculate new version
 */
function calculateNewVersion(current: string, type: string): string {
	const parts = current.split('.').map(Number);
	switch (type) {
		case 'major':
			return `${parts[0] + 1}.0.0`;
		case 'minor':
			return `${parts[0]}.${parts[1] + 1}.0`;
		case 'patch':
			return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
		default:
			return current;
	}
}

/**
 * Main release process
 */
function main() {
	const currentVersion = getCurrentVersion();
	const newVersion = calculateNewVersion(currentVersion, versionType);

	console.log('\n🚀 MoLOS Release Process\n');
	console.log(`  Current version: v${currentVersion}`);
	console.log(`  New version:     v${newVersion}`);
	console.log(`  Release type:    ${versionType}`);
	if (isDryRun) {
		console.log('\n  📋 DRY RUN - No changes will be made\n');
	}

	// Step 1: Check git status
	console.log('\n📋 Step 1: Checking git status...');
	try {
		const status = run('git status --porcelain', { silent: true });
		if (status.trim() && !isDryRun) {
			console.error('❌ Working directory has uncommitted changes');
			console.error('   Please commit or stash your changes first');
			process.exit(1);
		}
		console.log('  ✓ Working directory clean');
	} catch {
		// Continue in dry run
	}

	// Step 2: Check current branch
	console.log('\n📋 Step 2: Checking branch...');
	try {
		const branch = run('git rev-parse --abbrev-ref HEAD', { silent: true }).trim();
		if (branch !== 'main' && !isDryRun) {
			console.error(`❌ Not on main branch (currently on: ${branch})`);
			console.error('   Releases should only be created from main');
			process.exit(1);
		}
		console.log(`  ✓ On branch: ${branch}`);
	} catch {
		// Continue in dry run
	}

	// Step 3: Run tests
	if (!skipTests) {
		console.log('\n📋 Step 3: Running tests...');
		try {
			run('bun run test');
			console.log('  ✓ Tests passed');
		} catch {
			console.error('❌ Tests failed. Fix issues before releasing.');
			console.error('   Use --skip-tests to bypass this check');
			process.exit(1);
		}
	} else {
		console.log('\n📋 Step 3: Skipping tests (--skip-tests)');
	}

	// Step 4: Run type check
	console.log('\n📋 Step 4: Running type check...');
	try {
		run('bun run check');
		console.log('  ✓ Type check passed');
	} catch {
		console.error('❌ Type check failed. Fix issues before releasing.');
		process.exit(1);
	}

	// Step 5: Bump version
	console.log('\n📋 Step 5: Bumping version...');
	run(`npm version ${versionType} --no-git-tag-version`);
	console.log(`  ✓ Version bumped to v${newVersion}`);

	// Step 6: Update CHANGELOG
	console.log('\n📋 Step 6: Updating CHANGELOG...');
	const date = new Date().toISOString().split('T')[0];
	const changelogPath = path.join(ROOT_DIR, 'CHANGELOG.md');
	let changelog = fs.readFileSync(changelogPath, 'utf-8');

	// Find the [Unreleased] section and add new entry after it
	const unreleasedMatch = changelog.indexOf('## [Unreleased]');
	if (unreleasedMatch !== -1) {
		const afterUnreleased = changelog.indexOf('\n', unreleasedMatch) + 1;
		const newEntry = `\n## [${newVersion}] - ${date}\n\n### Changed\n\n- Release v${newVersion}\n`;
		changelog = changelog.slice(0, afterUnreleased) + newEntry + changelog.slice(afterUnreleased);

		if (!isDryRun) {
			fs.writeFileSync(changelogPath, changelog, 'utf-8');
		}
		console.log(`  ✓ CHANGELOG.md updated`);
	} else {
		console.log('  ⚠️  Could not find [Unreleased] section in CHANGELOG.md');
	}

	// Step 7: Update modules.config.ts
	console.log('\n📋 Step 7: Updating modules.config.ts...');
	try {
		run('bun run release:modules-config');
		console.log('  ✓ modules.config.ts updated');
	} catch {
		console.log('  ⚠️  modules.config.ts update skipped');
	}

	// Step 8: Commit changes
	console.log('\n📋 Step 8: Committing changes...');
	run('git add package.json CHANGELOG.md modules.config.ts');
	run(`git commit -m "chore(release): v${newVersion}"`);
	console.log('  ✓ Changes committed');

	// Step 9: Create tag
	console.log('\n📋 Step 9: Creating git tag...');
	run(`git tag -a "v${newVersion}" -m "Release v${newVersion}"`);
	console.log(`  ✓ Tag v${newVersion} created`);

	// Summary
	console.log('\n✅ Release v${newVersion} prepared successfully!\n');
	console.log('Next steps:');
	console.log('  1. Review the changes: git show HEAD');
	console.log('  2. Push to remote:     git push origin main');
	console.log('  3. Push tag:           git push origin v' + newVersion);
	console.log('\nGitHub Actions will automatically build and publish the Docker image.\n');
}

try {
	main();
} catch (error) {
	console.error('\n❌ Release failed:', error);
	process.exit(1);
}
