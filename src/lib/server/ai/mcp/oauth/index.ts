/**
 * OAuth Module Index
 *
 * Exports all OAuth-related services and utilities.
 */

export { OAuthTokenService, oauthTokenService } from './token-service';
export type { OAuthTokenInfo, CreateTokenResult } from './token-service';

export { OAuthClientsStore, oauthClientsStore } from './clients-store';

export { OAuthAuthorizationService, oauthAuthorizationService } from './authorization-service';
export type { AuthorizationCodeInfo } from './authorization-service';

export { McpOAuthProvider, mcpOAuthProvider } from './oauth-provider';

export {
	scopesToModules,
	modulesToScopes,
	validateScopes,
	getAvailableScopes,
	MCP_OAUTH_SCOPES
} from './scope-mapper';
