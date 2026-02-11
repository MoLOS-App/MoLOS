/**
 * OAuth Provider Implementation
 *
 * Implements OAuthServerProvider from MCP SDK for full OAuth 2.0 support.
 * This provider handles authorization, token exchange, and token verification.
 */

// Local type definitions to avoid SDK import issues
interface OAuthServerProvider {
	clientsStore: unknown;
	challengeForAuthorizationCode(client: unknown, authorizationCode: string): Promise<string>;
	exchangeAuthorizationCode(
		client: unknown,
		authorizationCode: string,
		codeVerifier?: string,
		redirectUri?: string,
		resource?: URL
	): Promise<OAuthTokens>;
	verifyAccessToken(token: string): Promise<AuthInfo | null>;
	verifyRefreshToken(token: string): Promise<AuthInfo | null>;
	revokeToken(
		client: OAuthClientInformationFull,
		request: OAuthTokenRevocationRequest
	): Promise<void>;
}
interface AuthorizationParams {
	client_id: string;
	redirect_uri: string;
	response_type?: string;
	scope?: string;
	state?: string;
	code_challenge?: string;
	code_challenge_method?: string;
	resource?: URL;
}
interface OAuthTokens {
	access_token: string;
	refresh_token?: string;
	expires_at: number;
	expires_in: number;
	token_type: string;
	scope?: string;
}
interface OAuthTokenRevocationRequest {
	token: string;
	token_type_hint?: string;
}
interface AuthInfo {
	id?: string;
	token: string;
	clientId: string;
	scopes: string[];
	expiresAt?: number;
	resource?: URL;
	tokenType?: string;
	extra?: Record<string, unknown>;
}
import type { OAuthClientInformationFull } from './clients-store.js';
import { oauthTokenService } from './token-service';
import { oauthClientsStore } from './clients-store';
import { oauthAuthorizationService } from './authorization-service';

/**
 * MCP OAuth Provider
 *
 * Implements the full OAuth 2.0 authorization server functionality.
 */
export class McpOAuthProvider implements OAuthServerProvider {
	// Clients store accessor
	get clientsStore() {
		return oauthClientsStore;
	}

	/**
	 * Begin the authorization flow
	 *
	 * For a self-contained OAuth server, this would render a consent screen
	 * and handle the user's approval. For this implementation, we'll redirect
	 * to a consent page in the MoLOS UI.
	 */
	async authorize(
		client: OAuthClientInformationFull,
		params: AuthorizationParams,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_res: unknown
	): Promise<void> {
		// This is typically called from the MCP SDK's authorization handler
		// For a web-based flow, we would:
		// 1. Store the authorization request in session/cache
		// 2. Redirect to a consent screen UI
		// 3. After user approval, generate the auth code and redirect back

		// For now, we'll implement a simplified flow that assumes consent
		// is handled separately (see authorization API route)

		// The actual implementation will be in the API route handler
		// This method is here for SDK compatibility
		throw new Error(
			'Authorization should be handled via API route. See /api/ai/mcp/oauth/authorize'
		);
	}

	/**
	 * Get the code challenge for a given authorization code
	 */
	async challengeForAuthorizationCode(
		_client: OAuthClientInformationFull,
		authorizationCode: string
	): Promise<string> {
		const challenge = await oauthAuthorizationService.getCodeChallenge(
			authorizationCode,
			_client.client_id
		);

		if (!challenge) {
			throw new Error('Invalid or expired authorization code');
		}

		return challenge;
	}

	/**
	 * Exchange an authorization code for an access token
	 */
	async exchangeAuthorizationCode(
		client: OAuthClientInformationFull,
		authorizationCode: string,
		codeVerifier?: string,
		redirectUri?: string,
		resource?: URL
	): Promise<OAuthTokens> {
		// Validate and consume the authorization code
		const codeInfo = await oauthAuthorizationService.validateAndConsumeCode(
			authorizationCode,
			client.client_id
		);

		if (!codeInfo) {
			throw new Error('Invalid or expired authorization code');
		}

		// Verify redirect URI matches
		if (redirectUri && codeInfo.redirectUri !== redirectUri) {
			throw new Error('Redirect URI mismatch');
		}

		// Verify PKCE code challenge if verifier provided
		if (codeVerifier) {
			// Recreate the code challenge from the verifier
			const crypto = await import('crypto');
			const expectedChallenge = crypto
				.createHash('sha256')
				.update(codeVerifier)
				.digest('base64url');

			if (codeInfo.codeChallenge !== expectedChallenge) {
				throw new Error('Invalid code verifier');
			}
		}

		// Determine scopes (use requested scopes or client's default scopes)
		const scopes = codeInfo.scopes.length > 0 ? codeInfo.scopes : (client.scope?.split(' ') ?? []);

		// Create token pair
		const { accessToken, refreshToken } = await oauthTokenService.createTokenPair(
			client.client_id,
			codeInfo.userId,
			scopes
		);

		// Build OAuth tokens response
		const tokens: OAuthTokens = {
			access_token: accessToken.token,
			expires_at: Math.floor(accessToken.expiresAt.getTime() / 1000),
			token_type: 'Bearer',
			expires_in: Math.floor((accessToken.expiresAt.getTime() - Date.now()) / 1000),
			scope: scopes.join(' '),
			refresh_token: refreshToken.token
		};

		return tokens;
	}

	/**
	 * Verify a refresh token specifically
	 */
	async verifyRefreshToken(token: string): Promise<AuthInfo | null> {
		const tokenInfo = await this.verifyAccessToken(token);
		if (!tokenInfo) {
			return null;
		}
		if (tokenInfo.tokenType !== 'refresh') {
			return null;
		}
		return tokenInfo;
	}

	/**
	 * Exchange a refresh token for a new access token
	 */
	async exchangeRefreshToken(
		client: OAuthClientInformationFull,
		refreshToken: string,
		scopes?: string[],
		resource?: URL
	): Promise<OAuthTokens> {
		// Verify the refresh token
		const tokenInfo = await oauthTokenService.verifyRefreshToken(refreshToken);

		if (!tokenInfo) {
			throw new Error('Invalid or expired refresh token');
		}

		// Verify the refresh token belongs to this client
		if (tokenInfo.clientId !== client.client_id) {
			throw new Error('Refresh token does not belong to this client');
		}

		// Determine scopes (requested or original)
		const effectiveScopes = scopes && scopes.length > 0 ? scopes : tokenInfo.scopes;

		// Create new token pair
		const { accessToken, refreshToken: newRefreshToken } = await oauthTokenService.createTokenPair(
			client.client_id,
			tokenInfo.userId,
			effectiveScopes
		);

		// Revoke the old refresh token (rotation)
		await oauthTokenService.revokeToken(refreshToken);

		// Build OAuth tokens response
		const tokens: OAuthTokens = {
			access_token: accessToken.token,
			token_type: 'Bearer',
			expires_in: Math.floor((accessToken.expiresAt.getTime() - Date.now()) / 1000),
			scope: effectiveScopes.join(' '),
			refresh_token: newRefreshToken.token
		};

		return tokens;
	}

	/**
	 * Verify an access token and return auth info
	 */
	async verifyAccessToken(token: string): Promise<AuthInfo> {
		const tokenInfo = await oauthTokenService.verifyAccessToken(token);

		if (!tokenInfo) {
			throw new Error('Invalid or expired access token');
		}

		const authInfo: AuthInfo = {
			token,
			clientId: tokenInfo.clientId,
			scopes: tokenInfo.scopes,
			expiresAt: tokenInfo.expiresAt ? Math.floor(tokenInfo.expiresAt.getTime() / 1000) : undefined
		};

		return authInfo;
	}

	/**
	 * Revoke an access or refresh token
	 */
	async revokeToken(
		client: OAuthClientInformationFull,
		request: OAuthTokenRevocationRequest
	): Promise<void> {
		// Verify the token belongs to this client before revoking
		const tokenInfo = await oauthTokenService.verifyToken(request.token);

		if (tokenInfo && tokenInfo.clientId === client.client_id) {
			// If it's a refresh token, cascade revoke all associated access tokens
			if (tokenInfo.tokenType === 'refresh') {
				await oauthTokenService.revokeRefreshTokenCascade(tokenInfo.id);
			} else {
				await oauthTokenService.revokeToken(request.token);
			}
		}

		// Per RFC 7009, we should not return an error even if token is invalid
		// (to avoid token enumeration attacks)
	}
}

// Singleton instance
export const mcpOAuthProvider = new McpOAuthProvider();
