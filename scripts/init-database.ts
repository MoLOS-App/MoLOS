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
		(process.env.NODE_ENV === 'production' ? '/data/molos.db' : './data/molos.db');
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

		// CRITICAL FIX: Run unified migration runner to ensure all migrations are applied
		// The drizzle-kit migrate command may skip migrations if their hash exists
		// even if the actual SQL wasn't executed. This fallback ensures tables exist.
		console.log('[DB:init] Running unified migration runner to verify all migrations...');
		execSync('tsx packages/database/src/migrate-unified.ts', { stdio: 'inherit' });
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

	// Find all migration SQL files
	const migrationFiles = readdirSync(drizzlePath)
		.filter((f) => f.endsWith('.sql'))
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
 * Verify that core database migrations have been applied
 *
 * Similar to verifyAndApplyMissingMigrations() but for core schema.
 * This ensures tables like settings_external_modules have the correct schema.
 */
function verifyAndApplyMissingCoreMigrations() {
	const dbPath = getDatabasePath();
	const db = new Database(dbPath);

	try {
		// Check if __drizzle_migrations table exists
		const migrationTableExists = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
			.get('__drizzle_migrations');

		if (!migrationTableExists) {
			console.log('[DB:init] Core migrations not applied, running core migrations...');
			db.close();
			runCoreMigrations();
			return;
		}

		// Get migration count
		const result = db.prepare('SELECT COUNT(*) as count FROM __drizzle_migrations').get() as {
			count: number;
		};

		// Get expected migration count from meta files
		const metaDir = path.join(process.cwd(), 'packages', 'database', 'drizzle', 'meta');
		let expectedMigrations = 0;
		try {
			if (existsSync(metaDir)) {
				const metaFiles = readdirSync(metaDir);
				expectedMigrations = metaFiles.length;
			}
		} catch {
			// Use fallback count
			expectedMigrations = 16;
		}

		const currentMigrations = result?.count || 0;

		// Verify specific columns exist (sanity check)
		const columns = db.prepare('PRAGMA table_info(settings_external_modules)').all() as Array<{
			name: string;
		}>;

		const columnNames = new Set(columns.map((c) => c.name));

		const hasSchema =
			columnNames.has('git_ref') &&
			columnNames.has('block_updates') &&
			columnNames.has('retry_count') &&
			columnNames.has('last_retry_at');

		if (currentMigrations < expectedMigrations) {
			if (hasSchema) {
				// Schema is correct but tracking is incomplete
				// Don't re-run migrations (they would fail with "already exists")
				console.log(
					`[DB:init] Core schema verified but tracking incomplete (${currentMigrations}/${expectedMigrations}). Skipping re-run.`
				);
			} else {
				// Schema is missing, need to run migrations
				console.log(
					`[DB:init] Core schema incomplete (columns: git_ref=${columnNames.has('git_ref')}, block_updates=${columnNames.has('block_updates')}), applying migrations...`
				);
				db.close();
				runCoreMigrations();
				return;
			}
		}

		console.log(`[DB:init] Verified ${currentMigrations} core migration(s)`);
	} catch (error) {
		console.warn('[DB:init] Error checking core migrations:', error);
		// On error, try to run migrations to ensure consistency
		db.close();
		runCoreMigrations();
	} finally {
		try {
			db.close();
		} catch {
			// Already closed
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
		// Verify core migrations (handles schema updates like adding git_ref column)
		console.log('[DB:init] Checking for missing core migrations...');
		verifyAndApplyMissingCoreMigrations();
		// Run unified migration runner to ensure all module migrations are applied
		console.log('[DB:init] Running unified migration runner to verify all migrations...');
		try {
			execSync('tsx packages/database/src/migrate-unified.ts', { stdio: 'inherit' });
		} catch (error) {
			console.warn('[DB:init] Unified migration runner had issues:', error);
		}
		console.log('[DB:init] To re-initialize, delete the database file and run again.');
		return;
	}

	console.log('[DB:init] Database not found or empty. Initializing...');

	try {
		// Step 1: Run core migrations
		// Note: Migration generation (db:generate) is a development task for
		// creating new migrations when schema changes. It is NOT part of
		// database initialization, which should only apply existing migrations.
		// See documentation/getting-started/ for more details.
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
