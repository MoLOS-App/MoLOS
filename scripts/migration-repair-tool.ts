#!/usr/bin/env bun
/**
 * Migration Repair Tool
 *
 * Detects and repairs partially applied migrations.
 *
 * Usage:
 *   bun run scripts/migration-repair-tool.ts diagnose
 *   bun run scripts/migration-repair-tool.ts repair
 *   bun run scripts/migration-repair-tool.ts backup
 */

import Database from 'better-sqlite3';
import { existsSync, copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';

const DB_PATH =
	process.env.DATABASE_URL?.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '') ||
	'./data/molos.db';

interface MigrationStatus {
	name: string;
	module: string;
	applied: boolean;
	partial: boolean;
	checksum?: string;
	error?: string;
}

interface RepairReport {
	timestamp: string;
	database: string;
	status: 'healthy' | 'corrupted' | 'repaired';
	migrations: MigrationStatus[];
	errors: string[];
	recommendations: string[];
}

class MigrationRepairTool {
	private db: Database.Database;

	constructor(dbPath: string) {
		if (!existsSync(dbPath)) {
			throw new Error(`Database not found: ${dbPath}`);
		}
		this.db = new Database(dbPath);
	}

	/**
	 * Diagnose migration state
	 */
	diagnose(): RepairReport {
		const report: RepairReport = {
			timestamp: new Date().toISOString(),
			database: DB_PATH,
			status: 'healthy',
			migrations: [],
			errors: [],
			recommendations: []
		};

		console.log('🔍 Diagnosing migration state...\n');

		// Check 1: Verify tracking tables exist
		const hasDrizzleMigrations = this.tableExists('__drizzle_migrations');
		const hasMolosMigrations = this.tableExists('molos_migrations');

		if (!hasDrizzleMigrations && !hasMolosMigrations) {
			report.errors.push('No migration tracking tables found');
			report.recommendations.push(
				'Run migrations from scratch: rm data/molos.db && bun run db:migrate'
			);
			report.status = 'corrupted';
			this.db.close();
			return report;
		}

		// Check 2: Verify ai_mcp tables have expected columns
		const mcpTablesStatus = this.checkMcpTables();
		report.migrations.push(...mcpTablesStatus.migrations);
		report.errors.push(...mcpTablesStatus.errors);

		// Check 3: Check for partial migrations
		const partialMigrations = this.detectPartialMigrations();
		if (partialMigrations.length > 0) {
			report.status = 'corrupted';
			report.errors.push(`Found ${partialMigrations.length} partially applied migrations`);
			report.recommendations.push('Run: bun run scripts/migration-repair-tool.ts repair');
		}

		// Check 4: Verify foreign keys
		const fkViolations = this.db.pragma('foreign_key_check') as any[];
		if (fkViolations.length > 0) {
			report.status = 'corrupted';
			report.errors.push(`Found ${fkViolations.length} foreign key violations`);
			for (const violation of fkViolations) {
				report.errors.push(
					`  FK violation in ${violation.table} (row ${violation.rowid}), referenced: ${violation.parent}`
				);
			}
		}

		this.db.close();
		return report;
	}

	/**
	 * Check MCP tables for missing columns (migration 0016)
	 */
	private checkMcpTables(): { migrations: MigrationStatus[]; errors: string[] } {
		const result = { migrations: [] as MigrationStatus[], errors: [] as string[] };

		// Check ai_mcp_resources
		const resourcesColumns = this.getTableColumns('ai_mcp_resources');
		const hasSubmoduleIdResources = resourcesColumns.includes('submodule_id');
		const hasResourceName = resourcesColumns.includes('resource_name');

		if (!hasSubmoduleIdResources || !hasResourceName) {
			result.migrations.push({
				name: '0016_add_submodule_tool_permissions',
				module: 'core',
				applied: false,
				partial: true,
				error: `ai_mcp_resources missing columns: ${!hasSubmoduleIdResources ? 'submodule_id ' : ''}${!hasResourceName ? 'resource_name' : ''}`
			});
			result.errors.push('Migration 0016 partially applied - resources table incomplete');
		}

		// Check ai_mcp_prompts
		const promptsColumns = this.getTableColumns('ai_mcp_prompts');
		const hasSubmoduleIdPrompts = promptsColumns.includes('submodule_id');
		const hasPromptName = promptsColumns.includes('prompt_name');

		if (!hasSubmoduleIdPrompts || !hasPromptName) {
			result.migrations.push({
				name: '0016_add_submodule_tool_permissions',
				module: 'core',
				applied: false,
				partial: true,
				error: `ai_mcp_prompts missing columns: ${!hasSubmoduleIdPrompts ? 'submodule_id ' : ''}${!hasPromptName ? 'prompt_name' : ''}`
			});
			result.errors.push('Migration 0016 partially applied - prompts table incomplete');
		}

		// Check ai_mcp_api_keys
		const apiKeysColumns = this.getTableColumns('ai_mcp_api_keys');
		const hasAllowedScopes = apiKeysColumns.includes('allowed_scopes');
		const hasAllowedModules = apiKeysColumns.includes('allowed_modules');

		if (hasAllowedModules && !hasAllowedScopes) {
			result.migrations.push({
				name: '0016_add_submodule_tool_permissions',
				module: 'core',
				applied: false,
				partial: true,
				error: 'ai_mcp_api_keys has old allowed_modules column, needs rename to allowed_scopes'
			});
			result.errors.push('Migration 0016 partially applied - api_keys table not renamed');
		}

		if (
			hasSubmoduleIdResources &&
			hasResourceName &&
			hasSubmoduleIdPrompts &&
			hasPromptName &&
			hasAllowedScopes
		) {
			result.migrations.push({
				name: '0016_add_submodule_tool_permissions',
				module: 'core',
				applied: true,
				partial: false
			});
		}

		return result;
	}

	/**
	 * Detect partially applied migrations
	 */
	private detectPartialMigrations(): string[] {
		const partial: string[] = [];

		// For now, just check migration 0016
		// In the future, this will be more comprehensive
		const mcpStatus = this.checkMcpTables();
		for (const migration of mcpStatus.migrations) {
			if (migration.partial) {
				partial.push(migration.name);
			}
		}

		return partial;
	}

	/**
	 * Repair partially applied migrations
	 */
	repair(): RepairReport {
		const report = this.diagnose();

		if (report.status === 'healthy') {
			console.log('✅ Database is healthy, no repairs needed\n');
			return report;
		}

		console.log('🔧 Repairing corrupted migrations...\n');

		// Repair migration 0016
		const migration16 = report.migrations.find(
			(m) => m.name === '0016_add_submodule_tool_permissions'
		);
		if (migration16?.partial) {
			this.repairMigration16();
		}

		// Re-run diagnosis
		const finalReport = this.diagnose();
		if (finalReport.status === 'healthy') {
			finalReport.status = 'repaired';
			console.log('✅ Database repaired successfully\n');
		} else {
			console.log('❌ Repair failed, manual intervention required\n');
			finalReport.recommendations.push(
				'Backup your data and recreate the database: bun run scripts/migration-repair-tool.ts backup'
			);
		}

		return finalReport;
	}

	/**
	 * Repair migration 0016
	 */
	private repairMigration16(): void {
		console.log('Repairing migration 0016...');

		try {
			this.db.exec('BEGIN TRANSACTION');

			// Fix ai_mcp_api_keys - rename column if needed
			const apiKeysColumns = this.getTableColumns('ai_mcp_api_keys');
			if (
				apiKeysColumns.includes('allowed_modules') &&
				!apiKeysColumns.includes('allowed_scopes')
			) {
				console.log('  - Renaming allowed_modules to allowed_scopes...');
				this.db.exec('ALTER TABLE ai_mcp_api_keys RENAME COLUMN allowed_modules TO allowed_scopes');
			}

			// Fix ai_mcp_resources - add missing columns
			const resourcesColumns = this.getTableColumns('ai_mcp_resources');
			if (!resourcesColumns.includes('submodule_id')) {
				console.log('  - Adding submodule_id to ai_mcp_resources...');
				this.db.exec("ALTER TABLE ai_mcp_resources ADD COLUMN submodule_id TEXT DEFAULT 'main'");
			}
			if (!resourcesColumns.includes('resource_name')) {
				console.log('  - Adding resource_name to ai_mcp_resources...');
				this.db.exec('ALTER TABLE ai_mcp_resources ADD COLUMN resource_name TEXT');
			}

			// Fix ai_mcp_prompts - add missing columns
			const promptsColumns = this.getTableColumns('ai_mcp_prompts');
			if (!promptsColumns.includes('submodule_id')) {
				console.log('  - Adding submodule_id to ai_mcp_prompts...');
				this.db.exec("ALTER TABLE ai_mcp_prompts ADD COLUMN submodule_id TEXT DEFAULT 'main'");
			}
			if (!promptsColumns.includes('prompt_name')) {
				console.log('  - Adding prompt_name to ai_mcp_prompts...');
				this.db.exec('ALTER TABLE ai_mcp_prompts ADD COLUMN prompt_name TEXT');
			}

			this.db.exec('COMMIT');
			console.log('  ✅ Migration 0016 repaired\n');
		} catch (error) {
			this.db.exec('ROLLBACK');
			throw error;
		}
	}

	/**
	 * Create backup
	 */
	backup(): string {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		const backupDir = join(dirname(DB_PATH), 'backups');

		if (!existsSync(backupDir)) {
			mkdirSync(backupDir, { recursive: true });
		}

		const backupPath = join(backupDir, `molos-${timestamp}.db`);

		console.log(`📦 Creating backup: ${backupPath}`);

		// Use SQLite backup API for consistency
		const backupDb = new Database(DB_PATH, { readonly: true });
		backupDb.backup(backupPath);
		backupDb.close();

		console.log('✅ Backup created successfully\n');
		return backupPath;
	}

	/**
	 * Helper: Check if table exists
	 */
	private tableExists(tableName: string): boolean {
		const result = this.db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
			.get(tableName);
		return !!result;
	}

	/**
	 * Helper: Get table columns
	 */
	private getTableColumns(tableName: string): string[] {
		const columns = this.db.pragma(`table_info(${tableName})`) as Array<{ name: string }>;
		return columns.map((c) => c.name);
	}
}

// CLI
const command = process.argv[2] || 'diagnose';

async function main() {
	try {
		const tool = new MigrationRepairTool(DB_PATH);

		let report: RepairReport;

		switch (command) {
			case 'diagnose':
				report = tool.diagnose();
				break;

			case 'repair':
				report = tool.repair();
				break;

			case 'backup':
				const backupPath = tool.backup();
				console.log(`Backup created at: ${backupPath}`);
				return;

			default:
				console.error(`Unknown command: ${command}`);
				console.error('Usage: bun run scripts/migration-repair-tool.ts [diagnose|repair|backup]');
				process.exit(1);
		}

		// Print report
		console.log('=== Migration Repair Report ===\n');
		console.log(`Timestamp: ${report.timestamp}`);
		console.log(`Database: ${report.database}`);
		console.log(`Status: ${report.status}\n`);

		if (report.migrations.length > 0) {
			console.log('Migrations:');
			for (const migration of report.migrations) {
				const status = migration.applied
					? '✅ Applied'
					: migration.partial
						? '⚠️  Partial'
						: '❌ Not Applied';
				console.log(`  ${status}: ${migration.name} (${migration.module})`);
				if (migration.error) {
					console.log(`    Error: ${migration.error}`);
				}
			}
			console.log('');
		}

		if (report.errors.length > 0) {
			console.log('Errors:');
			for (const error of report.errors) {
				console.log(`  ❌ ${error}`);
			}
			console.log('');
		}

		if (report.recommendations.length > 0) {
			console.log('Recommendations:');
			for (const rec of report.recommendations) {
				console.log(`  💡 ${rec}`);
			}
			console.log('');
		}

		process.exit(report.status === 'healthy' || report.status === 'repaired' ? 0 : 1);
	} catch (error) {
		console.error('❌ Error:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

main();
