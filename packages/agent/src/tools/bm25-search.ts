/**
 * BM25 Search - Natural language tool discovery for hidden tools
 *
 * ## Purpose
 * Enables AI agents to discover hidden tools without knowing their
 * exact names. Uses BM25 ranking algorithm to match natural language
 * queries against tool names and descriptions.
 *
 * ## BM25 Algorithm Overview
 *
 * BM25 (Best Matching 25) is a probabilistic ranking function used
 * for information retrieval. It ranks documents based on query terms
 * appearing in each document, with adjustments for:
 *
 * - Term frequency (TF): More occurrences = higher rank
 * - Inverse document frequency (IDF): Rare terms weighted higher
 * - Document length normalization: Short matches rank higher
 *
 * The formula uses two tuning parameters:
 *
 * - k1 (default 1.2): Controls term frequency saturation
 *   Higher values allow higher TF to continue increasing score
 *   Lower values saturate faster
 *
 * - b (default 0.75): Controls document length normalization
 *   b=0 disables normalization, b=1 fully normalizes
 *   b=0.75 is a common effective default
 *
 * ## How Hidden Tool Discovery Works
 *
 * 1. Registry registers tools as hidden (not sent to AI by default)
 * 2. BM25SearchTool is available as a core/search tool
 * 3. AI calls BM25 search with natural language query
 * 4. BM25 ranks hidden tools by relevance
 * 5. Matching tools are "promoted" with TTL to become visible
 * 6. AI can then use the promoted tools
 * 7. TTL decrements each iteration; when expired, tool hides again
 *
 * ## Discovery Flow
 *
 *   AI: "I need to analyze a CSV file"
 *         |
 *         v
 *   Calls BM25SearchTool with query: "analyze CSV file"
 *         |
 *         v
 *   BM25Engine ranks hidden tools by query relevance
 *         |
 *         v
 *   Returns top matches: ["analyze_csv", "parse_file", "export_data"]
 *         |
 *         v
 *   Registry.promoteTools(["analyze_csv"], ttl=10)
 *         |
 *         v
 *   "analyze_csv" is now visible for 10 iterations
 *
 * ## Token Optimization via BM25
 *
 * Without BM25 search, all tool schemas must be in the AI context.
 * With hidden tools + BM25:
 *
 * - Only core tools (essential, frequent) are always visible
 * - Hidden tools are discovered only when needed
 * - AI context contains only: core tools + BM25SearchTool
 * - Discovery query is small ("analyze CSV")
 * - Response is small (just matching tool names/descriptions)
 *
 * This dramatically reduces context size for large tool sets.
 *
 * ## BM25Engine vs Registry's Built-in BM25
 *
 * The ToolRegistry class has its own internal BM25 implementation
 * for the searchBM25() and searchRegex() methods. This module
 * provides:
 *
 * 1. BM25Engine: Standalone BM25 ranking class (used by BM25SearchTool)
 * 2. BM25SearchTool: Tool wrapper for AI to call search
 * 3. RegexSearchTool: Alternative pattern-based discovery
 *
 * Both search tools have their own TTL management.
 *
 * ## Caching Strategy
 *
 * BM25 index is cached based on registry version:
 *
 * - getOrBuildEngine() checks if cacheVersion matches registry version
 * - If match: return cached engine (fast path)
 * - If mismatch: rebuild index from current hidden tools
 * - Snapshot ensures consistent view during ranking
 *
 * This avoids rebuilding on every search.
 *
 * ## Top-K Extraction (Min-Heap)
 *
 * Finding top-k from many candidates uses a fixed-size min-heap:
 *
 * - Build heap of first k candidates
 * - For remaining candidates, if better than heap minimum:
 *   - Replace minimum with current
 *   - Sift down to maintain heap property
 * - Complexity: O(candidates * log k)
 * - Much faster than sorting all candidates for small k
 *
 * ## Example Usage
 *
 *   const registry = new ToolRegistry();
 *   registry.registerHidden(csvAnalyzer, 5);
 *   registry.registerHidden(jsonParser, 5);
 *
 *   const searchTool = new BM25SearchTool(registry, {
 *     ttl: 5,
 *     maxSearchResults: 10
 *   });
 *
 *   // AI calls search tool
 *   const results = await searchTool.execute({ query: 'parse CSV data' });
 *
 *   // Results contain matching hidden tools
 *   // AI can now promote and use them
 *
 * @module tools/bm25-search
 */

import { ToolRegistry, type ToolSearchResult } from './registry.js';
import { safeRegex, RegexError } from '../utils/regex.js';
import { BM25 } from '../constants.js';

// ============================================================================
// Types
// ============================================================================

export interface BM25Config {
	k1?: number; // term frequency saturation (default 1.2)
	b?: number; // document length normalization (default 0.75)
}

interface BM25Doc {
	id: string;
	text: string;
}

interface BM25Index {
	documents: BM25Doc[];
	docLengths: number[];
	avgDocLength: number;
	termDocFreq: Map<string, number>;
	postingLists: Map<string, number[]>;
}

// ============================================================================
// BM25 Engine
// ============================================================================

/**
 * BM25 ranking engine for text search
 */
export class BM25Engine {
	private k1: number;
	private b: number;

	constructor(config: BM25Config = {}) {
		this.k1 = config.k1 ?? 1.2;
		this.b = config.b ?? 0.75;
	}

	/**
	 * Build BM25 index from documents
	 */
	buildIndex(documents: BM25Doc[]): BM25Index {
		const docLengths: number[] = [];
		const termDocFreq = new Map<string, number>();
		const postingLists = new Map<string, number[]>();

		let totalLength = 0;

		for (let i = 0; i < documents.length; i++) {
			const doc = documents[i];
			if (!doc) continue;

			const tokens = this.tokenize(doc.text);
			docLengths.push(tokens.length);
			totalLength += tokens.length;

			// Count term frequency per document
			const tf = new Map<string, number>();
			for (const token of tokens) {
				tf.set(token, (tf.get(token) || 0) + 1);
			}

			// Build posting lists and document frequency
			for (const term of tf.keys()) {
				// Document frequency
				termDocFreq.set(term, (termDocFreq.get(term) || 0) + 1);

				// Posting list
				if (!postingLists.has(term)) {
					postingLists.set(term, []);
				}
				postingLists.get(term)!.push(i);
			}
		}

		const avgDocLength = documents.length > 0 ? totalLength / documents.length : 0;

		return {
			documents,
			docLengths,
			avgDocLength,
			termDocFreq,
			postingLists
		};
	}

	/**
	 * Search index and return ranked results
	 */
	search(index: BM25Index, query: string, limit = 10): Array<{ doc: BM25Doc; score: number }> {
		if (index.documents.length === 0 || limit <= 0) {
			return [];
		}

		const queryTerms = this.tokenize(query);
		if (queryTerms.length === 0) {
			return [];
		}

		const N = index.documents.length;
		const scores = new Map<number, number>();

		// Calculate IDF for each term
		const idf = new Map<string, number>();
		for (const term of queryTerms) {
			const df = index.termDocFreq.get(term) || 0;
			idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
		}

		// Deduplicate query terms
		const uniqueTerms = [...new Set(queryTerms)];

		// Score each document via posting lists
		for (const term of uniqueTerms) {
			const termIDF = idf.get(term);
			if (termIDF === undefined) {
				continue;
			}

			const postings = index.postingLists.get(term);
			if (!postings) {
				continue;
			}

			for (const docIdx of postings) {
				const docLength = index.docLengths[docIdx];
				if (docLength === undefined) continue;

				const docLenNorm = this.k1 * (1 - this.b + (this.b * docLength) / index.avgDocLength);

				// Calculate term frequency
				const tokens = this.tokenize(index.documents[docIdx]?.text || '');
				const tf = tokens.filter((t) => t === term).length;
				const tfNorm = (tf * (this.k1 + 1)) / (tf + docLenNorm);

				const score = termIDF * tfNorm;
				scores.set(docIdx, (scores.get(docIdx) || 0) + score);
			}
		}

		if (scores.size === 0) {
			return [];
		}

		// Sort by score and take top k using fixed-size min-heap
		const heap: Array<{ docIdx: number; score: number }> = [];

		for (const [docIdx, score] of scores.entries()) {
			if (heap.length < limit) {
				heap.push({ docIdx, score });
				if (heap.length === limit) {
					this.minHeapify(heap);
				}
			} else if (heap.length > 0 && heap[0] && score > heap[0].score) {
				heap[0] = { docIdx, score };
				this.siftDown(heap, 0);
			}
		}

		// Sort by score descending
		heap.sort((a, b) => b.score - a.score);

		return heap
			.map(({ docIdx, score }) => {
				const doc = index.documents[docIdx];
				if (!doc) return null;
				return { doc, score };
			})
			.filter((r): r is { doc: BM25Doc; score: number } => r !== null);
	}

	/**
	 * Tokenize text: lowercase, split on whitespace, trim punctuation
	 */
	private tokenize(text: string): string[] {
		return text
			.toLowerCase()
			.split(/\s+/)
			.map((t) => t.replace(/^[,.:;!?()"'\/\\-_]+|[,.:;!?()"'\/\\-_]+$/g, ''))
			.filter((t) => t.length > 0);
	}

	/**
	 * Build min-heap in-place using Floyd's algorithm: O(k)
	 */
	private minHeapify(h: Array<{ docIdx: number; score: number }>): void {
		for (let i = Math.floor(h.length / 2) - 1; i >= 0; i--) {
			this.siftDown(h, i);
		}
	}

	/**
	 * Restore min-heap property starting at node i: O(log k)
	 */
	private siftDown(h: Array<{ docIdx: number; score: number }>, i: number): void {
		const n = h.length;
		while (true) {
			let smallest = i;
			const l = 2 * i + 1;
			const r = 2 * i + 2;

			const hSmallest = h[smallest];
			if (!hSmallest) break;

			const hL = h[l];
			const hR = h[r];

			if (l < n && hL && hL.score < hSmallest.score) {
				smallest = l;
			}
			if (r < n && hR && hR.score < hSmallest.score) {
				smallest = r;
			}
			if (smallest === i) {
				break;
			}
			const hi = h[i];
			if (hi && h[smallest]) {
				const hNewSmallest = h[smallest]!;
				[h[i], h[smallest]] = [hNewSmallest, hi];
			}
			i = smallest;
		}
	}
}

// ============================================================================
// BM25 Search Tool
// ============================================================================

/**
 * Tool for searching hidden tools using BM25 ranking
 */
export class BM25SearchTool {
	private registry: ToolRegistry;
	private ttl: number;
	private maxSearchResults: number;
	private engine: BM25Engine;

	// Cache for BM25 engine
	private cachedEngine: BM25Engine | null = null;
	private cacheVersion = 0;

	constructor(
		registry: ToolRegistry,
		config: { ttl?: number; maxSearchResults?: number; bm25Config?: BM25Config } = {}
	) {
		this.registry = registry;
		this.ttl = config.ttl ?? BM25.DEFAULT_TTL;
		this.maxSearchResults = config.maxSearchResults ?? BM25.DEFAULT_MAX_SEARCH_RESULTS;
		this.engine = new BM25Engine(config.bm25Config);
	}

	/**
	 * Get tool name
	 */
	get name(): string {
		return 'tool_search_tool_bm25';
	}

	/**
	 * Get tool description
	 */
	get description(): string {
		return 'Search available hidden tools on-demand using natural language query describing the action you need to perform. Returns JSON schemas of discovered tools.';
	}

	/**
	 * Get tool parameters schema
	 */
	get parameters(): { type: 'object'; properties: Record<string, unknown>; required: string[] } {
		return {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'Natural language search query'
				}
			},
			required: ['query']
		};
	}

	/**
	 * Execute BM25 search
	 */
	async execute(args: Record<string, unknown>): Promise<string> {
		const query = args.query as string;

		if (!query || typeof query !== 'string' || query.trim() === '') {
			return JSON.stringify({
				success: false,
				error: "Missing or invalid 'query' argument. Must be a non-empty string."
			});
		}

		const results = this.search(query, this.maxSearchResults);

		if (results.length === 0) {
			return JSON.stringify({
				success: true,
				message: 'No tools found matching the query.',
				tools: []
			});
		}

		// Format and return results
		const formatted = results.map((r) => ({
			name: r.name,
			description: r.description
		}));

		return JSON.stringify({
			success: true,
			message: `Found ${results.length} tools:`,
			tools: formatted
		});
	}

	/**
	 * Search for tools using BM25 ranking
	 */
	search(query: string, maxResults?: number): ToolSearchResult[] {
		const limit = maxResults ?? this.maxSearchResults;
		if (limit <= 0) {
			return [];
		}

		const cached = this.getOrBuildEngine();
		if (!cached) {
			return [];
		}

		const snapshot = this.registry.snapshotHiddenTools();
		if (snapshot.docs.length === 0) {
			return [];
		}

		const docs = snapshot.docs.map((d) => ({
			id: d.name,
			text: `${d.name} ${d.description}`
		}));

		const index = this.engine.buildIndex(docs);
		const ranked = this.engine.search(index, query, limit);

		return ranked.map((r) => ({
			name: r.doc.id,
			description: r.doc.text.split(' ').slice(1).join(' '), // Remove name from description
			score: r.score
		}));
	}

	/**
	 * Decrement TTL for the search tool itself
	 * Called each agent iteration
	 */
	tickTTL(): number {
		this.ttl--;
		return this.ttl;
	}

	/**
	 * Check if search tool is still active
	 */
	isActive(): boolean {
		return this.ttl > 0;
	}

	/**
	 * Get or build cached BM25 engine
	 * Rebuilds when registry version changes
	 */
	private getOrBuildEngine(): BM25Engine | null {
		const currentVersion = this.registry.versionNumber();

		// Fast path: cache is valid
		if (this.cachedEngine !== null && this.cacheVersion === currentVersion) {
			return this.cachedEngine;
		}

		const snapshot = this.registry.snapshotHiddenTools();
		if (snapshot.docs.length === 0) {
			this.cachedEngine = null;
			this.cacheVersion = snapshot.version;
			return null;
		}

		// Re-check after potential race
		if (this.cachedEngine !== null && this.cacheVersion === snapshot.version) {
			return this.cachedEngine;
		}

		const docs = snapshot.docs.map((d) => ({
			id: d.name,
			text: `${d.name} ${d.description}`
		}));

		// Build new engine
		const newEngine = new BM25Engine();
		newEngine.buildIndex(docs);

		this.cachedEngine = newEngine;
		this.cacheVersion = snapshot.version;

		return this.cachedEngine;
	}
}

// ============================================================================
// Regex Search Tool
// ============================================================================

/**
 * Tool for searching hidden tools using regex patterns
 */
export class RegexSearchTool {
	private registry: ToolRegistry;
	private ttl: number;
	private maxSearchResults: number;

	constructor(registry: ToolRegistry, config: { ttl?: number; maxSearchResults?: number } = {}) {
		this.registry = registry;
		this.ttl = config.ttl ?? BM25.DEFAULT_TTL;
		this.maxSearchResults = config.maxSearchResults ?? BM25.DEFAULT_MAX_SEARCH_RESULTS;
	}

	/**
	 * Get tool name
	 */
	get name(): string {
		return 'tool_search_tool_regex';
	}

	/**
	 * Get tool description
	 */
	get description(): string {
		return 'Search available hidden tools on-demand using a regex pattern. Returns JSON schemas of discovered tools.';
	}

	/**
	 * Get tool parameters schema
	 */
	get parameters(): { type: 'object'; properties: Record<string, unknown>; required: string[] } {
		return {
			type: 'object',
			properties: {
				pattern: {
					type: 'string',
					description: 'Regex pattern to match tool name or description'
				}
			},
			required: ['pattern']
		};
	}

	/**
	 * Execute regex search
	 */
	async execute(args: Record<string, unknown>): Promise<string> {
		const pattern = args.pattern as string;

		if (!pattern || typeof pattern !== 'string' || pattern.trim() === '') {
			return JSON.stringify({
				success: false,
				error: "Missing or invalid 'pattern' argument. Must be a non-empty string."
			});
		}

		if (pattern.length > BM25.MAX_PATTERN_LENGTH) {
			return JSON.stringify({
				success: false,
				error: `Pattern too long: max ${BM25.MAX_PATTERN_LENGTH} characters allowed`
			});
		}

		const regexResult = safeRegex(pattern, BM25.MAX_PATTERN_LENGTH, 'gi');
		if (!regexResult.success) {
			return JSON.stringify({
				success: false,
				error: regexResult.error.message
			});
		}

		const results = this.registry.searchRegex(pattern, this.maxSearchResults);

		if (results.length === 0) {
			return JSON.stringify({
				success: true,
				message: 'No tools found matching the pattern.',
				tools: []
			});
		}

		// Format and return results
		const formatted = results.map((r) => ({
			name: r.name,
			description: r.description
		}));

		return JSON.stringify({
			success: true,
			message: `Found ${results.length} tools:`,
			tools: formatted
		});
	}

	/**
	 * Decrement TTL for the search tool itself
	 */
	tickTTL(): number {
		this.ttl--;
		return this.ttl;
	}

	/**
	 * Check if search tool is still active
	 */
	isActive(): boolean {
		return this.ttl > 0;
	}
}
