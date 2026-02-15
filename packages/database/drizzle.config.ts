import { defineConfig } from 'drizzle-kit';

const rawDbPath =
	process.env.DATABASE_URL ||
	(process.env.NODE_ENV === 'production' ? '/data/molos.db' : '../../molos.db');
const normalizedDbPath = rawDbPath
	.replace(/^sqlite:\/\//, '')
	.replace(/^sqlite:|^file:/, '');

export default defineConfig({
	schema: './src/schema/index.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: { url: `file:${normalizedDbPath}` },
	verbose: true,
	strict: true
});
