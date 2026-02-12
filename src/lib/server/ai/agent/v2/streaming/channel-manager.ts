/**
 * Channel Manager - Multi-channel output management
 *
 * Manages multiple output channels for different types of content
 * (main, thinking, tool_result, debug).
 */

import type { StreamBlock, BlockType } from './block-streamer';

// ============================================================================
// Channel Types
// ============================================================================

/**
 * Output channel
 */
export type ChannelName = 'main' | 'thinking' | 'tool_result' | 'debug';

/**
 * Channel configuration
 */
export interface ChannelConfig {
	/** Channel name */
	name: ChannelName;
	/** Whether channel is enabled */
	enabled: boolean;
	/** Whether to include in final output */
	includeInOutput: boolean;
	/** Buffer size */
	bufferSize: number;
}

/**
 * Default channel configurations
 */
export const DEFAULT_CHANNELS: Record<ChannelName, ChannelConfig> = {
	main: { name: 'main', enabled: true, includeInOutput: true, bufferSize: 100 },
	thinking: { name: 'thinking', enabled: true, includeInOutput: false, bufferSize: 50 },
	tool_result: { name: 'tool_result', enabled: true, includeInOutput: true, bufferSize: 50 },
	debug: { name: 'debug', enabled: false, includeInOutput: false, bufferSize: 20 }
};

/**
 * Channel buffer
 */
interface ChannelBuffer {
	blocks: StreamBlock[];
	config: ChannelConfig;
}

/**
 * Channel handler
 */
export type ChannelHandler = (channel: ChannelName, block: StreamBlock) => void | Promise<void>;

// ============================================================================
// Channel Manager
// ============================================================================

/**
 * Channel Manager - Manages multiple output channels
 */
export class ChannelManager {
	private channels: Map<ChannelName, ChannelBuffer> = new Map();
	private handlers: ChannelHandler[] = [];
	private debug: boolean;

	constructor(debug: boolean = false) {
		this.debug = debug;

		// Initialize channels
		for (const [name, config] of Object.entries(DEFAULT_CHANNELS)) {
			this.channels.set(name as ChannelName, {
				blocks: [],
				config
			});
		}
	}

	/**
	 * Subscribe to channel events
	 */
	subscribe(handler: ChannelHandler): () => void {
		this.handlers.push(handler);
		return () => {
			const index = this.handlers.indexOf(handler);
			if (index !== -1) {
				this.handlers.splice(index, 1);
			}
		};
	}

	/**
	 * Write to a channel
	 */
	write(channel: ChannelName, block: StreamBlock): void {
		const buffer = this.channels.get(channel);

		if (!buffer || !buffer.config.enabled) {
			return;
		}

		// Add to buffer
		buffer.blocks.push(block);

		// Enforce buffer size
		if (buffer.blocks.length > buffer.config.bufferSize) {
			buffer.blocks.shift();
		}

		// Emit to handlers
		this.emit(channel, block);
	}

	/**
	 * Write text to main channel
	 */
	writeMain(content: string, isComplete: boolean = false): void {
		this.write('main', {
			id: `main-${Date.now()}`,
			type: 'text',
			content,
			isComplete,
			timestamp: Date.now()
		});
	}

	/**
	 * Write thinking content
	 */
	writeThinking(content: string, isComplete: boolean = false): void {
		this.write('thinking', {
			id: `think-${Date.now()}`,
			type: 'thinking',
			content,
			isComplete,
			timestamp: Date.now()
		});
	}

	/**
	 * Write tool result
	 */
	writeToolResult(toolName: string, result: unknown, isError: boolean = false): void {
		this.write('tool_result', {
			id: `tool-${Date.now()}`,
			type: isError ? 'error' : 'tool_result',
			content: typeof result === 'string' ? result : JSON.stringify(result),
			isComplete: true,
			timestamp: Date.now(),
			metadata: { toolName, isError }
		});
	}

	/**
	 * Write debug content
	 */
	writeDebug(content: string): void {
		this.write('debug', {
			id: `debug-${Date.now()}`,
			type: 'text',
			content,
			isComplete: true,
			timestamp: Date.now()
		});
	}

	/**
	 * Get channel content
	 */
	getContent(channel: ChannelName): StreamBlock[] {
		const buffer = this.channels.get(channel);
		return buffer ? [...buffer.blocks] : [];
	}

	/**
	 * Get all output (channels with includeInOutput)
	 */
	getOutput(): Record<ChannelName, StreamBlock[]> {
		const output: Record<ChannelName, StreamBlock[]> = {} as any;

		for (const [name, buffer] of this.channels) {
			if (buffer.config.includeInOutput) {
				output[name] = [...buffer.blocks];
			}
		}

		return output;
	}

	/**
	 * Get combined output as string
	 */
	getCombinedOutput(): string {
		const parts: string[] = [];

		for (const [name, buffer] of this.channels) {
			if (buffer.config.includeInOutput && buffer.blocks.length > 0) {
				if (name !== 'main') {
					parts.push(`\n[${name.toUpperCase()}]`);
				}
				for (const block of buffer.blocks) {
					parts.push(block.content);
				}
			}
		}

		return parts.join('\n');
	}

	/**
	 * Enable a channel
	 */
	enable(channel: ChannelName): void {
		const buffer = this.channels.get(channel);
		if (buffer) {
			buffer.config.enabled = true;
		}
	}

	/**
	 * Disable a channel
	 */
	disable(channel: ChannelName): void {
		const buffer = this.channels.get(channel);
		if (buffer) {
			buffer.config.enabled = false;
		}
	}

	/**
	 * Check if channel is enabled
	 */
	isEnabled(channel: ChannelName): boolean {
		return this.channels.get(channel)?.config.enabled ?? false;
	}

	/**
	 * Clear a channel
	 */
	clear(channel: ChannelName): void {
		const buffer = this.channels.get(channel);
		if (buffer) {
			buffer.blocks = [];
		}
	}

	/**
	 * Clear all channels
	 */
	clearAll(): void {
		for (const buffer of this.channels.values()) {
			buffer.blocks = [];
		}
	}

	/**
	 * Get channel statistics
	 */
	getStats(): Record<ChannelName, { blocks: number; enabled: boolean }> {
		const stats: Record<ChannelName, { blocks: number; enabled: boolean }> = {} as any;

		for (const [name, buffer] of this.channels) {
			stats[name] = {
				blocks: buffer.blocks.length,
				enabled: buffer.config.enabled
			};
		}

		return stats;
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private emit(channel: ChannelName, block: StreamBlock): void {
		for (const handler of this.handlers) {
			try {
				handler(channel, block);
			} catch (error) {
				if (this.debug) {
					console.error(`[ChannelManager] Handler error on ${channel}:`, error);
				}
			}
		}
	}
}

/**
 * Create a channel manager
 */
export function createChannelManager(debug?: boolean): ChannelManager {
	return new ChannelManager(debug);
}
