/**
 * MCP Prompt Repository
 *
 * Handles database operations for MCP prompts.
 */

import { eq, and, desc, count, sql } from 'drizzle-orm';
import { aiMcpPrompts } from '$lib/server/db/schema';
import type {
	MCPPrompt,
	CreatePromptInput,
	UpdatePromptInput,
	PromptFilters,
	PaginatedResponse,
	PromptArgument
} from '$lib/models/ai/mcp';
import { BaseRepository } from '../../base-repository';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

type PromptDbRow = {
	id: string;
	userId: string;
	name: string;
	description: string;
	arguments: string; // Stored as JSON string in DB
	moduleId: string | null;
	enabled: number;
	createdAt: Date;
	updatedAt: Date;
};

function mapToMCPPrompt(row: PromptDbRow): MCPPrompt {
	return {
		id: row.id,
		userId: row.userId,
		name: row.name,
		description: row.description,
		arguments: JSON.parse(row.arguments),
		moduleId: row.moduleId ?? null,
		enabled: row.enabled === 1,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

export class McpPromptRepository extends BaseRepository {
	constructor(db?: BetterSQLite3Database<any>) {
		super(db);
	}

	/**
	 * Create a new MCP prompt
	 */
	async create(userId: string, input: CreatePromptInput): Promise<MCPPrompt> {
		const now = new Date();
		const [prompt] = await this.db
			.insert(aiMcpPrompts)
			.values({
				id: crypto.randomUUID(),
				userId,
				name: input.name,
				description: input.description,
				arguments: JSON.stringify(input.arguments),
				moduleId: input.moduleId ?? null,
				enabled: input.enabled ?? true,
				createdAt: now,
				updatedAt: now
			} as any)
			.returning();

		return mapToMCPPrompt(prompt as unknown as PromptDbRow);
	}

	/**
	 * Get prompt by ID
	 */
	async getById(id: string): Promise<MCPPrompt | null> {
		const [prompt] = await this.db
			.select()
			.from(aiMcpPrompts)
			.where(eq(aiMcpPrompts.id, id))
			.limit(1);

		if (!prompt) return null;

		return mapToMCPPrompt(prompt as unknown as PromptDbRow);
	}

	/**
	 * Get prompt by user ID and ID (ensures ownership)
	 */
	async getByUserIdAndId(userId: string, id: string): Promise<MCPPrompt | null> {
		const [prompt] = await this.db
			.select()
			.from(aiMcpPrompts)
			.where(and(eq(aiMcpPrompts.userId, userId), eq(aiMcpPrompts.id, id)))
			.limit(1);

		if (!prompt) return null;

		return mapToMCPPrompt(prompt as unknown as PromptDbRow);
	}

	/**
	 * Get prompt by name
	 */
	async getByName(userId: string, name: string): Promise<MCPPrompt | null> {
		const [prompt] = await this.db
			.select()
			.from(aiMcpPrompts)
			.where(and(eq(aiMcpPrompts.userId, userId), eq(aiMcpPrompts.name, name)))
			.limit(1);

		if (!prompt) return null;

		return mapToMCPPrompt(prompt as unknown as PromptDbRow);
	}

	/**
	 * List prompts for a user with filters and pagination
	 */
	async listByUserId(
		userId: string,
		filters: PromptFilters = {},
		pagination: { page?: number; limit?: number } = {}
	): Promise<PaginatedResponse<MCPPrompt>> {
		const page = pagination.page ?? 1;
		const limit = Math.min(pagination.limit ?? 50, 100);
		const offset = (page - 1) * limit;

		// Build conditions
		const conditions = [eq(aiMcpPrompts.userId, userId)];

		if (filters.moduleId) {
			conditions.push(eq(aiMcpPrompts.moduleId, filters.moduleId));
		}

		if (filters.enabled !== undefined) {
			conditions.push(eq(aiMcpPrompts.enabled, filters.enabled));
		}

		if (filters.search) {
			conditions.push(
				sql`(${aiMcpPrompts.name} LIKE ${'%' + filters.search + '%'} OR ${aiMcpPrompts.description} LIKE ${'%' + filters.search + '%'})`
			);
		}

		const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

		// Get total count
		const [{ total }] = await this.db
			.select({ total: count() })
			.from(aiMcpPrompts)
			.where(whereClause);

		// Get items
		const items = await this.db
			.select()
			.from(aiMcpPrompts)
			.where(whereClause)
			.orderBy(desc(aiMcpPrompts.createdAt))
			.limit(limit)
			.offset(offset);

		return {
			items: items.map((item) => mapToMCPPrompt(item as unknown as PromptDbRow)),
			total,
			page,
			limit,
			hasMore: offset + items.length < total
		};
	}

	/**
	 * List all enabled prompts for MCP protocol (scoped to user and allowed modules)
	 */
	async listEnabledForMcp(
		userId: string,
		allowedModules: string[]
	): Promise<Pick<MCPPrompt, 'name' | 'description' | 'arguments'>[]> {
		// If no module restriction, get all enabled prompts
		// Otherwise, filter by allowed modules
		const whereClause =
			allowedModules.length === 0
				? and(eq(aiMcpPrompts.userId, userId), eq(aiMcpPrompts.enabled, true))
				: and(
						eq(aiMcpPrompts.userId, userId),
						eq(aiMcpPrompts.enabled, true),
						sql`(${aiMcpPrompts.moduleId} IS NULL OR ${aiMcpPrompts.moduleId} IN ${allowedModules})`
					);

		const items = await this.db
			.select({
				name: aiMcpPrompts.name,
				description: aiMcpPrompts.description,
				arguments: aiMcpPrompts.arguments
			})
			.from(aiMcpPrompts)
			.where(whereClause);

		return items.map((item) => ({
			name: item.name,
			description: item.description,
			arguments: JSON.parse(item.arguments as any as string)
		}));
	}

	/**
	 * Update a prompt
	 */
	async update(id: string, userId: string, input: UpdatePromptInput): Promise<MCPPrompt | null> {
		const updateData: Record<string, unknown> = {
			updatedAt: new Date()
		};

		if (input.name !== undefined) updateData.name = input.name;
		if (input.description !== undefined) updateData.description = input.description;
		if (input.arguments !== undefined) updateData.arguments = JSON.stringify(input.arguments);
		if (input.moduleId !== undefined) updateData.moduleId = input.moduleId;
		if (input.enabled !== undefined) updateData.enabled = input.enabled;

		const [result] = await this.db
			.update(aiMcpPrompts)
			.set(updateData as any)
			.where(and(eq(aiMcpPrompts.userId, userId), eq(aiMcpPrompts.id, id)))
			.returning();

		if (!result) return null;

		return mapToMCPPrompt(result as unknown as PromptDbRow);
	}

	/**
	 * Delete a prompt
	 */
	async delete(id: string, userId: string): Promise<boolean> {
		const result = await this.db
			.delete(aiMcpPrompts)
			.where(and(eq(aiMcpPrompts.userId, userId), eq(aiMcpPrompts.id, id)))
			.returning();

		return result.length > 0;
	}

	/**
	 * Delete all prompts for a user
	 */
	async deleteByUserId(userId: string): Promise<number> {
		const result = await this.db
			.delete(aiMcpPrompts)
			.where(eq(aiMcpPrompts.userId, userId))
			.returning();

		return result.length;
	}
}
