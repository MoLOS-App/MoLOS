/**
 * Module Diagnostics API Endpoint
 *
 * Provides comprehensive diagnostics for modules.
 * Accessible at /api/admin/modules/diagnostics/{moduleId}
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ModuleDiagnosticsService } from '$lib/server/modules/module-diagnostics';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const moduleId = params.moduleId;

		if (!moduleId) {
			return json({ error: 'Module ID is required' }, { status: 400 });
		}

		// Verify module exists in database
		const settingsRepo = new SettingsRepository();
		const module = await settingsRepo.getExternalModuleById(moduleId);

		if (!module) {
			return json({ error: 'Module not found' }, { status: 404 });
		}

		// Run diagnostics
		const diagnosticsService = new ModuleDiagnosticsService(settingsRepo);
		const diagnostics = await diagnosticsService.diagnoseModule(moduleId);

		return json(diagnostics);
	} catch (error) {
		console.error('[ModuleDiagnostics] Error:', error);
		return json(
			{ error: 'Failed to run diagnostics', details: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
