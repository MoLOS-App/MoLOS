# Production Build System Changes - Implementation Summary

This document summarizes all changes made to implement the build-time module resolution system.

## Files Created

### 1. `modules.config.ts`

**Purpose**: Central configuration for all modules included in production builds.

**Key features**:

- Defines `ModuleConfigEntry` interface with `id`, `git`, `tag`, and optional `required` fields
- Lists all 10 MoLOS modules (MoLOS-Tasks, MoLOS-Goals, etc.)
- Internal `ai` module is NOT included (it's in the monorepo)
- Well-documented with examples for adding/removing modules

**Usage**: Developers edit this file to add, remove, or update modules.

### 2. `scripts/fetch-modules.ts`

**Purpose**: Clone modules from git repositories based on `modules.config.ts`.

**Key features**:

- Reads `modules.config.ts` and fetches all defined modules
- For each module:
  - Clones to `modules/{id}/` if it doesn't exist
  - Updates and checks out the specified tag/branch
  - Runs `npm install` in module directory
  - Runs `drizzle-kit generate` if module has a drizzle config
  - Validates required files exist (`package.json`, `src/config.ts`)
- Supports single module fetching: `bun run fetch:modules --single <id>`
- Gracefully handles optional module failures
- Fails build if required module cannot be cloned
- Comprehensive logging with timestamps and status indicators

### 3. `scripts/build-modules.ts`

**Purpose**: Prepare modules for production build.

**Key features**:

- Runs `module:sync-deps` to update workspace dependencies
- Runs `module:cleanup` to remove broken symlinks
- Runs `module:sync` to link module routes into app structure
- Runs `svelte-kit sync` to generate TypeScript types
- Validates all steps and fails build if any required step fails
- Simple, clear logging for each step

### 4. `documentation/production-build.md`

**Purpose**: Comprehensive documentation for the production build system.

**Contents**:

- Overview of build-time module resolution
- Module configuration format and examples
- Local build instructions
- Docker build process details
- Kubernetes deployment guide
- Environment variable reference
- Module structure requirements
- Troubleshooting guide
- Security considerations
- Migration guide from legacy system
- Support information

## Files Modified

### 1. `package.json`

**Changes**:

- Added `build:prod` script: `npm run fetch:modules && npm run build:prepare && npm run build`
- Added `fetch:modules` script: `tsx scripts/fetch-modules.ts`
- Added `fetch:modules:single` script: `tsx scripts/fetch-modules.ts --single`
- Added `build:prepare` script: `tsx scripts/build-modules.ts`
- Changed `serve` script: `node build/index.js` (was `tsx scripts/supervisor.ts`)

**Removed**: No longer needed `module:link` script (kept for compatibility)

### 2. `Dockerfile`

**Changes**:

- Converted to explicit multi-stage build with `AS builder`
- Added git installation in builder stage (required for fetching modules)
- Added module fetching step: `RUN npm run fetch:modules`
- Added module preparation step: `RUN npm run build:prepare`
- Removed all references to `external_modules`
- Removed supervisor invocation
- Simplified production stage to just copy built application
- Added security hardening: run as non-root user
- Removed `.svelte-kit` tmpfs (no runtime rebuilds needed)

**New structure**:

```dockerfile
# Stage 1: Builder - installs dependencies, fetches modules, builds app
FROM node:20-slim AS builder

# Stage 2: Production - copies only built files, runs as non-root
FROM node:20-slim
```

### 3. `scripts/entrypoint.sh`

**Changes**:

- Removed external_modules refresh logic
- Removed module sync logic
- Removed supervisor invocation
- Simplified to:
  - Set up database directory
  - Run database migrations
  - Start built application directly with `node build/index.js`

**Old flow**: Database → Migrations → Module Sync → Supervisor → App
**New flow**: Database → Migrations → App

### 4. `vite.config.ts`

**Changes**:

- Removed hard-coded module aliases for each module
- Kept core package aliases (`@molos/core`, `@molos/database`, etc.)
- Module discovery now relies on dynamic `import.meta.glob` in `src/lib/config/index.ts`

**Removed aliases**:

- `@molos/module-tasks`
- `@molos/module-ai`
- `@molos/module-ai-knowledge`
- `@molos/module-google`
- `@molos/module-sample`

### 5. `docker-compose.yml`

**Changes**:

- Removed `external_modules` volume mount
- Removed `MOLOS_AUTOLOAD_MODULES` environment variable
- Removed `MOLOS_ENABLE_PROD_BUILD` environment variable
- Removed `BETTER_AUTH_SECRET_FILE` environment variable
- Removed `.svelte-kit` tmpfs (no runtime rebuilds)
- Simplified to essential configuration

### 6. `kubernetes/deployment.yaml`

**Changes**:

- Removed `external_modules` volume mount
- Removed `MOLOS_AUTOLOAD_MODULES` environment variable
- Removed `FORCE_REBUILD` environment variable
- Removed `MOLOS_ENABLE_PROD_BUILD` environment variable
- Removed `BETTER_AUTH_SECRET_FILE` environment variable
- Simplified to essential environment variables

### 7. `.dockerignore`

**Changes**:

- Added `modules/` directory (modules are cloned during build)
- Added `modules.config.local.ts` (developer local overrides)
- Removed outdated references to `external_modules` subpaths
- Simplified to essential ignores

### 8. `.gitignore`

**Changes**:

- Added `modules.config.local.ts` for developer local overrides

### 9. `README.md`

**Changes**:

- Updated Quick Start section:
  - Removed `./molos_data/db` directory creation
  - Removed `./molos_data/external_modules` directory creation
  - Updated to use `./data` directory
  - Removed external_modules volume mount from example command
  - Removed `MOLOS_AUTOLOAD_MODULES` environment variable
  - Removed `FORCE_REBUILD` environment variable
- Updated "Modular system" section:
  - Added reference to `modules.config.ts`
  - Explained build-time module resolution
  - Added link to production build documentation
- Added "Module Configuration" section for developers

## Files Deleted

### 1. `scripts/supervisor.ts`

**Reason**: Supervisor was used for runtime module synchronization and rebuilds. With build-time module resolution, the production image directly runs the pre-built application. No supervisor needed.

## Key Architectural Changes

### Before (Runtime Module Resolution)

```
Development:
  modules/          → git repos (local development)
  external_modules/  → git repos (runtime)

Build:
  Build app → Package → Docker image

Runtime (Docker):
  Start → Database migrations → Fetch external_modules → Link modules → Supervisor → App
                                                          ↓
                                                    Rebuild if modules change
```

### After (Build-Time Module Resolution)

```
Development:
  modules/          → git repos (local development)
  modules.config.ts → Configuration file

Build:
  Fetch modules → Link modules → Build app → Package → Docker image

Runtime (Docker):
  Start → Database migrations → App
```

### Benefits

1. **Deterministic builds** - Same modules, same version, every time
2. **Smaller images** - No git, supervisor, or runtime module management
3. **Better security** - No runtime module fetching or code execution
4. **Simpler deployment** - Just run the container
5. **Faster startup** - No module cloning or linking at runtime
6. **Version control** - Module versions tracked in `modules.config.ts`

## Testing Checklist

- [x] `modules.config.ts` created and properly formatted
- [x] `scripts/fetch-modules.ts` created with proper error handling
- [x] `scripts/build-modules.ts` created with step validation
- [x] `package.json` updated with new scripts
- [x] `Dockerfile` updated for multi-stage build
- [x] `scripts/entrypoint.sh` simplified
- [x] `vite.config.ts` module aliases removed
- [x] `docker-compose.yml` simplified
- [x] Kubernetes deployment updated
- [x] `.dockerignore` updated
- [x] `.gitignore` updated
- [x] `scripts/supervisor.ts` deleted
- [x] Documentation created
- [x] README updated
- [ ] Local build test: `bun run build:prod`
- [ ] Docker build test: `docker build -t molos:test .`
- [ ] Docker run test: `docker run molos:test`
- [ ] Kubernetes deployment test

## Next Steps for Testing

1. **Local Build Test**:

   ```bash
   bun run build:prod
   ```

2. **Docker Build Test**:

   ```bash
   docker build -t molos:test .
   ```

3. **Docker Run Test**:

   ```bash
   docker run -p 4173:4173 -v $(pwd)/data:/data molos:test
   ```

4. **Docker Compose Test**:

   ```bash
   docker-compose up -d
   ```

5. **Kubernetes Test**:
   ```bash
   kubectl apply -f kubernetes/
   ```

## Developer Migration Guide

For developers switching to the new build system:

1. **Create `modules.config.ts`** (already done in this implementation)
2. **Move modules from `external_modules/` to `modules/`** if you have local development modules
3. **Update `modules.config.ts`** to include your local modules
4. **Run `bun run build:prod`** to test locally
5. **Update CI/CD pipelines** to use `npm run build:prod` instead of legacy build commands
6. **Update deployment scripts** to remove external_modules volume mounts

## Breaking Changes

### For Users

- **external_modules volume mount removed**: Users can no longer add modules at runtime
- **Module config changed**: No longer use environment variables; edit `modules.config.ts` instead
- **Smaller but immutable images**: Images are smaller but modules cannot be changed without rebuilding

### For Developers

- **Module aliases removed**: Vite config no longer has hard-coded module aliases
- **Supervisor removed**: Use `node build/index.js` directly
- **Build process changed**: Use `bun run build:prod` for production builds

## Rollback Plan

If issues arise, rollback steps:

1. **Restore supervisor**: Restore `scripts/supervisor.ts` from git history
2. \*\*Restore vite.config.ts`: Revert to version with module aliases
3. **Restore Dockerfile**: Revert to previous multi-stage build
4. **Restore entrypoint.sh**: Revert to version with external_modules logic
5. **Restore docker-compose.yml**: Revert external_modules volume mount
6. **Restore Kubernetes manifests**: Revert external_modules volume mount

**Git commands for rollback**:

```bash
git checkout HEAD~1 Dockerfile
git checkout HEAD~1 scripts/entrypoint.sh
git checkout HEAD~1 vite.config.ts
git checkout HEAD~1 docker-compose.yml
git checkout HEAD~1 kubernetes/deployment.yaml
git checkout HEAD~1 scripts/supervisor.ts
```

## Support

For issues or questions:

- Review `documentation/production-build.md`
- Check troubleshooting section in production build docs
- Open an issue on GitHub

---

**Implementation Date**: 2025-02-24
**Implemented By**: opencode AI assistant
