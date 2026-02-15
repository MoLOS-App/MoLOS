import { db as defaultDb } from '../../../../../src/lib/server/db';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export abstract class BaseRepository {
	protected db: BetterSQLite3Database<any>;

	constructor(db?: BetterSQLite3Database<any>) {
		this.db = (db as BetterSQLite3Database<any>) || defaultDb;
	}
}
