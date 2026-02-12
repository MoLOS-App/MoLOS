/**
 * Conversation Store - Persistence layer for conversations
 *
 * Provides an interface for persisting and retrieving conversation history.
 * Includes in-memory implementation and interface for database backends.
 */

import type { AgentMessage, ExecutionPlan, Thought, Observation } from '../core/types';
import type { SessionData } from './session-manager';

// ============================================================================
// Store Types
// ============================================================================

/**
 * Stored conversation
 */
export interface StoredConversation {
	/** Conversation ID */
	id: string;
	/** Session ID */
	sessionId: string;
	/** User ID */
	userId: string;
	/** Messages */
	messages: AgentMessage[];
	/** Execution plan (if any) */
	plan?: ExecutionPlan;
	/** Thoughts history */
	thoughts?: Thought[];
	/** Observations history */
	observations?: Observation[];
	/** Created at */
	createdAt: number;
	/** Updated at */
	updatedAt: number;
	/** Metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Conversation query options
 */
export interface ConversationQuery {
	/** Filter by user ID */
	userId?: string;
	/** Filter by session ID */
	sessionId?: string;
	/** Limit results */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
	/** Order by field */
	orderBy?: 'createdAt' | 'updatedAt';
	/** Order direction */
	orderDirection?: 'asc' | 'desc';
}

/**
 * Store configuration
 */
export interface ConversationStoreConfig {
	/** Enable debug logging */
	debug?: boolean;
	/** Maximum conversations in memory */
	maxInMemory?: number;
}

// ============================================================================
// Store Interface
// ============================================================================

/**
 * Conversation Store Interface
 */
export interface IConversationStore {
	/** Save a conversation */
	save(conversation: StoredConversation): Promise<void>;

	/** Get a conversation by ID */
	get(id: string): Promise<StoredConversation | null>;

	/** Get conversations by session */
	getBySession(sessionId: string): Promise<StoredConversation[]>;

	/** Get conversations by user */
	getByUser(userId: string, query?: ConversationQuery): Promise<StoredConversation[]>;

	/** Delete a conversation */
	delete(id: string): Promise<boolean>;

	/** Delete all conversations for a session */
	deleteBySession(sessionId: string): Promise<number>;

	/** Query conversations */
	query(query: ConversationQuery): Promise<StoredConversation[]>;

	/** Get count */
	count(query?: ConversationQuery): Promise<number>;
}

// ============================================================================
// In-Memory Store
// ============================================================================

/**
 * In-Memory Conversation Store
 */
export class InMemoryConversationStore implements IConversationStore {
	private conversations: Map<string, StoredConversation> = new Map();
	private config: Required<ConversationStoreConfig>;

	constructor(config: ConversationStoreConfig = {}) {
		this.config = {
			debug: config.debug ?? false,
			maxInMemory: config.maxInMemory ?? 1000
		};
	}

	async save(conversation: StoredConversation): Promise<void> {
		// Enforce max size
		if (this.conversations.size >= this.config.maxInMemory) {
			this.evictOldest();
		}

		this.conversations.set(conversation.id, {
			...conversation,
			updatedAt: Date.now()
		});

		if (this.config.debug) {
			console.log(`[ConversationStore] Saved: ${conversation.id}`);
		}
	}

	async get(id: string): Promise<StoredConversation | null> {
		return this.conversations.get(id) ?? null;
	}

	async getBySession(sessionId: string): Promise<StoredConversation[]> {
		return Array.from(this.conversations.values())
			.filter(c => c.sessionId === sessionId);
	}

	async getByUser(userId: string, query?: ConversationQuery): Promise<StoredConversation[]> {
		let results = Array.from(this.conversations.values())
			.filter(c => c.userId === userId);

		if (query?.orderBy) {
			results.sort((a, b) => {
				const aVal = a[query.orderBy!];
				const bVal = b[query.orderBy!];
				const dir = query.orderDirection === 'desc' ? -1 : 1;
				return (aVal - bVal) * dir;
			});
		}

		if (query?.offset) {
			results = results.slice(query.offset);
		}

		if (query?.limit) {
			results = results.slice(0, query.limit);
		}

		return results;
	}

	async delete(id: string): Promise<boolean> {
		return this.conversations.delete(id);
	}

	async deleteBySession(sessionId: string): Promise<number> {
		let count = 0;

		for (const [id, conv] of this.conversations) {
			if (conv.sessionId === sessionId) {
				this.conversations.delete(id);
				count++;
			}
		}

		return count;
	}

	async query(query: ConversationQuery): Promise<StoredConversation[]> {
		let results = Array.from(this.conversations.values());

		if (query.userId) {
			results = results.filter(c => c.userId === query.userId);
		}

		if (query.sessionId) {
			results = results.filter(c => c.sessionId === query.sessionId);
		}

		if (query.orderBy) {
			results.sort((a, b) => {
				const aVal = a[query.orderBy!];
				const bVal = b[query.orderBy!];
				const dir = query.orderDirection === 'desc' ? -1 : 1;
				return (aVal - bVal) * dir;
			});
		}

		if (query.offset) {
			results = results.slice(query.offset);
		}

		if (query.limit) {
			results = results.slice(0, query.limit);
		}

		return results;
	}

	async count(query?: ConversationQuery): Promise<number> {
		if (!query) return this.conversations.size;

		let count = 0;

		for (const conv of this.conversations.values()) {
			if (query.userId && conv.userId !== query.userId) continue;
			if (query.sessionId && conv.sessionId !== query.sessionId) continue;
			count++;
		}

		return count;
	}

	/**
	 * Clear all conversations
	 */
	clear(): void {
		this.conversations.clear();
	}

	/**
	 * Get store size
	 */
	get size(): number {
		return this.conversations.size;
	}

	private evictOldest(): void {
		// Find and remove oldest conversation
		let oldest: StoredConversation | null = null;
		let oldestId: string | null = null;

		for (const [id, conv] of this.conversations) {
			if (!oldest || conv.updatedAt < oldest.updatedAt) {
				oldest = conv;
				oldestId = id;
			}
		}

		if (oldestId) {
			this.conversations.delete(oldestId);

			if (this.config.debug) {
				console.log(`[ConversationStore] Evicted: ${oldestId}`);
			}
		}
	}
}

// ============================================================================
// Store Helpers
// ============================================================================

/**
 * Create a conversation ID
 */
export function createConversationId(): string {
	return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Convert session data to stored conversation
 */
export function sessionToConversation(session: SessionData): StoredConversation {
	return {
		id: createConversationId(),
		sessionId: session.state.sessionId,
		userId: session.state.userId,
		messages: session.messages,
		createdAt: session.createdAt,
		updatedAt: session.lastActivity,
		metadata: session.metadata
	};
}

/**
 * Create in-memory conversation store
 */
export function createConversationStore(config?: ConversationStoreConfig): IConversationStore {
	return new InMemoryConversationStore(config);
}

/**
 * Repository interface for database integration
 */
export interface ConversationRepository {
	/** Create a conversation */
	create(data: Omit<StoredConversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoredConversation>;

	/** Find by ID */
	findById(id: string): Promise<StoredConversation | null>;

	/** Find by session */
	findBySession(sessionId: string): Promise<StoredConversation[]>;

	/** Find by user */
	findByUser(userId: string, options?: { limit?: number; offset?: number }): Promise<StoredConversation[]>;

	/** Update a conversation */
	update(id: string, data: Partial<StoredConversation>): Promise<StoredConversation | null>;

	/** Delete a conversation */
	delete(id: string): Promise<boolean>;

	/** Count conversations */
	count(options?: { userId?: string }): Promise<number>;
}

/**
 * Database-backed conversation store
 */
export class DatabaseConversationStore implements IConversationStore {
	constructor(
		private repository: ConversationRepository,
		private config: ConversationStoreConfig = {}
	) {}

	async save(conversation: StoredConversation): Promise<void> {
		const existing = await this.repository.findById(conversation.id);

		if (existing) {
			await this.repository.update(conversation.id, conversation);
		} else {
			await this.repository.create(conversation);
		}
	}

	async get(id: string): Promise<StoredConversation | null> {
		return this.repository.findById(id);
	}

	async getBySession(sessionId: string): Promise<StoredConversation[]> {
		return this.repository.findBySession(sessionId);
	}

	async getByUser(userId: string, query?: ConversationQuery): Promise<StoredConversation[]> {
		return this.repository.findByUser(userId, {
			limit: query?.limit,
			offset: query?.offset
		});
	}

	async delete(id: string): Promise<boolean> {
		return this.repository.delete(id);
	}

	async deleteBySession(sessionId: string): Promise<number> {
		const conversations = await this.repository.findBySession(sessionId);
		let count = 0;

		for (const conv of conversations) {
			if (await this.repository.delete(conv.id)) {
				count++;
			}
		}

		return count;
	}

	async query(query: ConversationQuery): Promise<StoredConversation[]> {
		if (query.userId) {
			return this.getByUser(query.userId, query);
		}

		if (query.sessionId) {
			return this.getBySession(query.sessionId);
		}

		return [];
	}

	async count(query?: ConversationQuery): Promise<number> {
		return this.repository.count(query);
	}
}
