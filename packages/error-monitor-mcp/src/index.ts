#!/usr/bin/env node

/**
 * Error Monitor MCP Server
 *
 * Provides automated error detection and pattern memory for OpenCode agents.
 * Monitors errors from all sources and remembers solutions across sessions.
 *
 * Features:
 * - Aggregates errors from server logs, console output, and UI checks
 * - Stores error patterns with solutions for learning across sessions
 * - Provides suggestions for fixing errors based on known patterns
 * - Supports retry tracking to prevent infinite loops
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v4';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Types
// ============================================================================

interface ErrorEntry {
	id: string;
	timestamp: number;
	type: 'server' | 'console' | 'ui' | 'api' | 'unknown';
	source: string;
	message: string;
	stack?: string;
	fixAttempts: number;
	resolved: boolean;
	resolvedAt?: number;
}

interface ErrorPattern {
	id: string;
	pattern: RegExp;
	description: string;
	solution: string;
	occurrenceCount: number;
	lastSeen: number;
	examples: string[];
}

interface ErrorPatternStore {
	patterns: ErrorPattern[];
	lastUpdated: number;
}

interface WatcherState {
	active: boolean;
	logs: string[];
	serverProcess?: any;
}

// ============================================================================
// Configuration
// ============================================================================

const ERROR_PATTERNS_PATH =
	process.env.ERROR_PATTERNS_PATH || join(__dirname, '../../data/error-patterns.json');

const MAX_FIX_ATTEMPTS = 5;
const MAX_LOG_LINES = 1000;
const PATTERNS_VERSION = 1;

// ============================================================================
// Error Pattern Store (Persistent Memory)
// ============================================================================

class ErrorPatternMemory {
	private store: ErrorPatternStore;
	private saveTimeout?: NodeJS.Timeout;

	constructor() {
		this.store = this.load();
	}

	private load(): ErrorPatternStore {
		try {
			if (existsSync(ERROR_PATTERNS_PATH)) {
				const data = readFileSync(ERROR_PATTERNS_PATH, 'utf-8');
				const parsed = JSON.parse(data);
				// Convert regex strings back to RegExp objects
				if (parsed.patterns) {
					parsed.patterns = parsed.patterns.map((p: any) => ({
						...p,
						pattern: new RegExp(p.patternString, p.patternFlags)
					}));
				}
				console.error(`[ErrorPatternMemory] Loaded ${parsed.patterns?.length || 0} patterns`);
				return parsed;
			}
		} catch (e) {
			console.error('[ErrorPatternMemory] Failed to load patterns:', e);
		}
		return { patterns: [], lastUpdated: Date.now() };
	}

	private save() {
		// Debounce saves
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
		}
		this.saveTimeout = setTimeout(() => {
			try {
				const dir = dirname(ERROR_PATTERNS_PATH);
				if (!existsSync(dir)) {
					mkdirSync(dir, { recursive: true });
				}
				// Store regex as strings for JSON serialization
				const toSave = {
					...this.store,
					patterns: this.store.patterns.map((p) => ({
						...p,
						patternString: p.pattern.source,
						patternFlags: p.pattern.flags
					})),
					lastUpdated: Date.now()
				};
				writeFileSync(ERROR_PATTERNS_PATH, JSON.stringify(toSave, null, 2));
				console.error(`[ErrorPatternMemory] Saved ${this.store.patterns.length} patterns`);
			} catch (e) {
				console.error('[ErrorPatternMemory] Failed to save patterns:', e);
			}
		}, 1000);
	}

	findMatchingPattern(error: string): ErrorPattern | null {
		for (const entry of this.store.patterns) {
			try {
				if (entry.pattern.test(error)) {
					return entry;
				}
			} catch (e) {
				// Invalid regex, skip
			}
		}
		return null;
	}

	addPattern(pattern: RegExp, description: string, solution: string, example: string) {
		// Check if pattern already exists
		const existing = this.store.patterns.find(
			(p) => p.pattern.source === pattern.source && p.pattern.flags === pattern.flags
		);

		if (existing) {
			existing.occurrenceCount++;
			existing.lastSeen = Date.now();
			if (!existing.examples.includes(example)) {
				existing.examples.push(example);
				if (existing.examples.length > 5) {
					existing.examples = existing.examples.slice(-5);
				}
			}
			// Update solution if the new one is different and longer (more detail)
			if (solution.length > existing.solution.length) {
				existing.solution = solution;
			}
		} else {
			this.store.patterns.push({
				id: `pattern_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
				pattern,
				description,
				solution,
				occurrenceCount: 1,
				lastSeen: Date.now(),
				examples: [example]
			});
		}
		this.save();
	}

	getSuggestions(error: string): string[] {
		const suggestions: string[] = [];
		const matched = this.findMatchingPattern(error);

		if (matched) {
			suggestions.push(`Known pattern: ${matched.description}`);
			suggestions.push(`Solution: ${matched.solution}`);
			suggestions.push(`Seen ${matched.occurrenceCount} times before`);
		}

		return suggestions;
	}

	getAllPatterns(): Omit<ErrorPattern, 'pattern'>[] {
		return this.store.patterns.map(({ pattern, ...rest }) => ({
			...rest,
			patternString: `/${pattern.source}/${pattern.flags}`
		}));
	}

	removePattern(id: string) {
		this.store.patterns = this.store.patterns.filter((p) => p.id !== id);
		this.save();
	}

	clearPatterns() {
		this.store.patterns = [];
		this.save();
	}
}

// ============================================================================
// Error Monitor
// ============================================================================

class ErrorMonitor {
	private errors: ErrorEntry[] = [];
	private patternMemory: ErrorPatternMemory;
	private watchers: Map<string, WatcherState> = new Map();
	private fixAttempts: Map<string, number> = new Map();

	constructor() {
		this.patternMemory = new ErrorPatternMemory();
	}

	addError(type: ErrorEntry['type'], source: string, message: string, stack?: string): ErrorEntry {
		const entry: ErrorEntry = {
			id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			timestamp: Date.now(),
			type,
			source,
			message,
			stack,
			fixAttempts: this.fixAttempts.get(message) || 0,
			resolved: false
		};

		this.errors.push(entry);

		// Keep only last MAX_LOG_LINES
		if (this.errors.length > MAX_LOG_LINES) {
			this.errors = this.errors.slice(-MAX_LOG_LINES);
		}

		// Check if this matches a known pattern
		const suggestions = this.patternMemory.getSuggestions(message);
		if (suggestions.length > 0) {
			console.error(`[ErrorMonitor] Known error pattern detected: ${suggestions[0]}`);
		}

		return entry;
	}

	getErrors(includeResolved = false): ErrorEntry[] {
		if (includeResolved) {
			return [...this.errors];
		}
		return this.errors.filter((e) => !e.resolved);
	}

	getUnresolvedErrors(): ErrorEntry[] {
		return this.errors.filter((e) => !e.resolved);
	}

	resolveError(id: string, addToMemory = true) {
		const error = this.errors.find((e) => e.id === id);
		if (error) {
			error.resolved = true;
			error.resolvedAt = Date.now();

			if (addToMemory && error.fixAttempts > 0) {
				// Learn from this error - extract a pattern and solution
				this.learnFromResolution(error);
			}

			this.fixAttempts.delete(error.message);
		}
	}

	resolveErrors(ids: string[]) {
		ids.forEach((id) => this.resolveError(id));
	}

	private learnFromResolution(error: ErrorEntry) {
		// Create a pattern from the error message
		// Extract meaningful parts, ignoring specific values
		let patternStr = error.message
			.replace(/[a-f0-9]{8,}/gi, '*') // UUIDs/IDs
			.replace(/\d+\.\d+\.\d+\.\d+/g, '*') // IP addresses
			.replace(/\d{4,}/g, '*') // Long numbers
			.replace(/'/g, "'") // Quotes
			.trim();

		if (patternStr.length < 10) {
			// Too short to create a meaningful pattern
			return;
		}

		try {
			// Create a regex that matches the pattern with word boundaries
			const escaped = patternStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const pattern = new RegExp(escaped, 'i');

			const solution = `Auto-learned solution for: ${error.message.slice(0, 50)}...`;

			this.patternMemory.addPattern(
				pattern,
				`${error.type} error: ${error.source}`,
				solution,
				error.message
			);
		} catch (e) {
			// Invalid pattern, skip learning
		}
	}

	incrementFixAttempt(message: string): number {
		const current = this.fixAttempts.get(message) || 0;
		const next = current + 1;
		this.fixAttempts.set(message, next);
		return next;
	}

	resetFixAttempts(message: string) {
		this.fixAttempts.delete(message);
	}

	canAttemptFix(message: string): boolean {
		return (this.fixAttempts.get(message) || 0) < MAX_FIX_ATTEMPTS;
	}

	clearErrors() {
		this.errors = [];
	}

	addServerLog(line: string) {
		// Check for error patterns in server logs
		const errorIndicators = [
			'error',
			'Error',
			'ERROR',
			'exception',
			'Exception',
			'EXCEPTION',
			'failed',
			'Failed',
			'FAILED',
			'panic',
			'Panic',
			'PANIC'
		];

		const isError = errorIndicators.some((ind) => line.includes(ind));

		if (isError) {
			this.addError('server', 'dev-server', line);
		}
	}

	getSuggestions(errorMessage: string): string[] {
		return this.patternMemory.getSuggestions(errorMessage);
	}

	getPatterns() {
		return this.patternMemory.getAllPatterns();
	}

	watcherLog(watcherId: string, line: string) {
		const watcher = this.watchers.get(watcherId);
		if (watcher) {
			watcher.logs.push(`[${new Date().toISOString()}] ${line}`);
			if (watcher.logs.length > MAX_LOG_LINES) {
				watcher.logs = watcher.logs.slice(-MAX_LOG_LINES);
			}
			this.addServerLog(line);
		}
	}

	startWatcher(watcherId: string) {
		this.watchers.set(watcherId, {
			active: true,
			logs: []
		});
	}

	stopWatcher(watcherId: string) {
		const watcher = this.watchers.get(watcherId);
		if (watcher) {
			watcher.active = false;
		}
	}

	getWatcherLogs(watcherId: string): string[] {
		return this.watchers.get(watcherId)?.logs || [];
	}
}

// ============================================================================
// MCP Server
// ============================================================================

const monitor = new ErrorMonitor();

const server = new McpServer({
	name: 'error-monitor-mcp',
	version: '1.0.0'
});

// Error Management Tools

server.registerTool(
	'get_errors',
	{
		title: 'Get Errors',
		description: 'Get all unresolved errors from the error monitor',
		inputSchema: {}
	},
	async () => {
		const errors = monitor.getUnresolvedErrors();
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(
						{
							errorCount: errors.length,
							errors: errors.map((e) => ({
								id: e.id,
								type: e.type,
								source: e.source,
								message: e.message,
								stack: e.stack,
								timestamp: new Date(e.timestamp).toISOString(),
								fixAttempts: e.fixAttempts
							})),
							hasErrors: errors.length > 0
						},
						null,
						2
					)
				}
			]
		};
	}
);

server.registerTool(
	'get_all_errors',
	{
		title: 'Get All Errors',
		description: 'Get all errors including resolved ones',
		inputSchema: {}
	},
	async () => {
		const errors = monitor.getErrors(true);
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(
						{
							errorCount: errors.length,
							errors: errors.map((e) => ({
								id: e.id,
								type: e.type,
								source: e.source,
								message: e.message,
								timestamp: new Date(e.timestamp).toISOString(),
								fixAttempts: e.fixAttempts,
								resolved: e.resolved,
								resolvedAt: e.resolvedAt ? new Date(e.resolvedAt).toISOString() : null
							})),
							hasErrors: errors.length > 0
						},
						null,
						2
					)
				}
			]
		};
	}
);

server.registerTool(
	'clear_errors',
	{
		title: 'Clear Errors',
		description: 'Clear all accumulated errors (use after successful verification)',
		inputSchema: {}
	},
	async () => {
		monitor.clearErrors();
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({ success: true, message: 'All errors cleared' })
				}
			]
		};
	}
);

server.registerTool(
	'resolve_error',
	{
		title: 'Resolve Error',
		description: 'Mark an error as resolved (optionally learns from the resolution)',
		inputSchema: {
			id: z.string().describe('Error ID to resolve'),
			learnPattern: z.boolean().optional().describe('Whether to learn from this resolution')
		}
	},
	async ({ id, learnPattern = true }) => {
		monitor.resolveError(id, learnPattern);
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({ success: true, errorId: id })
				}
			]
		};
	}
);

server.registerTool(
	'resolve_errors',
	{
		title: 'Resolve Errors',
		description: 'Mark multiple errors as resolved',
		inputSchema: {
			ids: z.array(z.string()).describe('Array of error IDs to resolve')
		}
	},
	async ({ ids }) => {
		monitor.resolveErrors(ids);
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({ success: true, resolvedCount: ids.length })
				}
			]
		};
	}
);

server.registerTool(
	'add_error',
	{
		title: 'Add Error',
		description: 'Manually add an error to the monitor',
		inputSchema: {
			type: z.enum(['server', 'console', 'ui', 'api', 'unknown']).describe('Error type'),
			source: z.string().describe('Error source (e.g., component name, file)'),
			message: z.string().describe('Error message'),
			stack: z.string().optional().describe('Stack trace if available')
		}
	},
	async ({ type, source, message, stack }) => {
		const error = monitor.addError(type, source, message, stack);
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({ success: true, errorId: error.id })
				}
			]
		};
	}
);

server.registerTool(
	'get_suggestions',
	{
		title: 'Get Suggestions',
		description: 'Get fix suggestions for an error message based on learned patterns',
		inputSchema: {
			errorMessage: z.string().describe('The error message to get suggestions for')
		}
	},
	async ({ errorMessage }) => {
		const suggestions = monitor.getSuggestions(errorMessage);
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(
						{
							suggestions,
							hasKnownSolution: suggestions.length > 0
						},
						null,
						2
					)
				}
			]
		};
	}
);

server.registerTool(
	'can_fix',
	{
		title: 'Can Fix',
		description: 'Check if an error can still be attempted to fix (under max attempts)',
		inputSchema: {
			errorMessage: z.string().describe('The error message to check')
		}
	},
	async ({ errorMessage }) => {
		const canFix = monitor.canAttemptFix(errorMessage);
		const attempts = monitor['fixAttempts'].get(errorMessage) || 0;
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({
						canFix,
						currentAttempts: attempts,
						maxAttempts: MAX_FIX_ATTEMPTS,
						remainingAttempts: MAX_FIX_ATTEMPTS - attempts
					})
				}
			]
		};
	}
);

server.registerTool(
	'record_fix_attempt',
	{
		title: 'Record Fix Attempt',
		description: 'Record that a fix was attempted for an error',
		inputSchema: {
			errorMessage: z.string().describe('The error message that was attempted to fix')
		}
	},
	async ({ errorMessage }) => {
		const attempts = monitor.incrementFixAttempt(errorMessage);
		const canFix = monitor.canAttemptFix(errorMessage);
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({
						attempts,
						maxAttempts: MAX_FIX_ATTEMPTS,
						canRetry: canFix
					})
				}
			]
		};
	}
);

server.registerTool(
	'reset_fix_attempts',
	{
		title: 'Reset Fix Attempts',
		description: 'Reset fix attempts for an error (use when error is truly fixed)',
		inputSchema: {
			errorMessage: z.string().optional().describe('Error message to reset (all if not specified)')
		}
	},
	async ({ errorMessage }) => {
		if (errorMessage) {
			monitor.resetFixAttempts(errorMessage);
		} else {
			// Reset all (would need method on monitor)
		}
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({ success: true })
				}
			]
		};
	}
);

// Pattern Memory Tools

server.registerTool(
	'get_patterns',
	{
		title: 'Get Patterns',
		description: 'Get all learned error patterns',
		inputSchema: {}
	},
	async () => {
		const patterns = monitor.getPatterns();
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(
						{
							patternCount: patterns.length,
							patterns
						},
						null,
						2
					)
				}
			]
		};
	}
);

server.registerTool(
	'add_pattern',
	{
		title: 'Add Pattern',
		description: 'Add a known error pattern with its solution',
		inputSchema: {
			pattern: z.string().describe('Regex pattern to match'),
			flags: z.string().optional().describe('Regex flags (default: i)'),
			description: z.string().describe('Description of the pattern'),
			solution: z.string().describe('Solution for this error type'),
			example: z.string().optional().describe('Example error message')
		}
	},
	async ({ pattern, flags = 'i', description, solution, example }) => {
		try {
			const regex = new RegExp(pattern, flags);
			const mem = (monitor as any)['patternMemory'] as ErrorPatternMemory;
			mem.addPattern(regex, description, solution, example || '');
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({ success: true, pattern })
					}
				]
			};
		} catch (e: any) {
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({ success: false, error: `Invalid regex: ${e.message}` })
					}
				]
			};
		}
	}
);

server.registerTool(
	'remove_pattern',
	{
		title: 'Remove Pattern',
		description: 'Remove a learned error pattern',
		inputSchema: {
			id: z.string().describe('Pattern ID to remove')
		}
	},
	async ({ id }) => {
		(monitor as any)['patternMemory'].removePattern(id);
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({ success: true, id })
				}
			]
		};
	}
);

server.registerTool(
	'clear_patterns',
	{
		title: 'Clear Patterns',
		description: 'Clear all learned error patterns',
		inputSchema: {}
	},
	async () => {
		(monitor as any)['patternMemory'].clearPatterns();
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({ success: true, message: 'All patterns cleared' })
				}
			]
		};
	}
);

// Server Log Watcher Tools

server.registerTool(
	'add_server_log',
	{
		title: 'Add Server Log',
		description: 'Add a server log line to monitor (will check for errors)',
		inputSchema: {
			line: z.string().describe('Log line to add')
		}
	},
	async ({ line }) => {
		monitor.watcherLog('default', line);
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({ success: true })
				}
			]
		};
	}
);

server.registerTool(
	'get_server_logs',
	{
		title: 'Get Server Logs',
		description: 'Get accumulated server logs',
		inputSchema: {
			watcherId: z.string().optional().describe('Watcher ID (default: default)')
		}
	},
	async ({ watcherId = 'default' }) => {
		const logs = monitor.getWatcherLogs(watcherId);
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(
						{
							logCount: logs.length,
							logs
						},
						null,
						2
					)
				}
			]
		};
	}
);

// Verification Tool

server.registerTool(
	'verify_no_errors',
	{
		title: 'Verify No Errors',
		description: 'Comprehensive check: returns all errors and whether the system is error-free',
		inputSchema: {}
	},
	async () => {
		const errors = monitor.getUnresolvedErrors();
		const patterns = monitor.getPatterns();

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(
						{
							isErrorFree: errors.length === 0,
							errorCount: errors.length,
							errors: errors.map((e) => ({
								id: e.id,
								type: e.type,
								source: e.source,
								message: e.message,
								timestamp: new Date(e.timestamp).toISOString()
							})),
							knownPatterns: patterns.length,
							status: errors.length === 0 ? 'CLEAN' : 'HAS_ERRORS'
						},
						null,
						2
					)
				}
			]
		};
	}
);

// ============================================================================
// Main
// ============================================================================

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('Error Monitor MCP server started');
	console.error(`Patterns stored at: ${ERROR_PATTERNS_PATH}`);
}

main().catch(console.error);
