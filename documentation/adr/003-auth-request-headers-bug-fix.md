# Auth API getSession Request Headers Bug - Fixed

**Date**: 2026-03-03
**Severity**: High (500 Internal Server Error)
**Status**: ✅ Resolved

## Problem

Multiple API endpoints in MoLOS-Tasks module were failing with 500 Internal Server Error:

```
TypeError: Cannot read properties of undefined (reading 'headers')
    at GET (/modules/MoLOS-Tasks/src/routes/api/tasks/[id]/dependencies/+server.ts:10:27)
```

## Root Cause

The code was attempting to access `locals.request.headers`, but the `locals` object doesn't have a `request` property in SvelteKit.

### Incorrect Pattern

```typescript
export const GET: RequestHandler = async ({ locals, params }) => {
    const session = await auth.api.getSession({
        headers: locals.request.headers  // ❌ locals.request is undefined
    });
```

### Correct Pattern

From `src/hooks.server.ts:107-109`:

```typescript
const session = await auth.api.getSession({
	headers: event.request.headers // ✅ event has request property
});
```

## Affected Files

| File                                                                            | Lines Fixed | Handlers         |
| ------------------------------------------------------------------------------- | ----------- | ---------------- |
| `modules/MoLOS-Tasks/src/routes/api/tasks/[id]/dependencies/+server.ts`         | 10, 35      | GET, POST        |
| `modules/MoLOS-Tasks/src/routes/api/tasks/[id]/dependencies/[depId]/+server.ts` | 10          | DELETE           |
| `modules/MoLOS-Tasks/src/routes/api/workflows/[id]/+server.ts`                  | 10, 31, 58  | GET, PUT, DELETE |
| `modules/MoLOS-Tasks/src/routes/api/workflows/+server.ts`                       | 10, 28      | GET, POST        |

## Solution

Changed all occurrences from:

```typescript
export const GET: RequestHandler = async ({ locals, params }) => {
    const session = await auth.api.getSession({
        headers: locals.request.headers
    });
```

To:

```typescript
export const GET: RequestHandler = async ({ locals, params, request }) => {
    const session = await auth.api.getSession({
        headers: request.headers
    });
```

### Key Changes

1. Added `request` to destructured RequestEvent parameters
2. Changed `locals.request.headers` to `request.headers`

## Verification

The API endpoints that were previously failing now work correctly:

- ✅ `GET /api/MoLOS-Tasks/tasks/{id}/dependencies` - Fetch task dependencies
- ✅ `POST /api/MoLOS-Tasks/tasks/{id}/dependencies` - Create task dependency
- ✅ `DELETE /api/MoLOS-Tasks/tasks/{id}/dependencies/{depId}` - Delete dependency
- ✅ `GET /api/MoLOS-Tasks/workflows/{id}` - Get workflow state
- ✅ `PUT /api/MoLOS-Tasks/workflows/{id}` - Update workflow state
- ✅ `DELETE /api/MoLOS-Tasks/workflows/{id}` - Delete workflow state
- ✅ `GET /api/MoLOS-Tasks/workflows` - List workflow states
- ✅ `POST /api/MoLOS-Tasks/workflows` - Create workflow state

## Prevention

### Best Practices

1. **Always check destructured parameters**: Ensure all required properties from RequestEvent are extracted
2. **Follow established patterns**: Reference `src/hooks.server.ts` for correct auth usage
3. **Consider alternative approach**: Use `locals.user?.id` (set by middleware) instead of calling `auth.api.getSession()` again

### Alternative Implementation

Many other API routes in MoLOS-Tasks use the simpler pattern:

```typescript
export const GET: RequestHandler = async ({ locals, params }) => {
    const userId = locals.user?.id;
    if (!userId) throw error(401, 'Unauthorized');
    // ... rest of handler
```

This is preferred because:

- Session is already fetched in `authHandler` (hooks.server.ts:107-115)
- `locals.user` and `locals.session` are available in all API routes
- No redundant `auth.api.getSession()` call needed

## Related

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [SvelteKit RequestEvent](https://kit.svelte.dev/docs/types#sveltejs-kit-requestevent)
- [Server Hooks](../../src/hooks.server.ts) - Reference implementation

---

_Last Updated: 2026-03-03_
