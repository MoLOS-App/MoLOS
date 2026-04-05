import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Database from 'better-sqlite3';
import { statSync } from 'fs';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	// Resolve DB path
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

	let sizeBefore = 0;
	try {
		sizeBefore = statSync(dbPath).size;
	} catch {
		throw error(500, 'Database file not found');
	}

	let client: Database.Database;
	try {
		client = new Database(dbPath);
		client.pragma('journal_mode = WAL');
	} catch {
		throw error(500, 'Failed to open database');
	}

	try {
		client.exec('VACUUM');
		client.close();
	} catch (err) {
		client.close();
		throw error(500, 'VACUUM failed: ' + (err as Error).message);
	}

	let sizeAfter = 0;
	try {
		sizeAfter = statSync(dbPath).size;
	} catch {}

	const savedBytes = sizeBefore - sizeAfter;

	return json({
		success: true,
		sizeBefore,
		sizeAfter,
		savedBytes,
		savedHuman: savedBytes > 0 ? `${(savedBytes / 1024 / 1024).toFixed(2)} MB` : '0 MB'
	});
};
