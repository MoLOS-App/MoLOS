/**
 * Plugin Loader - Plugin discovery and loading
 *
 * Handles plugin discovery, loading, and lifecycle management.
 */

import type { IPlugin, PluginConfig, PluginInitContext, PluginMetadata } from './plugin-interface';
import type { IAgentContext } from '../core/context';
import { createPluginLogger } from './plugin-interface';

// ============================================================================
// Plugin Loader Types
// ============================================================================

/**
 * Plugin loader configuration
 */
export interface PluginLoaderConfig {
	/** Plugin directory */
	pluginDir?: string;
	/** Enable debug logging */
	debug: boolean;
	/** Auto-discover plugins */
	autoDiscover: boolean;
}

/**
 * Default plugin loader configuration
 */
export const DEFAULT_PLUGIN_LOADER_CONFIG: PluginLoaderConfig = {
	debug: false,
	autoDiscover: false
};

/**
 * Loaded plugin entry
 */
interface LoadedPlugin {
	plugin: IPlugin;
	config: PluginConfig;
	initialized: boolean;
}

// ============================================================================
// Plugin Loader
// ============================================================================

/**
 * Plugin Loader - Manages plugin discovery and lifecycle
 */
export class PluginLoader {
	private plugins: Map<string, LoadedPlugin> = new Map();
	private config: PluginLoaderConfig;
	private pluginConfigs: Map<string, PluginConfig> = new Map();

	constructor(config: Partial<PluginLoaderConfig> = {}) {
		this.config = { ...DEFAULT_PLUGIN_LOADER_CONFIG, ...config };
	}

	/**
	 * Register a plugin
	 */
	register(plugin: IPlugin, config?: Partial<PluginConfig>): void {
		const pluginConfig: PluginConfig = {
			enabled: config?.enabled ?? true,
			options: config?.options
		};

		this.plugins.set(plugin.metadata.id, {
			plugin,
			config: pluginConfig,
			initialized: false
		});

		this.pluginConfigs.set(plugin.metadata.id, pluginConfig);

		if (this.config.debug) {
			console.log(`[PluginLoader] Registered: ${plugin.metadata.name} v${plugin.metadata.version}`);
		}
	}

	/**
	 * Unregister a plugin
	 */
	async unregister(pluginId: string): Promise<boolean> {
		const entry = this.plugins.get(pluginId);
		if (!entry) return false;

		// Dispose if initialized
		if (entry.initialized && entry.plugin.dispose) {
			try {
				await entry.plugin.dispose();
			} catch (error) {
				if (this.config.debug) {
					console.error(`[PluginLoader] Error disposing ${pluginId}:`, error);
				}
			}
		}

		this.plugins.delete(pluginId);
		this.pluginConfigs.delete(pluginId);

		return true;
	}

	/**
	 * Initialize all registered plugins
	 */
	async initializeAll(context: IAgentContext): Promise<void> {
		for (const [id, entry] of this.plugins) {
			if (!entry.config.enabled) continue;

			try {
				await this.initializePlugin(id, context);
			} catch (error) {
				if (this.config.debug) {
					console.error(`[PluginLoader] Failed to initialize ${id}:`, error);
				}
			}
		}
	}

	/**
	 * Initialize a specific plugin
	 */
	async initializePlugin(pluginId: string, context: IAgentContext): Promise<boolean> {
		const entry = this.plugins.get(pluginId);
		if (!entry) return false;

		if (entry.initialized) return true;

		if (!entry.config.enabled) {
			if (this.config.debug) {
				console.log(`[PluginLoader] Plugin ${pluginId} is disabled`);
			}
			return false;
		}

		// Check dependencies
		const deps = entry.plugin.metadata.dependencies;
		if (deps) {
			for (const dep of deps) {
				const depEntry = this.plugins.get(dep);
				if (!depEntry || !depEntry.initialized) {
					throw new Error(`Plugin ${pluginId} depends on ${dep} which is not initialized`);
				}
			}
		}

		// Create init context
		const initContext: PluginInitContext = {
			agentContext: context,
			config: entry.config,
			registerTool: (tool) => {
				context.setTools([...context.getTools(), tool]);
			},
			registerPreHook: (hook) => {
				// Would register with hook manager
			},
			registerPostHook: (hook) => {
				// Would register with hook manager
			},
			registerStopHook: (hook) => {
				// Would register with hook manager
			},
			getService: (identifier) => {
				try {
					return context.getService(identifier);
				} catch {
					return undefined;
				}
			},
			logger: createPluginLogger(entry.plugin.metadata.name, this.config.debug)
		};

		// Initialize
		await entry.plugin.initialize(initContext);
		entry.initialized = true;

		if (this.config.debug) {
			console.log(`[PluginLoader] Initialized: ${entry.plugin.metadata.name}`);
		}

		return true;
	}

	/**
	 * Dispose all plugins
	 */
	async disposeAll(): Promise<void> {
		for (const [id, entry] of this.plugins) {
			if (entry.initialized && entry.plugin.dispose) {
				try {
					await entry.plugin.dispose();
					entry.initialized = false;
				} catch (error) {
					if (this.config.debug) {
						console.error(`[PluginLoader] Error disposing ${id}:`, error);
					}
				}
			}
		}
	}

	/**
	 * Get plugin by ID
	 */
	getPlugin(pluginId: string): IPlugin | undefined {
		return this.plugins.get(pluginId)?.plugin;
	}

	/**
	 * Get all registered plugins
	 */
	getAllPlugins(): IPlugin[] {
		return Array.from(this.plugins.values()).map(e => e.plugin);
	}

	/**
	 * Get plugin metadata
	 */
	getPluginMetadata(): PluginMetadata[] {
		return Array.from(this.plugins.values()).map(e => e.plugin.metadata);
	}

	/**
	 * Enable a plugin
	 */
	enable(pluginId: string): boolean {
		const entry = this.plugins.get(pluginId);
		if (!entry) return false;

		entry.config.enabled = true;
		return true;
	}

	/**
	 * Disable a plugin
	 */
	disable(pluginId: string): boolean {
		const entry = this.plugins.get(pluginId);
		if (!entry) return false;

		entry.config.enabled = false;
		return true;
	}

	/**
	 * Check if plugin is enabled
	 */
	isEnabled(pluginId: string): boolean {
		return this.plugins.get(pluginId)?.config.enabled ?? false;
	}

	/**
	 * Update plugin configuration
	 */
	updateConfig(pluginId: string, config: Partial<PluginConfig>): boolean {
		const entry = this.plugins.get(pluginId);
		if (!entry) return false;

		entry.config = {
			...entry.config,
			...config
		};

		// Notify plugin of config change
		if (entry.plugin.onConfigChange) {
			entry.plugin.onConfigChange(entry.config);
		}

		return true;
	}

	/**
	 * Get count of loaded plugins
	 */
	get count(): number {
		return this.plugins.size;
	}
}

/**
 * Create a plugin loader
 */
export function createPluginLoader(config?: Partial<PluginLoaderConfig>): PluginLoader {
	return new PluginLoader(config);
}
