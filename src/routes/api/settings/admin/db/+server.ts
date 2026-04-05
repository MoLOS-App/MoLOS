import { error } from '@sveltejs/kit';
import { readFileSync } from 'fs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	// Check admin role
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (locals.user.role !== 'admin') {
		throw error(403, 'Forbidden - Admin access required');
	}

	// Get database path (same logic as packages/database/src/connection.ts)
	let dbPath: string;

	try {
		const { env } = await import('$env/dynamic/private');
		const rawDbPath =
			env.DATABASE_URL ||
			(process.env.NODE_ENV === 'production' ? '/data/molos.db' : './data/molos.db');

		// Handle URL prefixes: sqlite://, sqlite:, file:
		dbPath = rawDbPath.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '');
	} catch {
		// Fallback for environments where $env is not available
		const rawDbPath =
			process.env.DATABASE_URL ||
			(process.env.NODE_ENV === 'production' ? '/data/molos.db' : './data/molos.db');
		dbPath = rawDbPath.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '');
	}

	// Read the database file
	let fileContents: ArrayBuffer;

	try {
		const buffer = readFileSync(dbPath);
		fileContents = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
	} catch (err) {
		const e = err as NodeJS.ErrnoException;
		if (e.code === 'ENOENT') {
			throw error(404, 'Database file not found');
		}
		if (e.code === 'EACCES') {
			throw error(403, 'Permission denied accessing database file');
		}
		throw error(500, 'Failed to read database file');
	}

	// Return file with appropriate headers
	return new Response(fileContents, {
		headers: {
			'Content-Type': 'application/octet-stream',
			'Content-Disposition': 'attachment; filename="molos.db"'
		}
	});
};
