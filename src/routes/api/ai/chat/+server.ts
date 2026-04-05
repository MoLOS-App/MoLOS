import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MolosAgentAdapter } from '$lib/server/ai/molos-agent-adapter';
import { AiRepository } from '$lib/repositories/ai/ai-repository';
import type { UIMessage } from 'ai';

/**
 * AI Chat API Endpoint
 *
 * Supports both legacy SSE format and AI SDK v5+ UIMessage format.
 * Supports multi-message streaming via message_segment events.
 */

const chunkText = (text: string, size: number = 32): string[] => {
	if (!text) return [''];
	const chunks: string[] = [];
	for (let i = 0; i < text.length; i += size) {
		chunks.push(text.slice(i, i + size));
	}
	return chunks.length > 0 ? chunks : [''];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extract thought and plan tags from content
 */
function extractThoughtAndPlan(content: string): {
	thought: string | null;
	plan: string | null;
	cleanContent: string;
} {
	const thoughtMatch = content.match(/<thought>([\s\S]*?)<\/thought>/);
	const planMatch = content.match(/<plan>([\s\S]*?)<\/plan>/);

	const thought = thoughtMatch ? thoughtMatch[1].trim() : null;
	const plan = planMatch ? planMatch[1].trim() : null;

	const cleanContent = content
		.replace(/<thought>[\s\S]*?<\/thought>/, '')
		.replace(/<plan>[\s\S]*?<\/plan>/, '')
		.trim();

	return { thought, plan, cleanContent };
}

/**
 * Log server events for debugging (reduced verbosity)
 */
function serverLog(type: string, data: Record<string, unknown>) {
	// Only log essential info, skip verbose data
	if (type === 'EVENT:text_delta' || type === 'EVENT:chunk' || type === 'PROGRESS') {
		return; // Skip very verbose events
	}
	const summary = Object.keys(data).slice(0, 3).join(', ');
	console.log(`[AI Chat] ${type} ${summary}`);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const {
		messages,
		content: directContent,
		sessionId,
		actionToExecute,
		activeModuleIds,
		mentionedModuleIds,
		attachments,
		parts,
		stream: streamRequested = true
	} = body;

	serverLog('REQUEST', {
		sessionId,
		hasMessages: !!messages,
		messageCount: messages?.length,
		content: directContent?.substring(0, 50),
		activeModuleIds,
		mentionedModuleIds
	});

	const agent = new MolosAgentAdapter(locals.user.id);
	const aiRepo = new AiRepository();
	const settings = await aiRepo.getSettings(locals.user.id);
	const shouldStream = Boolean(streamRequested && (settings?.streamEnabled ?? true));

	// Handle confirmed action execution
	if (actionToExecute) {
		const response = await agent.processActionConfirmation(
			actionToExecute,
			sessionId,
			activeModuleIds
		);
		return json({ ...response, sessionId });
	}

	// Extract content from messages (AI SDK sends 'messages' array)
	const lastMessage = messages?.[messages.length - 1];
	let content = directContent;

	// Handle AI SDK v5+ UIMessage format with parts
	if (!content && lastMessage?.parts) {
		content = lastMessage.parts
			.filter((p: any) => p.type === 'text')
			.map((p: any) => p.text)
			.join('');
	}

	// Fallback to direct content property (legacy format)
	if (!content) {
		content = lastMessage?.content;
	}

	const messageParts = parts || lastMessage?.parts;
	const messageAttachments = attachments || lastMessage?.attachments;

	if (!content && !messageAttachments) {
		return json({ error: 'Content is required' }, { status: 400 });
	}

	let activeSessionId = sessionId;

	if (!activeSessionId) {
		const session = await aiRepo.createSession(locals.user.id, content?.substring(0, 30) + '...');
		activeSessionId = session.id;
		serverLog('SESSION_CREATED', { sessionId: activeSessionId });
	}

	try {
		if (shouldStream) {
			const encoder = new TextEncoder();

			const stream = new ReadableStream({
				async start(controller) {
					const safeEnqueue = (data: Uint8Array) => {
						try {
							controller.enqueue(data);
						} catch (e) {
							console.warn('Stream enqueue failed:', e);
						}
					};

					const sendEvent = (type: string, data: Record<string, unknown>) => {
						safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
					};

					try {
						// Send session ID
						sendEvent('meta', { sessionId: activeSessionId });

						// Get messages from request
						const messagesForAgent =
							messages?.slice(0, -1).map((m: any) => ({
								role: m.role,
								content: m.parts?.find((p: any) => p.type === 'text')?.text || m.content || ''
							})) || [];

						// Stream response
						for await (const chunk of agent.streamResponse(
							messagesForAgent,
							content,
							activeSessionId,
							(event: any) => {
								// Forward tool execution progress events to client
								switch (event.type) {
									case 'tool_start':
										sendEvent('tool_start', {
											toolName: event.toolName,
											toolCallId: event.toolCallId,
											input: event.arguments
										});
										break;
									case 'tool_complete':
										sendEvent('tool_complete', {
											toolName: event.toolName,
											toolCallId: event.toolCallId,
											result: event.success ? event.output : undefined,
											error: event.success ? undefined : event.error
										});
										break;
									default:
										// Pass through other events (text, step_start, etc.)
										sendEvent(event.type, event.data || event);
								}
							},
							messageAttachments,
							messageParts
						)) {
							// Handle chunks from streamResponse()
							switch (chunk.type) {
								case 'text-delta':
									sendEvent('text_delta', { delta: chunk.delta });
									break;
								case 'tool-call-start':
									sendEvent('tool_start', {
										toolName: chunk.toolName,
										toolCallId: chunk.toolCallId
									});
									break;
								case 'tool-call-delta':
									sendEvent('tool_delta', {
										toolCallId: chunk.toolCallId,
										delta: chunk.delta
									});
									break;
								case 'tool-call-end':
									sendEvent('tool_end', {
										toolCallId: chunk.toolCallId,
										result: chunk.result
									});
									break;
								case 'finish':
									sendEvent('meta', {
										sessionId: activeSessionId,
										finishReason: chunk.reason,
										usage: chunk.usage
									});
									break;
								case 'error':
									sendEvent('error', { message: chunk.error });
									break;
							}
						}

						safeEnqueue(encoder.encode('data: [DONE]\n\n'));
						controller.close();
					} catch (error) {
						console.error('[MolosAgent] Stream error:', error);
						sendEvent('error', { message: (error as Error).message });
						safeEnqueue(encoder.encode('data: [DONE]\n\n'));
						controller.close();
					}
				}
			});

			return new Response(stream, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					Connection: 'keep-alive',
					'X-Accel-Buffering': 'no'
				}
			});
		} else {
			// Non-streaming response
			const response = await agent.processMessage(
				content,
				activeSessionId,
				activeModuleIds || [],
				messageAttachments,
				messageParts,
				{ mentionedModuleIds: mentionedModuleIds || [] }
			);
			return json({ ...response, sessionId: activeSessionId });
		}
	} catch (error) {
		console.error('[AI Chat] Error in AI Chat POST:', error);
		const errorMessage = (error as any)?.message || 'Internal Server Error';
		const errorType = (error as any)?.constructor?.name || 'Error';

		// Return structured error response to client
		return json(
			{
				error: errorMessage,
				errorType,
				success: false,
				timestamp: Date.now()
			},
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const aiRepo = new AiRepository();
	const sessionId = url.searchParams.get('sessionId');

	if (sessionId) {
		const messages = await aiRepo.getMessages(sessionId, locals.user.id);
		// Convert to UIMessage format for AI SDK compatibility
		// Include contextMetadata for multi-message segment persistence
		const uiMessages: (UIMessage & { contextMetadata?: string })[] = messages.map((m) => ({
			id: m.id,
			role: m.role as 'user' | 'assistant' | 'system',
			parts: (m.parts as UIMessage['parts']) || [{ type: 'text' as const, text: m.content }],
			createdAt: m.createdAt,
			contextMetadata: m.contextMetadata
		}));
		return json({ messages: uiMessages, sessionId });
	} else {
		const sessions = await aiRepo.getSessions(locals.user.id);
		return json({ sessions });
	}
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const aiRepo = new AiRepository();
	const sessionId = url.searchParams.get('sessionId');

	if (sessionId) {
		await aiRepo.deleteSession(sessionId);
	} else {
		await aiRepo.clearHistory(locals.user.id);
	}

	return json({ success: true });
};
