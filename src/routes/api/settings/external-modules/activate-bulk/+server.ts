/**
 * Bulk Module Activation API Endpoint
 *
 * POST /api/settings/external-modules/activate-bulk
 *
 * Activates multiple modules during the welcome flow when a new user sets up their account.
 * This endpoint is designed for maximum robustness since failures during onboarding
 * should NOT happen.
 *
 * Minimum Required Modules: ['dashboard', 'ai', 'MoLOS-Tasks', 'MoLOS-Markdown']
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';
import { db } from '$lib/server/db';
import { z } from 'zod';
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
// Validation Schema
// ============================================

const BulkActivateSchema = z.object({
	modules: z
		.array(z.string().min(1, 'Module ID cannot be empty'))
		.min(REQUIRED_MODULES.length, `At least ${REQUIRED_MODULES.length} modules are required`)
});

// ============================================
// Helper Functions
// ============================================

/**
 * Validates that all required modules are present in the request
 * @param requestedModules - Array of module IDs from the request
 * @returns Object with validation result and any missing modules
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
 * @param requestedModules - Array of module IDs from the request
 * @returns Object with validation result and any invalid modules
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
 * @param moduleId - The module ID
 * @returns The repository URL or empty string if internal/unknown
 */
function getRepoUrl(moduleId: string): string {
	return KNOWN_REPO_URLS[moduleId] ?? '';
}

/**
 * Logs an error with full context for debugging
 * @param context - Context string for the log
 * @param error - The error object
 * @param additionalData - Any additional data to log
 */
function logError(context: string, err: unknown, additionalData?: Record<string, unknown>): void {
	console.error(`[BulkActivate] ${context}:`, {
		error: err instanceof Error ? err.message : String(err),
		stack: err instanceof Error ? err.stack : undefined,
		timestamp: new Date().toISOString(),
		...additionalData
	});
}

/**
 * Logs an info message with context
 * @param context - Context string for the log
 * @param message - The message to log
 * @param data - Any additional data to log
 */
function logInfo(context: string, message: string, data?: Record<string, unknown>): void {
	console.log(`[BulkActivate] ${context}:`, {
		message,
		timestamp: new Date().toISOString(),
		...data
	});
}

// ============================================
// Response Types
// ============================================

interface SuccessResponse {
	success: true;
	activatedModules: string[];
	failedModules?: string[];
}

interface ValidationErrorResponse {
	success: false;
	error: string;
	missingModules?: string[];
	invalidModules?: string[];
}

interface ServerErrorResponse {
	success: false;
	error: string;
	details?: string;
}

// ============================================
// Request Handler
// ============================================

export const POST: RequestHandler = async ({ locals, request }) => {
	const startTime = Date.now();
	logInfo('START', 'Beginning bulk module activation');

	// ============================================
	// Step 1: Authentication Check
	// ============================================
	if (!locals.user) {
		logError('AUTH', 'No user session found');
		throw error(401, 'Unauthorized: You must be logged in to activate modules');
	}

	const userId = locals.user.id;
	logInfo('AUTH', 'User authenticated', { userId });

	// ============================================
	// Step 2: Parse and Validate Request Body
	// ============================================
	let requestBody: unknown;
	try {
		requestBody = await request.json();
	} catch (err) {
		logError('PARSE', err, { userId });
		return json(
			{
				success: false,
				error: 'Invalid JSON in request body'
			} as ValidationErrorResponse,
			{ status: 400 }
		);
	}

	const parseResult = BulkActivateSchema.safeParse(requestBody);
	if (!parseResult.success) {
		const errorMessage = parseResult.error.issues[0]?.message || 'Validation failed';
		logError('VALIDATION', parseResult.error, { userId, requestBody });
		return json(
			{
				success: false,
				error: errorMessage
			} as ValidationErrorResponse,
			{ status: 400 }
		);
	}

	const { modules: requestedModules } = parseResult.data;
	logInfo('VALIDATION', 'Request body parsed successfully', {
		userId,
		moduleCount: requestedModules.length
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
		return json(
			{
				success: false,
				error: `Missing required modules: ${requiredValidation.missingModules.join(', ')}`,
				missingModules: requiredValidation.missingModules
			} as ValidationErrorResponse,
			{ status: 400 }
		);
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
		return json(
			{
				success: false,
				error: `Invalid module IDs: ${existenceValidation.invalidModules.join(', ')}`,
				invalidModules: existenceValidation.invalidModules
			} as ValidationErrorResponse,
			{ status: 400 }
		);
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
	// Step 7: Prepare Response
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
			return json(
				{
					success: false,
					error: `Failed to activate required modules: ${failedRequired.join(', ')}`,
					details: JSON.stringify(failedModules)
				} as ServerErrorResponse,
				{ status: 500 }
			);
		}

		// Non-required modules failed - return partial success
		return json(
			{
				success: true,
				activatedModules,
				failedModules: failedModules.map((f) => f.moduleId)
			} as SuccessResponse,
			{ status: 200 }
		);
	}

	logInfo('SUCCESS', 'All modules activated successfully', {
		userId,
		activatedCount: activatedModules.length,
		duration
	});

	return json(
		{
			success: true,
			activatedModules
		} as SuccessResponse,
		{ status: 200 }
	);
};

// ============================================
// Health Check / Documentation
// ============================================

/**
 * GET endpoint returns API documentation
 * Useful for debugging and API discovery
 */
export const GET: RequestHandler = async () => {
	return json({
		endpoint: '/api/settings/external-modules/activate-bulk',
		method: 'POST',
		description: 'Bulk activate modules during welcome flow',
		requiredModules: REQUIRED_MODULES,
		requestBody: {
			modules: 'string[] - Array of module IDs to activate'
		},
		responses: {
			200: {
				success: true,
				activatedModules: 'string[]'
			},
			400: {
				success: false,
				error: 'string',
				missingModules: 'string[] (optional)',
				invalidModules: 'string[] (optional)'
			},
			401: {
				success: false,
				error: 'Unauthorized'
			},
			500: {
				success: false,
				error: 'string',
				details: 'string (optional)'
			}
		}
	});
};
