import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

interface MigrationHealth {
	status: 'healthy' | 'warning' | 'error';
	timestamp: string;
	core: {
		applied: number;
		pending: string[];
		lastApplied: string | null;
	};
	modules: Record<
		string,
		{
			hasMigrations: boolean;
			applied: number;
			pending: string[];
			tablesExist: boolean;
		}
	>;
	issues: string[];
	backup: {
		exists: boolean;
		path: string | null;
		age: string | null;
	};
	database: {
		path: string;
		size: string;
		tables: number;
	};
}

function getDatabasePath(): string {
	const rawDbPath =
		process.env.DATABASE_URL?.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '') ||
		(process.env.NODE_ENV === 'production' ? '/data/molos.db' : 'molos.db');
	return rawDbPath;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAge(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 60) return `${seconds}s ago`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	return `${Math.floor(seconds / 86400)}d ago`;
}

function findLatestBackup(dbPath: string): { path: string; mtime: number } | null {
	const dir = join(dbPath, '..');
	const dbFile = dbPath.split('/').pop() || 'molos.db';
	const prefix = `${dbFile}.backup-`;

	try {
		const files = readdirSync(dir);
		const backups = files
			.filter((f) => f.startsWith(prefix))
			.map((f) => ({
				path: join(dir, f),
				mtime: statSync(join(dir, f)).mtime.getTime()
			}))
			.sort((a, b) => b.mtime - a.mtime);

		return backups[0] || null;
	} catch {
		return null;
	}
}

function getModuleMigrationsPaths(): Map<string, string> {
	const modulesPath = join(process.cwd(), 'modules');
	const paths = new Map<string, string>();

	if (!existsSync(modulesPath)) {
		return paths;
	}

	const entries = readdirSync(modulesPath, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory() && (entry.name.startsWith('MoLOS-') || entry.name === 'ai')) {
			const drizzlePath = join(modulesPath, entry.name, 'drizzle');
			if (existsSync(drizzlePath)) {
				paths.set(entry.name, drizzlePath);
			}
		}
	}

	return paths;
}

export const GET: RequestHandler = async ({ locals }) => {
	// Optional: require authentication for this endpoint
	// Uncomment the following lines to require admin access
	// if (!locals.user) {
	// 	throw error(401, 'Unauthorized');
	// }

	const health: MigrationHealth = {
		status: 'healthy',
		timestamp: new Date().toISOString(),
		core: { applied: 0, pending: [], lastApplied: null },
		modules: {},
		issues: [],
		backup: { exists: false, path: null, age: null },
		database: { path: '', size: '', tables: 0 }
	};

	const dbPath = getDatabasePath();
	health.database.path = dbPath;

	try {
		// Check database file
		if (!existsSync(dbPath)) {
			health.status = 'error';
			health.issues.push('Database file not found');
			return json(health);
		}

		const dbStats = statSync(dbPath);
		health.database.size = formatBytes(dbStats.size);

		// Open database
		const db = new Database(dbPath, { readonly: true });

		try {
			// Count tables
			const tableCount = db
				.prepare(
					"SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
				)
				.get() as { count: number };
			health.database.tables = tableCount.count;

			// Check core migrations
			try {
				const migrations = db
					.prepare('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC')
					.all() as { hash: string; created_at: number }[];

				health.core.applied = migrations.length;
				if (migrations.length > 0) {
					health.core.lastApplied = new Date(migrations[0].created_at * 1000).toISOString();
				}
			} catch {
				health.issues.push('Core migrations table not found');
				health.status = 'warning';
			}

			// Check for pending core migrations
			const coreMigrationsPath = join(process.cwd(), 'drizzle');
			if (existsSync(coreMigrationsPath)) {
				const journalPath = join(coreMigrationsPath, 'meta', '_journal.json');
				if (existsSync(journalPath)) {
					const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
					const journalTags = new Set(journal.entries?.map((e: { tag: string }) => e.tag) || []);

					const sqlFiles = readdirSync(coreMigrationsPath).filter(
						(f) => f.endsWith('.sql') && !f.startsWith('.')
					);

					for (const sqlFile of sqlFiles) {
						const tag = sqlFile.replace('.sql', '');
						if (!journalTags.has(tag)) {
							health.core.pending.push(tag);
						}
					}

					if (health.core.pending.length > 0) {
						health.status = 'warning';
						health.issues.push(`${health.core.pending.length} pending core migrations`);
					}
				}
			}

			// Check module migrations
			const modulePaths = getModuleMigrationsPaths();

			for (const [moduleName, migrationsPath] of modulePaths) {
				health.modules[moduleName] = {
					hasMigrations: true,
					applied: 0,
					pending: [],
					tablesExist: false
				};

				// Check if tables exist for this module
				const pattern = moduleName.replace(/-/g, '%') + '%';
				try {
					const tableCheck = db.prepare(
						`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name LIKE ?`
					);
					const result = tableCheck.get(pattern) as { count: number };
					health.modules[moduleName].tablesExist = result.count > 0;
				} catch {
					// Ignore
				}

				// Check journal sync
				const journalPath = join(migrationsPath, 'meta', '_journal.json');
				if (existsSync(journalPath)) {
					try {
						const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
						const journalTags = new Set(journal.entries?.map((e: { tag: string }) => e.tag) || []);

						const sqlFiles = readdirSync(migrationsPath).filter((f) => f.endsWith('.sql'));
						health.modules[moduleName].applied = journal.entries?.length || 0;

						for (const sqlFile of sqlFiles) {
							const tag = sqlFile.replace('.sql', '');
							if (!journalTags.has(tag)) {
								health.modules[moduleName].pending.push(tag);
							}
						}

						if (health.modules[moduleName].pending.length > 0) {
							health.status = 'warning';
							health.issues.push(
								`Module ${moduleName} has ${health.modules[moduleName].pending.length} pending migrations`
							);
						}
					} catch {
						health.issues.push(`Module ${moduleName} has invalid journal`);
						health.status = 'warning';
					}
				}
			}
		} finally {
			db.close();
		}

		// Check backup
		const backup = findLatestBackup(dbPath);
		if (backup) {
			health.backup.exists = true;
			health.backup.path = backup.path;
			health.backup.age = formatAge(backup.mtime);
		} else {
			health.issues.push('No database backup found');
			// Don't set warning status for missing backup - it's informational
		}
	} catch (err) {
		health.status = 'error';
		health.issues.push(`Health check failed: ${err instanceof Error ? err.message : String(err)}`);
	}

	return json(health);
};
