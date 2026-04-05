#!/usr/bin/env bun
/**
 * MoLOS Module Release CLI
 *
 * A CLI for releasing individual modules with proper git workflow.
 *
 * Usage:
 *   bun run module:release --type [major|minor|patch] --module [MoLOS-Tasks...]
 *   bun run module:release --type patch --module MoLOS-Tasks --dry-run
 *   bun run module:release --help
 *
 * Workflow:
 *   - If on 'develop' branch: merge to main (pull first), then tag
 *   - If on 'main' branch: tag and push
 *
 * Requirements:
 *   - Module must be a folder under modules/
 *   - Module must be a git repo
 *   - Module package.json must have a version field
 */

import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MODULES_DIR = path.join(ROOT_DIR, 'modules');

interface Args {
	type: 'major' | 'minor' | 'patch';
	module: string;
	dryRun: boolean;
	skipPush: boolean;
	help: boolean;
}

interface ParsedArgs {
	type?: string;
	module?: string;
	dryRun?: boolean;
	skipPush?: boolean;
	help?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): Args {
	const args = process.argv.slice(2);
	const parsed: ParsedArgs = {};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === '--type' || arg === '-t') {
			parsed.type = args[++i];
		} else if (arg === '--module' || arg === '-m') {
			parsed.module = args[++i];
		} else if (arg === '--dry-run' || arg === '-n') {
			parsed.dryRun = true;
		} else if (arg === '--skip-push') {
			parsed.skipPush = true;
		} else if (arg === '--help' || arg === '-h') {
			parsed.help = true;
		}
	}

	if (parsed.help) {
		printHelp();
		process.exit(0);
	}

	// Validate required arguments
	if (!parsed.type || !parsed.module) {
		console.error('❌ Missing required arguments');
		console.error('   --type and --module are required');
		console.error('');
		printHelp();
		process.exit(1);
	}

	// Validate type
	if (!['major', 'minor', 'patch'].includes(parsed.type)) {
		console.error(`❌ Invalid type: ${parsed.type}`);
		console.error('   Must be one of: major, minor, patch');
		process.exit(1);
	}

	return {
		type: parsed.type as 'major' | 'minor' | 'patch',
		module: parsed.module!,
		dryRun: parsed.dryRun || false,
		skipPush: parsed.skipPush || false,
		help: false
	};
}

/**
 * Print help message
 */
function printHelp() {
	console.log(`
MoLOS Module Release CLI

Usage:
  bun run module:release --type <type> --module <module> [options]

Arguments:
  --type, -t <type>     Version bump type: major, minor, or patch
  --module, -m <name>  Module name (folder name in modules/)

Options:
  --dry-run, -n        Show what would happen without making changes
  --skip-push          Prepare but don't push to remote
  --help, -h           Show this help message

Examples:
  bun run module:release --type patch --module MoLOS-Tasks
  bun run module:release --type minor --module MoLOS-Goals --dry-run
  bun run module:release --type major --module MoLOS-Health

Module Workflow:
  - develop branch: Pull latest, merge to main, then tag and push
  - main branch: Tag and push directly

Tags are created with format: <module>-v<version>
  Example: tasks-v1.2.0, goals-v0.1.0
`);
}

/**
 * Run a command and return output
 */
function run(
	command: string,
	options?: { cwd?: string; silent?: boolean; noThrow?: boolean }
): string {
	const cwd = options?.cwd || ROOT_DIR;
	try {
		const output = execSync(command, {
			cwd,
			encoding: 'utf-8',
			stdio: options?.silent ? 'pipe' : 'inherit'
		});
		return output?.toString().trim() || '';
	} catch (error) {
		if (options?.noThrow) {
			return '';
		}
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Command failed: ${command}\n${errorMessage}`);
	}
}

/**
 * Check if directory exists and is a git repo
 */
function isGitRepo(dirPath: string): boolean {
	return fs.existsSync(path.join(dirPath, '.git'));
}

/**
 * Get current git branch
 */
function getCurrentBranch(cwd: string): string {
	return run('git rev-parse --abbrev-ref HEAD', { cwd, silent: true });
}

/**
 * Get current version from module's package.json
 */
function getCurrentVersion(modulePath: string): string {
	const packageJsonPath = path.join(modulePath, 'package.json');
	if (!fs.existsSync(packageJsonPath)) {
		throw new Error(`package.json not found in ${modulePath}`);
	}
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
	return packageJson.version;
}

/**
 * Calculate new version based on bump type
 */
function calculateNewVersion(current: string, type: 'major' | 'minor' | 'patch'): string {
	const parts = current.split('.').map(Number);
	if (parts.length !== 3) {
		throw new Error(`Invalid version format: ${current}. Expected x.y.z`);
	}

	switch (type) {
		case 'major':
			return `${parts[0] + 1}.0.0`;
		case 'minor':
			return `${parts[0]}.${parts[1] + 1}.0`;
		case 'patch':
			return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
	}
}

/**
 * Get existing tags for a module
 */
function getModuleTags(modulePath: string): string[] {
	try {
		const output = run('git tag -l', { cwd: modulePath, silent: true });
		return output.split('\n').filter((tag) => tag.trim() !== '');
	} catch {
		return [];
	}
}

/**
 * Check if tag already exists
 */
function tagExists(tag: string, modulePath: string): boolean {
	try {
		run(`git rev-parse "${tag}"`, { cwd: modulePath, silent: true, noThrow: true });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get the latest matching tag for a module
 */
function getLatestTag(modulePath: string, moduleName: string): string | null {
	const tags = getModuleTags(modulePath);
	const prefix = `${moduleName.toLowerCase()}-v`;
	const versionTags = tags
		.filter((tag) => tag.toLowerCase().startsWith(prefix))
		.sort((a, b) => {
			const parseVersion = (t: string) => t.replace(prefix, '').replace(/^v/, '');
			return compareVersions(parseVersion(b), parseVersion(a));
		});
	return versionTags[0] || null;
}

/**
 * Compare two semver versions
 */
function compareVersions(a: string, b: string): number {
	const partsA = a.split('.').map(Number);
	const partsB = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) {
		if (partsA[i] > partsB[i]) return 1;
		if (partsA[i] < partsB[i]) return -1;
	}
	return 0;
}

/**
 * Check if there are uncommitted changes
 */
function hasUncommittedChanges(cwd: string): boolean {
	const status = run('git status --porcelain', { cwd, silent: true });
	return status.trim() !== '';
}

/**
 * Check if remote exists
 */
function hasRemote(cwd: string): boolean {
	try {
		run('git remote get-url origin', { cwd, silent: true, noThrow: true });
		return true;
	} catch {
		return false;
	}
}

/**
 * Update version in package.json
 */
function updatePackageJsonVersion(modulePath: string, newVersion: string, dryRun: boolean) {
	const packageJsonPath = path.join(modulePath, 'package.json');
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
	const oldVersion = packageJson.version;
	packageJson.version = newVersion;

	if (!dryRun) {
		fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
	}
	console.log(`  ✓ Version updated: ${oldVersion} → ${newVersion}`);
}

/**
 * Create git tag
 */
function createTag(modulePath: string, tag: string, message: string, dryRun: boolean) {
	if (dryRun) {
		console.log(`  [DRY RUN] Would create tag: ${tag}`);
	} else {
		run(`git tag -a "${tag}" -m "${message}"`, { cwd: modulePath });
		console.log(`  ✓ Tag created: ${tag}`);
	}
}

/**
 * Main release process
 */
async function main() {
	const args = parseArgs();
	const modulePath = path.join(MODULES_DIR, args.module);

	// Step 0: Help check
	if (args.help) {
		printHelp();
		process.exit(0);
	}

	console.log('\n🚀 MoLOS Module Release Process\n');
	console.log(`  Module:     ${args.module}`);
	console.log(`  Type:       ${args.type}`);
	console.log(`  Path:       ${modulePath}`);
	if (args.dryRun) {
		console.log('\n  📋 DRY RUN - No changes will be made\n');
	}

	// Step 1: Check module exists
	console.log('\n📋 Step 1: Checking module exists...');
	if (!fs.existsSync(modulePath)) {
		console.error(`❌ Module not found: ${modulePath}`);
		console.error(`   Expected folder under modules/`);
		process.exit(1);
	}
	console.log('  ✓ Module found');

	// Step 2: Check is git repo
	console.log('\n📋 Step 2: Checking git repository...');
	if (!isGitRepo(modulePath)) {
		console.error(`❌ Not a git repository: ${modulePath}`);
		console.error('   Module must be a git repo to release');
		process.exit(1);
	}
	console.log('  ✓ Git repository');

	// Step 3: Check remote exists
	console.log('\n📋 Step 3: Checking remote...');
	if (!hasRemote(modulePath)) {
		console.error(`❌ No remote configured for ${args.module}`);
		console.error('   Please add a remote: git remote add origin <url>');
		process.exit(1);
	}
	const remoteUrl = run('git remote get-url origin', { cwd: modulePath, silent: true });
	console.log(`  ✓ Remote: ${remoteUrl}`);

	// Step 4: Check current branch
	console.log('\n📋 Step 4: Checking current branch...');
	const currentBranch = getCurrentBranch(modulePath);
	console.log(`  Current branch: ${currentBranch}`);

	if (currentBranch !== 'main' && currentBranch !== 'develop') {
		console.error(`❌ Invalid branch: ${currentBranch}`);
		console.error('   Must be on "develop" or "main" branch');
		process.exit(1);
	}

	// Step 5: Check uncommitted changes
	console.log('\n📋 Step 5: Checking for uncommitted changes...');
	if (hasUncommittedChanges(modulePath)) {
		console.error(`❌ Working directory has uncommitted changes`);
		console.error('   Please commit or stash your changes first');
		process.exit(1);
	}
	console.log('  ✓ Working directory clean');

	// Step 6: Pull latest if on develop
	if (currentBranch === 'develop') {
		console.log('\n📋 Step 6: Pulling latest changes (develop branch)...');
		try {
			run('git pull origin develop', { cwd: modulePath });
			console.log('  ✓ Pulled latest from develop');
		} catch {
			console.error('❌ Failed to pull from develop');
			console.error('   Please ensure you can push to develop branch');
			process.exit(1);
		}

		// Check if main exists locally
		console.log('\n📋 Step 6b: Checking main branch...');
		try {
			run('git fetch origin main:main', { cwd: modulePath, silent: true, noThrow: true });
			const mainExists = run('git rev-parse --verify --quiet main', {
				cwd: modulePath,
				silent: true,
				noThrow: true
			});
			if (!mainExists) {
				console.error('❌ main branch does not exist in local repo');
				console.error('   Please ensure the repo has a main branch');
				process.exit(1);
			}
			console.log('  ✓ main branch exists');
		} catch {
			console.error('❌ Failed to fetch main branch');
			process.exit(1);
		}

		// Merge develop to main
		console.log('\n📋 Step 6c: Merging develop to main...');
		try {
			run('git checkout main', { cwd: modulePath });
			run('git merge develop', { cwd: modulePath });
			console.log('  ✓ Merged develop → main');
		} catch {
			console.error('❌ Failed to merge develop to main');
			console.error('   Please resolve merge conflicts manually');
			process.exit(1);
		}
	}

	// Step 7: Get current version
	console.log('\n📋 Step 7: Reading current version...');
	const currentVersion = getCurrentVersion(modulePath);
	console.log(`  Current version: ${currentVersion}`);

	// Step 8: Calculate new version
	console.log('\n📋 Step 8: Calculating new version...');
	const newVersion = calculateNewVersion(currentVersion, args.type);
	const tagName = `${args.module.toLowerCase()}-v${newVersion}`;
	console.log(`  New version: ${newVersion}`);
	console.log(`  Tag name: ${tagName}`);

	// Step 9: Check if tag already exists
	console.log('\n📋 Step 9: Checking if tag already exists...');
	if (tagExists(tagName, modulePath)) {
		console.error(`❌ Tag already exists: ${tagName}`);
		console.error('   Please bump to a higher version or delete the existing tag');
		process.exit(1);
	}

	// Also check latest existing tag for context
	const latestTag = getLatestTag(modulePath, args.module);
	if (latestTag) {
		console.log(`  Latest ${args.module} tag: ${latestTag}`);
	}
	console.log('  ✓ Tag does not exist');

	// Step 10: Update package.json version
	console.log('\n📋 Step 10: Updating package.json version...');
	updatePackageJsonVersion(modulePath, newVersion, args.dryRun);

	// Step 11: Commit version change
	if (!args.dryRun) {
		console.log('\n📋 Step 11: Committing version change...');
		try {
			run('git add package.json', { cwd: modulePath });
			run(`git commit -m "chore(release): ${args.module} v${newVersion}"`, { cwd: modulePath });
			console.log(`  ✓ Committed: ${args.module} v${newVersion}`);
		} catch {
			console.error('❌ Failed to commit version change');
			process.exit(1);
		}
	} else {
		console.log('\n📋 Step 11: [DRY RUN] Would commit version change');
	}

	// Step 12: Create tag
	console.log('\n📋 Step 12: Creating git tag...');
	createTag(modulePath, tagName, `Release ${args.module} v${newVersion}`, args.dryRun);

	// Step 13: Push to remote
	if (!args.skipPush && !args.dryRun) {
		console.log('\n📋 Step 13: Pushing to remote...');
		try {
			run('git push origin main', { cwd: modulePath });
			console.log('  ✓ Pushed main to origin');
			run(`git push origin ${tagName}`, { cwd: modulePath });
			console.log(`  ✓ Pushed tag ${tagName} to origin`);
		} catch {
			console.error('❌ Failed to push to remote');
			console.error('   Please push manually:');
			console.error(`     git push origin main`);
			console.error(`     git push origin ${tagName}`);
			process.exit(1);
		}
	} else if (args.skipPush && !args.dryRun) {
		console.log('\n📋 Step 13: Skipping push (--skip-push)');
		console.log('  Please push manually:');
		console.log(`    git push origin main`);
		console.log(`    git push origin ${tagName}`);
	} else {
		console.log('\n📋 Step 13: [DRY RUN] Would push to remote');
	}

	// Step 14: Switch back to develop if we were on it
	if (currentBranch === 'develop' && !args.dryRun) {
		console.log('\n📋 Step 14: Switching back to develop...');
		try {
			run('git checkout develop', { cwd: modulePath });
			console.log('  ✓ Switched back to develop');
		} catch {
			console.log('  ⚠️  Could not switch back to develop (please do manually)');
		}
	}

	// Summary
	console.log('\n' + '='.repeat(50));
	console.log('✅ Module Release Completed Successfully!');
	console.log('='.repeat(50) + '\n');

	console.log(`  Module:     ${args.module}`);
	console.log(`  Version:    ${newVersion}`);
	console.log(`  Tag:       ${tagName}`);
	console.log(`  Branch:    ${currentBranch === 'develop' ? 'develop → main' : 'main'}`);

	if (args.skipPush) {
		console.log('\n📤 Push skipped. Please push manually when ready:');
		console.log(`    git push origin main`);
		console.log(`    git push origin ${tagName}`);
	}

	console.log('\n');
}

try {
	main().catch((error) => {
		console.error('\n❌ Release failed:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
} catch (error) {
	console.error('\n❌ Fatal error:', error instanceof Error ? error.message : String(error));
	process.exit(1);
}
