import { sequence } from '@sveltejs/kit/hooks';
import { execSync } from 'child_process';
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

import { ModuleManager } from '../module-management/server/module-manager';

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

async function setupDatabase() {
	const rawDbPath =
		env.DATABASE_URL ||
		process.env.DATABASE_URL ||
		(process.env.NODE_ENV === 'production' ? '/data/molos.db' : 'molos.db');
	const dbPath = rawDbPath.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '');
	const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);

	// Check if database file exists
	const dbExists = existsSync(resolvedDbPath);

	if (!dbExists) {
		console.log('Database does not exist, running drizzle-kit push...');
		try {
			execSync('npm run db:generate', { stdio: 'inherit' });
			execSync('npm run db:migrate', { stdio: 'inherit' });
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
	const isDevelopment = dev;

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
	loadEnv();
	await setupDatabase();
	// Initialize external modules
	try {
		await ModuleManager.init();
	} catch (error) {
		console.error('[Hooks] Failed to initialize ModuleManager:', error);
	}
}

const authHandler: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Skip user count check for static assets, internal SvelteKit requests, auth API,
	// and OAuth discovery endpoints (must be publicly accessible)
	const isStaticAsset =
		pathname.includes('.') || pathname.startsWith('/_app') || pathname.startsWith('/favicon');
	const isAuthApi = pathname.startsWith('/api/auth');
	const isOAuthDiscovery = pathname.startsWith('/.well-known/') || pathname.includes('/.well-known/');

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

	// Fetch current session from Better Auth
	// Skip for OAuth discovery endpoints (must be publicly accessible)
	const isOAuthDiscovery = pathname.startsWith('/.well-known/') || pathname.includes('/.well-known/');

	if (isOAuthDiscovery) {
		// Don't enforce auth for OAuth discovery endpoints
		return resolve(event);
	}

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
