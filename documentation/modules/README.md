# Module System

MoLOS uses a package-based module system where modules can be installed from npm, GitHub, or developed locally.

## Quick Links

- **[Installation Guide](./installation.md)** - Installing modules from GitHub/npm
- **[Development Guide](./development.md)** - Creating and developing modules
- **[AI Tools Development](./ai-tools-development.md)** - AI tool development guide and error handling patterns
- **[Standards & Conventions](./standards.md)** - Module structure, naming, and code standards
- **[Quick Reference](./quick-reference.md)** - Common commands and workflows
- **[Turborepo](./turborepo.md)** - Build system and task orchestration

## Module Types

### Internal Modules (Always Loaded)

| ID | Location | Description |
|----|----------|-------------|
| `dashboard` | `src/lib/config/dashboard/` | Core dashboard functionality |
| `ai` | `modules/ai/` | AI assistant interface |

These cannot be filtered out by environment variables.

### External Modules (Installable)

| ID | Package | Source |
|----|---------|--------|
| `MoLOS-Tasks` | `@molos/module-tasks` | [GitHub](https://github.com/MoLOS-App/MoLOS-Tasks) |

## Quick Start

```bash
# Just run dev - it auto-discovers, installs, and syncs modules
bun run dev
```

That's it! The `dev` command automatically:
1. Discovers modules in `modules/`
2. Installs dependencies
3. Syncs routes
4. Starts the dev server

## Module Layout

```
modules/{module-name}/
├── package.json              # @molos/module-{name}
├── drizzle.config.ts         # Database migration config
├── drizzle/                  # Migration files
├── src/
│   ├── index.ts              # Main exports
│   ├── config.ts             # Module configuration (REQUIRED)
│   ├── models/               # TypeScript types and enums
│   ├── server/
│   │   ├── database/
│   │   │   └── schema.ts     # Drizzle schema
│   │   └── repositories/     # Data access layer
│   ├── routes/
│   │   ├── ui/               # SvelteKit UI routes
│   │   └── api/              # API endpoints
│   ├── components/           # Svelte components
│   └── stores/               # Svelte stores
```

## Module Discovery

Modules are discovered automatically via `import.meta.glob`:

- Local configs: `modules/*/src/config.ts`
- Installed configs: `node_modules/@molos/module-*/src/config.ts`

## Route Symlinks

SvelteKit requires routes in `src/routes/`, so module routes are symlinked:

```
src/routes/ui/(modules)/(external_modules)/MoLOS-Tasks → node_modules/@molos/module-tasks/src/routes/ui
src/routes/api/(external_modules)/MoLOS-Tasks → node_modules/@molos/module-tasks/src/routes/api
```

## Environment Variables

```bash
# .env

# Empty = load all modules
VITE_MOLOS_AUTOLOAD_MODULES=

# Or filter specific modules (dashboard and ai always load)
VITE_MOLOS_AUTOLOAD_MODULES=MoLOS-Tasks,MoLOS-Finance
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/config/index.ts` | Module registry, discovery, and mandatory modules |
| `src/lib/config/types.ts` | ModuleConfig type definition |
| `scripts/sync-modules.ts` | Module synchronization |
| `scripts/link-modules.ts` | Route symlink creation |

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev (auto-discovers, installs, syncs) |
| `bun run module:sync-deps` | Auto-discover modules only |
| `bun run module:sync` | Sync routes only |
| `bun run module:link` | Link routes only |

## Adding Modules

Just drop a module in `modules/` and run `bun run dev` - everything else is automatic.

## Key Constraints

- Use `$lib` alias for imports from main app (not relative paths)
- Use `.js` extension for TypeScript imports in routes
- Module ID must match between config, routes, and database table prefixes
- External modules use `MoLOS-{Name}` ID format
- **Database table naming**: `MoLOS-{ModuleName}_{table_name}` - hyphens in module ID, underscore separator, then table name
