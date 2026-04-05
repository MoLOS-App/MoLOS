/**
 * Session Management - Handles session state and storage
 *
 * ## Purpose
 * Manages conversation sessions which track:
 * - Message history for a conversation
 * - Session metadata (user ID, agent config, etc.)
 * - Session lifecycle (creation, update, deletion)
 * - Optional persistence to disk
 *
 * ## Session Store Types
 *
 * ### InMemorySessionStore
 * - Full-featured session store with persistence support
 * - Auto-save capability when persistPath is configured
 * - Optional max history size limit
 * - Session lookup by key
 *
 * ### EphemeralSessionStore
 * - Lightweight, non-persistent store for subagents
 * - Fixed max history size (50 messages)
 * - Auto-truncation when history exceeds limit
 * - No persistence - sessions are temporary
 *
 * ## Key Concepts
 *
 * ### Session vs Turn Distinction
 * - **Session**: Represents an entire conversation (spans multiple turns)
 *   - Has a unique key (e.g., session ID)
 *   - Contains full message history
 *   - Can persist to disk
 * - **Turn**: Represents a single user message and its response
 *   - Created by TurnManager
 *   - Part of a session's history
 *
 * ### History Sanitization
 * Session history is sanitized before use:
 * - System messages are removed (context builder adds its own)
 * - Orphaned tool results are removed
 * - Duplicate tool results are deduplicated
 *
 * ## Usage Pattern
 * ```typescript
 * // Create session store
 * const store = createSessionStore({ autoSave: true, persistPath: './sessions' });
 *
 * // Create a session
 * const session = store.create('user-123', { userId: 'user-123' });
 *
 * // Add messages
 * store.addMessage('user-123', { role: 'user', content: 'Hello' });
 *
 * // Get history
 * const history = store.getHistory('user-123');
 *
 * // Update session
 * store.update('user-123', { summary: 'User greeted the AI' });
 *
 * // Truncate if too long
 * store.truncateHistory('user-123', 100);
 * ```
 *
 * ## AI Context Optimization
 * - History truncation keeps only recent messages (reduces token count)
 * - Ephemeral stores auto-truncate at 50 messages
 * - In-memory stores optionally enforce maxHistorySize
 * - Session keys enable parallel conversation tracking
 */

import type { AgentMessage } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Session state persisted by SessionStore
 */
export interface Session {
	key: string;
	messages: AgentMessage[];
	summary: string;
	createdAt: number;
	updatedAt: number;
	metadata?: Record<string, unknown>;
}

/**
 * Configuration for creating a session
 */
export interface SessionConfig {
	userId?: string;
	agentConfig?: Record<string, unknown>;
	systemPrompt?: string;
	initialMessages?: AgentMessage[];
	metadata?: Record<string, unknown>;
	ttl?: number;
}

/**
 * Configuration for SessionStore
 */
export interface SessionStoreConfig {
	persistPath?: string;
	autoSave?: boolean;
	maxHistorySize?: number;
}

/**
 * Session store interface for persistence
 */
export interface SessionStore {
	/**
	 * Get a session by key
	 */
	get(key: string): Session | undefined;

	/**
	 * Create a new session
	 */
	create(key: string, metadata?: Record<string, unknown>): Session;

	/**
	 * Update session fields
	 */
	update(key: string, updates: Partial<Session>): void;

	/**
	 * Delete a session
	 */
	delete(key: string): void;

	/**
	 * Add a message to the session
	 */
	addMessage(key: string, message: AgentMessage): void;

	/**
	 * Get session history
	 */
	getHistory(key: string, limit?: number): AgentMessage[];

	/**
	 * Set full history
	 */
	setHistory(key: string, messages: AgentMessage[]): void;

	/**
	 * Truncate history to keep only last N messages
	 */
	truncateHistory(key: string, keepLast: number): void;

	/**
	 * Save session to persistence (no-op for in-memory store)
	 */
	save(key: string): Promise<void>;

	/**
	 * Save all sessions to persistence (no-op for in-memory store)
	 */
	saveAll(): Promise<void>;
}

// =============================================================================
// In-Memory Session Store
// =============================================================================

/**
 * In-memory session store implementation with introspection
 *
 * ## Features
 * - Session CRUD operations (create, read, update, delete)
 * - Message history management with add/truncate/getHistory
 * - Optional persistence to disk via persistPath
 * - Optional max history size limit
 * - Auto-save after updates when persistPath is set
 *
 * ## Persistence Model
 * - Subclasses can override `persistSession()` and `loadSession()` for custom persistence
 * - Auto-save is triggered after `update()` if `autoSave: true` and `persistPath` is set
 * - Base class is no-op for persistence (just resolves immediately)
 *
 * ## Thread Safety Note
 * This class is not thread-safe for concurrent modifications.
 * For concurrent access, wrap with appropriate synchronization.
 */
export class InMemorySessionStore implements SessionStore {
	private sessions: Map<string, Session> = new Map();
	private readonly persistPath?: string;
	private readonly autoSave: boolean;
	private readonly maxHistorySize?: number;

	constructor(config?: SessionStoreConfig) {
		this.persistPath = config?.persistPath;
		this.autoSave = config?.autoSave ?? true;
		this.maxHistorySize = config?.maxHistorySize;
	}

	get(key: string): Session | undefined {
		return this.sessions.get(key);
	}

	create(key: string, metadata?: Record<string, unknown>): Session {
		const existing = this.sessions.get(key);
		if (existing) {
			return existing;
		}

		const now = Date.now();
		const session: Session = {
			key,
			messages: [],
			summary: '',
			createdAt: now,
			updatedAt: now,
			metadata
		};
		this.sessions.set(key, session);
		return session;
	}

	update(key: string, updates: Partial<Session>): void {
		const session = this.sessions.get(key);
		if (!session) {
			return;
		}

		const updated: Session = {
			...session,
			...updates,
			updatedAt: Date.now()
		};
		this.sessions.set(key, updated);

		if (this.autoSave && this.persistPath) {
			this.persistSession(key).catch((err) => {
				console.error(`Failed to persist session ${key}:`, err);
			});
		}
	}

	delete(key: string): void {
		this.sessions.delete(key);
	}

	addMessage(key: string, message: AgentMessage): void {
		const session = this.sessions.get(key);
		if (!session) {
			return;
		}

		session.messages.push(message);
		session.updatedAt = Date.now();

		// Enforce max history size
		if (this.maxHistorySize && session.messages.length > this.maxHistorySize) {
			session.messages = session.messages.slice(-this.maxHistorySize);
		}
	}

	getHistory(key: string, limit?: number): AgentMessage[] {
		const session = this.sessions.get(key);
		if (!session) {
			return [];
		}

		if (limit !== undefined && limit > 0) {
			return session.messages.slice(-limit);
		}
		return [...session.messages];
	}

	setHistory(key: string, messages: AgentMessage[]): void {
		const session = this.sessions.get(key);
		if (!session) {
			return;
		}

		session.messages = [...messages];
		session.updatedAt = Date.now();
	}

	truncateHistory(key: string, keepLast: number): void {
		const session = this.sessions.get(key);
		if (!session) {
			return;
		}

		if (keepLast <= 0) {
			session.messages = [];
		} else if (keepLast < session.messages.length) {
			session.messages = session.messages.slice(-keepLast);
		}
		session.updatedAt = Date.now();
	}

	async save(_key: string): Promise<void> {
		// No-op for basic in-memory store - subclasses can override for persistence
		return Promise.resolve();
	}

	async saveAll(): Promise<void> {
		// No-op for basic in-memory store - subclasses can override for persistence
		return Promise.resolve();
	}

	/**
	 * Get all session keys
	 */
	getAllKeys(): string[] {
		return Array.from(this.sessions.keys());
	}

	/**
	 * Get statistics about the session store
	 */
	getStats(): { sessionCount: number; totalMessages: number } {
		let totalMessages = 0;
		for (const session of this.sessions.values()) {
			totalMessages += session.messages.length;
		}
		return {
			sessionCount: this.sessions.size,
			totalMessages
		};
	}

	/**
	 * Persist a session to disk (can be overridden by subclasses)
	 */
	protected async persistSession(_key: string): Promise<void> {
		// Subclasses can override this to implement persistence
	}

	/**
	 * Load a session from disk (can be overridden by subclasses)
	 */
	protected async loadSession(_key: string): Promise<Session | undefined> {
		// Subclasses can override this to implement persistence
		return undefined;
	}
}

// =============================================================================
// Ephemeral Session Store (for SubAgents)
// =============================================================================

/**
 * Maximum messages in ephemeral session history
 */
export const MAX_EPHEMERAL_HISTORY = 50;

/**
 * Ephemeral in-memory session store for subagents.
 *
 * ## Purpose
 * Lightweight session store designed for short-lived subagent contexts:
 * - **No persistence**: Sessions are purely in-memory
 * - **Auto-truncation**: History capped at 50 messages (MAX_EPHEMERAL_HISTORY)
 * - **Single session**: Unlike InMemorySessionStore, operates on one implicit session
 *
 * ## Use Cases
 * - Subagent turn execution where only recent context matters
 * - Temporary contexts that don't need to persist
 * - Streaming scenarios where context window is limited
 *
 * ## Key Behavior Differences from InMemorySessionStore
 * | Feature | Ephemeral | InMemory |
 * |---------|-----------|----------|
 * | Persistence | None | Optional (via subclass) |
 * | Session keys | Ignored (single session) | Full support |
 * | Max history | Fixed (50) | Optional (configurable) |
 * | Metadata | Ignored | Stored |
 *
 * ## AI Context Optimization
 * - Hard cap of 50 messages limits context size for subagents
 * - Oldest messages are dropped when limit is reached
 * - No disk I/O overhead for ephemeral operations
 * - Suitable for fire-and-forget subagent patterns
 */
export class EphemeralSessionStore implements SessionStore {
	private history: AgentMessage[] = [];
	private summary: string = '';
	private createdAt: number;

	constructor(initialHistory?: AgentMessage[]) {
		this.createdAt = Date.now();
		if (initialHistory && initialHistory.length > 0) {
			this.history = [...initialHistory];
			// Apply truncation if initial history exceeds limit
			if (this.history.length > MAX_EPHEMERAL_HISTORY) {
				this.history = this.history.slice(-MAX_EPHEMERAL_HISTORY);
			}
		}
	}

	get(key: string): Session | undefined {
		return {
			key,
			messages: this.history,
			summary: this.summary,
			createdAt: this.createdAt,
			updatedAt: Date.now()
		};
	}

	create(key: string, _metadata?: Record<string, unknown>): Session {
		return this.get(key)!;
	}

	update(key: string, updates: Partial<Session>): void {
		if (updates.summary !== undefined) {
			this.summary = updates.summary;
		}
		// Ephemeral stores don't persist metadata
	}

	delete(_key: string): void {
		this.history = [];
		this.summary = '';
	}

	addMessage(_key: string, message: AgentMessage): void {
		this.history.push(message);
		this.truncate();
	}

	getHistory(_key: string, limit?: number): AgentMessage[] {
		if (limit !== undefined && limit > 0) {
			return this.history.slice(-limit);
		}
		return [...this.history];
	}

	setHistory(_key: string, messages: AgentMessage[]): void {
		this.history = [...messages];
		this.truncate();
	}

	truncateHistory(_key: string, keepLast: number): void {
		if (keepLast <= 0) {
			this.history = [];
			return;
		}
		if (keepLast < this.history.length) {
			this.history = this.history.slice(-keepLast);
		}
	}

	/**
	 * No-op for ephemeral stores - they don't persist
	 */
	save(_key: string): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * No-op for ephemeral stores - they don't persist
	 */
	saveAll(): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * Get the current history length
	 */
	getHistoryLength(): number {
		return this.history.length;
	}

	/**
	 * Auto-truncate history to MAX_EPHEMERAL_HISTORY
	 */
	private truncate(): void {
		if (this.history.length > MAX_EPHEMERAL_HISTORY) {
			this.history = this.history.slice(-MAX_EPHEMERAL_HISTORY);
		}
	}
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new in-memory session store
 */
export function createSessionStore(config?: SessionStoreConfig): SessionStore {
	return new InMemorySessionStore(config);
}

/**
 * Create a new ephemeral session store for subagents
 */
export function createEphemeralSessionStore(
	initialHistory?: AgentMessage[]
): EphemeralSessionStore {
	return new EphemeralSessionStore(initialHistory);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format session for logging
 */
export function formatSession(session: Session): string {
	return `[Session ${session.key}] ${session.messages.length} messages, updated ${new Date(session.updatedAt).toISOString()}`;
}

/**
 * Check if session is stale (not updated in given ms)
 */
export function isSessionStale(session: Session, maxAgeMs: number): boolean {
	return Date.now() - session.updatedAt > maxAgeMs;
}

/**
 * Sanitize history by removing orphaned tool messages and duplicates
 */
export function sanitizeHistory(messages: AgentMessage[]): AgentMessage[] {
	if (messages.length === 0) {
		return messages;
	}

	const sanitized: AgentMessage[] = [];
	const seenToolCallIds = new Set<string>();

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];
		if (!msg) continue;

		switch (msg.role) {
			case 'system':
				// Drop system messages from history (context builder creates its own)
				continue;

			case 'tool':
				// Skip if no preceding assistant message with tool calls
				if (sanitized.length === 0) {
					continue;
				}

				// Find preceding assistant with matching tool call
				let foundAssistant = false;
				for (let j = sanitized.length - 1; j >= 0; j--) {
					const prevMsg = sanitized[j];
					if (!prevMsg) continue;
					if (prevMsg.role === 'tool') {
						continue;
					}
					if (prevMsg.role === 'assistant') {
						const content = prevMsg.content;
						if (Array.isArray(content)) {
							for (const block of content) {
								// Support both 'tool-call' (AI SDK) and 'tool_call' (legacy) formats
								if (
									block &&
									typeof block === 'object' &&
									((block as any).type === 'tool_call' || (block as any).type === 'tool-call')
								) {
									foundAssistant = true;
									break;
								}
							}
						}
					}
					break;
				}
				if (!foundAssistant) {
					continue;
				}

				// Skip duplicate tool results
				if (msg.toolCallId && seenToolCallIds.has(msg.toolCallId)) {
					continue;
				}
				if (msg.toolCallId) {
					seenToolCallIds.add(msg.toolCallId);
				}
				sanitized.push(msg);
				break;

			case 'assistant':
				sanitized.push(msg);
				break;

			default:
				sanitized.push(msg);
		}
	}

	return sanitized;
}
