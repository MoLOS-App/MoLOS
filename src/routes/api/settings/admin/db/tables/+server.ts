import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Database from 'better-sqlite3';
import { statSync } from 'fs';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const tableName = url.searchParams.get('table');

	// Resolve DB path (same logic as packages/database/src/connection.ts)
	let dbPath: string;
	try {
		const { env } = await import('$env/dynamic/private');
		const rawDbPath =
			env.DATABASE_URL ||
			(process.env.NODE_ENV === 'production' ? '/data/molos.db' : './data/molos.db');
		dbPath = rawDbPath.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '');
	} catch {
		const rawDbPath =
			process.env.DATABASE_URL ||
			(process.env.NODE_ENV === 'production' ? '/data/molos.db' : './data/molos.db');
		dbPath = rawDbPath.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '');
	}

	let client: Database.Database;

	try {
		client = new Database(dbPath, { readonly: true });
	} catch {
		throw error(500, 'Failed to open database');
	}

	try {
		if (tableName) {
			const page = parseInt(url.searchParams.get('page') || '1');
			const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
			const offset = (page - 1) * limit;

			// Validate table name to prevent SQL injection
			const tables = client
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
				.all() as { name: string }[];
			const validNames = tables.map((t) => t.name);
			if (!validNames.includes(tableName)) {
				client.close();
				throw error(400, 'Invalid table name');
			}

			const columns = client.prepare(`PRAGMA table_info("${tableName}")`).all() as {
				name: string;
				type: string;
				notnull: number;
				dflt_value: unknown;
				pk: number;
			}[];

			const rows = client
				.prepare(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`)
				.all(limit, offset) as Record<string, unknown>[];

			const countResult = client
				.prepare(`SELECT COUNT(*) as total FROM "${tableName}"`)
				.get() as { total: number };

			client.close();

			return json({
				table: tableName,
				columns,
				rows,
				pagination: {
					page,
					limit,
					total: countResult.total,
					totalPages: Math.ceil(countResult.total / limit)
				}
			});
		}

		// List all tables with row counts
		const tables = client
			.prepare(
				`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
			)
			.all() as { name: string }[];

		const tableInfo = tables.map((t) => {
			const count = (
				client.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get() as { c: number }
			).c;
			return {
				name: t.name,
				rowCount: count
			};
		});

		let dbSizeBytes = 0;
		try {
			dbSizeBytes = statSync(dbPath).size;
		} catch {
			// File may not be accessible
		}

		client.close();

		return json({
			tables: tableInfo,
			dbSizeBytes
		});
	} catch (err) {
		client.close();
		if ((err as { status?: number }).status) throw err;
		throw error(500, 'Database query failed');
	}
};
