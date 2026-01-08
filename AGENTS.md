# Repository Guidelines

## Project Structure & Module Organization

- `src/` is the core SvelteKit app: routes in `src/routes/`, shared logic in `src/lib/`, server DB code in `src/lib/server/db/`.
- `static/` holds static assets served by the app.
- `external_modules/` contains optional modules (folders named `MoLOS-*`).
- `scripts/` holds module tooling and CLIs used by npm scripts.
- `drizzle/` stores database migrations and snapshots.
- `docs/` and `internal_documentation/` contain product and developer notes.

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
