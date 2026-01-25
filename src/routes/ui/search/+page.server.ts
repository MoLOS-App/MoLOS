import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import type { SearchResponse } from '$lib/models/search';
import { getAllModules } from '$lib/config';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';

export const load: PageServerLoad = async ({ url, fetch, locals }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const modulesParam = url.searchParams.get('modules') ?? '';
	const typesParam = url.searchParams.get('types') ?? '';
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';

	const filters = {
		modules: modulesParam ? modulesParam.split(',').filter(Boolean) : [],
		types: typesParam ? typesParam.split(',').filter(Boolean) : [],
		from,
		to
	};

	let availableModules: { id: string; name: string }[] = [];
	if (locals.user?.id) {
		const settingsRepo = new SettingsRepository();
		const [moduleStates, externalModules] = await Promise.all([
			settingsRepo.getModuleStates(locals.user.id),
			settingsRepo.getExternalModules()
		]);

		const activeExternalIds = externalModules.filter((m) => m.status === 'active').map((m) => m.id);
		const allExternalIds = externalModules.map((m) => m.id);

		availableModules = getAllModules()
			.filter((module) => module.id !== 'dashboard')
			.filter((module) => {
				const state = moduleStates.find(
					(s) => s.moduleId === module.id && s.submoduleId === 'main'
				);
				const isEnabled = state ? state.enabled : true;
				if (!isEnabled) return false;
				const isExternal = module.isExternal || allExternalIds.includes(module.id);
				if (isExternal) return activeExternalIds.includes(module.id);
				return true;
			})
			.map((module) => ({ id: module.id, name: module.name }));
	}

	const typesByModule: Record<string, string[]> = {
		ai: ['session', 'memory'],
		'MoLOS-Tasks': ['task', 'project', 'area', 'daily_log'],
		'MoLOS-AI-Knowledge': ['prompt', 'prompt_chain']
	};

	const availableTypes = Array.from(
		new Set(
			availableModules.flatMap((module) => typesByModule[module.id] ?? [])
		)
	);

	if (!q) {
		return { query: '', results: [], availableModules, availableTypes, filters };
	}

	const params = new URLSearchParams({ q });
	if (filters.modules.length) params.set('modules', filters.modules.join(','));
	if (filters.types.length) params.set('types', filters.types.join(','));
	if (filters.from) params.set('from', filters.from);
	if (filters.to) params.set('to', filters.to);

	const res = await fetch(`/api/search?${params.toString()}`);
	if (!res.ok) {
		throw error(res.status, 'Search failed');
	}

	const data = (await res.json()) as SearchResponse;
	return {
		query: q,
		results: data.results ?? [],
		availableModules,
		availableTypes,
		filters
	};
};
