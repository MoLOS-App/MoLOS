# MoLOS Documentation

Welcome to the MoLOS (Modular Life Organization System) documentation. MoLOS v1.0.0 is a fast, privacy-focused, and deeply modular productivity suite designed to help you reclaim your focus.

## Quick Links

| I want to...                    | Go to                                                       |
| ------------------------------- | ----------------------------------------------------------- |
| Get started quickly             | [Quick Start](./getting-started/quick-start.md)             |
| See command reference           | [Quick Reference](./QUICK-REFERENCE.md)                     |
| AI context loading              | [AI Context](./AI-CONTEXT.md)                               |
| Learn about docs                | [AI Documentation Guide](./AI-DOCUMENTATION-GUIDE.md)       |
| Understand the architecture     | [Architecture Overview](./architecture/overview.md)         |
| Create a module                 | [Module Development](./modules/development.md)              |
| Write tests                     | [Testing Guide](./getting-started/testing-comprehensive.md) |
| Deploy MoLOS (Docker)           | [Docker Deployment](./deployment/docker.md)                 |
| Deploy MoLOS (Production Build) | [Production Build Guide](./deployment/production-build.md)  |
| Release a new version           | [Release System](./deployment/release-system.md)            |
| Integrate with AI tools         | [MCP Integration](./mcp/integration-prd.md)                 |
| Troubleshoot issues             | [Troubleshooting](./getting-started/troubleshooting.md)     |
| **View v1.0.0 Release Notes**   | [v1.0.0 Release](./releases/v1.0.0.md)                      |

## Documentation Structure

### Getting Started

- [Overview](./getting-started/README.md) - Getting started guide index
- [Quick Start](./getting-started/quick-start.md) - Get up and running fast
- [Development](./getting-started/development.md) - Development environment setup
- [Testing](./getting-started/testing.md) - Testing guide for developers
- [Troubleshooting](./getting-started/troubleshooting.md) - Common issues and solutions

### Architecture

- [Overview](./architecture/overview.md) - Monorepo architecture overview
- [Monorepo Structure](./architecture/monorepo-structure.md) - Directory structure and npm workspaces
- [Event System](./architecture/event-system.md) - Module event bus design
- [Data Namespacing](./architecture/data-namespacing.md) - Database table namespacing

### Modules

- [README](./modules/README.md) - Module system overview
- [Standards](./modules/standards.md) - Module structure, naming, and code standards
- [Development](./modules/development.md) - Creating and developing modules
- [Activation](./modules/activation.md) - Module lifecycle and activation
- [Integration](./modules/integration.md) - Cross-module communication

### Packages

- [@molos/core](./packages/core.md) - Core utilities and types
- [@molos/database](./packages/database.md) - Database schema and utilities
- [@molos/ui](./packages/ui.md) - Shared UI components

### Deployment

- [Docker Deployment](./deployment/docker.md) - Docker/Podman deployment guide
- [Production Build System](./deployment/production-build.md) - Build-time module resolution and production deployment
- [Production Build Quick Reference](./deployment/production-quick-ref.md) - Quick reference for production builds
- [Release System](./deployment/release-system.md) - Automated versioning and releases with Changesets
- [SaaS Strategy](./deployment/saas-strategy.md) - Self-hosted vs SaaS considerations

### MCP (Model Context Protocol)

- [Integration PRD](./mcp/integration-prd.md) - MCP server integration requirements
- [Server Development](./mcp/server-development.md) - Building the MCP server

### ADR (Architecture Decision Records)

- [ADR Overview](./adr/README.md) - Architecture decision process and index
- [ADR-001: Migration Tracking Strategy](./adr/001-migration-tracking-strategy.md) - Database migration tracking approach

### Tasks & Improvement Plans

- [Tasks Overview](./tasks/README.md) - Active and proposed tasks
- [Database Package Consolidation](./tasks/database-consolidation.md) - Consolidate schemas to @molos/database

### Archive

- [Archive Overview](./archive/README.md) - Archived documentation overview
- [v1.0.0 Development History](./archive/DB_IMPROV/) - Database migration system implementation
- [Monorepo Migration](./archive/monorepo-migration/README.md) - Completed migration tasks
- [Legacy Plugin System](./archive/plugins/) - Archived plugin system documentation
- [Historical Changelogs](./archive/changelogs/) - Pre-v1.0.0 changelog entries

### v1.0.0 Release

- [v1.0.0 Release Notes](./releases/v1.0.0.md) - Full release notes and changes
- [Migration Guide](./releases/v1.0.0-migration.md) - Upgrading from previous versions

## Project Structure

```
MoLOS/
├── packages/
│   ├── core/                   # @molos/core - utilities and types
│   ├── database/               # @molos/database - schema and migrations
│   └── ui/                     # @molos/ui - shared components
├── modules/                    # All modules (monorepo workspaces)
│   ├── ai/                     # @molos/module-ai (internal)
│   ├── MoLOS-Tasks/            # Task management module
│   ├── MoLOS-AI-Knowledge/     # AI prompts and workflows
│   ├── MoLOS-LLM-Council/      # Multi-LLM consultation
│   ├── MoLOS-Goals/            # Goal tracking
│   ├── MoLOS-Meals/           # Meal planning
│   ├── MoLOS-Health/           # Health tracking
│   ├── MoLOS-Finance/          # Financial tracking
│   ├── MoLOS-Markdown/         # Markdown editing
│   ├── MoLOS-Google/           # Google integration
│   └── MoLOS-Sample-Module/    # Example module
├── src/                        # Main SvelteKit app
│   ├── lib/
│   │   ├── components/         # UI components
│   │   ├── server/             # Server-side code
│   │   ├── stores/             # Svelte stores
│   │   ├── models/             # TypeScript types
│   │   ├── repositories/       # Data access layer
│   │   └── config/             # App configuration
│   └── routes/                 # SvelteKit routes
├── scripts/                    # Build and utility scripts
├── drizzle/                    # Core database migrations
└── documentation/              # This documentation
```

## Tech Stack

| Component    | Technology                               |
| ------------ | ---------------------------------------- |
| Frontend/API | [SvelteKit](https://kit.svelte.dev/)     |
| Database     | [SQLite](https://www.sqlite.org/)        |
| ORM          | [Drizzle](https://orm.drizzle.team/)     |
| Styling      | [Tailwind CSS](https://tailwindcss.com/) |
| Build        | [Turborepo](https://turbo.build/)        |

## Contributing

See the [Module Development Guide](./modules/development.md) for information on contributing modules and code.

## Getting Help

- **GitHub Issues**: [MoLOS Issues](https://github.com/MoLOS-org/MoLOS/issues)
- **Documentation**: This folder
- **AI Context**: [AI-CONTEXT.md](./AI-CONTEXT.md) for quick AI reference
- **AI Documentation Guide**: [AI-DOCUMENTATION-GUIDE.md](./AI-DOCUMENTATION-GUIDE.md) for documentation practices

---

_Last Updated: 2026-03-17_
