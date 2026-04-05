<img width="144" height="144" alt="MoLOS icon" src="static/pwa-assets/logo-512.png">

# MoLOS

> **The structured memory layer for productive AI agents**

MoLOS gives Claude Code, OpenCode, and other AI agents permanent memory. They can read your tasks, search your notes, and update your projects — all through MCP.

## The Problem

Your AI coding assistant forgets everything between sessions. Every new chat starts from zero:

- No context about what you worked on yesterday
- No memory of decisions you made
- No way to take action on your tasks or projects

MoLOS fixes this by giving your AI a structured, persistent memory layer.

## What You Get

- **100+ MCP Tools** — Your AI can create tasks, write notes, update projects
- **Structured Data** — Tasks, projects, areas, knowledge — not just key-value storage
- **Local-First** — Your data stays on your machine, always
- **Self-Hostable** — One Docker command, full control

## Quick Start

### Option 1: One-Line Install (Recommended)

```bash
/bin/bash -c "$(curl -fsSL https://molos.app/install.sh)"
```

This script automatically detects Docker or Podman, generates a secure secret, and starts MoLOS.

### Option 2: Docker Run

```bash
docker run -d \
  --name molos \
  -p 4173:4173 \
  -v molos_data:/data \
  -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  -e DATABASE_URL=file:/data/molos.db \
  ghcr.io/molos-app/molos:latest
```

### Option 3: Docker Compose (For Production)

Create `docker-compose.yaml`:

```yaml
services:
  molos:
    image: ghcr.io/molos-app/molos:latest
    pull_policy: always
    ports:
      - '4173:4173'
    volumes:
      - ./molos_data:/data
    environment:
      - DATABASE_URL=file:/data/molos.db
      - BETTER_AUTH_SECRET=your-secret-key-here
      # Optional: for external access
      # - CSRF_TRUSTED_ORIGINS=http://localhost:4173,http://your-domain.com:4173
      # - ORIGIN=https://your-domain.com
```

Then run:

```bash
# Generate a secret key
openssl rand -base64 32

# Edit docker-compose.yaml and paste the key

# Start MoLOS
docker compose up -d
```

Open `http://localhost:4173`. That's it.

## How It Works

```
┌─────────────────────────────────────────┐
│         Your AI (Claude Code, etc.)      │
└─────────────────┬───────────────────────┘
                  │ MCP Protocol
                  ▼
┌─────────────────────────────────────────┐
│              MoLOS                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Tasks   │ │ Notes   │ │ Projects│   │
│  └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Goals   │ │ Health  │ │ Finance │   │
│  └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────┘
                  │
                  ▼
        ┌─────────────────┐
        │  Local SQLite   │
        │  (Your Data)    │
        └─────────────────┘
```

Your AI connects to MoLOS via MCP and can:

- **Read** your current tasks and project status
- **Write** new tasks, notes, and updates
- **Search** your knowledge base
- **Update** task status as work progresses

## Seamless Integration

MoLOS works with your favorite AI tools out of the box:

- **Claude Code** — MCP Native. Read tasks, write notes, update projects
- **OpenCode** — MCP Native. Persistent memory across sessions
- **OpenClaw** — MCP Native. Multi-agent coordination with shared state
- **Any MCP Client** — Standard MCP. Full access to 100+ tools

## Who It's For

- **Claude Code Users** — Give Claude persistent memory of your projects
- **OpenCode Enthusiasts** — AI coding with context that lasts
- **OpenClaw Users** — Multi-agent systems with shared memory
- **AI Agent Builders** — Building agents that need shared state
- **Privacy Advocates** — Local-first, self-hosted, full control

## What People Build With It

MoLOS modules turn it into whatever you need:

- **[MoLOS-Tasks](https://github.com/MoLOS-org/MoLOS-Tasks)** — Task and project management
- **[MoLOS-Markdown](https://github.com/MoLOS-org/MoLOS-Markdown)** — Notes and knowledge base
- **[MoLOS-Health](https://github.com/MoLOS-org/MoLOS-Health)** — Health and habit tracking
- **[MoLOS-Finance](https://github.com/MoLOS-org/MoLOS-Finance)** — Expense tracking
- **[MoLOS-Goals](https://github.com/MoLOS-org/MoLOS-Goals)** — Goal setting and progress

Start with one. Add more when you need them.

## Connect Your AI

### Claude Code

Add to your Claude Code config:

```json
{
	"mcpServers": {
		"molos": {
			"url": "http://localhost:4173/mcp"
		}
	}
}
```

Now Claude can see your tasks, search your notes, and update your projects.

### Any MCP Client

MoLOS implements the Model Context Protocol. Any MCP-compatible AI can connect and use the 100+ tools exposed.

## Modular System

MoLOS is built from small, independent modules:

- Add or remove modules without breaking the core
- Keep it minimal, or build a full workspace
- Modules are versioned and can be shared

Configure modules in `modules.config.ts`:

```typescript
export const modulesConfig: ModuleConfigEntry[] = [
	{ id: 'MoLOS-Tasks', git: 'https://github.com/MoLOS-org/MoLOS-Tasks.git', tag: 'v1.0.0' },
	{ id: 'MoLOS-Markdown', git: 'https://github.com/MoLOS-org/MoLOS-Markdown.git', tag: 'v1.0.0' }
];
```

## Privacy & Control

- **Local-first** — Runs on your machine, stores data locally
- **No cloud required** — Works offline, syncs only if you want
- **Easy backup** — Copy the `./data` folder, you're done
- **Apache 2.0** — Fully open source

## For Developers

📚 **[Documentation](https://molos.app)**

The codebase is small on purpose. Easy to read, easy to extend, easy to own.

### Module Development

- **[Module Development Guide](documentation/modules/development.md)** — Build your own modules
- **[Architecture Overview](documentation/architecture/overview.md)** — How MoLOS works
- **[API Reference](module-management/docs/04-api-endpoints.md)** — Available endpoints

### Database Migrations

⚠️ **CRITICAL**: Never run `drizzle-kit generate` or `bun run db:generate`. These commands are disabled.

**Correct workflow**:

```bash
bun run db:migration:create --name <name> --module <module> --reversible
# Then manually edit the SQL file
bun run db:migrate
```

## Contributing

Issues and PRs are welcome. If you build something useful, share it.

If MoLOS helps you, star it and tell a friend!
