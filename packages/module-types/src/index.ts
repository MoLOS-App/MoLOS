/**
 * Standardized types for module configuration
 *
 * This package provides shared types for MoLOS modules.
 * External modules can depend on this package to get proper typing.
 */

import type { Component } from 'svelte';

/**
 * Icon type - Lucide Svelte icon component
 */
export type IconComponent = Component<any, any, any>;

export interface NavItem {
	name: string;
	icon: IconComponent; // lucide-svelte icon component
	href?: string; // Optional href for routing
	badge?: number; // Optional badge count
	disabled?: boolean;
}

export interface ModuleConfig {
	// Basic Info
	id: string; // Unique identifier (e.g., 'dashboard', 'tasks')
	name: string; // Display name
	href: string; // Route path (e.g., '/ui/dashboard')
	icon: IconComponent; // lucide-svelte icon component
	description?: string; // Short description

	// Module types (mutually exclusive)
	isExternal?: boolean; // @deprecated - True if cloned from git (legacy)
	isPackageModule?: boolean; // True if from modules/ directory (new package-based modules)

	// Navigation
	navigation: NavItem[];
}
