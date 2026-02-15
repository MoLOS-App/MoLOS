# Task 004: Improve Startup Resilience

**Priority**: P1 (High)
**Effort**: Medium
**Impact**: High

## Problem

`hooks.server.ts` does critical initialization synchronously:

```typescript
if (!building) {
  loadEnv();
  await setupDatabase();      // Can block indefinitely
  await ModuleManager.init(); // Can fail entire app
}
```

Issues:
- If DB migration fails, app crashes
- If a module fails to init, app crashes
- No timeout protection
- No graceful degradation
- App won't start until ALL modules load

## Solution

Make startup more resilient with:
1. Timeouts
2. Parallel initialization where possible
3. Graceful degradation (app starts, modules load async)
4. Better error handling

## Implementation

### 1. Create Startup Orchestrator

```typescript
// src/lib/server/startup.ts
import { logger } from './logger';

export interface StartupResult {
  success: boolean;
  phase: string;
  duration: number;
  error?: string;
}

export class StartupOrchestrator {
  private results: StartupResult[] = [];

  async runPhase(
    name: string,
    fn: () => Promise<void>,
    options: {
      timeout?: number;
      critical?: boolean;  // If true, failure stops startup
    } = {}
  ): Promise<StartupResult> {
    const start = Date.now();
    const { timeout = 30000, critical = false } = options;

    try {
      const result = await Promise.race([
        fn(),
        this.createTimeout(name, timeout),
      ]);

      return this.recordSuccess(name, start);
    } catch (error) {
      const result = this.recordFailure(name, start, error);

      if (critical) {
        throw error;
      }

      return result;
    }
  }

  private createTimeout(name: string, ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms);
    });
  }

  private recordSuccess(phase: string, start: number): StartupResult {
    const result = { success: true, phase, duration: Date.now() - start };
    this.results.push(result);
    logger.info({ phase, duration: result.duration }, 'Startup phase completed');
    return result;
  }

  private recordFailure(phase: string, start: number, error: unknown): StartupResult {
    const result = {
      success: false,
      phase,
      duration: Date.now() - start,
      error: String(error),
    };
    this.results.push(result);
    logger.error({ phase, error: result.error }, 'Startup phase failed');
    return result;
  }

  getResults(): StartupResult[] {
    return this.results;
  }
}
```

### 2. Refactor hooks.server.ts

```typescript
// src/hooks.server.ts
import { StartupOrchestrator } from '$lib/server/startup';

const orchestrator = new StartupOrchestrator();

if (!building) {
  // Critical phases - must succeed
  await orchestrator.runPhase('env', loadEnv, { critical: true, timeout: 5000 });
  await orchestrator.runPhase('database', setupDatabase, { critical: true, timeout: 60000 });

  // Non-critical phases - app can start without
  await orchestrator.runPhase('modules', () => ModuleManager.init(), {
    timeout: 120000,  // 2 minutes max
    critical: false,  // Don't crash app on module failure
  });

  // Log startup summary
  const failed = orchestrator.getResults().filter(r => !r.success);
  if (failed.length > 0) {
    logger.warn({ failedPhases: failed.map(f => f.phase) }, 'Startup completed with failures');
  } else {
    logger.info('Startup completed successfully');
  }
}
```

### 3. Add Async Module Loading (Optional Enhancement)

For even better resilience, load modules asynchronously after app starts:

```typescript
// src/hooks.server.ts
if (!building) {
  await orchestrator.runPhase('env', loadEnv, { critical: true });
  await orchestrator.runPhase('database', setupDatabase, { critical: true });

  // Start loading modules in background
  ModuleManager.init().catch(err => {
    logger.error({ err }, 'Background module initialization failed');
  });

  logger.info('App ready, modules loading in background');
}
```

### 4. Add Startup Status Endpoint

```typescript
// src/routes/api/startup/+server.ts
export const GET: RequestHandler = async () => {
  return json({
    completed: startupOrchestrator.getResults(),
    modulesReady: await ModuleManager.isReady(),
  });
};
```

### 5. Add Retry Logic for Modules

```typescript
// module-management/server/module-manager.ts
async initModule(moduleId: string, retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await this.doInit(moduleId);
      return;
    } catch (error) {
      if (attempt === retries) {
        logger.error({ moduleId, attempt, error }, 'Module init failed, disabling');
        await this.markDisabled(moduleId, error);
        return;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      logger.warn({ moduleId, attempt, delay }, 'Module init failed, retrying');
      await sleep(delay);
    }
  }
}
```

## Benefits

| Before | After |
|--------|-------|
| App crashes on any init failure | App starts, failed components logged |
| No timeout protection | Each phase has timeout |
| Sequential, slow startup | Parallel where possible |
| No visibility into startup | Clear logging of each phase |
| Module failure = app failure | Module failure = degraded mode |

## Files to Change

- `src/hooks.server.ts` - Major refactor
- `src/lib/server/startup.ts` - New
- `module-management/server/module-manager.ts` - Add retry logic
- `src/routes/api/startup/+server.ts` - New (optional)

## Configuration

```bash
STARTUP_TIMEOUT_MS=120000     # Overall startup timeout
MODULE_INIT_TIMEOUT_MS=30000  # Per-module timeout
MODULE_INIT_RETRIES=3         # Retry attempts per module
```
