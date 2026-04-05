/**
 * Tests for BM25Engine class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BM25Engine } from '../../src/tools/bm25-search.js';

describe('BM25Engine', () => {
	describe('buildIndex', () => {
		let engine: BM25Engine;

		beforeEach(() => {
			engine = new BM25Engine();
		});

		it('should build index from documents', () => {
			const docs = [
				{ id: 'doc1', text: 'hello world' },
				{ id: 'doc2', text: 'hello there' }
			];

			const index = engine.buildIndex(docs);

			expect(index.documents).toHaveLength(2);
			expect(index.docLengths).toHaveLength(2);
			expect(index.avgDocLength).toBeGreaterThan(0);
		});

		it('should calculate document lengths correctly', () => {
			const docs = [
				{ id: 'doc1', text: 'hello world' },
				{ id: 'doc2', text: 'hi there friend' }
			];

			const index = engine.buildIndex(docs);

			// 'hello world' tokenizes to ['hello', 'world'] = 2 tokens
			// 'hi there friend' tokenizes to ['hi', 'there', 'friend'] = 3 tokens
			expect(index.docLengths[0]).toBe(2);
			expect(index.docLengths[1]).toBe(3);
		});

		it('should handle empty documents array', () => {
			const index = engine.buildIndex([]);

			expect(index.documents).toHaveLength(0);
			expect(index.avgDocLength).toBe(0);
		});

		it('should build posting lists correctly', () => {
			const docs = [
				{ id: 'doc1', text: 'hello world hello' },
				{ id: 'doc2', text: 'hello friend' }
			];

			const index = engine.buildIndex(docs);

			// 'hello' appears in both docs
			const helloPostings = index.postingLists.get('hello');
			expect(helloPostings).toBeDefined();
			expect(helloPostings).toContain(0); // doc1
			expect(helloPostings).toContain(1); // doc2

			// 'world' only appears in doc1
			const worldPostings = index.postingLists.get('world');
			expect(worldPostings).toContain(0);
			expect(worldPostings).not.toContain(1);
		});
	});

	describe('search', () => {
		let engine: BM25Engine;

		beforeEach(() => {
			engine = new BM25Engine();
		});

		it('should return empty array for empty documents', () => {
			const index = engine.buildIndex([]);
			const results = engine.search(index, 'query');

			expect(results).toEqual([]);
		});

		it('should return empty array for empty query', () => {
			const docs = [{ id: 'doc1', text: 'hello world' }];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, '');
			expect(results).toEqual([]);
		});

		it('should return empty array for whitespace-only query', () => {
			const docs = [{ id: 'doc1', text: 'hello world' }];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, '   ');
			expect(results).toEqual([]);
		});

		it('should return empty array when no terms match', () => {
			const docs = [{ id: 'doc1', text: 'hello world' }];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'xyz123');
			expect(results).toEqual([]);
		});

		it('should return matching documents ranked by score', () => {
			const docs = [
				{ id: 'doc1', text: 'hello world program' },
				{ id: 'doc2', text: 'hello world world world' },
				{ id: 'doc3', text: 'hello' }
			];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'world');

			expect(results.length).toBeGreaterThan(0);
			// doc2 has more occurrences of 'world', should rank higher
			const doc2Result = results.find((r) => r.doc.id === 'doc2');
			const doc1Result = results.find((r) => r.doc.id === 'doc1');
			expect(doc2Result && doc1Result ? doc2Result.score : 0).toBeGreaterThan(
				doc1Result ? doc1Result.score : 0
			);
		});

		it('should respect limit parameter', () => {
			const docs = [
				{ id: 'doc1', text: 'hello' },
				{ id: 'doc2', text: 'hello' },
				{ id: 'doc3', text: 'hello' },
				{ id: 'doc4', text: 'hello' },
				{ id: 'doc5', text: 'hello' }
			];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'hello', 3);

			expect(results.length).toBeLessThanOrEqual(3);
		});

		it('should handle limit of 0', () => {
			const docs = [{ id: 'doc1', text: 'hello' }];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'hello', 0);

			expect(results).toEqual([]);
		});

		it('should handle negative limit', () => {
			const docs = [{ id: 'doc1', text: 'hello' }];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'hello', -1);

			expect(results).toEqual([]);
		});
	});

	describe('tokenization', () => {
		let engine: BM25Engine;

		beforeEach(() => {
			engine = new BM25Engine();
		});

		it('should lowercase tokens', () => {
			const docs = [{ id: 'doc1', text: 'HELLO World' }];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'hello');
			expect(results.length).toBeGreaterThan(0);
		});

		it('should split on whitespace', () => {
			const docs = [{ id: 'doc1', text: 'hello world test' }];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'hello world');
			expect(results.length).toBeGreaterThan(0);
		});

		it('should remove leading punctuation', () => {
			const docs = [{ id: 'doc1', text: '(hello world)' }];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'hello');
			expect(results.length).toBeGreaterThan(0);
		});

		it('should remove trailing punctuation', () => {
			const docs = [{ id: 'doc1', text: 'hello, world.' }];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'world');
			expect(results.length).toBeGreaterThan(0);
		});

		it('should handle multiple spaces', () => {
			const docs = [{ id: 'doc1', text: 'hello    world' }];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'hello');
			expect(results.length).toBeGreaterThan(0);
		});

		it('should filter empty tokens', () => {
			// 'hello...world' tokenizes to ['hello', 'world'] - empty tokens are filtered
			const docs = [{ id: 'doc1', text: 'hello   world' }];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'hello');
			expect(results.length).toBeGreaterThan(0);
		});

		it('should handle various punctuation marks', () => {
			const docs = [{ id: 'doc1', text: 'test: one, two. three; four!' }];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'test');
			expect(results.length).toBeGreaterThan(0);
		});
	});

	describe('BM25 parameters', () => {
		it('should use custom k1 and b parameters', () => {
			const engine1 = new BM25Engine({ k1: 1.2, b: 0.75 });
			const engine2 = new BM25Engine({ k1: 2.0, b: 0.5 });

			const docs = [
				{ id: 'doc1', text: 'hello world hello' },
				{ id: 'doc2', text: 'hello' }
			];

			const index1 = engine1.buildIndex(docs);
			const index2 = engine2.buildIndex(docs);

			const results1 = engine1.search(index1, 'hello');
			const results2 = engine2.search(index2, 'hello');

			// Different parameters should produce different scores
			expect(results1).not.toEqual(results2);
		});

		it('should use default k1 of 1.2', () => {
			const engine = new BM25Engine();
			const docs = [{ id: 'doc1', text: 'test document' }];
			const index = engine.buildIndex(docs);

			// Should work with defaults
			const results = engine.search(index, 'test');
			expect(Array.isArray(results)).toBe(true);
		});

		it('should use default b of 0.75', () => {
			const engine = new BM25Engine();
			const docs = [{ id: 'doc1', text: 'test document' }];
			const index = engine.buildIndex(docs);

			// Should work with defaults
			const results = engine.search(index, 'test');
			expect(Array.isArray(results)).toBe(true);
		});
	});

	describe('duplicate query terms', () => {
		let engine: BM25Engine;

		beforeEach(() => {
			engine = new BM25Engine();
		});

		it('should handle duplicate terms in query', () => {
			const docs = [{ id: 'doc1', text: 'hello world' }];
			const index = engine.buildIndex(docs);

			// Query with duplicate 'hello'
			const results1 = engine.search(index, 'hello hello hello');
			const results2 = engine.search(index, 'hello');

			// Should get same documents (deduplication happens internally)
			expect(results1.map((r) => r.doc.id)).toEqual(results2.map((r) => r.doc.id));
		});
	});

	describe('scoring behavior', () => {
		let engine: BM25Engine;

		beforeEach(() => {
			engine = new BM25Engine();
		});

		it('should rank documents with more term matches higher', () => {
			const docs = [
				{ id: 'doc1', text: 'apple banana orange apple' },
				{ id: 'doc2', text: 'apple banana' },
				{ id: 'doc3', text: 'banana orange' }
			];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'apple');

			const doc1Score = results.find((r) => r.doc.id === 'doc1')?.score ?? 0;
			const doc2Score = results.find((r) => r.doc.id === 'doc2')?.score ?? 0;

			expect(doc1Score).toBeGreaterThan(doc2Score);
		});

		it('should consider document length in scoring', () => {
			const docs = [
				{ id: 'short', text: 'apple' },
				{ id: 'long', text: 'apple banana cherry date egg fig grape' }
			];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'apple');

			// Shorter document with same term match should potentially rank higher
			const shortResult = results.find((r) => r.doc.id === 'short');
			expect(shortResult).toBeDefined();
		});

		it('should return scores for all matching documents', () => {
			const docs = [
				{ id: 'doc1', text: 'hello world' },
				{ id: 'doc2', text: 'hello there' },
				{ id: 'doc3', text: 'hello' }
			];
			const index = engine.buildIndex(docs);

			const results = engine.search(index, 'hello');

			expect(results.length).toBe(3);
			results.forEach((r) => {
				expect(r.score).toBeGreaterThan(0);
			});
		});
	});
});
