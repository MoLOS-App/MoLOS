import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import path from 'path';
import * as schema from '../../src/lib/server/db/schema/index';

type TableInfo = {
	name: string;
	count?: number;
	source: 'schema' | 'db';
};

type QueryResult = {
	columns: string[];
	rows: Array<Record<string, unknown>>;
	changes?: number;
};

function resolveDatabasePath() {
	const raw = (process.env.DATABASE_URL || '').trim();
	const fallback = 'molos.db';
	const value = raw !== '' ? raw : fallback;

	if (value.startsWith('file:')) {
		return path.resolve(process.cwd(), value.replace(/^file:/, ''));
	}

	if (value.startsWith('sqlite:')) {
		return path.resolve(process.cwd(), value.replace(/^sqlite:/, ''));
	}

	if (value.includes('://')) {
		return value;
	}

	return path.resolve(process.cwd(), value);
}

function isTableLike(value: unknown): value is { name: string } {
	return Boolean(value && typeof value === 'object' && 'name' in value);
}

function getSchemaTables() {
	return Object.values(schema)
		.filter(isTableLike)
		.map((table) => table.name);
}

export function listTablesWithCounts(): TableInfo[] {
	const databasePath = resolveDatabasePath();
	if (!databasePath || databasePath.includes('://')) {
		return [];
	}
	if (!existsSync(databasePath)) {
		return [];
	}
	const db = new Database(databasePath, { readonly: true });

	const schemaTables = getSchemaTables();
	const dbTables = db
		.prepare("select name from sqlite_master where type = 'table' order by name")
		.all() as Array<{ name: string }>;

	const dbTableNames = dbTables.map((row) => row.name);
	const seen = new Set<string>();
	const tables: TableInfo[] = [];

	for (const name of schemaTables) {
		seen.add(name);
		tables.push({ name, source: 'schema' });
	}

	for (const name of dbTableNames) {
		if (seen.has(name)) continue;
		tables.push({ name, source: 'db' });
	}

	for (const table of tables) {
		try {
			const row = db
				.prepare(`select count(*) as count from "${table.name.replace(/"/g, '""')}"`)
				.get() as { count: number };
			table.count = row?.count ?? 0;
		} catch {
			table.count = undefined;
		}
	}

	db.close();
	return tables;
}

export function runSqlQuery(query: string): QueryResult {
	const databasePath = resolveDatabasePath();
	if (!databasePath || databasePath.includes('://')) {
		throw new Error('DATABASE_URL must point to a local SQLite file.');
	}
	if (!existsSync(databasePath)) {
		throw new Error('SQLite database file not found.');
	}
	const db = new Database(databasePath, { readonly: false });
	const statement = db.prepare(query);

	if (statement.reader) {
		const rows = statement.all() as Array<Record<string, unknown>>;
		const columns = rows.length ? Object.keys(rows[0]) : [];
		db.close();
		return { columns, rows };
	}

	const result = statement.run();
	db.close();
	return { columns: [], rows: [], changes: result.changes };
}
