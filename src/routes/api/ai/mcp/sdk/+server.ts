/**
 * MCP Server Endpoint using Official SDK
 *
 * This endpoint uses @modelcontextprotocol/sdk for proper MCP protocol handling
 * Route: /api/ai/mcp/sdk
 */

import type { RequestHandler } from './$types';
import { createMcpExpressApp } from '$lib/server/ai/mcp/mcp-server';

// Create and cache the Express app
let mcpApp: any = null;

async function getMcpApp() {
	if (!mcpApp) {
		mcpApp = await createMcpExpressApp();
	}
	return mcpApp;
}

/**
 * Forward request to the MCP Express app
 */
async function forwardRequest(method: string, request: Request): Promise<Response> {
	const app = await getMcpApp();

	// Create a mock Express request/response
	const url = new URL(request.url);
	const headers: Record<string, string> = {};
	request.headers.forEach((value, key) => {
		headers[key] = value;
	});

	const req = {
		method,
		url: url.pathname + url.search,
		headers,
		body: await request.text(),
		query: Object.fromEntries(url.searchParams.entries())
	};

	// Create a promise-based response
	return new Promise((resolve, reject) => {
		const res = {
			status: (code: number) => {
				const responseHeaders: Record<string, string> = {};
				return {
					json: (data: any) => {
						resolve(
							new Response(JSON.stringify(data), {
								status: code,
								headers: { 'Content-Type': 'application/json' }
							})
						);
					},
					send: (data: any) => {
						resolve(
							new Response(data || '', {
								status: code,
								headers: { 'Content-Type': 'text/plain' }
							})
						);
					},
					setHeader: (name: string, value: string) => {
						responseHeaders[name] = value;
						return res;
					},
					get: (name: string) => responseHeaders[name]
				};
			},
			end: (data: any) => {
				resolve(new Response(data || '', { status: 200 }));
			}
		};

		// Route to the appropriate handler
		if (method === 'POST') {
			app._router?.handle?.(req, res);
		} else if (method === 'GET') {
			app._router?.handle?.(req, res);
		} else if (method === 'DELETE') {
			app._router?.handle?.(req, res);
		} else {
			resolve(new Response('Method Not Allowed', { status: 405 }));
		}
	});
}

export const POST: RequestHandler = async (request) => {
	return forwardRequest('POST', request);
};

export const GET: RequestHandler = async (request) => {
	return forwardRequest('GET', request);
};

export const DELETE: RequestHandler = async (request) => {
	return forwardRequest('DELETE', request);
};
