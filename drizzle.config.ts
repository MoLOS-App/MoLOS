import { defineConfig } from 'drizzle-kit';

const dbPath =
	process.env.DATABASE_URL ||
	(process.env.NODE_ENV === 'production' ? '/data/molos.db' : 'local.db');

export default defineConfig({
	schema: './src/lib/server/db/schema/index.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: { url: dbPath.startsWith('file:') ? dbPath : `file:${dbPath}` },
	verbose: true,
	strict: true
});
