/**
 * Tools Module - Tool registry, discovery, and execution
 *
 * ## Module Overview
 *
 * This module provides the complete tool infrastructure for the agent:
 *
 * 1. Tool Registry (registry.ts)
 *    - Central registry for all tools
 *    - Core vs hidden tool distinction
 *    - TTL-based visibility management
 *    - BM25 and regex search for hidden tools
 *    - Parallel execution with concurrency limits
 *
 * 2. Tool Wrapper (tool-wrapper.ts)
 *    - Execution wrappers with caching
 *    - Hook system for pre/post execution
 *    - Event emission for monitoring
 *    - LRU cache with TTL support
 *
 * 3. Schema Converter (schema-converter.ts)
 *    - JSON Schema to Zod conversion
 *    - Tool argument validation
 *    - AI-friendly error messages
 *
 * 4. BM25 Search (bm25-search.ts)
 *    - Natural language tool discovery
 *    - BM25 ranking algorithm
 *    - Min-heap top-k extraction
 *    - Regex pattern matching
 *
 * ## Tool Lifecycle
 *
 *   Register -> Discover -> Execute -> Cache/Return
 *                  |
 *            [Hidden tools]
 *            BM25/regex search
 *            TTL management
 *
 * ## Architecture Diagram
 *
 *   +------------------+
 *   |   AI / LLM      |
 *   +--------+---------+
 *            |
 *            v
 *   +--------+---------+
 *   | Tool Definitions|  (visible tools only)
 *   +--------+---------+
 *            |
 *            v
 *   +--------+---------+
 *   |  Tool Registry  | <-- Core Tools (always visible)
 *   +--------+---------+ <-- Hidden Tools (via BM25 discovery)
 *            |
 *            v
 *   +--------+---------+
 *   |  Tool Executor  |  (parallel, limited concurrency)
 *   +--------+---------+
 *            |
 *            v
 *   +--------+---------+
 *   | Result Formatter|  (string output for AI)
 *   +--------+---------+
 *
 * ## Usage Pattern
 *
 *   import {
 *     ToolRegistry,
 *     BM25SearchTool,
 *     wrapToolDefinition,
 *     validateToolArgs
 *   } from './tools/index.js';
 *
 *   // Create registry and register tools
 *   const registry = new ToolRegistry();
 *   registry.register(coreTool);
 *   registry.registerHidden(specializedTool, 5);
 *
 *   // Get tool definitions for AI
 *   const definitions = registry.getDefinitions();
 *
 *   // Execute tool when AI requests it
 *   const result = await registry.execute(toolName, args);
 *
 * ## AI Context Optimization Features
 *
 * - Hidden tools reduce initial context size
 * - BM25 search enables dynamic discovery
 * - TTL auto-expires unneeded tools
 * - Caching avoids redundant executions
 * - Schema validation prevents bad tool calls
 *
 * @module tools
 */

export {
	ToolRegistry,
	type Tool,
	type ToolEntry,
	type ToolRegistryConfig,
	type ToolContext,
	type ToolSearchResult,
	type HiddenToolSnapshot,
	type HiddenToolDoc
} from './registry.js';

export { BM25Engine, BM25SearchTool, RegexSearchTool, type BM25Config } from './bm25-search.js';
export {
	BM25Index,
	createBM25Engine,
	DEFAULT_K1,
	DEFAULT_B,
	type BM25Doc,
	type BM25Result
} from './bm25/index.js';

export {
	ToolResultCache,
	wrapToolDefinition,
	convertTools,
	wrapToolWithHooks,
	buildCacheKey,
	type ToolWrapperOptions
} from './tool-wrapper.js';

export {
	convertSchemaToZod,
	createZodSchemaFromParams,
	inferZodType,
	validateToolArgs,
	type ParamSchema
} from './schema-converter.js';
