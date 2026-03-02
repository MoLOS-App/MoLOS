/**
 * AI Module Configuration
 * Defines routes, navigation items, and metadata for the AI module
 */

import { Bot } from 'lucide-svelte';
import type { ModuleConfig } from '../types';

export const aiConfig: ModuleConfig = {
	id: 'ai',
	name: 'AI',
	href: '/ui/ai',
	icon: Bot,
	description: 'AI agent and tools',
	navigation: [
		{ name: 'Dashboard', icon: Bot, href: '/ui/ai/dashboard' },
		{ name: 'Tools', icon: Bot, href: '/ui/ai/tools' },
		{ name: 'MCP', icon: Bot, href: '/ui/ai/mcp' },
		{ name: 'Telegram', icon: Bot, href: '/ui/ai/telegram' }
	]
};
