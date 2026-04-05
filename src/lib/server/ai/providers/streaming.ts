/**
 * Streaming Support for @molos/agent
 *
 * Provides streaming response handling using AgentLoop.runStream()
 */

import type { AgentMessage, StreamChunk } from '@molos/agent';
import type { AgentLoop } from '@molos/agent';

export interface StreamEvents {
	onTextDelta?: (delta: string) => void;
	onToolStart?: (toolName: string, toolCallId: string) => void;
	onToolEnd?: (toolCallId: string, result?: string) => void;
	onFinish?: (reason: string, usage?: { inputTokens: number; outputTokens: number }) => void;
	onError?: (error: string) => void;
}

export async function* streamAgentResponse(
	loop: AgentLoop,
	messages: AgentMessage[],
	input: string,
	events: StreamEvents
): AsyncGenerator<StreamChunk> {
	// Use AgentLoop's runStream method
	const { stream } = loop.runStream(messages, input);

	for await (const chunk of stream) {
		// Emit events for UI updates
		switch (chunk.type) {
			case 'text-delta':
				events.onTextDelta?.(chunk.delta);
				break;
			case 'tool-call-start':
				events.onToolStart?.(chunk.toolName, chunk.toolCallId);
				break;
			case 'tool-call-end':
				events.onToolEnd?.(chunk.toolCallId, chunk.result);
				break;
			case 'finish':
				events.onFinish?.(chunk.reason, chunk.usage);
				break;
			case 'error':
				events.onError?.(chunk.error);
				break;
		}

		yield chunk;
	}
}

// Helper to convert StreamChunk to SSE event format
export function chunkToSseEvent(
	chunk: StreamChunk
): { type: string; data: Record<string, unknown> } | null {
	switch (chunk.type) {
		case 'text-delta':
			return { type: 'text_delta', data: { delta: chunk.delta } };
		case 'tool-call-start':
			return {
				type: 'tool_start',
				data: { toolName: chunk.toolName, toolCallId: chunk.toolCallId }
			};
		case 'tool-call-end':
			return {
				type: 'tool_complete',
				data: { toolCallId: chunk.toolCallId, result: chunk.result }
			};
		case 'finish':
			return { type: 'complete', data: { reason: chunk.reason, usage: chunk.usage } };
		case 'error':
			return { type: 'error', data: { message: chunk.error } };
		default:
			return null;
	}
}
