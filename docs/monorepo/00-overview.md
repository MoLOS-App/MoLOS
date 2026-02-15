# MoLOS Monorepo Architecture Documentation

## Executive Summary

This documentation series describes the architectural evolution of MoLOS from a multi-repository structure with symlink-based module integration to a unified monorepo architecture using npm workspaces. The monorepo approach provides better dependency management, simplified development workflows, and more robust module isolation while preserving the flexibility that makes MoLOS powerful.

## Why Monorepo?

### The Current Challenge

MoLOS currently uses a **multi-repo + symlink architecture**:

```
MoLOS/                          # Main application
├── external_modules/           # Git submodules or cloned repos
│   ├── MoLOS-Product-Owner/   # Separate repository
│   ├── MoLOS-Tasks/           # Separate repository
│   └── ...
└── src/
    └── (symlinks to external_modules/*)
```

**Pain Points:**
- Complex symlink management during development
- Version mismatches between core and modules
- Difficult to coordinate breaking changes
- Manual synchronization required
- Testing across module boundaries is cumbersome

### The Monorepo Solution

A **unified monorepo with npm workspaces**:

```
MoLOS/
├── apps/
│   └── web/                    # Main SvelteKit application
├── packages/
│   ├── core/                   # Shared core utilities
│   ├── ui/                     # Shared UI components
│   └── database/               # Database schema and utilities
└── modules/
    ├── product-owner/          # Product Owner module
    ├── tasks/                  # Tasks module
    └── ...
```

## Key Benefits

| Aspect | Current (Multi-repo + Symlinks) | Monorepo |
|--------|--------------------------------|----------|
| **Dependency Management** | Each module manages own deps | Shared deps, no duplication |
| **Version Control** | Multiple repos, complex sync | Single source of truth |
| **Breaking Changes** | Hard to coordinate | Atomic commits across packages |
| **CI/CD** | Separate pipelines | Unified pipeline |
| **Code Sharing** | Via symlinks (fragile) | Via npm packages (robust) |
| **Testing** | Per-module only | Cross-module integration tests |
| **IDE Support** | Multiple project roots | Single workspace |

## Tradeoffs

### What We Gain
- **Simplified dependency management** - One `package.json` for shared deps
- **Atomic changes** - Update core and modules in one commit
- **Better tooling** - Standard monorepo tools (Turbo, Nx, pnpm workspaces)
- **Improved DX** - Single clone, single install

### What We Accept
- **Larger repository** - All code in one place
- **Unified versioning** - Can't independently version modules (unless using independent mode)
- **Team coordination** - More merge conflicts potential
- **Build complexity** - Need to manage build order

## High-Level Migration Timeline

```
Phase 1: Foundation (Week 1-2)
├── Set up monorepo structure
├── Configure npm workspaces
└── Migrate core packages

Phase 2: Module Migration (Week 3-4)
├── Convert symlink structure to packages
├── Update import paths
└── Test module functionality

Phase 3: Database Consolidation (Week 5)
├── Unified migration system
├── Schema namespacing
└── Data migration scripts

Phase 4: CI/CD & Tooling (Week 6)
├── Update build pipelines
├── Configure Turborepo/pnpm
└── Add integration tests

Phase 5: Documentation & Cleanup (Week 7)
├── Update developer guides
├── Remove legacy scripts
└── Archive old repositories
```

## Who Should Read What

| Role | Recommended Reading |
|------|---------------------|
| **Developer (New to MoLOS)** | Start with `01-architecture.md`, then `03-module-development.md` |
| **Existing Contributor** | `02-migration-guide.md` is essential, then `01-architecture.md` |
| **DevOps/SRE** | Focus on `06-deployment.md` and `02-migration-guide.md` |
| **Product Owner** | `07-saas-strategy.md` for business implications |
| **Security Engineer** | `05-module-interaction.md` for security boundaries |
| **Module Developer** | `03-module-development.md` and `04-module-activation.md` |

## Documentation Overview

### 1. [Architecture](./01-architecture.md)
Deep dive into the new directory structure, npm workspaces mechanics, module loading, and build system.

### 2. [Migration Guide](./02-migration-guide.md)
Step-by-step instructions for migrating from the current symlink-based system to the monorepo.

### 3. [Module Development](./03-module-development.md)
How to create, structure, and test modules in the new architecture.

### 4. [Module Activation](./04-module-activation.md)
Configuration and runtime management of module activation.

### 5. [Module Interaction](./05-module-interaction.md)
Event bus system, data namespacing, and cross-module communication patterns.

### 6. [Deployment](./06-deployment.md)
Docker/Podman deployment, production configuration, and version management.

### 7. [SaaS Strategy](./07-saas-strategy.md)
Self-hosted vs SaaS offerings, module marketplace, and pricing considerations.

## Quick Start

If you're eager to start developing:

```bash
# Clone the monorepo
git clone https://github.com/MoLOS-org/MoLOS.git
cd MoLOS

# Install dependencies (npm workspaces handles everything)
npm install

# Run development server
npm run dev

# Run tests for all packages
npm run test

# Build everything
npm run build
```

## Getting Help

- **GitHub Issues**: [MoLOS Issues](https://github.com/MoLOS-org/MoLOS/issues)
- **Documentation**: This folder (`docs/monorepo/`)
- **Architecture Questions**: See `01-architecture.md`
- **Migration Problems**: See `02-migration-guide.md`

---

*Last Updated: 2025-02-15*
*Version: 1.0*
