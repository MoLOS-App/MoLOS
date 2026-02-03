/**
 * MoLOS MCP Standalone Server
 *
 * Runs an Express server with MCP support using the official SDK
 * This runs on a separate port from SvelteKit
 *
 * Run with: node dist/server/mcp-standalone.js
 * Or with tsx: tsx src/server/mcp-standalone.ts
 */

import { createMcpExpressApp } from '$lib/server/ai/mcp/mcp-server.js';

const MCP_PORT = parseInt(process.env.MCP_PORT || '3001', 10);

async function startServer() {
	console.log('[MoLOS MCP] Starting server...');

	const app = await createMcpExpressApp();

	app.listen(MCP_PORT, () => {
		console.log(`[MoLOS MCP] Server listening on http://localhost:${MCP_PORT}`);
		console.log(`[MoLOS MCP] MCP endpoint: http://localhost:${MCP_PORT}/mcp`);
		console.log('[MoLOS MCP] Press Ctrl+C to stop');
	});
}

// Start the server
startServer().catch((error) => {
	console.error('[MoLOS MCP] Failed to start server:', error);
	process.exit(1);
});
