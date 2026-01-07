#!/bin/bash
set -e

echo "[Entrypoint] Starting MoLOS Production Environment..."

# 1. Refresh External Modules (as requested: remove and clone/copy again)
# In a real production scenario with Git, you might do 'git clone' here.
# For now, we ensure the directory exists and is clean.
echo "[Entrypoint] Refreshing external modules..."
# Note: In Docker, external_modules are baked in, but we can re-link or refresh if needed.
# If users mount a volume to /app/external_modules, this will handle it.

# 2. Run Database Migrations
echo "[Entrypoint] Running database migrations..."
DB_PATH="${DATABASE_URL#file:}"
if [ -z "$DB_PATH" ]; then
  echo "[Entrypoint] DATABASE_URL is not set; skipping migrations."
else
  npm run db:migrate || echo "[Entrypoint] Migrations failed or none available; continuing."
fi

# 3. Start the application
echo "[Entrypoint] Starting MoLOS server..."
npm run serve
