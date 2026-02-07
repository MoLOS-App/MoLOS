/**
 * OAuth Authorization Endpoint
 *
 * Handles OAuth 2.0 authorization requests.
 * This endpoint initiates the authorization code flow with PKCE.
 *
 * GET /api/ai/mcp/oauth/authorize
 * - Shows consent screen
 *
 * POST /api/ai/mcp/oauth/authorize
 * - Processes user consent and generates authorization code
 */

import { error, json, redirect, isRedirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { oauthClientsStore } from '$lib/server/ai/mcp/oauth';
import { oauthAuthorizationService } from '$lib/server/ai/mcp/oauth';

/**
 * GET handler - Show authorization/consent screen
 * For non-interactive clients like ChatGPT, auto-approve if user is authenticated
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return redirect(302, `/ui/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
	}

	// Parse authorization request parameters
	const clientId = url.searchParams.get('client_id');
	const redirectUri = url.searchParams.get('redirect_uri');
	const codeChallenge = url.searchParams.get('code_challenge');
	const codeChallengeMethod = url.searchParams.get('code_challenge_method') || 'S256';
	const state = url.searchParams.get('state');
	const scope = url.searchParams.get('scope');
	const resource = url.searchParams.get('resource');

	// Validate required parameters
	if (!clientId || !redirectUri || !codeChallenge) {
		return error(400, 'Missing required parameters: client_id, redirect_uri, or code_challenge');
	}

	// Get client info
	const client = await oauthClientsStore.getClient(clientId);
	if (!client) {
		return error(400, 'Invalid client_id');
	}

	// Validate redirect URI
	const redirectUrl = new URL(redirectUri);

	// Log redirect URI validation details
	console.log('[OAuth] Redirect URI validation:', {
		requestedRedirectUri: redirectUri,
		requestedOrigin: redirectUrl.origin,
		requestedHostname: redirectUrl.hostname,
		requestedPathname: redirectUrl.pathname,
		registeredRedirectUris: client.redirect_uris.map((u) => u.toString())
	});

	// Check if this is a ChatGPT redirect (trusted)
	const chatgptRedirectHosts = ['chatgpt.com', 'chat.openai.com', 'auth0.openai.com'];

	// For ChatGPT, we allow any redirect to the registered hostname
	// since ChatGPT adds dynamic query parameters (state, etc.)
	const isChatgptRedirect = chatgptRedirectHosts.includes(redirectUrl.hostname);

	let isValidRedirect: boolean;
	if (isChatgptRedirect) {
		// For ChatGPT, only check origin (protocol + hostname + port)
		isValidRedirect = client.redirect_uris.some((uri) => uri.origin === redirectUrl.origin);
	} else {
		// For other clients, check both origin and pathname
		isValidRedirect = client.redirect_uris.some(
			(uri) => uri.origin === redirectUrl.origin && uri.pathname === redirectUrl.pathname
		);
	}

	console.log('[OAuth] Redirect URI validation result:', {
		isChatgptRedirect,
		isValidRedirect,
		clientRedirectUris: client.redirect_uris.map((u) => ({
			origin: u.origin,
			pathname: u.pathname
		}))
	});

	if (!isValidRedirect) {
		return error(400, 'Invalid redirect_uri');
	}

	// Parse scopes
	const scopes = scope ? scope.split(' ') : [];

	// Check for non-interactive flow (ChatGPT MCP connector)
	// Auto-approve for trusted ChatGPT redirect URIs when user is authenticated
	if (isChatgptRedirect) {
		try {
			const authCode = await oauthAuthorizationService.createAuthorizationCode(
				client,
				locals.user.id,
				{
					redirectUri,
					codeChallenge,
					codeChallengeMethod,
					state: state ?? undefined,
					scopes: scopes,
					resource: resource ?? undefined
				}
			);

			// Auto-approve: redirect back with authorization code
			const finalRedirectUrl = new URL(redirectUri);
			finalRedirectUrl.searchParams.set('code', authCode.code);
			if (state) {
				finalRedirectUrl.searchParams.set('state', state);
			}

			console.log('[OAuth] Redirecting back to ChatGPT with authorization code:', {
				redirectUrl: finalRedirectUrl.toString(),
				code: authCode.code,
				state,
				registeredRedirectUris: client.redirect_uris.map((u) => u.toString())
			});

			return redirect(302, finalRedirectUrl.toString());
		} catch (err) {
			// If this is a redirect exception, re-throw it
			if (isRedirect(err)) {
				throw err;
			}

			// Log the actual error for debugging
			console.error('[OAuth] Failed to generate authorization code:', err);
			console.error('[OAuth] Error details:', {
				message: err instanceof Error ? err.message : String(err),
				stack: err instanceof Error ? err.stack : undefined,
				clientId,
				userId: locals.user.id,
				scopes,
				redirectUri
			});

			const errorRedirectUrl = new URL(redirectUri);
			errorRedirectUrl.searchParams.set('error', 'server_error');
			errorRedirectUrl.searchParams.set(
				'error_description',
				'Failed to generate authorization code'
			);
			if (state) {
				errorRedirectUrl.searchParams.set('state', state);
			}
			return redirect(302, errorRedirectUrl.toString());
		}
	}

	// Return HTML for consent screen (for interactive clients)
	return new Response(
		`
<!DOCTYPE html>
<html>
<head>
	<title>Authorize ${client.client_name}</title>
	<style>
		body { font-family: system-ui; max-width: 500px; margin: 40px auto; padding: 0 20px; }
		.card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; }
		h1 { margin: 0 0 16px 0; font-size: 24px; }
		.client-info { display: flex; align-items: center; gap: 16px; margin: 20px 0; }
		.client-icon { width: 48px; height: 48px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
		.scope-list { margin: 20px 0; }
		.scope-item { padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
		.buttons { display: flex; gap: 12px; margin-top: 24px; }
		button { flex: 1; padding: 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; }
		.btn-deny { background: #f0f0f0; }
		.btn-approve { background: #2563eb; color: white; }
	</style>
</head>
<body>
	<div class="card">
		<h1>Authorize Application</h1>
		<div class="client-info">
			<div class="client-icon">🔐</div>
			<div>
				<strong>${client.client_name}</strong> wants to access your MoLOS account
			</div>
		</div>
		<p>This application will be able to:</p>
		<div class="scope-list">
			${
				scopes.length > 0
					? scopes.map((s) => `<div class="scope-item">• ${s}</div>`).join('')
					: '<div class="scope-item">• Full access to your account</div>'
			}
		</div>
		<form method="POST" action="/api/ai/mcp/oauth/authorize">
			<input type="hidden" name="client_id" value="${clientId}">
			<input type="hidden" name="redirect_uri" value="${redirectUri}">
			<input type="hidden" name="code_challenge" value="${codeChallenge}">
			<input type="hidden" name="code_challenge_method" value="${codeChallengeMethod}">
			${state ? `<input type="hidden" name="state" value="${state}">` : ''}
			${scopes.length > 0 ? `<input type="hidden" name="scope" value="${scope}">` : ''}
			${resource ? `<input type="hidden" name="resource" value="${resource}">` : ''}
			<div class="buttons">
				<button type="submit" name="action" value="deny" class="btn-deny">Deny</button>
				<button type="submit" name="action" value="approve" class="btn-approve">Approve</button>
			</div>
		</form>
	</div>
</body>
</html>
`,
		{
			headers: { 'Content-Type': 'text/html; charset=utf-8' }
		}
	);
};

/**
 * POST handler - Process consent and generate authorization code
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return error(401, 'Authentication required');
	}

	const formData = await request.formData();
	const action = formData.get('action');
	const clientId = formData.get('client_id') as string;
	const redirectUri = formData.get('redirect_uri') as string;
	const codeChallenge = formData.get('code_challenge') as string;
	const codeChallengeMethod = (formData.get('code_challenge_method') as string) || 'S256';
	const state = formData.get('state') as string | null;
	const scope = formData.get('scope') as string | null;
	const resource = formData.get('resource') as string | null;

	// Validate required parameters
	if (!clientId || !redirectUri || !codeChallenge) {
		return error(400, 'Missing required parameters');
	}

	// Get client info
	const client = await oauthClientsStore.getClient(clientId);
	if (!client) {
		return error(400, 'Invalid client_id');
	}

	const scopes = scope ? scope.split(' ') : [];

	// Handle user denial
	if (action === 'deny') {
		const redirectUrl = new URL(redirectUri);
		redirectUrl.searchParams.set('error', 'access_denied');
		redirectUrl.searchParams.set('error_description', 'User denied the authorization request');
		if (state) {
			redirectUrl.searchParams.set('state', state);
		}
		return redirect(302, redirectUrl.toString());
	}

	// User approved - generate authorization code
	try {
		const authCode = await oauthAuthorizationService.createAuthorizationCode(
			client,
			locals.user.id,
			{
				redirectUri,
				codeChallenge,
				codeChallengeMethod,
				state: state ?? undefined,
				// Always pass array (empty array is valid for DB schema which requires non-null)
				scopes: scopes,
				resource: resource ?? undefined
			}
		);

		// Redirect back with authorization code
		const redirectUrl = new URL(redirectUri);
		redirectUrl.searchParams.set('code', authCode.code);
		if (state) {
			redirectUrl.searchParams.set('state', state);
		}
		return redirect(302, redirectUrl.toString());
	} catch (err) {
		// If this is a redirect exception, re-throw it
		if (isRedirect(err)) {
			throw err;
		}

		// Log the actual error for debugging
		console.error('[OAuth POST] Failed to generate authorization code:', err);
		console.error('[OAuth POST] Error details:', {
			message: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
			clientId,
			userId: locals.user.id,
			scopes,
			redirectUri
		});

		const redirectUrl = new URL(redirectUri);
		redirectUrl.searchParams.set('error', 'server_error');
		redirectUrl.searchParams.set('error_description', 'Failed to generate authorization code');
		if (state) {
			redirectUrl.searchParams.set('state', state);
		}
		return redirect(302, redirectUrl.toString());
	}
};
