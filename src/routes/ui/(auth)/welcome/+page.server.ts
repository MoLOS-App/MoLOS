/**
 * Welcome Flow Server Actions
 *
 * Handles module activation after account creation during the welcome flow.
 * This is step 3 of the onboarding process.
 */

import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';
import { db } from '$lib/server/db';
import { MODULE_REGISTRY } from '$lib/config';

// ============================================
// Constants
// ============================================

/**
 * Minimum required modules that MUST be activated
 * These cannot be deselected in the UI and are mandatory for the welcome flow
 */
const REQUIRED_MODULES = ['dashboard', 'ai', 'MoLOS-Tasks', 'MoLOS-Markdown'] as const;

/**
 * Default git reference for new module installations
 */
const DEFAULT_GIT_REF = 'main';

/**
 * Known repository URLs for modules
 * Internal modules get empty string, external modules get their repo URL
 */
const KNOWN_REPO_URLS: Record<string, string> = {
	// Internal modules - no external repo
	dashboard: '',
	ai: '',
	// External modules - known repositories
	'MoLOS-Tasks': 'https://github.com/MoLOS-org/MoLOS-Tasks',
	'MoLOS-Markdown': 'https://github.com/MoLOS-org/MoLOS-Markdown',
	'MoLOS-Goals': 'https://github.com/MoLOS-org/MoLOS-Goals',
	'MoLOS-Health': 'https://github.com/MoLOS-org/MoLOS-Health',
	'MoLOS-Finance': 'https://github.com/MoLOS-org/MoLOS-Finance',
	'MoLOS-Meals': 'https://github.com/MoLOS-org/MoLOS-Meals',
	'MoLOS-Google': 'https://github.com/MoLOS-org/MoLOS-Google',
	'MoLOS-AI-Knowledge': 'https://github.com/MoLOS-org/MoLOS-AI-Knowledge'
};

// ============================================
// Helper Functions
// ============================================

/**
 * Validates that all required modules are present in the request
 */
function validateRequiredModules(requestedModules: string[]): {
	valid: boolean;
	missingModules: string[];
} {
	const missingModules = REQUIRED_MODULES.filter(
		(required) => !requestedModules.includes(required)
	);

	return {
		valid: missingModules.length === 0,
		missingModules
	};
}

/**
 * Validates that all requested modules exist in the module registry
 */
function validateModulesExist(requestedModules: string[]): {
	valid: boolean;
	invalidModules: string[];
} {
	const invalidModules = requestedModules.filter((moduleId) => !MODULE_REGISTRY[moduleId]);

	return {
		valid: invalidModules.length === 0,
		invalidModules
	};
}

/**
 * Gets the repository URL for a module
 */
function getRepoUrl(moduleId: string): string {
	return KNOWN_REPO_URLS[moduleId] ?? '';
}

/**
 * Logs an error with full context for debugging
 */
function logError(context: string, err: unknown, additionalData?: Record<string, unknown>): void {
	console.error(`[Welcome/ActivateModules] ${context}:`, {
		error: err instanceof Error ? err.message : String(err),
		stack: err instanceof Error ? err.stack : undefined,
		timestamp: new Date().toISOString(),
		...additionalData
	});
}

/**
 * Logs an info message with context
 */
function logInfo(context: string, message: string, data?: Record<string, unknown>): void {
	console.log(`[Welcome/ActivateModules] ${context}:`, {
		message,
		timestamp: new Date().toISOString(),
		...data
	});
}

// ============================================
// Server Actions
// ============================================

export const actions: Actions = {
	/**
	 * Activate modules during the welcome flow
	 *
	 * This action:
	 * 1. Enables selected modules in settings_modules table
	 * 2. Disables non-selected modules in settings_modules table
	 * 3. For external modules: updates settings_external_modules status to 'active'
	 */
	activateModules: async ({ request, locals }) => {
		const startTime = Date.now();
		logInfo('START', 'Beginning module activation');

		// ============================================
		// Step 1: Authentication Check
		// ============================================
		if (!locals.user) {
			logError('AUTH', 'No user session found');
			return fail(401, {
				success: false,
				error: 'Unauthorized: You must be logged in to activate modules'
			});
		}

		const userId = locals.user.id;
		logInfo('AUTH', 'User authenticated', { userId });

		// ============================================
		// Step 2: Parse Form Data
		// ============================================
		const formData = await request.formData();
		const modulesField = formData.get('modules');

		if (!modulesField || typeof modulesField !== 'string') {
			logError('PARSE', 'Missing or invalid modules field', { userId });
			return fail(400, {
				success: false,
				error: 'Modules field is required'
			});
		}

		// Parse comma-separated string into array
		const requestedModules = modulesField
			.split(',')
			.map((id) => id.trim())
			.filter(Boolean);

		if (requestedModules.length === 0) {
			logError('PARSE', 'No modules provided', { userId });
			return fail(400, {
				success: false,
				error: 'At least one module must be selected'
			});
		}

		logInfo('PARSE', 'Modules parsed successfully', {
			userId,
			moduleCount: requestedModules.length,
			modules: requestedModules
		});

		// ============================================
		// Step 3: Validate Required Modules
		// ============================================
		const requiredValidation = validateRequiredModules(requestedModules);
		if (!requiredValidation.valid) {
			logError('REQUIRED_MODULES', new Error('Missing required modules'), {
				userId,
				missingModules: requiredValidation.missingModules,
				requestedModules
			});
			return fail(400, {
				success: false,
				error: `Missing required modules: ${requiredValidation.missingModules.join(', ')}`,
				missingModules: requiredValidation.missingModules
			});
		}

		logInfo('REQUIRED_MODULES', 'All required modules present', { userId });

		// ============================================
		// Step 4: Validate Modules Exist in Registry
		// ============================================
		const existenceValidation = validateModulesExist(requestedModules);
		if (!existenceValidation.valid) {
			logError('MODULE_EXISTENCE', new Error('Invalid module IDs'), {
				userId,
				invalidModules: existenceValidation.invalidModules,
				requestedModules
			});
			return fail(400, {
				success: false,
				error: `Invalid module IDs: ${existenceValidation.invalidModules.join(', ')}`,
				invalidModules: existenceValidation.invalidModules
			});
		}

		logInfo('MODULE_EXISTENCE', 'All modules exist in registry', { userId });

		// ============================================
		// Step 5: Initialize Repository
		// ============================================
		const settingsRepo = new SettingsRepository(db);

		// ============================================
		// Step 6: Get all available modules and disable non-selected ones
		// ============================================
		const allModuleIds = Object.keys(MODULE_REGISTRY);
		const modulesToDisable = allModuleIds.filter((id) => !requestedModules.includes(id));

		logInfo('DISABLE_MODULES', `Disabling ${modulesToDisable.length} non-selected modules`, {
			userId,
			modulesToDisable
		});

		// Disable modules that were not selected
		for (const moduleId of modulesToDisable) {
			try {
				await settingsRepo.updateModuleState(userId, {
					moduleId,
					submoduleId: 'main',
					enabled: false,
					menuOrder: 0
				});
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : String(err);
				logError('MODULE_DISABLE_FAILED', err, { userId, moduleId, errorMessage });
				// Don't fail the whole operation if disabling fails
			}
		}

		// ============================================
		// Step 7: Activate Each Selected Module
		// ============================================
		const activatedModules: string[] = [];
		const failedModules: Array<{ moduleId: string; error: string }> = [];

		for (const moduleId of requestedModules) {
			try {
				logInfo('ACTIVATE_MODULE', `Activating module: ${moduleId}`, { userId, moduleId });

				// Determine if this is an external module (starts with 'MoLOS-')
				const isExternalModule = moduleId.startsWith('MoLOS-');

				if (isExternalModule) {
					// For external modules: update settings_external_modules
					const existingModule = await settingsRepo.getExternalModuleById(moduleId);

					if (existingModule) {
						// Update existing module to active status
						await settingsRepo.updateExternalModuleStatus(moduleId, 'active', null);
					} else {
						// Insert new module record
						const repoUrl = getRepoUrl(moduleId);
						await settingsRepo.registerExternalModule(moduleId, repoUrl, DEFAULT_GIT_REF);
						// Update status to active (registerExternalModule sets status to 'pending')
						await settingsRepo.updateExternalModuleStatus(moduleId, 'active', null);
					}
				}

				// For ALL modules (both internal and external): update settings_modules
				// This is what determines if a module is enabled/disabled in the UI
				await settingsRepo.updateModuleState(userId, {
					moduleId,
					submoduleId: 'main',
					enabled: true,
					menuOrder: 0
				});

				activatedModules.push(moduleId);
				logInfo('MODULE_ACTIVATED', `Successfully activated: ${moduleId}`, { userId, moduleId });
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : String(err);
				logError('MODULE_ACTIVATION_FAILED', err, { userId, moduleId, errorMessage });
				failedModules.push({ moduleId, error: errorMessage });
			}
		}

		// ============================================
		// Step 8: Prepare Response
		// ============================================
		const duration = Date.now() - startTime;

		if (failedModules.length > 0) {
			logError('PARTIAL_FAILURE', new Error('Some modules failed to activate'), {
				userId,
				activatedCount: activatedModules.length,
				failedCount: failedModules.length,
				failedModules,
				duration
			});

			// Check if any required modules failed
			const failedRequired = REQUIRED_MODULES.filter((req) =>
				failedModules.some((f) => f.moduleId === req)
			);

			if (failedRequired.length > 0) {
				return fail(500, {
					success: false,
					error: `Failed to activate required modules: ${failedRequired.join(', ')}`,
					details: JSON.stringify(failedModules)
				});
			}

			// Non-required modules failed - return partial success
			logInfo('PARTIAL_SUCCESS', 'Some non-required modules failed, continuing anyway', {
				userId,
				activatedCount: activatedModules.length,
				failedCount: failedModules.length,
				duration
			});

			return {
				success: true,
				partial: true,
				failedModules: failedModules.map((f) => f.moduleId)
			};
		}

		logInfo('SUCCESS', 'All modules activated successfully', {
			userId,
			activatedCount: activatedModules.length,
			disabledCount: modulesToDisable.length,
			duration
		});

		return {
			success: true
		};
	}
};
