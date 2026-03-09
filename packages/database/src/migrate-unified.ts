/**
 * Unified Migration Runner
 *
 * Rock-solid migration runner that handles:
 * - Fresh database creation (no database file exists)
 * - Existing databases with partial migrations
 * - Schema validation after migrations
 *
 * This is the single source of truth for all migrations in both dev and prod.
 * It applies SQL files directly (more reliable than drizzle migrate()).
 *
 * Usage:
 *   tsx packages/database/src/migrate-unified.ts
 *   bun run db:migrate
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

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
	return join(__dirname, '..', '..', '..', 'drizzle');
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
 * Apply migration SQL files directly to database
 * This is more reliable than drizzle's migrate() for SQLite
 */
function applyMigrationsDirectly(
	db: Database.Database,
	migrationsPath: string,
	label: string,
	expectedTablePrefix?: string
): { applied: number; failed: number; skipped: number; error?: string } {
	const result = { applied: 0, failed: 0, skipped: 0 };

	if (!existsSync(migrationsPath)) {
		log('warn', `Migrations path not found for ${label}: ${migrationsPath}`);
		return result;
	}

	let sqlFiles: string[] = [];
	try {
		sqlFiles = readdirSync(migrationsPath)
			.filter((f) => f.endsWith('.sql'))
			.sort();
		log('info', `Found ${sqlFiles.length} migration file(s) for ${label}`);

		// Check if expected tables already exist (for modules with prefix)
		if (expectedTablePrefix) {
			const existingTables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?")
				.all(`${expectedTablePrefix}_%`) as { name: string }[];

			if (existingTables.length > 0) {
				log(
					'info',
					`${label}: ${existingTables.length} table(s) already exist, skipping migrations`
				);
				result.skipped = sqlFiles.length;
				return result;
			}
		}

		const startTime = Date.now();

		// Apply each migration file directly
		for (const sqlFile of sqlFiles) {
			const sqlPath = join(migrationsPath, sqlFile);
			try {
				const sql = readFileSync(sqlPath, 'utf-8');

				// Check if this migration already tracked (has statement-breakpoint marker)
				if (sql.includes('--> statement-breakpoint')) {
					const statements = sql.split('--> statement-breakpoint');
					let appliedCount = 0;
					for (const statement of statements) {
						const trimmed = statement.trim();
						if (trimmed && !trimmed.startsWith('--')) {
							try {
								db.exec(trimmed);
								appliedCount++;
							} catch (stmtError) {
								const stmtErrMsg =
									stmtError instanceof Error ? stmtError.message : String(stmtError);
								// Handle common non-errors (table/column already exists)
								if (
									stmtErrMsg.includes('already exists') ||
									stmtErrMsg.includes('duplicate column name')
								) {
									appliedCount++;
								} else {
									throw stmtError; // Re-throw to be caught by outer handler
								}
							}
						}
					}
					result.applied++;
					log('info', `${label}: Applied ${sqlFile}`);
				} else {
					db.exec(sql);
					result.applied++;
					log('info', `${label}: Applied ${sqlFile}`);
				}
			} catch (sqlError) {
				const errMsg = sqlError instanceof Error ? sqlError.message : String(sqlError);
				if (errMsg.includes('already exists') || errMsg.includes('duplicate column name')) {
					log('info', `${label}: ${sqlFile} already applied`);
					result.skipped++;
					result.applied--;
				} else {
					log('error', `${label}: Failed to apply ${sqlFile}: ${errMsg}`);
					result.failed++;
				}
			}
		}

		const duration = Date.now() - startTime;
		log('success', `${label} migrations completed in ${duration}ms`);

		return result;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		log('error', `${label} migrations failed: ${errorMessage}`);
		result.failed = 1;
		result.applied = sqlFiles.length;
		return { ...result, error: errorMessage };
	}
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

	// Step 1: Run core migrations
	log('info', 'Running CORE migrations...');
	const coreMigrationsPath = getCoreMigrationsPath();
	const coreResult = applyMigrationsDirectly(sqlite, coreMigrationsPath, 'Core');
	result.core = coreResult;

	if (coreResult.error) {
		result.errors.push(`Core: ${coreResult.error}`);
		// Core migrations are required - if they fail, we can't continue
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

	// Step 3: Run module migrations
	log('info', 'Running MODULE migrations...');
	const modulePaths = getModuleMigrationsPaths();
	log('info', `Found ${modulePaths.size} module(s) with migrations`);

	for (const [moduleName, migrationsPath] of modulePaths) {
		log('info', `Processing module: ${moduleName}`);
		const tablePrefix = moduleName.startsWith('MoLOS-') ? moduleName : null;
		const moduleResult = applyMigrationsDirectly(
			sqlite,
			migrationsPath,
			moduleName,
			tablePrefix || undefined
		);
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

	log('info', 'Running core migrations only...');
	const coreMigrationsPath = getCoreMigrationsPath();
	const coreResult = applyMigrationsDirectly(sqlite, coreMigrationsPath, 'Core');
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
