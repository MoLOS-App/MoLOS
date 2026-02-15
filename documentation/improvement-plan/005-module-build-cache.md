# Task 005: Module Build Cache (Avoid DB Reads in Vite)

**Priority**: P1 (High)
**Effort**: Medium
**Impact**: Medium

## Problem

`vite.config.ts` reads the database during configuration to determine which modules are active:

```typescript
function getActiveModulesFromDb(): Set<string> | null {
  const db = new Database(dbPath);
  const rows = db.prepare('select id, status from settings_external_modules').all();
  // ...
}
```

Issues:
- Build tooling should not depend on runtime database
- Creates non-deterministic builds
- Can fail if DB is locked/corrupted
- Adds latency to every `vite` invocation
- Doesn't work well with CI/CD

## Solution

Use a cache file that's written at runtime and read at build time:

```
.molos/
├── active-modules.json     # List of active module IDs
├── module-state.json       # Full state with statuses
└── link-state.json         # Already exists - symlink state
```

## Implementation

### 1. Define Cache Types

```typescript
// module-management/config/cache-types.ts
export interface ModuleBuildCache {
  version: 1;  // Cache format version
  computedAt: string;
  activeModules: string[];
  disabledModules: string[];
  erroredModules: Array<{ id: string; error: string }>;
}

export interface ModuleStateCache extends ModuleBuildCache {
  modules: Array<{
    id: string;
    name: string;
    version: string;
    status: ModuleStatus;
    lastError?: string;
    lastInitializedAt?: string;
  }>;
}
```

### 2. Create Cache Manager

```typescript
// module-management/server/module-cache.ts
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ModuleBuildCache, ModuleStateCache } from './config/cache-types';

const CACHE_DIR = '.molos';
const BUILD_CACHE_FILE = 'active-modules.json';
const STATE_CACHE_FILE = 'module-state.json';

export class ModuleCache {
  private cacheDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.cacheDir = join(baseDir, CACHE_DIR);
  }

  // Read build cache (used by vite.config.ts)
  readBuildCache(): ModuleBuildCache | null {
    try {
      const file = join(this.cacheDir, BUILD_CACHE_FILE);
      if (!existsSync(file)) return null;

      const content = readFileSync(file, 'utf-8');
      const cache = JSON.parse(content) as ModuleBuildCache;

      // Validate version
      if (cache.version !== 1) {
        logger.warn('Build cache version mismatch, ignoring');
        return null;
      }

      return cache;
    } catch (error) {
      logger.warn({ error }, 'Failed to read build cache');
      return null;
    }
  }

  // Write build cache (called after module state changes)
  writeBuildCache(cache: Omit<ModuleBuildCache, 'version' | 'computedAt'>): void {
    const fullCache: ModuleBuildCache = {
      version: 1,
      computedAt: new Date().toISOString(),
      ...cache,
    };

    ensureDirSync(this.cacheDir);
    writeFileSync(
      join(this.cacheDir, BUILD_CACHE_FILE),
      JSON.stringify(fullCache, null, 2)
    );
  }

  // Update cache when module status changes
  updateModuleStatus(moduleId: string, status: ModuleStatus, error?: string): void {
    const current = this.readBuildCache() || {
      activeModules: [],
      disabledModules: [],
      erroredModules: [],
    };

    // Remove from all lists first
    current.activeModules = current.activeModules.filter(id => id !== moduleId);
    current.disabledModules = current.disabledModules.filter(id => id !== moduleId);
    current.erroredModules = current.erroredModules.filter(m => m.id !== moduleId);

    // Add to appropriate list
    if (status === 'active') {
      current.activeModules.push(moduleId);
    } else if (status === 'disabled') {
      current.disabledModules.push(moduleId);
    } else if (status.startsWith('error_')) {
      current.erroredModules.push({ id: moduleId, error: error || 'Unknown error' });
    }

    this.writeBuildCache(current);
  }
}
```

### 3. Update ModuleManager to Write Cache

```typescript
// module-management/server/module-manager.ts
import { ModuleCache } from './module-cache';

export class ModuleManager {
  private static cache = new ModuleCache();

  static async init(): Promise<void> {
    // ... existing init logic ...

    // Write cache after init
    const modules = await this.getAllModules();
    this.cache.writeBuildCache({
      activeModules: modules.filter(m => m.status === 'active').map(m => m.id),
      disabledModules: modules.filter(m => m.status === 'disabled').map(m => m.id),
      erroredModules: modules
        .filter(m => m.status.startsWith('error_'))
        .map(m => ({ id: m.id, error: m.lastError || 'Unknown' })),
    });
  }

  static async setModuleStatus(id: string, status: ModuleStatus, error?: string): Promise<void> {
    // ... existing logic ...

    // Update cache immediately
    this.cache.updateModuleStatus(id, status, error);
  }
}
```

### 4. Update vite.config.ts to Use Cache

```typescript
// vite.config.ts - Replace DB read with cache read
function getActiveModules(): Set<string> {
  const cache = new ModuleCache().readBuildCache();

  if (cache) {
    console.log(`[Vite] Using cached module list (${cache.activeModules.length} active)`);
    return new Set(cache.activeModules);
  }

  // Fallback: link all modules if no cache exists
  // (First run, or cache deleted)
  console.log('[Vite] No module cache found, linking all modules');
  const modules = readdirSync(EXTERNAL_DIR)
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  return new Set(modules);
}
```

### 5. Add Cache to .gitignore

```gitignore
# MoLOS cache
.molos/
```

### 6. Regenerate Cache on App Start

```typescript
// src/hooks.server.ts
if (!building) {
  await setupDatabase();

  // Regenerate cache on startup
  await ModuleManager.init();  // This now writes the cache

  // Now vite can use the cache on next restart
}
```

## Cache File Example

```json
// .molos/active-modules.json
{
  "version": 1,
  "computedAt": "2024-01-15T10:30:00.000Z",
  "activeModules": ["MoLOS-Tasks", "MoLOS-Analytics"],
  "disabledModules": ["MoLOS-Deprecated"],
  "erroredModules": [
    { "id": "MoLOS-Broken", "error": "Missing config.ts" }
  ]
}
```

## Benefits

| Before | After |
|--------|-------|
| Vite reads DB on every config load | Vite reads JSON file |
| ~50-100ms DB query per vite call | ~1ms file read |
| Can fail if DB locked | Always works |
| CI/CD needs running DB | CI/CD just needs cache file |

## Files to Change

- `module-management/config/cache-types.ts` - New
- `module-management/server/module-cache.ts` - New
- `module-management/server/module-manager.ts` - Write cache on changes
- `vite.config.ts` - Read from cache instead of DB
- `.gitignore` - Add .molos/

## Edge Cases

1. **First run (no cache)**: Link all modules, cache written after init
2. **Cache corrupted**: Fall back to linking all modules
3. **Manual module add**: Run `molos modules:refresh` or restart app
4. **CI/CD**: Commit cache file or run init first
