# Module Management with Turborepo

## Architecture

```
MoLOS-org/
├── MoLOS/                        # Main app (core)
│   ├── modules/                  # SOURCE OF TRUTH for all module development
│   │   ├── ai/                   # Internal module (stays here)
│   │   └── tasks/                # External module (developed here, synced out)
│   ├── packages/
│   │   └── database/             # Shared database package
│   └── src/                      # Core app code
│
├── MoLOS-Tasks/                  # External repo (for publishing/CI)
├── MoLOS-Finance/                # External repo
└── ...                           # Other external repos
```

## Key Principle

**`MoLOS/modules/` is always the source of truth.**

- Develop ALL modules in `MoLOS/modules/`
- External repos (`MoLOS-org/MoLOS-*`) are for publishing and independent CI
- Sync FROM modules/ TO external repos when ready to publish

## Development Workflow

### 1. Develop in modules/

```bash
cd MoLOS/modules/tasks
# Edit src/, config.ts, schema.ts, etc.
```

### 2. Test in main app

```bash
cd MoLOS
bun run module:sync    # Sync routes and config
bun run dev            # Start dev server
```

### 3. Generate migrations (if schema changed)

```bash
cd MoLOS/modules/tasks
npx drizzle-kit generate    # Uses local drizzle.config.ts
npx drizzle-kit migrate     # Apply to database
```

### 4. Publish to external repo

```bash
# Sync to external repo (when ready to share/publish)
rsync -av --delete MoLOS/modules/tasks/ ../MoLOS-Tasks/

# Commit and push
cd ../MoLOS-Tasks
git add .
git commit -m "Update module"
git push
```

## Module Types

### Internal (Core) Modules
- `ai` - AI assistant interface
- `dashboard` - Core dashboard

Stay in `MoLOS/` forever, never published externally.

### External Modules
- `tasks` - Task management
- `finance` - Financial tracking
- `goals`, `health`, `meals`, etc.

Developed in `MoLOS/modules/`, can be synced to external repos.

## Turborepo Usage (Optional)

For CI/CD across multiple repos:

```yaml
# .github/workflows/ci.yml in each external repo
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run test
```

## Quick Reference

| Task | Command |
|------|---------|
| Sync module routes | `bun run module:sync` |
| Link routes only | `bun run module:link` |
| Generate migrations | `cd modules/TASK && npx drizzle-kit generate` |
| Apply migrations | `npx drizzle-kit migrate` |
| Start dev server | `bun run dev` |

## Module Package Structure

Each external module should have:

```
MoLOS-Tasks/
├── package.json           # @molos/module-tasks
├── drizzle.config.ts      # For generating migrations
├── drizzle/               # Migration files
│   └── 0000_initial.sql
├── src/
│   ├── index.ts           # Module exports
│   ├── config.ts          # Module config (id, navigation, etc.)
│   ├── models/            # TypeScript models/enums
│   ├── server/
│   │   ├── database/
│   │   │   └── schema.ts  # Drizzle schema
│   │   └── repositories/  # Data access layer
│   ├── routes/
│   │   ├── ui/            # SvelteKit UI routes
│   │   └── api/           # API endpoints
│   └── components/        # Svelte components
└── tsconfig.json
```

## Module Configuration

### config.ts Example

```typescript
import { SquareCheck } from 'lucide-svelte';
import type { ModuleConfig } from '$lib/config/types';

export const tasksConfig: ModuleConfig = {
  id: 'MoLOS-Tasks',           // Must match repo name
  name: 'Tasks',
  href: '/ui/MoLOS-Tasks',
  icon: SquareCheck,
  description: 'Task management',
  navigation: [
    { name: 'Dashboard', href: '/ui/MoLOS-Tasks/dashboard', icon: ListTodo },
    { name: 'My Tasks', href: '/ui/MoLOS-Tasks/my', icon: SquareCheck },
  ],
};

export default tasksConfig;
```

### package.json Exports

```json
{
  "name": "@molos/module-tasks",
  "exports": {
    ".": "./src/index.ts",
    "./config": "./src/config.ts",
    "./server/database/schema": "./src/server/database/schema.ts"
  }
}
```

## CI/CD Pipeline

```yaml
# .github/workflows/ci.yml (at org level)
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Link modules
        run: bun run link:modules

      - name: Build
        run: turbo run build

      - name: Test
        run: turbo run test

      - name: Lint
        run: turbo run lint
```

## Turborepo Commands Reference

| Command | Description |
|---------|-------------|
| `turbo run build` | Build all packages in parallel |
| `turbo run dev` | Start all dev servers |
| `turbo run test` | Run tests across all packages |
| `turbo run lint` | Lint all packages |
| `turbo run db:generate` | Generate migrations for all modules |
| `turbo run db:migrate` | Run migrations for all modules |
| `turbo run clean` | Clean build artifacts |

## Tips

1. **Cache**: Turborepo caches builds. Use `--force` to bypass cache.
2. **Filtering**: Use `--filter` to run commands on specific packages:
   ```bash
   turbo run build --filter=@molos/module-tasks
   ```
3. **Dry Run**: Use `--dry` to see what would be executed:
   ```bash
   turbo run build --dry
   ```
