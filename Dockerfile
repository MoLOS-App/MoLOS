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

# Prepare modules for build (cleanup, link routes, generate types)
# Uses npx tsx because sync-modules.ts uses better-sqlite3
RUN npx tsx scripts/build-modules.ts

# Build application
RUN bun run build

# Production stage - use minimal runtime image
FROM oven/bun:latest

WORKDIR /app

# Install nodejs for running the server (better-sqlite3 native module)
# and wget for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    npm \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy built application from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts/entrypoint.sh ./scripts/entrypoint.sh

# Create data directory for SQLite and subdirectories
RUN mkdir -p /data/.db_backups /data/modules

# Set permissions
RUN chmod +x /app/scripts/entrypoint.sh

# Set production environment
ENV NODE_ENV=production
ENV DATABASE_URL=/data/molos.db
ENV BACKUP_DIR=/data/.db_backups
ENV MOLOS_MODULE_DATA_DIR=/data/modules

# Expose port SvelteKit runs on
EXPOSE 4173

# Security hardening - run as non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app /data
USER appuser

# Use the entrypoint script to handle migrations and start the server
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
