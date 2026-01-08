/**
 * AI Module Configuration
 * Defines routes, navigation items, and metadata for the AI module
 */

import { Bot } from 'lucide-svelte';
import type { ModuleConfig } from '../../types';

export const aiConfig: ModuleConfig = {
	id: 'ai',
	name: 'AI',
	href: '/ui/ai',
	icon: Bot,
	description: 'Conversational workspace for the MoLOS agent',
	navigation: [
		{
			name: 'Dashboard',
			icon: Bot,
			href: '/ui/ai/dashboard'
		}
	]
};
