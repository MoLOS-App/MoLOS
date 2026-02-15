# MoLOS Documentation

Welcome to the MoLOS (Modular Life Organization System) documentation. MoLOS is a fast, privacy-focused, and deeply modular productivity suite designed to help you reclaim your focus.

## Quick Links

| I want to... | Go to |
|--------------|-------|
| Get started quickly | [Quick Start](./getting-started/quick-start.md) |
| Understand the architecture | [Architecture Overview](./architecture/overview.md) |
| Create a module | [Module Development](./modules/development.md) |
| Deploy MoLOS | [Deployment Guide](./deployment/docker.md) |
| Integrate with AI tools | [MCP Integration](./mcp/integration-prd.md) |
| Troubleshoot issues | [Troubleshooting](./getting-started/troubleshooting.md) |

## Documentation Structure

### Getting Started

- [Quick Start](./getting-started/quick-start.md) - Get up and running fast
- [Testing](./getting-started/testing.md) - Testing guide for developers
- [Troubleshooting](./getting-started/troubleshooting.md) - Common issues and solutions

### Architecture

- [Overview](./architecture/overview.md) - Monorepo architecture overview
- [Monorepo Structure](./architecture/monorepo-structure.md) - Directory structure and npm workspaces
- [Event System](./architecture/event-system.md) - Module event bus design
- [Data Namespacing](./architecture/data-namespacing.md) - Database table namespacing

### Modules

- [README](./modules/README.md) - Module system overview
- [Development](./modules/development.md) - Creating and developing modules
- [Activation](./modules/activation.md) - Module lifecycle and activation
- [Integration](./modules/integration.md) - Cross-module communication

### Packages

- [@molos/core](./packages/core.md) - Core utilities and types
- [@molos/database](./packages/database.md) - Database schema and utilities
- [@molos/ui](./packages/ui.md) - Shared UI components

### Deployment

- [Docker Deployment](./deployment/docker.md) - Docker/Podman deployment guide
- [SaaS Strategy](./deployment/saas-strategy.md) - Self-hosted vs SaaS considerations

### MCP (Model Context Protocol)

- [Integration PRD](./mcp/integration-prd.md) - MCP server integration requirements
- [Server Development](./mcp/server-development.md) - Building the MCP server

### Improvement Plan

- [Overview](./improvement-plan/README.md) - Improvement task overview
- Individual tasks: [001](./improvement-plan/001-extract-module-linker.md) through [012](./improvement-plan/012-module-dependencies.md)

### Plugins

- [Overview](./plugins/README.md) - Plugin documentation
- [Module Management](./plugins/molos-module-management.md)
- [Database](./plugins/molos-db.md)
- [AI Tools](./plugins/molos-ai-tools.md)

### Archive

- [Monorepo Migration](./archive/monorepo-migration/README.md) - Completed migration tasks

## Project Structure

```
MoLOS/
├── apps/
│   └── web/                    # Main SvelteKit application
├── packages/
│   ├── core/                   # @molos/core - utilities and types
│   ├── database/               # @molos/database - schema and migrations
│   └── ui/                     # @molos/ui - shared components
├── modules/
│   ├── tasks/                  # @molos/module-tasks
│   └── ai/                     # @molos/module-ai
├── documentation/              # This documentation
└── drizzle/                    # Core database migrations
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend/API | [SvelteKit](https://kit.svelte.dev/) |
| Database | [SQLite](https://www.sqlite.org/) |
| ORM | [Drizzle](https://orm.drizzle.team/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Build | [Turborepo](https://turbo.build/) |

## Contributing

See the [Module Development Guide](./modules/development.md) for information on contributing modules and code.

## Getting Help

- **GitHub Issues**: [MoLOS Issues](https://github.com/MoLOS-org/MoLOS/issues)
- **Documentation**: This folder

---

*Last Updated: 2025-02-15*
