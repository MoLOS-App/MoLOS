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
import type { ToolDefinition } from './ai';
/**
 * Module Manifest Schema
 * Parsed from manifest.yaml in each module's root directory.
 */
export declare const ModuleManifestSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    minMolosVersion: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type ModuleManifest = z.infer<typeof ModuleManifestSchema>;
/**
 * Navigation Item for module
 */
export declare const NavItemSchema: z.ZodObject<{
    name: z.ZodString;
    icon: z.ZodAny;
    href: z.ZodOptional<z.ZodString>;
    badge: z.ZodOptional<z.ZodNumber>;
    disabled: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type NavItem = z.infer<typeof NavItemSchema>;
/**
 * Module Configuration
 * Runtime configuration loaded from module's config.ts
 */
export declare const ModuleConfigSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    href: z.ZodString;
    icon: z.ZodAny;
    description: z.ZodOptional<z.ZodString>;
    isExternal: z.ZodOptional<z.ZodBoolean>;
    navigation: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        icon: z.ZodAny;
        href: z.ZodOptional<z.ZodString>;
        badge: z.ZodOptional<z.ZodNumber>;
        disabled: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    toolDefinitions: z.ZodOptional<z.ZodArray<z.ZodCustom<ToolDefinition, ToolDefinition>>>;
}, z.core.$strip>;
export type ModuleConfig = z.infer<typeof ModuleConfigSchema>;
/**
 * Module Exports
 * What a module's config.ts must export
 */
export declare const ModuleExportsSchema: z.ZodObject<{
    default: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        href: z.ZodString;
        icon: z.ZodAny;
        description: z.ZodOptional<z.ZodString>;
        isExternal: z.ZodOptional<z.ZodBoolean>;
        navigation: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            icon: z.ZodAny;
            href: z.ZodOptional<z.ZodString>;
            badge: z.ZodOptional<z.ZodNumber>;
            disabled: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
        toolDefinitions: z.ZodOptional<z.ZodArray<z.ZodCustom<ToolDefinition, ToolDefinition>>>;
    }, z.core.$strip>>;
    moduleConfig: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        href: z.ZodString;
        icon: z.ZodAny;
        description: z.ZodOptional<z.ZodString>;
        isExternal: z.ZodOptional<z.ZodBoolean>;
        navigation: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            icon: z.ZodAny;
            href: z.ZodOptional<z.ZodString>;
            badge: z.ZodOptional<z.ZodNumber>;
            disabled: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
        toolDefinitions: z.ZodOptional<z.ZodArray<z.ZodCustom<ToolDefinition, ToolDefinition>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ModuleExports = z.infer<typeof ModuleExportsSchema>;
/**
 * Module Interface Contract
 * Complete interface a module must satisfy
 */
export interface IModule {
    manifest: ModuleManifest;
    config: ModuleConfig;
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
export type ModuleStatus = 'active' | 'disabled' | 'error_manifest' | 'error_migration' | 'error_config' | 'deleting';
/**
 * Module Error Details
 * Provides context about why a module failed
 */
export interface ModuleError {
    status: Exclude<ModuleStatus, 'active' | 'disabled' | 'deleting'>;
    errorType: 'manifest_validation' | 'migration_failed' | 'config_export' | 'symlink_failed' | 'unknown';
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
export declare function validateModuleManifest(data: unknown): {
    valid: true;
    data: ModuleManifest;
} | {
    valid: false;
    error: z.ZodError;
};
export declare function validateModuleConfig(data: unknown): {
    valid: true;
    data: ModuleConfig;
} | {
    valid: false;
    error: z.ZodError;
};
/**
 * Helper to format Zod validation errors into readable messages
 */
export declare function formatValidationErrors(error: z.ZodError): string[];
//# sourceMappingURL=module.d.ts.map