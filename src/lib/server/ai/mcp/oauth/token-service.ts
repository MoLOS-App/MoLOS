/**
 * OAuth Token Service
 *
 * Handles OAuth access token and refresh token generation,
 * validation, and management.
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { db } from '$lib/server/db';
import { aiMcpOAuthTokens } from '$lib/server/db/schema';
import { eq, and, lt, or, isNull } from 'drizzle-orm';
import type { MCPOAuthTokenType } from '$lib/server/db/schema';

/**
 * Token configuration
 */
const TOKEN_CONFIG = {
	// Access token lifetime (default: 1 hour)
	accessTokenLifetimeMs: parseInt(process.env.MCP_OAUTH_ACCESS_TOKEN_LIFETIME || '3600000', 10),
	// Refresh token lifetime (default: 30 days)
	refreshTokenLifetimeMs: parseInt(
		process.env.MCP_OAUTH_REFRESH_TOKEN_LIFETIME || '2592000000',
		10
	),
	// Token entropy (bytes)
	tokenEntropy: 32
} as const;

/**
 * OAuth token info for validation response
 */
export interface OAuthTokenInfo {
	id: string;
	clientId: string;
	userId: string;
	tokenType: MCPOAuthTokenType;
	scopes: string[];
	expiresAt: Date | null;
	revokedAt: Date | null;
}

/**
 * OAuth token creation result
 */
export interface CreateTokenResult {
	token: string;
	expiresAt: Date;
}

/**
 * Generate a cryptographically random token
 */
function generateRandomToken(): string {
	return randomBytes(TOKEN_CONFIG.tokenEntropy).toString('base64url');
}

/**
 * Hash a token for secure storage
 */
function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/**
 * Token Service class
 */
export class OAuthTokenService {
	/**
	 * Create a new access token
	 */
	async createAccessToken(
		clientId: string,
		userId: string,
		scopes: string[],
		expiresInMs?: number,
		refreshTokenId?: string
	): Promise<CreateTokenResult> {
		const token = generateRandomToken();
		const tokenHash = hashToken(token);
		const expiresAt = new Date(Date.now() + (expiresInMs ?? TOKEN_CONFIG.accessTokenLifetimeMs));

		const id = `tok_${Date.now()}_${randomBytes(8).toString('hex')}`;

		await db.insert(aiMcpOAuthTokens).values({
			id,
			clientId,
			userId,
			tokenType: 'access',
			token: tokenHash,
			scopes: JSON.stringify(scopes),
			expiresAt,
			refreshTokenId,
			createdAt: new Date()
		});

		return { token, expiresAt };
	}

	/**
	 * Create a new refresh token
	 */
	async createRefreshToken(
		clientId: string,
		userId: string,
		scopes: string[]
	): Promise<CreateTokenResult> {
		const token = generateRandomToken();
		const tokenHash = hashToken(token);
		const expiresAt = new Date(Date.now() + TOKEN_CONFIG.refreshTokenLifetimeMs);

		const id = `ref_${Date.now()}_${randomBytes(8).toString('hex')}`;

		await db.insert(aiMcpOAuthTokens).values({
			id,
			clientId,
			userId,
			tokenType: 'refresh',
			token: tokenHash,
			scopes: JSON.stringify(scopes),
			expiresAt,
			createdAt: new Date()
		});

		return { token, expiresAt };
	}

	/**
	 * Create an access token and refresh token pair
	 */
	async createTokenPair(
		clientId: string,
		userId: string,
		scopes: string[]
	): Promise<{ accessToken: CreateTokenResult; refreshToken: CreateTokenResult }> {
		const refreshToken = await this.createRefreshToken(clientId, userId, scopes);
		const accessToken = await this.createAccessToken(
			clientId,
			userId,
			scopes,
			undefined,
			refreshToken.token
		);

		return { accessToken, refreshToken };
	}

	/**
	 * Verify a token and return its info
	 */
	async verifyToken(token: string): Promise<OAuthTokenInfo | null> {
		const tokenHash = hashToken(token);

		const result = await db
			.select()
			.from(aiMcpOAuthTokens)
			.where(
				and(
					eq(aiMcpOAuthTokens.token, tokenHash),
					// Not revoked
					or(isNull(aiMcpOAuthTokens.revokedAt), eq(aiMcpOAuthTokens.revokedAt, 0)),
					// Not expired (or no expiration set)
					or(
						isNull(aiMcpOAuthTokens.expiresAt),
						eq(aiMcpOAuthTokens.expiresAt, 0)
						// Check if expiresAt is in the future
						// Note: We'll handle the date comparison in the application layer
					)
				)
			)
			.limit(1);

		if (result.length === 0) {
			return null;
		}

		const tokenRecord = result[0];

		// Check expiration in application layer
		if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) {
			return null;
		}

		return {
			id: tokenRecord.id,
			clientId: tokenRecord.clientId,
			userId: tokenRecord.userId,
			tokenType: tokenRecord.tokenType,
			scopes: tokenRecord.scopes as unknown as string[],
			expiresAt: tokenRecord.expiresAt,
			revokedAt: tokenRecord.revokedAt
		};
	}

	/**
	 * Verify an access token specifically
	 */
	async verifyAccessToken(token: string): Promise<OAuthTokenInfo | null> {
		const tokenInfo = await this.verifyToken(token);
		if (!tokenInfo) {
			return null;
		}
		if (tokenInfo.tokenType !== 'access') {
			return null;
		}
		return tokenInfo;
	}

	/**
	 * Verify a refresh token specifically
	 */
	async verifyRefreshToken(token: string): Promise<OAuthTokenInfo | null> {
		const tokenInfo = await this.verifyToken(token);
		if (!tokenInfo) {
			return null;
		}
		if (tokenInfo.tokenType !== 'refresh') {
			return null;
		}
		return tokenInfo;
	}

	/**
	 * Revoke a token
	 */
	async revokeToken(token: string): Promise<boolean> {
		const tokenHash = hashToken(token);

		const result = await db
			.update(aiMcpOAuthTokens)
			.set({ revokedAt: new Date() })
			.where(and(eq(aiMcpOAuthTokens.token, tokenHash), isNull(aiMcpOAuthTokens.revokedAt)));

		return result.rowCount > 0;
	}

	/**
	 * Revoke all tokens for a client/user pair
	 */
	async revokeAllTokens(clientId: string, userId: string): Promise<number> {
		const result = await db
			.update(aiMcpOAuthTokens)
			.set({ revokedAt: new Date() })
			.where(
				and(
					eq(aiMcpOAuthTokens.clientId, clientId),
					eq(aiMcpOAuthTokens.userId, userId),
					isNull(aiMcpOAuthTokens.revokedAt)
				)
			);

		return result.rowCount;
	}

	/**
	 * Revoke all tokens for a specific refresh token (cascade revocation)
	 * This revokes the refresh token and all associated access tokens
	 */
	async revokeRefreshTokenCascade(refreshTokenId: string): Promise<number> {
		const now = new Date();

		// Revoke the refresh token
		await db
			.update(aiMcpOAuthTokens)
			.set({ revokedAt: now })
			.where(eq(aiMcpOAuthTokens.id, refreshTokenId));

		// Revoke all access tokens linked to this refresh token
		const result = await db
			.update(aiMcpOAuthTokens)
			.set({ revokedAt: now })
			.where(eq(aiMcpOAuthTokens.refreshTokenId, refreshTokenId));

		return result.rowCount + 1; // +1 for the refresh token itself
	}

	/**
	 * Clean up expired tokens (maintenance task)
	 */
	async cleanupExpiredTokens(): Promise<number> {
		const now = new Date();

		// Delete tokens that expired more than 24 hours ago
		const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		const result = await db
			.delete(aiMcpOAuthTokens)
			.where(and(lt(aiMcpOAuthTokens.expiresAt, cutoff)));

		return result.rowCount;
	}
}

// Singleton instance
export const oauthTokenService = new OAuthTokenService();
