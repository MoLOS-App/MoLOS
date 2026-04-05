/**
 * Module Migration Manager
 *
 * Handles tracking and rollback of module database migrations.
 * Works with Drizzle ORM to manage migration history per module.
 *
 * @deprecated This class is deprecated per ADR-001. Use Drizzle's native
 *             migration tracking with .down.sql files for rollback support.
 */

import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '@molos/database';
import { coreModuleMigrations } from '@molos/database/schema/core';
import type { CoreModuleMigration } from '@molos/database/schema/core';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Migration record with additional metadata
 */
export interface MigrationRecord extends CoreModuleMigration {
	/**
	 * Whether this migration is currently active (not rolled back)
	 */
	active: boolean;
}

/**
 * Result of a rollback operation
 */
export interface RollbackResult {
	success: boolean;
	moduleId: string;
	migrationsRolledBack: number;
	errors: string[];
}

/**
 * Generates a simple rollback SQL for common operations
 * This is a best-effort generation - complex migrations may need manual rollback
 *
 * Supports:
 * - Manual .down.sql files (checked first)
 * - CREATE TABLE → DROP TABLE
 * - CREATE INDEX → DROP INDEX
 * - ALTER TABLE ADD COLUMN → ALTER TABLE DROP COLUMN
 */
function generateRollbackSql(
	migrationSql: string,
	migrationPath?: string
): { sql: string | null; source: 'manual' | 'auto' | 'none' } {
	// 1. Check for manual down migration file
	if (migrationPath) {
		const downPath = migrationPath.replace('.sql', '.down.sql');
		if (existsSync(downPath)) {
			try {
				const downSql = readFileSync(downPath, 'utf-8');
				return { sql: downSql, source: 'manual' };
			} catch (e) {
				console.warn(`[MigrationManager] Failed to read down migration: ${downPath}`);
			}
		}
	}

	// 2. Auto-generate rollback SQL for simple cases
	const lines: string[] = [];

	// Extract ALTER TABLE ADD COLUMN statements and generate DROP COLUMN
	const alterColumnMatches = migrationSql.matchAll(
		/ALTER\s+TABLE\s+["']?([\w-]+)["']?\s+ADD\s+COLUMN\s+["']?(\w+)["']?\s+(\w+)/gi
	);
	const addedColumns = new Set<string>();
	for (const match of alterColumnMatches) {
		const tableName = match[1];
		const columnName = match[2];
		const key = `${tableName}.${columnName}`;
		if (!addedColumns.has(key)) {
			addedColumns.add(key);
			lines.push(`ALTER TABLE "${tableName}" DROP COLUMN "${columnName}";`);
		}
	}

	// Extract CREATE TABLE statements and generate DROP TABLE
	const createTableMatches = migrationSql.matchAll(
		/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`']?([\w-]+)[`"']?/gi
	);
	const createdTables = new Set<string>();
	for (const match of createTableMatches) {
		const tableName = match[1];
		if (!createdTables.has(tableName)) {
			createdTables.add(tableName);
			lines.push(`DROP TABLE IF EXISTS "${tableName}";`);
		}
	}

	// Extract CREATE INDEX statements and generate DROP INDEX
	const createIndexMatches = migrationSql.matchAll(
		/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["`']?([\w-]+)[`"']?/gi
	);
	const createdIndexes = new Set<string>();
	for (const match of createIndexMatches) {
		const indexName = match[1];
		if (!createdIndexes.has(indexName)) {
			createdIndexes.add(indexName);
			lines.push(`DROP INDEX IF EXISTS "${indexName}";`);
		}
	}

	if (lines.length > 0) {
		return { sql: lines.join('\n'), source: 'auto' };
	}

	return { sql: null, source: 'none' };
}

/**
 * Generate checksum for migration SQL
 * Uses SHA256 for better collision resistance than MD5
 */
function generateChecksum(sql: string): string {
	return crypto.createHash('sha256').update(sql).digest('hex');
}

/**
 * Migration Manager for module database operations
 */
export class MigrationManager {
	/**
	 * Record a migration that was applied
	 *
	 * @param moduleId - The module's ID
	 * @param migrationName - Name of the migration file
	 * @param sql - The SQL that was executed
	 */
	async recordMigration(moduleId: string, migrationName: string, sql: string): Promise<void> {
		const id = `${moduleId}_${migrationName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
		const checksum = generateChecksum(sql);
		const rollbackResult = generateRollbackSql(sql);
		const rollbackSql = rollbackResult.sql;

		if (rollbackResult.source === 'none') {
			console.warn(
				`[MigrationManager] Warning: No rollback SQL generated for ${migrationName}. Consider adding a .down.sql file.`
			);
		} else if (rollbackResult.source === 'manual') {
			console.log(`[MigrationManager] Using manual rollback for ${migrationName}`);
		} else {
			console.log(`[MigrationManager] Auto-generated rollback for ${migrationName}`);
		}

		try {
			await db.insert(coreModuleMigrations).values({
				id,
				moduleId,
				migrationName,
				checksum,
				rollbackSql
			});
		} catch (error: unknown) {
			// Ignore duplicate key errors (migration already recorded)
			if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
				return;
			}
			throw error;
		}
	}

	/**
	 * Get migration history for a module
	 *
	 * @param moduleId - The module's ID
	 * @param includeRolledBack - Include rolled-back migrations
	 * @returns List of migration records, newest first
	 */
	async getMigrationHistory(
		moduleId: string,
		includeRolledBack = false
	): Promise<MigrationRecord[]> {
		const conditions = includeRolledBack
			? eq(coreModuleMigrations.moduleId, moduleId)
			: and(eq(coreModuleMigrations.moduleId, moduleId), isNull(coreModuleMigrations.rolledBackAt));

		const records = await db
			.select()
			.from(coreModuleMigrations)
			.where(conditions)
			.orderBy(desc(coreModuleMigrations.appliedAt));

		return records.map((r) => ({
			...r,
			active: r.rolledBackAt === null
		}));
	}

	/**
	 * Rollback all active migrations for a module
	 *
	 * @param moduleId - The module's ID
	 * @returns Result of the rollback operation
	 */
	async rollbackModule(moduleId: string): Promise<RollbackResult> {
		const result: RollbackResult = {
			success: true,
			moduleId,
			migrationsRolledBack: 0,
			errors: []
		};

		// Get active migrations in reverse order (newest first)
		const migrations = await this.getMigrationHistory(moduleId, false);

		if (migrations.length === 0) {
			console.log(`[MigrationManager] No active migrations to rollback for ${moduleId}`);
			return result;
		}

		console.log(`[MigrationManager] Rolling back ${migrations.length} migrations for ${moduleId}`);

		for (const migration of migrations) {
			try {
				// Execute rollback SQL if available
				if (migration.rollbackSql) {
					console.log(`[MigrationManager] Executing rollback for ${migration.migrationName}`);
					await db.execute(migration.rollbackSql);
				} else {
					console.warn(
						`[MigrationManager] No rollback SQL for ${migration.migrationName}, marking as rolled back only`
					);
				}

				// Mark as rolled back
				await db
					.update(coreModuleMigrations)
					.set({ rolledBackAt: new Date() })
					.where(eq(coreModuleMigrations.id, migration.id));

				result.migrationsRolledBack++;
			} catch (error) {
				const errorMsg = `Failed to rollback ${migration.migrationName}: ${error instanceof Error ? error.message : String(error)}`;
				console.error(`[MigrationManager] ${errorMsg}`);
				result.errors.push(errorMsg);
				result.success = false;
			}
		}

		return result;
	}

	/**
	 * Drop all tables for a module (cleanup on uninstall)
	 *
	 * This is more aggressive than rollback - it attempts to find and drop
	 * any tables that match the module's naming convention.
	 *
	 * @param moduleId - The module's ID
	 */
	async cleanupModuleTables(moduleId: string): Promise<{ dropped: string[]; errors: string[] }> {
		const result = {
			dropped: [] as string[],
			errors: [] as string[]
		};

		// First, try to rollback recorded migrations
		const rollbackResult = await this.rollbackModule(moduleId);
		result.errors.push(...rollbackResult.errors);

		// Try to find any remaining tables with module prefix
		// SQLite-specific query to find tables
		try {
			const tablesResult = await db.execute(`
				SELECT name FROM sqlite_master
				WHERE type='table'
				AND name LIKE '${moduleId}%'
				AND name NOT LIKE 'sqlite_%'
				AND name NOT LIKE 'drizzle%'
			`);

			for (const row of tablesResult.rows) {
				const tableName = row.name as string;
				try {
					await db.execute(`DROP TABLE IF EXISTS "${tableName}"`);
					result.dropped.push(tableName);
					console.log(`[MigrationManager] Dropped table: ${tableName}`);
				} catch (error) {
					const errorMsg = `Failed to drop table ${tableName}: ${error instanceof Error ? error.message : String(error)}`;
					console.error(`[MigrationManager] ${errorMsg}`);
					result.errors.push(errorMsg);
				}
			}
		} catch (error) {
			const errorMsg = `Failed to query tables: ${error instanceof Error ? error.message : String(error)}`;
			console.error(`[MigrationManager] ${errorMsg}`);
			result.errors.push(errorMsg);
		}

		return result;
	}

	/**
	 * Check if a module has any active migrations
	 */
	async hasActiveMigrations(moduleId: string): Promise<boolean> {
		const migrations = await this.getMigrationHistory(moduleId, false);
		return migrations.length > 0;
	}

	/**
	 * Get all modules with active migrations
	 */
	async getModulesWithMigrations(): Promise<string[]> {
		const records = await db
			.selectDistinct({ moduleId: coreModuleMigrations.moduleId })
			.from(coreModuleMigrations)
			.where(isNull(coreModuleMigrations.rolledBackAt));

		return records.map((r) => r.moduleId);
	}

	/**
	 * Verify migration checksum hasn't changed
	 *
	 * @returns true if migration matches, false if it was modified
	 */
	async verifyMigrationChecksum(
		moduleId: string,
		migrationName: string,
		currentSql: string
	): Promise<boolean> {
		const records = await db
			.select()
			.from(coreModuleMigrations)
			.where(
				and(
					eq(coreModuleMigrations.moduleId, moduleId),
					eq(coreModuleMigrations.migrationName, migrationName),
					isNull(coreModuleMigrations.rolledBackAt)
				)
			)
			.limit(1);

		if (records.length === 0) {
			return true; // No record means new migration, checksum is fine
		}

		const currentChecksum = generateChecksum(currentSql);
		return records[0].checksum === currentChecksum;
	}
}

// Singleton instance
export const migrationManager = new MigrationManager();
