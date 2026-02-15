import Database, { type Database as SQLiteDatabase } from 'better-sqlite3';
import * as schema from './schema/index.js';
export declare const db: import("drizzle-orm/better-sqlite3").BetterSQLite3Database<typeof schema> & {
    $client: Database.Database;
};
export declare const sqlite: SQLiteDatabase;
export { schema };
//# sourceMappingURL=connection.d.ts.map