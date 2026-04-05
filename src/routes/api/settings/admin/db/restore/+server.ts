import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFileSync, statSync, copyFileSync, renameSync, existsSync } from 'fs';
import { dirname } from 'path';

export const POST: RequestHandler = async ({ locals, request }) => {
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

	const formData = await request.formData();
	const file = formData.get('file') as File | null;

	if (!file) {
		throw error(400, 'No file uploaded');
	}

	if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite') && !file.name.endsWith('.sqlite3')) {
		throw error(400, 'Invalid file type. Expected .db, .sqlite, or .sqlite3');
	}

	// Size limit: 500MB
	if (file.size > 500 * 1024 * 1024) {
		throw error(400, 'File too large. Maximum size is 500MB');
	}

	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	// Validate it's a valid SQLite database by checking the header
	if (buffer.length < 16 || !buffer.slice(0, 15).toString('utf8').startsWith('SQLite format 3')) {
		throw error(400, 'Invalid SQLite database file');
	}

	// Backup current database before replacing
	const backupPath = `${dirname(dbPath)}/molos-backup-${Date.now()}.db`;
	try {
		if (existsSync(dbPath)) {
			copyFileSync(dbPath, backupPath);
		}
	} catch (err) {
		throw error(500, 'Failed to create backup: ' + (err as Error).message);
	}

	// Write the new database
	try {
		writeFileSync(dbPath, buffer);
	} catch (err) {
		// Attempt to restore backup
		try {
			if (existsSync(backupPath)) {
				renameSync(backupPath, dbPath);
			}
		} catch {
			// Best effort restore
		}
		throw error(500, 'Failed to write database: ' + (err as Error).message);
	}

	let newSize = 0;
	try {
		newSize = statSync(dbPath).size;
	} catch {}

	return json({
		success: true,
		message: 'Database restored successfully',
		backupPath,
		newSizeBytes: newSize,
		originalFileName: file.name
	});
};
