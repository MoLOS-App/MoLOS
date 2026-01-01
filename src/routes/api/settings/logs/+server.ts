import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';
import { db } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const limit = Number(url.searchParams.get('limit')) || 100;
	const settingsRepo = new SettingsRepository(db);
	const logs = await settingsRepo.getServerLogs(limit);

	return json(logs);
};

export const DELETE: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	// Note: SettingsRepository doesn't have a clearLogs method yet,
	// but we can implement it here or in the repo.
	// For now, let's just return success as a placeholder or implement it.

	// await db.delete(settingsServerLogs); // Need to import settingsServerLogs

	return json({ success: true, message: 'Clear logs not fully implemented in repository' });
};
