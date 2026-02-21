# MoLOS Documentation

Welcome to the MoLOS (Modular Life Organization System) documentation. MoLOS is a fast, privacy-focused, and deeply modular productivity suite designed to help you reclaim your focus.

## Quick Links

| I want to...                | Go to                                                   |
| --------------------------- | ------------------------------------------------------- |
| Get started quickly         | [Quick Start](./getting-started/quick-start.md)         |
| See command reference       | [Quick Reference](./QUICK-REFERENCE.md)                 |
| AI context loading          | [AI Context](./AI-CONTEXT.md)                           |
| Understand the architecture | [Architecture Overview](./architecture/overview.md)     |
| Create a module             | [Module Development](./modules/development.md)          |
| Deploy MoLOS                | [Deployment Guide](./deployment/docker.md)              |
| Integrate with AI tools     | [MCP Integration](./mcp/integration-prd.md)             |
| Troubleshoot issues         | [Troubleshooting](./getting-started/troubleshooting.md) |

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
- [SaaS Strategy](./deployment/saas-strategy.md) - Self-hosted vs SaaS considerations

### MCP (Model Context Protocol)

- [Integration PRD](./mcp/integration-prd.md) - MCP server integration requirements
- [Server Development](./mcp/server-development.md) - Building the MCP server

### Plugins

- [Overview](./plugins/README.md) - Plugin documentation
- [Module Management](./plugins/molos-module-management.md)
- [Database](./plugins/molos-db.md)
- [AI Tools](./plugins/molos-ai-tools.md)

### Archive

- [Monorepo Migration](./archive/monorepo-migration/README.md) - Completed migration tasks
- [CHANGELOG](./CHANGELOG.md) - Consolidated changelog

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

---

_Last Updated: 2026-02-17_
