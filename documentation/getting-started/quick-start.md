# MoLOS Quick Start

- Repo root: /home/eduardez/Workspace/MoLOS-org/MoLOS
- Dev server: `bun run dev`
- Module sync: `bun run module:sync`
- Module commands:
  - `bun run module:sync` - Sync and initialize modules
  - `bun run module:link` - Create route symlinks
- Database:
  - `bun run db:push` - Push schema changes (dev)
  - `bun run db:migrate` - Run migrations
  - `bun run db:generate` - Generate migrations
  - `bun run db:studio` - Open Drizzle Studio

Notes
- Use tabs, single quotes, printWidth 100 (Prettier).
- Prefer server-side data loading via +page.server.ts or load.
