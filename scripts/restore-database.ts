#!/usr/bin/env tsx
/**
 * Database Backup Restoration Utility
 *
 * Usage:
 *   bun run db:restore --list
 *   bun run db:restore --latest
 *   bun run db:restore --file <filename>
 */

import { existsSync, readdirSync, statSync, copyFileSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import Database from 'better-sqlite3';
import * as readline from 'readline';

const DB_PATH =
	process.env.DATABASE_URL?.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '') ||
	'./data/molos.db';

const BACKUP_DIR = join(dirname(DB_PATH), 'backups');

interface BackupInfo {
	filename: string;
	path: string;
	size: number;
	created: Date;
	age: string;
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatAge(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ${hours % 24}h ago`;
	if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
	if (minutes > 0) return `${minutes}m ago`;
	return `${seconds}s ago`;
}

function listBackups(): BackupInfo[] {
	if (!existsSync(BACKUP_DIR)) {
		return [];
	}

	const backupFiles = readdirSync(BACKUP_DIR)
		.filter((f) => f.startsWith('molos-') && f.endsWith('.db'))
		.sort()
		.reverse(); // Most recent first

	return backupFiles.map((filename) => {
		const path = join(BACKUP_DIR, filename);
		const stats = statSync(path);
		const age = Date.now() - stats.mtimeMs;

		return {
			filename,
			path,
			size: stats.size,
			created: new Date(stats.mtimeMs),
			age: formatAge(age)
		};
	});
}

function verifyBackupIntegrity(backupPath: string): boolean {
	try {
		const db = new Database(backupPath, { readonly: true });
		const integrityCheck = db.pragma('integrity_check') as string;
		db.close();
		return integrityCheck === 'ok';
	} catch (error) {
		console.error(`❌ Backup integrity check failed: ${error}`);
		return false;
	}
}

function restoreBackup(backupPath: string): boolean {
	try {
		// Verify backup integrity
		console.log('🔍 Verifying backup integrity...');
		if (!verifyBackupIntegrity(backupPath)) {
			console.error('❌ Backup failed integrity check');
			return false;
		}
		console.log('✅ Backup integrity verified');

		// Create safety backup of current database
		if (existsSync(DB_PATH)) {
			const safetyBackupPath = `${DB_PATH}.pre-restore-${Date.now()}`;
			console.log(`📦 Creating safety backup: ${safetyBackupPath}`);
			copyFileSync(DB_PATH, safetyBackupPath);
			chmodSync(safetyBackupPath, 0o600);
		}

		// Restore backup
		console.log(`🔄 Restoring database from: ${backupPath}`);
		copyFileSync(backupPath, DB_PATH);
		chmodSync(DB_PATH, 0o600);

		// Verify restored database
		console.log('🔍 Verifying restored database...');
		if (!verifyBackupIntegrity(DB_PATH)) {
			console.error('❌ Restored database failed integrity check');
			return false;
		}

		console.log('✅ Database restored successfully');
		return true;
	} catch (error) {
		console.error(`❌ Restore failed: ${error}`);
		return false;
	}
}

function askConfirmation(question: string): Promise<boolean> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
		});
	});
}

async function main() {
	const args = process.argv.slice(2);

	if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
		console.log(`
Database Backup Restoration Utility

Usage:
  bun run db:restore --list              List available backups
  bun run db:restore --latest            Restore from latest backup
  bun run db:restore --file <filename>   Restore from specific backup

Options:
  --list, -l       List all available backups
  --latest         Restore from the most recent backup
  --file, -f       Restore from a specific backup file
  --help, -h       Show this help message

Examples:
  # List all backups
  bun run db:restore --list

  # Restore latest backup
  bun run db:restore --latest

  # Restore specific backup
  bun run db:restore --file molos-2026-03-06T12-30-45.db
`);
		process.exit(0);
	}

	// List backups
	if (args[0] === '--list' || args[0] === '-l') {
		const backups = listBackups();

		if (backups.length === 0) {
			console.log('📦 No backups found');
			console.log(`\nBackup directory: ${BACKUP_DIR}`);
			process.exit(0);
		}

		console.log(`\n📦 Available Backups (${backups.length}):\n`);
		console.log('  #  Filename                              Size      Age');
		console.log('  ── ───────────────────────────────────── ───────── ──────────');

		backups.forEach((backup, index) => {
			const num = String(index + 1).padStart(2, ' ');
			const filename = backup.filename.padEnd(37, ' ');
			const size = formatBytes(backup.size).padStart(8, ' ');
			const age = backup.age.padStart(10, ' ');
			console.log(`  ${num} ${filename} ${size} ${age}`);
		});

		console.log('\n  Usage:');
		console.log('    bun run db:restore --latest');
		console.log('    bun run db:restore --file <filename>');
		console.log(`\n  Backup directory: ${BACKUP_DIR}`);

		process.exit(0);
	}

	// Restore latest
	if (args[0] === '--latest') {
		const backups = listBackups();

		if (backups.length === 0) {
			console.error('❌ No backups available');
			process.exit(1);
		}

		const latestBackup = backups[0];
		console.log(`\n📦 Latest backup: ${latestBackup.filename}`);
		console.log(`   Size: ${formatBytes(latestBackup.size)}`);
		console.log(`   Age: ${latestBackup.age}`);
		console.log(`   Created: ${latestBackup.created.toISOString()}`);

		const confirmed = await askConfirmation(
			'\n⚠️  This will replace your current database. Continue? (yes/no): '
		);

		if (!confirmed) {
			console.log('❌ Restore cancelled');
			process.exit(0);
		}

		const success = restoreBackup(latestBackup.path);
		process.exit(success ? 0 : 1);
	}

	// Restore specific file
	if (args[0] === '--file' || args[0] === '-f') {
		if (!args[1]) {
			console.error('❌ Error: --file requires a filename');
			console.error('   Usage: bun run db:restore --file <filename>');
			process.exit(1);
		}

		const filename = args[1];
		const backupPath = join(BACKUP_DIR, filename);

		if (!existsSync(backupPath)) {
			console.error(`❌ Backup not found: ${filename}`);
			console.error(`   Run 'bun run db:restore --list' to see available backups`);
			process.exit(1);
		}

		const stats = statSync(backupPath);
		console.log(`\n📦 Backup: ${filename}`);
		console.log(`   Size: ${formatBytes(stats.size)}`);
		console.log(`   Created: ${new Date(stats.mtimeMs).toISOString()}`);

		const confirmed = await askConfirmation(
			'\n⚠️  This will replace your current database. Continue? (yes/no): '
		);

		if (!confirmed) {
			console.log('❌ Restore cancelled');
			process.exit(0);
		}

		const success = restoreBackup(backupPath);
		process.exit(success ? 0 : 1);
	}

	console.error('❌ Unknown option. Use --help for usage information.');
	process.exit(1);
}

main();
