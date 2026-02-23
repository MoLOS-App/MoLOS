# Phase 4: Observability & Safety

> **Priority**: P2 (Medium)
> **Duration**: 2-3 days
> **Dependencies**: Phase 2 completed
> **Status**: Completed (2026-02-23)

---

## Overview

Add observability tooling to monitor migration health and detect issues early. These features help catch problems before they affect production.

---

## Task 4.1: Migration Health Endpoint

**Status**: ✅ Completed
**Priority**: P2
**Estimated Time**: 3-4 hours

### Description

Create an API endpoint that reports the health status of migrations.

### Implementation

Create `src/routes/api/admin/migrations/health/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface MigrationHealth {
	status: 'healthy' | 'warning' | 'error';
	core: {
		applied: string[];
		pending: string[];
		lastApplied: string | null;
	};
	modules: Record<
		string,
		{
			applied: string[];
			pending: string[];
			status: 'ok' | 'warning' | 'error';
		}
	>;
	issues: string[];
	backupExists: boolean;
	backupPath: string | null;
}

export const GET: RequestHandler = async () => {
	const health: MigrationHealth = {
		status: 'healthy',
		core: { applied: [], pending: [], lastApplied: null },
		modules: {},
		issues: [],
		backupExists: false,
		backupPath: null
	};

	try {
		// Check core migrations
		const appliedMigrations = await db.execute(`
            SELECT * FROM __drizzle_migrations ORDER BY created_at DESC
        `);

		health.core.applied = appliedMigrations.rows.map((r) => r.hash as string);
		health.core.lastApplied = (appliedMigrations.rows[0]?.created_at as string) || null;

		// Check for pending migrations
		const migrationsPath = join(process.cwd(), 'drizzle');
		const sqlFiles = readdirSync(migrationsPath).filter((f) => f.endsWith('.sql'));
		const journalPath = join(migrationsPath, 'meta', '_journal.json');

		if (existsSync(journalPath)) {
			const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
			const journalTags = new Set(journal.entries.map((e) => e.tag));

			for (const sqlFile of sqlFiles) {
				const tag = sqlFile.replace('.sql', '');
				if (!journalTags.has(tag)) {
					health.core.pending.push(tag);
				}
			}
		}

		// Check backup
		const dbPath = process.env.DATABASE_URL || 'molos.db';
		const backupPattern = `${dbPath}.backup-`;
		// ... check for backups ...

		// Determine overall status
		if (health.core.pending.length > 0) {
			health.status = 'warning';
			health.issues.push(`${health.core.pending.length} pending core migrations`);
		}
	} catch (error) {
		health.status = 'error';
		health.issues.push(`Health check failed: ${error}`);
	}

	return json(health);
};
```

### Response Format

```json
{
	"status": "healthy",
	"core": {
		"applied": ["0000_condemned_ultron", "0001_gifted_terrax"],
		"pending": [],
		"lastApplied": "2026-02-14T12:34:56Z"
	},
	"modules": {
		"MoLOS-Tasks": {
			"applied": ["0000_lean_supernaut"],
			"pending": [],
			"status": "ok"
		}
	},
	"issues": [],
	"backupExists": true,
	"backupPath": "/data/molos.db.backup-2026-02-21"
}
```

### Files to Create

- `src/routes/api/admin/migrations/health/+server.ts`

### Verification

- [x] Endpoint returns valid JSON
- [x] Correctly identifies pending migrations
- [x] Reports backup status
- [x] Returns error status on database issues

---

## Task 4.2: Replace MD5 with SHA256

**Status**: ✅ Completed
**Priority**: P2
**Estimated Time**: 30 minutes

### Description

Replace MD5 hashing with SHA256 for migration checksums.

### Current Code

Location: `module-management/server/migration-manager.ts:64`

```typescript
function generateChecksum(sql: string): string {
	return crypto.createHash('md5').update(sql).digest('hex');
}
```

### Updated Code

```typescript
function generateChecksum(sql: string): string {
	return crypto.createHash('sha256').update(sql).digest('hex');
}
```

### Migration Consideration

This will change checksums for all existing migrations. Options:

1. **Recompute on next run**: Old checksums won't match, but that's okay for verification
2. **Migration**: Add a migration to update existing checksums
3. **Dual check**: Support both during transition

### Recommendation

Option 1 - Just change the algorithm. Existing checksums will be different, but that only affects the `verifyMigrationChecksum` function, which should handle the mismatch gracefully.

### Files to Modify

- `module-management/server/migration-manager.ts`

### Verification

- [x] SHA256 checksums are 64 characters (vs 32 for MD5)
- [x] Existing migrations still work
- [x] New migrations use SHA256

---

## Task 4.3: Structured Migration Logging

**Status**: ✅ Completed
**Priority**: P2
**Estimated Time**: 2-3 hours

### Description

Add structured logging for all migration operations.

### Implementation

Create `packages/database/src/migration-logger.ts`:

```typescript
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface MigrationLogEntry {
	timestamp: string;
	level: 'info' | 'warn' | 'error';
	operation: 'apply' | 'rollback' | 'validate' | 'backup';
	target: 'core' | string; // module name or 'core'
	migrationName: string;
	duration?: number;
	checksum?: string;
	success: boolean;
	error?: string;
}

const LOG_DIR = join(process.cwd(), 'logs');
const LOG_FILE = join(LOG_DIR, 'migrations.log');

function ensureLogDir() {
	if (!existsSync(LOG_DIR)) {
		mkdirSync(LOG_DIR, { recursive: true });
	}
}

export function logMigration(entry: Omit<MigrationLogEntry, 'timestamp'>) {
	ensureLogDir();

	const fullEntry: MigrationLogEntry = {
		...entry,
		timestamp: new Date().toISOString()
	};

	const logLine = JSON.stringify(fullEntry) + '\n';
	appendFileSync(LOG_FILE, logLine);

	// Also log to console
	const consoleMsg = `[${fullEntry.level.toUpperCase()}] ${fullEntry.operation} ${fullEntry.migrationName} (${fullEntry.target}) - ${fullEntry.success ? 'OK' : 'FAILED'}`;

	if (entry.level === 'error') {
		console.error(consoleMsg, entry.error || '');
	} else if (entry.level === 'warn') {
		console.warn(consoleMsg);
	} else {
		console.log(consoleMsg);
	}
}
```

### Usage in Migrations

```typescript
import { logMigration } from '@molos/database/migration-logger';

const startTime = Date.now();
try {
	await applyMigration(migration);
	logMigration({
		level: 'info',
		operation: 'apply',
		target: 'core',
		migrationName: migration.name,
		duration: Date.now() - startTime,
		checksum: migration.checksum,
		success: true
	});
} catch (error) {
	logMigration({
		level: 'error',
		operation: 'apply',
		target: 'core',
		migrationName: migration.name,
		duration: Date.now() - startTime,
		success: false,
		error: error.message
	});
	throw error;
}
```

### Log Format (JSONL)

```json
{"timestamp":"2026-02-21T12:34:56.789Z","level":"info","operation":"apply","target":"core","migrationName":"0015_cleanup_duplicate_ai_messages","duration":123,"checksum":"abc123","success":true}
{"timestamp":"2026-02-21T12:35:01.234Z","level":"info","operation":"apply","target":"MoLOS-Tasks","migrationName":"0001_absent_white_tiger","duration":45,"checksum":"def456","success":true}
```

### Files to Create/Modify

- `packages/database/src/migration-logger.ts` (new)
- `packages/database/src/index.ts` (export logger)
- Migration scripts (add logging)

### Verification

- [x] Log file is created
- [x] Entries are valid JSON
- [x] Console output matches log
- [x] Errors are logged with details

---

## Task 4.4: Migration Dashboard UI (Optional)

**Status**: Deferred
**Priority**: P3
**Estimated Time**: 4-6 hours

### Description

Create a simple admin dashboard to view migration status.

### Implementation

Create `src/routes/(app)/admin/migrations/+page.svelte`:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';

	let health = $state(null);
	let loading = $state(true);
	let error = $state(null);

	onMount(async () => {
		try {
			const res = await fetch('/api/admin/migrations/health');
			health = await res.json();
		} catch (e) {
			error = e.message;
		} finally {
			loading = false;
		}
	});
</script>

<div class="p-6">
	<h1 class="mb-4 text-2xl font-bold">Migration Health</h1>

	{#if loading}
		<p>Loading...</p>
	{:else if error}
		<p class="text-red-500">Error: {error}</p>
	{:else}
		<div class="space-y-4">
			<!-- Status card -->
			<div
				class="rounded-lg border p-4 {health.status === 'healthy'
					? 'border-green-200 bg-green-50'
					: 'border-yellow-200 bg-yellow-50'}"
			>
				<span class="font-medium">Status:</span>
				{health.status}
			</div>

			<!-- Core migrations -->
			<div class="rounded-lg border p-4">
				<h2 class="mb-2 font-medium">Core Migrations</h2>
				<p>Applied: {health.core.applied.length}</p>
				<p>Pending: {health.core.pending.length}</p>
			</div>

			<!-- Modules -->
			<!-- ... -->
		</div>
	{/if}
</div>
```

### Files to Create

- `src/routes/(app)/admin/migrations/+page.svelte`
- `src/routes/(app)/admin/migrations/+page.server.ts`

### Verification

- [ ] Page loads without errors
- [ ] Displays current migration status
- [ ] Shows pending migrations
- [ ] Accessible only to admin users

---

## Phase 4 Completion Checklist

- [x] Task 4.1: Health endpoint created
- [x] Task 4.2: SHA256 checksums in use
- [x] Task 4.3: Structured logging implemented
- [ ] Task 4.4: Dashboard UI created (optional - deferred)
- [x] Logs are being written to file
- [x] Health endpoint returns correct data

---

## Notes

- Phase 4 can be done in parallel with Phase 3
- Task 4.4 is optional - the API endpoint is sufficient for monitoring
- Consider adding alerting based on health endpoint status
