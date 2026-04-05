/**
 * Context Building - Builds system prompts and message context
 *
 * ## Purpose
 * The ContextBuilder constructs the full system prompt and message context for LLM calls:
 * - **System prompt**: Identity, bootstrap files (AGENT.md, SOUL.md, USER.md, IDENTITY.md)
 * - **Skills**: Available skills from workspace, global, and builtin directories
 * - **Memory context**: Long-term memory and daily notes
 * - **Dynamic context**: Time, runtime info, session metadata (changes per-request)
 * - **Message history**: Sanitized conversation history
 *
 * ## Key Concepts
 *
 * ### Mtime-based Cache Invalidation
 * The system prompt is cached and only rebuilt when source files change:
 * - Cache stores mtime snapshot when prompt was built
 * - On access, compares current file mtimes vs cached mtimes
 * - If any file is newer than cache, prompt is rebuilt
 * - Uses **double-checked locking** pattern for thread safety
 *
 * ### Two-Pass History Sanitization
 * Before sending history to the LLM, sanitizes to ensure provider compatibility:
 *
 * **Pass 1 (Basic)**:
 * - Drop system messages from history (context builder adds its own)
 * - Drop orphaned tool results (no preceding assistant message)
 * - Skip duplicate tool results
 *
 * **Pass 2 (Tool call matching)**:
 * - For each assistant message with tool_calls, verify matching tool results exist
 * - If any tool_call ID is missing its result, drop the entire assistant message
 * - Ensures no "dangling" tool_call references that would confuse the LLM
 *
 * ### Skills Loading
 * Skills are loaded from three tiers (in priority order):
 * 1. **Workspace** (`{workspace}/skills/{name}/SKILL.md`)
 * 2. **Global** (`~/.molos/skills/{name}/SKILL.md`)
 * 3. **Builtin** (bundled with application)
 *
 * Each skill can have YAML frontmatter with metadata:
 * ```yaml
 * ---
 * name: Skill Name
 * description: What this skill does
 * metadata:
 *   emoji: 🔧
 *   os: [linux, darwin]
 *   requires:
 *     bins: [jq, curl]
 * ---
 * # Skill content...
 * ```
 *
 * ## Usage Pattern
 * ```typescript
 * const builder = new ContextBuilder({
 *   workspace: '/path/to/workspace',
 *   bootstrapFiles: { agent: 'AGENT.md', soul: 'SOUL.md' },
 *   skillsPath: '/path/to/skills',
 *   memoryPath: '/path/to/memory'
 * });
 *
 * // Build system prompt (cached, rebuilds only when files change)
 * const { prompt, cachedAt } = await builder.buildSystemPromptWithCache();
 *
 * // Build dynamic context (not cached, per-request)
 * const dynamicCtx = builder.buildDynamicContext({ sessionKey: 'abc123' });
 *
 * // Build full messages for LLM
 * const messages = builder.buildMessages(history, userInput, prompt, dynamicCtx);
 *
 * // Check if context would overflow before LLM call
 * const wouldOverflow = builder.checkContextOverflow(128000, messages, tools, 4096);
 * ```
 *
 * ## AI Context Optimization
 * - **System prompt caching**: Avoids re-reading and re-processing files on every call
 * - **History sanitization**: Prevents token waste on invalid/dangling messages
 * - **Skills summary**: Lists all skills without loading full content (budget-aware)
 * - **Compact format fallback**: When budget is tight, uses XML format instead of markdown
 * - **Proactive overflow check**: `checkContextOverflow()` prevents downstream errors
 */

import type { AgentMessage } from '../types/index.js';
import { CONTEXT } from '../constants.js';
import { isOverContextBudget, type tokenEstimator } from './token-estimator.js';
import { MemoryStore } from './memory-store.js';
import { pathExists, readFile, stat, readdir, getHomeDir, joinPath } from '../utils/fs-async.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Skill definition
 */
export interface Skill {
	name: string;
	description: string;
	content: string;
	location: string;
	source: 'workspace' | 'global' | 'builtin';
}

/**
 * Skill frontmatter parsed from SKILL.md YAML header
 */
export interface SkillFrontmatter {
	name?: string;
	description?: string;
	metadata?: {
		emoji?: string;
		os?: string[];
		requires?: {
			bins?: string[];
			env?: string[];
			config?: string[];
		};
		install?: Array<{
			id: string;
			kind: string;
			formula?: string;
			bins?: string[];
		}>;
	};
	homepage?: string;
	'user-invocable'?: boolean;
	'disable-model-invocation'?: boolean;
}

/**
 * Skill metadata (without full content)
 */
export interface SkillMeta {
	name: string;
	description: string;
	path: string;
	source: 'workspace' | 'global' | 'builtin';
	emoji?: string; // From frontmatter
	os?: string[]; // From frontmatter
	requires?: string[]; // Required binaries
}

/**
 * Skills loader interface
 */
export interface SkillsLoader {
	loadSkill(name: string): Promise<Skill | undefined>;
	listSkills(): SkillMeta[];
	searchSkills(query: string, limit?: number): Promise<SkillSearchResult[]>;
}

/**
 * Skill search result
 */
export interface SkillSearchResult {
	skill: Skill;
	score: number;
}

/**
 * Configuration for ContextBuilder
 */
export interface ContextBuilderConfig {
	workspace: string;
	agentId?: string;
	bootstrapFiles?: {
		agent?: string;
		soul?: string;
		user?: string;
		identity?: string;
	};
	skillsPath?: string;
	globalSkillsPath?: string;
	builtinSkillsPath?: string;
	memoryPath?: string;
	memory?: {
		memoryFile?: string;
		dailyNotesPath?: string;
	};
	runtimeInfo?: {
		os?: string;
		arch?: string;
		goVersion?: string;
	};
}

/**
 * Options for building dynamic context
 */
export interface DynamicContextOptions {
	/** @deprecated Use sessionKey instead */
	key?: string;
	sessionKey?: string;
	channel?: string;
	chatId?: string;
	senderId?: string;
	senderDisplayName?: string;
}

/**
 * Result of building full context
 */
export interface ContextResult {
	systemPrompt: string;
	dynamicContext: string;
	messages: AgentMessage[];
	cachedAt: number;
	filesChecked: string[];
}

/**
 * Result of building system prompt with cache
 */
export interface SystemPromptResult {
	prompt: string;
	cachedAt: number;
	filesChecked: string[];
}

/**
 * Cache baseline for invalidation tracking
 */
interface CacheBaseline {
	existed: Map<string, boolean>;
	skillFiles: Map<string, number>;
	maxMtime: number;
}

// =============================================================================
// RWMutex - Reader-Writer Mutex for thread-safe caching
// =============================================================================

/**
 * RWMutex - Reader-Writer Mutex for thread-safe caching
 *
 * ## Purpose
 * Provides synchronized access to the cache to prevent race conditions when:
 * - Multiple requests read the cache simultaneously (read lock)
 * - One request needs to rebuild the cache (write lock)
 *
 * ## Lock Hierarchy
 * - **Read locks**: Multiple readers can hold simultaneously
 * - **Write lock**: Exclusive access - blocks all readers and other writers
 *
 * ## Algorithm
 * ```
 * readLock():
 *   while writers > 0: await(yield)
 *   readers++
 *
 * readUnlock():
 *   readers--
 *
 * writeLock():
 *   writers++
 *   while readers > 0: await(yield to queue)
 *
 * writeUnlock():
 *   writers--
 *   if writeQueue not empty: wake(next writer)
 * ```
 *
 * ## AI Context Note
 * Uses simple spinlock with setTimeout(resolve, 1) for yielding.
 * This is efficient for TypeScript's single-threaded nature where
 * locks are held for very short durations.
 */
class RWMutex {
	private readers = 0;
	private writers = 0;
	private writeQueue: Array<() => void> = [];

	/**
	 * Acquire a read lock. Multiple readers can hold the lock simultaneously.
	 */
	async readLock(): Promise<void> {
		while (this.writers > 0) {
			await new Promise((resolve) => setTimeout(resolve, 1));
		}
		this.readers++;
	}

	/**
	 * Release a read lock.
	 */
	readUnlock(): void {
		this.readers--;
	}

	/**
	 * Acquire a write lock. Exclusive access - blocks all readers and other writers.
	 */
	async writeLock(): Promise<void> {
		this.writers++;
		if (this.readers > 0) {
			await new Promise<void>((resolve) => {
				this.writeQueue.push(() => resolve());
			});
		}
	}

	/**
	 * Release a write lock.
	 */
	writeUnlock(): void {
		this.writers--;
		if (this.writeQueue.length > 0) {
			const next = this.writeQueue.shift()!;
			next();
		}
	}
}

// =============================================================================
// Default Bootstrap File Names
// =============================================================================

const DEFAULT_BOOTSTRAP_FILES = {
	agent: 'AGENT.md',
	soul: 'SOUL.md',
	user: 'USER.md',
	identity: 'IDENTITY.md'
};

// =============================================================================
// Debug Logging
// =============================================================================

/**
 * Simple debug logger that uses console.debug when available
 */
const debug = {
	log: (message: string, ...args: unknown[]): void => {
		if (process.env.DEBUG || process.env.NODE_ENV !== 'production') {
			console.debug(`[context] ${message}`, ...args);
		}
	},
	drop: (reason: string, message: string): void => {
		debug.log(`DROP [${reason}]: ${message}`);
	}
};

// =============================================================================
// Context Builder
// =============================================================================

/**
 * ContextBuilder builds system prompts with caching and mtime-based invalidation.
 *
 * The cache auto-invalidates when workspace source files change (detected via mtime checks).
 * This prevents repeated reprocessing of the entire context on every call.
 */
export class ContextBuilder {
	private readonly workspace: string;
	private readonly agentId?: string;
	private readonly bootstrapFiles: {
		agent?: string;
		soul?: string;
		user?: string;
		identity?: string;
	};
	private readonly skillsPath?: string;
	private readonly globalSkillsPath?: string;
	private readonly builtinSkillsPath?: string;
	private readonly memoryPath?: string;
	private readonly memoryConfig?: {
		memoryFile?: string;
		dailyNotesPath?: string;
	};
	private readonly runtimeInfo?: {
		os?: string;
		arch?: string;
		goVersion?: string;
	};

	// Cache state
	private cachedPrompt: string = '';
	private cachedAt: number = 0;
	private cachedFilesChecked: string[] = [];
	private existedAtCache: Map<string, boolean> = new Map();
	private skillFilesAtCache: Map<string, number> = new Map();

	// Optional external skills loader
	private skillsLoader?: SkillsLoader;

	// Optional MemoryStore for persistent memory
	private memoryStore?: MemoryStore;

	// Mutex for thread-safe caching
	private readonly mutex = new RWMutex();

	constructor(config: ContextBuilderConfig) {
		this.workspace = config.workspace ?? process.cwd();
		this.agentId = config.agentId;
		this.bootstrapFiles = config.bootstrapFiles ?? DEFAULT_BOOTSTRAP_FILES;
		this.skillsPath = config.skillsPath ?? `${this.workspace}/skills`;
		this.globalSkillsPath = config.globalSkillsPath;
		this.builtinSkillsPath = config.builtinSkillsPath;
		this.memoryPath = config.memoryPath ?? `${this.workspace}/memory`;
		this.memoryConfig = config.memory;
		this.runtimeInfo = config.runtimeInfo;

		// Wire MemoryStore if memoryPath is provided
		if (config.memoryPath) {
			this.memoryStore = new MemoryStore({ workspace: config.memoryPath });
		}
	}

	/**
	 * Set the skills loader
	 */
	setSkillsLoader(loader: SkillsLoader): void {
		this.skillsLoader = loader;
	}

	/**
	 * Build the full system prompt (uncached, async)
	 */
	async buildSystemPromptAsync(): Promise<string> {
		const parts: string[] = [];

		// Core identity section
		parts.push(this.getIdentity());

		// Bootstrap files (AGENT.md, SOUL.md, USER.md, IDENTITY.md)
		const bootstrapContent = await this.loadBootstrapFilesAsync();
		if (bootstrapContent) {
			parts.push(bootstrapContent);
		}

		// Skills summary
		const skillsSummary = await this.buildSkillsSummaryAsync();
		if (skillsSummary) {
			parts.push(skillsSummary);
		}

		// Memory context
		const memoryContext = await this.getMemoryContextAsync();
		if (memoryContext) {
			parts.push(memoryContext);
		}

		return parts.join('\n\n---\n\n');
	}

	/**
	 * Build system prompt with caching (mtime-based invalidation)
	 *
	 * Returns cached prompt if source files haven't changed.
	 * Uses double-checked locking for thread safety.
	 *
	 * ## Double-Checked Locking Pattern
	 * ```
	 * // Fast path: read lock (many readers can proceed)
	 * readLock()
	 * if cached and not changed(): return cached
	 * readUnlock()
	 *
	 * // Slow path: write lock (exclusive)
	 * writeLock()
	 * if cached and not changed(): return cached  // Double-check!
	 * build baseline (snapshot file mtimes)
	 * build prompt
	 * update cache with baseline.mtime
	 * writeUnlock()
	 * ```
	 *
	 * ## Why Baseline Snapshot Before Build?
	 * The baseline (file mtimes) is captured BEFORE building the prompt.
	 * This prevents a race condition:
	 * - If file is modified during build, its mtime > baseline.maxMtime
	 * - Next call to sourceFilesChanged() will detect this and trigger rebuild
	 * - Without this, we could cache a prompt built with stale file contents
	 *
	 * ## What Gets Cached
	 * - `cachedPrompt`: The assembled system prompt string
	 * - `cachedAt`: Max mtime of all source files at build time
	 * - `existedAtCache`: Which files existed (for detecting deletions)
	 * - `skillFilesAtCache`: Individual skill file mtimes (for granular tracking)
	 * - `cachedFilesChecked`: List of all files checked
	 *
	 * @returns SystemPromptResult with prompt string and cache metadata
	 */
	async buildSystemPromptWithCache(): Promise<SystemPromptResult> {
		// Fast path: read lock (allows concurrent reads)
		await this.mutex.readLock();
		if (this.cachedPrompt && !(await this.sourceFilesChangedAsync())) {
			const result = {
				prompt: this.cachedPrompt,
				cachedAt: this.cachedAt,
				filesChecked: this.cachedFilesChecked
			};
			this.mutex.readUnlock();
			return result;
		}
		this.mutex.readUnlock();

		// Slow path: write lock (exclusive access)
		await this.mutex.writeLock();

		// Double-check after acquiring write lock
		// Another request may have rebuilt while we were waiting
		if (this.cachedPrompt && !(await this.sourceFilesChangedAsync())) {
			const result = {
				prompt: this.cachedPrompt,
				cachedAt: this.cachedAt,
				filesChecked: this.cachedFilesChecked
			};
			this.mutex.writeUnlock();
			return result;
		}

		// Snapshot the baseline BEFORE building the prompt.
		// This way cachedAt reflects the pre-build state: if a file is modified
		// during buildSystemPrompt, its new mtime will be > baseline.maxMtime,
		// so the next sourceFilesChanged check will correctly trigger a rebuild.
		const baseline = await this.buildCacheBaselineAsync();
		const prompt = await this.buildSystemPromptAsync();

		// Update cache with new prompt and baseline metadata
		this.cachedPrompt = prompt;
		this.cachedAt = baseline.maxMtime;
		this.existedAtCache = baseline.existed;
		this.skillFilesAtCache = baseline.skillFiles;
		this.cachedFilesChecked = baseline.filesChecked;

		this.mutex.writeUnlock();

		return {
			prompt: this.cachedPrompt,
			cachedAt: this.cachedAt,
			filesChecked: this.cachedFilesChecked
		};
	}

	/**
	 * Build dynamic context that changes per-request
	 *
	 * This includes time, runtime info, session metadata, and sender information.
	 * It is NOT cached because it changes on every call.
	 */
	buildDynamicContext(options: DynamicContextOptions = {}): string {
		const now = new Date();
		const timeStr =
			now.toISOString().split('T')[0] +
			' ' +
			now.toTimeString().split(' ')[0] +
			' (' +
			now.toLocaleDateString('en-US', { weekday: 'long' }) +
			')';

		// Use provided runtime info or detect from environment
		const os = this.runtimeInfo?.os ?? process.platform;
		const arch = this.runtimeInfo?.arch ?? process.arch;
		const version = this.runtimeInfo?.goVersion ?? process.version;
		const runtime = `${os} ${arch}, Node.js ${version}`;

		const parts: string[] = [`## Current Time\n${timeStr}`, `## Runtime\n${runtime}`];

		// Session key (supports both key and sessionKey for backward compatibility)
		const effectiveSessionKey = options.key || options.sessionKey;
		if (effectiveSessionKey) {
			parts.push(`## Current Session\nKey: ${effectiveSessionKey}`);
		}

		// Channel and Chat ID
		if (options.channel) {
			parts.push(`## Channel\n${options.channel}`);
		}
		if (options.chatId) {
			parts.push(`## Chat ID\n${options.chatId}`);
		}

		// Sender information
		if (options.senderId || options.senderDisplayName) {
			const senderParts: string[] = [];
			if (options.senderDisplayName) {
				senderParts.push(options.senderDisplayName);
			}
			if (options.senderId) {
				senderParts.push(`ID: ${options.senderId}`);
			}
			parts.push(`## Current Sender\n${senderParts.join(' ')}`);
		}

		return parts.join('\n\n');
	}

	/**
	 * Build context for actively selected skills per request.
	 *
	 * Loads specific skills by name rather than listing all skills.
	 */
	async buildActiveSkillsContext(skillNames: string[]): Promise<string> {
		if (!skillNames || skillNames.length === 0) {
			return '';
		}

		const loadedSkills: Array<{ name: string; content: string }> = [];

		for (const name of skillNames) {
			let skill: Skill | undefined;
			if (this.skillsLoader) {
				skill = await this.skillsLoader.loadSkill(name);
			}
			if (!skill) {
				// Fallback: try to load from filesystem
				skill = await this.loadSkillFromFilesystem(name);
			}
			if (skill) {
				loadedSkills.push({ name: skill.name, content: skill.content });
			}
		}

		if (loadedSkills.length === 0) {
			return '';
		}

		const parts: string[] = [
			'# Active Skills\n\nThe following skills are active for this request. Follow them when relevant.'
		];

		for (const { name, content } of loadedSkills) {
			parts.push(`## ${name}\n${content}\n\n---`);
		}

		return parts.join('\n\n');
	}

	/**
	 * Get memory context from MemoryStore (async version)
	 *
	 * Returns formatted context from long-term memory and recent daily notes.
	 */
	async getMemoryContext(): Promise<string> {
		if (!this.memoryStore) {
			return this.getMemoryContextAsync();
		}

		try {
			return await this.memoryStore.getMemoryContext();
		} catch {
			// Fallback to async file reading
			return this.getMemoryContextAsync();
		}
	}

	/**
	 * Check if adding messages would exceed the context budget
	 *
	 * @param contextWindow - Total context window size in tokens
	 * @param messages - Current messages to check
	 * @param toolDefs - Tool definitions to check
	 * @param maxTokens - Maximum tokens to reserve for output
	 * @returns true if would exceed budget, false otherwise
	 */
	checkContextOverflow(
		contextWindow: number,
		messages: AgentMessage[],
		toolDefs: import('../types/index.js').ToolDefinition[],
		maxTokens: number
	): boolean {
		return isOverContextBudget(contextWindow, messages, toolDefs, maxTokens);
	}

	/**
	 * Build full context for a turn
	 */
	async buildContext(
		session: { key: string; metadata?: Record<string, unknown> },
		additionalContext?: Record<string, unknown>
	): Promise<ContextResult> {
		const { prompt, cachedAt, filesChecked } = await this.buildSystemPromptWithCache();
		const dynamicContext = this.buildDynamicContext({ sessionKey: session.key });

		let fullDynamicContext = dynamicContext;
		if (additionalContext) {
			fullDynamicContext += '\n\n---\n\n' + this.buildAdditionalContext(additionalContext);
		}

		return {
			systemPrompt: prompt,
			dynamicContext: fullDynamicContext,
			messages: [], // Messages built separately via composeMessages
			cachedAt,
			filesChecked
		};
	}

	/**
	 * Compose messages for LLM request
	 *
	 * Combines system prompt, dynamic context, history, and current input
	 * into provider-specific message format.
	 */
	composeMessages(
		history: AgentMessage[],
		input: string,
		systemPrompt: string,
		dynamicContext: string,
		_providerFormat: 'openai' | 'anthropic' | 'ollama' = 'openai'
	): AgentMessage[] {
		return this.buildMessages(history, input, systemPrompt, dynamicContext);
	}

	/**
	 * Build messages for LLM request (primary method)
	 *
	 * Combines system prompt, dynamic context, history, and current input.
	 * @deprecated Use composeMessages instead for provider-specific message formatting
	 */
	buildMessages(
		history: AgentMessage[],
		input: string,
		systemPrompt: string,
		dynamicContext?: string
	): AgentMessage[] {
		const messages: AgentMessage[] = [];

		// Build full system message content
		let fullSystemContent = systemPrompt;
		if (dynamicContext) {
			fullSystemContent += '\n\n---\n\n' + dynamicContext;
		}

		// Add system message
		messages.push({
			role: 'system',
			content: fullSystemContent
		});

		// Sanitize and add history using two-pass algorithm
		const sanitizedHistory = this.sanitizeHistoryForProvider(history);
		messages.push(...sanitizedHistory);

		// Add user input
		if (input.trim()) {
			messages.push({
				role: 'user',
				content: input
			});
		}

		return messages;
	}

	/**
	 * Invalidate the cache (force rebuild on next call)
	 */
	invalidateCache(): void {
		this.cachedPrompt = '';
		this.cachedAt = 0;
		this.cachedFilesChecked = [];
		this.existedAtCache = new Map();
		this.skillFilesAtCache = new Map();
	}

	/**
	 * Check if source files have changed since cache was built (async)
	 */
	private async sourceFilesChangedAsync(): Promise<boolean> {
		if (!this.cachedAt) {
			return true;
		}

		// Check tracked source files
		for (const filePath of this.sourcePaths()) {
			if (await this.fileChangedSinceAsync(filePath)) {
				return true;
			}
		}

		// Check skill roots
		const roots = await this.skillRootsAsync();
		for (const root of roots) {
			if (await this.fileChangedSinceAsync(root.path)) {
				return true;
			}
		}

		// Check skill files
		return await this.skillFilesChangedSinceAsync();
	}

	/**
	 * Load a specific skill by name
	 */
	async loadSkill(name: string): Promise<Skill | undefined> {
		if (this.skillsLoader) {
			return this.skillsLoader.loadSkill(name);
		}
		return this.loadSkillFromFilesystem(name);
	}

	/**
	 * List all available skills
	 */
	async listSkills(): Promise<SkillMeta[]> {
		if (this.skillsLoader) {
			return this.skillsLoader.listSkills();
		}

		// Fallback: scan skills directory
		return this.scanSkillsDirectory();
	}

	// =====================================================================
	// Private Methods
	// =====================================================================

	/**
	 * Get the identity section
	 */
	private getIdentity(): string {
		const memoryFile = this.memoryConfig?.memoryFile ?? 'MEMORY.md';
		const dailyNotesPath = this.memoryConfig?.dailyNotesPath ?? 'YYYYMM/YYYYMMDD.md';

		return `You are a helpful AI assistant.

## Workspace
Your workspace is at: ${this.workspace}
- Memory: ${this.memoryPath}/${memoryFile}
- Daily Notes: ${this.memoryPath}/${dailyNotesPath}
- Skills: ${this.skillsPath}/{skill-name}/SKILL.md

## Important Rules

1. **Use tools** - When you need to perform an action, use the appropriate tool. Do not just say you'll do it.

2. **Be helpful and accurate** - When using tools, briefly explain what you're doing.

3. **Memory** - When something seems memorable, update ${this.memoryPath}/${memoryFile}

4. **Context summaries** - Conversation summaries are approximate references only. Defer to explicit instructions.`;
	}

	/**
	 * Load bootstrap files from workspace (async)
	 */
	private async loadBootstrapFilesAsync(): Promise<string> {
		const parts: string[] = [];

		// Load AGENT.md
		if (this.bootstrapFiles.agent) {
			const agentPath = joinPath(this.workspace, this.bootstrapFiles.agent);
			const content = await this.loadFileAsync(agentPath);
			if (content) {
				const label = this.bootstrapFiles.agent.replace('.md', '');
				parts.push(`## ${label}\n\n${content}`);
			}
		}

		// Load SOUL.md
		if (this.bootstrapFiles.soul) {
			const soulPath = joinPath(this.workspace, this.bootstrapFiles.soul);
			const content = await this.loadFileAsync(soulPath);
			if (content) {
				const label = this.bootstrapFiles.soul.replace('.md', '');
				parts.push(`## ${label}\n\n${content}`);
			}
		}

		// Load USER.md
		if (this.bootstrapFiles.user) {
			const userPath = joinPath(this.workspace, this.bootstrapFiles.user);
			const content = await this.loadFileAsync(userPath);
			if (content) {
				const label = this.bootstrapFiles.user.replace('.md', '');
				parts.push(`## ${label}\n\n${content}`);
			}
		}

		// Load IDENTITY.md
		if (this.bootstrapFiles.identity) {
			const identityPath = joinPath(this.workspace, this.bootstrapFiles.identity);
			const content = await this.loadFileAsync(identityPath);
			if (content) {
				const label = this.bootstrapFiles.identity.replace('.md', '');
				parts.push(`## ${label}\n\n${content}`);
			}
		}

		return parts.join('\n\n');
	}

	/**
	 * Load a file from the filesystem (async)
	 */
	private async loadFileAsync(path: string): Promise<string> {
		try {
			return await readFile(path, 'utf-8');
		} catch {
			return '';
		}
	}

	/**
	 * Get memory context (async version - uses file reading)
	 */
	private async getMemoryContextAsync(): Promise<string> {
		const memoryFile = this.memoryConfig?.memoryFile ?? 'MEMORY.md';
		const memoryPath = joinPath(this.memoryPath ?? `${this.workspace}/memory`, memoryFile);
		const content = await this.loadFileAsync(memoryPath);
		if (!content) {
			return '';
		}
		return `# Memory\n\n${content}`;
	}

	/**
	 * Load a skill from filesystem
	 */
	private async loadSkillFromFilesystem(name: string): Promise<Skill | undefined> {
		const roots = await this.skillRootsAsync();

		for (const root of roots) {
			const skillPath = joinPath(root.path, name, 'SKILL.md');
			const content = await this.loadFileAsync(skillPath);
			if (content) {
				const description = this.extractSkillDescription(content);
				return {
					name,
					description,
					content,
					location: skillPath,
					source: root.source
				};
			}
		}

		return undefined;
	}

	/**
	 * Get source file paths to track for cache invalidation
	 */
	private sourcePaths(): string[] {
		const paths: string[] = [];

		if (this.bootstrapFiles.agent) {
			paths.push(`${this.workspace}/${this.bootstrapFiles.agent}`);
		}
		if (this.bootstrapFiles.soul) {
			paths.push(`${this.workspace}/${this.bootstrapFiles.soul}`);
		}
		if (this.bootstrapFiles.user) {
			paths.push(`${this.workspace}/${this.bootstrapFiles.user}`);
		}
		if (this.bootstrapFiles.identity) {
			paths.push(`${this.workspace}/${this.bootstrapFiles.identity}`);
		}

		// Add memory file
		const memoryFile = this.memoryConfig?.memoryFile ?? 'MEMORY.md';
		paths.push(`${this.memoryPath}/${memoryFile}`);

		return paths;
	}

	/**
	 * Get skill root directories with source tiers (async)
	 */
	private async skillRootsAsync(): Promise<
		Array<{ path: string; source: 'workspace' | 'global' | 'builtin' }>
	> {
		const roots: Array<{ path: string; source: 'workspace' | 'global' | 'builtin' }> = [];

		// Workspace skills (highest priority)
		if (this.skillsPath) {
			roots.push({ path: this.skillsPath, source: 'workspace' });
		}

		// Global skills (~/.molos/skills)
		const globalPath = this.globalSkillsPath ?? joinPath(getHomeDir(), '.molos', 'skills');
		if (await pathExists(globalPath)) {
			roots.push({ path: globalPath, source: 'global' });
		}

		// Builtin skills (bundled with application)
		if (this.builtinSkillsPath && (await pathExists(this.builtinSkillsPath))) {
			roots.push({ path: this.builtinSkillsPath, source: 'builtin' });
		}

		return roots;
	}

	/**
	 * Build cache baseline (existence + max mtime snapshot, async)
	 */
	private async buildCacheBaselineAsync(): Promise<CacheBaseline & { filesChecked: string[] }> {
		const roots = await this.skillRootsAsync();
		const rootPaths = roots.map((r) => r.path);
		const allPaths = [...this.sourcePaths(), ...rootPaths];

		const existed = new Map<string, boolean>();
		const skillFiles = new Map<string, number>();
		const filesChecked: string[] = [];
		let maxMtime = 0;

		for (const filePath of allPaths) {
			try {
				const fileStat = await stat(filePath);
				if (fileStat) {
					existed.set(filePath, true);
					filesChecked.push(filePath);
					if (fileStat.mtimeMs > maxMtime) {
						maxMtime = fileStat.mtimeMs;
					}
				}
			} catch {
				existed.set(filePath, false);
			}
		}

		// Walk skill directories for file-level tracking
		for (const root of roots) {
			try {
				const entries = await readdir(root.path, true);
				for (const entry of entries) {
					if (entry && typeof entry === 'object') {
						const isFile = entry.isFile();
						if (isFile) {
							const skillFilePath = joinPath(root.path, entry.name);
							try {
								const fileStat = await stat(skillFilePath);
								if (fileStat && fileStat.mtimeMs) {
									skillFiles.set(skillFilePath, fileStat.mtimeMs);
									filesChecked.push(skillFilePath);
									if (fileStat.mtimeMs > maxMtime) {
										maxMtime = fileStat.mtimeMs;
									}
								}
							} catch {
								// Ignore
							}
						}
					}
				}
			} catch {
				// Directory doesn't exist
			}
		}

		// Use epoch 1 if no files exist (so new files are detected)
		if (maxMtime === 0) {
			maxMtime = 1;
		}

		return { existed, skillFiles, maxMtime, filesChecked };
	}

	/**
	 * Check if a file has changed since cache was built (async)
	 */
	private async fileChangedSinceAsync(path: string): Promise<boolean> {
		if (this.existedAtCache.size === 0) {
			return true;
		}

		const existedBefore = this.existedAtCache.get(path);
		try {
			const fileStat = await stat(path);

			if (existedBefore === undefined) {
				return true; // New file
			}
			if (!existedBefore) {
				return true; // File was deleted
			}
			if (!fileStat) {
				return existedBefore; // File doesn't exist now
			}

			return fileStat.mtimeMs > this.cachedAt;
		} catch {
			// File doesn't exist or can't be read
			return existedBefore === true; // Changed if it existed before
		}
	}

	/**
	 * Check if skill files have changed since cache was built (async)
	 */
	private async skillFilesChangedSinceAsync(): Promise<boolean> {
		if (this.skillFilesAtCache.size === 0) {
			return true;
		}

		for (const [filePath, cachedMtime] of this.skillFilesAtCache) {
			try {
				const fileStat = await stat(filePath);
				if (!fileStat) {
					// File was deleted
					return true;
				}
				if (fileStat.mtimeMs !== cachedMtime) {
					return true;
				}
			} catch {
				// File was deleted
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if a message has tool calls in its content array
	 *
	 * NOTE: AI SDK uses 'tool-call' (hyphen) format in content blocks, not 'tool_call' (underscore).
	 * The block structure is: { type: 'tool-call', toolCallId: string, toolName: string, input: object }
	 * We also support legacy 'tool_call' format for backward compatibility.
	 */
	private hasToolCalls(msg: AgentMessage): boolean {
		if (typeof msg.content === 'string') {
			return false;
		}
		if (!Array.isArray(msg.content)) {
			return false;
		}
		// Check for both 'tool-call' (AI SDK) and 'tool_call' (legacy) block types
		return msg.content.some(
			(block) =>
				typeof block === 'object' &&
				block !== null &&
				((block as any).type === 'tool-call' || (block as any).type === 'tool_call')
		);
	}

	/**
	 * Extract tool call IDs from a message's content array
	 *
	 * NOTE: AI SDK uses 'tool-call' (hyphen) format and 'toolCallId' property.
	 * We also handle legacy 'tool_call' format with 'id' property for compatibility.
	 */
	private getToolCallIds(msg: AgentMessage): string[] {
		if (typeof msg.content === 'string') {
			return [];
		}
		if (!Array.isArray(msg.content)) {
			return [];
		}
		const ids: string[] = [];
		for (const block of msg.content) {
			// Support both 'tool-call' (AI SDK) and 'tool_call' (legacy) block types
			// Also handle both 'toolCallId' and 'id' property names
			if (typeof block === 'object' && block !== null) {
				const blockType = (block as any).type;
				if (blockType === 'tool-call' || blockType === 'tool_call') {
					ids.push((block as any).toolCallId || (block as any).id);
				}
			}
		}
		return ids;
	}

	/**
	 * Two-pass history sanitization for provider compatibility
	 *
	 * ## Why Sanitization Is Needed
	 * LLM providers expect message history to be well-formed:
	 * - System messages should not appear in history (context builder adds its own)
	 * - Every assistant message with tool_calls must have corresponding tool results
	 * - Tool results must match the tool_call IDs from the assistant message
	 * - Duplicate tool results waste tokens and can confuse the LLM
	 *
	 * ## Pass 1: Basic Sanitization
	 * Processes messages sequentially, handling each role:
	 *
	 * **System messages**: Dropped (context builder adds its own)
	 *
	 * **Tool messages**:
	 * - Skip if no preceding assistant message (orphaned)
	 * - Look backwards for assistant with tool_calls
	 * - Skip if toolCallId already seen (duplicate)
	 *
	 * **Assistant messages**: Kept for Pass 2 verification
	 *
	 * **Other roles**: Kept as-is
	 *
	 * ## Pass 2: Tool Call Matching
	 * For each assistant message with tool_calls:
	 * 1. Extract expected tool_call IDs
	 * 2. Count following tool results that match those IDs
	 * 3. If missing any results → drop the entire assistant message
	 * 4. If all found → keep assistant and its tool results
	 *
	 * ## Example: Incomplete Tool Call Handling
	 * ```
	 * [assistant with tool_calls: [tc1, tc2, tc3]]
	 * [tool result for tc1]
	 * [tool result for tc3]  ← missing tc2!
	 *
	 * → Entire assistant message is dropped
	 * ```
	 *
	 * ## AI Context Optimization
	 * - Prevents wasted tokens on malformed message sequences
	 * - Avoids LLM confusion from dangling tool_call references
	 * - Duplicate removal reduces token count
	 * - Dropped messages are logged via debug.drop() for debugging
	 *
	 * @param messages - Raw message history
	 * @returns Sanitized messages safe for provider consumption
	 */
	private sanitizeHistoryForProvider(messages: AgentMessage[]): AgentMessage[] {
		if (messages.length === 0) {
			return messages;
		}

		// =====================================================================
		// PASS 1: Basic sanitization
		// =====================================================================
		const pass1: AgentMessage[] = [];
		const seenToolCallIds = new Set<string>();

		for (let i = 0; i < messages.length; i++) {
			const msg = messages[i];
			if (!msg) continue;

			switch (msg.role) {
				case 'system':
					// Drop system messages from history
					debug.drop('system', 'system message dropped');
					continue;

				case 'tool':
					// Skip orphaned tool results (no preceding assistant message)
					if (pass1.length === 0) {
						debug.drop('orphaned-tool', 'orphaned tool message at start');
						continue;
					}

					// Find preceding assistant message (skip other tool messages)
					let foundAssistant = false;
					for (let j = pass1.length - 1; j >= 0; j--) {
						const prevMsg = pass1[j];
						if (!prevMsg) continue;
						if (prevMsg.role === 'tool') {
							continue;
						}
						if (prevMsg.role === 'assistant') {
							// Check if this assistant has tool calls
							if (this.hasToolCalls(prevMsg)) {
								foundAssistant = true;
							}
						}
						break;
					}
					if (!foundAssistant) {
						debug.drop('orphaned-tool', 'tool message without preceding assistant tool call');
						continue;
					}

					// Skip duplicate tool results
					if (msg.toolCallId && seenToolCallIds.has(msg.toolCallId)) {
						debug.drop('duplicate-tool', `duplicate tool result: ${msg.toolCallId}`);
						continue;
					}
					if (msg.toolCallId) {
						seenToolCallIds.add(msg.toolCallId);
					}
					pass1.push(msg);
					break;

				case 'assistant':
					// Skip assistant messages with tool calls but invalid predecessors
					// (should have tool results following, but we'll handle this in Pass 2)
					pass1.push(msg);
					break;

				default:
					pass1.push(msg);
			}
		}

		// =====================================================================
		// PASS 2: Tool call matching
		// =====================================================================
		const final: AgentMessage[] = [];
		const usedToolCallIds = new Set<string>();

		for (let i = 0; i < pass1.length; i++) {
			const msg = pass1[i];
			if (!msg) continue;

			if (msg.role === 'assistant' && this.hasToolCalls(msg)) {
				// Collect expected tool_call IDs from this assistant message
				const expectedIds = new Set(this.getToolCallIds(msg));

				// Count how many matching tool results follow
				let found = 0;
				const toolResultIndices: number[] = [];

				for (let j = i + 1; j < pass1.length && found < expectedIds.size; j++) {
					const nextMsg = pass1[j];
					if (!nextMsg) break;
					if (nextMsg.role !== 'tool') {
						break; // Stop at non-tool message
					}
					if (nextMsg.toolCallId && expectedIds.has(nextMsg.toolCallId)) {
						found++;
						toolResultIndices.push(j);
						usedToolCallIds.add(nextMsg.toolCallId);
					}
				}

				// If any tool_call ID is missing its tool result, drop this assistant message
				// and all its partial tool results
				if (found < expectedIds.size) {
					debug.drop(
						'incomplete-tool',
						`assistant message dropped: expected ${expectedIds.size} tool results, found ${found}`
					);
					// Skip this assistant message and its tool messages
					i += toolResultIndices.length;
					continue;
				}

				// All tool results found, add assistant and its tool results
				final.push(msg);
				for (const toolIndex of toolResultIndices) {
					const toolMsg = pass1[toolIndex];
					if (toolMsg) {
						final.push(toolMsg);
					}
				}
				// Skip past the processed tool messages
				i += toolResultIndices.length;
			} else if (msg.role === 'tool') {
				// Skip tool results we've already used in incomplete tool call groups
				// (already filtered in pass 1, but double-check here)
				if (msg.toolCallId && usedToolCallIds.has(msg.toolCallId)) {
					debug.drop('duplicate-tool', `duplicate tool result in pass2: ${msg.toolCallId}`);
					continue;
				}
				final.push(msg);
			} else {
				final.push(msg);
			}
		}

		return final;
	}

	/**
	 * Build additional context from custom data
	 */
	private buildAdditionalContext(additionalContext: Record<string, unknown>): string {
		const parts: string[] = [];

		for (const [key, value] of Object.entries(additionalContext)) {
			if (value !== undefined && value !== null) {
				if (typeof value === 'string') {
					parts.push(`## ${key}\n\n${value}`);
				} else {
					parts.push(`## ${key}\n\n\`\`\`\n${JSON.stringify(value, null, 2)}\n\`\`\``);
				}
			}
		}

		return parts.join('\n\n');
	}

	/**
	 * Filter metadata to only include relevant fields for context
	 */
	private filterRelevantMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
		const excluded = new Set(['password', 'token', 'secret', 'key', 'apiKey']);
		const filtered: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(metadata)) {
			const lowerKey = key.toLowerCase();
			let isExcluded = false;
			for (const ex of excluded) {
				if (lowerKey.includes(ex)) {
					isExcluded = true;
					break;
				}
			}
			if (!isExcluded && value !== undefined && value !== null) {
				filtered[key] = value;
			}
		}

		return filtered;
	}

	/**
	 * List skills asynchronously (fallback when no skillsLoader)
	 */
	private async listSkillsAsync(): Promise<SkillMeta[]> {
		const skills: SkillMeta[] = [];
		const roots = await this.skillRootsAsync();

		for (const root of roots) {
			try {
				const entries = await readdir(root.path, true);

				for (const entry of entries) {
					if (entry && typeof entry === 'object') {
						const isDir = entry.isDirectory();
						if (isDir) {
							// This is a skill directory
							const skillName = entry.name;
							const skillPath = joinPath(root.path, skillName, 'SKILL.md');

							try {
								const content = await this.loadFileAsync(skillPath);
								const description = this.extractSkillDescription(content);
								const frontmatter = this.parseSkillFrontmatter(content);
								const skillMeta: SkillMeta = {
									name: skillName,
									description,
									path: skillPath,
									source: root.source,
									emoji: frontmatter?.metadata?.emoji,
									os: frontmatter?.metadata?.os,
									requires: frontmatter?.metadata?.requires?.bins
								};
								skills.push(skillMeta);
							} catch {
								// SKILL.md doesn't exist, skip
							}
						}
					}
				}
			} catch {
				// Directory doesn't exist
			}
		}

		return skills;
	}

	/**
	 * Scan skills directory for available skills (async)
	 */
	private async scanSkillsDirectory(): Promise<SkillMeta[]> {
		return this.listSkillsAsync();
	}

	/**
	 * Extract description from skill content
	 */
	private extractSkillDescription(content: string): string {
		// Try to extract first paragraph after title
		const lines = content.split('\n');
		let inDescription = false;
		const descriptionLines: string[] = [];

		for (const line of lines) {
			if (line.startsWith('# ')) {
				continue; // Skip title
			}
			if (line.startsWith('## ')) {
				if (descriptionLines.length > 0) {
					break; // Stop at first section
				}
				inDescription = true;
				continue;
			}
			if (inDescription && line.trim()) {
				descriptionLines.push(line.trim());
			}
		}

		const description = descriptionLines.join(' ').trim();
		return description.length > CONTEXT.SKILL_DESCRIPTION_MAX_CHARS
			? description.substring(0, CONTEXT.SKILL_DESCRIPTION_MAX_CHARS) + '...'
			: description;
	}

	/**
	 * Parse YAML frontmatter from skill content
	 *
	 * Extracts metadata between --- markers at the start of the file.
	 * Returns parsed frontmatter object or null if no frontmatter found.
	 */
	private parseSkillFrontmatter(content: string): SkillFrontmatter | null {
		// Check for frontmatter markers
		if (!content.startsWith('---')) {
			return null;
		}

		// Find closing marker
		const endIndex = content.indexOf('\n---', 3);
		if (endIndex === -1) {
			return null;
		}

		// Extract YAML content between markers
		const yamlContent = content.substring(4, endIndex).trim();

		try {
			return this.parseSimpleYaml(yamlContent);
		} catch {
			return null;
		}
	}

	/**
	 * Simple YAML parser for frontmatter
	 *
	 * Handles basic YAML structures found in skill frontmatter:
	 * - Top-level scalar values (name, description, homepage)
	 * - Boolean values (user-invocable, disable-model-invocation)
	 * - Nested objects (metadata)
	 * - Arrays (os, requires.bins)
	 */
	private parseSimpleYaml(yamlContent: string): SkillFrontmatter {
		const result: SkillFrontmatter = {};
		const lines = yamlContent.split('\n');
		let currentIndent = 0;
		let inMetadata = false;
		let metadataIndent = 0;
		let currentRequires: SkillFrontmatter['metadata'] = {};

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line || !line.trim()) continue;

			const indent = line.search(/\S/);
			const trimmedLine = line.trim();

			// Top-level keys
			if (indent === 0) {
				if (inMetadata) {
					// Close metadata object
					result.metadata = currentRequires;
					inMetadata = false;
					currentRequires = {};
				}

				const colonIndex = trimmedLine.indexOf(':');
				if (colonIndex > 0) {
					const key = trimmedLine.substring(0, colonIndex);
					const value = trimmedLine.substring(colonIndex + 1).trim();

					if (value) {
						// Handle quoted strings
						if (
							(value.startsWith('"') && value.endsWith('"')) ||
							(value.startsWith("'") && value.endsWith("'"))
						) {
							result[key as keyof SkillFrontmatter] = value.slice(1, -1) as never;
						} else if (value === 'true') {
							result[key as keyof SkillFrontmatter] = true as never;
						} else if (value === 'false') {
							result[key as keyof SkillFrontmatter] = false as never;
						} else {
							result[key as keyof SkillFrontmatter] = value as never;
						}
					}
				}
			} else if (trimmedLine.startsWith('metadata:')) {
				inMetadata = true;
				currentIndent = indent;
				currentRequires = {};
				metadataIndent = indent;
			} else if (inMetadata && indent > metadataIndent) {
				// Inside metadata object
				const colonIndex = trimmedLine.indexOf(':');
				if (colonIndex > 0) {
					const key = trimmedLine.substring(0, colonIndex);
					const value = trimmedLine.substring(colonIndex + 1).trim();

					if (key === 'emoji') {
						currentRequires.emoji = value.replace(/['"]/g, '');
					} else if (key === 'os') {
						// Handle array format: [linux, darwin] or multiline
						if (value.startsWith('[')) {
							currentRequires.os = value
								.slice(1, -1)
								.split(',')
								.map((s) => s.trim().replace(/['"]/g, ''));
						}
					} else if (key === 'requires:') {
						// Nested requires block
						// Parse nested requires.bins, requires.env, requires.config
						for (let j = i + 1; j < lines.length; j++) {
							const reqLine = lines[j];
							if (!reqLine) break;
							const reqIndent = reqLine.search(/\S/);
							if (reqIndent <= indent) break;

							const reqTrimmed = reqLine.trim();
							if (reqTrimmed.startsWith('bins:')) {
								const binsValue = reqTrimmed.substring(5).trim();
								if (binsValue.startsWith('[')) {
									currentRequires.requires = {
										bins: binsValue
											.slice(1, -1)
											.split(',')
											.map((s) => s.trim().replace(/['"]/g, ''))
									};
								}
							} else if (reqTrimmed.startsWith('env:')) {
								const envValue = reqTrimmed.substring(4).trim();
								if (envValue.startsWith('[')) {
									currentRequires.requires = currentRequires.requires || {};
									currentRequires.requires.env = envValue
										.slice(1, -1)
										.split(',')
										.map((s) => s.trim().replace(/['"]/g, ''));
								}
							} else if (reqTrimmed.startsWith('config:')) {
								const configValue = reqTrimmed.substring(7).trim();
								if (configValue.startsWith('[')) {
									currentRequires.requires = currentRequires.requires || {};
									currentRequires.requires.config = configValue
										.slice(1, -1)
										.split(',')
										.map((s) => s.trim().replace(/['"]/g, ''));
								}
							}
						}
					} else if (key === 'install:') {
						// Handle install array - skip for now (complex structure)
					}
				}
			}
		}

		// Close metadata if still open
		if (inMetadata) {
			result.metadata = currentRequires;
		}

		return result;
	}

	/**
	 * Build skills summary in compact XML format for tight budget situations (async)
	 */
	async buildSkillsSummaryCompactAsync(): Promise<string> {
		const skills = await this.listSkillsAsync();
		if (!skills || skills.length === 0) {
			return '';
		}

		const skillEntries = skills
			.map(
				(skill) =>
					`    <skill>\n      <name>${this.escapeXml(skill.name)}</name>\n      <location>${this.escapeXml(skill.path)}</location>\n    </skill>`
			)
			.join('\n');

		return `<available_skills>\n${skillEntries}\n</available_skills>`;
	}

	/**
	 * Build skills summary with budget-aware fallback (async)
	 *
	 * @param maxChars Maximum characters before switching to compact format
	 * @returns Full or compact skills summary depending on budget
	 */
	async buildSkillsSummaryAsync(
		maxChars: number = CONTEXT.SKILLS_SUMMARY_MAX_CHARS
	): Promise<string> {
		const full = await this.buildSkillsSummaryFullAsync();
		if (full.length <= maxChars) {
			return full;
		}
		return this.buildSkillsSummaryCompactAsync();
	}

	/**
	 * Build full skills summary with rich metadata (existing behavior, async)
	 */
	private async buildSkillsSummaryFullAsync(): Promise<string> {
		try {
			const skills = await this.listSkillsAsync();
			if (!skills || skills.length === 0) {
				return '';
			}

			const lines: string[] = ['# Skills\n\nAvailable skills:'];
			for (const skill of skills) {
				if (skill) {
					const parts: string[] = [skill.name];
					if (skill.emoji) parts.push(skill.emoji);
					if (skill.source !== 'workspace') parts.push(`[${skill.source}]`);
					if (skill.os && skill.os.length > 0) parts.push(`(${skill.os.join(', ')})`);

					const name = parts.join(' ');
					let entry = `- **${name}**: ${skill.description}`;
					if (skill.requires && skill.requires.length > 0) {
						entry += ` [requires: ${skill.requires.join(', ')}]`;
					}
					lines.push(entry);
				}
			}

			return lines.join('\n');
		} catch {
			return '';
		}
	}

	/**
	 * Escape XML special characters
	 */
	private escapeXml(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}

	/**
	 * Get comprehensive skills information (async)
	 *
	 * Returns total count, available count, skill names, and full metadata.
	 */
	async GetSkillsInfoAsync(): Promise<{
		total: number;
		available: number;
		names: string[];
		withMetadata: SkillMeta[];
	}> {
		const skills = await this.listSkillsAsync();
		const names = skills.map((s: SkillMeta) => s.name);

		return {
			total: names.length,
			available: names.length,
			names,
			withMetadata: skills
		};
	}
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new ContextBuilder instance
 */
export function createContextBuilder(config: ContextBuilderConfig): ContextBuilder {
	return new ContextBuilder(config);
}
