import type { SettingsRepository } from '../../src/lib/repositories/settings/settings-repository';

export type ExternalModuleStatus =
	| 'pending'
	| 'active'
	| 'error_manifest'
	| 'error_migration'
	| 'error_config'
	| 'disabled'
	| 'deleting';

export type DbModule = Awaited<ReturnType<SettingsRepository['getExternalModules']>>[number];

export type ManifestInfo = {
	id?: string;
	name?: string;
	version?: string;
	description?: string;
	author?: string;
	icon?: string;
};

export type FsModule = {
	id: string;
	path: string;
	manifest?: ManifestInfo;
	packageJson?: { name?: string; version?: string; description?: string };
	hasManifest: boolean;
	hasPackageJson: boolean;
	hasRoutes: boolean;
	hasLib: boolean;
	hasConfig: boolean;
	hasDrizzle: boolean;
};

export type ModuleRecord = {
	id: string;
	status?: ExternalModuleStatus;
	repoUrl?: string;
	path?: string;
	source: 'db' | 'fs' | 'db+fs';
	manifest?: ManifestInfo;
	packageJson?: { name?: string; version?: string; description?: string };
	hasManifest?: boolean;
	hasPackageJson?: boolean;
	hasRoutes?: boolean;
	hasLib?: boolean;
	hasConfig?: boolean;
	hasDrizzle?: boolean;
};
