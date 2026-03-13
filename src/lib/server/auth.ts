import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db'; // your drizzle instance
import * as schema from '@molos/database/schema';
import { env } from '$env/dynamic/private';
import { admin } from 'better-auth/plugins';
import { sql } from 'drizzle-orm';
import { existsSync, readFileSync } from 'fs';
import { building, dev } from '$app/environment';

function resolveAuthSecret(): string | undefined {
	const direct = env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET;
	if (direct) return direct;

	const secretFile = env.BETTER_AUTH_SECRET_FILE || process.env.BETTER_AUTH_SECRET_FILE;
	if (secretFile && existsSync(secretFile)) {
		return readFileSync(secretFile, 'utf-8').trim();
	}

	return undefined;
}

let authSecret = resolveAuthSecret();
if (!authSecret) {
	const message =
		'BETTER_AUTH_SECRET is required. Set BETTER_AUTH_SECRET or BETTER_AUTH_SECRET_FILE.';
	if (building) {
		console.warn(`[Auth] BUILD WARNING: ${message}`);
		authSecret = 'super-secret-build-fallback-key-not-secure-for-runtime';
	} else if (dev) {
		console.warn(`[Auth] ${message}`);
		authSecret = 'super-secret-dev-fallback-key-not-secure-for-runtime';
	} else {
		throw new Error(`[Auth] ${message}`);
	}
}

/**
 * Resolve the origin URL from environment.
 * Single source of truth for all URL-based configuration.
 *
 * Priority: ORIGIN > BETTER_AUTH_URL
 *
 * Set ORIGIN=http://192.168.1.40:4173 for HTTP deployments
 * Set ORIGIN=https://molos.example.com for HTTPS deployments
 */
function resolveOrigin(): { baseURL: string | undefined; isHttps: boolean } {
	// Check ORIGIN first (preferred, single env var for everything)
	const origin = env.ORIGIN || process.env.ORIGIN;
	// Fallback to BETTER_AUTH_URL for backwards compatibility
	const betterAuthUrl = env.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL;

	const url = origin || betterAuthUrl;

	if (!url) {
		return { baseURL: undefined, isHttps: false };
	}

	const isHttps = url.startsWith('https://');
	return { baseURL: url, isHttps };
}

const { baseURL, isHttps } = resolveOrigin();

// Use secure cookies only when using HTTPS
// For HTTP (e.g., http://192.168.x.x:4173), secure cookies won't work
const useSecureCookies = isHttps;

/**
 * Build trusted origins list.
 * Automatically includes the configured origin plus development defaults.
 */
function buildTrustedOrigins(): string[] {
	const devDefaults = ['http://localhost:4173', 'http://127.0.0.1:4173', 'http://localhost:5173'];

	// Start with the configured origin if it exists
	const origins: string[] = baseURL ? [baseURL] : [];

	// In development, always include localhost defaults
	if (dev || !baseURL) {
		for (const def of devDefaults) {
			if (!origins.includes(def)) {
				origins.push(def);
			}
		}
	}

	// Also parse CSRF_TRUSTED_ORIGINS if explicitly set (for additional origins)
	const explicitOrigins = process.env.CSRF_TRUSTED_ORIGINS;
	if (explicitOrigins) {
		const parsed = explicitOrigins
			.split(',')
			.map((o) => o.trim())
			.filter(Boolean);
		for (const o of parsed) {
			if (!origins.includes(o)) {
				origins.push(o);
			}
		}
	}

	return origins;
}

export const auth = betterAuth({
	secret: authSecret,
	// Base URL for auth - derived from ORIGIN env var
	baseURL,
	// Trusted origins - automatically includes ORIGIN + dev defaults
	trustedOrigins: buildTrustedOrigins(),
	database: drizzleAdapter(db, {
		provider: 'sqlite', // or "mysql", "sqlite"
		schema
	}),
	user: {
		deleteUser: {
			enabled: true
		}
	},
	emailAndPassword: {
		enabled: true
	},
	plugins: [
		sveltekitCookies(getRequestEvent),
		admin()
		// apiKey plugin removed for compatibility with better-auth 1.4.21
		// Re-enable when upgrading to better-auth 1.5.0+ with @better-auth/api-key package
	],
	// Cookie configuration - automatically adjusts for HTTP vs HTTPS
	advanced: {
		useSecureCookies,
		defaultCookieAttributes: {
			httpOnly: true,
			secure: useSecureCookies, // Only secure if using HTTPS
			sameSite: 'lax',
			path: '/'
		}
	},
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					// Check if this is the first user
					const userCountResult = await db.all(sql`SELECT count(*) as count FROM user`);
					const userCount = (userCountResult[0] as unknown as { count: number }).count;

					if (userCount === 1) {
						// Promote first user to admin
						await db
							.update(schema.user)
							.set({ role: 'admin' })
							.where(sql`id = ${user.id}`);
					}
				}
			}
		}
	}
});
