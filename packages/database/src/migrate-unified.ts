/**
 * Unified Migration Runner
 *
 * Handles both core and module database migrations in a single, consistent flow.
 * Uses Drizzle's native migration tracking exclusively (per ADR-001).
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
	logMigration,
	logMigrationStart,
	logMigrationEnd,
	type MigrationLogEntry
} from './migration-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface MigrationResult {
	success: boolean;
	core: { applied: string[]; failed: string[]; skipped: string[] };
	modules: Record<string, { applied: string[]; failed: string[]; skipped: string[] }>;
	errors: string[];
}

function getDatabasePath(): string {
	const rawDbPath =
		process.env.DATABASE_URL?.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '') ||
		(process.env.NODE_ENV === 'production'
			? '/data/molos.db'
			: join(__dirname, '..', '..', '..', '..', 'data', 'molos.db'));
	return rawDbPath;
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

	const entries = readdirSync(modulesPath, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory() && (entry.name.startsWith('MoLOS-') || entry.name === 'ai')) {
			const drizzlePath = join(modulesPath, entry.name, 'drizzle');
			if (existsSync(drizzlePath)) {
				const sqlFiles = readdirSync(drizzlePath).filter((f) => f.endsWith('.sql'));
				if (sqlFiles.length > 0) {
					paths.set(entry.name, drizzlePath);
				}
			}
		}
	}

	return paths;
}

function getAppliedMigrations(db: Database.Database): Set<string> {
	try {
		const rows = db.prepare('SELECT hash FROM __drizzle_migrations').all() as { hash: string }[];
		return new Set(rows.map((r) => r.hash));
	} catch {
		return new Set();
	}
}

function getMigrationFiles(migrationsPath: string): string[] {
	return readdirSync(migrationsPath)
		.filter((f) => f.endsWith('.sql'))
		.sort();
}

function computeHash(sql: string): string {
	let hash = 0;
	for (let i = 0; i < sql.length; i++) {
		const char = sql.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash).toString(16).padStart(8, '0');
}

export async function runAllMigrations(dbPath?: string): Promise<MigrationResult> {
	const result: MigrationResult = {
		success: true,
		core: { applied: [], failed: [], skipped: [] },
		modules: {},
		errors: []
	};

	const actualDbPath = dbPath || getDatabasePath();
	const sqlite = new Database(actualDbPath);
	const db = drizzle(sqlite);

	const initStartTime = logMigrationStart('init', 'core', 'all');

	try {
		console.log('[Migrate:Unified] Starting unified migration process...');
		console.log(`[Migrate:Unified] Database: ${actualDbPath}`);

		// Step 1: Run core migrations
		console.log('[Migrate:Unified] Running CORE migrations...');
		const coreMigrationsPath = getCoreMigrationsPath();

		if (existsSync(coreMigrationsPath)) {
			const coreStartTime = Date.now();
			try {
				await migrate(db, { migrationsFolder: coreMigrationsPath });
				console.log('[Migrate:Unified] Core migrations completed');
				logMigration({
					level: 'info',
					operation: 'apply',
					target: 'core',
					migrationName: 'all',
					duration: Date.now() - coreStartTime,
					success: true
				});
			} catch (error) {
				const errorMsg = `Core migrations failed: ${error instanceof Error ? error.message : String(error)}`;
				console.error(`[Migrate:Unified] ${errorMsg}`);
				logMigration({
					level: 'error',
					operation: 'apply',
					target: 'core',
					migrationName: 'all',
					duration: Date.now() - coreStartTime,
					success: false,
					error: errorMsg
				});
				result.errors.push(errorMsg);
				result.core.failed.push('core');
				result.success = false;
			}
		}

		// Step 2: Run module migrations
		console.log('[Migrate:Unified] Running MODULE migrations...');
		const modulePaths = getModuleMigrationsPaths();

		for (const [moduleName, migrationsPath] of modulePaths) {
			console.log(`[Migrate:Unified] Processing module: ${moduleName}`);
			result.modules[moduleName] = { applied: [], failed: [], skipped: [] };

			const moduleStartTime = Date.now();
			try {
				await migrate(db, { migrationsFolder: migrationsPath });
				console.log(`[Migrate:Unified] Module ${moduleName} migrations completed`);
				logMigration({
					level: 'info',
					operation: 'apply',
					target: moduleName,
					migrationName: 'all',
					duration: Date.now() - moduleStartTime,
					success: true
				});
			} catch (error) {
				const errorMsg = `Module ${moduleName} migrations failed: ${error instanceof Error ? error.message : String(error)}`;
				console.error(`[Migrate:Unified] ${errorMsg}`);
				logMigration({
					level: 'error',
					operation: 'apply',
					target: moduleName,
					migrationName: 'all',
					duration: Date.now() - moduleStartTime,
					success: false,
					error: errorMsg
				});
				result.errors.push(errorMsg);
				result.modules[moduleName].failed.push('module');
				result.success = false;
			}
		}

		// Step 3: Validate schema (optional, but recommended)
		const tableCount = sqlite
			.prepare(
				"SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'"
			)
			.get() as { count: number };

		console.log(`[Migrate:Unified] Schema validation: ${tableCount.count} tables found`);

		logMigrationEnd(initStartTime, 'init', 'core', 'all', result.success, {
			error: result.success ? undefined : result.errors.join('; ')
		});

		if (result.success) {
			console.log('[Migrate:Unified] All migrations completed successfully');
		} else {
			console.error('[Migrate:Unified] Migration completed with errors');
		}

		return result;
	} finally {
		sqlite.close();
	}
}

export async function runCoreMigrationsOnly(dbPath?: string): Promise<MigrationResult> {
	const result: MigrationResult = {
		success: true,
		core: { applied: [], failed: [], skipped: [] },
		modules: {},
		errors: []
	};

	const actualDbPath = dbPath || getDatabasePath();
	const sqlite = new Database(actualDbPath);
	const db = drizzle(sqlite);

	try {
		console.log('[Migrate:Core] Running core migrations only...');
		const coreMigrationsPath = getCoreMigrationsPath();

		if (existsSync(coreMigrationsPath)) {
			await migrate(db, { migrationsFolder: coreMigrationsPath });
			console.log('[Migrate:Core] Core migrations completed');
		}

		return result;
	} catch (error) {
		const errorMsg = `Core migrations failed: ${error instanceof Error ? error.message : String(error)}`;
		console.error(`[Migrate:Core] ${errorMsg}`);
		result.errors.push(errorMsg);
		result.core.failed.push('core');
		result.success = false;
		return result;
	} finally {
		sqlite.close();
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runAllMigrations()
		.then((result) => {
			if (!result.success) {
				process.exit(1);
			}
		})
		.catch((error) => {
			console.error('Fatal migration error:', error);
			process.exit(1);
		});
}
