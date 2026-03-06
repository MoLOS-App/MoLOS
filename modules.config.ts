/**
 * Module Configuration
 *
 * Defines which modules should be included in the production build.
 * Modules are cloned from git at build time using the specified tags.
 *
 * To add a module: Add an entry to the modulesConfig array.
 * To remove a module: Remove the entry or set required: false (if optional).
 *
 * Format:
 * - id: The module identifier (used as folder name in modules/)
 * - git: The git repository URL
 * - tag: The specific tag or branch to checkout
 * - required: If true, build fails if module cannot be cloned (default: false)
 */

export interface ModuleConfigEntry {
	id: string;
	git: string;
	tag: string;
	required?: boolean;
}

export const modulesConfig: ModuleConfigEntry[] = [
	// { id: 'MoLOS-Tasks', git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git', tag: 'v1.0.0' },
	// { id: 'MoLOS-Goals', git: 'https://github.com/MoLOS-App/MoLOS-Goals.git', tag: 'v1.0.0' },
	// { id: 'MoLOS-Finance', git: 'https://github.com/MoLOS-App/MoLOS-Finance.git', tag: 'v1.0.0' },
	// { id: 'MoLOS-Health', git: 'https://github.com/MoLOS-App/MoLOS-Health.git', tag: 'v1.0.0' },
	// { id: 'MoLOS-Meals', git: 'https://github.com/MoLOS-App/MoLOS-Meals.git', tag: 'v1.0.0' },
	// { id: 'MoLOS-Google', git: 'https://github.com/MoLOS-App/MoLOS-Google.git', tag: 'v1.0.0' },
	// {
	// 	id: 'MoLOS-AI-Knowledge',
	// 	git: 'https://github.com/MoLOS-App/MoLOS-AI-Knowledge.git',
	// 	tag: 'v1.0.0'
	// },
	{
		id: 'MoLOS-LLM-Council',
		git: 'https://github.com/MoLOS-App/MoLOS-LLM-Council.git',
		tag: 'v1.0.0'
	},
	{ id: 'MoLOS-Markdown', git: 'https://github.com/MoLOS-App/MoLOS-Markdown.git', tag: 'v1.0.0' }
	// {
	// 	id: 'MoLOS-Product-Owner',
	// 	git: 'https://github.com/MoLOS-App/MoLOS-Product-Owner.git',
	// 	tag: 'v1.0.0'
	// },
	// {
	// 	id: 'MoLOS-Sample-Module',
	// 	git: 'https://github.com/MoLOS-App/MoLOS-Sample-Module.git',
	// 	tag: 'v1.0.0'
	// }
];
