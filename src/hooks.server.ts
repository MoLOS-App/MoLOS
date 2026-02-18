import { sequence } from '@sveltejs/kit/hooks';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { env } from '$env/dynamic/private';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building, dev } from '$app/environment';
import { redirect, type Handle } from '@sveltejs/kit';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';
import { getThemeClasses, type Theme, type Font, FONTS } from '$lib/theme';

import { failedModulesQueue } from '$lib/config';
import { markModuleForDisable } from '../module-management/server/module-auto-disable';

// Load .env file manually to ensure environment variables are available
function loadEnv() {
	const envPath = path.resolve(process.cwd(), '.env');
	if (existsSync(envPath)) {
		const envContent = readFileSync(envPath, 'utf-8');
		envContent.split('\n').forEach((line) => {
			const [key, ...valueParts] = line.split('=');
			if (key && valueParts.length > 0) {
				const value = valueParts
					.join('=')
					.trim()
					.replace(/^["']|["']$/g, '');
				const trimmedKey = key.trim();
				if (!process.env[trimmedKey]) {
					process.env[trimmedKey] = value;
				}
			}
		});
	}
}

// Run database setup on server start
(async () => {
	if (!building) {
		loadEnv();

		// Database is now initialized earlier in the startup sequence (by db:init)
		// Only run development migration checks here
		const migrationsFolder = './drizzle';
		const migrationsExist = existsSync(migrationsFolder);

		if (migrationsExist && dev) {
			console.log('[Hooks] Development mode: checking for new migrations...');
			// In dev, just log that migrations would be checked
			// The actual migrations were already run by db:init
			console.log('[Hooks] Migrations already applied by db:init, skipping redundant checks.');
		} else if (!migrationsExist) {
			console.log('[Hooks] No migrations folder found');
		}

		// Module manager already ran in sync-modules script, skip here
		// This prevents redundant initialization
		console.log('[Hooks] Module manager already initialized, skipping redundant init.');

		// Process any failed modules from config loading
		if (failedModulesQueue.length > 0) {
			console.log(`[Hooks] Processing ${failedModulesQueue.length} failed modules...`);
			for (const { moduleId, error } of failedModulesQueue) {
				try {
					await markModuleForDisable(moduleId, error);
				} catch (err) {
					console.warn(`[Hooks] Failed to auto-disable module ${moduleId}:`, err);
				}
			}
			// Clear the queue after processing
			failedModulesQueue.length = 0;
		}
	}
})();

const authHandler: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Skip user count check for static assets, internal SvelteKit requests, auth API,
	// and OAuth discovery endpoints (must be publicly accessible)
	const isStaticAsset =
		pathname.includes('.') || pathname.startsWith('/_app') || pathname.startsWith('/favicon');
	const isAuthApi = pathname.startsWith('/api/auth');
	const isOAuthDiscovery =
		pathname.startsWith('/.well-known/') || pathname.includes('/.well-known/');

	if (!isStaticAsset && !isAuthApi && !isOAuthDiscovery) {
		// Check if any users exist in the database
		const userCountResult = await db.all(sql`SELECT count(*) as count FROM user`);
		const userCount = (userCountResult[0] as unknown as { count: number }).count;

		if (userCount === 0 && !pathname.startsWith('/ui/welcome')) {
			// Only redirect if we are in the UI section
			if (pathname.startsWith('/ui')) {
				throw redirect(302, '/ui/welcome');
			}
		}
	}

	// Skip authentication for OAuth discovery endpoints (must be publicly accessible)
	if (isOAuthDiscovery) {
		return resolve(event);
	}

	// Fetch current session from Better Auth
	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	// Make session and user available on server
	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

const moduleAccessHandler: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Only check access for module routes
	if (pathname.startsWith('/ui/') && !pathname.startsWith('/ui/settings')) {
		const user = event.locals.user;
		if (user) {
			// Extract module ID from path (e.g., /ui/health/xxx -> health)
			const moduleId = pathname.split('/')[2];
			if (moduleId) {
				const settingsRepo = new SettingsRepository();
				const moduleStates = await settingsRepo.getModuleStates(user.id);
				const modState = moduleStates.find(
					(s) => s.moduleId === moduleId && s.submoduleId === 'main'
				);

				// If module is explicitly disabled, redirect to dashboard or settings
				if (modState && !modState.enabled) {
					throw redirect(303, '/ui/dashboard');
				}
			}
		}
	}

	return resolve(event);
};

const themeHandler: Handle = async ({ event, resolve }) => {
	return resolve(event, {
		transformPageChunk: ({ html }) => {
			const theme = (event.cookies.get('theme') as Theme) || 'light';
			const font = (event.cookies.get('font') as Font) || 'sans';
			const themeClasses = getThemeClasses(theme);
			const fontOption = FONTS.find((f) => f.id === font);
			const fontClass = fontOption ? fontOption.class : 'font-sans';

			return html.replace('%theme_classes%', [...themeClasses, fontClass].join(' '));
		}
	});
};

export const handle = sequence(authHandler, moduleAccessHandler, themeHandler);

/**
 * Handle unexpected errors gracefully
 * This prevents the dev server from crashing on unhandled exceptions
 */
export const handleError = async ({ error, event, status, message }: {
	error: unknown;
	event: {
		url: URL;
		request: Request;
		locals: App.Locals;
	};
	status: number;
	message: string;
}) => {
	// Log the error for debugging
	console.error('[Server Error Handler]', {
		status,
		message,
		url: event.url.pathname,
		error: error instanceof Error ? {
			name: error.name,
			message: error.message,
			stack: error.stack?.split('\n').slice(0, 3).join('\n')
		} : error
	});

	// Check if this is an API request (MCP or other)
	const isApiRequest = event.url.pathname.startsWith('/api/');
	const isMcpRequest = event.url.pathname.startsWith('/api/ai/mcp/');

	// For MCP requests, return a proper JSON-RPC error
	if (isMcpRequest) {
		return {
			message: 'Internal server error',
			code: -32603,
			data: {
				type: 'server_error',
				recoverable: true,
				hint: 'Please try again. If the error persists, check the server logs.'
			}
		};
	}

	// For other API requests, return JSON error
	if (isApiRequest) {
		return {
			message: error instanceof Error ? error.message : 'Internal server error',
			code: status
		};
	}

	// For UI requests, return a generic error message
	return {
		message: 'An unexpected error occurred. Please try again.',
		code: status
	};
};

// Handle unhandled promise rejections to prevent server crashes
process.on('unhandledRejection', (reason, promise) => {
	console.error('[Unhandled Rejection] Reason:', reason);
	// Don't exit the process, just log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
	console.error('[Uncaught Exception]', error);
	// Don't exit the process for recoverable errors
	// Only exit for critical errors like memory issues
	if (error.message?.includes('ENOMEM') || error.message?.includes('out of memory')) {
		console.error('[Critical] Out of memory, exiting...');
		process.exit(1);
	}
});
