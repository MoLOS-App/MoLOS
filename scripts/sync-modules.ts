import { existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { linkAllModules, type ModuleLinkResult } from './link-modules.js';

// Load .env file before any imports that might use DATABASE_URL
function loadEnv() {
	const envPath = path.resolve(process.cwd(), '.env');
	if (existsSync(envPath)) {
		const envContent = readFileSync(envPath, 'utf-8');
		envContent.split('\n').forEach((line) => {
			const [key, ...valueParts] = line.split('=');
			if (key && valueParts.length > 0) {
				const value = valueParts
					.join('=')
					.trim()
					.replace(/^["']|["']$/g, '');
				const trimmedKey = key.trim();
				if (!process.env[trimmedKey]) {
					process.env[trimmedKey] = value;
				}
			}
		});
	}
}

loadEnv();

// Import after loading env
import { ModuleManager } from '../module-management/server/module-manager';

/**
 * Initialize the database before module manager runs
 * This is a local import of the init-database functionality
 */
async function initDatabase() {
	const dbPath = path.resolve(process.cwd(), 'data/molos.db');
	const dbExists = existsSync(dbPath);

	// Check if database file exists and has content
	let needsInit = true;
	if (dbExists) {
		try {
			const stats = require('fs').statSync(dbPath);
			// File larger than 1KB is likely already initialized
			if (stats.size > 1024) {
				needsInit = false;
			}
		} catch {
			// If stat fails, assume we need to init
		}
	}

	if (needsInit) {
		console.log('[SyncModules] Database not initialized, running init-database...');
		const { execSync } = await import('child_process');
		try {
			execSync('tsx scripts/init-database.ts', { stdio: 'inherit' });
			console.log('[SyncModules] Database initialized successfully');
		} catch (error) {
			console.error('[SyncModules] Failed to initialize database:', error);
			throw error;
		}
	} else {
		console.log('[SyncModules] Database already exists, skipping initialization');
	}
}

async function main() {
	console.log('[SyncModules] Starting module synchronization...');

	const modulesDir = path.resolve(process.cwd(), 'modules');

	try {
		// Step 1: Initialize database FIRST
		await initDatabase();

		// Step 2: Now module manager can safely access DB
		console.log('[SyncModules] Initializing module manager...');
		await ModuleManager.init();

		// Step 3: Link all modules with database tracking
		console.log('[SyncModules] Linking module routes with database tracking...');
		const results = await linkAllModules();

		// Step 4: Report summary
		const successful = results.filter((r) => r.success && !r.skipped);
		const failed = results.filter((r) => !r.success && !r.skipped);
		const skipped = results.filter((r) => r.skipped);

		console.log('[SyncModules] Module synchronization complete.');
		console.log(`  - Successfully linked: ${successful.length}`);
		console.log(`  - Failed: ${failed.length}`);
		console.log(`  - Skipped: ${skipped.length}`);

		if (failed.length > 0) {
			console.warn('[SyncModules] Some modules failed to link:');
			failed.forEach((r) => {
				console.warn(`  - ${r.moduleId}: ${r.error?.message}`);
			});
		}

		if (skipped.length > 0) {
			console.log('[SyncModules] Skipped modules:');
			skipped.forEach((r) => {
				console.log(`  - ${r.moduleId}: ${r.skipReason}`);
			});
		}
	} catch (err) {
		console.error('[SyncModules] Failed to synchronize modules:', err);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('[SyncModules] Fatal error:', err);
	process.exit(1);
});
