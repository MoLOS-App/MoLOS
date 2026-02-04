/**
 * OAuth Authorization Service
 *
 * Handles authorization code generation, validation, and exchange
 * for the OAuth 2.0 authorization code flow with PKCE.
 */

import { randomBytes } from 'crypto';
import { db } from '$lib/server/db';
import { aiMcpOAuthCodes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth';

/**
 * Authorization code configuration
 */
const AUTH_CODE_CONFIG = {
	// Authorization code lifetime (default: 10 minutes)
	codeLifetimeMs: parseInt(process.env.MCP_OAUTH_CODE_LIFETIME || '600000', 10),
	// Code entropy (bytes)
	codeEntropy: 32
} as const;

/**
 * Authorization code info
 */
export interface AuthorizationCodeInfo {
	id: string;
	code: string;
	clientId: string;
	userId: string;
	redirectUri: string;
	scopes: string[];
	codeChallenge: string;
	codeChallengeMethod: string;
	state?: string;
	resource?: string;
	expiresAt: Date;
}

/**
 * Generate a secure authorization code
 */
function generateAuthorizationCode(): string {
	return randomBytes(AUTH_CODE_CONFIG.codeEntropy).toString('base64url');
}

/**
 * OAuth Authorization Service
 */
export class OAuthAuthorizationService {
	/**
	 * Create an authorization code
	 */
	async createAuthorizationCode(
		client: OAuthClientInformationFull,
		userId: string,
		params: {
			redirectUri: string;
			codeChallenge: string;
			codeChallengeMethod?: string;
			state?: string;
			scopes?: string[];
			resource?: string;
		}
	): Promise<AuthorizationCodeInfo> {
		const code = generateAuthorizationCode();
		const expiresAt = new Date(Date.now() + AUTH_CODE_CONFIG.codeLifetimeMs);
		const id = `code_${Date.now()}_${randomBytes(8).toString('hex')}`;

		await db.insert(aiMcpOAuthCodes).values({
			id,
			code,
			clientId: client.client_id,
			userId,
			redirectUri: params.redirectUri,
			scopes: params.scopes ?? [],
			codeChallenge: params.codeChallenge,
			codeChallengeMethod: params.codeChallengeMethod ?? 'S256',
			state: params.state,
			resource: params.resource,
			expiresAt,
			createdAt: new Date()
		});

		return {
			id,
			code,
			clientId: client.client_id,
			userId,
			redirectUri: params.redirectUri,
			scopes: params.scopes ?? [],
			codeChallenge: params.codeChallenge,
			codeChallengeMethod: params.codeChallengeMethod ?? 'S256',
			state: params.state,
			resource: params.resource,
			expiresAt
		};
	}

	/**
	 * Validate and consume an authorization code
	 * Returns null if code is invalid, expired, or already consumed
	 */
	async validateAndConsumeCode(
		code: string,
		clientId: string
	): Promise<AuthorizationCodeInfo | null> {
		const result = await db
			.select()
			.from(aiMcpOAuthCodes)
			.where(eq(aiMcpOAuthCodes.code, code))
			.limit(1);

		if (result.length === 0) {
			return null;
		}

		const codeRecord = result[0];

		// Verify client ID matches
		if (codeRecord.clientId !== clientId) {
			return null;
		}

		// Check if already consumed
		if (codeRecord.consumedAt) {
			return null;
		}

		// Check expiration
		if (codeRecord.expiresAt < new Date()) {
			return null;
		}

		// Mark as consumed
		await db
			.update(aiMcpOAuthCodes)
			.set({ consumedAt: new Date() })
			.where(eq(aiMcpOAuthCodes.id, codeRecord.id));

		return {
			id: codeRecord.id,
			code: codeRecord.code,
			clientId: codeRecord.clientId,
			userId: codeRecord.userId,
			redirectUri: codeRecord.redirectUri,
			scopes: codeRecord.scopes as unknown as string[],
			codeChallenge: codeRecord.codeChallenge,
			codeChallengeMethod: codeRecord.codeChallengeMethod,
			state: codeRecord.state ?? undefined,
			resource: codeRecord.resource ?? undefined,
			expiresAt: codeRecord.expiresAt
		};
	}

	/**
	 * Get the code challenge for a given authorization code
	 * Used for PKCE validation
	 */
	async getCodeChallenge(code: string, clientId: string): Promise<string | null> {
		const result = await db
			.select({ codeChallenge: aiMcpOAuthCodes.codeChallenge })
			.from(aiMcpOAuthCodes)
			.where(and(eq(aiMcpOAuthCodes.code, code), eq(aiMcpOAuthCodes.clientId, clientId)))
			.limit(1);

		return result.length > 0 ? result[0].codeChallenge : null;
	}

	/**
	 * Clean up expired and consumed codes (maintenance task)
	 */
	async cleanupCodes(): Promise<number> {
		const now = new Date();
		const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

		const result = await db
			.delete(aiMcpOAuthCodes)
			.where(
				or(
					lt(aiMcpOAuthCodes.expiresAt, cutoff),
					// Also delete consumed codes older than cutoff
					and(
						isNotNull(aiMcpOAuthCodes.consumedAt),
						lt(aiMcpOAuthCodes.consumedAt, cutoff)
					)
				)
			);

		return result.rowCount;
	}
}

// Import the 'or' and 'and' operators from drizzle-orm
import { or, and, isNotNull, lt } from 'drizzle-orm';

// Singleton instance
export const oauthAuthorizationService = new OAuthAuthorizationService();
