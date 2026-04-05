/**
 * Tool Registry - Central tool registration and discovery
 *
 * ## Purpose
 * Maintains a registry of available tools with metadata for discovery,
 * selection, and execution by the agent loop. This is the central hub
 * for all tool management in the agent system.
 *
 * ## Tool Architecture
 * The registry manages three distinct concepts:
 *
 * 1. ToolDefinition: Static metadata (name, description, schema)
 *    - Used by LLM providers to understand available tools
 *    - Serialized for AI context (can be large for complex schemas)
 *
 * 2. Tool: Runtime execution interface with execute() method
 *    - Contains the actual implementation logic
 *    - Wrapped with hooks, caching, and event emission
 *
 * 3. ToolEntry: Registry metadata for a tool
 *    - isCore: If true, tool is always visible to the AI
 *    - ttl: Time-to-live for hidden tools (iterations remaining)
 *
 * ## Discovery Pattern (Core vs Hidden Tools)
 *
 * Core Tools:
 * - Registered via register() with isCore: true
 * - Always visible in tool definitions sent to AI
 * - No TTL management needed
 * - Use for: Essential, frequently-needed tools
 *
 * Hidden Tools:
 * - Registered via registerHidden() with isCore: false
 * - NOT sent to AI by default (reduces prompt size)
 * - Require discovery via search (BM25 or regex)
 * - Have TTL that decrements each iteration
 * - When TTL expires, tool becomes invisible again
 * - Use for: Specialized, context-dependent tools
 *
 * ## Tool Lifecycle
 *
 *   Register -> [Visible/Hidden] -> Discover (if hidden) -> Execute -> Result
 *                                            |
 *                                     TTL decrements
 *                                            |
 *                                     TTL expires -> Unavailable
 *
 * ## AI Context Optimization
 *
 * This registry supports context optimization in several ways:
 *
 * 1. Selective Visibility: Only core tools appear in initial context
 *    - Hidden tools discovered only when AI explicitly searches
 *    - Dramatically reduces prompt size for large tool sets
 *
 * 2. BM25 Search: Full-text search over hidden tool metadata
 *    - AI can discover tools without knowing their exact names
 *    - Ranking considers term frequency and document length
 *    - Cached index rebuilds only when registry changes
 *
 * 3. TTL-based Cleanup: Hidden tools auto-expire
 *    - Prevents permanently cluttering AI context
 *    - Each agent iteration can reset TTL via promoteTools()
 *
 * 4. Version-based Cache Invalidation: BM25 index caches efficiently
 *    - Only rebuilds when version increments (on register/unregister)
 *    - Fast path returns cached engine instantly
 *
 * ## BM25 Implementation
 *
 * The registry includes a complete BM25 ranking engine:
 * - k1 (default 1.2): Term frequency saturation parameter
 * - b (default 0.75): Document length normalization parameter
 * - Uses Robertson-Spärck Jones IDF formula
 * - Min-heap for efficient top-k extraction: O(candidates * log k)
 *
 * ## Example Usage
 *
 *   const registry = new ToolRegistry();
 *
 *   // Core tool - always visible
 *   registry.register({
 *     name: 'get_weather',
 *     description: 'Get current weather for a location',
 *     parameters: { type: 'object', properties: { city: { type: 'string' } } },
 *     execute: async (args) => { return 'weather result'; }
 *   });
 *
 *   // Hidden tool - requires discovery
 *   registry.registerHidden({
 *     name: 'analyze_spreadsheet',
 *     description: 'Analyze data in a spreadsheet file',
 *     parameters: { type: 'object', properties: { file: { type: 'string' } } },
 *     execute: async (args) => { return 'analysis result'; }
 *   }, 5); // TTL of 5 iterations
 *
 *   // AI can discover hidden tool via search
 *   const results = registry.searchBM25('spreadsheet data analysis');
 *   registry.promoteTools(results.map(r => r.name), 10);
 *
 * @module tools/registry
 */

import type { ToolDefinition, ToolResult, ToolCall } from '../types/index.js';
import { validateToolArgs } from './schema-converter.js';
import { safeRegex } from '../utils/regex.js';
import { BM25Index, DEFAULT_K1, DEFAULT_B } from './bm25/index.js';
import { TOOL } from '../constants.js';
import { globalLaneManager } from '../concurrency/index.js';
import {
	type ToolPolicy,
	type ToolExecutionContext,
	type PolicyResult,
	ToolPolicyPipeline,
	globalPolicyRegistry
} from './policy.js';
import { ToolDefinitionSchema } from '../config/schemas.js';
import { formatZodError } from '../config/validation.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Core tool interface
 */
export interface Tool {
	name: string;
	description: string;
	parameters: ToolDefinition['parameters'];
	execute(args: Record<string, unknown>, context?: ToolContext): Promise<string>;
}

export interface ToolEntry {
	tool: Tool;
	isCore: boolean; // true = always visible, false = hidden (TTL-based)
	ttl: number; // Time-to-live for hidden tools (iterations remaining)
}

export interface ToolRegistryConfig {
	maxConcurrent?: number; // Max parallel tool executions
}

export interface ToolContext {
	sessionKey?: string;
	channel?: string;
	chatId?: string;
	userId?: string;
	toolCallId?: string;
	elevated?: boolean;
}

export interface ToolSearchResult {
	name: string;
	description: string;
	score: number;
	snippet?: string;
}

export interface HiddenToolSnapshot {
	docs: HiddenToolDoc[];
	version: number;
}

export interface HiddenToolDoc {
	name: string;
	description: string;
}

// ============================================================================
// Tool Registry
// ============================================================================

export class ToolRegistry {
	private tools: Map<string, ToolEntry> = new Map();
	private version = 0;
	private maxConcurrent: number;

	// BM25 caching: engine and cache version
	private cachedEngine: BM25Index | null = null;
	private cacheVersion = 0;
	private bm25K1: number;
	private bm25B: number;

	// Policy pipeline for tool execution control
	private policyPipeline: ToolPolicyPipeline;

	constructor(config?: ToolRegistryConfig) {
		this.maxConcurrent = config?.maxConcurrent ?? TOOL.MAX_CONCURRENT;
		this.bm25K1 = DEFAULT_K1;
		this.bm25B = DEFAULT_B;
		this.policyPipeline = new ToolPolicyPipeline();
	}

	/**
	 * Register a core tool (always visible)
	 */
	register(tool: Tool): void {
		const name = tool.name;

		// Validate tool definition
		const validationResult = ToolDefinitionSchema.safeParse({
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
			async: true
		});

		if (!validationResult.success) {
			console.warn(
				`[tools] Tool "${name}" has invalid definition: ${formatZodError(validationResult.error)}`
			);
		}

		if (this.tools.has(name)) {
			console.warn(`[tools] Tool registration overwrites existing tool: ${name}`);
		}
		this.tools.set(name, {
			tool,
			isCore: true,
			ttl: 0 // Core tools do not use TTL
		});
		this.version++;
		this.invalidateBM25Cache();
		console.debug(`[tools] Registered core tool: ${name}`);
	}

	/**
	 * Register a hidden tool (visible only via TTL-based discovery)
	 */
	registerHidden(tool: Tool, ttl = 0): void {
		const name = tool.name;

		// Validate tool definition
		const validationResult = ToolDefinitionSchema.safeParse({
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
			async: true
		});

		if (!validationResult.success) {
			console.warn(
				`[tools] Hidden tool "${name}" has invalid definition: ${formatZodError(validationResult.error)}`
			);
		}

		if (this.tools.has(name)) {
			console.warn(`[tools] Hidden tool registration overwrites existing tool: ${name}`);
		}
		this.tools.set(name, {
			tool,
			isCore: false,
			ttl
		});
		this.version++;
		this.invalidateBM25Cache();
		console.debug(`[tools] Registered hidden tool: ${name}`);
	}

	/**
	 * Register multiple tools at once
	 */
	registerMany(tools: Tool[]): void {
		for (const tool of tools) {
			this.register(tool);
		}
	}

	/**
	 * Unregister a tool by name
	 * @returns true if tool was removed, false if not found
	 */
	unregister(name: string): boolean {
		const existed = this.tools.delete(name);
		if (existed) {
			this.version++;
			this.invalidateBM25Cache();
			console.debug(`[tools] Unregistered tool: ${name}`);
		}
		return existed;
	}

	/**
	 * Get a tool by name (returns undefined if not found or TTL expired)
	 */
	get(name: string): Tool | undefined {
		const entry = this.tools.get(name);
		if (!entry) {
			return undefined;
		}
		// Hidden tools with expired TTL are not callable
		if (!entry.isCore && entry.ttl <= 0) {
			return undefined;
		}
		return entry.tool;
	}

	/**
	 * Check if a tool is registered
	 */
	has(name: string): boolean {
		return this.get(name) !== undefined;
	}

	/**
	 * Get all tools, optionally including hidden tools
	 * @param includeHidden If true, includes hidden tools regardless of TTL
	 */
	getTools(includeHidden: boolean): Tool[] {
		const names = this.sortedToolNames();
		const tools: Tool[] = [];

		for (const name of names) {
			const entry = this.tools.get(name)!;
			if (includeHidden || entry.isCore || entry.ttl > 0) {
				tools.push(entry.tool);
			}
		}

		return tools;
	}

	/**
	 * Get only visible tools (respects TTL for hidden tools)
	 */
	getVisibleTools(): Tool[] {
		return this.getTools(false);
	}

	/**
	 * Get all tool definitions (for LLM providers)
	 */
	getDefinitions(): ToolDefinition[] {
		const sorted = this.sortedToolNames();
		const definitions: ToolDefinition[] = [];

		for (const name of sorted) {
			const entry = this.tools.get(name)!;

			// Skip hidden tools with expired TTL
			if (!entry.isCore && entry.ttl <= 0) {
				continue;
			}

			definitions.push(toolToDefinition(entry.tool));
		}

		return definitions;
	}

	/**
	 * Promote hidden tools to be temporarily visible
	 * @param names Tool names to promote
	 * @param ttl TTL to set (iterations remaining)
	 */
	promoteTools(names: string[], ttl: number): void {
		let promoted = 0;
		for (const name of names) {
			const entry = this.tools.get(name);
			if (entry && !entry.isCore) {
				entry.ttl = ttl;
				promoted++;
			}
		}
		console.debug(`[tools] Promoted ${promoted}/${names.length} tools with TTL=${ttl}`);
	}

	/**
	 * Promote hidden tools AND decrement TTL atomically (single operation)
	 *
	 * This combines promotion and TTL tick in one operation, preventing races
	 * between promotion and other tickTTL calls. Follows Inspo's pattern where
	 * promotion and TTL adjustment happen together within a single lock acquisition.
	 *
	 * @param names Tool names to promote
	 * @param ttl TTL to set before decrement (effective TTL = ttl - 1 after this call)
	 * @returns Number of tools promoted
	 */
	promoteAndTick(names: string[], ttl: number): number {
		let promoted = 0;

		// First pass: promote specified tools
		for (const name of names) {
			const entry = this.tools.get(name);
			if (entry && !entry.isCore) {
				// Set TTL then immediately decrement (atomic within this loop)
				entry.ttl = ttl - 1;
				promoted++;
			}
		}

		// Second pass: tick all hidden tools (including newly promoted)
		for (const entry of this.tools.values()) {
			if (!entry.isCore && entry.ttl > 0) {
				entry.ttl--;
			}
		}

		return promoted;
	}

	/**
	 * Decrement TTL for all hidden tools
	 * @returns Number of tools that expired (TTL reached 0)
	 */
	tickTTL(): number {
		let expired = 0;
		for (const entry of this.tools.values()) {
			if (!entry.isCore && entry.ttl > 0) {
				entry.ttl--;
				if (entry.ttl === 0) {
					expired++;
				}
			}
		}
		return expired;
	}

	/**
	 * Get current registry version (increments on register/unregister)
	 */
	versionNumber(): number {
		return this.version;
	}

	/**
	 * Snapshot hidden tools for BM25 indexing
	 * Returns consistent snapshot of hidden tool docs and registry version
	 */
	snapshotHiddenTools(): HiddenToolSnapshot {
		const docs: HiddenToolDoc[] = [];
		for (const [name, entry] of this.tools.entries()) {
			if (!entry.isCore) {
				docs.push({
					name,
					description: entry.tool.description
				});
			}
		}
		return {
			docs,
			version: this.version
		};
	}

	/**
	 * Execute a single tool by name
	 */
	async execute(
		toolName: string,
		args: Record<string, unknown>,
		context?: ToolContext
	): Promise<ToolResult> {
		console.info(`[tool] Tool execution started`, { tool: toolName, args });

		const tool = this.get(toolName);
		if (!tool) {
			console.error(`[tool] Tool not found: ${toolName}`);
			return {
				toolName,
				arguments: args,
				success: false,
				error: `Tool "${toolName}" not found`,
				executionMs: 0
			};
		}

		// Policy check before execution
		const policyContext: ToolExecutionContext = {
			sessionKey: context?.sessionKey,
			userId: context?.userId,
			channel: context?.channel,
			chatId: context?.chatId,
			toolCallId: context?.toolCallId,
			elevated: context?.elevated
		};

		const policyResult = this.policyPipeline.canExecute(toolName, args, policyContext);
		if (!policyResult.allowed) {
			console.warn(`[tool] Tool execution denied by policy`, {
				tool: toolName,
				reason: policyResult.reason,
				code: policyResult.code
			});
			return {
				toolName,
				arguments: args,
				success: false,
				error: `Tool execution denied: ${policyResult.reason ?? 'Policy check failed'}`,
				executionMs: 0
			};
		}

		// Validate arguments
		const validationErrors = validateToolArgs(args, tool.parameters as any);
		if (validationErrors.length > 0) {
			console.warn(`[tool] Tool argument validation failed`, {
				tool: toolName,
				error: validationErrors
			});
			return {
				toolName,
				arguments: args,
				success: false,
				error: `Invalid arguments for tool "${toolName}": ${validationErrors.join(', ')}`,
				executionMs: 0
			};
		}

		const startTime = Date.now();

		// Execute tool within lane to prevent concurrent access to shared resources
		// Each tool name gets its own lane, ensuring serialized execution per tool
		const lane = globalLaneManager.getLane(toolName);

		let result: ToolResult;
		try {
			const output = (await lane.enqueue(async () => tool.execute(args, context))) as string;
			const executionMs = Date.now() - startTime;

			result = {
				toolName,
				arguments: args,
				success: true,
				output,
				executionMs
			};

			console.info(`[tool] Tool execution completed`, {
				tool: toolName,
				duration_ms: executionMs
			});
		} catch (err) {
			const executionMs = Date.now() - startTime;
			const errorMessage = err instanceof Error ? err.message : String(err);

			console.error(`[tool] Tool execution failed`, {
				tool: toolName,
				error: errorMessage
			});

			result = {
				toolName,
				arguments: args,
				success: false,
				error: errorMessage,
				executionMs
			};
		}

		return result;
	}

	/**
	 * Execute multiple tool calls in parallel
	 */
	async executeMany(toolCalls: ToolCall[], context?: ToolContext): Promise<ToolResult[]> {
		// Limit concurrent executions
		const results: ToolResult[] = [];
		const queue = [...toolCalls];
		const executing: Promise<void>[] = [];

		const executeTool = async (call: ToolCall): Promise<void> => {
			const result = await this.execute(call.tool.name, call.arguments, context);
			results.push(result);
		};

		while (queue.length > 0 || executing.length > 0) {
			while (executing.length < this.maxConcurrent && queue.length > 0) {
				const call = queue.shift()!;
				const promise = executeTool(call);
				executing.push(promise);
				promise.finally(() => {
					const idx = executing.indexOf(promise);
					if (idx > -1) executing.splice(idx, 1);
				});
			}

			if (executing.length > 0) {
				await Promise.race(executing.map((p) => p.then(() => true).catch(() => true)));
				// Remove completed promises
				for (let i = executing.length - 1; i >= 0; i--) {
					const promise = executing[i];
					if (!promise) continue;
					const settled = await Promise.race([
						promise.then(() => true).catch(() => true),
						Promise.resolve(true)
					]);
					if (settled === true) {
						executing.splice(i, 1);
					}
				}
			}
		}

		// Wait for all remaining
		await Promise.all(executing);

		return results;
	}

	/**
	 * Clone the registry for subagents (isolated copy)
	 * Creates independent copy with same tool entries
	 */
	clone(): ToolRegistry {
		const clone = new ToolRegistry({ maxConcurrent: this.maxConcurrent });
		for (const [name, entry] of this.tools.entries()) {
			clone.tools.set(name, {
				tool: entry.tool,
				isCore: entry.isCore,
				ttl: entry.ttl
			});
		}
		// Note: version is NOT copied (starts fresh in clone)
		return clone;
	}

	/**
	 * Search hidden tools using regex pattern
	 */
	searchRegex(pattern: string, maxResults = 10): ToolSearchResult[] {
		if (maxResults <= 0) {
			return [];
		}

		const regexResult = safeRegex(pattern, 200, 'gi');
		if (!regexResult.success) {
			return [];
		}
		const regex = regexResult.data;

		const results: ToolSearchResult[] = [];
		const sortedNames = this.sortedToolNames();

		for (const name of sortedNames) {
			const entry = this.tools.get(name)!;
			// Search only among hidden tools
			if (entry.isCore) {
				continue;
			}

			const desc = entry.tool.description;
			const nameMatch = regex.test(name);
			regex.lastIndex = 0; // Reset for next test
			const descMatch = regex.test(desc);
			regex.lastIndex = 0;

			if (nameMatch || descMatch) {
				results.push({
					name,
					description: desc,
					score: nameMatch ? 2 : 1, // Name matches are weighted higher
					snippet: nameMatch ? name : desc.substring(0, 100)
				});

				if (results.length >= maxResults) {
					break;
				}
			}
		}

		// Sort by score descending
		results.sort((a, b) => b.score - a.score);

		return results;
	}

	/**
	 * Invalidate BM25 cache when tools change
	 */
	private invalidateBM25Cache(): void {
		this.cachedEngine = null;
		this.cacheVersion = 0;
	}

	/**
	 * Get or build cached BM25 engine (only rebuilds when registry version changes)
	 */
	private getOrBuildBM25Engine(): BM25Index {
		const currentVersion = this.version;

		// Fast path: cache hit
		if (this.cachedEngine !== null && this.cacheVersion === currentVersion) {
			return this.cachedEngine;
		}

		// Slow path: rebuild index
		const snapshot = this.snapshotHiddenTools();
		const docs = snapshot.docs.map((d) => ({
			id: d.name,
			text: `${d.name} ${d.description}`
		}));

		this.cachedEngine = new BM25Index({ k1: this.bm25K1, b: this.bm25B });
		this.cachedEngine.buildIndex(docs);
		this.cacheVersion = currentVersion;

		return this.cachedEngine;
	}

	/**
	 * Search hidden tools using BM25 ranking
	 */
	searchBM25(query: string, maxResults = 10): ToolSearchResult[] {
		const engine = this.getOrBuildBM25Engine();
		const docs = engine.getDocuments();

		if (docs.length === 0) {
			return [];
		}

		const ranked = engine.search(query, maxResults);

		return ranked.map((r) => ({
			name: r.doc.id,
			description: r.doc.text.split(' ').slice(1).join(' '), // Remove name from description
			score: r.score
		}));
	}

	/**
	 * List all registered tool names (sorted)
	 */
	listNames(): string[] {
		return this.sortedToolNames();
	}

	/**
	 * Count of registered tools
	 */
	count(): number {
		return this.tools.size;
	}

	/**
	 * Get human-readable summaries of all visible tools
	 */
	getSummaries(): string[] {
		const summaries: string[] = [];
		const sortedNames = this.sortedToolNames();

		for (const name of sortedNames) {
			const entry = this.tools.get(name)!;
			if (!entry.isCore && entry.ttl <= 0) {
				continue;
			}
			summaries.push(`- \`${name}\` - ${entry.tool.description}`);
		}

		return summaries;
	}

	/**
	 * Get all tools (both core and hidden with active TTL)
	 * Used by SubTurn to inherit parent's tool set
	 */
	getAll(): Tool[] {
		return this.getTools(false);
	}

	// ============================================================================
	// Policy Management
	// ============================================================================

	/**
	 * Set the policy pipeline for this registry.
	 * If not set, uses the global policy registry.
	 */
	setPolicyPipeline(pipeline: ToolPolicyPipeline): void {
		this.policyPipeline = pipeline;
	}

	/**
	 * Get the current policy pipeline
	 */
	getPolicyPipeline(): ToolPolicyPipeline {
		return this.policyPipeline;
	}

	/**
	 * Add a policy to the end of the pipeline
	 */
	addPolicy(policy: ToolPolicy): void {
		this.policyPipeline.addPolicy(policy);
	}

	/**
	 * Prepend a policy to the beginning of the pipeline
	 */
	prependPolicy(policy: ToolPolicy): void {
		this.policyPipeline.prependPolicy(policy);
	}

	/**
	 * Clear all policies from the pipeline
	 */
	clearPolicies(): void {
		this.policyPipeline.clear();
	}

	/**
	 * Check if a tool would be allowed by current policies (without executing)
	 */
	checkPolicy(
		toolName: string,
		args: Record<string, unknown>,
		context?: ToolContext
	): PolicyResult {
		const policyContext: ToolExecutionContext = {
			sessionKey: context?.sessionKey,
			userId: context?.userId,
			channel: context?.channel,
			chatId: context?.chatId,
			toolCallId: context?.toolCallId,
			elevated: context?.elevated
		};
		return this.policyPipeline.canExecute(toolName, args, policyContext);
	}

	private sortedToolNames(): string[] {
		return Array.from(this.tools.keys()).sort();
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

function toolToDefinition(tool: Tool): ToolDefinition {
	return {
		name: tool.name,
		description: tool.description,
		parameters: tool.parameters
	};
}

// ============================================================================
// Re-export types from index
// ============================================================================

export type { ToolDefinition, ToolResult, ToolCall };

// Re-export policy types for convenience
export type { PolicyResult, ToolExecutionContext, ToolPolicy } from './policy.js';
export {
	ToolPolicyPipeline,
	DenyListPolicy,
	AllowListPolicy,
	RateLimitPolicy,
	SessionOwnerPolicy,
	ToolPolicyRegistry,
	globalPolicyRegistry,
	createDenyListPolicy,
	createAllowListPolicy,
	createRateLimitPolicy
} from './policy.js';
