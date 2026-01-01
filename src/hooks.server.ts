import { sequence } from '@sveltejs/kit/hooks';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { env } from '$env/dynamic/private';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { redirect, type Handle } from '@sveltejs/kit';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';
import { getThemeClasses, type Theme, type Font, FONTS } from '$lib/theme';

import { ModuleManager } from '$lib/server/modules/module-manager';

async function setupDatabase() {
	const dbPath = env.DATABASE_URL;

	if (!dbPath) {
		console.error('DATABASE_URL is not set');
		return;
	}

	// Check if database file exists
	const dbExists = existsSync(dbPath);

	if (!dbExists) {
		console.log('Database does not exist, running drizzle-kit push...');
		try {
			execSync('npm run db:push', { stdio: 'inherit' });
			console.log('Database schema pushed successfully');
		} catch (error) {
			console.error('Failed to push database schema:', error);
			process.exit(1);
		}
	} else {
		console.log('Database already exists');
	}

	// Check if migrations folder exists and run migrate if it does (only in development)
	const migrationsFolder = './drizzle';
	const migrationsExist = existsSync(migrationsFolder);
	const isDevelopment = process.env.NODE_ENV === 'development';

	if (migrationsExist && isDevelopment && !building) {
		console.log('Running database migrations in development mode...');
		try {
			execSync('npm run db:migrate', { stdio: 'inherit' });
			console.log('Migrations applied successfully');
		} catch (error) {
			console.error('Failed to apply migrations:', error);
			// Don't exit in dev mode, let the app continue
			console.warn('Continuing without migrations applied');
		}
	} else if (migrationsExist && !isDevelopment) {
		console.log('Skipping automatic migrations in production (run manually during deployment)');
	} else if (!migrationsExist) {
		console.log('No migrations folder found, skipping migration check');
	}
}

// Run database setup on server start
if (!building) {
	await setupDatabase();
	// Initialize external modules
	await ModuleManager.init();
}

const authHandler: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Skip user count check for static assets, internal SvelteKit requests, and auth API
	// Skip user count check for static assets, internal SvelteKit requests, and auth API
	const isStaticAsset =
		pathname.includes('.') || pathname.startsWith('/_app') || pathname.startsWith('/favicon');
	const isAuthApi = pathname.startsWith('/api/auth');

	if (!isStaticAsset && !isAuthApi && !pathname.startsWith('/api/health')) {
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
