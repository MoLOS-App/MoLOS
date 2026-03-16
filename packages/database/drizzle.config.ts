import { defineConfig } from 'drizzle-kit';

/**
 * ⚠️ CRITICAL SAFETY RULE: NEVER RUN drizzle-kit generate
 *
 * FORBIDDEN: Do not run `drizzle-kit generate` or `bun run db:generate`
 * These commands are explicitly disabled for safety reasons.
 *
 * WHY THIS IS DANGEROUS:
 * - Creates journal/SQL desync (migrations in journal but no SQL files)
 * - Generates random names (0003_dizzy_jane_foster.sql) - zero context
 * - Cannot enforce table naming conventions (MoLOS-{Name}_{table})
 * - Overwrites manual migrations without warning
 *
 * CORRECT WORKFLOW:
 * 1. bun run db:migration:create --name <name> --module <module> --reversible
 * 2. Manually edit the generated migration SQL file
 * 3. bun run db:migrate (from root)
 *
 * See documentation/adr/003-migration-auto-generation-ban.md for details.
 */

const rawDbPath =
	process.env.DATABASE_URL ||
	(process.env.NODE_ENV === 'production' ? '/data/molos.db' : '../../data/molos.db');
const normalizedDbPath = rawDbPath.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '');

export default defineConfig({
	schema: './src/schema/index.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: { url: `file:${normalizedDbPath}` },
	verbose: true,
	strict: true
});
