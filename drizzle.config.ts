import { defineConfig } from 'drizzle-kit';

const dbPath =
	process.env.DATABASE_URL ||
	(process.env.NODE_ENV === 'production' ? '/data/molos.db' : 'local.db');

export default defineConfig({
	schema: './src/lib/server/db/schema/index.ts',
	dialect: 'sqlite',
	dbCredentials: { url: dbPath },
	verbose: true,
	strict: true
});
