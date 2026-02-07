/**
 * OAuth Clients Store
 *
 * Implements OAuthRegisteredClientsStore from MCP SDK for
 * dynamic client registration and lookup.
 */

import { randomBytes, createHash } from 'crypto';
import { db } from '$lib/server/db';
import { aiMcpOAuthClients } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth';
import { MCPOAuthClientStatus } from '$lib/server/db/schema';

/**
 * Configuration for client secrets
 */
const CLIENT_SECRET_CONFIG = {
	// Default client secret lifetime (0 = no expiration, per RFC 7591)
	defaultSecretLifetimeMs: 0,
	// Client secret entropy (bytes)
	secretEntropy: 48
} as const;

/**
 * Generate a client ID
 */
function generateClientId(): string {
	return `mcp_client_${randomBytes(16).toString('base64url')}`;
}

/**
 * Generate a client secret
 */
function generateClientSecret(): string {
	return randomBytes(CLIENT_SECRET_CONFIG.secretEntropy).toString('base64url');
}

/**
 * Hash a client secret for storage
 */
function hashClientSecret(secret: string): string {
	return createHash('sha256').update(secret).digest('hex');
}

/**
 * Convert database record to OAuthClientInformationFull
 */
function dbToOAuthClient(
	dbClient: typeof aiMcpOAuthClients.$inferSelect
): OAuthClientInformationFull {
	return {
		client_id: dbClient.id,
		client_secret: dbClient.clientSecret ?? undefined,
		client_id_issued_at: Math.floor(dbClient.issuedAt.getTime() / 1000),
		client_secret_expires_at: dbClient.clientSecretExpiresAt
			? Math.floor(dbClient.clientSecretExpiresAt.getTime() / 1000)
			: 0,
		redirect_uris: dbClient.redirectUris.map((uri) => new URL(uri)),
		token_endpoint_auth_method: dbClient.tokenEndpointAuthMethod,
		grant_types: dbClient.grantTypes,
		response_types: ['code'],
		client_name: dbClient.name,
		client_uri: dbClient.clientUri ? new URL(dbClient.clientUri) : undefined,
		logo_uri: dbClient.logoUri ? new URL(dbClient.logoUri) : undefined,
		scope: dbClient.scopes?.join(' ') ?? undefined,
		contacts: dbClient.contacts ?? undefined,
		tos_uri: dbClient.tosUri,
		policy_uri: dbClient.policyUri,
		jwks_uri: undefined,
		jwks: undefined,
		software_id: dbClient.softwareId,
		software_version: dbClient.softwareVersion
	};
}

/**
 * OAuth Clients Store implementation
 */
export class OAuthClientsStore {
	/**
	 * Get a client by ID
	 */
	async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
		const result = await db
			.select()
			.from(aiMcpOAuthClients)
			.where(
				and(
					eq(aiMcpOAuthClients.id, clientId),
					eq(aiMcpOAuthClients.status, MCPOAuthClientStatus.ACTIVE)
				)
			)
			.limit(1);

		if (result.length === 0) {
			return undefined;
		}

		return dbToOAuthClient(result[0]);
	}

	/**
	 * Get a client with secret verification
	 * Returns null if secret doesn't match
	 */
	async getClientWithSecret(
		clientId: string,
		clientSecret: string
	): Promise<OAuthClientInformationFull | null> {
		const result = await db
			.select()
			.from(aiMcpOAuthClients)
			.where(
				and(
					eq(aiMcpOAuthClients.id, clientId),
					eq(aiMcpOAuthClients.status, MCPOAuthClientStatus.ACTIVE)
				)
			)
			.limit(1);

		if (result.length === 0) {
			return null;
		}

		const client = result[0];

		// If client has a secret, verify it
		if (client.clientSecret) {
			const secretHash = hashClientSecret(clientSecret);
			if (secretHash !== client.clientSecret) {
				return null;
			}
		}

		// Check if secret has expired
		if (
			client.clientSecretExpiresAt &&
			client.clientSecretExpiresAt.getTime() > 0 &&
			client.clientSecretExpiresAt < new Date()
		) {
			return null;
		}

		return dbToOAuthClient(client);
	}

	/**
	 * Register a new client (dynamic client registration)
	 */
	async registerClient(
		userId: string,
		metadata: Omit<
			OAuthClientInformationFull,
			'client_id' | 'client_id_issued_at' | 'client_secret' | 'client_secret_expires_at'
		>
	): Promise<OAuthClientInformationFull> {
		const clientId = generateClientId();
		const now = new Date();

		// Generate secret only if auth method requires it
		let clientSecret: string | null = null;
		let clientSecretHash: string | null = null;
		let clientSecretExpiresAt: Date | null = null;

		if (metadata.token_endpoint_auth_method !== 'none') {
			clientSecret = generateClientSecret();
			clientSecretHash = hashClientSecret(clientSecret);
			clientSecretExpiresAt =
				CLIENT_SECRET_CONFIG.defaultSecretLifetimeMs > 0
					? new Date(now.getTime() + CLIENT_SECRET_CONFIG.defaultSecretLifetimeMs)
					: null;
		}

		const issuedAt = now;

		await db.insert(aiMcpOAuthClients).values({
			id: clientId,
			userId,
			name: metadata.client_name ?? 'Unnamed Client',
			clientSecret: clientSecretHash,
			redirectUris: metadata.redirect_uris.map((uri) => uri.toString()),
			scopes: metadata.scope?.split(' ') ?? [],
			grantTypes: metadata.grant_types ?? ['authorization_code', 'refresh_token'],
			tokenEndpointAuthMethod: metadata.token_endpoint_auth_method ?? 'none',
			status: MCPOAuthClientStatus.ACTIVE,
			clientSecretExpiresAt,
			clientUri: metadata.client_uri?.toString(),
			logoUri: metadata.logo_uri?.toString(),
			contacts: metadata.contacts,
			tosUri: metadata.tos_uri,
			policyUri: metadata.policy_uri,
			softwareId: metadata.software_id,
			softwareVersion: metadata.software_version,
			issuedAt,
			createdAt: now,
			updatedAt: now
		});

		// Return the full client info with the plaintext secret (only shown once)
		return {
			...metadata,
			client_id: clientId,
			client_secret: clientSecret ?? undefined,
			client_id_issued_at: Math.floor(issuedAt.getTime() / 1000),
			client_secret_expires_at: clientSecretExpiresAt
				? Math.floor(clientSecretExpiresAt.getTime() / 1000)
				: 0
		};
	}

	/**
	 * List all clients for a user
	 */
	async listClientsByUserId(userId: string): Promise<OAuthClientInformationFull[]> {
		const result = await db
			.select()
			.from(aiMcpOAuthClients)
			.where(eq(aiMcpOAuthClients.userId, userId));

		return result.map(dbToOAuthClient);
	}

	/**
	 * Revoke a client
	 */
	async revokeClient(clientId: string, userId: string): Promise<boolean> {
		const result = await db
			.update(aiMcpOAuthClients)
			.set({ status: MCPOAuthClientStatus.REVOKED, updatedAt: new Date() })
			.where(and(eq(aiMcpOAuthClients.id, clientId), eq(aiMcpOAuthClients.userId, userId)));

		return result.rowCount > 0;
	}

	/**
	 * Delete a client (hard delete)
	 */
	async deleteClient(clientId: string, userId: string): Promise<boolean> {
		const result = await db
			.delete(aiMcpOAuthClients)
			.where(and(eq(aiMcpOAuthClients.id, clientId), eq(aiMcpOAuthClients.userId, userId)));

		return result.rowCount > 0;
	}

	/**
	 * Update client metadata
	 */
	async updateClient(
		clientId: string,
		userId: string,
		updates: Partial<{
			name: string;
			redirectUris: string[];
			scopes: string[];
			status: MCPOAuthClientStatus;
		}>
	): Promise<OAuthClientInformationFull | null> {
		const updateData: Record<string, unknown> = { updatedAt: new Date() };

		if (updates.name !== undefined) {
			updateData.name = updates.name;
		}
		if (updates.redirectUris !== undefined) {
			updateData.redirectUris = JSON.stringify(updates.redirectUris);
		}
		if (updates.scopes !== undefined) {
			updateData.scopes = JSON.stringify(updates.scopes);
		}
		if (updates.status !== undefined) {
			updateData.status = updates.status;
		}

		const result = await db
			.update(aiMcpOAuthClients)
			.set(updateData)
			.where(and(eq(aiMcpOAuthClients.id, clientId), eq(aiMcpOAuthClients.userId, userId)));

		if (result.rowCount === 0) {
			return null;
		}

		return this.getClient(clientId);
	}
}

// Singleton instance
export const oauthClientsStore = new OAuthClientsStore();
