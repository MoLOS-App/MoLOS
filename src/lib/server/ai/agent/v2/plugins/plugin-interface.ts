/**
 * Plugin Interface - Extensibility system for the agent
 *
 * Defines the plugin interface for extending agent functionality.
 */

import type { IAgentContext } from '../core/context';
import type { ToolDefinition } from '../core/types';
import type { HookDefinition, PreToolUseHook, PostToolUseHook, StopHook } from '../hooks/hook-types';

// ============================================================================
// Plugin Types
// ============================================================================

/**
 * Plugin metadata
 */
export interface PluginMetadata {
	/** Plugin ID */
	id: string;
	/** Plugin name */
	name: string;
	/** Plugin version */
	version: string;
	/** Plugin description */
	description?: string;
	/** Author */
	author?: string;
	/** Dependencies */
	dependencies?: string[];
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
	/** Whether plugin is enabled */
	enabled: boolean;
	/** Plugin-specific configuration */
	options?: Record<string, unknown>;
}

/**
 * Plugin initialization context
 */
export interface PluginInitContext {
	/** Agent context */
	agentContext: IAgentContext;
	/** Plugin configuration */
	config: PluginConfig;
	/** Register a tool */
	registerTool: (tool: ToolDefinition) => void;
	/** Register a pre-tool hook */
	registerPreHook: (hook: HookDefinition<PreToolUseHook>) => void;
	/** Register a post-tool hook */
	registerPostHook: (hook: HookDefinition<PostToolUseHook>) => void;
	/** Register a stop hook */
	registerStopHook: (hook: HookDefinition<StopHook>) => void;
	/** Get a service */
	getService: <T>(identifier: symbol) => T | undefined;
	/** Logger */
	logger: PluginLogger;
}

/**
 * Plugin logger
 */
export interface PluginLogger {
	debug(message: string, ...args: unknown[]): void;
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
}

// ============================================================================
// Plugin Interface
// ============================================================================

/**
 * Plugin interface
 */
export interface IPlugin {
	/** Plugin metadata */
	metadata: PluginMetadata;

	/**
	 * Initialize the plugin
	 */
	initialize(context: PluginInitContext): Promise<void> | void;

	/**
	 * Dispose the plugin
	 */
	dispose?(): Promise<void> | void;

	/**
	 * Get tools provided by this plugin
	 */
	getTools?(): ToolDefinition[];

	/**
	 * Get hooks provided by this plugin
	 */
	getHooks?(): {
		pre?: Array<HookDefinition<PreToolUseHook>>;
		post?: Array<HookDefinition<PostToolUseHook>>;
		stop?: Array<HookDefinition<StopHook>>;
	};

	/**
	 * Handle configuration changes
	 */
	onConfigChange?(config: PluginConfig): Promise<void> | void;
}

// ============================================================================
// Base Plugin
// ============================================================================

/**
 * Base plugin class for easier plugin development
 */
export abstract class BasePlugin implements IPlugin {
	abstract metadata: PluginMetadata;

	protected context?: PluginInitContext;
	protected config?: PluginConfig;

	// Optional methods that subclasses can implement
	getTools?(): ToolDefinition[];
	getHooks?(): {
		pre?: Array<HookDefinition<PreToolUseHook>>;
		post?: Array<HookDefinition<PostToolUseHook>>;
		stop?: Array<HookDefinition<StopHook>>;
	};

	async initialize(context: PluginInitContext): Promise<void> {
		this.context = context;
		this.config = context.config;

		// Register tools
		if (this.getTools) {
			const tools = this.getTools();
			for (const tool of tools) {
				context.registerTool(tool);
			}
		}

		// Register hooks
		if (this.getHooks) {
			const hooks = this.getHooks();
			if (hooks.pre) {
				for (const hook of hooks.pre) {
					context.registerPreHook(hook);
				}
			}
			if (hooks.post) {
				for (const hook of hooks.post) {
					context.registerPostHook(hook);
				}
			}
			if (hooks.stop) {
				for (const hook of hooks.stop) {
					context.registerStopHook(hook);
				}
			}
		}
	}

	async dispose(): Promise<void> {
		this.context = undefined;
		this.config = undefined;
	}

	/**
	 * Log debug message
	 */
	protected debug(message: string, ...args: unknown[]): void {
		this.context?.logger.debug(`[${this.metadata.name}] ${message}`, ...args);
	}

	/**
	 * Log info message
	 */
	protected info(message: string, ...args: unknown[]): void {
		this.context?.logger.info(`[${this.metadata.name}] ${message}`, ...args);
	}

	/**
	 * Log warning message
	 */
	protected warn(message: string, ...args: unknown[]): void {
		this.context?.logger.warn(`[${this.metadata.name}] ${message}`, ...args);
	}

	/**
	 * Log error message
	 */
	protected error(message: string, ...args: unknown[]): void {
		this.context?.logger.error(`[${this.metadata.name}] ${message}`, ...args);
	}
}

// ============================================================================
// Plugin Utilities
// ============================================================================

/**
 * Create a simple plugin from tools and hooks
 */
export function createSimplePlugin(
	metadata: PluginMetadata,
	tools: ToolDefinition[] = [],
	hooks?: {
		pre?: Array<HookDefinition<PreToolUseHook>>;
		post?: Array<HookDefinition<PostToolUseHook>>;
		stop?: Array<HookDefinition<StopHook>>;
	}
): IPlugin {
	return {
		metadata,
		getTools: () => tools,
		getHooks: () => hooks,
		initialize: async (context: PluginInitContext) => {
			for (const tool of tools) {
				context.registerTool(tool);
			}
			if (hooks?.pre) {
				for (const hook of hooks.pre) {
					context.registerPreHook(hook);
				}
			}
			if (hooks?.post) {
				for (const hook of hooks.post) {
					context.registerPostHook(hook);
				}
			}
			if (hooks?.stop) {
				for (const hook of hooks.stop) {
					context.registerStopHook(hook);
				}
			}
		}
	};
}

/**
 * Create a default plugin logger
 */
export function createPluginLogger(pluginName: string, debug: boolean = false): PluginLogger {
	return {
		debug: (message, ...args) => {
			if (debug) console.log(`[DEBUG][${pluginName}] ${message}`, ...args);
		},
		info: (message, ...args) => {
			console.log(`[INFO][${pluginName}] ${message}`, ...args);
		},
		warn: (message, ...args) => {
			console.warn(`[WARN][${pluginName}] ${message}`, ...args);
		},
		error: (message, ...args) => {
			console.error(`[ERROR][${pluginName}] ${message}`, ...args);
		}
	};
}
