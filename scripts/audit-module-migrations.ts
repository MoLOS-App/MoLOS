#!/usr/bin/env tsx
/**
 * Module Migration Audit Script
 *
 * Audits all module migrations for common issues:
 * - Journal/SQL file sync
 * - Table prefix correctness
 * - Applied vs pending migrations
 *
 * Usage:
 *   bun run db:audit-modules
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface ModuleAuditResult {
	moduleName: string;
	hasDrizzleDir: boolean;
	hasJournal: boolean;
	journalEntryCount: number;
	sqlFileCount: number;
	journalSynced: boolean;
	tablePrefixCorrect: boolean;
	tablesExist: boolean;
	issues: string[];
}

function getDatabasePath(): string {
	const rawDbPath =
		process.env.DATABASE_URL ||
		(process.env.NODE_ENV === 'production' ? '/data/molos.db' : './data/molos.db');
	return rawDbPath.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '');
}

function auditModule(modulePath: string, dbPath: string): ModuleAuditResult {
	const moduleName = modulePath.split('/').pop() || '';
	const result: ModuleAuditResult = {
		moduleName,
		hasDrizzleDir: false,
		hasJournal: false,
		journalEntryCount: 0,
		sqlFileCount: 0,
		journalSynced: true,
		tablePrefixCorrect: true,
		tablesExist: false,
		issues: []
	};

	const drizzlePath = join(modulePath, 'drizzle');
	result.hasDrizzleDir = existsSync(drizzlePath);

	if (!result.hasDrizzleDir) {
		return result;
	}

	const journalPath = join(drizzlePath, 'meta', '_journal.json');
	result.hasJournal = existsSync(journalPath);

	if (result.hasJournal) {
		try {
			const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
			result.journalEntryCount = journal.entries?.length || 0;
		} catch (e) {
			result.issues.push(`Failed to parse journal: ${e}`);
		}
	}

	const sqlFiles = readdirSync(drizzlePath).filter((f) => f.endsWith('.sql'));
	result.sqlFileCount = sqlFiles.length;

	if (result.journalEntryCount !== result.sqlFileCount) {
		result.journalSynced = false;
		result.issues.push(
			`Journal has ${result.journalEntryCount} entries but ${result.sqlFileCount} SQL files`
		);
	}

	for (const sqlFile of sqlFiles) {
		const sql = readFileSync(join(drizzlePath, sqlFile), 'utf-8');
		const tableMatches = sql.matchAll(
			/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([\w-]+)[`"']?/gi
		);
		for (const match of tableMatches) {
			const tableName = match[1];
			// Skip internal SQLite tables (__, __new_, etc.)
			if (tableName && tableName.startsWith('__')) {
				continue;
			}
			// Check if table name starts with module prefix (allowing for underscore/hyphen variations)
			if (tableName) {
				// Normalize both to underscores for comparison
				const normalizedTableName = tableName.replace(/-/g, '_');
				const normalizedModuleName = moduleName.replace(/-/g, '_');
				if (!normalizedTableName.startsWith(normalizedModuleName)) {
					result.tablePrefixCorrect = false;
					result.issues.push(`Table "${tableName}" doesn't have module prefix "${moduleName}"`);
				}
			}
		}
	}

	try {
		const tableCheck = execSync(
			`sqlite3 "${dbPath}" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name LIKE '${moduleName}%';"`,
			{ encoding: 'utf-8' }
		).trim();
		const tableCount = parseInt(tableCheck, 10);
		result.tablesExist = tableCount > 0;
	} catch {
		result.issues.push('Could not check database tables');
	}

	return result;
}

function auditAllModules(): void {
	const modulesPath = join(process.cwd(), 'modules');
	const dbPath = getDatabasePath();

	if (!existsSync(modulesPath)) {
		console.error('No modules directory found');
		process.exit(1);
	}

	const modules = readdirSync(modulesPath, { withFileTypes: true })
		.filter((d) => d.isDirectory() && (d.name.startsWith('MoLOS-') || d.name === 'ai'))
		.map((d) => d.name);

	console.log(`\nAuditing ${modules.length} modules...\n`);
	console.log('| Module | Drizzle | Journal | SQLs | Synced | Prefix | Tables | Issues |');
	console.log('|--------|---------|---------|------|--------|--------|--------|--------|');

	const results: ModuleAuditResult[] = [];
	for (const moduleName of modules) {
		const modulePath = join(modulesPath, moduleName);
		results.push(auditModule(modulePath, dbPath));
	}

	let totalIssues = 0;

	for (const r of results) {
		const status = r.issues.length === 0 ? '✅' : '⚠️';
		const hasDrizzle = r.hasDrizzleDir ? '✅' : '➖';
		const hasJournal = r.hasJournal ? '✅' : '❌';
		const synced = r.journalSynced ? '✅' : '❌';
		const prefix = r.tablePrefixCorrect ? '✅' : '❌';
		const tables = r.tablesExist ? '✅' : '➖';

		console.log(
			`| ${r.moduleName.slice(0, 20).padEnd(20)} | ${hasDrizzle}       | ${hasJournal}       | ${String(r.sqlFileCount).padStart(4)} | ${synced}      | ${prefix}      | ${tables}      | ${r.issues.length > 0 ? '⚠️ ' + r.issues.length : '✅'}     |`
		);

		if (r.issues.length > 0) {
			totalIssues += r.issues.length;
			for (const issue of r.issues) {
				console.log(`  └─ ${issue}`);
			}
		}
	}

	console.log(`\nTotal issues found: ${totalIssues}`);

	if (totalIssues > 0) {
		process.exit(1);
	}
}

auditAllModules();
