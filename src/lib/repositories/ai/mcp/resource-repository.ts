/**
 * MCP Resource Repository
 *
 * Handles database operations for MCP resources.
 */

import { eq, and, desc, count, sql } from 'drizzle-orm';
import { aiMcpResources } from '$lib/server/db/schema';
import type {
	MCPResource,
	CreateResourceInput,
	UpdateResourceInput,
	ResourceFilters,
	PaginatedResponse
} from '$lib/models/ai/mcp';
import { BaseRepository } from '../../base-repository';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export class McpResourceRepository extends BaseRepository {
	constructor(db?: BetterSQLite3Database<any>) {
		super(db);
	}

	/**
	 * Create a new MCP resource
	 */
	async create(userId: string, input: CreateResourceInput): Promise<MCPResource> {
		const now = new Date();
		const [resource] = await this.db
			.insert(aiMcpResources)
			.values({
				id: crypto.randomUUID(),
				userId,
				name: input.name,
				uri: input.uri,
				moduleId: input.moduleId,
				description: input.description,
				mimeType: input.mimeType ?? 'application/json',
				metadata: input.metadata ? JSON.stringify(input.metadata) : null,
				enabled: input.enabled ?? true,
				createdAt: now,
				updatedAt: now
			} as any)
			.returning();

		return {
			...resource,
			metadata: resource.metadata ? JSON.parse(resource.metadata as string) : undefined
		} as MCPResource;
	}

	/**
	 * Get resource by ID
	 */
	async getById(id: string): Promise<MCPResource | null> {
		const [resource] = await this.db
			.select()
			.from(aiMcpResources)
			.where(eq(aiMcpResources.id, id))
			.limit(1);

		if (!resource) return null;

		return {
			...resource,
			metadata: resource.metadata ? JSON.parse(resource.metadata as string) : undefined
		} as MCPResource;
	}

	/**
	 * Get resource by user ID and ID (ensures ownership)
	 */
	async getByUserIdAndId(userId: string, id: string): Promise<MCPResource | null> {
		const [resource] = await this.db
			.select()
			.from(aiMcpResources)
			.where(and(eq(aiMcpResources.userId, userId), eq(aiMcpResources.id, id)))
			.limit(1);

		if (!resource) return null;

		return {
			...resource,
			metadata: resource.metadata ? JSON.parse(resource.metadata as string) : undefined
		} as MCPResource;
	}

	/**
	 * Get resource by URI
	 */
	async getByUri(uri: string): Promise<MCPResource | null> {
		const [resource] = await this.db
			.select()
			.from(aiMcpResources)
			.where(eq(aiMcpResources.uri, uri))
			.limit(1);

		if (!resource) return null;

		return {
			...resource,
			metadata: resource.metadata ? JSON.parse(resource.metadata as string) : undefined
		} as MCPResource;
	}

	/**
	 * List resources for a user with filters and pagination
	 */
	async listByUserId(
		userId: string,
		filters: ResourceFilters = {},
		pagination: { page?: number; limit?: number } = {}
	): Promise<PaginatedResponse<MCPResource>> {
		const page = pagination.page ?? 1;
		const limit = Math.min(pagination.limit ?? 50, 100);
		const offset = (page - 1) * limit;

		// Build conditions
		const conditions = [eq(aiMcpResources.userId, userId)];

		if (filters.moduleId) {
			conditions.push(eq(aiMcpResources.moduleId, filters.moduleId));
		}

		if (filters.enabled !== undefined) {
			conditions.push(eq(aiMcpResources.enabled, filters.enabled));
		}

		if (filters.search) {
			conditions.push(
				sql`(${aiMcpResources.name} LIKE ${'%' + filters.search + '%'} OR ${aiMcpResources.description} LIKE ${'%' + filters.search + '%'})`
			);
		}

		const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

		// Get total count
		const [{ total }] = await this.db
			.select({ total: count() })
			.from(aiMcpResources)
			.where(whereClause);

		// Get items
		const items = await this.db
			.select()
			.from(aiMcpResources)
			.where(whereClause)
			.orderBy(desc(aiMcpResources.createdAt))
			.limit(limit)
			.offset(offset);

		return {
			items: items.map((item) => ({
				...item,
				metadata: item.metadata ? JSON.parse(item.metadata as string) : undefined
			})) as MCPResource[],
			total,
			page,
			limit,
			hasMore: offset + items.length < total
		};
	}

	/**
	 * List all enabled resources for MCP protocol (scoped to user and allowed modules)
	 */
	async listEnabledForMcp(
		userId: string,
		allowedModules: string[]
	): Promise<Pick<MCPResource, 'id' | 'name' | 'uri' | 'description' | 'mimeType'>[]> {
		// If no module restriction, get all enabled resources
		// Otherwise, filter by allowed modules
		const whereClause =
			allowedModules.length === 0
				? and(eq(aiMcpResources.userId, userId), eq(aiMcpResources.enabled, true))
				: and(
						eq(aiMcpResources.userId, userId),
						eq(aiMcpResources.enabled, true),
						sql`${aiMcpResources.moduleId} IN ${allowedModules}`
					);

		const items = await this.db
			.select({
				id: aiMcpResources.id,
				name: aiMcpResources.name,
				uri: aiMcpResources.uri,
				description: aiMcpResources.description,
				mimeType: aiMcpResources.mimeType
			})
			.from(aiMcpResources)
			.where(whereClause);

		return items.map((item) => ({
			...item,
			mimeType: item.mimeType ?? 'application/json'
		}));
	}

	/**
	 * Update a resource
	 */
	async update(id: string, userId: string, input: UpdateResourceInput): Promise<MCPResource | null> {
		const updateData: Record<string, unknown> = {
			updatedAt: new Date()
		};

		if (input.name !== undefined) updateData.name = input.name;
		if (input.uri !== undefined) updateData.uri = input.uri;
		if (input.moduleId !== undefined) updateData.moduleId = input.moduleId;
		if (input.description !== undefined) updateData.description = input.description;
		if (input.mimeType !== undefined) updateData.mimeType = input.mimeType;
		if (input.metadata !== undefined)
			updateData.metadata = input.metadata ? JSON.stringify(input.metadata) : null;
		if (input.enabled !== undefined) updateData.enabled = input.enabled;

		const [result] = await this.db
			.update(aiMcpResources)
			.set(updateData as any)
			.where(and(eq(aiMcpResources.userId, userId), eq(aiMcpResources.id, id)))
			.returning();

		if (!result) return null;

		return {
			...result,
			metadata: result.metadata ? JSON.parse(result.metadata as string) : undefined
		} as MCPResource;
	}

	/**
	 * Delete a resource
	 */
	async delete(id: string, userId: string): Promise<boolean> {
		const result = await this.db
			.delete(aiMcpResources)
			.where(and(eq(aiMcpResources.userId, userId), eq(aiMcpResources.id, id)))
			.returning();

		return result.length > 0;
	}

	/**
	 * Delete all resources for a user
	 */
	async deleteByUserId(userId: string): Promise<number> {
		const result = await this.db
			.delete(aiMcpResources)
			.where(eq(aiMcpResources.userId, userId))
			.returning();

		return result.length;
	}
}
