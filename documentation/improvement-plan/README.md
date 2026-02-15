# MoLOS Improvement Plan

## Context

- **Self-hosted**: Single SQLite instance is sufficient
- **Docker/Linux**: Symlinks are reliable, no Windows concerns
- **Goal**: Make MoLOS more solid, maintainable, and observable

## Priority Levels

| Level | Meaning |
|-------|---------|
| P0 | Critical - Do immediately |
| P1 | High - Do soon |
| P2 | Medium - Do when possible |
| P3 | Low - Nice to have |

## Task Overview

### Phase 1: Stabilization (P0-P1)

| Task | Priority | Effort |
|------|----------|--------|
| [001](./001-extract-module-linker.md) - Extract Module Linker from vite.config.ts | P0 | Medium |
| [002](./002-add-structured-logging.md) - Add Structured Logging | P0 | Low |
| [003](./003-health-endpoints.md) - Add Health Check Endpoints | P1 | Low |
| [004](./004-startup-resilience.md) - Improve Startup Resilience | P1 | Medium |
| [005](./005-module-build-cache.md) - Module Build Cache (avoid DB reads in Vite) | P1 | Medium |

### Phase 2: Architecture (P1-P2)

| Task | Priority | Effort |
|------|----------|--------|
| [006](./006-module-isolation.md) - Module Isolation & Sandboxing | P1 | High |
| [007](./007-integration-tests.md) - Integration Tests for Module System | P1 | High |
| [008](./008-circuit-breaker.md) - Circuit Breaker for Module Operations | P2 | Medium |
| [009](./009-module-sdk.md) - Module SDK with Typed Contracts | P2 | Medium |

### Phase 3: Developer Experience (P2-P3)

| Task | Priority | Effort |
|------|----------|--------|
| [010](./010-module-cli.md) - CLI Tool for Module Scaffolding | P2 | Medium |
| [011](./011-hot-module-reload.md) - Hot Reload for External Modules | P3 | Medium |
| [012](./012-module-dependencies.md) - Module Dependency Resolution | P2 | Medium |

## What We're NOT Doing

1. **PostgreSQL migration** - SQLite is fine for self-hosted
2. **Microservices** - Adds unnecessary complexity
3. **Windows support** - Docker/Linux only
4. **Full rewrite** - Current architecture works, just needs refinement

## Success Metrics

- All P0 tasks completed
- Module errors don't crash the app
- Observable logging for debugging
- Clear error messages for module developers
- Tests cover critical paths
