import type { DbModule, FsModule, ModuleRecord } from './types';

export function mergeModuleData(dbModules: DbModule[], fsModules: FsModule[]): ModuleRecord[] {
	const merged = new Map<string, ModuleRecord>();

	dbModules.forEach((module) => {
		merged.set(module.id, {
			id: module.id,
			status: module.status,
			repoUrl: module.repoUrl,
			source: 'db'
		});
	});

	fsModules.forEach((module) => {
		const existing = merged.get(module.id);
		if (existing) {
			merged.set(module.id, {
				...existing,
				source: 'db+fs',
				path: module.path,
				manifest: module.manifest,
				packageJson: module.packageJson,
				hasManifest: module.hasManifest,
				hasPackageJson: module.hasPackageJson,
				hasRoutes: module.hasRoutes,
				hasLib: module.hasLib,
				hasConfig: module.hasConfig,
				hasDrizzle: module.hasDrizzle
			});
			return;
		}

		merged.set(module.id, {
			id: module.id,
			source: 'fs',
			path: module.path,
			manifest: module.manifest,
			packageJson: module.packageJson,
			hasManifest: module.hasManifest,
			hasPackageJson: module.hasPackageJson,
			hasRoutes: module.hasRoutes,
			hasLib: module.hasLib,
			hasConfig: module.hasConfig,
			hasDrizzle: module.hasDrizzle
		});
	});

	return Array.from(merged.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function moduleStructureSummary(module: ModuleRecord) {
	const parts = [
		module.hasManifest ? 'manifest' : null,
		module.hasPackageJson ? 'package.json' : null,
		module.hasConfig ? 'config.ts' : null,
		module.hasRoutes ? 'routes/' : null,
		module.hasLib ? 'lib/' : null,
		module.hasDrizzle ? 'drizzle/' : null
	].filter(Boolean);
	return parts.length ? parts.join(', ') : 'n/a';
}
