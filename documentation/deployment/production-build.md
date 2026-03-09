# Production Build System

This document describes the MoLOS production build system, which resolves all modules at build time rather than runtime.

## Overview

MoLOS uses a build-time module resolution system where:

1. **Modules are configured** in `modules.config.ts` at the project root
2. **Modules are cloned** from git repositories during the Docker build process
3. **Modules are linked** into the application structure before building
4. **Production image** runs a pre-built application with all modules included

This approach provides:

- **Deterministic builds** - same modules, same version, every time
- **Smaller images** - no git or runtime module management code
- **Better security** - no runtime module fetching or execution
- **Simplified deployment** - just run the container

## Module Configuration

### Configuration File

`modules.config.ts` defines which modules are included in production builds:

```typescript
export interface ModuleConfigEntry {
	id: string; // Module identifier (folder name)
	git: string; // Git repository URL
	tag?: string; // Git tag to checkout (mutually exclusive with branch)
	branch?: string; // Git branch to checkout (mutually exclusive with tag)
	required?: boolean; // If true, build fails if module cannot be cloned
}

export const modulesConfig: ModuleConfigEntry[] = [
	{
		id: 'MoLOS-Tasks',
		git: 'https://github.com/molos-org/MoLOS-Tasks.git',
		tag: 'v1.0.0'
	},
	{
		id: 'MoLOS-MyDevModule',
		git: 'https://github.com/user/MoLOS-MyDevModule.git',
		branch: 'develop' // Use branch instead of tag for development
	}
	// ... more modules
];
```

**Note:** Either `tag` or `branch` must be specified, but not both.

### Adding a Module

1. Open `modules.config.ts`
2. Add a new entry to `modulesConfig` array:

```typescript
{ id: 'MoLOS-MyModule', git: 'https://github.com/user/MoLOS-MyModule.git', tag: 'v1.0.0' }
```

3. Rebuild the image:

```bash
docker build -t molos:latest .
```

### Removing a Module

1. Open `modules.config.ts`
2. Remove the module entry from `modulesConfig` array
3. Rebuild the image

### Updating a Module

1. Open `modules.config.ts`
2. Change the `tag` or `branch` value for the module:

```typescript
// Using a tag
{ id: 'MoLOS-Tasks', git: 'https://github.com/molos-org/MoLOS-Tasks.git', tag: 'v2.0.0' }

// Or using a branch
{ id: 'MoLOS-Tasks', git: 'https://github.com/molos-org/MoLOS-Tasks.git', branch: 'main' }
```

3. Rebuild the image

### Local Development Overrides

For local development, create `modules.config.local.ts` to override `modules.config.ts`:

```typescript
// modules.config.local.ts
export const modulesConfig = [{ id: 'MoLOS-Tasks', git: '../MoLOS-Tasks', branch: 'main' }];
```

This file is git-ignored and won't be committed or built in production images.

## Build Process

### Local Build

To build locally without Docker:

```bash
# Fetch all modules from git
bun run fetch:modules

# Prepare modules (sync deps, link routes, generate types)
bun run build:prepare

# Build the application
bun run build

# Run production build locally (migrations run automatically)
NODE_ENV=production PORT=4173 bun run serve
```

**Note:** The `serve` command automatically runs database migrations before starting the server. This ensures:

- Fresh databases are created with all required tables
- Existing databases are updated with any pending migrations
- The server only starts after successful migration

For manual migration control:

```bash
# Run migrations only
bun run db:migrate

# Then start server
NODE_ENV=production PORT=4173 node build/index.js
```

### Docker Build

The Docker build process:

```dockerfile
# Stage 1: Builder
FROM node:20-slim AS builder

# Install build tools
RUN apt-get update && apt-get install -y git python3 make g++

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy application
COPY . .

# Fetch modules from git
RUN npm run fetch:modules

# Prepare modules for build
RUN npm run build:prepare

# Build application
RUN npm run build

# Stage 2: Production
FROM node:20-slim

# Copy built application
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts/entrypoint.sh ./scripts/entrypoint.sh

# Run migrations and start server
CMD ["sh", "-c", "npm run db:migrate && node build/index.js"]
```

Build the image:

```bash
docker build -t molos:latest .
```

### Kubernetes Deployment

Deploy to Kubernetes using the provided manifests:

```bash
# Set up secrets
kubectl create secret generic molos-secrets \
  --from-literal=better-auth-secret=your-secret-here

# Deploy
kubectl apply -f kubernetes/
```

## Build Scripts

### `bun run fetch:modules`

Clones all modules defined in `modules.config.ts` into the `modules/` directory.

**Process:**

1. Reads `modules.config.ts`
2. Validates each module entry (tag or branch, not both)
3. For each module:
   - Clones to `modules/{id}/` if it doesn't exist
   - Fetches and checks out specified tag or branch
   - Runs `bun install` in module directory
4. Validates required files exist (`package.json`, `src/config.ts`)

**Note:** Migrations are NOT auto-generated during fetch. Modules must include their migrations in the `drizzle/` directory. Use `bun run db:migration:create` to create new migrations manually.

**Options:**

```bash
bun run fetch:modules              # Fetch all modules
bun run fetch:modules --single MoLOS-Tasks  # Fetch specific module
```

### `bun run build:prepare`

Prepares modules for production build.

**Process:**

1. Runs `module:sync-deps` to update workspace dependencies
2. Runs `module:cleanup` to remove broken symlinks
3. Runs `module:sync` to link module routes
4. Runs `svelte-kit sync` to generate types

### `bun run build:prod`

One-command production build that combines all steps:

```bash
bun run build:prod
```

Equivalent to:

```bash
bun run fetch:modules && bun run build:prepare && bun run build
```

## Deployment

### Docker Compose

```bash
docker-compose up -d
```

Configuration in `docker-compose.yml`:

- Maps port 4173 to host
- Mounts `./data` for database persistence
- Runs as non-root user for security

### Docker

```bash
docker run -d \
  -p 4173:4173 \
  -v $(pwd)/data:/data \
  -e DATABASE_URL=file:/data/molos.db \
  -e BETTER_AUTH_SECRET=your-secret \
  molos:latest
```

### Kubernetes

```bash
kubectl apply -f kubernetes/
```

See `kubernetes/` directory for full configuration.

## Environment Variables

### Required

- `DATABASE_URL` - SQLite database path (default: `/data/molos.db`)
- `BETTER_AUTH_SECRET` - Secret for authentication

### Optional

- `NODE_ENV` - Environment (default: `production`)
- `PORT` - Port to run on (default: `4173`)
- `BETTER_AUTH_URL` - Base URL for auth (default: `http://127.0.0.1:4173`)
- `ORIGIN` - Application origin (default: `http://127.0.0.1:4173`)
- `CSRF_TRUSTED_ORIGINS` - Comma-separated list of trusted origins

### Removed (Deprecated)

The following environment variables are no longer used:

- `MOLOS_AUTOLOAD_MODULES` - Modules are configured in `modules.config.ts`
- `FORCE_REBUILD` - No longer needed with build-time resolution
- `MOLOS_ENABLE_PROD_BUILD` - No longer needed

## Module Structure Requirements

Each module must have:

```
modules/{id}/
├── package.json              # Module package definition
├── src/config.ts             # Module configuration
├── src/
│   ├── routes/               # SvelteKit routes (ui, api)
│   ├── server/              # Server-side code
│   ├── components/          # Svelte components
│   ├── stores/              # Svelte stores
│   └── models/              # TypeScript types
└── drizzle.config.ts         # Optional: Database migrations
```

### Required Files

- `package.json` - Defines module metadata and dependencies
- `src/config.ts` - Must export a `ModuleConfig` object with `id`, `name`, `href`, `icon`, `description`

### Optional Files

- `drizzle.config.ts` - If module uses database tables
- `src/routes/` - SvelteKit routes to link into app
- `src/server/` - Server-side code (repositories, API)
- `src/components/` - Reusable components
- `src/stores/` - Svelte stores
- `src/models/` - TypeScript types and interfaces

## Troubleshooting

### Build Fails: Module Not Found

**Error:** `Module MoLOS-Example not found in modules.config.ts`

**Solution:**

- Verify the module ID in `modules.config.ts` matches the folder name
- Check the git URL is correct and accessible

### Build Fails: Git Clone Failed

**Error:** `Failed to clone MoLOS-Tasks: fatal: repository not found`

**Solution:**

- Verify git URL is correct
- Check you have access to the repository
- For private repositories, ensure git credentials are configured

### Build Fails: Missing Required Files

**Error:** `package.json not found` or `src/config.ts not found`

**Solution:**

- Verify the cloned module has required files
- Check the tag/branch points to a valid commit with module structure

### Docker Build Caches Old Module Version

**Problem:** After changing module tag, Docker uses cached version

**Solution:**

```bash
docker build --no-cache -t molos:latest .
```

Or use buildkit with specific cache invalidation:

```bash
DOCKER_BUILDKIT=1 docker build \
  --build-arg MODULE_CONFIG_SHA=$(sha256sum modules.config.ts) \
  -t molos:latest .
```

### Module Routes Return 404

**Problem:** After adding a module, routes return 404

**Solution:**

- Verify `module:sync` linked the routes correctly
- Check `src/routes/ui/(modules)/(external_modules)/{id}/` symlink exists
- Run `npm run build:prepare` and rebuild

### Database Migrations Fail

**Problem:** Migrations fail on container startup

**Solution:**

- Check database file permissions: `ls -l /data/molos.db`
- Ensure `/data` directory exists and is writable
- Check `node_modules/better-sqlite3` was built correctly
- Run `bun run db:migrate` manually to see detailed error output

**Note:** Migrations run automatically before every server start via the `serve` script. This ensures the database schema is always up-to-date. The unified migration runner (`packages/database/src/migrate-unified.ts`) handles:

- Creating the database directory if missing
- Creating the database file if missing
- Applying core migrations (user, session, settings tables)
- Applying module migrations
- Validating required tables exist

### Module Not in Sidebar

**Problem:** Module is built but doesn't appear in app sidebar

**Solution:**

- Verify `src/config.ts` has correct `id`, `name`, `href`, `icon`, `description`
- Check module is included in `modules.config.ts`
- Run `npm run build:prepare` to ensure module is linked
- Rebuild the image

## Security Considerations

1. **Non-root user** - Container runs as non-root user for security
2. **Read-only root** - Only `/data` is writable for database
3. **No git in production** - Git is not installed in production image
4. **No runtime module fetching** - Modules are fixed at build time
5. **Minimal attack surface** - Only essential packages in production image

## Migration from Legacy System

### Before (Runtime Module Resolution)

- Modules in `external_modules/` directory
- Fetched at container startup
- Supervisor managed builds and syncs
- Environment variables to control module loading
- Complex deployment with volume mounts

### After (Build-Time Module Resolution)

- Modules in `modules.config.ts`
- Fetched during Docker build
- No supervisor, direct execution of built app
- Simple configuration file
- Deterministic deployments

### Migration Steps

1. **Backup data:** `cp data/molos.db data/.db_backups/molos.db.backup`
2. **Create modules.config.ts:** Add your modules from `external_modules/`
3. **Update Dockerfile:** Use new multi-stage build
4. **Remove external_modules volume:** Update docker-compose.yml
5. **Remove supervisor:** Delete `scripts/supervisor.ts`
6. **Test locally:** `bun run build:prod && docker build -t molos:test .`
7. **Deploy:** Push new image and redeploy

## Support

For issues or questions:

- Check this documentation first
- Review `documentation/module-improvements.md` for module system details
- Open an issue on GitHub
