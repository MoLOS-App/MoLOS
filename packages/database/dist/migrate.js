import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = process.env.DATABASE_URL?.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '') ||
    (process.env.NODE_ENV === 'production'
        ? '/data/molos.db'
        : join(__dirname, '..', '..', '..', '..', 'data', 'molos.db'));
const MIGRATIONS_PATH = join(__dirname, '..', 'drizzle');
const sqlite = new Database(DB_PATH);
const db = drizzle(sqlite);
// Run migrations
(async () => {
    await migrate(db, { migrationsFolder: MIGRATIONS_PATH });
    console.log('Migrations completed successfully');
    process.exit(0);
})().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
