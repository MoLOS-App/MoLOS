import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AiAgentV3Adapter } from '$lib/server/ai/agent-v3-adapter';
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
 * Log server events for debugging
 */
function serverLog(type: string, data: Record<string, unknown>) {
	console.log(`[AI Chat ${new Date().toISOString()}] ${type}:`, JSON.stringify(data, null, 2));
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
		attachments,
		parts,
		stream: streamRequested = true
	} = body;

	serverLog('REQUEST', {
		sessionId,
		hasMessages: !!messages,
		messageCount: messages?.length,
		content: directContent?.substring(0, 50),
		activeModuleIds
	});

	const agent = new AiAgentV3Adapter(locals.user.id);
	const aiRepo = new AiRepository();
	const settings = await aiRepo.getSettings(locals.user.id);
	const shouldStream = Boolean(streamRequested && (settings?.streamEnabled ?? true));

	// Handle confirmed action execution (Legacy/Manual)
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
			let streamClosed = false;

			// Track message segments for multi-message support
			const messageSegments: Map<string, string> = new Map();
			let currentSegmentId: string | null = null;

			const stream = new ReadableStream({
				start: async (controller) => {
					const safeEnqueue = (data: Uint8Array) => {
						if (!streamClosed) {
							try {
								controller.enqueue(data);
							} catch (e) {
								streamClosed = true;
								console.warn('Stream enqueue failed (already closed):', e);
							}
						}
					};

					// Helper to send SSE event
					const sendEvent = (type: string, data: Record<string, unknown>) => {
						serverLog(`EVENT:${type}`, data);
						safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
					};

					try {
						// Send session ID first
						sendEvent('meta', { sessionId: activeSessionId });

						// Track progress events
						const progressEvents: any[] = [];

						// Call agent with progress streaming enabled
						const response = await agent.processMessage(
							content,
							activeSessionId,
							activeModuleIds || [],
							messageAttachments,
							messageParts,
							{
								onProgress: async (event: any) => {
									serverLog('PROGRESS', { type: event.type, data: event.data });

									// Handle different event types
									switch (event.type) {
										case 'message_segment':
											// Multi-message support: stream segment content
											const segmentData = event.data;
											const segId = segmentData.id;

											if (segmentData.isComplete) {
												// Segment is complete, send it as a full message
												sendEvent('message_segment', {
													id: segId,
													content: segmentData.content,
													isComplete: true,
													segmentIndex: segmentData.segmentIndex
												});
											} else {
												// Stream partial content
												sendEvent('text_delta', {
													segmentId: segId,
													delta: segmentData.content,
													segmentIndex: segmentData.segmentIndex
												});
											}
											break;

										case 'text':
											// Text delta from streaming
											if (event.data?.delta) {
												sendEvent('text_delta', {
													delta: event.data.delta,
													segmentId: event.data.segmentId
												});
											}
											break;

										case 'tool_start':
											// Tool call started
											sendEvent('tool_start', {
												toolName: event.data.toolName,
												toolCallId: event.data.toolCallId,
												input: event.data.input
											});
											break;

										case 'tool_complete':
											// Tool call completed
											sendEvent('tool_complete', {
												toolName: event.data.toolName,
												toolCallId: event.data.toolCallId,
												result: event.data.result
											});
											break;

										case 'step_complete':
											// Step completed
											progressEvents.push(event);
											sendEvent('progress', {
												eventType: 'step_complete',
												timestamp: event.timestamp,
												data: event.data
											});
											break;

										case 'complete':
											// Execution complete
											sendEvent('progress', {
												eventType: 'complete',
												timestamp: event.timestamp,
												data: event.data
											});
											break;

										case 'error':
											// Error occurred
											sendEvent('progress', {
												eventType: 'error',
												timestamp: event.timestamp,
												data: event.data
											});
											break;

										default:
											// Pass through other progress events
											progressEvents.push(event);
											sendEvent('progress', {
												eventType: event.type,
												timestamp: event.timestamp,
												data: event.data
											});
									}
								}
							}
						);

						serverLog('RESPONSE', {
							messageLength: response.message?.length,
							actionsCount: response.actions?.length,
							eventsCount: response.events?.length
						});

						// Stream the final message in chunks (for compatibility)
						const chunks = chunkText(response.message || '');
						for (const chunk of chunks) {
							sendEvent('chunk', { content: chunk });
							await sleep(30);
						}

						// Send final metadata
						await sleep(50);
						sendEvent('meta', {
							sessionId: activeSessionId,
							actions: response.actions || [],
							events: response.events,
							telemetry: response.telemetry,
							progressEvents: progressEvents.length > 0 ? progressEvents : undefined
						});

						// Send DONE and close
						try {
							safeEnqueue(encoder.encode('data: [DONE]\n\n'));
							await sleep(20);
							controller.close();
							serverLog('STREAM_CLOSED', { reason: 'completed' });
						} catch (closeError) {
							console.warn('Stream close warning (non-fatal):', closeError);
						}
					} catch (error) {
						const errorMessage = (error as any)?.message || 'Internal Server Error';
						console.error('Streaming error:', error);
						serverLog('ERROR', { message: errorMessage });
						sendEvent('error', { message: errorMessage });
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
		}

		// Non-streaming response
		const response = await agent.processMessage(
			content,
			activeSessionId,
			activeModuleIds || [],
			messageAttachments,
			messageParts
		);
		return json({ ...response, sessionId: activeSessionId });
	} catch (error) {
		console.error('Error in AI Chat POST:', error);
		const errorMessage = (error as any).message || 'Internal Server Error';
		return json({ error: errorMessage }, { status: 500 });
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
		const uiMessages: UIMessage[] = messages.map((m) => ({
			id: m.id,
			role: m.role as 'user' | 'assistant' | 'system',
			parts: (m.parts as UIMessage['parts']) || [{ type: 'text' as const, text: m.content }],
			createdAt: m.createdAt
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
