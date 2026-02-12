import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AiAgentV3Adapter } from '$lib/server/ai/agent-v3-adapter';
import { AiRepository } from '$lib/repositories/ai/ai-repository';

const chunkText = (text: string, size: number = 32): string[] => {
	if (!text) return [''];
	const chunks: string[] = [];
	for (let i = 0; i < text.length; i += size) {
		chunks.push(text.slice(i, i + size));
	}
	return chunks.length > 0 ? chunks : [''];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	console.log('AI Chat Request Body:', JSON.stringify(body, null, 2));
	const {
		messages,
		content: directContent,
		sessionId,
		actionToExecute,
		activeModuleIds,
		attachments,
		parts,
		stream: streamRequested
	} = body;
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

	// useChat sends 'messages' array. We extract the last user message content.
	const lastMessage = messages?.[messages.length - 1];
	let content = directContent || lastMessage?.content;
	const messageParts = parts || lastMessage?.parts;
	const messageAttachments = attachments || lastMessage?.attachments;

	// In AI SDK v6, content might be in parts
	if (!content && messageParts) {
		content = messageParts
			.filter((p: any) => p.type === 'text')
			.map((p: any) => p.text)
			.join('');
	}

	if (!content && !messageAttachments) {
		return json({ error: 'Content is required' }, { status: 400 });
	}

	let activeSessionId = sessionId;

	if (!activeSessionId) {
		const session = await aiRepo.createSession(locals.user.id, content?.substring(0, 30) + '...');
		activeSessionId = session.id;
	}

	// Return response
	console.log('Processing AI message for content:', content);
	try {
		if (shouldStream) {
			const encoder = new TextEncoder();
			let streamClosed = false;

			const stream = new ReadableStream({
				start: async (controller) => {
					// Safe enqueue wrapper that handles closed stream
					const safeEnqueue = (data: Uint8Array) => {
						if (!streamClosed) {
							try {
								controller.enqueue(data);
							} catch (e) {
								// Stream closed, mark it and stop trying
								streamClosed = true;
								console.warn('Stream enqueue failed (already closed):', e);
							}
						}
					};

					try {
						// Send session ID first
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({ type: 'meta', sessionId: activeSessionId })}\n\n`
							)
						);

						// Track progress events
						const progressEvents: any[] = [];

						// Call agent with progress streaming enabled
						const response = await agent.processMessage(
							content,
							activeSessionId,
							activeModuleIds,
							messageAttachments,
							messageParts,
							{
								onProgress: async (event: any) => {
									// Send progress event to UI (with safe enqueue)
									safeEnqueue(
										encoder.encode(
											`data: ${JSON.stringify({
												type: 'progress',
												eventType: event.type,
												timestamp: event.timestamp,
												data: event.data
											})}\n\n`
										)
									);
									progressEvents.push(event);
								}
							}
						);

						// Stream the final message in chunks
						const chunks = chunkText(response.message || '');
						for (const chunk of chunks) {
							safeEnqueue(
								encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
							);
							await sleep(30); // Slightly faster for better UX
						}

						// Send final metadata AFTER all progress events are sent
						// Small delay to ensure progress events are flushed
						await sleep(50);

						safeEnqueue(
							encoder.encode(
								`data: ${JSON.stringify({
									type: 'meta',
									sessionId: activeSessionId,
									actions: response.actions || [],
									events: response.events,
									telemetry: response.telemetry,
									progressEvents: progressEvents.length > 0 ? progressEvents : undefined
								})}\n\n`
							)
						);

						// Send DONE and close with error handling
						try {
							safeEnqueue(encoder.encode('data: [DONE]\n\n'));
							// Small delay before closing to ensure DONE is sent
							await sleep(20);
							controller.close();
						} catch (closeError) {
							// Stream might already be closed, that's okay
							console.warn('Stream close warning (non-fatal):', closeError);
						}
					} catch (error) {
						const errorMessage = (error as any)?.message || 'Internal Server Error';
						console.error('Streaming error:', error);
						safeEnqueue(
							encoder.encode(
								`data: ${JSON.stringify({ type: 'error', message: errorMessage })}\n\n`
							)
						);
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
					'X-Accel-Buffering': 'no' // Prevent nginx from buffering
				}
			});
		}

		// Non-streaming response
		const response = await agent.processMessage(
			content,
			activeSessionId,
			activeModuleIds,
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
		return json({ messages });
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
