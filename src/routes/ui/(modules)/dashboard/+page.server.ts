import type { PageServerLoad } from './$types';
import { getAllModules } from '$lib/config/modules';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.id;
	const settingsRepo = new SettingsRepository();
	const moduleStates = userId ? await settingsRepo.getModuleStates(userId) : [];

	const modules = getAllModules()
		.filter((m) => m.id !== 'dashboard')
		.filter((m) => {
			const state = moduleStates.find((s) => s.moduleId === m.id && s.submoduleId === 'main');
			return state ? state.enabled : true; // Default to enabled if no state found
		});




	return {
		user: locals.user,
		modules: modules.map((m) => ({
			id: m.id,
			name: m.name,
			href: m.href,
			description: m.description
		})),
		stats: {}
	};
};
