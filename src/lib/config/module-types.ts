/**
 * Comprehensive Module Type Definitions & Validation
 *
 * This file defines the complete contract for MoLOS modules, including:
 * - ModuleManifest: The module's static metadata (from manifest.yaml)
 * - ModuleConfig: Runtime configuration and navigation structure
 * - ModuleExports: Required exports from module's config.ts
 * - Module validation schemas using Zod
 *
 * All modules must comply with these types to be properly integrated.
 */

import { z } from 'zod';
import type { ToolDefinition } from '$lib/models/ai';

/**
 * Module Manifest Schema
 * Parsed from manifest.yaml in each module's root directory.
 */
export const ModuleManifestSchema = z.object({
	id: z
		.string()
		.min(1, 'Module ID is required')
		.regex(
			/^[a-zA-Z0-9_-]+$/,
			'Module ID must contain only alphanumeric characters, hyphens, and underscores'
		),
	name: z.string().min(1, 'Module name is required'),
	version: z.string().regex(/^\d+\.\d+\.\d+/, 'Version must follow semver format (e.g., 1.0.0)'),
	description: z.string().optional(),
	author: z.string().optional(),
	icon: z.string().optional().describe('Lucide icon name (e.g., SquareCheck, Zap, Brain)'),

	// Module system requirements
	minMolosVersion: z
		.string()
		.regex(/^\d+\.\d+\.\d+/, 'minMolosVersion must follow semver format')
		.optional()
		.describe('Minimum MoLOS version required to run this module'),

	// Module dependencies (other modules this module requires)
	dependencies: z
		.record(z.string(), z.string())
		.optional()
		.describe('Map of moduleId to semver requirement (e.g., { "MoLOS-Tasks": "^1.0.0" })'),

	// Runtime behavior
	enabled: z.boolean().default(true).describe('Whether this module is enabled by default')
});

export type ModuleManifest = z.infer<typeof ModuleManifestSchema>;

/**
 * Navigation Item for module
 */
export const NavItemSchema = z.object({
	name: z.string().min(1, 'Navigation item name is required'),
	icon: z.any().describe('Lucide icon component'),
	href: z.string().optional().describe('Route path for this nav item'),
	badge: z.number().optional().describe('Badge count to display'),
	disabled: z.boolean().optional().describe('Whether this nav item is disabled')
});

export type NavItem = z.infer<typeof NavItemSchema>;

/**
 * Module Configuration
 * Runtime configuration loaded from module's config.ts
 */
export const ModuleConfigSchema = z.object({
	// Basic Info
	id: z.string().min(1, 'Module ID is required'),
	name: z.string().min(1, 'Module name is required'),
	href: z
		.string()
		.min(1, 'Module href is required')
		.regex(/^\/ui\//, 'Module href must start with /ui/'),
	icon: z.any().describe('Lucide icon component'),
	description: z.string().optional(),
	isExternal: z.boolean().optional().describe('True if module is loaded from external source'),

	// Navigation
	navigation: z.array(NavItemSchema).describe('Navigation items for this module'),

	// Optional features
	toolDefinitions: z
		.array(z.custom<ToolDefinition>())
		.optional()
		.describe('AI tool definitions this module provides')
});

export type ModuleConfig = z.infer<typeof ModuleConfigSchema>;

/**
 * Module Exports
 * What a module's config.ts must export
 */
export const ModuleExportsSchema = z.object({
	default: ModuleConfigSchema.optional(),
	moduleConfig: ModuleConfigSchema.optional()
});

export type ModuleExports = z.infer<typeof ModuleExportsSchema>;

/**
 * Module Interface Contract
 * Complete interface a module must satisfy
 */
export interface IModule {
	// Required files
	manifest: ModuleManifest;
	config: ModuleConfig;

	// Optional capabilities
	toolDefinitions?: ToolDefinition[];
	aiIntegration?: {
		tools?: ToolDefinition[];
		models?: string[];
	};
}

/**
 * Database Status for modules
 * Tracks the lifecycle state of a module
 */
export type ModuleStatus =
	| 'active'
	| 'disabled'
	| 'error_manifest'
	| 'error_migration'
	| 'error_config'
	| 'deleting';

/**
 * Module Error Details
 * Provides context about why a module failed
 */
export interface ModuleError {
	status: Exclude<ModuleStatus, 'active' | 'disabled' | 'deleting'>;
	errorType:
		| 'manifest_validation'
		| 'migration_failed'
		| 'config_export'
		| 'symlink_failed'
		| 'unknown';
	message: string;
	timestamp: Date;
	details?: Record<string, any>;
	recoverySteps?: string[];
}

/**
 * Module Metadata for Database Storage
 */
export interface ModuleRecord {
	id: string;
	name: string;
	version: string;
	repoUrl: string;
	status: ModuleStatus;
	error?: ModuleError;
	createdAt: Date;
	updatedAt: Date;
	lastInitializedAt?: Date;
}

/**
 * Validation helpers
 */

export function validateModuleManifest(
	data: unknown
): { valid: true; data: ModuleManifest } | { valid: false; error: z.ZodError } {
	const result = ModuleManifestSchema.safeParse(data);
	if (result.success) {
		return { valid: true, data: result.data };
	}
	return { valid: false, error: result.error };
}

export function validateModuleConfig(
	data: unknown
): { valid: true; data: ModuleConfig } | { valid: false; error: z.ZodError } {
	const result = ModuleConfigSchema.safeParse(data);
	if (result.success) {
		return { valid: true, data: result.data };
	}
	return { valid: false, error: result.error };
}

/**
 * Helper to format Zod validation errors into readable messages
 */
export function formatValidationErrors(error: z.ZodError): string[] {
	return error.issues.map((issue) => {
		const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
		return `${path}${issue.message}`;
	});
}
