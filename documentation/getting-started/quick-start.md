# MoLOS Quick Start (Codex)

- Repo root: /home/eduardez/Workspace/MoLOS-org/MoLOS
- Dev server: npm run dev
- Module sync: npm run modules:sync
- Module create/validate/test:
  - npm run module:create <name>
  - npm run module:validate <path>
  - npm run module:test <path>
- Database:
  - npm run db:push | db:migrate | db:generate | db:reset | db:studio

Notes
- Use tabs, single quotes, printWidth 100 (Prettier).
- Prefer server-side data loading via +page.server.ts or load.
