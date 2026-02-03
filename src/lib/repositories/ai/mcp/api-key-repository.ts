/**
 * MCP API Key Repository
 *
 * Handles database operations for MCP API keys.
 */

import { eq, and, desc, count, like, or } from 'drizzle-orm';
import { aiMcpApiKeys, MCPApiKeyStatus } from '$lib/server/db/schema';
import type {
	MCPApiKey,
	CreateApiKeyInput,
	UpdateApiKeyInput,
	ApiKeyFilters,
	PaginatedResponse,
	GeneratedApiKey,
	ApiKeyValidation
} from '$lib/models/ai/mcp';
import { createHash, randomBytes } from 'crypto';
import { BaseRepository } from '../../base-repository';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mcpSecurityConfig } from '$lib/server/ai/mcp/config/security';

/**
 * Generate a cryptographically random string
 */
function generateRandomString(length: number): string {
	return randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * Hash an API key
 */
function hashApiKey(key: string): string {
	return createHash('sha256').update(key + mcpSecurityConfig.apiKeySalt).digest('hex');
}

/**
 * Format API key with prefix
 */
function formatApiKey(prefix: string, suffix: string, environment: 'live' | 'test' = 'live'): string {
	return `mcp_${environment}_${prefix}_${suffix}`;
}

/**
 * Parse API key and return components
 */
function parseApiKey(key: string): { valid: boolean; prefix?: string; suffix?: string } {
	const parts = key.split('_');
	if (parts.length !== 4 || parts[0] !== 'mcp' || (parts[1] !== 'live' && parts[1] !== 'test')) {
		return { valid: false };
	}
	return { valid: true, prefix: parts[2], suffix: parts[3] };
}

export class ApiKeyRepository extends BaseRepository {
	constructor(db?: BetterSQLite3Database<any>) {
		super(db);
	}

	/**
	 * Generate a new API key
	 */
	generateApiKey(): GeneratedApiKey {
		const prefix = generateRandomString(8);
		const suffix = generateRandomString(8);
		const fullKey = formatApiKey(prefix, suffix, 'live');
		const hash = hashApiKey(fullKey);

		return {
			fullKey,
			prefix,
			suffix,
			hash
		};
	}

	/**
	 * Validate an API key and return the key record
	 */
	async validateApiKey(key: string): Promise<ApiKeyValidation> {
		const parsed = parseApiKey(key);

		if (!parsed.valid || !parsed.prefix || !parsed.suffix) {
			return { valid: false, error: 'Invalid API key format' };
		}

		const hash = hashApiKey(key);

		const result = await this.db
			.select()
			.from(aiMcpApiKeys)
			.where(eq(aiMcpApiKeys.keyHash, hash))
			.limit(1);

		const apiKey = result[0];

		if (!apiKey) {
			return { valid: false, error: 'API key not found' };
		}

		if (apiKey.status !== MCPApiKeyStatus.ACTIVE) {
			return { valid: false, error: 'API key is not active' };
		}

		// Check expiration
		if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
			return { valid: false, error: 'API key has expired' };
		}

		return {
			valid: true,
			apiKey: {
				...apiKey,
				allowedModules: (apiKey.allowedModules as unknown as string[]) || []
			}
		};
	}

	/**
	 * Create a new API key
	 */
	async create(userId: string, input: CreateApiKeyInput): Promise<{ apiKey: MCPApiKey; fullKey: string }> {
		const generated = this.generateApiKey();

		const now = new Date();
		const apiKey = await this.db
			.insert(aiMcpApiKeys)
			.values({
				id: crypto.randomUUID(),
				userId,
				name: input.name,
				keyPrefix: generated.prefix,
				keyHash: generated.hash,
				status: MCPApiKeyStatus.ACTIVE,
				allowedModules: input.allowedModules ?? [],
				expiresAt: input.expiresAt || null,
				lastUsedAt: null,
				usageCount: 0,
				createdAt: now,
				updatedAt: now
			} as any)
			.returning()
			.then((rows) => rows[0]);

		return {
			apiKey: {
				...apiKey,
				allowedModules: (apiKey.allowedModules as unknown as string[]) || []
			},
			fullKey: generated.fullKey
		};
	}

	/**
	 * Get API key by ID
	 */
	async getById(id: string): Promise<MCPApiKey | null> {
		const result = await this.db.select().from(aiMcpApiKeys).where(eq(aiMcpApiKeys.id, id)).limit(1);

		if (!result[0]) return null;

		return {
			...result[0],
			allowedModules: (result[0].allowedModules as unknown as string[]) || []
		};
	}

	/**
	 * Get API key by user ID and ID (ensures ownership)
	 */
	async getByUserIdAndId(userId: string, id: string): Promise<MCPApiKey | null> {
		const result = await this.db
			.select()
			.from(aiMcpApiKeys)
			.where(and(eq(aiMcpApiKeys.userId, userId), eq(aiMcpApiKeys.id, id)))
			.limit(1);

		if (!result[0]) return null;

		return {
			...result[0],
			allowedModules: (result[0].allowedModules as unknown as string[]) || []
		};
	}

	/**
	 * List API keys for a user with filters and pagination
	 */
	async listByUserId(
		userId: string,
		filters: ApiKeyFilters = {},
		pagination: { page?: number; limit?: number } = {}
	): Promise<PaginatedResponse<MCPApiKey>> {
		const page = pagination.page ?? 1;
		const limit = Math.min(pagination.limit ?? 50, 100);
		const offset = (page - 1) * limit;

		// Build conditions
		const conditions = [eq(aiMcpApiKeys.userId, userId)];

		if (filters.status) {
			conditions.push(eq(aiMcpApiKeys.status, filters.status));
		}

		if (filters.search) {
			conditions.push(like(aiMcpApiKeys.name, `%${filters.search}%`));
		}

		const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

		// Get total count
		const [{ total }] = await this.db
			.select({ total: count() })
			.from(aiMcpApiKeys)
			.where(whereClause);

		// Get items
		const items = await this.db
			.select()
			.from(aiMcpApiKeys)
			.where(whereClause)
			.orderBy(desc(aiMcpApiKeys.createdAt))
			.limit(limit)
			.offset(offset);

		return {
			items: items.map((item) => ({
				...item,
				allowedModules: (item.allowedModules as unknown as string[]) || []
			})),
			total,
			page,
			limit,
			hasMore: offset + items.length < total
		};
	}

	/**
	 * Update an API key
	 */
	async update(id: string, userId: string, input: UpdateApiKeyInput): Promise<MCPApiKey | null> {
		const updateData: Record<string, unknown> = {
			updatedAt: new Date()
		};

		if (input.name !== undefined) updateData.name = input.name;
		if (input.status !== undefined) updateData.status = input.status;
		if (input.allowedModules !== undefined) updateData.allowedModules = input.allowedModules;
		if (input.expiresAt !== undefined) updateData.expiresAt = input.expiresAt || null;

		const result = await this.db
			.update(aiMcpApiKeys)
			.set(updateData as any)
			.where(and(eq(aiMcpApiKeys.userId, userId), eq(aiMcpApiKeys.id, id)))
			.returning();

		if (!result[0]) return null;

		return {
			...result[0],
			allowedModules: (result[0].allowedModules as unknown as string[]) || []
		};
	}

	/**
	 * Update last used timestamp and increment usage count
	 */
	async recordUsage(id: string): Promise<void> {
		// Get current usage count
		const [current] = await this.db
			.select({ count: aiMcpApiKeys.usageCount })
			.from(aiMcpApiKeys)
			.where(eq(aiMcpApiKeys.id, id));

		// Update with incremented count
		await this.db
			.update(aiMcpApiKeys)
			.set({
				lastUsedAt: new Date(),
				usageCount: (current?.count ?? 0) + 1
			} as any)
			.where(eq(aiMcpApiKeys.id, id));
	}

	/**
	 * Delete (revoke) an API key
	 */
	async delete(id: string, userId: string): Promise<boolean> {
		const result = await this.db
			.delete(aiMcpApiKeys)
			.where(and(eq(aiMcpApiKeys.userId, userId), eq(aiMcpApiKeys.id, id)))
			.returning();

		return result.length > 0;
	}
}
