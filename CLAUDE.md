# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MoLOS is a modular, local-first workspace built with SvelteKit. It uses a monorepo structure with Turborepo for build orchestration and bun as the package manager. The core is a SvelteKit app, with optional modules that can be added/removed dynamically.

## Commands

### Development

```bash
bun run dev           # Start dev server (syncs modules, inits DB, starts Vite)
bun run build         # Production build (via Turborepo)
bun run preview       # Preview built app on port 4173
bun run check         # Type checking + Svelte compilation
bun run typecheck     # Turborepo typecheck across all packages
```

### Testing & Quality

```bash
bun run test          # Run tests via Turborepo
bun run test:unit     # Run Vitest in watch mode
bun run lint          # Prettier check via Turborepo
bun run eslint        # Run ESLint
bun run format        # Format with Prettier
```

### Database (Drizzle ORM with SQLite)

```bash
bun run db:init       # Initialize database
bun run db:generate   # Generate migrations from schema
bun run db:migrate    # Apply migrations
bun run db:reset      # Reset database
bun run db:studio     # Open Drizzle Studio
```

### Module Management

```bash
bun run module:sync       # Sync and initialize all modules
bun run module:link       # Create route symlinks only
bun run module:sync-deps  # Sync workspace module dependencies
bun run module:create     # Create new module (interactive)
bun run module:validate   # Validate module structure
bun run module:test       # Test module
bun run module:cleanup    # Remove stale symlinks
```

## Architecture

### Monorepo Structure

- `src/` - Core SvelteKit application
- `packages/` - Shared packages (`@molos/core`, `@molos/database`, `@molos/ui`, `@molos/module-types`)
- `modules/` - External modules (named `MoLOS-{Name}`)
- `scripts/` - Build/tooling scripts for module management

### Key Directories

- `src/lib/server/db/schema/` - Database schema definitions
- `src/lib/components/ui/` - Reusable UI components (shadcn-svelte style)
- `src/routes/api/` - API endpoints
- `packages/database/src/schema/` - Core database schema (auth, AI)

### Module System

Modules are self-contained features that integrate via symlinks:

- **Module ID convention**: Internal modules use lowercase (`dashboard`, `ai`), external use `MoLOS-{Name}`
- **Required files**: `src/config.ts` with `ModuleConfig` export
- **Database tables**: MUST be prefixed with module ID (e.g., `MoLOS-Tasks_tasks`)
- **Routes**: Mounted at `/ui/{module-id}/`

### Path Aliases (vite.config.ts)

```
@molos/core          → packages/core/src
@molos/database      → packages/database/src
@molos/ui            → packages/ui/src
@molos/module-types  → packages/module-types/src
$lib                 → src/lib
```

## Coding Conventions

### Formatting (Prettier)

- Tabs, single quotes, no trailing commas, printWidth 100
- Run `bun run format`

### Database Schema

- Location: `src/lib/server/db/schema/{module}/` or module's `src/server/database/schema.ts`
- Table naming: `MoLOS-{ModuleName}_{table_name}` (required for modules)
- Use Drizzle ORM with SQLite dialect

### Svelte Components

- Reusable UI components go in `src/lib/components/ui/` first
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`)
- Server-side data loading via `+page.server.ts`

### Imports

- Use `$lib` alias for imports from main app (works in node_modules)
- Add `.js` extension for TypeScript imports in route files
- Cross-module imports: `$lib/modules/{ModuleName}/...`

## Task Tracking

This project uses **beads** (git-backed issue tracker):

```bash
bd ready                    # Show available work
bd create --title="..." --type=task --priority=2   # Create issue
bd update <id> --status=in_progress                # Claim work
bd close <id>               # Mark complete
bd sync                     # Sync with git remote
```

Priority levels: 0=critical, 1=high, 2=medium, 3=low, 4=backlog

## Git Workflow

- **Do NOT push or commit or add anything never**
- When committing: simple messages, no Co-Authored-By lines

## MCP Server Integration

Use MCP tools over manual searches:

- **svelte** (required for Svelte work): `list-sections` → `get-documentation` → `svelte-autofixer`
- **context7**: Library documentation (resolve-library-id → get-library-docs)
- **web-reader** / **web-search-prime**: Web content fetching and search
