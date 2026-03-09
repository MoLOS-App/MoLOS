/**
 * Module Configuration
 *
 * Defines which modules should be included in the production build.
 * Modules are cloned from git at build time using the specified tag or branch.
 *
 * To add a module: Add an entry to the modulesConfig array.
 * To remove a module: Remove the entry or set required: false (if optional).
 *
 * Format:
 * - id: The module identifier (used as folder name in modules/)
 * - git: The git repository URL
 * - tag: The specific git tag to checkout (mutually exclusive with branch)
 * - branch: The git branch to checkout (mutually exclusive with tag)
 * - required: If true, build fails if module cannot be cloned (default: false)
 *
 * Note: Either 'tag' or 'branch' must be specified, but not both.
 */

export interface ModuleConfigEntry {
	id: string;
	git: string;
	tag?: string;
	branch?: string;
	required?: boolean;
}

/**
 * Validates that exactly one of tag or branch is specified
 */
export function validateModuleConfigEntry(entry: ModuleConfigEntry): string | null {
	if (!entry.tag && !entry.branch) {
		return `Module "${entry.id}": must specify either 'tag' or 'branch'`;
	}
	if (entry.tag && entry.branch) {
		return `Module "${entry.id}": cannot specify both 'tag' and 'branch' (tag=${entry.tag}, branch=${entry.branch})`;
	}
	return null;
}

/**
 * Gets the git ref (tag or branch) for a module config entry
 */
export function getModuleRef(entry: ModuleConfigEntry): string {
	return entry.tag || entry.branch || '';
}

/**
 * Gets the ref type for display purposes
 */
export function getModuleRefType(entry: ModuleConfigEntry): 'tag' | 'branch' {
	return entry.tag ? 'tag' : 'branch';
}

export const modulesConfig: ModuleConfigEntry[] = [
	{ id: 'MoLOS-Tasks', git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git', branch: 'develop' },
	// { id: 'MoLOS-Goals', git: 'https://github.com/MoLOS-App/MoLOS-Goals.git', branch: 'develop' },
	// { id: 'MoLOS-Finance', git: 'https://github.com/MoLOS-App/MoLOS-Finance.git', branch: 'develop' },
	// { id: 'MoLOS-Health', git: 'https://github.com/MoLOS-App/MoLOS-Health.git', branch: 'develop' },
	// { id: 'MoLOS-Meals', git: 'https://github.com/MoLOS-App/MoLOS-Meals.git', branch: 'develop' },
	// { id: 'MoLOS-Google', git: 'https://github.com/MoLOS-App/MoLOS-Google.git', branch: 'develop' },
	// {
	// 	id: 'MoLOS-AI-Knowledge',
	// 	git: 'https://github.com/MoLOS-App/MoLOS-AI-Knowledge.git',
	// 	branch: 'develop'
	// },
	{
		id: 'MoLOS-LLM-Council',
		git: 'https://github.com/MoLOS-App/MoLOS-LLM-Council.git',
		branch: 'develop'
	},
	{
		id: 'MoLOS-Markdown',
		git: 'https://github.com/MoLOS-App/MoLOS-Markdown.git',
		branch: 'develop'
	}
	// {
	// 	id: 'MoLOS-Product-Owner',
	// 	git: 'https://github.com/MoLOS-App/MoLOS-Product-Owner.git',
	// 	branch: "develop"
	// },
	// {
	// 	id: 'MoLOS-Sample-Module',
	// 	git: 'https://github.com/MoLOS-App/MoLOS-Sample-Module.git',
	// 	branch: 'develop'
	// }
];
