import { error, fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageServerLoad, Actions } from './$types';
import { getAllModules } from '$lib/config/modules';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';
import { execFileSync } from 'child_process';
import path from 'path';
import { existsSync, rmSync, utimesSync } from 'fs';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const settingsRepo = new SettingsRepository();
	const modules = getAllModules();
	const moduleStates = await settingsRepo.getModuleStates(locals.user.id);
	const externalModules = await settingsRepo.getExternalModules();
	const externalIds = new Map(externalModules.map((m) => [m.id, m]));
	const allowUserInstallPlugins = await settingsRepo.getSystemSetting('ALLOW_USER_INSTALL_PLUGINS');

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
			return {
				id: m.id,
				name: m.name,
				description: m.description,
				href: m.href,
				isExternal: m.isExternal || externalIds.has(m.id),
				status: externalIds.get(m.id)?.status || 'active',
				lastError: externalIds.get(m.id)?.lastError,
				menuOrder: savedState?.menuOrder ?? 0,
				navigation: (m.navigation || []).map((n) => ({
					name: n.name,
					disabled: n.disabled
				}))
			};
		}),
		savedStates: moduleStates,
		allowUserInstallPlugins: allowUserInstallPlugins === 'true'
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
	},

	install: async ({ request, locals }) => {
		await verifyAccess(locals);

		const formData = await request.formData();
		const repoUrl = formData.get('repoUrl');

		if (!repoUrl || typeof repoUrl !== 'string') {
			return fail(400, { message: 'Missing repository URL' });
		}

		try {
			const trimmedRepoUrl = repoUrl.trim();
			if (!isAllowedRepoUrl(trimmedRepoUrl)) {
				return fail(400, {
					message: 'Invalid repository URL. Only HTTPS or SSH Git URLs are allowed.'
				});
			}

			const folderName = getRepoFolderName(trimmedRepoUrl);
			if (!folderName || !isValidModuleId(folderName)) {
				return fail(400, { message: 'Invalid module repository name.' });
			}

			const externalModulesDir = path.resolve(process.cwd(), 'external_modules');
			const targetPath = path.resolve(externalModulesDir, folderName);
			if (!targetPath.startsWith(externalModulesDir + path.sep)) {
				return fail(400, { message: 'Invalid module path.' });
			}
			if (existsSync(targetPath)) {
				return fail(409, { message: 'Module already exists at target path.' });
			}

			console.log(`Cloning ${trimmedRepoUrl} into ${targetPath}...`);
			execFileSync('git', ['clone', '--depth', '1', trimmedRepoUrl, targetPath], {
				stdio: 'inherit'
			});

			const settingsRepo = new SettingsRepository();
			await settingsRepo.registerExternalModule(folderName, trimmedRepoUrl);

			// We no longer trigger restart automatically here to allow multiple installs
			console.log(`[System] Module ${folderName} installed. Waiting for manual restart.`);

			return {
				success: true,
				message: `Module ${folderName} cloned successfully. Restart required to activate.`
			};
		} catch (e) {
			if (e instanceof Error && e.constructor.name === 'Redirect') throw e;
			if (e && typeof e === 'object' && 'status' in e && 'location' in e) throw e;

			console.error('Failed to install module:', e);
			return fail(500, {
				message: 'Failed to install module. Ensure the URL is valid and the directory is writable.'
			});
		}
	},

	delete: async ({ request, locals }) => {
		await verifyAccess(locals);

		const formData = await request.formData();
		const moduleId = formData.get('moduleId');

		if (!moduleId || typeof moduleId !== 'string') {
			return fail(400, { message: 'Missing module ID' });
		}

		try {
			const settingsRepo = new SettingsRepository();

			// 1. Mark as deleting in DB instead of immediate removal
			await settingsRepo.updateExternalModuleStatus(moduleId, 'deleting');

			console.log(`[System] Module ${moduleId} marked for deletion. Waiting for manual restart.`);

			return {
				success: true,
				message: `Module ${moduleId} marked for deletion. Restart required to complete.`
			};
		} catch (e) {
			if (e instanceof Error && e.constructor.name === 'Redirect') throw e;
			if (e && typeof e === 'object' && 'status' in e && 'location' in e) throw e;

			console.error('Failed to delete module:', e);
			return fail(500, { message: 'Failed to delete module' });
		}
	},

	cancel: async ({ request, locals }) => {
		await verifyAccess(locals);

		const formData = await request.formData();
		const moduleId = formData.get('moduleId');

		if (!moduleId || typeof moduleId !== 'string') {
			return fail(400, { message: 'Missing module ID' });
		}

		try {
			const settingsRepo = new SettingsRepository();
			const mod = await settingsRepo.getExternalModuleById(moduleId);

			if (!mod) {
				return fail(404, { message: 'Module not found' });
			}

			if (mod.status === 'deleting') {
				// Revert to active
				await settingsRepo.updateExternalModuleStatus(moduleId, 'active');
				return { success: true, message: 'Deletion cancelled.' };
			} else if (mod.status === 'pending') {
				// Remove completely (it was just cloned)
				const targetPath = path.join(process.cwd(), 'external_modules', moduleId);
				try {
					rmSync(targetPath, { recursive: true, force: true });
				} catch (e) {
					console.error(`Failed to remove module folder ${targetPath}:`, e);
				}
				await settingsRepo.deleteExternalModule(moduleId);
				return { success: true, message: 'Installation cancelled.' };
			}

			return fail(400, { message: 'Nothing to cancel for this module.' });
		} catch (e) {
			console.error('Failed to cancel action:', e);
			return fail(500, { message: 'Failed to cancel action' });
		}
	},

	restart: async ({ locals }) => {
		await verifyAccess(locals);

		console.log('[System] Vite server reboot requested...');

		// 1. Touch vite.config.ts to trigger Vite's internal restart logic
		// This is the most reliable way to "reboot" the Vite dev server programmatically
		// We delay this to allow the redirect to reach the client
		if (dev) {
			setTimeout(() => {
				try {
					const configPath = path.resolve('vite.config.ts');
					const now = new Date();
					utimesSync(configPath, now, now);
					console.log('[System] vite.config.ts touched. Vite should restart.');
				} catch (e) {
					console.error('[System] Failed to touch vite.config.ts:', e);
				}
			}, 1000);
		}

		// 2. Also initiate a process exit after a short delay.
		// If running in Docker or with PM2, this will trigger a full container/process reboot.
		// If running in a simple terminal, it will stop the server (user must restart).
		// We use a slightly longer delay to ensure Vite has time to pick up the file change.
		// IMPORTANT: In development mode, Vite handles the restart when vite.config.ts is touched.
		// We only exit the process if we are NOT in development mode or if we want a hard reboot.
		if (!dev) {
			setTimeout(() => {
				console.log('[System] Exiting process for full rebuild/reboot...');
				process.exit(10);
			}, 2000);
		} else {
			console.log(
				'[System] Development mode detected. Vite should handle the restart via HMR/Config reload.'
			);
		}

		return redirect(303, '/ui/system/restarting');
	}
};

async function verifyAccess(locals: App.Locals): Promise<void> {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Admins can always manage modules; optionally allow non-admins via system setting.
	if (locals.user.role === 'admin') {
		return;
	}

	const settingsRepo = new SettingsRepository();
	const allowUserInstallPlugins =
		(await settingsRepo.getSystemSetting('ALLOW_USER_INSTALL_PLUGINS')) === 'true';
	if (!allowUserInstallPlugins) {
		throw error(403, 'Insufficient permissions to manage modules');
	}
}

function isAllowedRepoUrl(repoUrl: string): boolean {
	if (/\s/.test(repoUrl)) return false;
	if (repoUrl.startsWith('-')) return false;
	if (repoUrl.startsWith('git@')) return true;

	try {
		const parsed = new URL(repoUrl);
		return parsed.protocol === 'https:' || parsed.protocol === 'ssh:';
	} catch {
		return false;
	}
}

function getRepoFolderName(repoUrl: string): string | null {
	if (repoUrl.startsWith('git@')) {
		const parts = repoUrl.split(':');
		if (parts.length < 2) return null;
		const pathPart = parts[1];
		return (
			pathPart
				.split('/')
				.pop()
				?.replace(/\.git$/i, '') ?? null
		);
	}

	try {
		const parsed = new URL(repoUrl);
		return (
			parsed.pathname
				.split('/')
				.pop()
				?.replace(/\.git$/i, '') ?? null
		);
	} catch {
		return null;
	}
}

function isValidModuleId(moduleId: string): boolean {
	return /^[a-zA-Z0-9_-]+$/.test(moduleId);
}
