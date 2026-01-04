# Stage 1: Build
FROM node:20-slim

# Install build dependencies for native modules like better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create data directory for SQLite and set permissions
RUN mkdir -p /data
RUN mkdir -p /app/external_modules

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
# We do NOT use --ignore-scripts because better-sqlite3 needs to build its native bindings
RUN npm ci

# Copy the rest of the application
COPY . .

# Generate SvelteKit types and build the application
# Running sync ensures .svelte-kit/tsconfig.json exists for the build
RUN npx svelte-kit sync && npm run build

# Ensure non-root runtime permissions
RUN chown -R node:node /app /data

# Set production environment
ENV NODE_ENV=production
ENV DATABASE_URL=/data/molos.db

# Expose the port SvelteKit runs on
EXPOSE 4173

# Run as non-root user
USER node

# Use the entrypoint script to handle migrations and module refresh
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
