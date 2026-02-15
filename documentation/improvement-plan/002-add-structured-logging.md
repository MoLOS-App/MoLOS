# Task 002: Add Structured Logging

**Priority**: P0 (Critical)
**Effort**: Low
**Impact**: High

## Problem

Current logging is scattered `console.log` and `console.error`:
- No structure
- No log levels
- No correlation (request IDs)
- Hard to debug in production
- Can't filter/search logs

## Solution

Add structured logging with [pino](https://getpino.dev/) (fast, JSON-based, works well in Docker).

## Implementation

### 1. Install pino

```bash
npm install pino pino-pretty
```

### 2. Create logger service

```typescript
// src/lib/server/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  base: { pid: undefined }, // Remove pid from logs
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Child loggers for modules
export const moduleLogger = logger.child({ component: 'module-system' });
export const authLogger = logger.child({ component: 'auth' });
export const aiLogger = logger.child({ component: 'ai' });
```

### 3. Replace console.* calls

**Before:**
```typescript
console.log('[Vite] Linking modules...');
console.error('[Hooks] Failed to initialize:', error);
```

**After:**
```typescript
moduleLogger.info('Linking modules');
moduleLogger.error({ err: error }, 'Failed to initialize');
```

### 4. Add request ID tracking

```typescript
// src/hooks.server.ts
import { logger } from '$lib/server/logger';

const requestLogger: Handle = async ({ event, resolve }) => {
  const requestId = crypto.randomUUID();
  event.locals.requestId = requestId;

  const requestLogger = logger.child({ requestId });

  const response = await resolve(event);

  requestLogger.info({
    method: event.request.method,
    path: event.url.pathname,
    status: response.status,
  }, 'Request completed');

  return response;
};
```

## Log Format (Production)

```json
{"level":30,"time":"2024-01-15T10:30:00.000Z","requestId":"abc-123","msg":"Request completed","method":"GET","path":"/ui/dashboard","status":200}
```

## Log Format (Development)

```
[10:30:00.000] INFO (12345): Request completed
    requestId: "abc-123"
    method: "GET"
    path: "/ui/dashboard"
    status: 200
```

## Files to Change

- `src/lib/server/logger.ts` - New
- `src/hooks.server.ts` - Add request logging
- `vite.config.ts` - Replace console.*
- `module-management/server/*.ts` - Replace console.*
- All server files with console.log/error

## Environment Variables

```bash
LOG_LEVEL=info        # debug, info, warn, error
LOG_FORMAT=json       # json or pretty (dev only)
```

## Benefits

- Searchable JSON logs in Docker
- Request correlation for debugging
- Proper log levels for filtering
- Production-ready logging
