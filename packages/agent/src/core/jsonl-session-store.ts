/**
 * JSONL Session Store - Persistent Session Management
 *
 * ## Purpose
 * Provides durable session storage for multi-turn AI conversations.
 * Sessions persist across server restarts and enable:
 * - Long-running conversations with context continuity
 * - User identity tracking across requests
 * - Conversation history preservation
 * - Graceful recovery from crashes
 *
 * ## Key Concepts
 *
 * **Session Persistence Pattern**:
 * - Sessions stored as individual JSON files in storageDir
 * - Each session is one file (simpler than JSONL for this use case)
 * - Atomic writes prevent corruption on crashes
 * - Auto-save on create/update (default behavior)
 *
 * **Atomic Writes for Sessions**:
 * - Sessions contain conversation state
 * - Corruption = lost conversation history
 * - Uses writeFileAtomic() for safety
 * - 0o600 permissions protect session data
 *
 * **In-Memory + Disk Hybrid**:
 * - Sessions loaded into memory on initialize()
 * - Disk is source of truth
 * - Enables fast in-memory lookups
 * - Graceful handling of disk failures
 *
 * **Auto-Save Behavior**:
 * - Default: save immediately on create/update
 * - Can be disabled for batch operations
 * - Call saveAll() manually when autoSave=false
 *
 * ## Directory Structure
 * ```
 * storageDir/
 * ├── sess_abc123.json      # Individual session files
 * ├── sess_def456.json
 * └── ...
 * ```
 *
 * ## Session Schema
 * ```typescript
 * interface Session {
 *   id: string;              // Unique session ID
 *   userId: string;           // Associated user
 *   config: AgentConfig;      // Agent configuration
 *   messages: AgentMessage[]; // Conversation history
 *   turns: Turn[];            // Turn metadata
 *   metadata: Record<string, unknown>;
 *   createdAt: number;        // Unix timestamp
 *   updatedAt: number;        // Unix timestamp
 *   expiresAt?: number;       // TTL expiration
 * }
 * ```
 *
 * ## Safety Guarantees
 *
 * **Corruption Prevention**:
 * - writeFileAtomic() for all writes
 * - Temp file + rename + fsync pattern
 * - Original file untouched until complete
 *
 * **Initialization Safety**:
 * - Skips corrupted JSON files (doesn't crash)
 * - Missing files handled gracefully
 * - Creates directory with 0o700 permissions
 *
 * **Permission Security**:
 * - 0o600 on all session files
 * - 0o700 on storage directory
 * - Prevents unauthorized session access
 *
 * **Error Handling**:
 * - initialize() catches disk read errors
 * - Failed loads are skipped (not fatal)
 * - Write failures propagate
 *
 * ## Usage Pattern
 *
 * ```typescript
 * const store = new JSONLSessionStore({
 *   storageDir: './sessions',
 *   autoSave: true  // default
 * });
 *
 * // Initialize (load existing sessions from disk)
 * await store.initialize();
 *
 * // Create new session
 * const session = await store.create({
 *   userId: 'user-123',
 *   agentConfig: { ... }
 * });
 *
 * // Update session (auto-saved)
 * session.messages.push(newMessage);
 * await store.update(session);
 *
 * // Get session
 * const existing = await store.get(session.id);
 *
 * // Delete session
 * await store.delete(session.id);
 *
 * // On shutdown
 * await store.close();  // Saves all sessions
 * ```
 *
 * ## Context Optimization
 *
 * **Session Size Management**:
 * - Long conversations grow large
 * - Consider compressing older messages
 * - Token-estimate before sending to LLM
 *
 * **Storage Efficiency**:
 * - One file per session (simple but not sparse)
 * - Large sessions may be slow to read/write
 * - Consider session archival for inactive sessions
 *
 * **Memory Efficiency**:
 * - All sessions loaded into memory on init
 * - For many users, consider lazy loading
 * - Current design suits single-tenant or few users
 *
 * ## Security Considerations
 *
 * **Data at Rest**:
 * - Session files contain conversation history
 * - May include sensitive user data
 * - 0o600 prevents other users reading
 *
 * **Key Sanitization**:
 * - Session IDs sanitized for filename use
 * - Colons, slashes, backslashes → underscores
 * - Double dots → single underscore
 * - Prevents path traversal attacks
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

import type { Session, SessionConfig, SessionStore } from '../types/index.js';
import { writeFileAtomic } from './file-util.js';

/**
 * Configuration for JSONLSessionStore
 */
export interface JSONLSessionStoreConfig {
	/** Directory for session files */
	storageDir: string;
	/** Auto-save sessions on create/update (default: true) */
	autoSave?: boolean;
}

/**
 * Sanitize a session key for use as a filename.
 *
 * ## Sanitization Rules
 * - Colons (:) → underscores (_)
 * - Slashes (/ and \) → underscores (_)
 * - Double dots (..) → single underscore (_)
 *
 * ## Why Sanitize?
 * - Session IDs may contain special characters
 * - Prevents path traversal (../../../etc/passwd)
 * - Ensures valid filenames across OSes
 *
 * @param key - Session key (typically session.id)
 * @returns Sanitized string safe for use as filename
 */
function sanitizeKey(key: string): string {
	return key.replace(/[:/\\]/g, '_').replace(/\.\./g, '_');
}

/**
 * JSONL-backed session store implementation.
 *
 * ## Design Decisions
 *
 * **JSON over JSONL**:
 * - Each session is one JSON file (not append-only JSONL)
 * - Simpler for session update patterns (full rewrite)
 * - Enables random access to any session
 *
 * **In-Memory Map**:
 * - Fast lookups without disk I/O
 * - Disk is backup/persistence only
 * - Write-through: update memory, then disk
 *
 * **autoSave Default**:
 * - True by default (safer default)
 * - Can disable for batch updates
 * - Always close() to ensure final save
 *
 * ## Limitations
 *
 * **Not Multi-Tenant Scalable**:
 * - All sessions loaded into memory
 * - Single storageDir (no sharding)
 * - Suits single-tenant or small deployments
 *
 * **No Built-in Archival**:
 * - Old sessions stay on disk
 * - Consider cleanup job for expired sessions
 * - No compression built-in
 */
export class JSONLSessionStore implements SessionStore {
	private readonly storageDir: string;
	private readonly autoSave: boolean;
	private sessions: Map<string, Session> = new Map();
	private initialized = false;

	constructor(config: JSONLSessionStoreConfig) {
		this.storageDir = config.storageDir;
		this.autoSave = config.autoSave ?? true;
	}

	/**
	 * Initialize the store by loading existing sessions from disk.
	 *
	 * ## Behavior
	 * 1. Creates storage directory with 0o700 permissions
	 * 2. Scans for .json files
	 * 3. Loads and parses each file
	 * 4. Validates required fields (id, createdAt, updatedAt)
	 * 5. Skips corrupted files (logs warning)
	 *
	 * ## Idempotent
	 * - Safe to call multiple times
	 * - Returns early if already initialized
	 *
	 * ## Error Handling
	 * - Corrupted JSON files are skipped
	 * - Missing files are handled
	 * - Disk errors during init propagate
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		// Create storage directory with secure permissions (0o700)
		// 0o700 = rwx------ (owner only) - protects session files
		await fs.mkdir(this.storageDir, { recursive: true, mode: 0o700 });

		// Scan directory for session files
		const entries = await fs.readdir(this.storageDir, { withFileTypes: true });
		const jsonFiles = entries
			.filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
			.map((entry) => entry.name);

		// Load each session into memory
		for (const filename of jsonFiles) {
			const filePath = path.join(this.storageDir, filename);
			try {
				const content = await fs.readFile(filePath, { encoding: 'utf-8' });
				const session = JSON.parse(content) as Session;

				// Validate required fields exist
				// Skip files that are corrupted or incomplete
				if (session.id && session.createdAt && session.updatedAt) {
					this.sessions.set(session.id, session);
				}
			} catch (error) {
				// Skip corrupted files - don't crash initialization
				// Log for admin awareness
				console.warn(`Failed to load session from ${filename}:`, error);
			}
		}

		this.initialized = true;
	}

	/**
	 * Get a session by key
	 *
	 * @param key - Session ID
	 * @returns Session if found, null otherwise
	 */
	async get(key: string): Promise<Session | null> {
		return this.sessions.get(key) ?? null;
	}

	/**
	 * Create a new session
	 *
	 * ## Behavior
	 * - Generates unique session ID with "sess_" prefix
	 * - Initializes with empty messages and turns
	 * - Auto-saves if autoSave enabled (default)
	 *
	 * @param config - Session configuration
	 * @returns Newly created session
	 */
	async create(config: SessionConfig): Promise<Session> {
		// Check if user already has a session (return existing)
		const existing = Array.from(this.sessions.values()).find((s) => s.userId === config.userId);
		if (existing) {
			return existing;
		}

		const now = Date.now();
		const session: Session = {
			id: `sess_${randomBytes(12).toString('hex')}`,
			userId: config.userId ?? '',
			config: (config.agentConfig as Session['config']) ?? {
				id: 'default',
				providers: [],
				primaryProvider: '',
				cooldown: { enabled: false, defaultDurationMs: 0, maxRetries: 0 }
			},
			messages: config.initialMessages ?? [],
			turns: [],
			metadata: config.metadata ?? {},
			createdAt: now,
			updatedAt: now,
			expiresAt: config.ttl ? now + config.ttl : undefined
		};

		this.sessions.set(session.id, session);

		if (this.autoSave) {
			await this.saveSession(session);
		}

		return session;
	}

	/**
	 * Update session fields
	 *
	 * ## Behavior
	 * - Updates updatedAt timestamp
	 * - Auto-saves if autoSave enabled (default)
	 *
	 * @param session - Session to update (must have existing id)
	 * @throws Error if session not found
	 */
	async update(session: Session): Promise<void> {
		const existing = this.sessions.get(session.id);
		if (!existing) {
			throw new Error(`Session not found: ${session.id}`);
		}

		const updated: Session = {
			...session,
			updatedAt: Date.now()
		};

		this.sessions.set(session.id, updated);

		if (this.autoSave) {
			await this.saveSession(updated);
		}
	}

	/**
	 * Delete a session
	 *
	 * ## Behavior
	 * - Removes from in-memory map
	 * - Deletes file from disk
	 * - Ignores ENOENT on disk delete (already gone)
	 *
	 * @param key - Session ID to delete
	 */
	async delete(key: string): Promise<void> {
		this.sessions.delete(key);

		// Delete file from disk
		const sanitized = sanitizeKey(key);
		const filePath = path.join(this.storageDir, `${sanitized}.json`);
		try {
			await fs.unlink(filePath);
		} catch (error) {
			// Ignore if file doesn't exist (already deleted)
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw error;
			}
		}
	}

	/**
	 * List sessions by user
	 *
	 * @param userId - User ID to filter by
	 * @param limit - Optional limit on results
	 * @returns Sessions sorted by updatedAt (newest first)
	 */
	async list(userId: string, limit?: number): Promise<Session[]> {
		const userSessions = Array.from(this.sessions.values())
			.filter((s) => s.userId === userId)
			.sort((a, b) => b.updatedAt - a.updatedAt);

		if (limit !== undefined && limit > 0) {
			return userSessions.slice(0, limit);
		}

		return userSessions;
	}

	/**
	 * Check if session exists
	 */
	async exists(key: string): Promise<boolean> {
		return this.sessions.has(key);
	}

	/**
	 * Save all sessions to disk
	 *
	 * Useful when autoSave is disabled for batch operations.
	 * Saves all sessions in parallel.
	 */
	async saveAll(): Promise<void> {
		const promises = Array.from(this.sessions.values()).map((session) => this.saveSession(session));
		await Promise.all(promises);
	}

	/**
	 * Close and save all sessions
	 *
	 * Call this on server shutdown to ensure all
	 * in-memory sessions are persisted.
	 */
	async close(): Promise<void> {
		await this.saveAll();
	}

	/**
	 * Save a single session to disk using atomic write
	 *
	 * ## Safety
	 * - Uses writeFileAtomic for crash safety
	 * - 0o600 permissions protect session data
	 * - JSON.stringify with spacing for readability
	 *
	 * @param session - Session to persist
	 */
	private async saveSession(session: Session): Promise<void> {
		const sanitized = sanitizeKey(session.id);
		const filePath = path.join(this.storageDir, `${sanitized}.json`);
		const content = JSON.stringify(session, null, 2);
		await writeFileAtomic(filePath, content, 0o600);
	}
}
