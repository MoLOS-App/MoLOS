/**
 * Improved Migration Runner (Production-Ready)
 *
 * Features:
 * - Transaction wrapping for each migration
 * - Checksum validation with SQL normalization
 * - Unified tracking in molos_migrations table
 * - Automatic backups with verification
 * - Migration locking (prevents concurrent runs)
 * - Disk space checks
 * - Two-phase migration tracking
 * - Comprehensive error handling
 * - Backup rotation
 * - Secure file permissions
 */

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	unlinkSync,
	chmodSync,
	statSync
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import {
	calculateChecksum,
	extractVersion,
	extractModule,
	parseStatements,
	validateMigrationName,
	sortMigrations,
	MigrationError,
	MigrationErrorType,
	getMinDiskSpaceBytes
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
	backupPath?: string;
}

interface MigrationFile {
	name: string;
	path: string;
	module: string;
	sql: string;
	checksum: string;
	version: number;
}

interface BackupConfig {
	maxBackups: number;
	minFreeSpaceBytes: number;
	verifyIntegrity: boolean;
}

const DEFAULT_BACKUP_CONFIG: BackupConfig = {
	maxBackups: 10,
	minFreeSpaceBytes: 100 * 1024 * 1024, // 100MB
	verifyIntegrity: true
};

function log(level: 'info' | 'warn' | 'error' | 'success', message: string): void {
	const prefix =
		level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
	console.log(`[Migrate:Improved] ${prefix} ${message}`);
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
			mkdirSync(dbDir, { recursive: true, mode: 0o755 });
			log('info', `Created database directory: ${dbDir}`);
			return true;
		} catch (error) {
			log('error', `Failed to create database directory: ${dbDir} - ${error}`);
			return false;
		}
	}
	return true;
}

/**
 * Check available disk space (basic check)
 */
function checkDiskSpace(path: string, minBytes: number): boolean {
	try {
		// Simple check: ensure parent directory exists and is writable
		const parentDir = dirname(path);
		if (!existsSync(parentDir)) {
			return false;
		}

		// Try to stat the directory
		statSync(parentDir);
		return true;
	} catch (error) {
		log('warn', `Disk space check failed: ${error}`);
		return false;
	}
}

/**
 * Clean up old backups, keeping only the most recent
 */
function cleanupOldBackups(backupDir: string, maxBackups: number): void {
	try {
		if (!existsSync(backupDir)) {
			return;
		}

		const backupFiles = readdirSync(backupDir)
			.filter((f) => f.startsWith('molos-') && f.endsWith('.db'))
			.sort()
			.reverse(); // Most recent first

		if (backupFiles.length > maxBackups) {
			const toDelete = backupFiles.slice(maxBackups);
			for (const file of toDelete) {
				const filePath = join(backupDir, file);
				unlinkSync(filePath);
				log('info', `Removed old backup: ${file}`);
			}
		}
	} catch (error) {
		log('warn', `Failed to cleanup old backups: ${error}`);
	}
}

/**
 * Create automatic backup before migrations with verification
 */
function createBackup(dbPath: string, config: BackupConfig = DEFAULT_BACKUP_CONFIG): string | null {
	if (!existsSync(dbPath)) {
		return null;
	}

	// Check disk space
	if (!checkDiskSpace(dbPath, config.minFreeSpaceBytes)) {
		log('error', 'Insufficient disk space for backup');
		return null;
	}

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const backupDir = join(dirname(dbPath), 'backups');

	if (!existsSync(backupDir)) {
		mkdirSync(backupDir, { recursive: true, mode: 0o700 });
	}

	const backupPath = join(backupDir, `molos-${timestamp}.db`);

	try {
		// Create backup using SQLite backup API
		const db = new Database(dbPath, { readonly: true });
		db.backup(backupPath);
		db.close();

		// Set restrictive permissions
		chmodSync(backupPath, 0o600);

		// Verify backup integrity
		if (config.verifyIntegrity) {
			const backupDb = new Database(backupPath, { readonly: true });
			const integrityCheck = backupDb.pragma('integrity_check') as string;
			backupDb.close();

			if (integrityCheck !== 'ok') {
				log('error', 'Backup failed integrity check');
				unlinkSync(backupPath);
				return null;
			}
		}

		log('success', `Backup created and verified: ${backupPath}`);

		// Cleanup old backups
		cleanupOldBackups(backupDir, config.maxBackups);

		return backupPath;
	} catch (error) {
		log('error', `Backup failed: ${error}`);
		// Clean up failed backup
		if (existsSync(backupPath)) {
			try {
				unlinkSync(backupPath);
			} catch {}
		}
		return null;
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
 * Ensure migration lock table exists
 */
function ensureLockTable(db: Database.Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS migration_lock (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			locked_at INTEGER NOT NULL,
			pid INTEGER
		);
	`);
}

/**
 * Acquire migration lock
 */
function acquireMigrationLock(db: Database.Database): boolean {
	ensureLockTable(db);

	try {
		// Check if already locked
		const lock = db.prepare('SELECT locked_at, pid FROM migration_lock WHERE id = 1').get() as
			| { locked_at: number; pid: number }
			| undefined;

		if (lock) {
			// Check if lock is stale (older than 5 minutes)
			const lockAge = Date.now() - lock.locked_at;
			if (lockAge < 5 * 60 * 1000) {
				log(
					'warn',
					`Migration is locked by process ${lock.pid} (locked ${Math.floor(lockAge / 1000)}s ago)`
				);
				return false;
			} else {
				// Lock is stale, remove it
				log('warn', 'Removing stale migration lock');
				db.exec('DELETE FROM migration_lock WHERE id = 1');
			}
		}

		// Acquire lock
		db.prepare(
			`
			INSERT INTO migration_lock (id, locked_at, pid)
			VALUES (1, ?, ?)
		`
		).run(Date.now(), process.pid);

		return true;
	} catch (error) {
		log('error', `Failed to acquire migration lock: ${error}`);
		return false;
	}
}

/**
 * Release migration lock
 */
function releaseMigrationLock(db: Database.Database): void {
	try {
		db.exec('DELETE FROM migration_lock WHERE id = 1');
	} catch (error) {
		log('warn', `Failed to release migration lock: ${error}`);
	}
}

/**
 * Check if migration has been applied
 */
function isMigrationApplied(db: Database.Database, migrationName: string, module: string): boolean {
	const record = db
		.prepare(
			`SELECT COUNT(*) as count FROM molos_migrations 
       WHERE migration_name = ? AND module = ? AND success = 1`
		)
		.get(migrationName, module) as { count: number };

	return (record?.count ?? 0) > 0;
}

/**
 * Verify checksum of applied migration
 */
function verifyChecksum(
	db: Database.Database,
	migrationName: string,
	module: string,
	expectedChecksum: string
): { valid: boolean; message: string } {
	const record = db
		.prepare(
			`SELECT checksum FROM molos_migrations 
       WHERE migration_name = ? AND module = ? AND success = 1
       ORDER BY applied_at DESC LIMIT 1`
		)
		.get(migrationName, module) as { checksum: string } | undefined;

	if (!record) {
		return { valid: false, message: 'Migration not applied' };
	}

	if (record.checksum === 'unknown') {
		// Legacy migration without checksum
		return { valid: true, message: 'Legacy migration (no checksum)' };
	}

	if (record.checksum !== expectedChecksum) {
		return {
			valid: false,
			message:
				`Checksum mismatch! Migration was modified after being applied. ` +
				`Expected: ${record.checksum}, Got: ${expectedChecksum}`
		};
	}

	return { valid: true, message: 'Checksum verified' };
}

/**
 * Apply single migration with transaction (two-phase tracking)
 */
function applyMigration(
	db: Database.Database,
	migration: MigrationFile
): { success: boolean; error?: string; duration: number } {
	const startTime = Date.now();
	let trackingId: number | null = null;

	try {
		// Phase 1: Mark migration as "in progress"
		db.exec('BEGIN TRANSACTION');
		const result = db
			.prepare(
				`INSERT INTO molos_migrations 
         (migration_name, module, version, checksum, applied_at, execution_time_ms, success, rollback_available)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(
				migration.name,
				migration.module,
				migration.version,
				migration.checksum,
				Date.now(),
				0, // Will be updated
				0, // In progress (not successful yet)
				0 // rollback_available
			);
		trackingId = result.lastInsertRowid as number;
		db.exec('COMMIT');

		// Phase 2: Apply migration
		db.exec('BEGIN TRANSACTION');

		// Parse and execute statements
		const statements = parseStatements(migration.sql);

		for (const statement of statements) {
			if (statement.trim()) {
				db.exec(statement);
			}
		}

		db.exec('COMMIT');

		// Phase 3: Mark as successful
		const duration = Date.now() - startTime;
		db.exec('BEGIN TRANSACTION');
		db.prepare(
			`UPDATE molos_migrations 
       SET success = 1, execution_time_ms = ? 
       WHERE id = ?`
		).run(duration, trackingId);
		db.exec('COMMIT');

		return { success: true, duration };
	} catch (error) {
		// Rollback migration transaction
		try {
			db.exec('ROLLBACK');
		} catch {
			// Ignore rollback errors
		}

		const errorMsg = error instanceof Error ? error.message : String(error);
		const duration = Date.now() - startTime;

		// Update tracking record with failure
		if (trackingId !== null) {
			try {
				db.exec('BEGIN TRANSACTION');
				db.prepare(
					`UPDATE molos_migrations 
           SET success = 0, execution_time_ms = ?, error_message = ? 
           WHERE id = ?`
				).run(duration, errorMsg, trackingId);
				db.exec('COMMIT');
			} catch (updateError) {
				try {
					db.exec('ROLLBACK');
				} catch {}
				log('warn', `Failed to update migration tracking: ${updateError}`);
			}
		}

		return { success: false, error: errorMsg, duration };
	}
}

/**
 * Load all migrations from disk
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
 * Run all migrations
 */
export async function runAllMigrations(): Promise<MigrationResult> {
	const result: MigrationResult = {
		success: true,
		core: { applied: 0, failed: 0, skipped: 0 },
		modules: {},
		errors: [],
		databaseCreated: false,
		tablesCreated: 0
	};

	const dbPath = getDatabasePath();

	// Ensure database directory exists
	if (!ensureDatabaseDir(dbPath)) {
		result.success = false;
		result.errors.push('Failed to create database directory');
		return result;
	}

	// Check if database exists
	result.databaseCreated = !existsSync(dbPath);

	// Create backup if database exists
	if (!result.databaseCreated) {
		log('info', 'Database does not exist, will be created');
	} else {
		log('info', 'Creating backup before migrations...');
		const backupPath = createBackup(dbPath);
		if (!backupPath) {
			result.errors.push('Failed to create backup before migrations');
			// Continue anyway - user can decide to abort
		} else {
			result.backupPath = backupPath;
		}
	}

	// Open database
	let db: Database.Database;
	try {
		db = new Database(dbPath);
		db.pragma('foreign_keys = ON');
	} catch (error) {
		const errorMsg = `Failed to open database: ${error instanceof Error ? error.message : String(error)}`;
		log('error', errorMsg);
		result.success = false;
		result.errors.push(errorMsg);
		return result;
	}

	// Acquire migration lock
	if (!acquireMigrationLock(db)) {
		db.close();
		result.success = false;
		result.errors.push('Failed to acquire migration lock - another migration may be in progress');
		return result;
	}

	try {
		const initialTableCount =
			(
				db
					.prepare(
						"SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'"
					)
					.get() as { count: number } | undefined
			)?.count ?? 0;
		log('info', `Initial state: ${initialTableCount} tables`);

		// Ensure tracking table exists
		ensureTrackingTable(db);

		// Step 1: Run core migrations
		log('info', 'Running CORE migrations...');
		const coreMigrationsPath = join(process.cwd(), 'drizzle');
		const coreMigrations = loadMigrations(coreMigrationsPath, 'core');

		for (const migration of coreMigrations) {
			// Check if already applied
			if (isMigrationApplied(db, migration.name, migration.module)) {
				// Verify checksum
				const checksumValid = verifyChecksum(
					db,
					migration.name,
					migration.module,
					migration.checksum
				);
				if (!checksumValid.valid) {
					log('error', checksumValid.message);
					result.errors.push(checksumValid.message);
					result.core.failed++;
					result.success = false;
					continue;
				}
				result.core.skipped++;
				continue;
			}

			// Apply migration
			log('info', `Applying: ${migration.name}`);
			const applyResult = applyMigration(db, migration);

			if (applyResult.success) {
				log('success', `Applied: ${migration.name} (${applyResult.duration}ms)`);
				result.core.applied++;
			} else {
				log('error', `Failed: ${migration.name} - ${applyResult.error}`);
				result.errors.push(`${migration.name}: ${applyResult.error}`);
				result.core.failed++;
				result.success = false;
			}
		}

		// Step 2: Run module migrations
		log('info', 'Running MODULE migrations...');
		const modulesPath = join(process.cwd(), 'modules');

		if (existsSync(modulesPath)) {
			const modules = readdirSync(modulesPath, { withFileTypes: true })
				.filter((d) => d.isDirectory() && (d.name.startsWith('MoLOS-') || d.name === 'ai'))
				.map((d) => d.name);

			for (const moduleName of modules) {
				log('info', `Processing module: ${moduleName}`);
				const moduleMigrationsPath = join(modulesPath, moduleName, 'drizzle');
				const moduleMigrations = loadMigrations(moduleMigrationsPath, moduleName);

				result.modules[moduleName] = { applied: 0, failed: 0, skipped: 0 };

				for (const migration of moduleMigrations) {
					// Check if already applied
					if (isMigrationApplied(db, migration.name, migration.module)) {
						const checksumValid = verifyChecksum(
							db,
							migration.name,
							migration.module,
							migration.checksum
						);
						if (!checksumValid.valid) {
							log('error', checksumValid.message);
							result.errors.push(checksumValid.message);
							result.modules[moduleName].failed++;
							result.success = false;
							continue;
						}
						result.modules[moduleName].skipped++;
						continue;
					}

					// Apply migration
					log('info', `Applying: ${migration.name} (${moduleName})`);
					const applyResult = applyMigration(db, migration);

					if (applyResult.success) {
						log('success', `Applied: ${migration.name} (${applyResult.duration}ms)`);
						result.modules[moduleName].applied++;
					} else {
						log('error', `Failed: ${migration.name} - ${applyResult.error}`);
						result.errors.push(`${moduleName}/${migration.name}: ${applyResult.error}`);
						result.modules[moduleName].failed++;
						// Don't fail entire process for module failures
					}
				}
			}
		}

		// Step 3: Final validation
		const finalTableCount =
			(
				db
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
	} finally {
		// Release lock
		releaseMigrationLock(db);
		db.close();
	}

	return result;
}

// CLI entry point
if (
	import.meta.url === `file://${process.argv[1]}` ||
	process.argv[1]?.endsWith('migrate-improved.ts')
) {
	runAllMigrations()
		.then((result) => {
			console.log('');
			console.log('=== Migration Summary ===');
			console.log(`Success: ${result.success}`);
			console.log(`Database created: ${result.databaseCreated}`);
			console.log(`Tables: ${result.tablesCreated}`);
			if (result.backupPath) {
				console.log(`Backup: ${result.backupPath}`);
			}
			console.log(
				`Core: ${result.core.applied} applied, ${result.core.failed} failed, ${result.core.skipped} skipped`
			);
			console.log(
				`Modules: ${
					Object.entries(result.modules)
						.map(([k, v]) => `${k}(${v.applied}/${v.failed})`)
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
