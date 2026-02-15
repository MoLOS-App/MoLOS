# Task 008: Circuit Breaker for Module Operations

**Priority**: P2 (Medium)
**Effort**: Medium
**Impact**: Medium

## Problem

When modules fail repeatedly:
- No automatic recovery mechanism
- Failed modules keep trying to initialize
- No backoff strategy
- Can cause cascading failures

## Solution

Implement a circuit breaker pattern for module operations.

## Circuit Breaker States

```
         ┌──────────────┐
         │    CLOSED    │ (normal operation)
         └──────┬───────┘
                │ failures >= threshold
                ▼
         ┌──────────────┐
         │     OPEN     │ (failing fast)
         └──────┬───────┘
                │ timeout elapsed
                ▼
         ┌──────────────┐
         │  HALF_OPEN   │ (testing recovery)
         └──────┬───────┘
                │
    ┌───────────┴───────────┐
    │                       │
 success               failure
    │                       │
    ▼                       ▼
 CLOSED                  OPEN
```

## Implementation

### 1. Circuit Breaker Class

```typescript
// module-management/server/circuit-breaker.ts
export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Failures before opening
  successThreshold: number;    // Successes to close from half-open
  timeout: number;             // Ms before trying half-open
  resetTimeout: number;        // Ms to reset failure count
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,       // 1 minute
  resetTimeout: 300000, // 5 minutes
};

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private openedAt: number | null = null;

  constructor(
    private readonly moduleId: string,
    private config: CircuitBreakerConfig = DEFAULT_CONFIG
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
        moduleLogger.info({ moduleId: this.moduleId }, 'Circuit breaker entering half-open');
      } else {
        throw new CircuitOpenError(this.moduleId);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.lastFailureTime = null;

    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = 'closed';
        this.successes = 0;
        this.openedAt = null;
        moduleLogger.info({ moduleId: this.moduleId }, 'Circuit breaker closed');
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Single failure in half-open immediately opens
      this.state = 'open';
      this.openedAt = Date.now();
      this.successes = 0;
      moduleLogger.warn({ moduleId: this.moduleId }, 'Circuit breaker reopened');
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      this.openedAt = Date.now();
      moduleLogger.warn(
        { moduleId: this.moduleId, failures: this.failures },
        'Circuit breaker opened'
      );
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.openedAt) return false;
    return Date.now() - this.openedAt >= this.config.timeout;
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      openedAt: this.openedAt,
    };
  }

  // Force reset (admin action)
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.openedAt = null;
    moduleLogger.info({ moduleId: this.moduleId }, 'Circuit breaker manually reset');
  }
}

export class CircuitOpenError extends Error {
  constructor(moduleId: string) {
    super(`Circuit breaker is open for module ${moduleId}`);
    this.name = 'CircuitOpenError';
  }
}
```

### 2. Integrate with ModuleManager

```typescript
// module-management/server/module-manager.ts
import { CircuitBreaker } from './circuit-breaker';

export class ModuleManager {
  private static circuitBreakers = new Map<string, CircuitBreaker>();

  private static getCircuitBreaker(moduleId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(moduleId)) {
      this.circuitBreakers.set(moduleId, new CircuitBreaker(moduleId));
    }
    return this.circuitBreakers.get(moduleId)!;
  }

  static async executeModuleAction<T>(
    moduleId: string,
    action: () => Promise<T>
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(moduleId);

    try {
      return await breaker.execute(action);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        // Mark module as degraded
        await this.updateModuleStatus(moduleId, 'degraded', error.message);
      }
      throw error;
    }
  }

  static async initializeModule(moduleId: string): Promise<void> {
    return this.executeModuleAction(moduleId, async () => {
      // Existing init logic
      await this.doInitialize(moduleId);
    });
  }

  // Admin endpoint to reset circuit breaker
  static resetCircuitBreaker(moduleId: string): void {
    const breaker = this.circuitBreakers.get(moduleId);
    if (breaker) {
      breaker.reset();
    }
  }

  // Get circuit breaker status for all modules
  static getCircuitBreakerStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [moduleId, breaker] of this.circuitBreakers) {
      stats[moduleId] = breaker.getStats();
    }
    return stats;
  }
}
```

### 3. Add API Endpoints

```typescript
// src/routes/api/admin/modules/[id]/circuit-breaker/+server.ts
import { json } from '@sveltejs/kit';
import { ModuleManager } from '$lib/server/modules';

// GET - Get circuit breaker status
export const GET: RequestHandler = async ({ params }) => {
  const stats = ModuleManager.getCircuitBreakerStats();
  return json(stats[params.id] || { state: 'unknown' });
};

// POST - Reset circuit breaker
export const POST: RequestHandler = async ({ params }) => {
  ModuleManager.resetCircuitBreaker(params.id);
  return json({ success: true, message: `Circuit breaker reset for ${params.id}` });
};
```

### 4. Add to Health Check

```typescript
// src/routes/api/health/details/+server.ts
// Add circuit breaker status to health check

const circuitBreakerStats = ModuleManager.getCircuitBreakerStats();
const openCircuits = Object.entries(circuitBreakerStats)
  .filter(([_, stats]) => stats.state === 'open');

checks.circuitBreakers = {
  status: openCircuits.length === 0 ? 'healthy' : 'degraded',
  openCircuits: openCircuits.map(([id]) => id),
  stats: circuitBreakerStats,
};
```

## Configuration

```typescript
// Per-module configuration in manifest.yaml
circuitBreaker:
  failureThreshold: 5
  successThreshold: 2
  timeout: 60000
```

## UI Integration

Add circuit breaker status to module settings page:

```svelte
<!-- Module card shows circuit breaker state -->
{#if circuitBreaker.state === 'open'}
  <div class="alert alert-warning">
    Module is in cooldown (circuit breaker open)
    <button on:click={resetCircuitBreaker}>Reset</button>
  </div>
{/if}
```

## Benefits

| Before | After |
|--------|-------|
| Failed module keeps retrying | Automatic backoff |
| No visibility into failure patterns | Stats available |
| Manual intervention required | Auto-recovery attempt |
| Cascading failures possible | Fail-fast prevents spread |

## Files to Create

- `module-management/server/circuit-breaker.ts`

## Files to Change

- `module-management/server/module-manager.ts`
- `src/routes/api/admin/modules/[id]/circuit-breaker/+server.ts` (new)
- `src/routes/api/health/details/+server.ts`
