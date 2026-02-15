# Task 006: Module Isolation & Sandboxing

**Priority**: P1 (High)
**Effort**: High
**Impact**: High

## Problem

External modules run in the same process as the core application:
- A buggy module can crash the entire app
- Modules have full access to the filesystem
- No memory/CPU limits per module
- Security risk from untrusted modules

## Solution

Implement module isolation using Node.js Worker Threads. Each module's server-side code runs in a separate thread with limited capabilities.

## Implementation

### 1. Module Worker Architecture

```
┌─────────────────────────────────────────────────┐
│                  Main Process                    │
│  ┌─────────────┐  ┌──────────────────────────┐ │
│  │   SvelteKit │  │     ModuleManager        │ │
│  │   Server    │  │  ┌─────┐ ┌─────┐ ┌─────┐│ │
│  │             │  │  │ M1  │ │ M2  │ │ M3  ││ │
│  └─────────────┘  │  │Worker│ │Worker│ │Worker││ │
│                   │  └─────┘ └─────┘ └─────┘│ │
│                   └──────────────────────────┘ │
└─────────────────────────────────────────────────┘
         │              │              │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ Module 1│    │ Module 2│    │ Module 3│
    │(Isolated)│   │(Isolated)│   │(Isolated)│
    └─────────┘    └─────────┘    └─────────┘
```

### 2. Module Worker Definition

```typescript
// module-management/server/module-worker.ts
import { Worker, MessageChannel } from 'worker_threads';
import { join } from 'path';
import type { ModuleConfig, ModuleManifest } from '../config/module-types';

export interface ModuleWorkerMessage {
  type: 'init' | 'execute' | 'shutdown' | 'health';
  payload?: any;
}

export interface ModuleWorkerResponse {
  type: 'ready' | 'result' | 'error' | 'health';
  payload?: any;
  error?: string;
}

export class ModuleWorker {
  private worker: Worker | null = null;
  private ready = false;
  private messageHandlers = new Map<string, (response: ModuleWorkerResponse) => void>();

  constructor(
    private moduleId: string,
    private modulePath: string
  ) {}

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.worker = new Worker(join(__dirname, 'worker-runtime.js'), {
        workerData: {
          moduleId: this.moduleId,
          modulePath: this.modulePath,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: 128,  // 128MB memory limit
          maxYoungGenerationSizeMb: 32,
        },
      });

      this.worker.on('message', (response: ModuleWorkerResponse) => {
        if (response.type === 'ready') {
          this.ready = true;
          resolve();
        } else {
          // Handle pending requests
          const handler = this.messageHandlers.get(response.type);
          if (handler) {
            handler(response);
            this.messageHandlers.delete(response.type);
          }
        }
      });

      this.worker.on('error', (error) => {
        logger.error({ moduleId: this.moduleId, error }, 'Worker error');
        this.ready = false;
        reject(error);
      });

      this.worker.on('exit', (code) => {
        if (code !== 0) {
          logger.warn({ moduleId: this.moduleId, code }, 'Worker exited unexpectedly');
        }
        this.ready = false;
      });

      // Timeout for startup
      setTimeout(() => {
        if (!this.ready) {
          reject(new Error(`Module ${this.moduleId} startup timeout`));
        }
      }, 10000);
    });
  }

  async execute<T>(fn: string, args: any[]): Promise<T> {
    if (!this.ready || !this.worker) {
      throw new Error(`Module ${this.moduleId} worker not ready`);
    }

    return new Promise((resolve, reject) => {
      const messageId = crypto.randomUUID();

      this.messageHandlers.set('result', (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.payload as T);
        }
      });

      this.worker!.postMessage({
        type: 'execute',
        payload: { fn, args, messageId },
      } as ModuleWorkerMessage);

      // Timeout
      setTimeout(() => {
        this.messageHandlers.delete('result');
        reject(new Error(`Module ${this.moduleId} execution timeout`));
      }, 30000);
    });
  }

  async shutdown(): Promise<void> {
    if (this.worker) {
      this.worker.postMessage({ type: 'shutdown' });
      await this.worker.terminate();
      this.worker = null;
      this.ready = false;
    }
  }

  isReady(): boolean {
    return this.ready;
  }
}
```

### 3. Worker Runtime

```typescript
// module-management/server/worker-runtime.js
const { workerData, parentPort } = require('worker_threads');
const { join } = require('path');

// Restricted globals - modules can't access these
const restrictedGlobals = ['process', 'require', 'eval', 'Function'];

async function init() {
  const { moduleId, modulePath } = workerData;

  try {
    // Load module in isolated context
    const moduleConfig = require(join(modulePath, 'config.js'));

    // Register allowed functions
    const allowedFunctions = moduleConfig.exposedFunctions || [];

    parentPort.postMessage({ type: 'ready', payload: { moduleId, functions: allowedFunctions } });
  } catch (error) {
    parentPort.postMessage({ type: 'error', error: error.message });
  }
}

parentPort.on('message', async (message) => {
  if (message.type === 'execute') {
    try {
      const { fn, args } = message.payload;
      // Execute in sandboxed context
      const result = await executeSandboxed(fn, args);
      parentPort.postMessage({ type: 'result', payload: result });
    } catch (error) {
      parentPort.postMessage({ type: 'result', error: error.message });
    }
  } else if (message.type === 'shutdown') {
    process.exit(0);
  }
});

init();
```

### 4. Update ModuleManager

```typescript
// module-management/server/module-manager.ts
export class ModuleManager {
  private static workers = new Map<string, ModuleWorker>();

  static async initModule(moduleId: string): Promise<void> {
    const modulePath = join(EXTERNAL_DIR, moduleId);

    // Create worker for this module
    const worker = new ModuleWorker(moduleId, modulePath);
    await worker.start();

    this.workers.set(moduleId, worker);
  }

  static async executeModuleFunction<T>(
    moduleId: string,
    fn: string,
    args: any[]
  ): Promise<T> {
    const worker = this.workers.get(moduleId);
    if (!worker || !worker.isReady()) {
      throw new Error(`Module ${moduleId} not available`);
    }

    return worker.execute<T>(fn, args);
  }

  static async shutdownModule(moduleId: string): Promise<void> {
    const worker = this.workers.get(moduleId);
    if (worker) {
      await worker.shutdown();
      this.workers.delete(moduleId);
    }
  }
}
```

### 5. Module Config Extension

```typescript
// Modules can now expose functions to be called safely
// external_modules/MyModule/config.ts
export const moduleConfig: ModuleConfig = {
  id: 'my-module',
  name: 'My Module',
  // ... standard config ...

  // NEW: Exposed functions that can be called via worker
  exposedFunctions: ['processData', 'generateReport'],
};

// These functions are defined in lib/server/module-api.ts
export async function processData(input: string): Promise<string> {
  // This runs in isolated worker
  return input.toUpperCase();
}
```

## Scope of Isolation

| Component | Isolated? | Notes |
|-----------|-----------|-------|
| Server-side functions | Yes | Run in worker thread |
| Route handlers | Partial | Request routed through main, handler in worker |
| UI Components | No | Svelte components run in browser |
| Database access | No | Workers use shared DB connection |
| File system | Limited | Workers have restricted fs access |

## Fallback Mode

For modules that don't support worker mode, fall back to direct loading:

```typescript
// module-management/server/module-manager.ts
static async initModule(moduleId: string): Promise<void> {
  const manifest = await readManifest(moduleId);

  if (manifest.supportsIsolation) {
    // Use worker thread
    const worker = new ModuleWorker(moduleId, modulePath);
    await worker.start();
    this.workers.set(moduleId, worker);
  } else {
    // Fall back to direct loading (legacy)
    logger.warn({ moduleId }, 'Module loaded without isolation (legacy mode)');
    await this.directLoad(moduleId);
  }
}
```

## Benefits

| Before | After |
|--------|-------|
| Buggy module crashes app | Only module worker crashes |
| No memory limits | 128MB per module |
| Full filesystem access | Restricted fs access |
| No security boundary | Sandboxed execution |

## Files to Create

- `module-management/server/module-worker.ts`
- `module-management/server/worker-runtime.js`
- `module-management/server/sandbox.ts`

## Files to Change

- `module-management/server/module-manager.ts`
- `module-management/config/module-types.ts` (add exposedFunctions)

## Trade-offs

- **Complexity**: Worker threads add complexity
- **Communication overhead**: Message passing has latency
- **Debugging**: Harder to debug worker code
- **Not all code works**: Some Node.js APIs unavailable in workers

## Recommendation

Start with **optional isolation** - modules opt-in via manifest:
```yaml
# manifest.yaml
supportsIsolation: true
```

Then gradually migrate modules to support isolation.
