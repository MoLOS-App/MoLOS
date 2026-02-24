# Getting Started

Welcome to MoLOS! This guide will help you get up and running quickly.

## Choose Your Path

| I am...             | Recommended Path                                                  |
| ------------------- | ----------------------------------------------------------------- |
| **New User**        | [Quick Start](./quick-start.md) - Get running in minutes          |
| **Developer**       | [Development Guide](./development.md) - Set up for coding         |
| **Troubleshooting** | [Troubleshooting Guide](./troubleshooting.md) - Fix common issues |

## Quick Start Guide

The fastest way to get started:

```bash
# Clone the repository
git clone https://github.com/MoLOS-org/MoLOS.git
cd MoLOS

# Install dependencies
bun install

# Start the development server
bun run dev
```

The dev server automatically:

1. Discovers modules in `modules/` and `external_modules/`
2. Installs module dependencies
3. Syncs routes via symlinks
4. Starts the SvelteKit dev server

Open http://localhost:5173 to see MoLOS running.

## Prerequisites

- **Bun** >= 1.0.0 (recommended) or Node.js >= 18
- **SQLite** (included with the project)
- **Git** (for version control)

## Available Guides

| Guide                                   | Description                      |
| --------------------------------------- | -------------------------------- |
| [Quick Start](./quick-start.md)         | Essential commands and shortcuts |
| [Development](./development.md)         | Development environment setup    |
| [Testing](./testing.md)                 | Running and writing tests        |
| [Troubleshooting](./troubleshooting.md) | Common issues and solutions      |

## Next Steps

After getting started:

1. **Explore Modules** - Check out the [Module System](../modules/README.md) docs
2. **Understand Architecture** - Read the [Architecture Overview](../architecture/overview.md)
3. **Create a Module** - Follow the [Module Development](../modules/development.md) guide

## Getting Help

- **Documentation**: Browse the [docs folder](../README.md)
- **Issues**: [GitHub Issues](https://github.com/MoLOS-org/MoLOS/issues)
- **AI Context**: See [AI-CONTEXT.md](../AI-CONTEXT.md) for quick reference
- **AI Documentation Guide**: See [AI-DOCUMENTATION-GUIDE.md](../AI-DOCUMENTATION-GUIDE.md) for documentation practices

---

_Last Updated: 2026-02-17_
