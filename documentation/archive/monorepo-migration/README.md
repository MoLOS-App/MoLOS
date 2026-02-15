# Parallel Migration Tasks for MoLOS Monorepo

## ✅ MIGRATION STATUS: COMPLETE (All branches merged)

**Last Verified**: Feb 15, 2026

### Final Merge Status

| Agent | Task | Branch | Work Done | Merged |
|-------|------|--------|-----------|--------|
| 1 | Core Foundation | `feature/core` | ✅ Yes | ✅ **MERGED** |
| 2 | Module Conversion | `feature/modules` | ✅ Yes | ✅ **MERGED** |
| 3 | Database Migration | `feature/database` | ✅ Yes | ✅ **MERGED** |
| 4 | UI Integration | `feature/core` | ✅ Yes | ✅ **MERGED** |

### Current develop branch state
```bash
$ ls packages/
core/  database/  ui/          # ✅ All packages merged

$ ls modules/
ai/  tasks/                    # ✅ Module packages merged

$ ls turbo.json tsconfig.base.json
turbo.json  tsconfig.base.json # ✅ Monorepo configs merged
```

### Package Summary

| Package | Location | Description |
|---------|----------|-------------|
| `@molos/core` | `packages/core/` | Core utilities and types |
| `@molos/database` | `packages/database/` | Database schema and connection |
| `@molos/ui` | `packages/ui/` | UI components (57 components) |
| `@molos/module-tasks` | `modules/tasks/` | Tasks module |
| `@molos/module-ai` | `modules/ai/` | AI module |

### Migration Complete

The monorepo migration is **complete**. All feature branches have been merged to develop.

---

## Overview

This directory contains task files documenting the 4-agent parallel migration that converted MoLOS from a single SvelteKit app to a Turborepo monorepo.

## Quick Start

### 1. Create Git Worktrees

```bash
# From the main MoLOS repository
cd /home/eduardez/Workspace/MoLOS-org/MoLOS

# Agent 1: Core Foundation
git worktree add ../MoLOS-core -b feature/core

# Agent 2: Module Conversion
git worktree add ../MoLOS-modules -b feature/modules

# Agent 3: Database Migration
git worktree add ../MoLOS-database -b feature/database

# Agent 4: UI Integration
git worktree add ../MoLOS-ui -b feature/ui
```

### 2. Launch Agents

```bash
# Terminal 1 (Agent 1 - Core)
cd /home/eduardez/Workspace/MoLOS-org/MoLOS-core
claude

# Terminal 2 (Agent 2 - Modules)
cd /home/eduardez/Workspace/MoLOS-org/MoLOS-modules
claude

# Terminal 3 (Agent 3 - Database)
cd /home/eduardez/Workspace/MoLOS-org/MoLOS-database
claude

# Terminal 4 (Agent 4 - UI)
cd /home/eduardez/Workspace/MoLOS-org/MoLOS-ui
claude
```

## Agent Assignment Table

| Agent | Worktree | Branch | Task File | Focus Area |
|-------|----------|--------|-----------|------------|
| 1 | `../MoLOS-core` | `feature/core` | `AGENT-1-CORE-FOUNDATION.md` | Monorepo setup, Turborepo, root configs |
| 2 | `../MoLOS-modules` | `feature/modules` | `AGENT-2-MODULE-CONVERSION.md` | Convert external modules to packages |
| 3 | `../MoLOS-database` | `feature/database` | `AGENT-3-DATABASE-MIGRATION.md` | Extract database schema to package |
| 4 | `../MoLOS-ui` | `feature/ui` | `AGENT-4-UI-INTEGRATION.md` | Extract shared UI components |

## Task Files

```
TASKS/
├── README.md                           (this file)
├── AGENT-1-CORE-FOUNDATION.md          Agent 1: Monorepo foundation
├── AGENT-2-MODULE-CONVERSION.md        Agent 2: Module package conversion
├── AGENT-3-DATABASE-MIGRATION.md       Agent 3: Database package extraction
└── AGENT-4-UI-INTEGRATION.md           Agent 4: UI component extraction
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  4-Agent Parallel Migration                     │
│                                                                  │
│  Agent 1              Agent 2              Agent 3              Agent 4
│  ┌─────────┐         ┌─────────┐         ┌─────────┐         ┌─────────┐
│  │  Core   │         │ Module  │         │Database │         │   UI    │
│  │Packages │         │Convert  │         │ Migrate │         │Integrate│
│  └─────────┘         └─────────┘         └─────────┘         └─────────┘
│                                                                  │
│  Foundation:         Modules:            Database:          Components:
│  - Monorepo setup    - Product-Owner     - Schema extract   - Shared UI
│  - Turborepo         - Module utils      - Migrations       - Theme
│  - Root configs      - Import paths      - Namespacing      - Navigation
│                                                                  │
│  Shared: SQLite database at ../MoLOS/molos.db                  │
│  Branches: feature/core, feature/modules, feature/db, feature/ui│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Target Monorepo Structure

```
MoLOS/
├── package.json              # Root with workspaces
├── turbo.json                # Turborepo configuration
├── tsconfig.base.json        # Shared TypeScript config
├── packages/
│   ├── core/                 # @molos/core (Agent 1)
│   │   ├── src/
│   │   │   ├── utils/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   └── package.json
│   ├── database/             # @molos/database (Agent 3)
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── core/
│   │   │   │   └── external/
│   │   │   └── index.ts
│   │   ├── drizzle/
│   │   └── package.json
│   └── ui/                   # @molos/ui (Agent 4)
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/
│       │   │   └── shared/
│       │   └── index.ts
│       └── package.json
├── modules/                  # @molos/module-* (Agent 2)
│   └── product-owner/
│       ├── src/
│       ├── manifest.yaml
│       └── package.json
└── apps/
    └── web/                  # Main SvelteKit app
        ├── src/
        └── package.json
```

## Dependencies Between Tasks

```
Agent 1 (Core) ─────────────────────────────────┐
       │                                         │
       ▼                                         ▼
Agent 3 (Database)                        Agent 4 (UI)
       │                                         │
       │◄────────────────────────────────────────┘
       │
       ▼
Agent 2 (Modules)
       │
       │ (depends on core, database, ui packages)
       ▼
  Integration Testing
```

## Shared Resources

- **Database**: All agents use `../MoLOS/molos.db` (main repo's database)
- **Node Modules**: Each worktree has its own `node_modules/`
- **Documentation**: Reference `docs/monorepo/*.md` for context

## Merge Strategy

### Order of Merging

1. **Core Foundation (Agent 1)** - Base for all other packages
2. **Database Migration (Agent 3)** - Depends on core
3. **UI Integration (Agent 4)** - Depends on core
4. **Module Conversion (Agent 2)** - Depends on core, database, and UI

### Merge Process

```bash
# After an agent completes their task:

# 1. In the worktree, commit changes
git add .
git commit -m "feat: [description of changes]"

# 2. Push to remote
git push origin [branch-name]

# 3. Create PR or merge directly to develop
# In main repo:
git checkout develop
git merge [branch-name] --no-ff

# 4. Other agents pull latest
# In each worktree:
git pull origin develop
```

### Conflict Resolution

- **Core configs**: Agent 1's changes take precedence
- **Package imports**: Use Agent 1's package naming conventions
- **Database schema**: Agent 3's schema structure wins
- **UI components**: Agent 4's component organization wins

## Verification Checklist

After all tasks complete:

```bash
# 1. Install dependencies
npm install

# 2. Build all packages
npm run build

# 3. Run tests (if available)
npm run test

# 4. Start dev server
npm run dev

# 5. Verify:
# - Modules load correctly
# - Database connections work
# - UI components render
# - Navigation functions
```

## Critical Files Reference

| File | Purpose | Agent |
|------|---------|-------|
| `module-management/config/symlink-config.ts` | Current symlink configuration | Agent 2 |
| `module-management/build/linker.ts` | Module linker utility | Agent 2 |
| `external_modules/MoLOS-Product-Owner/` | Example external module | Agent 2 |
| `vite.config.ts` | Vite configuration | Agent 1, 4 |
| `package.json` | Root package configuration | Agent 1 |
| `src/lib/server/db/schema/` | Database schema files | Agent 3 |
| `src/lib/components/ui/` | UI components (80+) | Agent 4 |

## Communication Protocol

### Status Updates

Each agent should update their task file with:
- [x] Completed steps
- [ ] Pending steps
- Blockers encountered
- Decisions made

### Coordination Points

1. **After Agent 1 completes**: Notify others of package names and structure
2. **After Agent 3 & 4 complete**: Notify Agent 2 of export paths
3. **Before Agent 2 completes**: Verify all imports work with new packages

## Troubleshooting

### Worktree Issues

```bash
# List worktrees
git worktree list

# Remove a worktree
git worktree remove ../MoLOS-core

# Prune stale worktrees
git worktree prune
```

### Dependency Issues

```bash
# Clear node_modules in worktree
rm -rf node_modules
npm install

# Link local packages
npm run build  # Build packages first
```

### Merge Conflicts

```bash
# Abort merge and try again
git merge --abort

# View conflict files
git status

# Resolve and commit
git add .
git commit
```
