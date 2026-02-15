# Task 007: Integration Tests for Module System

**Priority**: P1 (High)
**Effort**: High
**Impact**: High

## Problem

The module system has minimal test coverage:
- No tests for module lifecycle (install → init → disable → uninstall)
- No tests for symlink operations
- No tests for error recovery
- No tests for validation logic
- Module-related bugs are found manually

## Solution

Create comprehensive integration tests for the module system using Vitest.

## Test Categories

### 1. Module Lifecycle Tests

```typescript
// tests/integration/module-lifecycle.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ModuleManager } from '$lib/server/modules';
import { createTestModule, cleanupTestModules } from './helpers';

describe('Module Lifecycle', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestModules();
  });

  it('should install a valid module', async () => {
    const modulePath = await createTestModule({
      id: 'test-module',
      name: 'Test Module',
      version: '1.0.0',
    });

    const result = await ModuleManager.install(modulePath);

    expect(result.status).toBe('active');
    expect(result.module.id).toBe('test-module');
  });

  it('should reject invalid manifest', async () => {
    const modulePath = await createTestModule({
      id: 'invalid!id', // Invalid characters
      name: 'Test',
      version: '1.0.0',
    });

    await expect(ModuleManager.install(modulePath))
      .rejects.toThrow('Module ID must contain only alphanumeric');
  });

  it('should disable module on error', async () => {
    const modulePath = await createTestModule({
      id: 'failing-module',
      name: 'Failing',
      version: '1.0.0',
      // Missing config.ts intentionally
    }, { includeConfig: false });

    const result = await ModuleManager.install(modulePath);

    expect(result.status).toBe('error_config');
  });

  it('should cleanup symlinks on uninstall', async () => {
    const modulePath = await createTestModule({ id: 'cleanup-test', name: 'Cleanup', version: '1.0.0' });
    await ModuleManager.install(modulePath);

    await ModuleManager.uninstall('cleanup-test');

    // Verify symlinks removed
    expect(existsSync('src/lib/config/external_modules/cleanup-test.ts')).toBe(false);
    expect(existsSync('src/routes/ui/(modules)/(external_modules)/cleanup-test')).toBe(false);
  });
});
```

### 2. Symlink Tests

```typescript
// tests/integration/symlink-operations.test.ts
import { describe, it, expect } from 'vitest';
import { ModuleLinker } from '$lib/server/modules';
import { createTestModule, getSymlinkPaths } from './helpers';

describe('Symlink Operations', () => {
  it('should create all required symlinks', async () => {
    const modulePath = await createTestModule({
      id: 'symlink-test',
      name: 'Symlink Test',
      version: '1.0.0',
    }, {
      withRoutes: true,
      withStores: true,
      withComponents: true,
    });

    const linker = new ModuleLinker();
    await linker.linkModule('symlink-test', modulePath);

    const symlinks = getSymlinkPaths('symlink-test');

    expect(symlinks.config).toBeValidSymlink();
    expect(symlinks.uiRoutes).toBeValidSymlink();
    expect(symlinks.apiRoutes).toBeValidSymlink();
    expect(symlinks.stores).toBeValidSymlink();
    expect(symlinks.components).toBeValidSymlink();
  });

  it('should handle partial module (missing optional dirs)', async () => {
    const modulePath = await createTestModule({
      id: 'minimal-module',
      name: 'Minimal',
      version: '1.0.0',
    }, {
      withRoutes: false,
      withStores: false,
      withComponents: false,
    });

    const linker = new ModuleLinker();
    const result = await linker.linkModule('minimal-module', modulePath);

    expect(result.success).toBe(true);
    // Only config symlink should exist
    expect(getSymlinkPaths('minimal-module').config).toBeValidSymlink();
  });

  it('should cleanup all symlinks on unlink', async () => {
    const modulePath = await createTestModule({ id: 'unlink-test', name: 'Unlink', version: '1.0.0' });
    const linker = new ModuleLinker();
    await linker.linkModule('unlink-test', modulePath);

    await linker.unlinkModule('unlink-test');

    const symlinks = getSymlinkPaths('unlink-test');
    Object.values(symlinks).forEach(path => {
      expect(existsSync(path)).toBe(false);
    });
  });

  it('should handle broken symlinks gracefully', async () => {
    // Create symlink to non-existent path
    createBrokenSymlink('broken-module');

    const linker = new ModuleLinker();
    linker.cleanupBrokenSymlinks();

    expect(existsSync(getSymlinkPaths('broken-module').config)).toBe(false);
  });
});
```

### 3. Validation Tests

```typescript
// tests/integration/module-validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateModuleManifest, validateModuleConfig } from '$lib/config/module-types';

describe('Module Validation', () => {
  describe('Manifest Validation', () => {
    it('should accept valid manifest', () => {
      const result = validateModuleManifest({
        id: 'valid-module',
        name: 'Valid Module',
        version: '1.0.0',
      });

      expect(result.valid).toBe(true);
    });

    it('should reject missing required fields', () => {
      const result = validateModuleManifest({
        id: 'test',
        // missing name and version
      });

      expect(result.valid).toBe(false);
      expect(result.error.issues).toHaveLength(2);
    });

    it('should reject invalid version format', () => {
      const result = validateModuleManifest({
        id: 'test',
        name: 'Test',
        version: '1', // Not semver
      });

      expect(result.valid).toBe(false);
      expect(result.error.issues[0].message).toContain('semver');
    });

    it('should reject invalid module ID characters', () => {
      const result = validateModuleManifest({
        id: 'test!@#module',
        name: 'Test',
        version: '1.0.0',
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Config Validation', () => {
    it('should require /ui/ prefix in href', () => {
      const result = validateModuleConfig({
        id: 'test',
        name: 'Test',
        href: '/test', // Missing /ui/ prefix
        icon: 'test',
        navigation: [],
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Import Validation', () => {
    it('should detect missing exports', async () => {
      const modulePath = createModuleWithBadImport();

      const result = await validateModuleImports('bad-import', modulePath);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('is not exported');
    });

    it('should accept valid imports', async () => {
      const modulePath = createModuleWithValidImports();

      const result = await validateModuleImports('good-import', modulePath);

      expect(result.valid).toBe(true);
    });
  });
});
```

### 4. Error Recovery Tests

```typescript
// tests/integration/error-recovery.test.ts
import { describe, it, expect } from 'vitest';
import { ModuleManager } from '$lib/server/modules';

describe('Error Recovery', () => {
  it('should recover from migration error', async () => {
    const modulePath = await createTestModule({
      id: 'bad-migration',
      name: 'Bad Migration',
      version: '1.0.0',
    }, {
      withBadMigration: true,
    });

    const result = await ModuleManager.install(modulePath);

    expect(result.status).toBe('error_migration');
    expect(result.lastError).toContain('SQL');

    // Should be able to retry after fix
    await fixMigration(modulePath);
    const retry = await ModuleManager.retry('bad-migration');

    expect(retry.status).toBe('active');
  });

  it('should auto-disable after max retries', async () => {
    const modulePath = await createTestModule({
      id: 'always-fails',
      name: 'Always Fails',
      version: '1.0.0',
    }, {
      alwaysFailInit: true,
    });

    await ModuleManager.install(modulePath);

    // Should have attempted retries
    const module = await ModuleManager.getModule('always-fails');
    expect(module.retryCount).toBeGreaterThan(1);
    expect(module.status).toBe('disabled');
  });

  it('should mark build errors correctly', async () => {
    const modulePath = await createTestModule({
      id: 'build-error',
      name: 'Build Error',
      version: '1.0.0',
    }, {
      withTypeScriptError: true,
    });

    const result = await ModuleManager.install(modulePath);

    expect(result.status).toBe('error_build');
  });
});
```

### 5. Test Helpers

```typescript
// tests/integration/helpers.ts
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import yaml from 'yaml';

const TEST_MODULES_DIR = '.test-modules';

export interface TestModuleOptions {
  includeConfig?: boolean;
  withRoutes?: boolean;
  withStores?: boolean;
  withComponents?: boolean;
  withBadMigration?: boolean;
  alwaysFailInit?: boolean;
  withTypeScriptError?: boolean;
}

export async function createTestModule(
  manifest: { id: string; name: string; version: string },
  options: TestModuleOptions = {}
): Promise<string> {
  const modulePath = join(TEST_MODULES_DIR, manifest.id);

  // Clean up if exists
  rmSync(modulePath, { recursive: true, force: true });
  mkdirSync(modulePath, { recursive: true });

  // Write manifest
  writeFileSync(
    join(modulePath, 'manifest.yaml'),
    yaml.stringify(manifest)
  );

  // Write config
  if (options.includeConfig !== false) {
    writeFileSync(
      join(modulePath, 'config.ts'),
      `
        export const moduleConfig = {
          id: '${manifest.id}',
          name: '${manifest.name}',
          href: '/ui/${manifest.id}',
          icon: 'test',
          navigation: [],
        };
      `
    );
  }

  // Add optional directories
  if (options.withRoutes) {
    mkdirSync(join(modulePath, 'routes/ui', manifest.id), { recursive: true });
    writeFileSync(
      join(modulePath, 'routes/ui', manifest.id, '+page.svelte'),
      '<h1>Test Module</h1>'
    );
  }

  if (options.withStores) {
    mkdirSync(join(modulePath, 'lib/stores'), { recursive: true });
    writeFileSync(
      join(modulePath, 'lib/stores/index.ts'),
      `export const testStore = writable('test');`
    );
  }

  return modulePath;
}

export function cleanupTestModules(): void {
  rmSync(TEST_MODULES_DIR, { recursive: true, force: true });
}

export function getSymlinkPaths(moduleId: string) {
  return {
    config: `src/lib/config/external_modules/${moduleId}.ts`,
    uiRoutes: `src/routes/ui/(modules)/(external_modules)/${moduleId}`,
    apiRoutes: `src/routes/api/(external_modules)/${moduleId}`,
    stores: `src/lib/stores/external_modules/${moduleId}`,
    components: `src/lib/components/external_modules/${moduleId}`,
  };
}
```

## Test Configuration

```typescript
// vitest.config.integration.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30000,
    setupFiles: ['tests/integration/setup.ts'],
    teardown: 'tests/integration/teardown.ts',
  },
});
```

## Running Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npm run test:integration module-lifecycle

# Run with coverage
npm run test:integration -- --coverage
```

## Files to Create

```
tests/
├── integration/
│   ├── setup.ts
│   ├── teardown.ts
│   ├── helpers.ts
│   ├── module-lifecycle.test.ts
│   ├── symlink-operations.test.ts
│   ├── module-validation.test.ts
│   └── error-recovery.test.ts
└── vitest.config.integration.ts
```

## Success Criteria

- [ ] All module lifecycle stages tested
- [ ] Symlink operations tested
- [ ] All validation types tested
- [ ] Error recovery paths tested
- [ ] 80%+ coverage on module-management code
