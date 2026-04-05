/**
 * Memory Store - Agent Long-term and Daily Note Memory Management
 *
 * ## Purpose
 * Provides persistent memory management for AI agents with two distinct
 * memory systems that serve different purposes in context injection:
 *
 * 1. **Long-term Memory** (MEMORY.md): Persistent knowledge that survives
 *    across sessions - learned facts, preferences,重要 decisions
 *
 * 2. **Daily Notes** (YYYYMMDD.md): Time-boxed working memory organized
 *    by date for tracking daily progress, notes, and ephemeral context
 *
 * ## Key Concepts
 *
 * **Memory Separation by Purpose**:
 * - Long-term = persistent facts, learned knowledge, user preferences
 * - Daily notes = transient, date-organized, temporal context
 * - This separation enables selective memory injection
 *
 * **Atomic Writes for Integrity**:
 * - All writes use writeFileAtomic() for crash safety
 * - No partial writes, no corrupted memory files
 * - 0o600 permissions protect sensitive memory content
 *
 * **Directory Organization**:
 * ```
 * workspace/
 * └── memory/
 *     ├── MEMORY.md                    # Long-term memory
 *     └── YYYYMM/                      # Daily notes by month
 *         └── YYYYMMDD.md              # Daily note
 * ```
 *
 * **Memory Context Formatting**:
 * - getMemoryContext() returns pre-formatted markdown
 * - Clear section headers for AI parsing
 * - Separator lines (---) between sections
 * - Empty sections omitted automatically
 *
 * ## Safety Guarantees
 *
 * **Write Atomicity**:
 * - All write operations use atomic write pattern
 * - Original file preserved until write completes
 * - Temp file cleanup on failure
 *
 * **Read Safety**:
 * - ENOENT returns empty string (not error)
 * - Graceful handling of missing files
 * - No corrupted state on read failure
 *
 * **File Permissions**:
 * - All files created with 0o600 (owner-only)
 * - Memory content is sensitive
 * - Prevents system user eavesdropping
 *
 * ## Usage Pattern
 *
 * ```typescript
 * const store = new MemoryStore({ workspace: '/path/to/agent' });
 *
 * // Read long-term memory
 * const memories = await store.readLongTerm();
 *
 * // Write long-term memory (atomic)
 * await store.writeLongTerm('User prefers Markdown formatting');
 *
 * // Append to today's daily note (creates if missing)
 * await store.appendToday('Completed API integration');
 *
 * // Get formatted context for prompt injection
 * const context = await store.getMemoryContext();
 * ```
 *
 * ## Context Optimization Tips
 *
 * **What to Store in Long-term Memory**:
 * - User preferences and settings
 * - Learned facts about the user
 * - Project-specific knowledge
 * - Important decisions and context
 *
 * **What to Store in Daily Notes**:
 * - Daily progress updates
 * - Working notes and thoughts
 * - Task completions
 * - Temporary context that expires
 *
 * **Context Budget Management**:
 * - Long-term memory is most token-efficient
 * - Daily notes provide recency but cost tokens
 * - Consider pruning old daily notes
 * - getMemoryContext() can be token-counted
 *
 * **Efficient Daily Note Access**:
 * - getRecentDailyNotes(3) fetches last 3 days only
 * - Daily notes grouped by month directory
 * - Empty files are skipped
 * - Consider limiting days based on context budget
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { writeFileAtomic } from './file-util.js';

/**
 * Configuration for MemoryStore initialization
 */
export interface MemoryStoreConfig {
	/** Root workspace directory for agent files */
	workspace: string;
	/** Custom path for long-term memory file (default: 'memory/MEMORY.md') */
	memoryFile?: string;
}

const DEFAULT_MEMORY_FILE = 'memory/MEMORY.md';

/**
 * MemoryStore manages persistent memory files for the agent.
 *
 * ## Memory Types
 *
 * **Long-term Memory**:
 * - Single file at workspace/memory/MEMORY.md
 * - Persistent across all sessions
 * - Use for: preferences, learned facts, important context
 * - Read: readLongTerm()
 * - Write: writeLongTerm()
 *
 * **Daily Notes**:
 * - Organized by month: workspace/memory/YYYYMM/YYYYMMDD.md
 * - Time-boxed working memory
 * - Use for: daily progress, transient notes
 * - Read: readToday(), getRecentDailyNotes()
 * - Append: appendToday()
 *
 * ## Directory Structure
 * ```
 * memoryDir = workspace/memory/
 * Long-term: memory/MEMORY.md
 * Daily notes: memory/YYYYMM/YYYYMMDD.md
 * ```
 */
export class MemoryStore {
	private readonly workspace: string;
	private readonly memoryDir: string;
	private readonly memoryFilePath: string;

	constructor(config: MemoryStoreConfig) {
		this.workspace = config.workspace;
		this.memoryDir = path.join(this.workspace, 'memory');
		this.memoryFilePath = path.join(this.workspace, config.memoryFile ?? DEFAULT_MEMORY_FILE);
	}

	/**
	 * Read long-term memory (MEMORY.md)
	 *
	 * @returns File contents, or empty string if file doesn't exist
	 * @throws I/O errors other than ENOENT
	 */
	async readLongTerm(): Promise<string> {
		try {
			return await fs.readFile(this.memoryFilePath, 'utf-8');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return '';
			}
			throw error;
		}
	}

	/**
	 * Write long-term memory (MEMORY.md) - ATOMIC
	 *
	 * Uses writeFileAtomic() to ensure:
	 * - No partial writes on crash
	 * - Original file preserved until complete
	 * - Data synced to physical storage
	 *
	 * @param content - New memory content (entire file replaced)
	 */
	async writeLongTerm(content: string): Promise<void> {
		await writeFileAtomic(this.memoryFilePath, content, 0o600);
	}

	/**
	 * Read today's daily note (YYYYMMDD.md)
	 *
	 * @returns File contents, or empty string if doesn't exist
	 * @throws I/O errors other than ENOENT
	 */
	async readToday(): Promise<string> {
		const todayPath = this.getTodayPath();
		try {
			return await fs.readFile(todayPath, 'utf-8');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return '';
			}
			throw error;
		}
	}

	/**
	 * Append to today's daily note - ATOMIC
	 *
	 * ## Behavior
	 * - If file exists: appends content with newline separator
	 * - If file doesn't exist: creates with date header (# YYYY-MM-DD)
	 *
	 * ## Date Header Format
	 * ```
	 * # YYYY-MM-DD
	 *
	 * [content]
	 * ```
	 *
	 * @param content - Content to append (no leading newline needed)
	 */
	async appendToday(content: string): Promise<void> {
		const todayPath = this.getTodayPath();
		const today = new Date();

		// Create month directory if needed (e.g., memory/202603/)
		const monthDir = path.join(this.memoryDir, this.getMonthDir(today));
		await fs.mkdir(monthDir, { recursive: true });

		try {
			// File exists - read and append
			const existing = await fs.readFile(todayPath, 'utf-8');
			const newContent = existing + '\n' + content;
			await writeFileAtomic(todayPath, newContent, 0o600);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				// File doesn't exist - create with date header
				const dateHeader = this.getDateHeader(today);
				const newContent = dateHeader + content;
				await writeFileAtomic(todayPath, newContent, 0o600);
			} else {
				throw error;
			}
		}
	}

	/**
	 * Get recent daily notes from last N days
	 *
	 * ## Context Optimization
	 * - Each day is one file read (expensive!)
	 * - Consider limiting days based on context budget
	 * - Empty files are skipped
	 * - Results joined with '\n\n---\n\n' separator
	 *
	 * @param days - Number of days to look back (default: 3)
	 * @returns Combined content of recent daily notes, oldest first
	 */
	async getRecentDailyNotes(days: number = 3): Promise<string> {
		const notes: string[] = [];
		const today = new Date();

		for (let i = 0; i < days; i++) {
			// Iterate from today backwards
			const date = new Date(today);
			date.setDate(date.getDate() - i);

			const notePath = this.getDailyNotePath(date);
			try {
				const content = await fs.readFile(notePath, 'utf-8');
				// Skip empty files
				if (content.trim()) {
					notes.push(content);
				}
			} catch (error) {
				// File doesn't exist for this day, skip silently
				if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
					throw error;
				}
			}
		}

		return notes.join('\n\n---\n\n');
	}

	/**
	 * Get formatted memory context for prompt injection
	 *
	 * ## Output Format
	 * ```
	 * ## Long-term Memory
	 *
	 * [long-term memory content]
	 *
	 * ---
	 *
	 * ## Recent Daily Notes
	 *
	 * [daily note 1]
	 *
	 * ---
	 *
	 * [daily note 2]
	 * ...
	 * ```
	 *
	 * ## Context Optimization
	 * - Result can be directly prepended to prompt
	 * - Empty sections are omitted
	 * - Token count before injecting
	 * - Consider using token-estimator on result
	 *
	 * @returns Formatted markdown string, or empty string if no memory
	 */
	async getMemoryContext(): Promise<string> {
		const longTerm = await this.readLongTerm();
		const recentNotes = await this.getRecentDailyNotes(3);

		const parts: string[] = [];

		// Long-term memory section (if non-empty)
		if (longTerm.trim()) {
			parts.push(`## Long-term Memory\n\n${longTerm}`);
		}

		// Recent daily notes section (if non-empty)
		if (recentNotes.trim()) {
			if (parts.length > 0) {
				parts.push('---\n');
			}
			parts.push(`## Recent Daily Notes\n\n${recentNotes}`);
		}

		return parts.join('\n\n');
	}

	/**
	 * Get path to today's daily note file
	 */
	private getTodayPath(): string {
		return this.getDailyNotePath(new Date());
	}

	/**
	 * Get path to a daily note file for a specific date
	 *
	 * @param date - Date for the daily note
	 * @returns Full path: memoryDir/YYYYMM/YYYYMMDD.md
	 */
	private getDailyNotePath(date: Date): string {
		const monthDir = this.getMonthDir(date);
		const filename = this.getDateFilename(date);
		return path.join(this.memoryDir, monthDir, filename);
	}

	/**
	 * Get month directory name (YYYYMM)
	 *
	 * Groups daily notes by month for easier navigation
	 */
	private getMonthDir(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		return `${year}${month}`;
	}

	/**
	 * Get date filename (YYYYMMDD.md)
	 *
	 * Flat naming in month directory avoids deep nesting
	 */
	private getDateFilename(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}${month}${day}.md`;
	}

	/**
	 * Get date header for daily note (# YYYY-MM-DD)
	 *
	 * Used when creating new daily note files
	 */
	private getDateHeader(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `# ${year}-${month}-${day}\n\n`;
	}
}
