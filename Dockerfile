# Multi-stage build for optimized image size and security
FROM oven/bun:latest AS builder

# Install minimal build dependencies for native modules like better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    git \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source code (modules/ is excluded by .dockerignore)
COPY . .

# Clean up stale symlinks (they point to modules not yet fetched)
RUN bun scripts/cleanup-module-symlinks.ts

# Remove workspace module dependencies from package.json temporarily
# They will be re-added by module:sync-deps after modules are fetched
RUN node scripts/clean-workspace-deps.js

# Install root dependencies first
RUN bun install

# Fetch modules from git based on modules.config.ts (only configured modules)
RUN bun scripts/fetch-modules.ts

# Sync module dependencies to workspace (updates package.json with workspace:* deps)
RUN bun scripts/sync-workspace-modules.ts

# Re-install to include fetched modules as workspace dependencies
RUN bun install

# Prepare modules for build (cleanup, link routes)
RUN npx tsx scripts/build-modules.ts

# Build application
RUN bun run build

# Production stage - use minimal runtime image
FROM oven/bun:latest

WORKDIR /app

# Install runtime dependencies:
# - nodejs: for running the server (better-sqlite3 native module)
# - wget: for healthchecks
# - ca-certificates: for SSL/TLS verification (HTTPS requests)
# - gosu: for dropping privileges after fixing permissions
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    wget \
    ca-certificates \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Copy built application from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/database/drizzle ./packages/database/drizzle
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/modules ./modules
COPY --from=builder /app/scripts/entrypoint.sh ./scripts/entrypoint.sh

# Create data directory for SQLite and subdirectories
RUN mkdir -p /data/.db_backups /data/modules

# Set permissions on app directory (data directory permissions handled by entrypoint)
RUN chmod +x /app/scripts/entrypoint.sh && \
    chown -R bun:bun /app

# Set production environment
ENV NODE_ENV=production
ENV DATABASE_URL=/data/molos.db
ENV BACKUP_DIR=/data/.db_backups
ENV MOLOS_MODULE_DATA_DIR=/data/modules

# Expose port SvelteKit runs on
EXPOSE 4173

# The container starts as root to fix volume permissions, then drops to bun user
# See entrypoint.sh for the privilege drop logic
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
