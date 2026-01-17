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

// Handle URL prefixes
const dbPath = rawDbPath.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '');

const client = isBuilding ? new Database(':memory:') : new Database(dbPath);

try {
	client.pragma('journal_mode = WAL');
	client.pragma('busy_timeout = 5000');
	client.pragma('synchronous = NORMAL');
	client.pragma('foreign_keys = ON');
} catch {
	// Non-fatal
}

export const db = drizzle(client, { schema });
