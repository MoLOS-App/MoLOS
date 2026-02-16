# Module System (Codex)

MoLOS uses a package-based module system where all modules live in the `modules/` directory and are imported via workspace packages.

## Module Layout

Modules live in `modules/<module-id>/` with the following structure:

```
modules/my-module/
├── package.json           # @molos/module-my-module
├── manifest.yaml          # Module metadata
├── src/
│   ├── index.ts          # Module exports
│   ├── config.ts         # Module configuration (navigation, etc.)
│   ├── lib/              # Library code
│   │   ├── components/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── stores/
│   │   ├── utils/
│   │   └── server/
│   │       ├── ai/       # AI tools
│   │       └── db/       # Database schema
│   └── routes/           # SvelteKit routes
│       ├── ui/
│       └── api/
```

## Route Symlinks

Since SvelteKit requires routes to be in `src/routes/`, module routes are symlinked:

- `src/routes/ui/(modules)/(external_modules)/<MODULE_ID>` → `modules/<module-id>/src/routes/ui`
- `src/routes/api/(external_modules)/<MODULE_ID>` → `modules/<module-id>/src/routes/api`

## Module Discovery

Modules are discovered automatically via `import.meta.glob`:

- **Config files**: `modules/*/src/config.ts` - loaded eagerly for navigation
- **AI tools**: `modules/*/src/lib/server/ai/ai-tools.ts` - loaded when module is active

### Autoload Filtering

Use `VITE_MOLOS_AUTOLOAD_MODULES` to filter which modules load:

```bash
# Load all modules (default)
VITE_MOLOS_AUTOLOAD_MODULES=

# Load specific modules only
VITE_MOLOS_AUTOLOAD_MODULES=tasks,goals
```

### Mandatory Modules

Some modules are mandatory and always load regardless of the filter:

- `dashboard` - Core dashboard functionality
- `ai` - AI assistant interface

These cannot be filtered out by the environment variable.

## Importing from Modules

Use the package imports for clean dependency management:

```typescript
// Import module config
import { moduleConfig } from '@molos/module-my-module/config';

// Import from module's lib (via relative paths within the module)
import { MyRepository } from '../../../lib/repositories/my-repository.js';
```

## Module Management

- **Sync script**: `bun run module:sync` - Syncs and initializes modules
- **Link script**: `bun run module:link` - Creates route symlinks
- **Manager**: `module-management/server/core-manager.ts`

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/config/index.ts` | Module registry and discovery |
| `src/lib/server/ai/toolbox.ts` | AI tools loading from modules |
| `vite.config.ts` | Module aliases for `@molos/module-*` |
| `module-management/server/initialization.ts` | Module lifecycle management |

## Key Constraints

- Do not use `src/lib/modules` or `src/lib/config/modules` (legacy)
- Module routes are symlinked to `src/routes/` (required by SvelteKit)
- Module lib code uses relative imports within the module
- Use `.js` extensions for TypeScript imports in routes
