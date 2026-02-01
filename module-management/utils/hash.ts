import { readFileSync, readdirSync, existsSync, statSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { parse } from 'yaml';

/**
 * Hash state file location
 */
const STATE_FILE_PATH = path.resolve(process.cwd(), '.molo-sync-state.json');

/**
 * Module hash state
 */
interface ModuleSyncState {
	/** Hash of all module manifests */
	manifestHash: string;
	/** Timestamp when hash was computed */
	computedAt: string;
	/** List of modules that were included */
	modules: string[];
}

/**
 * Compute a hash for a single file
 */
function hashFile(filePath: string): string {
	const content = readFileSync(filePath, 'utf-8');
	return createHash('sha256').update(content).digest('hex');
}

/**
 * Compute hash for a directory (includes all files recursively)
 */
function hashDirectory(dirPath: string, excludeDirs: string[] = ['node_modules', '.git']): string {
	const hash = createHash('sha256');

	function processDirectory(currentPath: string) {
		const entries = readdirSync(currentPath, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (excludeDirs.includes(entry.name)) continue;
				processDirectory(path.join(currentPath, entry.name));
			} else if (entry.isFile()) {
				const filePath = path.join(currentPath, entry.name);
				const content = readFileSync(filePath);
				// Include file path relative to module root for consistent hashing
				const relativePath = path.relative(dirPath, filePath);
				hash.update(relativePath + '|' + content.toString('base64'));
			}
		}
	}

	processDirectory(dirPath);
	return hash.digest('hex');
}

/**
 * Compute hash for a module's manifest and key files
 * This is faster than full directory hash and sufficient for change detection
 */
export function hashModuleManifest(modulePath: string): string {
	const hash = createHash('sha256');

	// Always include manifest.yaml
	const manifestPath = path.join(modulePath, 'manifest.yaml');
	if (existsSync(manifestPath)) {
		const manifestContent = readFileSync(manifestPath, 'utf-8');

		// Parse YAML to normalize (ignores whitespace/comments differences)
		try {
			const manifest = parse(manifestContent);
			hash.update(JSON.stringify(manifest));
		} catch {
			// Fallback to raw content if parsing fails
			hash.update(manifestContent);
		}
	}

	// Include config.ts if it exists
	const configPath = path.join(modulePath, 'config.ts');
	if (existsSync(configPath)) {
		hash.update(readFileSync(configPath, 'utf-8'));
	}

	// Include package.json if it exists
	const packagePath = path.join(modulePath, 'package.json');
	if (existsSync(packagePath)) {
		hash.update(readFileSync(packagePath, 'utf-8'));
	}

	return hash.digest('hex');
}

/**
 * Compute combined hash for all modules in external_modules directory
 */
export function hashAllModules(externalModulesDir: string): string {
	const hash = createHash('sha256');
	const modules: string[] = [];

	if (!existsSync(externalModulesDir)) {
		return hash.digest('hex');
	}

	try {
		const items = readdirSync(externalModulesDir, { withFileTypes: true });
		const moduleDirs = items.filter(
			(item) => item.isDirectory() || item.isSymbolicLink()
		);

		// Sort for consistent hashing
		moduleDirs.sort((a, b) => a.name.localeCompare(b.name));

		for (const mod of moduleDirs) {
			const modulePath = path.join(externalModulesDir, mod.name);
			const manifestPath = path.join(modulePath, 'manifest.yaml');

			// Only include modules that have a manifest
			if (existsSync(manifestPath)) {
				const moduleHash = hashModuleManifest(modulePath);
				hash.update(mod.name + ':' + moduleHash);
				modules.push(mod.name);
			}
		}
	} catch (error) {
		console.warn('[HashUtils] Error computing module hashes:', error);
	}

	return hash.digest('hex');
}

/**
 * Load the previous sync state from disk
 */
export function loadSyncState(): ModuleSyncState | null {
	try {
		if (existsSync(STATE_FILE_PATH)) {
			const content = readFileSync(STATE_FILE_PATH, 'utf-8');
			return JSON.parse(content) as ModuleSyncState;
		}
	} catch (error) {
		console.warn('[HashUtils] Failed to load sync state:', error);
	}
	return null;
}

/**
 * Save the current sync state to disk
 */
export function saveSyncState(hash: string, modules: string[]): void {
	try {
		const state: ModuleSyncState = {
			manifestHash: hash,
			computedAt: new Date().toISOString(),
			modules
		};

		// Ensure directory exists
		const dir = path.dirname(STATE_FILE_PATH);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}

		writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2));
	} catch (error) {
		console.warn('[HashUtils] Failed to save sync state:', error);
	}
}

/**
 * Check if modules have changed since last sync
 * @returns true if modules have changed or no previous state exists
 */
export function hasModulesChanged(externalModulesDir: string): boolean {
	const previousState = loadSyncState();
	const currentHash = hashAllModules(externalModulesDir);

	if (!previousState) {
		console.log('[SyncModules] No previous sync state found, sync required');
		return true;
	}

	if (previousState.manifestHash !== currentHash) {
		console.log('[SyncModules] Module changes detected, sync required');
		console.log(`[SyncModules] Previous hash: ${previousState.manifestHash.substring(0, 8)}...`);
		console.log(`[SyncModules] Current hash:  ${currentHash.substring(0, 8)}...`);
		return true;
	}

	console.log('[SyncModules] No changes detected, skipping sync');
	return false;
}

/**
 * Force re-sync by clearing the state file
 */
export function clearSyncState(): void {
	try {
		if (existsSync(STATE_FILE_PATH)) {
			const fs = require('fs');
			fs.unlinkSync(STATE_FILE_PATH);
			console.log('[SyncModules] Sync state cleared');
		}
	} catch (error) {
		console.warn('[SyncScripts] Failed to clear sync state:', error);
	}
}
