import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';
import { db } from '$lib/server/db';
import { count } from 'drizzle-orm';
import { session, apikey } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Check if user is admin
	if (locals.user.role !== 'admin') {
		throw error(403, 'Forbidden: Admin access required');
	}

	const settingsRepo = new SettingsRepository(db);

	// Fetch users using Better Auth API
	const usersResponse = await auth.api.listUsers({
		query: {
			limit: 100
		},
		headers: request.headers
	});

	// Fetch additional admin data
	const [externalModules, serverLogs, systemSettings, activeSessionsCount, totalApiKeys] =
		await Promise.all([
			settingsRepo.getExternalModules(),
			settingsRepo.getServerLogs(50),
			settingsRepo.getAllSystemSettings(),
			db.select({ value: count() }).from(session),
			db.select({ value: count() }).from(apikey)
		]);

	return {
		currentUser: locals.user,
		users: usersResponse.users,
		totalUsers: usersResponse.total,
		externalModules,
		serverLogs,
		systemSettings,
		activeSessionsCount: activeSessionsCount[0]?.value || 0,
		totalApiKeys: totalApiKeys[0]?.value || 0
	};
};
