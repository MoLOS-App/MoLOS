import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import path from 'path';
import { hashPassword } from 'better-auth/crypto';
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

export type UserRecord = {
	id: string;
	name: string;
	email: string;
	role: string | null;
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

function openDatabaseOrThrow(readonly: boolean) {
	const databasePath = resolveDatabasePath();
	if (!databasePath || databasePath.includes('://')) {
		throw new Error('DATABASE_URL must point to a local SQLite file.');
	}
	if (!existsSync(databasePath)) {
		throw new Error('SQLite database file not found.');
	}
	const db = new Database(databasePath, { readonly });
	db.pragma('foreign_keys = ON');
	return db;
}

function findUserByIdentifierInDb(db: Database.Database, identifier: string) {
	return (db
		.prepare('select id, name, email, role from user where id = ? or email = ? limit 1')
		.get(identifier, identifier) ?? null) as UserRecord | null;
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

export function listUsers(limit = 25): UserRecord[] {
	const db = openDatabaseOrThrow(true);
	const rows = db
		.prepare('select id, name, email, role from user order by created_at desc limit ?')
		.all(limit) as UserRecord[];
	db.close();
	return rows;
}

export function findUserByIdentifier(identifier: string): UserRecord | null {
	const db = openDatabaseOrThrow(true);
	const user = findUserByIdentifierInDb(db, identifier);
	db.close();
	return user;
}

export async function resetUserPassword(
	identifier: string,
	newPassword: string,
	options?: { revokeSessions?: boolean }
) {
	const trimmedPassword = newPassword.trim();
	if (!trimmedPassword) {
		throw new Error('Password cannot be empty.');
	}
	const db = openDatabaseOrThrow(false);
	const user = findUserByIdentifierInDb(db, identifier);
	if (!user) {
		db.close();
		throw new Error('User not found.');
	}
	const hashedPassword = await hashPassword(newPassword);
	const now = Date.now();
	const account = db
		.prepare('select id from account where user_id = ? and provider_id = ? limit 1')
		.get(user.id, 'credential') as { id: string } | undefined;
	if (account?.id) {
		db.prepare('update account set password = ?, updated_at = ? where id = ?').run(
			hashedPassword,
			now,
			account.id
		);
	} else {
		db.prepare(
			'insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)'
		).run(randomUUID(), user.id, 'credential', user.id, hashedPassword, now, now);
	}
	if (options?.revokeSessions) {
		db.prepare('delete from session where user_id = ?').run(user.id);
	}
	db.close();
	return user;
}

export function updateUserRole(identifier: string, role: string | null) {
	const db = openDatabaseOrThrow(false);
	const user = findUserByIdentifierInDb(db, identifier);
	if (!user) {
		db.close();
		throw new Error('User not found.');
	}
	const normalizedRole = role && role.trim() !== '' ? role.trim() : null;
	const now = Date.now();
	db.prepare('update user set role = ?, updated_at = ? where id = ?').run(
		normalizedRole,
		now,
		user.id
	);
	db.close();
	return { ...user, role: normalizedRole };
}

export function removeUser(identifier: string) {
	const db = openDatabaseOrThrow(false);
	const user = findUserByIdentifierInDb(db, identifier);
	if (!user) {
		db.close();
		throw new Error('User not found.');
	}
	const result = db.prepare('delete from user where id = ?').run(user.id);
	db.close();
	if (result.changes === 0) {
		throw new Error('User could not be removed.');
	}
	return user;
}
