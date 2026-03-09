# Architecture Overview

> High-level architecture overview of the MoLOS system, including monorepo structure, module system, and design patterns.

## System Architecture

MoLOS is a privacy-focused, deeply modular productivity suite built with SvelteKit, using a monorepo architecture with a package-based module system.

### Core Principles

1. **Privacy-First** - Self-hostable design, data remains on your servers
2. **Modular** - Install only the modules you need
3. **Type-Safe** - TypeScript throughout, Drizzle ORM for database
4. **Fast Development** - Bun runtime, Turborepo build orchestration

### Distribution Model

MoLOS follows a **verified modules** distribution strategy:

| Image Type   | Contents                                  | Support     | Use Case        |
| ------------ | ----------------------------------------- | ----------- | --------------- |
| **Official** | All verified modules at verified versions | Full        | Production      |
| **Custom**   | User-selected modules                     | At own risk | Experimentation |

**Key Decision:** Module activation is a **runtime concern**, not build-time. The official Docker image includes all verified modules; users choose which to activate via settings.

```bash
# Official image - all verified modules included
docker pull ghcr.io/molos-app/molos:latest

# Custom image - user selects modules (at own risk)
docker build -t my-molos .
```

## Monorepo Structure

```
MoLOS/
├── apps/
│   └── web/                    # Main SvelteKit application (future)
├── packages/
│   ├── core/                   # @molos/core - utilities and types
│   ├── database/               # @molos/database - schema and migrations
│   └── ui/                     # @molos/ui - shared components
├── modules/
│   ├── ai/                     # @molos/module-ai (internal)
│   └── tasks/                  # @molos/module-tasks
├── external_modules/           # External modules (migrated)
│   ├── MoLOS-Goals/
│   ├── MoLOS-Health/
│   ├── MoLOS-Finance/
│   ├── MoLOS-Meals/
│   ├── MoLOS-Google/
│   ├── MoLOS-AI-Knowledge/
│   └── MoLOS-Sample-Module/
├── src/                        # Main SvelteKit app
│   ├── lib/
│   │   ├── components/         # UI components
│   │   ├── server/             # Server-side code
│   │   ├── stores/             # Svelte stores
│   │   ├── models/             # TypeScript types
│   │   ├── repositories/       # Data access layer
│   │   └── config/             # App configuration
│   └── routes/                 # SvelteKit routes
├── scripts/                    # Build and utility scripts
├── drizzle/                    # Core database migrations
└── documentation/              # This documentation
```

## Module System Architecture

### Module Types

| Type     | ID Format      | Example           | Location                         |
| -------- | -------------- | ----------------- | -------------------------------- |
| Internal | lowercase      | `dashboard`, `ai` | `src/lib/config/`, `modules/ai/` |
| External | `MoLOS-{Name}` | `MoLOS-Tasks`     | `modules/`, `external_modules/`  |

### Module Structure

```
modules/MoLOS-{Name}/
├── package.json              # @molos/module-{name}
├── manifest.yaml             # Module manifest
├── drizzle.config.ts         # Database config (if has DB)
├── drizzle/                  # Migrations (if has DB)
└── src/
    ├── config.ts             # ModuleConfig (REQUIRED)
    ├── index.ts              # Package exports
    ├── models/               # TypeScript types
    ├── server/
    │   ├── database/schema.ts
    │   └── repositories/
    ├── routes/
    │   ├── ui/               # SvelteKit UI routes
    │   └── api/              # API endpoints
    ├── components/           # Svelte components
    └── stores/               # Svelte stores
```

### Module Discovery

Modules are discovered automatically via `import.meta.glob`:

- **Internal modules**: Auto-loaded from `src/lib/config/` and `modules/ai/`
- **Local modules**: Discovered from `modules/*/src/config.ts`
- **Installed modules**: Discovered from `node_modules/@molos/module-*/src/config.ts`

### Module Integration

Modules integrate through:

1. **Route Symlinks** - Module routes are symlinked into `src/routes/`
2. **Package Imports** - Code imports via `@molos/module-{name}` package
3. **Database Namespacing** - Tables prefixed with `MoLOS-{Name}_`
4. **AI Tools** - Optional AI tool integration via MCP

## Database Architecture

### Database Layers

```
┌─────────────────────────────────────────┐
│           Application Layer            │
│   (SvelteKit routes, stores)       │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│        Repository Layer             │
│   (Data access, business logic)      │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│         Database Layer               │
│   (Drizzle ORM, better-sqlite3)     │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│        SQLite File                 │
│   (molos.db)                        │
└─────────────────────────────────────────┘
```

### Database Tables

**Core Tables** (no prefix):

- `user` - User accounts
- `session` - Authentication sessions
- `settings` - Application settings
- `settings_external_modules` - Module activation state

**Module Tables** (namespaced):

- `MoLOS-{Name}_{table}` - Module-specific tables

Example:

- `MoLOS-Tasks_tasks`
- `MoLOS-Goals_milestones`
- `MoLOS-Finance_transactions`

**See:** [Database Architecture](./database.md) for details

## Frontend Architecture

### SvelteKit Structure

```
src/
├── routes/
│   ├── (app)/                # App layout group
│   │   ├── +layout.svelte    # Main app layout
│   │   ├── +layout.server.ts # Load user session
│   │   └── +page.svelte      # Dashboard/home
│   ├── (modules)/            # Module routes group
│   │   ├── (internal)/       # Internal modules
│   │   └── (external_modules)/# External modules
│   └── api/                  # API endpoints
├── lib/
│   ├── components/            # Reusable components
│   ├── server/              # Server utilities
│   └── config/              # Module registry
```

### Component Architecture

- **UI Components** - Reusable UI in `src/lib/components/`
- **Module Components** - Module-specific in `modules/*/src/components/`
- **Shadcn-Svelte** - UI component library base

## AI Integration Architecture

### MCP (Model Context Protocol)

```
┌───────────────────────────────────────────────┐
│              MoLOS Application             │
│                                              │
│   ┌──────────────┐   ┌─────────────────┐   │
│   │   Modules    │──▶│  MCP Server    │   │
│   │              │   │                 │   │
│   │ - AI Tools   │   │  - Tool Reg.   │   │
│   │ - Resources  │   │  - Protocol     │   │
│   └──────────────┘   └─────────────────┘   │
│                        │                   │
│                        ▼                   │
│             ┌─────────────────┐              │
│             │  AI Assistant  │              │
│             │  (Claude)      │              │
│             └─────────────────┘              │
│                                              │
└───────────────────────────────────────────────┘
```

**See:** [MCP Documentation](../mcp/) for details

## Build System

### Turborepo Orchestration

Turborepo manages builds across the monorepo:

- **Shared caching** - Build artifacts cached and reused
- **Parallel execution** - Multiple packages build simultaneously
- **Task dependency** - Automatic build order
- **Incremental builds** - Only rebuild changed packages

### Build Pipeline

```
1. Install Dependencies (bun install)
   ↓
2. Discover Modules (module:sync)
   ↓
3. Link Routes (module:link)
   ↓
4. Generate Types (svelte-kit sync)
   ↓
5. Build Application (bun run build)
   ↓
6. Package for Deployment (Docker)
```

**See:** [Turborepo Guide](../modules/turborepo.md) for details

## Security Architecture

### Authentication

- **better-auth** - Session-based authentication
- **Secure cookies** - HTTP-only, secure flags
- **Session storage** - SQLite sessions table

### Data Privacy

- **Self-hosted** - No cloud dependencies for core functionality
- **Local database** - SQLite file on your server
- **No telemetry** - Optional analytics only

### Module Isolation

- **Namespaced tables** - Database tables per module
- **Scoped routes** - Module routes in separate directories
- **Sandboxed AI tools** - Controlled access via MCP

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading** - Modules load only when accessed
2. **Route Preloading** - SvelteKit prefetches routes
3. **Database Indexing** - Optimized queries via indexes
4. **Build Optimization** - Code splitting and minification

### Scalability

- **SQLite limits** - Single file database (suitable for single-server deployments)
- **Future migration path** - Can migrate to PostgreSQL/MySQL for multi-server
- **Caching** - Redis caching layer (planned)

## Technology Stack

| Component       | Technology    | Notes                            |
| --------------- | ------------- | -------------------------------- |
| Frontend/API    | SvelteKit 2.x | Svelte 5 with runes              |
| Database        | SQLite        | Via better-sqlite3               |
| ORM             | Drizzle       | Type-safe queries                |
| Styling         | Tailwind CSS  | With shadcn-svelte components    |
| Build           | Turborepo     | Monorepo task orchestration      |
| Package Manager | Bun           | Fast installs, workspace support |
| Auth            | better-auth   | Session-based authentication     |

## Development Workflow

### Local Development

```bash
# Install dependencies
bun install

# Start dev server (auto-discovers modules)
bun run dev

# Sync modules manually
bun run module:sync

# Run tests
bun run test

# Build for production
bun run build
```

### Module Development

```bash
# Create module
cd modules/my-module
bun init

# Configure module
# Edit src/config.ts

# Create migrations (from MoLOS root)
cd ../..
bun run db:migration:create --name initial --module MoLOS-MyModule

# Run migrations
bun run db:migrate

# Sync to app
bun run module:sync
```

## Related Documentation

- [Monorepo Structure](./monorepo-structure.md) - Detailed directory structure
- [Database Architecture](./database.md) - Database system design
- [Event System](./event-system.md) - Module event bus
- [Data Namespacing](./data-namespacing.md) - Database table namespacing
- [Module System](../modules/README.md) - Module development and usage
- [Getting Started](../getting-started/) - Development setup

---

_Last Updated: 2026-02-27_
