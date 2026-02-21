#!/usr/bin/env tsx
/**
 * Database Initialization Script
 *
 * Standalone script that handles first-time database initialization.
 * This ensures the database exists before the module manager runs.
 *
 * Features:
 * - Loads .env file
 * - Checks if database file exists
 * - If not exists: runs db:generate, core migrations, and module migrations
 * - If exists: skips (already initialized)
 *
 * Usage:
 *   bun run db:init
 */

import { execSync } from 'child_process';
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync } from 'fs';
import * as path from 'path';
// @ts-ignore - better-sqlite3 doesn't have perfect ESM types
import Database from 'better-sqlite3';

// Load .env file manually to ensure environment variables are available
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

/**
 * Get the database path from environment or default
 */
function getDatabasePath(): string {
	const rawDbPath =
		process.env.DATABASE_URL ||
		(process.env.NODE_ENV === 'production' ? '/data/molos.db' : 'molos.db');
	const dbPath = rawDbPath.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '');
	return path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
}

/**
 * Create a timestamped backup of the database file
 * @returns Path to backup file, or null if no database exists
 */
function backupDatabase(dbPath: string): string | null {
	if (!existsSync(dbPath)) {
		return null;
	}

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

	const backupPath = `${dbPath}.backup-${timestamp}`;

	copyFileSync(dbPath, backupPath);
	console.log(`[DB:init] Database backed up to: ${backupPath}`);

	return backupPath;
}

/**
 * Restore database from a backup file
 */
function restoreDatabase(backupPath: string, dbPath: string): void {
	if (!existsSync(backupPath)) {
		throw new Error(`Backup not found: ${backupPath}`);
	}
	copyFileSync(backupPath, dbPath);
	console.log(`[DB:init] Database restored from: ${backupPath}`);
}

/**
 * Check if database exists and has tables
 */
function isDatabaseInitialized(dbPath: string): boolean {
	if (!existsSync(dbPath)) {
		return false;
	}

	// Check if database file is empty (less than 1KB likely means no tables)
	try {
		const stats = statSync(dbPath);
		return stats.size > 1024;
	} catch {
		return false;
	}
}

/**
 * Generate database migrations using drizzle-kit
 */
function generateMigrations() {
	console.log('[DB:init] Generating database migrations...');
	try {
		execSync('npm run db:generate', { stdio: 'inherit' });
		console.log('[DB:init] Migrations generated successfully');
	} catch (error) {
		console.error('[DB:init] Failed to generate migrations:', error);
		throw error;
	}
}

/**
 * Run core database migrations
 */
function runCoreMigrations() {
	console.log('[DB:init] Applying CORE database migrations...');
	try {
		execSync('tsx packages/database/src/migrate.ts', { stdio: 'inherit' });
		console.log('[DB:init] Core migrations applied successfully');
	} catch (error) {
		console.error('[DB:init] Failed to apply core migrations:', error);
		throw error;
	}
}

/**
 * Run module database migrations
 */
function runModuleMigrations() {
	console.log('[DB:init] Applying MODULE migrations...');
	try {
		execSync('turbo run db:migrate --filter="./modules/*"', { stdio: 'inherit' });
		console.log('[DB:init] Module migrations applied successfully');

		// CRITICAL FIX: Verify and apply missing migrations
		// The drizzle-kit migrate command may skip migrations if their hash exists
		// even if the actual SQL wasn't executed. This fallback ensures tables exist.
		verifyAndApplyMissingMigrations();
	} catch (error) {
		console.error('[DB:init] MODULE MIGRATIONS FAILED - Halting initialization.');
		console.error('[DB:init] Error:', error);
		console.error('[DB:init] Fix the failing migration and run again.');
		process.exit(1);
	}
}

/**
 * Get all module directories that have drizzle migrations
 *
 * This dynamically discovers modules in the modules/ directory,
 * making it future-proof for new modules added later.
 */
function getModuleDirectories(): Array<{ name: string; dir: string; pattern: string }> {
	const modulesPath = path.join(process.cwd(), 'modules');

	// Check if modules directory exists
	if (!existsSync(modulesPath)) {
		console.warn('[DB:init] No modules directory found');
		return [];
	}

	const moduleDirs: Array<{ name: string; dir: string; pattern: string }> = [];

	// Read all directories in modules/
	const entries = readdirSync(modulesPath, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const moduleName = entry.name;
			const drizzlePath = path.join(modulesPath, moduleName, 'drizzle');

			// Check if this module has a drizzle directory with SQL files
			if (existsSync(drizzlePath)) {
				try {
					const migrationFiles = readdirSync(drizzlePath).filter((f) => f.endsWith('.sql'));
					if (migrationFiles.length > 0) {
						moduleDirs.push({
							name: moduleName,
							dir: moduleName,
							pattern: `${moduleName}_%`
						});
					}
				} catch {
					// Skip directories we can't read
				}
			}
		}
	}

	return moduleDirs;
}

/**
 * Verify that expected tables exist for each module
 * and apply SQL directly if they're missing
 *
 * This is a fallback to handle cases where drizzle-kit migrate
 * reports success but doesn't actually execute the SQL.
 */
function verifyAndApplyMissingMigrations() {
	const dbPath = getDatabasePath();
	const db = new Database(dbPath);

	// Dynamically discover all modules with migrations
	const modulesToCheck = getModuleDirectories();

	console.log(`[DB:init] Verifying migrations for ${modulesToCheck.length} module(s)`);

	for (const module of modulesToCheck) {
		try {
			// Check if any tables exist for this module
			const rows = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?")
				.all(module.pattern) as { name: string }[];

			if (rows.length === 0) {
				console.log(`[DB:init] Tables missing for ${module.name}, applying SQL directly...`);
				applyModuleMigrationSql(module.name, module.dir, dbPath);
			} else {
				console.log(`[DB:init] Verified ${rows.length} table(s) for ${module.name}`);
			}
		} catch (error) {
			console.warn(`[DB:init] Error checking tables for ${module.name}:`, error);
		}
	}

	db.close();
}

/**
 * Apply module migration SQL directly to the database
 *
 * This bypasses drizzle-kit and executes the SQL directly
 * using better-sqlite3 to ensure tables are created.
 */
function applyModuleMigrationSql(moduleName: string, moduleDir: string, dbPath: string) {
	const modulePath = path.join(process.cwd(), 'modules', moduleDir);
	const drizzlePath = path.join(modulePath, 'drizzle');

	// Check if drizzle directory exists
	if (!existsSync(drizzlePath)) {
		console.warn(`[DB:init] No drizzle directory found for ${moduleName}`);
		return;
	}

	// Find migration SQL files (starting with 0000_)
	const migrationFiles = readdirSync(drizzlePath)
		.filter((f) => f.endsWith('.sql') && f.startsWith('0000_'))
		.sort();

	if (migrationFiles.length === 0) {
		console.warn(`[DB:init] No migration files found for ${moduleName}`);
		return;
	}

	console.log(`[DB:init] Found ${migrationFiles.length} migration file(s) for ${moduleName}`);

	// Apply each migration file
	for (const migrationFile of migrationFiles) {
		try {
			const sqlPath = path.join(drizzlePath, migrationFile);
			const sql = readFileSync(sqlPath, 'utf-8');

			// Execute SQL directly
			const db = new Database(dbPath);
			db.exec(sql);
			db.close();

			console.log(`[DB:init] Applied migration ${migrationFile} for ${moduleName}`);
		} catch (error: any) {
			// If tables already exist, that's fine - the migration was already applied
			if (error?.code === 'SQLITE_ERROR' && error?.message?.includes('already exists')) {
				console.log(`[DB:init] Migration ${migrationFile} already applied for ${moduleName}`);
			} else {
				console.error(`[DB:init] Failed to apply ${migrationFile} for ${moduleName}:`, error);
			}
		}
	}
}

/**
 * Main initialization function
 */
async function main() {
	console.log('[DB:init] Starting database initialization...');

	// Load environment variables
	loadEnv();

	// Get database path
	const dbPath = getDatabasePath();
	console.log(`[DB:init] Database path: ${dbPath}`);

	// Backup existing database before any operations
	const backupPath = backupDatabase(dbPath);
	if (backupPath) {
		console.log(`[DB:init] Backup created at: ${backupPath}`);
	}

	// Check if already initialized
	if (isDatabaseInitialized(dbPath)) {
		console.log('[DB:init] Database already exists.');
		// Still verify module migrations for new modules that may have been added
		console.log('[DB:init] Checking for missing module migrations...');
		verifyAndApplyMissingMigrations();
		console.log('[DB:init] To re-initialize, delete the database file and run again.');
		return;
	}

	console.log('[DB:init] Database not found or empty. Initializing...');

	try {
		// Step 1: Generate migrations
		generateMigrations();

		// Step 2: Run core migrations
		runCoreMigrations();

		// Step 3: Run module migrations
		runModuleMigrations();

		console.log('[DB:init] Database initialization complete!');
		console.log('[DB:init] You can now run the module manager.');
	} catch (error) {
		console.error('[DB:init] Fatal error during database initialization:', error);
		process.exit(1);
	}
}

main();
