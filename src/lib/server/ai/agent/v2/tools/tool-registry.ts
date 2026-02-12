/**
 * Tool Registry - Tool registration and discovery
 *
 * Manages tool definitions and provides lookup capabilities.
 */

import type { ToolDefinition, ToolCall } from '../core/types';

// ============================================================================
// Tool Registry Types
// ============================================================================

/**
 * Tool metadata
 */
export interface ToolMetadata {
	/** Tool category */
	category?: string;
	/** Tool tags */
	tags?: string[];
	/** Whether tool modifies state */
	isWriteOperation?: boolean;
	/** Whether tool is idempotent */
	isIdempotent?: boolean;
	/** Estimated execution time in ms */
	estimatedDuration?: number;
	/** Required permissions */
	requiredPermissions?: string[];
	/** Tool version */
	version?: string;
	/** Tool deprecation message */
	deprecated?: string;
}

/**
 * Registered tool entry
 */
export interface RegisteredTool {
	/** Tool definition */
	definition: ToolDefinition;
	/** Tool metadata */
	metadata: ToolMetadata;
	/** Whether tool is enabled */
	enabled: boolean;
	/** Registration timestamp */
	registeredAt: number;
	/** Usage count */
	usageCount: number;
}

/**
 * Tool registry configuration
 */
export interface ToolRegistryConfig {
	/** Maximum number of tools */
	maxTools?: number;
	/** Enable debug logging */
	debug?: boolean;
}

// ============================================================================
// Tool Registry
// ============================================================================

/**
 * Tool Registry - Manages tool registration and lookup
 */
export class ToolRegistry {
	private tools: Map<string, RegisteredTool> = new Map();
	private categories: Map<string, Set<string>> = new Map();
	private config: Required<ToolRegistryConfig>;

	constructor(config: ToolRegistryConfig = {}) {
		this.config = {
			maxTools: config.maxTools ?? 200,
			debug: config.debug ?? false
		};
	}

	/**
	 * Register a tool
	 */
	register(tool: ToolDefinition, metadata: ToolMetadata = {}): void {
		if (this.tools.has(tool.name)) {
			if (this.config.debug) {
				console.log(`[ToolRegistry] Re-registering tool: ${tool.name}`);
			}
		}

		if (this.tools.size >= this.config.maxTools && !this.tools.has(tool.name)) {
			throw new Error(`Maximum tools limit reached: ${this.config.maxTools}`);
		}

		const entry: RegisteredTool = {
			definition: tool,
			metadata: {
				category: metadata.category || 'general',
				tags: metadata.tags || [],
				isWriteOperation: metadata.isWriteOperation ?? false,
				isIdempotent: metadata.isIdempotent ?? true,
				estimatedDuration: metadata.estimatedDuration ?? 100,
				requiredPermissions: metadata.requiredPermissions || [],
				version: metadata.version || '1.0.0',
				deprecated: metadata.deprecated
			},
			enabled: true,
			registeredAt: Date.now(),
			usageCount: 0
		};

		this.tools.set(tool.name, entry);

		// Update category index
		const category = entry.metadata.category || 'general';
		if (!this.categories.has(category)) {
			this.categories.set(category, new Set());
		}
		this.categories.get(category)!.add(tool.name);

		if (this.config.debug) {
			console.log(`[ToolRegistry] Registered tool: ${tool.name} (${category})`);
		}
	}

	/**
	 * Register multiple tools
	 */
	registerAll(tools: Array<{ tool: ToolDefinition; metadata?: ToolMetadata }>): void {
		for (const { tool, metadata } of tools) {
			this.register(tool, metadata);
		}
	}

	/**
	 * Unregister a tool
	 */
	unregister(name: string): boolean {
		const entry = this.tools.get(name);
		if (!entry) return false;

		// Remove from category index
		const category = entry.metadata.category || 'general';
		this.categories.get(category)?.delete(name);

		return this.tools.delete(name);
	}

	/**
	 * Get a tool by name
	 */
	get(name: string): ToolDefinition | undefined {
		const entry = this.tools.get(name);
		if (!entry || !entry.enabled) return undefined;
		return entry.definition;
	}

	/**
	 * Get a registered tool entry (with metadata)
	 */
	getEntry(name: string): RegisteredTool | undefined {
		return this.tools.get(name);
	}

	/**
	 * Check if a tool exists
	 */
	has(name: string): boolean {
		return this.tools.has(name);
	}

	/**
	 * Enable a tool
	 */
	enable(name: string): void {
		const entry = this.tools.get(name);
		if (entry) {
			entry.enabled = true;
		}
	}

	/**
	 * Disable a tool
	 */
	disable(name: string): void {
		const entry = this.tools.get(name);
		if (entry) {
			entry.enabled = false;
		}
	}

	/**
	 * Get all enabled tools
	 */
	getAll(): ToolDefinition[] {
		return Array.from(this.tools.values())
			.filter(entry => entry.enabled && !entry.metadata.deprecated)
			.map(entry => entry.definition);
	}

	/**
	 * Get all registered tools (including disabled)
	 */
	getAllEntries(): RegisteredTool[] {
		return Array.from(this.tools.values());
	}

	/**
	 * Get tools by category
	 */
	getByCategory(category: string): ToolDefinition[] {
		const names = this.categories.get(category);
		if (!names) return [];

		return Array.from(names)
			.map(name => this.tools.get(name))
			.filter((entry): entry is RegisteredTool => entry?.enabled === true)
			.map(entry => entry.definition);
	}

	/**
	 * Get tools by tag
	 */
	getByTag(tag: string): ToolDefinition[] {
		return Array.from(this.tools.values())
			.filter(entry =>
				entry.enabled &&
				entry.metadata.tags?.includes(tag)
			)
			.map(entry => entry.definition);
	}

	/**
	 * Get write operation tools
	 */
	getWriteTools(): ToolDefinition[] {
		return Array.from(this.tools.values())
			.filter(entry => entry.enabled && entry.metadata.isWriteOperation)
			.map(entry => entry.definition);
	}

	/**
	 * Get read operation tools
	 */
	getReadTools(): ToolDefinition[] {
		return Array.from(this.tools.values())
			.filter(entry => entry.enabled && !entry.metadata.isWriteOperation)
			.map(entry => entry.definition);
	}

	/**
	 * Search tools by name or description
	 */
	search(query: string): ToolDefinition[] {
		const lowerQuery = query.toLowerCase();

		return Array.from(this.tools.values())
			.filter(entry => {
				if (!entry.enabled) return false;

				const name = entry.definition.name.toLowerCase();
				const desc = entry.definition.description.toLowerCase();

				return name.includes(lowerQuery) || desc.includes(lowerQuery);
			})
			.map(entry => entry.definition);
	}

	/**
	 * Increment usage count for a tool
	 */
	incrementUsage(name: string): void {
		const entry = this.tools.get(name);
		if (entry) {
			entry.usageCount++;
		}
	}

	/**
	 * Get usage statistics
	 */
	getUsageStats(): Map<string, number> {
		const stats = new Map<string, number>();

		for (const [name, entry] of this.tools) {
			stats.set(name, entry.usageCount);
		}

		return stats;
	}

	/**
	 * Get available categories
	 */
	getCategories(): string[] {
		return Array.from(this.categories.keys());
	}

	/**
	 * Clear all tools
	 */
	clear(): void {
		this.tools.clear();
		this.categories.clear();
	}

	/**
	 * Get registry size
	 */
	get size(): number {
		return this.tools.size;
	}

	/**
	 * Export tools for LLM function calling
	 */
	exportForLLM(): Array<{
		name: string;
		description: string;
		parameters: unknown;
	}> {
		return this.getAll().map(tool => ({
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters || { type: 'object', properties: {} }
		}));
	}

	/**
	 * Validate a tool call against registered tool
	 */
	validateCall(call: ToolCall): { valid: boolean; errors: string[] } {
		const errors: string[] = [];
		const entry = this.tools.get(call.name);

		if (!entry) {
			errors.push(`Tool not found: ${call.name}`);
			return { valid: false, errors };
		}

		if (!entry.enabled) {
			errors.push(`Tool is disabled: ${call.name}`);
		}

		if (entry.metadata.deprecated) {
			errors.push(`Tool is deprecated: ${call.name} - ${entry.metadata.deprecated}`);
		}

		// Validate required parameters
		const required = entry.definition.parameters?.required || [];
		for (const param of required) {
			if (call.parameters[param] === undefined) {
				errors.push(`Missing required parameter: ${param}`);
			}
		}

		return { valid: errors.length === 0, errors };
	}
}

/**
 * Create a tool registry
 */
export function createToolRegistry(config?: ToolRegistryConfig): ToolRegistry {
	return new ToolRegistry(config);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a tool is a write operation
 */
export function isWriteTool(toolName: string): boolean {
	const writePatterns = [
		/create|add|new|insert|write|update|edit|modify|delete|remove|clear|reset/i
	];

	return writePatterns.some(pattern => pattern.test(toolName));
}

/**
 * Create a tool definition
 */
export function defineTool(
	name: string,
	description: string,
	parameters: ToolDefinition['parameters'],
	execute: ToolDefinition['execute'],
	metadata?: ToolMetadata
): { tool: ToolDefinition; metadata?: ToolMetadata } {
	return {
		tool: {
			name,
			description,
			parameters,
			execute
		},
		metadata
	};
}
