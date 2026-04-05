# Development Guide

## Prerequisites

- Node.js 20+
- npm 10+ or pnpm 9+
- Git 2.40+

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/MoLOS-org/MoLOS.git
cd MoLOS
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment

Create a `.env` file:

```bash
DATABASE_URL=file:./molos.db
BETTER_AUTH_SECRET=your-secret-here
```

Generate a secret:

```bash
openssl rand -base64 32
```

### 4. Initialize Database

```bash
npm run db:push
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

## Common Commands

### Development

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start development server |
| `npm run build`   | Build for production     |
| `npm run preview` | Preview production build |

### Database

| Command                       | Description             |
| ----------------------------- | ----------------------- |
| `npm run db:push`             | Push schema to database |
| `npm run db:migrate`          | Run migrations          |
| `npm run db:migration:create` | Create new migration    |
| `npm run db:studio`           | Open Drizzle Studio     |
| `npm run db:reset`            | Reset database          |

### Modules

| Command                          | Description               |
| -------------------------------- | ------------------------- |
| `npm run modules:sync`           | Sync external modules     |
| `npm run module:create <name>`   | Create a new module       |
| `npm run module:validate <path>` | Validate module structure |
| `npm run module:test <path>`     | Test a module             |

## Code Style

- Use tabs for indentation
- Single quotes for strings
- Print width: 100 characters
- Use Prettier for formatting

## Project Structure

```
MoLOS/
├── apps/
│   └── web/                # Main SvelteKit app
│       ├── src/
│       │   ├── routes/     # SvelteKit routes
│       │   ├── lib/        # App libraries
│       │   └── hooks.server.ts
│       └── package.json
├── packages/
│   ├── core/               # Shared utilities
│   ├── database/           # Database schema
│   └── ui/                 # UI components
├── modules/
│   ├── tasks/              # Tasks module
│   └── ai/                 # AI module
└── documentation/          # Documentation
```

## Testing

See [Testing Guide](./testing.md) for detailed testing instructions.

## Troubleshooting

See [Troubleshooting Guide](./troubleshooting.md) for common issues.

## Next Steps

- [Architecture Overview](../architecture/overview.md)
- [Module Development](../modules/development.md)
- [Quick Start Reference](./quick-start.md)
