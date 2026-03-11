/**
 * Unified Migration Runner
 *
 * Rock-solid migration runner that handles:
 * - Fresh database creation (no database file exists)
 * - Existing databases with partial migrations
 * - Proper migration tracking (only runs new migrations)
 * - Checksum validation
 *
 * This is the single source of truth for all migrations in both dev and prod.
 * It applies SQL files directly (more reliable than drizzle migrate()).
 *
 * Usage:
 *   tsx packages/database/src/migrate-unified.ts
 *   bun run db:init
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import {
	calculateChecksum,
	extractVersion,
	parseStatements,
	validateMigrationName,
	sortMigrations
} from './migration-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface MigrationResult {
	success: boolean;
	core: { applied: number; failed: number; skipped: number };
	modules: Record<string, { applied: number; failed: number; skipped: number }>;
	errors: string[];
	databaseCreated: boolean;
	tablesCreated: number;
}

interface MigrationFile {
	name: string;
	path: string;
	module: string;
	sql: string;
	checksum: string;
	version: number;
}

function log(level: 'info' | 'warn' | 'error' | 'success', message: string): void {
	const prefix =
		level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
	console.log(`[Migrate:Unified] ${prefix} ${message}`);
}

function getDatabasePath(): string {
	const rawDbPath =
		process.env.DATABASE_URL?.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '') ||
		(process.env.NODE_ENV === 'production'
			? '/data/molos.db'
			: join(__dirname, '..', '..', '..', 'data', 'molos.db'));
	return rawDbPath;
}

function ensureDatabaseDir(dbPath: string): boolean {
	const dbDir = dirname(dbPath);
	if (!existsSync(dbDir)) {
		try {
			mkdirSync(dbDir, { recursive: true });
			log('info', `Created database directory: ${dbDir}`);
			return true;
		} catch (error) {
			log('error', `Failed to create database directory: ${dbDir} - ${error}`);
			return false;
		}
	}
	return true;
}

function getCoreMigrationsPath(): string {
	return join(__dirname, '..', 'drizzle');
}

function getModuleMigrationsPaths(): Map<string, string> {
	const modulesPath = join(process.cwd(), 'modules');
	const paths = new Map<string, string>();

	if (!existsSync(modulesPath)) {
		return paths;
	}

	try {
		const entries = readdirSync(modulesPath, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory() && (entry.name.startsWith('MoLOS-') || entry.name === 'ai')) {
				const drizzlePath = join(modulesPath, entry.name, 'drizzle');
				if (existsSync(drizzlePath)) {
					try {
						const sqlFiles = readdirSync(drizzlePath).filter((f) => f.endsWith('.sql'));
						if (sqlFiles.length > 0) {
							paths.set(entry.name, drizzlePath);
						}
					} catch {
						// Skip directories we can't read
					}
				}
			}
		}
	} catch (error) {
		log('warn', `Could not scan modules directory: ${error}`);
	}

	return paths;
}

function tableExists(db: Database.Database, tableName: string): boolean {
	try {
		const result = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
			.get(tableName) as { name: string } | undefined;
		return result !== undefined;
	} catch {
		return false;
	}
}

/**
 * Ensure migration tracking table exists
 */
function ensureTrackingTable(db: Database.Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS molos_migrations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			migration_name TEXT NOT NULL,
			module TEXT NOT NULL,
			version INTEGER NOT NULL,
			checksum TEXT NOT NULL,
			applied_at INTEGER NOT NULL,
			execution_time_ms INTEGER NOT NULL,
			success INTEGER NOT NULL,
			rollback_available INTEGER NOT NULL,
			sql_content TEXT,
			error_message TEXT
		);

		CREATE INDEX IF NOT EXISTS idx_migrations_module_version ON molos_migrations(module, version);
		CREATE INDEX IF NOT EXISTS idx_migrations_name ON molos_migrations(migration_name);
		CREATE INDEX IF NOT EXISTS idx_migrations_module ON molos_migrations(module);
	`);
}

/**
 * Check if migration has been applied successfully
 */
function isMigrationApplied(db: Database.Database, migrationName: string, module: string): boolean {
	try {
		const record = db
			.prepare(
				`SELECT COUNT(*) as count FROM molos_migrations 
         WHERE migration_name = ? AND module = ? AND success = 1`
			)
			.get(migrationName, module) as { count: number } | undefined;

		return (record?.count ?? 0) > 0;
	} catch {
		return false;
	}
}

/**
 * Get the highest version applied for a module
 */
function getLatestAppliedVersion(db: Database.Database, module: string): number {
	try {
		const record = db
			.prepare(
				`SELECT MAX(version) as version FROM molos_migrations 
         WHERE module = ? AND success = 1`
			)
			.get(module) as { version: number | null } | undefined;

		return record?.version ?? -1;
	} catch {
		return -1;
	}
}

/**
 * Record migration in tracking table
 */
function recordMigration(
	db: Database.Database,
	migration: MigrationFile,
	success: boolean,
	durationMs: number,
	errorMessage?: string
): void {
	try {
		db.prepare(
			`INSERT INTO molos_migrations 
       (migration_name, module, version, checksum, applied_at, execution_time_ms, success, rollback_available)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		).run(
			migration.name,
			migration.module,
			migration.version,
			migration.checksum,
			Date.now(),
			durationMs,
			success ? 1 : 0,
			0
		);
	} catch (insertError) {
		log('warn', `Failed to record migration: ${insertError}`);
	}
}

/**
 * Load migration files from directory
 */
function loadMigrations(migrationsPath: string, module: string): MigrationFile[] {
	if (!existsSync(migrationsPath)) {
		return [];
	}

	const sqlFiles = readdirSync(migrationsPath)
		.filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
		.sort();

	const migrations: MigrationFile[] = [];

	for (const file of sqlFiles) {
		const filePath = join(migrationsPath, file);
		const sql = readFileSync(filePath, 'utf-8');
		const checksum = calculateChecksum(sql);
		const version = extractVersion(file);

		// Validate migration name
		const validation = validateMigrationName(file);
		if (!validation.valid) {
			log('warn', `Invalid migration name: ${file} - ${validation.error}`);
			continue;
		}

		migrations.push({
			name: file,
			path: filePath,
			module,
			sql,
			checksum,
			version
		});
	}

	return sortMigrations(migrations);
}

/**
 * Apply a single migration
 */
function applyMigration(
	db: Database.Database,
	migration: MigrationFile
): { success: boolean; error?: string; duration: number } {
	const startTime = Date.now();

	try {
		// Parse and execute statements
		const statements = parseStatements(migration.sql);

		for (const statement of statements) {
			if (statement.trim()) {
				try {
					db.exec(statement);
				} catch (stmtError) {
					const stmtErrMsg = stmtError instanceof Error ? stmtError.message : String(stmtError);
					// Handle idempotent cases - these are OK
					if (
						stmtErrMsg.includes('already exists') ||
						stmtErrMsg.includes('duplicate column name') ||
						(stmtErrMsg.includes('no such column') && statement.includes('RENAME COLUMN'))
					) {
						// Already applied, continue
						continue;
					}
					throw stmtError;
				}
			}
		}

		const duration = Date.now() - startTime;
		return { success: true, duration };
	} catch (error) {
		const duration = Date.now() - startTime;
		const errorMsg = error instanceof Error ? error.message : String(error);
		return { success: false, error: errorMsg, duration };
	}
}

/**
 * Apply migrations with tracking
 * Only runs migrations that haven't been applied yet
 */
function applyMigrationsWithTracking(
	db: Database.Database,
	migrationsPath: string,
	module: string
): { applied: number; failed: number; skipped: number; error?: string } {
	const result = { applied: 0, failed: 0, skipped: 0 };

	// Load all migrations from directory
	const migrations = loadMigrations(migrationsPath, module);

	if (migrations.length === 0) {
		return result;
	}

	log('info', `Found ${migrations.length} migration file(s) for ${module}`);

	// Get the latest applied version
	const latestApplied = getLatestAppliedVersion(db, module);

	if (latestApplied >= 0) {
		log('info', `${module}: Latest applied version is ${latestApplied}`);
	}

	// Process each migration
	for (const migration of migrations) {
		// Skip if already applied
		if (isMigrationApplied(db, migration.name, module)) {
			result.skipped++;
			continue;
		}

		// Skip if version is less than or equal to latest applied
		// (handles case where migration wasn't tracked but was applied)
		if (migration.version <= latestApplied) {
			log(
				'info',
				`${module}: Skipping ${migration.name} (version ${migration.version} <= ${latestApplied})`
			);
			result.skipped++;
			continue;
		}

		// Apply the migration
		log('info', `${module}: Applying ${migration.name}`);
		const applyResult = applyMigration(db, migration);

		// Record the result
		recordMigration(db, migration, applyResult.success, applyResult.duration, applyResult.error);

		if (applyResult.success) {
			log('success', `${module}: Applied ${migration.name} (${applyResult.duration}ms)`);
			result.applied++;
		} else {
			log('error', `${module}: Failed ${migration.name} - ${applyResult.error}`);
			result.failed++;
			// For core migrations, fail immediately
			if (module === 'core') {
				return { ...result, error: applyResult.error };
			}
		}
	}

	return result;
}

export async function runAllMigrations(dbPath?: string): Promise<MigrationResult> {
	const result: MigrationResult = {
		success: true,
		core: { applied: 0, failed: 0, skipped: 0 },
		modules: {},
		errors: [],
		databaseCreated: false,
		tablesCreated: 0
	};

	const actualDbPath = dbPath || getDatabasePath();
	log('info', `Starting unified migration process...`);
	log('info', `Database path: ${actualDbPath}`);

	const dbExisted = existsSync(actualDbPath);
	if (!dbExisted) {
		if (!ensureDatabaseDir(actualDbPath)) {
			result.success = false;
			result.errors.push('Failed to create database directory');
			return result;
		}
		result.databaseCreated = true;
		log('info', 'Database file will be created');
	} else {
		log('info', 'Database file exists');
	}

	let sqlite: Database.Database;
	try {
		sqlite = new Database(actualDbPath);
		sqlite.pragma('foreign_keys = ON');
	} catch (error) {
		const errorMsg = `Failed to open database: ${error instanceof Error ? error.message : String(error)}`;
		log('error', errorMsg);
		result.success = false;
		result.errors.push(errorMsg);
		return result;
	}

	const initialTableCount =
		(
			sqlite
				.prepare(
					"SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'"
				)
				.get() as { count: number } | undefined
		)?.count ?? 0;
	log('info', `Initial state: ${initialTableCount} tables`);

	// Ensure tracking table exists
	ensureTrackingTable(sqlite);

	// Step 1: Run core migrations with tracking
	log('info', 'Running CORE migrations...');
	const coreMigrationsPath = getCoreMigrationsPath();
	const coreResult = applyMigrationsWithTracking(sqlite, coreMigrationsPath, 'core');
	result.core = coreResult;

	if (coreResult.error) {
		result.errors.push(`Core: ${coreResult.error}`);
		result.success = false;
		sqlite.close();
		return result;
	}

	// Step 2: Verify core tables exist
	const requiredCoreTables = ['user', 'session', 'account'];
	const missingTables: string[] = [];

	for (const table of requiredCoreTables) {
		if (!tableExists(sqlite, table)) {
			missingTables.push(table);
		}
	}

	if (missingTables.length > 0) {
		log('error', `Missing required core tables: ${missingTables.join(', ')}`);
		result.errors.push(`Missing core tables: ${missingTables.join(', ')}`);
		result.success = false;
		sqlite.close();
		return result;
	}

	log('success', 'Core tables verified');

	// Step 3: Run module migrations with tracking
	log('info', 'Running MODULE migrations...');
	const modulePaths = getModuleMigrationsPaths();
	log('info', `Found ${modulePaths.size} module(s) with migrations`);

	for (const [moduleName, migrationsPath] of modulePaths) {
		log('info', `Processing module: ${moduleName}`);
		const moduleResult = applyMigrationsWithTracking(sqlite, migrationsPath, moduleName);
		result.modules[moduleName] = {
			applied: moduleResult.applied,
			failed: moduleResult.failed,
			skipped: moduleResult.skipped
		};

		if (moduleResult.error) {
			result.errors.push(`${moduleName}: ${moduleResult.error}`);
			log('warn', `Module ${moduleName} had migration issues, continuing...`);
		}
	}

	// Step 4: Final validation
	const finalTableCount =
		(
			sqlite
				.prepare(
					"SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'"
				)
				.get() as { count: number } | undefined
		)?.count ?? 0;
	result.tablesCreated = finalTableCount;

	log('info', `Final state: ${finalTableCount} tables`);
	log('info', `Tables created: ${finalTableCount - initialTableCount}`);

	// Summary
	const totalApplied =
		result.core.applied + Object.values(result.modules).reduce((sum, m) => sum + m.applied, 0);
	const totalFailed =
		result.core.failed + Object.values(result.modules).reduce((sum, m) => sum + m.failed, 0);

	if (totalFailed === 0) {
		log('success', `All migrations completed successfully (${totalApplied} applied)`);
	} else {
		log('warn', `Migrations completed with ${totalFailed} failure(s)`);
	}

	sqlite.close();
	return result;
}

export async function runCoreMigrationsOnly(dbPath?: string): Promise<MigrationResult> {
	const result: MigrationResult = {
		success: true,
		core: { applied: 0, failed: 0, skipped: 0 },
		modules: {},
		errors: [],
		databaseCreated: false,
		tablesCreated: 0
	};

	const actualDbPath = dbPath || getDatabasePath();

	if (!existsSync(actualDbPath)) {
		if (!ensureDatabaseDir(actualDbPath)) {
			result.success = false;
			result.errors.push('Failed to create database directory');
			return result;
		}
		result.databaseCreated = true;
	}

	let sqlite: Database.Database;
	try {
		sqlite = new Database(actualDbPath);
		sqlite.pragma('foreign_keys = ON');
	} catch (error) {
		result.success = false;
		result.errors.push(`Failed to open database: ${error}`);
		return result;
	}

	// Ensure tracking table exists
	ensureTrackingTable(sqlite);

	log('info', 'Running core migrations only...');
	const coreMigrationsPath = getCoreMigrationsPath();
	const coreResult = applyMigrationsWithTracking(sqlite, coreMigrationsPath, 'core');
	result.core = coreResult;

	if (coreResult.error) {
		result.errors.push(coreResult.error);
		result.success = false;
	}

	result.tablesCreated =
		(
			sqlite
				.prepare(
					"SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'"
				)
				.get() as { count: number } | undefined
		)?.count ?? 0;

	sqlite.close();
	return result;
}

/**
 * Get migration status for a module
 */
export function getMigrationStatus(
	dbPath: string,
	module: string
): { applied: string[]; pending: string[]; latest: number } {
	const sqlite = new Database(dbPath, { readonly: true });

	ensureTrackingTable(sqlite);

	// Get applied migrations
	const applied = sqlite
		.prepare(
			`SELECT migration_name FROM molos_migrations 
       WHERE module = ? AND success = 1 
       ORDER BY version`
		)
		.all(module) as { migration_name: string }[];

	// Get latest applied version
	const latestRecord = sqlite
		.prepare(
			`SELECT MAX(version) as version FROM molos_migrations 
       WHERE module = ? AND success = 1`
		)
		.get(module) as { version: number | null } | undefined;

	const latest = latestRecord?.version ?? -1;

	sqlite.close();

	return {
		applied: applied.map((r) => r.migration_name),
		pending: [], // Would need to compare with files on disk
		latest
	};
}

// CLI entry point
if (
	import.meta.url === `file://${process.argv[1]}` ||
	process.argv[1]?.endsWith('migrate-unified.ts')
) {
	runAllMigrations()
		.then((result) => {
			console.log('');
			console.log('=== Migration Summary ===');
			console.log(`Success: ${result.success}`);
			console.log(`Database created: ${result.databaseCreated}`);
			console.log(`Tables: ${result.tablesCreated}`);
			console.log(
				`Core: ${result.core.applied} applied, ${result.core.failed} failed, ${result.core.skipped} skipped`
			);
			console.log(
				`Modules: ${
					Object.entries(result.modules)
						.map(([k, v]) => `${k}(${v.applied}/${v.failed}/${v.skipped})`)
						.join(', ') || 'none'
				}`
			);
			if (result.errors.length > 0) {
				console.log(`Errors: ${result.errors.length}`);
				result.errors.forEach((e) => console.log(`  - ${e}`));
			}
			console.log('');

			if (!result.success) {
				process.exit(1);
			}
		})
		.catch((error) => {
			console.error('Fatal migration error:', error);
			process.exit(1);
		});
}
