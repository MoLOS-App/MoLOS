# Multi-stage build for optimized image size and security
FROM node:20-slim 

# Install build dependencies for native modules like better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    ca-certificates \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
# We do NOT use --ignore-scripts because better-sqlite3 needs to build its native bindings
RUN npm ci

# Copy the rest of the application
COPY . .
RUN rm -rf external_modules/

# Generate SvelteKit types and build the application
# Cleanup broken module symlinks to avoid sync failures when modules are not present in build
RUN npm run module:cleanup && npx svelte-kit sync && npm run build

WORKDIR /app

# Create data directory for SQLite
RUN mkdir -p /data

RUN chmod -R 775 /app/src
# external_modules is mounted at runtime, so create empty directory
RUN mkdir -p external_modules

# Set production environment
ENV NODE_ENV=production
ENV DATABASE_URL=/data/molos.db
# Expose the port SvelteKit runs on
EXPOSE 4173
RUN mkdir -p /app/external_modules

# Security hardening
RUN chmod +x /app/scripts/entrypoint.sh

# Use the entrypoint script to handle migrations and module refresh
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
