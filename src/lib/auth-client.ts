import { createAuthClient } from 'better-auth/svelte';
import { adminClient, apiKeyClient } from 'better-auth/client/plugins';

/**
 * Auth client configuration.
 * Uses VITE_PUBLIC_ORIGIN if set, otherwise falls back to browser's current origin.
 *
 * For production deployments, set:
 *   VITE_PUBLIC_ORIGIN=http://192.168.1.40:4173
 *   or
 *   VITE_PUBLIC_ORIGIN=https://molos.example.com
 */
export const authClient = createAuthClient({
	// Use explicit origin if set (for SSR/production), otherwise let browser determine
	baseURL: import.meta.env.VITE_PUBLIC_ORIGIN || undefined,
	plugins: [adminClient(), apiKeyClient()]
});
