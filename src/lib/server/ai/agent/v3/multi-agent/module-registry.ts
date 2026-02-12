/**
 * Module Registry - Manage available module agents
 *
 * Registers and tracks module agents that the Architect can delegate to.
 */

import type { ToolSet } from 'ai';
import type { ModuleAgentConfig } from '../types';
import {
	createModuleDelegationTools,
	generateModuleDescriptions,
} from './delegation-tools';

/**
 * Module Registry - Tracks available module agents
 */
export class ModuleRegistry {
	private modules: Map<string, ModuleAgentConfig> = new Map();

	/**
	 * Register a module agent
	 */
	register(config: ModuleAgentConfig): void {
		this.modules.set(config.id, config);
	}

	/**
	 * Unregister a module agent
	 */
	unregister(moduleId: string): boolean {
		return this.modules.delete(moduleId);
	}

	/**
	 * Get a module by ID
	 */
	get(moduleId: string): ModuleAgentConfig | undefined {
		return this.modules.get(moduleId);
	}

	/**
	 * Get all registered modules
	 */
	getAll(): ModuleAgentConfig[] {
		return Array.from(this.modules.values());
	}

	/**
	 * Check if a module is registered
	 */
	has(moduleId: string): boolean {
		return this.modules.has(moduleId);
	}

	/**
	 * Get the number of registered modules
	 */
	get size(): number {
		return this.modules.size;
	}

	/**
	 * Get delegation tools for all registered modules
	 */
	getDelegationTools(): ToolSet {
		return createModuleDelegationTools(this.getAll());
	}

	/**
	 * Get formatted module descriptions for system prompt
	 */
	getModuleDescriptions(): string {
		return generateModuleDescriptions(this.getAll());
	}

	/**
	 * Clear all registered modules
	 */
	clear(): void {
		this.modules.clear();
	}

	/**
	 * Load modules from configuration
	 */
	loadFromConfig(configs: ModuleAgentConfig[]): void {
		for (const config of configs) {
			this.register(config);
		}
	}

	/**
	 * Check health of all modules
	 */
	async checkAllHealth(): Promise<Map<string, { healthy: boolean; error?: string }>> {
		const results = new Map<string, { healthy: boolean; error?: string }>();

		for (const [id, module] of this.modules) {
			try {
				const response = await fetch(`${module.baseUrl}/api/agent/health`, {
					method: 'GET',
					headers: {
						Authorization: `Bearer module-token-${id}`,
					},
				});

				if (response.ok) {
					const data = await response.json();
					results.set(id, { healthy: data.status === 'ok' });
				} else {
					results.set(id, {
						healthy: false,
						error: `HTTP ${response.status}`,
					});
				}
			} catch (error) {
				results.set(id, {
					healthy: false,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return results;
	}
}

// Global module registry instance
let globalModuleRegistry: ModuleRegistry | null = null;

/**
 * Get the global module registry
 */
export function getModuleRegistry(): ModuleRegistry {
	if (!globalModuleRegistry) {
		globalModuleRegistry = new ModuleRegistry();
	}
	return globalModuleRegistry;
}

/**
 * Reset the global module registry (for testing)
 */
export function resetModuleRegistry(): void {
	if (globalModuleRegistry) {
		globalModuleRegistry.clear();
	}
	globalModuleRegistry = null;
}
