#!/usr/bin/env node

/**
 * Playwright MCP Server
 *
 * Provides UI testing capabilities via the Model Context Protocol.
 * OpenCode agents can use this to test the MoLOS UI for errors.
 *
 * Usage:
 *   npx tsx src/index.ts
 *   playwright-mcp  (after npm install -g)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v4';
import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== 'false';

interface BrowserSession {
	browser: Browser;
	context: BrowserContext;
	pages: Map<string, Page>;
}

const sessions = new Map<string, BrowserSession>();
let currentSessionId = 'default';

async function getOrCreateSession(sessionId: string): Promise<BrowserSession> {
	if (!sessions.has(sessionId)) {
		const browser = await chromium.launch({ headless: HEADLESS });
		const context = await browser.newContext();
		sessions.set(sessionId, { browser, context, pages: new Map() });
	}
	return sessions.get(sessionId)!;
}

async function getPage(sessionId: string, pageId: string): Promise<Page | undefined> {
	const session = sessions.get(sessionId);
	return session?.pages.get(pageId);
}

const server = new McpServer({
	name: 'playwright-mcp',
	version: '1.0.0'
});

server.registerTool(
	'navigate',
	{
		title: 'Navigate',
		description: 'Navigate to a URL in the browser',
		inputSchema: {
			url: z.string().describe('URL to navigate to'),
			waitUntil: z
				.enum(['load', 'domcontentloaded', 'networkidle'])
				.optional()
				.describe('When to consider navigation complete')
		}
	},
	async ({ url, waitUntil = 'networkidle' }) => {
		const session = await getOrCreateSession(currentSessionId);
		const page = await session.context.newPage();
		const pageId = `page_${Date.now()}`;
		session.pages.set(pageId, page);

		await page.goto(url, { waitUntil: waitUntil as 'load' | 'domcontentloaded' | 'networkidle' });

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(
						{
							success: true,
							pageId,
							url: page.url(),
							title: await page.title()
						},
						null,
						2
					)
				}
			]
		};
	}
);

server.registerTool(
	'click',
	{
		title: 'Click',
		description: 'Click an element on the page',
		inputSchema: {
			selector: z.string().describe('CSS selector or text to click'),
			pageId: z.string().optional().describe('Page ID (optional, uses last page if not specified)'),
			options: z
				.object({
					button: z.enum(['left', 'right', 'middle']).optional(),
					clickCount: z.number().optional(),
					force: z.boolean().optional()
				})
				.optional()
		}
	},
	async ({ selector, pageId, options = {} }) => {
		const targetPageId =
			pageId || Array.from((await getOrCreateSession(currentSessionId)).pages.keys()).pop();
		const page = await getPage(currentSessionId, targetPageId!);

		if (!page) {
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({ success: false, error: `Page not found: ${targetPageId}` })
					}
				]
			};
		}

		await page.click(selector, options as any);

		return {
			content: [{ type: 'text' as const, text: JSON.stringify({ success: true, selector }) }]
		};
	}
);

server.registerTool(
	'fill',
	{
		title: 'Fill',
		description: 'Fill an input field with text',
		inputSchema: {
			selector: z.string().describe('CSS selector for the input'),
			value: z.string().describe('Text to fill'),
			pageId: z.string().optional().describe('Page ID (optional)'),
			pressEnter: z.boolean().optional().describe('Press Enter after filling')
		}
	},
	async ({ selector, value, pageId, pressEnter = false }) => {
		const targetPageId =
			pageId || Array.from((await getOrCreateSession(currentSessionId)).pages.keys()).pop();
		const page = await getPage(currentSessionId, targetPageId!);

		if (!page) {
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({ success: false, error: `Page not found: ${targetPageId}` })
					}
				]
			};
		}

		await page.fill(selector, value);

		if (pressEnter) {
			await page.press(selector, 'Enter');
		}

		return {
			content: [{ type: 'text' as const, text: JSON.stringify({ success: true, selector, value }) }]
		};
	}
);

server.registerTool(
	'get_text',
	{
		title: 'Get Text',
		description: 'Get text content from an element',
		inputSchema: {
			selector: z.string().describe('CSS selector'),
			pageId: z.string().optional().describe('Page ID (optional)')
		}
	},
	async ({ selector, pageId }) => {
		const targetPageId =
			pageId || Array.from((await getOrCreateSession(currentSessionId)).pages.keys()).pop();
		const page = await getPage(currentSessionId, targetPageId!);

		if (!page) {
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({ success: false, error: `Page not found: ${targetPageId}` })
					}
				]
			};
		}

		const text = await page.textContent(selector);
		return {
			content: [{ type: 'text' as const, text: JSON.stringify({ success: true, selector, text }) }]
		};
	}
);

server.registerTool(
	'get_attribute',
	{
		title: 'Get Attribute',
		description: 'Get an attribute value from an element',
		inputSchema: {
			selector: z.string().describe('CSS selector'),
			attribute: z.string().describe('Attribute name'),
			pageId: z.string().optional().describe('Page ID (optional)')
		}
	},
	async ({ selector, attribute, pageId }) => {
		const targetPageId =
			pageId || Array.from((await getOrCreateSession(currentSessionId)).pages.keys()).pop();
		const page = await getPage(currentSessionId, targetPageId!);

		if (!page) {
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({ success: false, error: `Page not found: ${targetPageId}` })
					}
				]
			};
		}

		const value = await page.getAttribute(selector, attribute);
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({ success: true, selector, attribute, value })
				}
			]
		};
	}
);

server.registerTool(
	'evaluate',
	{
		title: 'Evaluate',
		description: 'Execute JavaScript in the page context',
		inputSchema: {
			script: z.string().describe('JavaScript code to execute'),
			pageId: z.string().optional().describe('Page ID (optional)')
		}
	},
	async ({ script, pageId }) => {
		const targetPageId =
			pageId || Array.from((await getOrCreateSession(currentSessionId)).pages.keys()).pop();
		const page = await getPage(currentSessionId, targetPageId!);

		if (!page) {
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({ success: false, error: `Page not found: ${targetPageId}` })
					}
				]
			};
		}

		const result = await page.evaluate(script);
		return {
			content: [{ type: 'text' as const, text: JSON.stringify({ success: true, result }) }]
		};
	}
);

server.registerTool(
	'screenshot',
	{
		title: 'Screenshot',
		description: 'Take a screenshot of the page',
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe('File path to save screenshot (optional, returns base64 if not set)'),
			fullPage: z.boolean().optional().describe('Capture full scrollable page'),
			pageId: z.string().optional().describe('Page ID (optional)')
		}
	},
	async ({ path, fullPage = false, pageId }) => {
		const targetPageId =
			pageId || Array.from((await getOrCreateSession(currentSessionId)).pages.keys()).pop();
		const page = await getPage(currentSessionId, targetPageId!);

		if (!page) {
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({ success: false, error: `Page not found: ${targetPageId}` })
					}
				]
			};
		}

		if (path) {
			await page.screenshot({ path, fullPage });
			return {
				content: [{ type: 'text' as const, text: JSON.stringify({ success: true, path }) }]
			};
		} else {
			const buffer = await page.screenshot({ fullPage });
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({ success: true, screenshot: buffer.toString('base64') })
					}
				]
			};
		}
	}
);

server.registerTool(
	'wait_for_selector',
	{
		title: 'Wait for Selector',
		description: 'Wait for an element to appear on the page',
		inputSchema: {
			selector: z.string().describe('CSS selector'),
			state: z
				.enum(['attached', 'detached', 'visible', 'hidden'])
				.optional()
				.describe('Element state'),
			timeout: z.number().optional().describe('Timeout in milliseconds'),
			pageId: z.string().optional().describe('Page ID (optional)')
		}
	},
	async ({ selector, state = 'visible', timeout = 30000, pageId }) => {
		const targetPageId =
			pageId || Array.from((await getOrCreateSession(currentSessionId)).pages.keys()).pop();
		const page = await getPage(currentSessionId, targetPageId!);

		if (!page) {
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({ success: false, error: `Page not found: ${targetPageId}` })
					}
				]
			};
		}

		await page.waitForSelector(selector, { state, timeout });
		return {
			content: [{ type: 'text' as const, text: JSON.stringify({ success: true, selector, state }) }]
		};
	}
);

server.registerTool(
	'wait_for_timeout',
	{
		title: 'Wait for Timeout',
		description: 'Wait for a specified duration',
		inputSchema: {
			duration: z.number().describe('Duration in milliseconds')
		}
	},
	async ({ duration }) => {
		await new Promise((resolve) => setTimeout(resolve, duration));
		return {
			content: [{ type: 'text' as const, text: JSON.stringify({ success: true, duration }) }]
		};
	}
);

server.registerTool(
	'check_errors',
	{
		title: 'Check Errors',
		description: 'Check for console errors and page errors on the current page',
		inputSchema: {
			pageId: z.string().optional().describe('Page ID (optional)')
		}
	},
	async ({ pageId }) => {
		const targetPageId =
			pageId || Array.from((await getOrCreateSession(currentSessionId)).pages.keys()).pop();
		const page = await getPage(currentSessionId, targetPageId!);

		if (!page) {
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({ success: false, error: `Page not found: ${targetPageId}` })
					}
				]
			};
		}

		const errors: Array<{
			type: string;
			message: string;
			location?: { url: string; lineNumber: number };
		}> = [];

		const consoleHandler = (msg: any) => {
			if (msg.type() === 'error') {
				errors.push({ type: 'console.error', message: msg.text(), location: msg.location() });
			}
		};

		const pageErrorHandler = (err: any) => {
			errors.push({ type: 'pageerror', message: err.message });
		};

		page.on('console', consoleHandler);
		page.on('pageerror', pageErrorHandler);

		await page.reload();
		await page.waitForLoadState('networkidle');

		page.off('console', consoleHandler);
		page.off('pageerror', pageErrorHandler);

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(
						{
							success: true,
							errors,
							errorCount: errors.length,
							hasErrors: errors.length > 0
						},
						null,
						2
					)
				}
			]
		};
	}
);

server.registerTool(
	'get_page_info',
	{
		title: 'Get Page Info',
		description: 'Get information about the current page',
		inputSchema: {
			pageId: z.string().optional().describe('Page ID (optional)')
		}
	},
	async ({ pageId }) => {
		const targetPageId =
			pageId || Array.from((await getOrCreateSession(currentSessionId)).pages.keys()).pop();
		const page = await getPage(currentSessionId, targetPageId!);

		if (!page) {
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({ success: false, error: `Page not found: ${targetPageId}` })
					}
				]
			};
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(
						{
							success: true,
							url: page.url(),
							title: await page.title(),
							viewport: page.viewportSize(),
							pageId: targetPageId
						},
						null,
						2
					)
				}
			]
		};
	}
);

server.registerTool(
	'close_page',
	{
		title: 'Close Page',
		description: 'Close a specific page or the current page',
		inputSchema: {
			pageId: z
				.string()
				.optional()
				.describe('Page ID (optional, closes last page if not specified)')
		}
	},
	async ({ pageId }) => {
		const session = await getOrCreateSession(currentSessionId);
		const targetPageId = pageId || Array.from(session.pages.keys()).pop();

		if (!targetPageId) {
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify({ success: true, message: 'No pages to close' })
					}
				]
			};
		}

		const page = session.pages.get(targetPageId);
		if (page) {
			await page.close();
			session.pages.delete(targetPageId);
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({ success: true, closedPageId: targetPageId })
				}
			]
		};
	}
);

server.registerTool(
	'list_pages',
	{
		title: 'List Pages',
		description: 'List all open pages in the current session',
		inputSchema: {}
	},
	async () => {
		const session = sessions.get(currentSessionId);
		if (!session) {
			return {
				content: [{ type: 'text' as const, text: JSON.stringify({ success: true, pages: [] }) }]
			};
		}

		const pages: Array<{ pageId: string; url: string }> = [];
		for (const [pageId, page] of session.pages) {
			pages.push({ pageId, url: page.url() });
		}

		return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, pages }) }] };
	}
);

server.registerTool(
	'set_session',
	{
		title: 'Set Session',
		description: 'Set or create a browser session',
		inputSchema: {
			sessionId: z.string().describe('Session ID to switch to')
		}
	},
	async ({ sessionId }) => {
		currentSessionId = sessionId;
		await getOrCreateSession(sessionId);
		return {
			content: [{ type: 'text' as const, text: JSON.stringify({ success: true, sessionId }) }]
		};
	}
);

server.registerTool(
	'close_session',
	{
		title: 'Close Session',
		description: 'Close a browser session and all its pages',
		inputSchema: {
			sessionId: z.string().optional().describe('Session ID to close (default: current session)')
		}
	},
	async ({ sessionId }) => {
		const targetSessionId = sessionId || currentSessionId;
		const session = sessions.get(targetSessionId);

		if (session) {
			for (const page of session.pages.values()) {
				await page.close();
			}
			await session.browser.close();
			sessions.delete(targetSessionId);

			if (targetSessionId === currentSessionId) {
				currentSessionId = 'default';
			}
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({ success: true, closedSessionId: targetSessionId })
				}
			]
		};
	}
);

server.registerTool(
	'ui_test_check_errors',
	{
		title: 'UI Test - Check Errors',
		description:
			'Test a UI page for console errors and page errors - combines navigation, error checking, and reporting',
		inputSchema: {
			url: z.string().describe('URL to test'),
			waitForSelector: z.string().optional().describe('Optional selector to wait for after load'),
			expectedErrors: z
				.number()
				.optional()
				.describe('Expected number of errors (test will fail if different)')
		}
	},
	async ({ url, waitForSelector, expectedErrors = 0 }) => {
		const session = await getOrCreateSession(currentSessionId);
		const page = await session.context.newPage();
		const pageId = `test_${Date.now()}`;
		session.pages.set(pageId, page);

		const errors: any[] = [];

		const consoleHandler = (msg: any) => {
			if (msg.type() === 'error') {
				errors.push({ type: 'console.error', message: msg.text(), location: msg.location() });
			}
		};

		const pageErrorHandler = (err: any) => {
			errors.push({ type: 'pageerror', message: err.message });
		};

		page.on('console', consoleHandler);
		page.on('pageerror', pageErrorHandler);

		try {
			await page.goto(url, { waitUntil: 'networkidle' });

			if (waitForSelector) {
				await page.waitForSelector(waitForSelector, { timeout: 10000 }).catch(() => {
					errors.push({ type: 'warning', message: `Selector not found: ${waitForSelector}` });
				});
			}

			const title = await page.title();

			page.off('console', consoleHandler);
			page.off('pageerror', pageErrorHandler);

			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(
							{
								success: true,
								url,
								title,
								pageId,
								errors,
								errorCount: errors.length,
								hasErrors: errors.length > 0,
								testPassed: errors.length === expectedErrors,
								message:
									errors.length === 0
										? 'No errors detected'
										: `Found ${errors.length} error(s): ${errors.map((e) => e.message).join(', ')}`
							},
							null,
							2
						)
					}
				]
			};
		} catch (err: any) {
			page.off('console', consoleHandler);
			page.off('pageerror', pageErrorHandler);

			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(
							{
								success: false,
								url,
								errors: [...errors, { type: 'navigation-error', message: err.message }],
								errorCount: errors.length + 1,
								hasErrors: true,
								testPassed: false,
								message: `Navigation failed: ${err.message}`
							},
							null,
							2
						)
					}
				]
			};
		}
	}
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('Playwright MCP server started');
}

main().catch(console.error);
