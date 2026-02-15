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
/**
 * Module Manifest Schema
 * Parsed from manifest.yaml in each module's root directory.
 */
export var ModuleManifestSchema = z.object({
    id: z
        .string()
        .min(1, 'Module ID is required')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Module ID must contain only alphanumeric characters, hyphens, and underscores'),
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
/**
 * Navigation Item for module
 */
export var NavItemSchema = z.object({
    name: z.string().min(1, 'Navigation item name is required'),
    icon: z.any().describe('Lucide icon component'),
    href: z.string().optional().describe('Route path for this nav item'),
    badge: z.number().optional().describe('Badge count to display'),
    disabled: z.boolean().optional().describe('Whether this nav item is disabled')
});
/**
 * Module Configuration
 * Runtime configuration loaded from module's config.ts
 */
export var ModuleConfigSchema = z.object({
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
        .array(z.custom())
        .optional()
        .describe('AI tool definitions this module provides')
});
/**
 * Module Exports
 * What a module's config.ts must export
 */
export var ModuleExportsSchema = z.object({
    default: ModuleConfigSchema.optional(),
    moduleConfig: ModuleConfigSchema.optional()
});
/**
 * Validation helpers
 */
export function validateModuleManifest(data) {
    var result = ModuleManifestSchema.safeParse(data);
    if (result.success) {
        return { valid: true, data: result.data };
    }
    return { valid: false, error: result.error };
}
export function validateModuleConfig(data) {
    var result = ModuleConfigSchema.safeParse(data);
    if (result.success) {
        return { valid: true, data: result.data };
    }
    return { valid: false, error: result.error };
}
/**
 * Helper to format Zod validation errors into readable messages
 */
export function formatValidationErrors(error) {
    return error.issues.map(function (issue) {
        var path = issue.path.length > 0 ? "".concat(issue.path.join('.'), ": ") : '';
        return "".concat(path).concat(issue.message);
    });
}
//# sourceMappingURL=module.js.map