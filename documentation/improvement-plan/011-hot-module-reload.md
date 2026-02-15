# Task 011: Hot Reload for External Modules

**Priority**: P3 (Low)
**Effort**: Medium
**Impact**: Low

## Problem

During module development:
- Must restart dev server to see module changes
- No hot reload for module config changes
- Slow development cycle

## Solution

Implement hot reload for external modules during development.

## Implementation

### 1. File Watcher for Modules

```typescript
// module-management/server/module-watcher.ts
import { watch } from 'chokidar';
import { ModuleManager } from './module-manager';
import { ModuleLinker } from './module-linker';

export class ModuleWatcher {
  private watcher: FSWatcher | null = null;

  constructor(
    private linker: ModuleLinker,
    private onChange: (moduleId: string, event: string) => void
  ) {}

  start(externalModulesDir: string): void {
    if (process.env.NODE_ENV === 'production') {
      moduleLogger.warn('Module watcher disabled in production');
      return;
    }

    this.watcher = watch(externalModulesDir, {
      ignored: /(^|[\/\\])\..|(node_modules)/,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', (path) => this.handleChange(path, 'add'))
      .on('change', (path) => this.handleChange(path, 'change'))
      .on('unlink', (path) => this.handleChange(path, 'unlink'));

    moduleLogger.info('Module watcher started');
  }

  private async handleChange(filePath: string, event: string): Promise<void> {
    // Extract module ID from path
    const moduleId = this.extractModuleId(filePath);
    if (!moduleId) return;

    // Determine what changed
    const changeType = this.getChangeType(filePath);

    moduleLogger.info({ moduleId, changeType, event }, 'Module file changed');

    // Handle based on change type
    switch (changeType) {
      case 'config':
        await this.handleConfigChange(moduleId);
        break;
      case 'manifest':
        await this.handleManifestChange(moduleId);
        break;
      case 'route':
        // Routes are auto-reloaded by SvelteKit
        break;
      case 'migration':
        // Warn about migration changes
        moduleLogger.warn(
          { moduleId },
          'Migration changed - manual restart may be needed'
        );
        break;
    }

    this.onChange(moduleId, changeType);
  }

  private extractModuleId(filePath: string): string | null {
    const match = filePath.match(/external_modules[\/\\]([^\/\\]+)/);
    return match ? match[1] : null;
  }

  private getChangeType(filePath: string): string {
    if (filePath.includes('config.ts')) return 'config';
    if (filePath.includes('manifest.yaml')) return 'manifest';
    if (filePath.includes('routes/')) return 'route';
    if (filePath.includes('drizzle/')) return 'migration';
    return 'other';
  }

  private async handleConfigChange(moduleId: string): Promise<void> {
    // Re-link config
    await this.linker.linkModule(moduleId);

    // Notify Vite to reload
    this.notifyVite(moduleId);
  }

  private async handleManifestChange(moduleId: string): Promise<void> {
    // Validate new manifest
    const validation = await ModuleManager.validateModule(moduleId);

    if (!validation.valid) {
      moduleLogger.error({ moduleId, errors: validation.errors }, 'Invalid manifest');
      return;
    }

    // Update module metadata
    await ModuleManager.updateMetadata(moduleId, validation.manifest);
  }

  private notifyVite(moduleId: string): void {
    // Touch a file to trigger Vite HMR
    const touchFile = path.join(process.cwd(), '.molos', 'trigger', `${moduleId}.touch`);
    fs.ensureDirSync(path.dirname(touchFile));
    fs.writeFileSync(touchFile, Date.now().toString());
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
```

### 2. Vite Plugin for HMR

```typescript
// module-management/vite-hmr-plugin.ts
import type { Plugin } from 'vite';

export function molosHmrPlugin(): Plugin {
  return {
    name: 'molos-hmr',
    configureServer(server) {
      // Watch for trigger files
      const triggerDir = path.join(process.cwd(), '.molos', 'trigger');

      if (fs.existsSync(triggerDir)) {
        const watcher = watch(triggerDir, {
          ignoreInitial: true,
        });

        watcher.on('add', (file) => {
          const moduleId = path.basename(file, '.touch');

          // Invalidate module config
          const moduleConfigPath = `src/lib/config/external_modules/${moduleId}.ts`;
          const module = server.moduleGraph.getModuleById(moduleConfigPath);

          if (module) {
            server.moduleGraph.invalidateModule(module);
            server.ws.send({
              type: 'full-reload',
              path: `*`,
            });
          }
        });
      }

      // Handle custom HMR for modules
      server.ws.on('molos:module-changed', (data: { moduleId: string }) => {
        server.ws.send({
          type: 'custom',
          event: 'molos:reload-module',
          data,
        });
      });
    },
  };
}
```

### 3. Client-Side HMR Handler

```typescript
// src/lib/client/module-hmr.ts
if (import.meta.hot) {
  import.meta.hot.on('molos:reload-module', (data: { moduleId: string }) => {
    console.log(`[HMR] Module ${data.moduleId} changed, reloading...`);

    // Reload navigation
    import('$lib/config').then((config) => {
      config.invalidateModules?.();
    });

    // Show toast notification
    showToast(`Module ${data.moduleId} updated`);
  });
}
```

### 4. Development Server Integration

```typescript
// src/hooks.server.ts
import { ModuleWatcher } from '../module-management/server/module-watcher';

let moduleWatcher: ModuleWatcher | null = null;

if (!building && dev) {
  // Start module watcher
  moduleWatcher = new ModuleWatcher(linker, (moduleId, changeType) => {
    logger.info({ moduleId, changeType }, 'Module hot-reloaded');
  });
  moduleWatcher.start('external_modules');
}
```

## What Gets Hot-Reloaded

| File Type | Hot Reload? | Notes |
|-----------|-------------|-------|
| `config.ts` | Yes | Config changes reflected |
| `manifest.yaml` | Yes | Metadata updated |
| `routes/**/*.svelte` | Yes | Via SvelteKit HMR |
| `routes/**/*.ts` | Yes | Via Vite HMR |
| `lib/**/*.ts` | Yes | Via Vite HMR |
| `drizzle/*.sql` | No | Requires manual restart |

## Limitations

- **Database schema changes** require manual restart
- **New module installation** requires manual restart
- **Module removal** requires manual restart
- Production builds don't include watcher

## Configuration

```bash
# .env.development
MOLOS_MODULE_WATCH=true
MOLOS_MODULE_WATCH_DEBOUNCE=500  # ms
```

## Benefits

| Before | After |
|--------|-------|
| Restart for every change | Instant updates |
| Slow dev cycle | Fast iteration |
| No feedback | Console shows what changed |

## Files to Create

- `module-management/server/module-watcher.ts`
- `module-management/vite-hmr-plugin.ts`
- `src/lib/client/module-hmr.ts`

## Recommendation

This is a nice-to-have. Consider implementing after core stability tasks are done.
