/**
 * Standardized types for module configuration
 */
import type { ToolDefinition } from '$lib/models/ai';

export interface NavItem {
	name: string;
	icon: any; // lucide-svelte icon component
	href?: string; // Optional href for routing
	badge?: number; // Optional badge count
	disabled?: boolean;
}

export interface ModuleConfig {
	// Basic Info
	id: string; // Unique identifier (e.g., 'dashboard', 'tasks')
	name: string; // Display name
	href: string; // Route path (e.g., '/ui/dashboard')
	icon: any; // lucide-svelte icon component
	description?: string; // Short description
	isExternal?: boolean; // True if cloned from git

	// Navigation
	navigation: NavItem[];
}
