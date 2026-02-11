/**
 * Favicon endpoint - serves a small favicon for MCP connector compatibility
 *
 * The default favicon.svg (138KB) is too large for ChatGPT's MCP connector.
 * This endpoint serves the smaller logo-144.png (8KB) as the favicon.
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	// Redirect to the small PNG logo (8KB, under 10KB limit)
	redirect(302, '/pwa-assets/logo-144.png');
};
