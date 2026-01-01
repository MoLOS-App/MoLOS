import { defineConfig } from 'drizzle-kit';

const dbPath =
	process.env.DATABASE_URL ||
	(process.env.NODE_ENV === 'production' ? '/data/molos.db' : 'local.db');

const schemaPath =
	process.env.NODE_ENV === 'production'
		? '/app/src/lib/server/db/schema/index.ts'
		: './src/lib/server/db/schema/index.ts';

export default defineConfig({
	schema: schemaPath,
	dialect: 'sqlite',
	dbCredentials: { url: dbPath },
	verbose: true,
	strict: true
});
