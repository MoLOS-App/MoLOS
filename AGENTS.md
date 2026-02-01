# Repository Guidelines

## MCP Server Integration (Model Context Protocol)

This repository leverages several MCP servers for enhanced development capabilities. Always prefer MCP tools over manual searches or external browsing.

### Available MCP Servers

| MCP Server           | Purpose                                                             | Key Tools                                                                   |
| -------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **svelte**           | Official Svelte/SvelteKit docs, examples, and code validation       | `list-sections`, `get-documentation`, `svelte-autofixer`, `playground-link` |
| **context7**         | Up-to-date library documentation (MongoDB, Next.js, Supabase, etc.) | `resolve-library-id`, `get-library-docs`                                    |
| **web-reader**       | Fetch and convert web content to markdown                           | `webReader`                                                                 |
| **web-search-prime** | Search web for current information                                  | `webSearchPrime`                                                            |
| **4.5v-mcp**         | Image analysis for UI/UX replication                                | `analyze_image`                                                             |

### MCP Usage Guidelines

#### Svelte Development (MUST use svelte MCP)

1. **Before writing Svelte code**: Always run `list-sections` first to find relevant documentation
2. **Fetching docs**: Use `get-documentation` with section names or paths (e.g., `$state`, `load functions`, `routing`)
3. **Code validation**: ALWAYS run `svelte-autofixer` before sending Svelte code to users
4. **Playground links**: Ask user first, then use `playground-link` for interactive code demos

```bash
# Example workflow for Svelte tasks:
# 1. List sections to find relevant docs
# 2. Fetch all relevant documentation at once
# 3. Write code following official patterns
# 4. Run svelte-autofixer to validate
# 5. Generate playground link if user wants to test
```

#### Context7 for Library Documentation

Use for any external library (not Svelte):

```bash
# First resolve the library ID
resolve-library-id("library-name")
# Then fetch docs with optional topic focus
get-library-docs("/org/project", topic="relevant-topic")
```

#### Web Research

- Use `web-reader` for fetching specific URLs and converting to markdown
- Use `web-search-prime` for searching current information
- Always include "Sources:" section with markdown hyperlinks when using web search

---

## Project Structure & Module Organization

- `src/` is the core SvelteKit app: routes in `src/routes/`, shared logic in `src/lib/`, server DB code in `src/lib/server/db/`.
- `static/` holds static assets served by the app.
- `external_modules/` contains optional modules (folders named `MoLOS-*`).
- `scripts/` holds module tooling and CLIs used by npm scripts.
- `drizzle/` stores database migrations and snapshots.

## Build, Test, and Development Commands

- `npm run dev` starts the local dev server (Vite).
- `npm run build` builds the production bundle.
- `npm run preview` serves the built app on port 4173.
- `npm run check` runs SvelteKit sync + type checks.
- `npm run lint` runs Prettier in check mode; `npm run eslint` runs ESLint.
- `npm run format` formats the repo with Prettier.
- `npm run test` runs unit tests once; `npm run test:unit` runs Vitest in watch mode.
- `npm run module:sync` discovers and wires `external_modules/` into the core app.
- `npm run module:create|validate|test` manage module scaffolding and checks.
- `npm run db:migrate|generate|reset|studio` manage Drizzle schemas and migrations.

## Coding Style & Naming Conventions

- Formatting is enforced by Prettier: tabs, single quotes, `printWidth` 100.
- Follow ESLint + Svelte rules; prefer `npm run format` before commit.
- DB schema lives under `src/lib/server/db/schema/<module>/` with `<object>.ts` files and module-prefixed names.
- Module UI routes live under `src/routes/(modules)/<module>/`.
- Reusable UI components go in `src/lib/components/ui/` before use in pages.
- Prefer server-side data loading via `+page.server.ts` or `load` functions.

### Svelte-Specific Best Practices (via MCP)

Always consult the Svelte MCP for:

- **Runes**: Use `$state`, `$derived`, `$effect` (Svelte 5) instead of legacy APIs
- **Load functions**: Server data loading with `+page.server.ts` or `+page.ts`
- **Type safety**: Leverage TypeScript with Svelte components
- **Reactivity**: Follow reactive patterns from official documentation
- **Component design**: Prefer small, reusable components in `src/lib/components/`

**Before writing Svelte code:**

1. Run `list-sections` to find relevant documentation
2. Fetch docs for all relevant sections
3. Follow official patterns from documentation
4. Run `svelte-autofixer` to validate code

## Testing Guidelines

- Unit tests use Vitest; files follow `*.spec.ts` and `*.test.ts` patterns.
- Tests live in `src/` and module folders under `external_modules/`.
- Run `npm run test` before opening a PR when possible.

## Commit & Pull Request Guidelines

- Recent commits use short, sentence-case summaries without prefixes; keep subject lines concise and imperative.
- PRs should include a clear description, linked issues, and screenshots for UI changes.
- Mention tests run (or why they were skipped) in the PR description.

## Security & Configuration

- Local data uses SQLite; set `DATABASE_URL` and `BETTER_AUTH_SECRET` for dev or Docker runs.
- Keep secrets out of the repo; use `.env` or container config.

## Task Tracking with Beads

This project uses **beads** (git-backed issue tracker) for all task management.

### Essential Commands

| Command                               | Purpose                                 |
| ------------------------------------- | --------------------------------------- | --------------------- | --------- |
| `bd ready`                            | Show issues ready to work (no blockers) |
| `bd list --status=open`               | All open issues                         |
| `bd list --status=in_progress`        | Your active work                        |
| `bd show <id>`                        | Detailed issue view with dependencies   |
| `bd create --title="..." --type=task  | bug                                     | feature --priority=2` | New issue |
| `bd update <id> --status=in_progress` | Claim/start work                        |
| `bd close <id>`                       | Mark complete                           |
| `bd dep add <issue> <depends-on>`     | Add dependency                          |
| `bd sync`                             | Sync with git remote                    |

### Beads Workflow

1. **Before coding**: Create beads issue with `bd create`
2. **Starting work**: `bd update <id> --status=in_progress`
3. **Completing**: `bd close <id>`
4. **End of session**: `bd sync` to push to remote

**Priority levels**: 0-4 or P0-P4 (0=critical, 2=medium, 4=backlog)

## Landing the Plane (Session Completion)

**When ending a work session**, agents prepare work but YOU handle the final git operations.

**AGENT RESPONSIBILITIES (before completion):**

1. **File issues for remaining work** - Create beads issues for anything that needs follow-up
2. **Run quality gates** (if code changed):
   - Add/update tests for new code
   - Run `npm run check` (type checking + Svelte compilation)
   - Run `npm run lint` (code formatting)
3. **Update issue status** - Close finished work with `bd close`, update in-progress items
4. **Prepare summary** - Provide clear summary of changes made and files modified

**YOUR RESPONSIBILITIES (manual steps):**

```bash
# Review the changes
git status
git diff

# Run quality checks (agent may have already done this, but verify)
npm run check
npm run lint
npm run test    # if tests exist

# Stage and commit
git add <files>
bd sync                 # Sync beads to git
git commit -m "..."     # Write your own commit message
bd sync                 # Sync any new beads changes
git push                # Push to remote
```

**Handoff for next session:**

- Run `bd ready` to see available work
- Check git status to ensure clean state
