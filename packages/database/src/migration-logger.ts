/**
 * Migration Logger
 *
 * Provides structured logging for migration operations.
 * Logs are written to both console and a JSONL file for analysis.
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface MigrationLogEntry {
	timestamp: string;
	level: 'info' | 'warn' | 'error';
	operation: 'apply' | 'rollback' | 'validate' | 'backup' | 'init';
	target: string; // 'core' or module name
	migrationName: string;
	duration?: number;
	checksum?: string;
	success: boolean;
	error?: string;
	message?: string;
}

const LOG_DIR = join(process.cwd(), 'logs');
const LOG_FILE = join(LOG_DIR, 'migrations.log');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

function ensureLogDir(): void {
	if (!existsSync(LOG_DIR)) {
		mkdirSync(LOG_DIR, { recursive: true });
	}
}

function shouldRotateLog(): boolean {
	if (!existsSync(LOG_FILE)) {
		return false;
	}
	try {
		const stats = require('fs').statSync(LOG_FILE);
		return stats.size > MAX_LOG_SIZE;
	} catch {
		return false;
	}
}

function rotateLog(): void {
	if (!existsSync(LOG_FILE)) {
		return;
	}
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const rotatedPath = LOG_FILE.replace('.log', `-${timestamp}.log`);
	try {
		require('fs').renameSync(LOG_FILE, rotatedPath);
	} catch {
		// Ignore rotation errors
	}
}

export function logMigration(entry: Omit<MigrationLogEntry, 'timestamp'>): void {
	ensureLogDir();

	if (shouldRotateLog()) {
		rotateLog();
	}

	const fullEntry: MigrationLogEntry = {
		...entry,
		timestamp: new Date().toISOString()
	};

	const logLine = JSON.stringify(fullEntry) + '\n';

	try {
		appendFileSync(LOG_FILE, logLine, 'utf-8');
	} catch (e) {
		// If write fails, at least log to console
		console.error('[MigrationLogger] Failed to write to log file:', e);
	}

	// Console output
	const level = fullEntry.level.toUpperCase().padEnd(5);
	const target = fullEntry.target.padEnd(20);
	const status = fullEntry.success ? '✅' : '❌';
	const duration = fullEntry.duration ? ` (${fullEntry.duration}ms)` : '';
	const errorMsg = fullEntry.error ? ` - ${fullEntry.error}` : '';

	const consoleMsg = `[${level}] [${target}] ${fullEntry.operation} ${fullEntry.migrationName}${duration} ${status}${errorMsg}`;

	if (entry.level === 'error') {
		console.error(consoleMsg);
	} else if (entry.level === 'warn') {
		console.warn(consoleMsg);
	} else {
		console.log(consoleMsg);
	}
}

export function logMigrationStart(
	operation: MigrationLogEntry['operation'],
	target: string,
	migrationName: string
): number {
	logMigration({
		level: 'info',
		operation,
		target,
		migrationName,
		success: true,
		message: 'Started'
	});
	return Date.now();
}

export function logMigrationEnd(
	startTime: number,
	operation: MigrationLogEntry['operation'],
	target: string,
	migrationName: string,
	success: boolean,
	options?: { checksum?: string; error?: string }
): void {
	logMigration({
		level: success ? 'info' : 'error',
		operation,
		target,
		migrationName,
		duration: Date.now() - startTime,
		checksum: options?.checksum,
		success,
		error: options?.error,
		message: success ? 'Completed' : 'Failed'
	});
}

export function getLogFilePath(): string {
	return LOG_FILE;
}

export function readRecentLogs(limit: number = 100): MigrationLogEntry[] {
	if (!existsSync(LOG_FILE)) {
		return [];
	}

	try {
		const content = require('fs').readFileSync(LOG_FILE, 'utf-8');
		const lines = content.trim().split('\n').filter(Boolean);
		const recentLines = lines.slice(-limit);

		return recentLines
			.map((line: string) => {
				try {
					return JSON.parse(line) as MigrationLogEntry;
				} catch {
					return null;
				}
			})
			.filter((entry: MigrationLogEntry | null): entry is MigrationLogEntry => entry !== null);
	} catch {
		return [];
	}
}

export function clearLogs(): void {
	if (existsSync(LOG_FILE)) {
		writeFileSync(LOG_FILE, '', 'utf-8');
	}
}
