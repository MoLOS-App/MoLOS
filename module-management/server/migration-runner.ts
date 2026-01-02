import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export class MigrationRunner {
	constructor(private db: BetterSQLite3Database<any>) {}

	/**
	 * Validates that the SQL content only touches tables prefixed with the moduleId
	 */
	validateSql(moduleId: string, sqlContent: string) {
		// Improved regex to find table names while skipping SQL keywords
		// We look for words following TABLE, INTO, UPDATE, FROM, but skip IF NOT EXISTS
		const tableRegex =
			/(?:TABLE|INTO|UPDATE|FROM|JOIN)\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-zA-Z0-9_-]+)["`]?/gi;
		const keywords = new Set([
			'if',
			'not',
			'exists',
			'select',
			'insert',
			'update',
			'delete',
			'create',
			'drop',
			'alter',
			'table',
			'into',
			'from',
			'where',
			'and',
			'or',
			'null',
			'primary',
			'key',
			'text',
			'integer',
			'real',
			'blob',
			'default',
			'strftime',
			'now'
		]);

		let match;
		while ((match = tableRegex.exec(sqlContent)) !== null) {
			const tableName = match[1].toLowerCase();

			// Skip internal migration table and common SQL keywords
			if (tableName === '_module_migrations' || keywords.has(tableName)) continue;

			// Normalize moduleId for comparison (lowercase and replace hyphens with underscores)
			// SQLite tables usually use underscores, but git repos often use hyphens.
			const normalizedModuleId = moduleId.toLowerCase().replace(/-/g, '_');
			const normalizedTableName = tableName.replace(/-/g, '_');

			// Allow common system tables if needed, but for now strictly enforce prefix
			if (
				!normalizedTableName.startsWith(normalizedModuleId + '_') &&
				!normalizedTableName.startsWith('molos_')
			) {
				throw new Error(
					`Security Violation: Module ${moduleId} attempted to access table ${tableName}. All tables must be prefixed with '${moduleId}_' (or '${normalizedModuleId}_').`
				);
			}
		}
	}

	/**
	 * Runs SQL migrations for a specific module
	 * @param moduleId The ID of the module
	 * @param migrationsDir Path to the module's drizzle/ folder
	 */
	async runMigrations(moduleId: string, migrationsDir: string) {
		if (!existsSync(migrationsDir)) {
			console.log(`[MigrationRunner] No migrations found for module ${moduleId}`);
			return;
		}

		const files = readdirSync(migrationsDir)
			.filter((f) => f.endsWith('.sql'))
			.sort();

		console.log(`[MigrationRunner] Found ${files.length} migrations for ${moduleId}`);

		for (const file of files) {
			const filePath = path.join(migrationsDir, file);
			const sqlContent = readFileSync(filePath, 'utf-8');

			try {
				this.ensureMigrationTable();

				const alreadyRun = this.db.get(
					sql`SELECT 1 FROM _module_migrations WHERE module_id = ${moduleId} AND migration_name = ${file}`
				);

				if (!alreadyRun) {
					console.log(
						`[MigrationRunner] Validating and executing migration ${file} for ${moduleId}...`
					);

					// 1. Security Check: Ensure module only touches its own tables
					this.validateSql(moduleId, sqlContent);

					// 2. Execute the SQL (split by statement-breakpoint if present)
					const statements = sqlContent.split('--> statement-breakpoint');
					for (const statement of statements) {
						const trimmed = statement.trim();
						if (trimmed) {
							this.db.run(sql.raw(trimmed));
						}
					}

					this.db.run(
						sql`INSERT INTO _module_migrations (module_id, migration_name) VALUES (${moduleId}, ${file})`
					);
					console.log(`[MigrationRunner] Migration ${file} completed.`);
				}
			} catch (error: any) {
				console.error(`[MigrationRunner] Failed to run migration ${file} for ${moduleId}:`, error);
				throw new Error(`Migration ${file} failed: ${error.message}`);
			}
		}
	}

	private ensureMigrationTable() {
		try {
			this.db.run(
				sql.raw(`
				CREATE TABLE IF NOT EXISTS _module_migrations (
					module_id TEXT NOT NULL,
					migration_name TEXT NOT NULL,
					applied_at INTEGER DEFAULT (strftime('%s', 'now')),
					PRIMARY KEY (module_id, migration_name)
				);
			`)
			);
		} catch (e) {
			console.error('[MigrationRunner] Failed to create migration tracking table:', e);
		}
	}
}
