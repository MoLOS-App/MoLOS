# Phase 3: Module Migration Hardening

> **Priority**: P1 (High)
> **Duration**: 3-4 days
> **Dependencies**: Phase 2 completed
> **Status**: Completed (2026-02-22)

---

## Overview

Audit and harden the migration systems for all 11 modules that have their own database migrations. Ensure consistency and fix any issues discovered during the audit.

---

## Modules to Audit

| Module              | Priority  | Notes                    | Status |
| ------------------- | --------- | ------------------------ | ------ |
| MoLOS-Tasks         | High      | Reference implementation | ✅     |
| MoLOS-Goals         | Medium    |                          | ✅     |
| MoLOS-Finance       | Medium    |                          | ✅     |
| MoLOS-Health        | Low       | Fixed prefix issue       | ✅     |
| MoLOS-Meals         | Low       |                          | ✅     |
| MoLOS-Google        | Medium    |                          | ✅     |
| MoLOS-AI-Knowledge  | Medium    | Fixed missing tables     | ✅     |
| MoLOS-Markdown      | Low       |                          | ✅     |
| MoLOS-LLM-Council   | Low       |                          | ✅     |
| MoLOS-Product-Owner | Low       |                          | ✅     |
| MoLOS-Sample-Module | Reference | Template for new modules | ✅     |

---

## Task 3.1: Create Module Migration Audit Script

**Status**: ✅ Completed
**Priority**: P1
**Estimated Time**: 2-3 hours

### Description

Create an automated script that audits all module migrations for common issues.

### Implementation

Create `scripts/audit-module-migrations.ts`:

```typescript
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ModuleAuditResult {
	moduleName: string;
	hasDrizzleDir: boolean;
	hasJournal: boolean;
	journalEntryCount: number;
	sqlFileCount: number;
	journalSynced: boolean;
	tablePrefixCorrect: boolean;
	issues: string[];
}

function auditModule(modulePath: string): ModuleAuditResult {
	const result: ModuleAuditResult = {
		moduleName: modulePath.split('/').pop() || '',
		hasDrizzleDir: false,
		hasJournal: false,
		journalEntryCount: 0,
		sqlFileCount: 0,
		journalSynced: true,
		tablePrefixCorrect: true,
		issues: []
	};

	const drizzlePath = join(modulePath, 'drizzle');
	result.hasDrizzleDir = existsSync(drizzlePath);

	if (!result.hasDrizzleDir) {
		return result;
	}

	// Check journal
	const journalPath = join(drizzlePath, 'meta', '_journal.json');
	result.hasJournal = existsSync(journalPath);

	if (result.hasJournal) {
		const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
		result.journalEntryCount = journal.entries?.length || 0;
	}

	// Check SQL files
	const sqlFiles = readdirSync(drizzlePath).filter((f) => f.endsWith('.sql'));
	result.sqlFileCount = sqlFiles.length;

	// Check sync
	if (result.journalEntryCount !== result.sqlFileCount) {
		result.journalSynced = false;
		result.issues.push(
			`Journal has ${result.journalEntryCount} entries but ${result.sqlFileCount} SQL files`
		);
	}

	// Check table prefixes
	const expectedPrefix = result.moduleName;
	for (const sqlFile of sqlFiles) {
		const sql = readFileSync(join(drizzlePath, sqlFile), 'utf-8');
		const tableMatches = sql.matchAll(
			/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi
		);
		for (const match of tableMatches) {
			const tableName = match[1];
			if (!tableName.startsWith(expectedPrefix)) {
				result.tablePrefixCorrect = false;
				result.issues.push(`Table "${tableName}" doesn't have module prefix "${expectedPrefix}"`);
			}
		}
	}

	return result;
}

function auditAllModules(): void {
	const modulesPath = join(process.cwd(), 'modules');
	const modules = readdirSync(modulesPath, { withFileTypes: true })
		.filter((d) => d.isDirectory() && (d.name.startsWith('MoLOS-') || d.name === 'ai'))
		.map((d) => d.name);

	console.log(`Auditing ${modules.length} modules...\n`);

	const results: ModuleAuditResult[] = [];
	for (const moduleName of modules) {
		const modulePath = join(modulesPath, moduleName);
		results.push(auditModule(modulePath));
	}

	// Print results
	console.log('| Module | Drizzle | Journal | SQLs | Synced | Prefix | Issues |');
	console.log('|--------|---------|---------|------|--------|--------|--------|');

	for (const r of results) {
		const status = r.issues.length === 0 ? '✅' : '⚠️';
		console.log(
			`| ${r.moduleName} | ${r.hasDrizzleDir ? '✅' : '❌'} | ${r.hasJournal ? '✅' : '❌'} | ${r.sqlFileCount} | ${r.journalSynced ? '✅' : '❌'} | ${r.tablePrefixCorrect ? '✅' : '❌'} | ${r.issues.length} |`
		);

		if (r.issues.length > 0) {
			for (const issue of r.issues) {
				console.log(`  - ${issue}`);
			}
		}
	}
}

auditAllModules();
```

### Add npm script

```json
{
	"scripts": {
		"db:audit-modules": "tsx scripts/audit-module-migrations.ts"
	}
}
```

### Files to Create

- `scripts/audit-module-migrations.ts`

### Verification

- [x] Script runs without errors
- [x] Output is readable and actionable
- [x] All 11 modules are audited

---

## Task 3.2: Fix Module Migration Issues

**Status**: ✅ Completed
**Priority**: P1
**Estimated Time**: 4-8 hours (varies by issues found)

### Description

Based on the audit results from Task 3.1, fix any issues discovered.

### Common Issues and Fixes

#### Issue: Journal/SQL Desync

**Fix**:

1. Identify which SQL files are missing from journal
2. Add entries to `_journal.json` with appropriate timestamps
3. Or remove orphaned SQL files if they shouldn't exist

#### Issue: Incorrect Table Prefix

**Fix**:

1. Create new migration to rename tables
2. Update schema.ts to use correct prefix
3. Regenerate migrations

#### Issue: Missing Journal File

**Fix**:

1. Create `drizzle/meta/_journal.json`
2. Add entries for existing SQL files
3. Run `drizzle-kit generate` to verify

### Process

1. Run `bun run db:audit-modules`
2. Create a prioritized list of issues
3. Fix issues one module at a time
4. Re-run audit to verify fixes

### Issues Found and Fixed

1. **MoLOS-AI-Knowledge**: 3 missing tables (ab_tests, prompt_chains, usage_analytics) - Created manually
2. **MoLOS-Health**: 6 orphaned tables with wrong prefix (health*\* instead of MoLOS-Health*\*) - Dropped

### Verification

- [x] All modules pass audit
- [x] No journal/SQL desync
- [x] All table prefixes correct

---

## Task 3.3: Enhance Rollback System

**Status**: ✅ Completed
**Priority**: P1
**Estimated Time**: 4-6 hours

### Description

The current rollback system only handles CREATE TABLE and CREATE INDEX statements. Enhance it to support more migration types.

### Current Limitations

Location: `module-management/server/migration-manager.ts:38-58`

```typescript
function generateRollbackSql(migrationSql: string): string | null {
	// Only handles:
	// - CREATE TABLE → DROP TABLE
	// - CREATE INDEX → DROP INDEX
	// Does NOT handle:
	// - ALTER TABLE ADD COLUMN
	// - ALTER TABLE DROP COLUMN
	// - INSERT/UPDATE/DELETE data migrations
}
```

### Enhancement Options

#### Option A: Manual Down Migrations

Support `down.sql` files alongside migrations:

```
drizzle/
├── 0001_add_users_table.sql
├── 0001_add_users_table.down.sql  # Manual rollback
└── meta/
```

#### Option B: Enhanced Auto-Generation

Parse more SQL patterns:

- `ALTER TABLE ADD COLUMN` → `ALTER TABLE DROP COLUMN`
- `ALTER TABLE RENAME` → `ALTER TABLE RENAME` (reverse)

#### Option C: Snapshot-Based Rollback

Store table schema before migration, restore on rollback.

### Recommendation

**Option A** - Manual down migrations with Option B for simple cases.

### Implementation

```typescript
function generateRollbackSql(migrationSql: string, migrationPath: string): string | null {
	// Check for manual down migration first
	const downPath = migrationPath.replace('.sql', '.down.sql');
	if (existsSync(downPath)) {
		return readFileSync(downPath, 'utf-8');
	}

	// Auto-generate for simple cases
	const lines: string[] = [];

	// Existing CREATE TABLE/INDEX handling...

	// Add ALTER TABLE handling
	const alterColumnMatches = migrationSql.matchAll(
		/ALTER\s+TABLE\s+["']?(\w+)["']?\s+ADD\s+COLUMN\s+["']?(\w+)["']?\s+(\w+)/gi
	);
	for (const match of alterColumnMatches) {
		lines.push(`ALTER TABLE "${match[1]}" DROP COLUMN "${match[2]}";`);
	}

	return lines.length > 0 ? lines.join('\n') : null;
}
```

### Files to Modify

- `module-management/server/migration-manager.ts`

### Verification

- [x] Down migrations are used if present
- [x] Simple ALTER TABLE is auto-generated
- [x] Complex migrations require manual down file (warning logged)

---

## Task 3.4: Add Module Migration Versioning

**Status**: Pending (Optional)
**Priority**: P2
**Estimated Time**: 2-3 hours

### Description

Add version compatibility checking between modules and core.

### Implementation

Add to module manifest:

```yaml
# manifest.yaml
compatibility:
  coreMinVersion: '1.2.0' # Minimum core version required
  coreMaxVersion: '2.0.0' # Maximum core version (optional)
  dependencies:
    - moduleId: 'MoLOS-Goals'
      minVersion: '1.0.0'
```

Create validation function:

```typescript
function checkModuleCompatibility(module: Module): { compatible: boolean; issues: string[] } {
	const issues: string[] = [];

	// Check core version
	if (module.compatibility?.coreMinVersion) {
		const coreVersion = getCoreVersion();
		if (compareVersions(coreVersion, module.compatibility.coreMinVersion) < 0) {
			issues.push(
				`Module requires core v${module.compatibility.coreMinVersion}+, current is v${coreVersion}`
			);
		}
	}

	// Check dependencies
	// ...

	return { compatible: issues.length === 0, issues };
}
```

### Files to Create/Modify

- Module `manifest.yaml` files
- New validation utility

### Verification

- [ ] Version check runs before migration
- [ ] Incompatible modules are rejected with clear message

---

## Phase 3 Completion Checklist

- [x] Task 3.1: Audit script created and run
- [x] Task 3.2: All module issues fixed
- [x] Task 3.3: Rollback system enhanced
- [ ] Task 3.4: Version compatibility added (optional - deferred)
- [x] All 11 modules audited and fixed
- [x] Documentation updated

---

## Notes

- Task 3.2 may reveal issues requiring database migrations
- Prioritize fixing modules with the most users first
- Consider creating a template for "ideal" module migration structure
