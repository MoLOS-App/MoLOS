import Database from 'better-sqlite3';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';

export function createTestDb(name: string = 'migration-test'): {
	db: Database.Database;
	path: string;
} {
	const dbPath = join(process.cwd(), `${name}.db`);

	// Clean up existing test db
	if (existsSync(dbPath)) {
		unlinkSync(dbPath);
	}

	const db = new Database(dbPath);
	return { db, path: dbPath };
}

export function cleanupTestDb(db: Database.Database, path: string): void {
	try {
		db.close();
	} catch {
		// Ignore close errors
	}

	if (existsSync(path)) {
		try {
			unlinkSync(path);
		} catch {
			// Ignore deletion errors
		}
	}
}

export function getTableNames(db: Database.Database): string[] {
	const rows = db
		.prepare(
			`SELECT name FROM sqlite_master 
       WHERE type='table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
		)
		.all() as { name: string }[];

	return rows.map((r) => r.name);
}

export function tableExists(db: Database.Database, tableName: string): boolean {
	const row = db
		.prepare(
			`SELECT name FROM sqlite_master 
       WHERE type='table' AND name = ?`
		)
		.get(tableName) as { name: string } | undefined;

	return !!row;
}

export function getAppliedMigrations(
	db: Database.Database
): { hash: string; created_at: number }[] {
	try {
		return db
			.prepare('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at')
			.all() as { hash: string; created_at: number }[];
	} catch {
		return [];
	}
}

export function countAppliedMigrations(db: Database.Database): number {
	try {
		const row = db.prepare('SELECT COUNT(*) as count FROM __drizzle_migrations').get() as {
			count: number;
		};
		return row.count;
	} catch {
		return 0;
	}
}
