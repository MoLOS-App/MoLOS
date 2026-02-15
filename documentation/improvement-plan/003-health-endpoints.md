# Task 003: Add Health Check Endpoints

**Priority**: P1 (High)
**Effort**: Low
**Impact**: Medium

## Problem

No way to check if MoLOS is healthy:
- Can't tell if database is accessible
- Can't tell if modules are loaded
- Docker health checks rely on process existence only
- No visibility for monitoring systems

## Solution

Add standard health check endpoints for Docker and monitoring.

## Implementation

### 1. Basic Health Endpoint

```typescript
// src/routes/api/health/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
  const start = Date.now();

  try {
    // Check database connectivity
    await db.all(sql`SELECT 1`);

    return json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - start}ms`,
    });
  } catch (error) {
    return json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    }, { status: 503 });
  }
};
```

### 2. Detailed Health Endpoint (for admins)

```typescript
// src/routes/api/health/details/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { ModuleManager } from '$lib/server/modules';

export const GET: RequestHandler = async () => {
  const checks: Record<string, { status: string; details?: any }> = {};

  // Database check
  try {
    const start = Date.now();
    await db.all(sql`SELECT 1`);
    checks.database = {
      status: 'healthy',
      responseTime: `${Date.now() - start}ms`,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: String(error),
    };
  }

  // Modules check
  try {
    const modules = await ModuleManager.getActiveModules();
    const errored = modules.filter(m => m.status.startsWith('error_'));
    checks.modules = {
      status: errored.length === 0 ? 'healthy' : 'degraded',
      total: modules.length,
      active: modules.filter(m => m.status === 'active').length,
      errored: errored.length,
      erroredModules: errored.map(m => m.id),
    };
  } catch (error) {
    checks.modules = {
      status: 'unhealthy',
      error: String(error),
    };
  }

  // Overall status
  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
  const anyUnhealthy = Object.values(checks).some(c => c.status === 'unhealthy');

  const status = anyUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded';

  return json({
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown',
    uptime: process.uptime(),
    checks,
  }, { status: status === 'unhealthy' ? 503 : 200 });
};
```

### 3. Module-Specific Health

```typescript
// src/routes/api/health/modules/+server.ts
export const GET: RequestHandler = async () => {
  const modules = await ModuleManager.getAllModules();

  return json({
    modules: modules.map(m => ({
      id: m.id,
      name: m.name,
      status: m.status,
      lastError: m.lastError,
      lastInitializedAt: m.lastInitializedAt,
    })),
  });
};
```

### 4. Docker Health Check

```dockerfile
# In Dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
```

### 5. Docker Compose

```yaml
# docker-compose.yml
services:
  molos:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

## Response Examples

### `/api/health` (Simple)
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "responseTime": "5ms"
}
```

### `/api/health/details` (Detailed)
```json
{
  "status": "degraded",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": "2ms"
    },
    "modules": {
      "status": "degraded",
      "total": 5,
      "active": 4,
      "errored": 1,
      "erroredModules": ["MoLOS-Tasks"]
    }
  }
}
```

## Files to Create

- `src/routes/api/health/+server.ts`
- `src/routes/api/health/details/+server.ts`
- `src/routes/api/health/modules/+server.ts`

## Security

- `/api/health` - Public (for load balancers)
- `/api/health/details` - Require auth (admin only)
- `/api/health/modules` - Require auth (admin only)
