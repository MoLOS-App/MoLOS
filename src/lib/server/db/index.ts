import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

// Fallback for CLI/Supervisor where $env and $app are not available
let env_DATABASE_URL: string | undefined;
let isBuilding = false;

try {
	/* eslint-disable @typescript-eslint/ban-ts-comment */
	// @ts-ignore
	const { env } = await import('$env/dynamic/private');
	env_DATABASE_URL = env.DATABASE_URL;
	// @ts-ignore
	const { building } = await import('$app/environment');
	/* eslint-enable @typescript-eslint/ban-ts-comment */
	isBuilding = building;
} catch {
	// Fallback to process.env for CLI
	env_DATABASE_URL = process.env.DATABASE_URL;
	isBuilding = process.env.BUILDING === 'true';
}

const rawDbPath =
	env_DATABASE_URL || (process.env.NODE_ENV === 'production' ? '/data/molos.db' : 'molos.db');

// Handle 'file:' prefix if present (common in DATABASE_URL)
const dbPath = rawDbPath.startsWith('file:') ? rawDbPath.slice(5) : rawDbPath;

// During build, we might not have access to the database file or directory.
// We use a dummy database or skip initialization if possible.
const client = isBuilding ? new Database(':memory:') : new Database(dbPath);

export const db = drizzle(client, { schema });
