import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const session = locals.session;
	const isAuthPage =
		url.pathname === '/ui/login' || url.pathname === '/ui/signup' || url.pathname === '/ui/welcome';
	const isAuthenticated = !!session;

	if (!isAuthenticated && !isAuthPage) {
		// Check if there are any users in the DB to decide where to redirect
		const userCountResult = await db.all(sql`SELECT count(*) as count FROM user`);
		const userCount = (userCountResult[0] as unknown as { count: number }).count;

		if (userCount === 0) {
			throw redirect(302, '/ui/welcome');
		} else {
			throw redirect(302, '/ui/login');
		}
	}

	if (isAuthenticated && isAuthPage) {
		throw redirect(302, '/ui/dashboard');
	}

	let moduleStates: {
		moduleId: string;
		submoduleId: string;
		enabled: boolean;
		menuOrder?: number;
	}[] = [];
	if (locals.user) {
		const settingsRepo = new SettingsRepository();
		moduleStates = await settingsRepo.getModuleStates(locals.user.id);
	}

	// Fetch external modules status
	const settingsRepo = new SettingsRepository();
	const externalModules = await settingsRepo.getExternalModules();

	const activeExternalIds = externalModules.filter((m) => m.status === 'active').map((m) => m.id);

	const allExternalIds = externalModules.map((m) => m.id);
	const hasPendingRestart = externalModules.some((m) => m.status === 'pending');
	const publicRegistration = await settingsRepo.getSystemSetting('PUBLIC_REGISTRATION');

	if (url.pathname === '/ui/signup' && publicRegistration !== 'true') {
		throw redirect(302, '/ui/login');
	}

	return {
		session,
		moduleStates,
		activeExternalIds,
		allExternalIds,
		hasPendingRestart,
		publicRegistration: publicRegistration === 'true',
		userId: locals.user?.id || null,
	};
};
