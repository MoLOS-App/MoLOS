#!/usr/bin/env bun
/**
 * Migration Generator
 *
 * Generates new migration files with proper naming and rollback support.
 *
 * Usage:
 *   bun run scripts/generate-migration.ts --name add_user_preferences --module core
 *   bun run scripts/generate-migration.ts --name add_tasks --module MoLOS-Tasks --reversible
 */

import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { validateMigrationName, extractVersion } from '../packages/database/src/migration-utils.js';

interface GeneratorOptions {
	name: string;
	module: string;
	reversible: boolean;
	description?: string;
}

function getMigrationsPath(module: string): string {
	if (module === 'core') {
		return join(process.cwd(), 'drizzle');
	}
	return join(process.cwd(), 'modules', module, 'drizzle');
}

function getNextVersion(migrationsPath: string): number {
	if (!existsSync(migrationsPath)) {
		return 1;
	}

	const files = readdirSync(migrationsPath)
		.filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
		.map((f) => extractVersion(f));

	const maxVersion = Math.max(0, ...files);
	return maxVersion + 1;
}

function formatVersion(version: number): string {
	return String(version).padStart(4, '0');
}

function generateMigrationSQL(options: GeneratorOptions): string {
	const timestamp = new Date().toISOString();
	const description = options.description || `Migration: ${options.name}`;

	return `-- Migration: ${options.name}
-- Module: ${options.module}
-- Created: ${timestamp}
-- Dependencies: (optional: 'module:version' format, e.g., 'core:0001')

-- TODO: Add your migration SQL here

-- Example:
-- CREATE TABLE IF NOT EXISTS example (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   name TEXT NOT NULL,
--   created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
-- );

--> statement-breakpoint

-- Add more statements as needed, each separated by --> statement-breakpoint
`;
}

function generateRollbackSQL(options: GeneratorOptions): string {
	const timestamp = new Date().toISOString();
	const description = options.description || `Rollback: ${options.name}`;

	return `-- Rollback: ${options.name}
-- Module: ${options.module}
-- Created: ${timestamp}

-- TODO: Add rollback SQL here

-- Example:
-- DROP TABLE IF EXISTS example;

--> statement-breakpoint

-- Add more rollback statements as needed
`;
}

function generateMigration(options: GeneratorOptions): void {
	// Validate name
	const validation = validateMigrationName(`${formatVersion(1)}_${options.name}.sql`);
	if (!validation.valid) {
		// Remove version prefix from error message since we're generating it
		console.error(`❌ Invalid migration name: ${options.name}`);
		console.error(`   Suggestion: Use lowercase letters, numbers, and underscores only`);
		console.error(`   Example: add_user_preferences, create_tasks_table`);
		process.exit(1);
	}

	const migrationsPath = getMigrationsPath(options.module);

	// Ensure directory exists
	if (!existsSync(migrationsPath)) {
		mkdirSync(migrationsPath, { recursive: true });
		console.log(`📁 Created migrations directory: ${migrationsPath}`);
	}

	// Get next version
	const version = getNextVersion(migrationsPath);
	const versionStr = formatVersion(version);
	const baseName = `${versionStr}_${options.name}`;

	// Generate up migration
	const upPath = join(migrationsPath, `${baseName}.sql`);
	const upSQL = generateMigrationSQL(options);

	// Check if file already exists
	if (existsSync(upPath)) {
		console.error(`❌ Migration already exists: ${upPath}`);
		process.exit(1);
	}

	writeFileSync(upPath, upSQL);
	console.log(`✅ Created: ${upPath}`);

	// Generate down migration if reversible
	if (options.reversible) {
		const downPath = join(migrationsPath, `${baseName}.down.sql`);
		const downSQL = generateRollbackSQL(options);

		writeFileSync(downPath, downSQL);
		console.log(`✅ Created: ${downPath}`);
	}

	console.log(`
📋 Next steps:
1. Edit ${upPath}
   ${options.reversible ? `2. Edit ${join(migrationsPath, `${baseName}.down.sql`)}` : '2. This migration is irreversible (no .down.sql created)'}
3. Validate: bun run db:validate
4. Apply: bun run db:migrate:improved

💡 Tips:
- Use --> statement-breakpoint between SQL statements
- Test your migration with dry-run: bun run db:migrate:dry-run
- Add dependencies in the SQL comment if needed
`);
}

// CLI
const args = process.argv.slice(2);
const options: Partial<GeneratorOptions> = {
	reversible: false
};

for (let i = 0; i < args.length; i++) {
	const arg = args[i];

	if (arg === '--name' || arg === '-n') {
		options.name = args[++i];
	} else if (arg === '--module' || arg === '-m') {
		options.module = args[++i];
	} else if (arg === '--reversible' || arg === '-r') {
		options.reversible = true;
	} else if (arg === '--description' || arg === '-d') {
		options.description = args[++i];
	} else if (arg === '--help' || arg === '-h') {
		console.log(`
Migration Generator

Usage:
  bun run scripts/generate-migration.ts [options]

Options:
  --name, -n <name>        Migration name (required)
                           Example: add_user_preferences, create_tasks_table
  --module, -m <module>    Module name (default: core)
                           Example: core, MoLOS-Tasks, MoLOS-Meals
  --reversible, -r         Generate rollback migration (.down.sql)
  --description, -d <desc> Migration description (optional)
  --help, -h               Show this help

Examples:
  # Core migration
  bun run scripts/generate-migration.ts --name add_user_preferences

  # Module migration with rollback
  bun run scripts/generate-migration.ts --name add_priority --module MoLOS-Tasks --reversible

  # With description
  bun run scripts/generate-migration.ts -n create_index -m core -r -d "Add index for faster queries"
`);
		process.exit(0);
	}
}

// Validate required options
if (!options.name) {
	console.error('❌ Error: --name is required');
	console.error('   Example: bun run scripts/generate-migration.ts --name add_user_preferences');
	process.exit(1);
}

if (!options.module) {
	options.module = 'core';
	console.log('ℹ️  No module specified, using "core"');
}

generateMigration(options as GeneratorOptions);
