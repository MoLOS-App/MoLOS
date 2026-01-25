import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { and, desc, eq, like } from 'drizzle-orm';
import { aiMemories, aiSessions } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';
import { getAllModules } from '$lib/config';
import type { SearchResponse, SearchResult } from '$lib/models/search';

const QuerySchema = z.object({
	q: z.string().min(1),
	limit: z.coerce.number().int().min(1).max(200).optional(),
	modules: z.string().optional(),
	types: z.string().optional(),
	from: z.string().optional(),
	to: z.string().optional()
});

const buildSnippet = (value?: string | null) => {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (trimmed.length <= 160) return trimmed;
	return `${trimmed.slice(0, 160).trim()}...`;
};

const parseList = (value?: string | null) => {
	if (!value) return null;
	const items = value
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
	return items.length ? new Set(items) : null;
};

const parseDate = (value?: string | null) => {
	if (!value) return null;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? null : parsed;
};

const toEndOfDay = (value: string, timestamp: number) => {
	if (value.includes('T')) return timestamp;
	return timestamp + 86_399_999;
};

const dedupeResults = (results: SearchResult[]) => {
	const seen = new Set<string>();
	return results.filter((result) => {
		const key = `${result.moduleId}:${result.entityType}:${result.entityId}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

export const GET: RequestHandler = async (event) => {
	const userId = event.locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const parsed = QuerySchema.safeParse({
		q: event.url.searchParams.get('q'),
		limit: event.url.searchParams.get('limit') ?? undefined
	});

	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid query');
	}

	const { q, limit, modules, types, from, to } = parsed.data;
	const maxResults = limit ?? 50;
	const perSourceLimit = Math.min(50, maxResults);
	const term = `%${q}%`;
	const moduleFilter = parseList(modules);
	const typeFilter = parseList(types);
	const fromMs = parseDate(from);
	const toMsRaw = parseDate(to);
	const toMs = to && toMsRaw ? toEndOfDay(to, toMsRaw) : null;

	const coreResults: SearchResult[] = [];

	if (!moduleFilter || moduleFilter.has('ai')) {
		const sessions = await db
			.select()
			.from(aiSessions)
			.where(and(eq(aiSessions.userId, userId), like(aiSessions.title, term)))
			.orderBy(desc(aiSessions.updatedAt))
			.limit(perSourceLimit);

		coreResults.push(
			...sessions.map((session) => ({
				moduleId: 'ai',
				moduleName: 'AI',
				entityType: 'session',
				entityId: session.id,
				title: session.title,
				href: '/ui/ai/dashboard',
				updatedAt: session.updatedAt
			}))
		);

		const memories = await db
			.select()
			.from(aiMemories)
			.where(and(eq(aiMemories.userId, userId), like(aiMemories.content, term)))
			.orderBy(desc(aiMemories.updatedAt))
			.limit(perSourceLimit);

		coreResults.push(
			...memories.map((memory) => ({
				moduleId: 'ai',
				moduleName: 'AI',
				entityType: 'memory',
				entityId: memory.id,
				title: 'Memory',
				snippet: buildSnippet(memory.content),
				href: '/ui/ai/dashboard',
				updatedAt: memory.updatedAt
			}))
		);
	}

	const settingsRepo = new SettingsRepository();
	const [moduleStates, externalModules] = await Promise.all([
		settingsRepo.getModuleStates(userId),
		settingsRepo.getExternalModules()
	]);

	const activeExternalIds = externalModules.filter((m) => m.status === 'active').map((m) => m.id);
	const allExternalIds = externalModules.map((m) => m.id);

	let enabledModules = getAllModules()
		.filter((module) => module.id !== 'dashboard' && module.id !== 'ai')
		.filter((module) => {
			const state = moduleStates.find((s) => s.moduleId === module.id && s.submoduleId === 'main');
			const isEnabled = state ? state.enabled : true;
			if (!isEnabled) return false;
			const isExternal = module.isExternal || allExternalIds.includes(module.id);
			if (isExternal) return activeExternalIds.includes(module.id);
			return true;
		});

	if (moduleFilter) {
		enabledModules = enabledModules.filter((module) => moduleFilter.has(module.id));
	}

	const moduleResults = await Promise.allSettled(
		enabledModules.map(async (module) => {
			const params = new URLSearchParams({ q, limit: String(perSourceLimit) });
			const res = await event.fetch(`/api/${encodeURIComponent(module.id)}/search?${params}`);
			if (!res.ok) return [];
			const payload = await res.json();
			if (Array.isArray(payload)) return payload as SearchResult[];
			if (payload && Array.isArray(payload.results)) return payload.results as SearchResult[];
			return [];
		})
	);

	const moduleNameById = new Map(enabledModules.map((module) => [module.id, module.name]));
	const externalResults = moduleResults.flatMap((result) =>
		result.status === 'fulfilled' ? result.value : []
	);

	let merged = dedupeResults([...coreResults, ...externalResults]).map((result) => ({
		...result,
		moduleName: result.moduleName ?? moduleNameById.get(result.moduleId)
	}));

	if (moduleFilter) {
		merged = merged.filter((result) => moduleFilter.has(result.moduleId));
	}
	if (typeFilter) {
		merged = merged.filter((result) => typeFilter.has(result.entityType));
	}
	if (fromMs) {
		merged = merged.filter((result) => (result.updatedAt ?? 0) >= fromMs);
	}
	if (toMs) {
		merged = merged.filter((result) => (result.updatedAt ?? 0) <= toMs);
	}

	const sorted = merged.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
	const results = sorted.slice(0, maxResults);

	const response: SearchResponse = {
		query: q,
		results,
		total: results.length
	};

	return json(response);
};
