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

| ID          | Location                    | Description                  |
| ----------- | --------------------------- | ---------------------------- |
| `dashboard` | `src/lib/config/dashboard/` | Core dashboard functionality |
| `ai`        | `modules/ai/`               | AI assistant interface       |

These cannot be filtered out by environment variables.

### External Modules (Installable)

| ID                    | Package                      | Source                                                     | Description                           | Version |
| --------------------- | ---------------------------- | ---------------------------------------------------------- | ------------------------------------- | ------- |
| `MoLOS-Tasks`         | `@molos/module-tasks`        | [GitHub](https://github.com/MoLOS-App/MoLOS-Tasks)         | Task management and project tracking  | 1.0.4   |
| `MoLOS-AI-Knowledge`  | `@molos/module-ai-knowledge` | [GitHub](https://github.com/MoLOS-App/MoLOS-AI-Knowledge)  | AI prompts, playground, and workflows | 1.0.0   |
| `MoLOS-LLM-Council`   | `@molos/module-llm-council`  | [GitHub](https://github.com/MoLOS-App/MoLOS-LLM-Council)   | Multi-LLM consultation system         | 1.0.0   |
| `MoLOS-Goals`         | `@molos/module-goals`        | [GitHub](https://github.com/MoLOS-App/MoLOS-Goals)         | OKR and goal tracking                 | -       |
| `MoLOS-Meals`         | `@molos/module-meals`        | [GitHub](https://github.com/MoLOS-App/MoLOS-Meals)         | Meal planning and nutrition           | -       |
| `MoLOS-Health`        | `@molos/module-health`       | [GitHub](https://github.com/MoLOS-App/MoLOS-Health)        | Health and fitness tracking           | -       |
| `MoLOS-Finance`       | `@molos/module-finance`      | [GitHub](https://github.com/MoLOS-App/MoLOS-Finance)       | Financial tracking and budgets        | -       |
| `MoLOS-Markdown`      | `@molos/module-markdown`     | [GitHub](https://github.com/MoLOS-App/MoLOS-Markdown)      | Markdown editing and preview          | -       |
| `MoLOS-Google`        | `@molos/module-google`       | [GitHub](https://github.com/MoLOS-App/MoLOS-Google)        | Google services integration           | -       |
| `MoLOS-Sample-Module` | `@molos/module-sample`       | [GitHub](https://github.com/MoLOS-App/MoLOS-Sample-Module) | Example module for reference          | -       |

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
├── drizzle.config.ts         # Database migration config (if has DB)
├── drizzle/                  # Migration files (if has DB)
│   ├── 0000_initial.sql
│   ├── 0000_initial.down.sql
│   └── meta/
└── src/
    ├── index.ts              # Main exports
    ├── config.ts             # Module configuration (REQUIRED)
    ├── models/               # TypeScript types and enums
    │   └── index.ts
    ├── lib/                  # Library code
    │   ├── components/       # Svelte components
    │   └── utils/           # Utility functions
    ├── server/
    │   ├── ai/               # AI tools (optional)
    │   │   └── ai-tools.ts
    │   ├── database/          # Database schema (if has DB)
    │   │   ├── schema/
    │   │   │   ├── index.ts
    │   │   │   └── tables.ts
    │   └── repositories/     # Data access layer
    │       ├── base-repository.ts
    │       └── *.ts
    ├── routes/
    │   ├── ui/               # SvelteKit UI routes
    │   │   ├── +layout.svelte
    │   │   ├── +page.svelte
    │   │   └── */            # Sub-routes
    │   └── api/              # API endpoints
    │       └── +server.ts
    └── stores/               # Svelte stores (Svelte 5 runes)
        └── index.ts
```

**Note**: Modules in the monorepo do NOT need their own `tsconfig.json`, `vite.config.ts`, or `svelte.config.js`. These are handled by the main SvelteKit app.
modules/{module-name}/
├── package.json # @molos/module-{name}
├── drizzle.config.ts # Database migration config
├── drizzle/ # Migration files
├── src/
│ ├── index.ts # Main exports
│ ├── config.ts # Module configuration (REQUIRED)
│ ├── models/ # TypeScript types and enums
│ ├── server/
│ │ ├── database/
│ │ │ └── schema.ts # Drizzle schema
│ │ └── repositories/ # Data access layer
│ ├── routes/
│ │ ├── ui/ # SvelteKit UI routes
│ │ └── api/ # API endpoints
│ ├── components/ # Svelte components
│ └── stores/ # Svelte stores

```

## Module Discovery

Modules are discovered automatically via `import.meta.glob`:

- **Internal modules**: Auto-loaded from `modules/ai/` and `src/lib/config/`
- **Local modules**: Discovered from `modules/*/src/config.ts` in monorepo
- **Production builds**: Modules configured in `modules.config.ts` and fetched during Docker build

## Route Symlinks

SvelteKit requires routes in `src/routes/`, so module routes are symlinked:

```

src/routes/ui/(modules)/(external_modules)/MoLOS-Tasks → modules/MoLOS-Tasks/src/routes/ui
src/routes/api/(external_modules)/MoLOS-Tasks → modules/MoLOS-Tasks/src/routes/api

```

Run `bun run module:sync` to create/update symlinks.

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

| File                      | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| `src/lib/config/index.ts` | Module registry, discovery, and mandatory modules |
| `src/lib/config/types.ts` | ModuleConfig type definition                      |
| `scripts/sync-modules.ts` | Module synchronization                            |
| `scripts/link-modules.ts` | Route symlink creation                            |

## Commands

| Command                    | Description                                 |
| -------------------------- | ------------------------------------------- |
| `bun run dev`              | Start dev (auto-discovers, installs, syncs) |
| `bun run module:sync-deps` | Auto-discover modules only                  |
| `bun run module:sync`      | Sync routes only                            |
| `bun run module:link`      | Link routes only                            |

## Adding Modules

Just drop a module in `modules/` and run `bun run dev` - everything else is automatic.

## Key Constraints

- Use `$lib` alias for imports from main app (not relative paths)
- Use `.js` extension for TypeScript imports in routes
- Module ID must match between config, routes, and database table prefixes
- External modules use `MoLOS-{Name}` ID format
- **Database table naming**: `MoLOS-{ModuleName}_{table_name}` - hyphens in module ID, underscore separator, then table name
