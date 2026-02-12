/**
 * Session Manager - Session lifecycle management
 *
 * Manages agent sessions including creation, restoration, and cleanup.
 */

import type { AgentMessage, SessionState } from '../core/types';
import type { EventBus } from '../events/event-bus';

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session configuration
 */
export interface SessionConfig {
	/** Maximum messages per session */
	maxMessages: number;
	/** Maximum session age in ms */
	maxAge: number;
	/** Enable debug logging */
	debug: boolean;
}

/**
 * Default session configuration
 */
export const DEFAULT_SESSION_CONFIG: SessionConfig = {
	maxMessages: 100,
	maxAge: 3600000, // 1 hour
	debug: false
};

/**
 * Session data stored in manager
 */
export interface SessionData {
	/** Session state */
	state: SessionState;
	/** Messages */
	messages: AgentMessage[];
	/** Created at */
	createdAt: number;
	/** Last activity */
	lastActivity: number;
	/** Metadata */
	metadata: Record<string, unknown>;
}

/**
 * Session creation options
 */
export interface CreateSessionOptions {
	/** User ID */
	userId: string;
	/** Initial messages */
	initialMessages?: AgentMessage[];
	/** Metadata */
	metadata?: Record<string, unknown>;
}

// ============================================================================
// Session Manager
// ============================================================================

/**
 * Session Manager - Manages agent sessions
 */
export class SessionManager {
	private sessions: Map<string, SessionData> = new Map();
	private config: SessionConfig;
	private eventBus?: EventBus;
	private cleanupInterval?: ReturnType<typeof setInterval>;

	constructor(config: Partial<SessionConfig> = {}, eventBus?: EventBus) {
		this.config = { ...DEFAULT_SESSION_CONFIG, ...config };
		this.eventBus = eventBus;

		// Start periodic cleanup
		this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
	}

	/**
	 * Create a new session
	 */
	create(options: CreateSessionOptions): SessionData {
		const sessionId = this.generateSessionId();
		const runId = this.generateRunId();
		const now = Date.now();

		const state: SessionState = {
			sessionId,
			userId: options.userId,
			runId,
			createdAt: now,
			updatedAt: now,
			messageCount: options.initialMessages?.length ?? 0,
			lastActivity: now,
			isActive: true
		};

		const session: SessionData = {
			state,
			messages: options.initialMessages ?? [],
			createdAt: now,
			lastActivity: now,
			metadata: options.metadata ?? {}
		};

		this.sessions.set(sessionId, session);

		if (this.config.debug) {
			console.log(`[SessionManager] Created session: ${sessionId}`);
		}

		// Emit event
		if (this.eventBus) {
			// Event emission would happen here
		}

		return session;
	}

	/**
	 * Get a session by ID
	 */
	get(sessionId: string): SessionData | undefined {
		return this.sessions.get(sessionId);
	}

	/**
	 * Get session state
	 */
	getState(sessionId: string): SessionState | undefined {
		return this.sessions.get(sessionId)?.state;
	}

	/**
	 * Get session messages
	 */
	getMessages(sessionId: string): AgentMessage[] {
		const session = this.sessions.get(sessionId);
		return session ? [...session.messages] : [];
	}

	/**
	 * Add a message to a session
	 */
	addMessage(sessionId: string, message: AgentMessage): boolean {
		const session = this.sessions.get(sessionId);
		if (!session) return false;

		// Check max messages
		if (session.messages.length >= this.config.maxMessages) {
			// Remove oldest non-system messages
			this.pruneMessages(session);
		}

		session.messages.push(message);
		session.state.messageCount = session.messages.length;
		session.state.updatedAt = Date.now();
		session.lastActivity = Date.now();
		session.state.lastActivity = Date.now();

		if (this.config.debug) {
			console.log(`[SessionManager] Added message to ${sessionId}: ${session.messages.length} total`);
		}

		return true;
	}

	/**
	 * Update session state
	 */
	updateState(sessionId: string, updates: Partial<SessionState>): boolean {
		const session = this.sessions.get(sessionId);
		if (!session) return false;

		session.state = {
			...session.state,
			...updates,
			updatedAt: Date.now()
		};
		session.lastActivity = Date.now();

		return true;
	}

	/**
	 * Update session metadata
	 */
	updateMetadata(sessionId: string, metadata: Record<string, unknown>): boolean {
		const session = this.sessions.get(sessionId);
		if (!session) return false;

		session.metadata = {
			...session.metadata,
			...metadata
		};
		session.lastActivity = Date.now();

		return true;
	}

	/**
	 * Check if session exists and is active
	 */
	isActive(sessionId: string): boolean {
		const session = this.sessions.get(sessionId);
		return session?.state.isActive ?? false;
	}

	/**
	 * Activate a session
	 */
	activate(sessionId: string): boolean {
		return this.updateState(sessionId, { isActive: true });
	}

	/**
	 * Deactivate a session
	 */
	deactivate(sessionId: string): boolean {
		return this.updateState(sessionId, { isActive: false });
	}

	/**
	 * Delete a session
	 */
	delete(sessionId: string): boolean {
		const result = this.sessions.delete(sessionId);

		if (result && this.config.debug) {
			console.log(`[SessionManager] Deleted session: ${sessionId}`);
		}

		return result;
	}

	/**
	 * Get all sessions for a user
	 */
	getByUser(userId: string): SessionData[] {
		return Array.from(this.sessions.values())
			.filter(s => s.state.userId === userId);
	}

	/**
	 * Get active sessions count
	 */
	getActiveCount(): number {
		return Array.from(this.sessions.values())
			.filter(s => s.state.isActive)
			.length;
	}

	/**
	 * Get total sessions count
	 */
	getTotalCount(): number {
		return this.sessions.size;
	}

	/**
	 * Clear all sessions
	 */
	clear(): void {
		this.sessions.clear();

		if (this.config.debug) {
			console.log(`[SessionManager] Cleared all sessions`);
		}
	}

	/**
	 * Dispose of the session manager
	 */
	dispose(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}
		this.sessions.clear();
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private generateSessionId(): string {
		return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	private generateRunId(): string {
		return `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	private pruneMessages(session: SessionData): void {
		// Keep system messages and last N messages
		const keepCount = Math.floor(this.config.maxMessages * 0.8);
		const systemMessages = session.messages.filter(m => m.role === 'system');
		const otherMessages = session.messages.filter(m => m.role !== 'system');

		// Keep most recent messages
		const keptOther = otherMessages.slice(-keepCount + systemMessages.length);

		session.messages = [...systemMessages, ...keptOther];

		if (this.config.debug) {
			console.log(`[SessionManager] Pruned messages: ${session.messages.length} remaining`);
		}
	}

	private cleanup(): void {
		const now = Date.now();
		const expired: string[] = [];

		for (const [sessionId, session] of this.sessions) {
			// Check age
			if (now - session.lastActivity > this.config.maxAge) {
				expired.push(sessionId);
			}
		}

		for (const sessionId of expired) {
			this.sessions.delete(sessionId);

			if (this.config.debug) {
				console.log(`[SessionManager] Cleaned up expired session: ${sessionId}`);
			}
		}
	}
}

/**
 * Create a session manager
 */
export function createSessionManager(config?: Partial<SessionConfig>, eventBus?: EventBus): SessionManager {
	return new SessionManager(config, eventBus);
}
