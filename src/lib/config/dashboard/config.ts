/**
 * Dashboard Module Configuration
 * Defines routes, navigation items, and metadata for the Dashboard module
 */

import { LayoutDashboard } from 'lucide-svelte';
import type { ModuleConfig } from '../types';

export const dashboardConfig: ModuleConfig = {
	id: 'dashboard',
	name: 'Dashboard',
	href: '/ui/dashboard',
	icon: LayoutDashboard,
	description: 'Overview and analytics',
	navigation: []
};
