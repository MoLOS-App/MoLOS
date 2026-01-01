import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';
import { db } from '$lib/server/db';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const { key, value, description } = await request.json();

	if (!key || value === undefined) {
		throw error(400, 'Missing key or value');
	}

	const settingsRepo = new SettingsRepository(db);
	const result = await settingsRepo.updateSystemSetting(key, value, description);

	return json({ success: true, setting: result[0] });
};

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const settingsRepo = new SettingsRepository(db);
	const settings = await settingsRepo.getAllSystemSettings();

	return json(settings);
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const { key } = await request.json();

	if (!key) {
		throw error(400, 'Missing key');
	}

	const { settingsSystem } = await import('$lib/server/db/schema');
	const { eq } = await import('drizzle-orm');
	await db.delete(settingsSystem).where(eq(settingsSystem.key, key));

	return json({ success: true });
};
