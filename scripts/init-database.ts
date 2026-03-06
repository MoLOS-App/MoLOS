#!/usr/bin/env tsx
/**
 * Database Initialization Script
 *
 * Development-focused script that:
 * 1. Creates database backup (if exists)
 * 2. Delegates to unified migration runner
 * 3. Provides dev-friendly output
 *
 * For production, use: bun run db:migrate
 *
 * Usage:
 *   bun run db:init
 */

import { copyFileSync, existsSync, readFileSync, statSync } from 'fs';
import * as path from 'path';
import {
	runAllMigrations,
	type MigrationResult
} from '../packages/database/src/migrate-unified.js';

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

function getDatabasePath(): string {
	const rawDbPath =
		process.env.DATABASE_URL ||
		(process.env.NODE_ENV === 'production' ? '/data/molos.db' : './data/molos.db');
	const dbPath = rawDbPath.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '');
	return path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
}

function backupDatabase(dbPath: string): string | null {
	if (!existsSync(dbPath)) {
		return null;
	}

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const backupPath = `${dbPath}.backup-${timestamp}`;

	try {
		copyFileSync(dbPath, backupPath);
		console.log(`[DB:init] Database backed up to: ${backupPath}`);
		return backupPath;
	} catch (error) {
		console.warn(`[DB:init] Failed to backup database: ${error}`);
		return null;
	}
}

function isDatabaseInitialized(dbPath: string): boolean {
	if (!existsSync(dbPath)) {
		return false;
	}

	try {
		const stats = statSync(dbPath);
		return stats.size > 1024;
	} catch {
		return false;
	}
}

function printResult(result: MigrationResult): void {
	console.log('');
	console.log('=== Database Initialization Summary ===');
	console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
	console.log(`Database created: ${result.databaseCreated ? 'Yes' : 'No'}`);
	console.log(`Tables created: ${result.tablesCreated}`);
	console.log('');
	console.log('Migrations:');
	console.log(
		`  Core: ${result.core.applied} applied, ${result.core.failed} failed, ${result.core.skipped} skipped`
	);

	const moduleEntries = Object.entries(result.modules);
	if (moduleEntries.length > 0) {
		console.log('  Modules:');
		for (const [name, stats] of moduleEntries) {
			console.log(
				`    ${name}: ${stats.applied} applied, ${stats.failed} failed, ${stats.skipped} skipped`
			);
		}
	} else {
		console.log('  Modules: (none with migrations)');
	}

	if (result.errors.length > 0) {
		console.log('');
		console.log('Errors:');
		for (const error of result.errors) {
			console.log(`  - ${error}`);
		}
	}
	console.log('');
}

async function main() {
	console.log('[DB:init] Starting database initialization...');

	loadEnv();

	const dbPath = getDatabasePath();
	console.log(`[DB:init] Database path: ${dbPath}`);

	// Create backup if database exists
	const backupPath = backupDatabase(dbPath);
	if (backupPath) {
		console.log(`[DB:init] Backup created at: ${backupPath}`);
	}

	// Check if already initialized
	if (isDatabaseInitialized(dbPath)) {
		console.log(
			'[DB:init] Database already exists, running migrations to ensure schema is up-to-date...'
		);
	} else {
		console.log('[DB:init] Database not found or empty. Initializing...');
	}

	// Run unified migrations
	try {
		const result = await runAllMigrations(dbPath);
		printResult(result);

		if (result.success) {
			console.log('[DB:init] Database initialization complete!');
			console.log('[DB:init] You can now run the development server with: npm run dev');
		} else {
			console.error('[DB:init] Database initialization failed. Check errors above.');
			process.exit(1);
		}
	} catch (error) {
		console.error('[DB:init] Fatal error during database initialization:', error);
		process.exit(1);
	}
}

main();
