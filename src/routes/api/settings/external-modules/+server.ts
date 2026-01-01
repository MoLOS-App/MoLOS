import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';
import { db } from '$lib/server/db';
import { z } from 'zod';

const RegisterExternalModuleSchema = z.object({
	id: z.string().min(1, 'id is required'),
	repoUrl: z.string().url('Invalid repoUrl')
});

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const settingsRepo = new SettingsRepository(db);
	const modules = await settingsRepo.getExternalModules();

	return json(modules);
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const body = await request.json();
	const result = RegisterExternalModuleSchema.safeParse(body);

	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { id, repoUrl } = result.data;

	const settingsRepo = new SettingsRepository(db);
	const registerResult = await settingsRepo.registerExternalModule(id, repoUrl);

	return json({ success: true, module: registerResult[0] });
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const { id } = await request.json();

	if (!id) {
		throw error(400, 'Missing id');
	}

	const settingsRepo = new SettingsRepository(db);
	await settingsRepo.deleteExternalModule(id);

	return json({ success: true });
};
