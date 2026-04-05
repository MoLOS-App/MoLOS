/**
 * BM25 Index - Unified BM25 ranking implementation
 *
 * ## Purpose
 * Provides a high-performance BM25 (Best Matching 25) ranking engine
 * for text search and information retrieval. This is a unified implementation
 * combining optimal patterns from multiple sources.
 *
 * ## BM25 Algorithm Overview
 *
 * BM25 is a probabilistic ranking function used for information retrieval.
 * It ranks documents based on query terms appearing in each document:
 *
 * - Term frequency (TF): More occurrences = higher rank
 * - Inverse document frequency (IDF): Rare terms weighted higher
 * - Document length normalization: Short matches rank higher
 *
 * Tuning parameters:
 * - k1 (default 1.2): Controls term frequency saturation
 * - b (default 0.75): Controls document length normalization
 *
 * ## Performance Optimizations
 *
 * 1. Pre-computed Index Structures:
 *    - termFreqs: Per-document term frequencies (avoids recalculation)
 *    - docLenNorm: Pre-computed document length normalization factors
 *    - idf: Pre-computed IDF values for all terms in vocabulary
 *
 * 2. Top-K Extraction via Min-Heap:
 *    - O(candidates * log k) complexity
 *    - Fixed memory footprint regardless of corpus size
 *
 * ## Usage
 *
 * ```typescript
 * import { BM25Index, createBM25Engine } from './bm25/index.js';
 *
 * // Create engine with optional config
 * const engine = createBM25Engine({ k1: 1.2, b: 0.75 });
 *
 * // Add documents incrementally
 * engine.add([
 *   { id: 'doc1', text: 'Hello world' },
 *   { id: 'doc2', text: 'World of text' }
 * ]);
 *
 * // Search
 * const results = engine.search('hello world', 10);
 *
 * // Or build index from all documents at once
 * const engine2 = createBM25Engine();
 * engine2.buildIndex([
 *   { id: 'doc1', text: 'Hello world' },
 *   { id: 'doc2', text: 'World of text' }
 * ]);
 * const results2 = engine2.search('hello', 5);
 * ```
 *
 * @module tools/bm25
 */

// ============================================================================
// Types
// ============================================================================

export interface BM25Doc {
	id: string;
	text: string;
}

export interface BM25Result {
	doc: BM25Doc;
	score: number;
}

export interface BM25Config {
	k1?: number;
	b?: number;
}

// Internal types
interface BM25ScoredDoc {
	docIdx: number;
	score: number;
}

// ============================================================================
// Constants
// ============================================================================

import { BM25 } from '../../constants.js';

// Re-export BM25 constants for backward compatibility
export const DEFAULT_K1 = BM25.DEFAULT_K1;
export const DEFAULT_B = BM25.DEFAULT_B;

// ============================================================================
// BM25 Index
// ============================================================================

/**
 * High-performance BM25 ranking engine
 *
 * Pre-computes index structures for efficient repeated searches:
 * - Per-document term frequencies
 * - Document length normalization factors
 * - Inverse document frequency (IDF) for vocabulary
 */
export class BM25Index {
	private documents: BM25Doc[] = [];
	private k1: number;
	private b: number;

	// Pre-computed index structures
	private docLengths: number[] = [];
	private termDocFreq = new Map<string, number>();
	private postingLists = new Map<string, number[]>();
	private termFreqs: Map<string, number>[] = [];
	private avgDocLength = 0;
	private idf = new Map<string, number>();
	private docLenNorm: number[] = [];
	private indexBuilt = false;

	constructor(config: BM25Config = {}) {
		this.k1 = config.k1 ?? DEFAULT_K1;
		this.b = config.b ?? DEFAULT_B;
	}

	/**
	 * Get current documents
	 */
	getDocuments(): BM25Doc[] {
		return this.documents;
	}

	/**
	 * Get index statistics
	 */
	getStats(): { documentCount: number; vocabularySize: number; avgDocLength: number } {
		return {
			documentCount: this.documents.length,
			vocabularySize: this.termDocFreq.size,
			avgDocLength: this.avgDocLength
		};
	}

	/**
	 * Add documents to the index (incremental build)
	 */
	add(documents: BM25Doc[]): void {
		if (documents.length === 0) return;

		const startIdx = this.documents.length;
		const N = this.documents.length + documents.length;
		let totalLength = this.avgDocLength * this.documents.length;

		// Process new documents
		for (let i = 0; i < documents.length; i++) {
			const doc = documents[i];
			if (!doc) continue;

			const docIdx = startIdx + i;
			const tokens = this.tokenize(doc.text);
			this.docLengths[docIdx] = tokens.length;
			totalLength += tokens.length;

			// Count term frequency per document
			const tf = new Map<string, number>();
			for (const token of tokens) {
				tf.set(token, (tf.get(token) || 0) + 1);
			}
			this.termFreqs[docIdx] = tf;

			// Build posting lists and document frequency
			for (const term of tf.keys()) {
				this.termDocFreq.set(term, (this.termDocFreq.get(term) || 0) + 1);

				if (!this.postingLists.has(term)) {
					this.postingLists.set(term, []);
				}
				this.postingLists.get(term)!.push(docIdx);
			}

			this.documents.push(doc);
		}

		this.avgDocLength = totalLength / N;

		// Recalculate IDF for all terms (simpler than incremental update)
		this.rebuildIDF(N);

		// Recalculate document length normalization
		this.docLenNorm = [];
		for (let i = 0; i < N; i++) {
			const docLen = this.docLengths[i] ?? 0;
			this.docLenNorm[i] = this.k1 * (1 - this.b + (this.b * docLen) / this.avgDocLength);
		}

		this.indexBuilt = true;
	}

	/**
	 * Build index from documents (replaces existing index)
	 */
	buildIndex(documents: BM25Doc[]): void {
		// Reset all structures
		this.documents = [];
		this.docLengths = [];
		this.termDocFreq.clear();
		this.postingLists.clear();
		this.termFreqs = [];
		this.avgDocLength = 0;
		this.idf.clear();
		this.docLenNorm = [];
		this.indexBuilt = false;

		if (documents.length === 0) {
			this.indexBuilt = true;
			return;
		}

		const N = documents.length;
		let totalLength = 0;

		// Process all documents
		for (let i = 0; i < N; i++) {
			const doc = documents[i];
			if (!doc) continue;

			const tokens = this.tokenize(doc.text);
			this.docLengths[i] = tokens.length;
			totalLength += tokens.length;

			// Count term frequency per document
			const tf = new Map<string, number>();
			for (const token of tokens) {
				tf.set(token, (tf.get(token) || 0) + 1);
			}
			this.termFreqs[i] = tf;

			// Build posting lists and document frequency
			for (const term of tf.keys()) {
				this.termDocFreq.set(term, (this.termDocFreq.get(term) || 0) + 1);

				if (!this.postingLists.has(term)) {
					this.postingLists.set(term, []);
				}
				this.postingLists.get(term)!.push(i);
			}

			this.documents.push(doc);
		}

		this.avgDocLength = totalLength / N;

		// Calculate IDF for all terms (Robertson-Spärck Jones formula)
		this.rebuildIDF(N);

		// Calculate document length normalization
		for (let i = 0; i < N; i++) {
			const docLen = this.docLengths[i] ?? 0;
			this.docLenNorm[i] = this.k1 * (1 - this.b + (this.b * docLen) / this.avgDocLength);
		}

		this.indexBuilt = true;
	}

	/**
	 * Rebuild IDF values for all terms
	 */
	private rebuildIDF(N: number): void {
		this.idf.clear();
		for (const [term, df] of this.termDocFreq) {
			this.idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
		}
	}

	/**
	 * Search index and return top-k ranked results using min-heap
	 * Complexity: O(candidates * log k) for top-k extraction
	 */
	search(query: string, limit = 10): BM25Result[] {
		if (!this.indexBuilt || limit <= 0 || this.documents.length === 0) {
			return [];
		}

		const queryTerms = this.tokenize(query);
		if (queryTerms.length === 0) {
			return [];
		}

		// Deduplicate query terms to avoid double-weighting
		const uniqueTerms = this.dedupe(queryTerms);

		// Score documents via posting lists
		const scores = new Map<number, number>();

		for (const term of uniqueTerms) {
			const termIDF = this.idf.get(term);
			if (termIDF === undefined) {
				continue; // term not in vocabulary
			}

			const postings = this.postingLists.get(term);
			if (!postings) {
				continue;
			}

			for (const docIdx of postings) {
				const tf = this.termFreqs[docIdx]?.get(term) || 0;
				// TF_norm = freq * (k1+1) / (freq + docLenNorm)
				const dln = this.docLenNorm[docIdx] ?? 1;
				const tfNorm = (tf * (this.k1 + 1)) / (tf + dln);
				const score = termIDF * tfNorm;
				scores.set(docIdx, (scores.get(docIdx) || 0) + score);
			}
		}

		if (scores.size === 0) {
			return [];
		}

		// Top-k via fixed-size min-heap: O(candidates * log k)
		const heap: BM25ScoredDoc[] = [];

		for (const [docIdx, score] of scores) {
			if (heap.length < limit) {
				heap.push({ docIdx, score });
				if (heap.length === limit) {
					this.minHeapify(heap);
				}
			} else {
				const minScore = heap[0]?.score ?? 0;
				if (score > minScore) {
					// Replace smallest with larger score
					heap[0] = { docIdx, score };
					this.siftDown(heap, 0);
				}
			}
		}

		// Sort heap by score descending for output
		heap.sort((a, b) => b.score - a.score);

		return heap
			.map((h) => {
				const doc = this.documents[h.docIdx];
				if (!doc) {
					return null;
				}
				return { doc, score: h.score };
			})
			.filter((r): r is BM25Result => r !== null);
	}

	/**
	 * Build min-heap in-place using Floyd's algorithm: O(k)
	 */
	private minHeapify(heap: BM25ScoredDoc[]): void {
		for (let i = Math.floor(heap.length / 2) - 1; i >= 0; i--) {
			this.siftDown(heap, i);
		}
	}

	/**
	 * Restore min-heap property starting at node i: O(log k)
	 */
	private siftDown(heap: BM25ScoredDoc[], i: number): void {
		const n = heap.length;
		while (true) {
			let smallest = i;
			const l = 2 * i + 1;
			const r = 2 * i + 2;

			const heapL = heap[l];
			const heapR = heap[r];
			const heapSmallest = heap[smallest];

			if (l < n && heapL && heapSmallest && heapL.score < heapSmallest.score) {
				smallest = l;
			}
			if (r < n && heapR && heapSmallest && heapR.score < heapSmallest.score) {
				smallest = r;
			}
			if (smallest === i) {
				break;
			}
			const current = heap[i];
			const smallestItem = heap[smallest];
			if (current && smallestItem) {
				heap[i] = smallestItem;
				heap[smallest] = current;
			}
			i = smallest;
		}
	}

	/**
	 * Tokenize text: lowercase, split on whitespace, trim edge punctuation
	 */
	private tokenize(text: string): string[] {
		return text
			.toLowerCase()
			.split(/\s+/)
			.map((t) => t.replace(/^[,.:;!?()"'\/\\-_]+|[,.:;!?()"'\/\\-_]+$/g, ''))
			.filter((t) => t.length > 0);
	}

	/**
	 * Deduplicate tokens, preserving first-occurrence order
	 */
	private dedupe(tokens: string[]): string[] {
		const seen = new Set<string>();
		const out: string[] = [];
		for (const t of tokens) {
			if (!seen.has(t)) {
				seen.add(t);
				out.push(t);
			}
		}
		return out;
	}
}

/**
 * Factory function to create a BM25Index with optional configuration
 */
export function createBM25Engine(config: BM25Config = {}): BM25Index {
	return new BM25Index(config);
}
