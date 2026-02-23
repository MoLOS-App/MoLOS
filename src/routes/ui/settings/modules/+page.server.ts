import { error, fail } from '@sveltejs/kit';
// import { dev } from '$app/environment'; // DISABLED: restart functionality
// import { redirect } from '@sveltejs/kit'; // DISABLED: restart functionality
import type { PageServerLoad, Actions } from './$types';
import { getAllModules } from '$lib/config';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';
// import { execFileSync } from 'child_process'; // DISABLED: git operations
// import path from 'path'; // DISABLED: git operations
// import { existsSync, rmSync, utimesSync } from 'fs'; // DISABLED: git operations

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const settingsRepo = new SettingsRepository();
	const modules = getAllModules();
	const moduleStates = await settingsRepo.getModuleStates(locals.user.id);
	const externalModules = await settingsRepo.getExternalModules();
	const externalIds = new Map(externalModules.map((m) => [m.id, m]));
	// DISABLED: Install functionality temporarily disabled
	// const allowUserInstallPlugins = await settingsRepo.getSystemSetting('ALLOW_USER_INSTALL_PLUGINS');

	// Combine built-in modules with external modules that might not be in the registry yet
	// (e.g., pending restart or errored)
	const allModules = [...modules];

	externalModules.forEach((ext) => {
		if (!allModules.find((m) => m.id === ext.id)) {
			allModules.push({
				id: ext.id,
				name: ext.id, // Fallback name
				description: 'External module',
				href: `/ui/${ext.id}`,
				icon: null,
				isExternal: true,
				navigation: []
			} as any);
		}
	});

	return {
		user: locals.user,
		modules: allModules.map((m) => {
			const savedState = moduleStates.find((s) => s.moduleId === m.id && s.submoduleId === 'main');
			const externalModule = externalIds.get(m.id);
			return {
				id: m.id,
				name: m.name,
				description: m.description,
				href: m.href,
				isExternal: m.isExternal || externalIds.has(m.id),
				status: externalModule?.status || 'active',
				lastError: externalModule?.lastError,
				gitRef: externalModule?.gitRef || 'main',
				blockUpdates: externalModule?.blockUpdates || false,
				menuOrder: savedState?.menuOrder ?? 0,
				navigation: (m.navigation || []).map((n) => ({
					name: n.name,
					disabled: n.disabled
				}))
			};
		}),
		savedStates: moduleStates,
		allowUserInstallPlugins: false // DISABLED: Install tab temporarily disabled
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (!locals.user) {
			throw error(401, 'Unauthorized');
		}

		const formData = await request.formData();
		const statesJson = formData.get('states');

		if (!statesJson || typeof statesJson !== 'string') {
			return fail(400, { message: 'Missing module states' });
		}

		try {
			const states = JSON.parse(statesJson);
			const settingsRepo = new SettingsRepository();

			const flatStates = Object.entries(states).flatMap(([moduleId, data]: [string, any]) => {
				const results = [];
				// Main module state
				results.push({
					moduleId,
					submoduleId: 'main',
					enabled: data.enabled,
					menuOrder: data.menuOrder
				});
				// Submodule states
				if (data.submodules) {
					Object.entries(data.submodules).forEach(([subName, enabled]) => {
						results.push({
							moduleId,
							submoduleId: subName,
							enabled: enabled as boolean
						});
					});
				}
				return results;
			});

			await settingsRepo.updateManyModuleStates(locals.user.id, flatStates);

			return { success: true };
		} catch (e) {
			console.error('Failed to save module settings:', e);
			return fail(500, { message: 'Failed to save settings' });
		}
	}

	// DISABLED: External module actions temporarily disabled
	//
	// install: async ({ request, locals }) => { ... },
	// delete: async ({ request, locals }) => { ... },
	// cancel: async ({ request, locals }) => { ... },
	// restart: async ({ locals }) => { ... },
	// updateGitRef: async ({ request, locals }) => { ... },
	// toggleBlockUpdates: async ({ request, locals }) => { ... },
	// forcePull: async ({ request, locals }) => { ... }
};

// DISABLED: verifyAccess for external modules - keeping for future use
// async function verifyAccess(locals: App.Locals): Promise<void> {
// 	if (!locals.user) {
// 		throw error(401, 'Unauthorized');
// 	}
//
// 	if (locals.user.role === 'admin') {
// 		return;
// 	}
//
// 	const settingsRepo = new SettingsRepository();
// 	const allowUserInstallPlugins =
// 		(await settingsRepo.getSystemSetting('ALLOW_USER_INSTALL_PLUGINS')) === 'true';
// 	if (!allowUserInstallPlugins) {
// 		throw error(403, 'Insufficient permissions to manage modules');
// 	}
// }

// DISABLED: Helper functions for git operations - keeping for future use
// function isAllowedRepoUrl(repoUrl: string): boolean { ... }
// function getRepoFolderName(repoUrl: string): string | null { ... }
// function isValidModuleId(moduleId: string): boolean { ... }
