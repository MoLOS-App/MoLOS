import type { AiAgentEvent, AiAgentTelemetry } from '$lib/models/ai';

export function estimateTokensFromMessages(messages: Record<string, unknown>[]): number {
	let charCount = 0;
	for (const message of messages) {
		const content = message.content;
		if (typeof content === 'string') {
			charCount += content.length;
			continue;
		}
		if (Array.isArray(content)) {
			for (const part of content) {
				if (typeof part === 'string') charCount += part.length;
				if (typeof part === 'object' && part && 'text' in part) {
					const text = (part as { text?: string }).text;
					if (text) charCount += text.length;
				}
			}
		}
	}
	return Math.ceil(charCount / 4);
}

export function estimateTokensFromText(text: string | undefined | null): number {
	if (!text) return 0;
	return Math.ceil(text.length / 4);
}

export function createTelemetry(runId: string): {
	telemetry: AiAgentTelemetry;
	events: AiAgentEvent[];
	recordEvent: (event: AiAgentEvent) => void;
} {
	const telemetry: AiAgentTelemetry = {
		runId,
		startMs: Date.now(),
		llmCalls: 0,
		toolCalls: 0,
		retries: 0,
		errors: 0,
		tokenEstimateIn: 0,
		tokenEstimateOut: 0
	};

	const events: AiAgentEvent[] = [];

	const recordEvent = (event: AiAgentEvent) => {
		events.push(event);
	};

	return { telemetry, events, recordEvent };
}
