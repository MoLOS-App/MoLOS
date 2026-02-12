/**
 * Block Streamer - Streaming with block coalescing
 *
 * Provides streaming output with intelligent block coalescing
 * for smoother UI updates and reduced network overhead.
 */

import type { ProgressEvent } from '../core/types';

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Stream block type
 */
export type BlockType =
	| 'text'
	| 'thinking'
	| 'tool_use'
	| 'tool_result'
	| 'error'
	| 'complete';

/**
 * Stream block
 */
export interface StreamBlock {
	/** Block ID */
	id: string;
	/** Block type */
	type: BlockType;
	/** Content */
	content: string;
	/** Is complete */
	isComplete: boolean;
	/** Timestamp */
	timestamp: number;
	/** Metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Streamer configuration
 */
export interface BlockStreamerConfig {
	/** Coalescing window in ms */
	coalesceWindowMs: number;
	/** Maximum block size */
	maxBlockSize: number;
	/** Enable debug logging */
	debug: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_BLOCK_STREAMER_CONFIG: BlockStreamerConfig = {
	coalesceWindowMs: 50,
	maxBlockSize: 4096,
	debug: false
};

/**
 * Stream handler function
 */
export type BlockHandler = (block: StreamBlock) => void | Promise<void>;

// ============================================================================
// Block Streamer
// ============================================================================

/**
 * Block Streamer - Manages streaming with coalescing
 */
export class BlockStreamer {
	private config: BlockStreamerConfig;
	private currentBlock: StreamBlock | null = null;
	private coalesceTimeout: ReturnType<typeof setTimeout> | null = null;
	private pendingContent: string = '';
	private handlers: BlockHandler[] = [];
	private blockCount: number = 0;

	constructor(config: Partial<BlockStreamerConfig> = {}) {
		this.config = { ...DEFAULT_BLOCK_STREAMER_CONFIG, ...config };
	}

	/**
	 * Subscribe to block events
	 */
	subscribe(handler: BlockHandler): () => void {
		this.handlers.push(handler);
		return () => {
			const index = this.handlers.indexOf(handler);
			if (index !== -1) {
				this.handlers.splice(index, 1);
			}
		};
	}

	/**
	 * Stream text content
	 */
	streamText(content: string, isComplete: boolean = false): void {
		this.appendToBlock('text', content, isComplete);
	}

	/**
	 * Stream thinking content
	 */
	streamThinking(content: string, isComplete: boolean = false): void {
		this.appendToBlock('thinking', content, isComplete);
	}

	/**
	 * Stream tool use
	 */
	streamToolUse(toolName: string, toolId: string, parameters: unknown): void {
		this.flush();

		const block: StreamBlock = {
			id: `block-${++this.blockCount}`,
			type: 'tool_use',
			content: JSON.stringify({ toolName, toolId, parameters }),
			isComplete: true,
			timestamp: Date.now(),
			metadata: { toolName, toolId }
		};

		this.emit(block);
	}

	/**
	 * Stream tool result
	 */
	streamToolResult(toolId: string, result: unknown, isError: boolean = false): void {
		this.flush();

		const block: StreamBlock = {
			id: `block-${++this.blockCount}`,
			type: isError ? 'error' : 'tool_result',
			content: typeof result === 'string' ? result : JSON.stringify(result),
			isComplete: true,
			timestamp: Date.now(),
			metadata: { toolId, isError }
		};

		this.emit(block);
	}

	/**
	 * Stream error
	 */
	streamError(error: string): void {
		this.flush();

		const block: StreamBlock = {
			id: `block-${++this.blockCount}`,
			type: 'error',
			content: error,
			isComplete: true,
			timestamp: Date.now()
		};

		this.emit(block);
	}

	/**
	 * Mark stream as complete
	 */
	complete(): void {
		this.flush();

		const block: StreamBlock = {
			id: `block-${++this.blockCount}`,
			type: 'complete',
			content: '',
			isComplete: true,
			timestamp: Date.now()
		};

		this.emit(block);
	}

	/**
	 * Stream progress event
	 */
	streamProgressEvent(event: ProgressEvent): void {
		this.flush();

		const block: StreamBlock = {
			id: `block-${++this.blockCount}`,
			type: this.mapEventTypeToBlockType(event.type),
			content: JSON.stringify(event.data),
			isComplete: true,
			timestamp: event.timestamp,
			metadata: { eventType: event.type }
		};

		this.emit(block);
	}

	/**
	 * Flush pending content
	 */
	flush(): void {
		if (this.coalesceTimeout) {
			clearTimeout(this.coalesceTimeout);
			this.coalesceTimeout = null;
		}

		if (this.pendingContent && this.currentBlock) {
			this.currentBlock.content = this.pendingContent;
			this.emit({ ...this.currentBlock, isComplete: true });
			this.pendingContent = '';
			this.currentBlock = null;
		}
	}

	/**
	 * Get block count
	 */
	getBlockCount(): number {
		return this.blockCount;
	}

	/**
	 * Reset the streamer
	 */
	reset(): void {
		this.flush();
		this.currentBlock = null;
		this.pendingContent = '';
		this.blockCount = 0;
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private appendToBlock(type: BlockType, content: string, isComplete: boolean): void {
		// Check if we need a new block
		if (!this.currentBlock || this.currentBlock.type !== type) {
			this.flush();
			this.currentBlock = {
				id: `block-${++this.blockCount}`,
				type,
				content: '',
				isComplete: false,
				timestamp: Date.now()
			};
		}

		// Append content
		this.pendingContent += content;

		// Check max size
		if (this.pendingContent.length >= this.config.maxBlockSize) {
			this.flush();
			return;
		}

		// Check if complete
		if (isComplete) {
			this.flush();
			return;
		}

		// Set up coalescing timeout
		if (!this.coalesceTimeout) {
			this.coalesceTimeout = setTimeout(() => {
				this.flush();
			}, this.config.coalesceWindowMs);
		}
	}

	private emit(block: StreamBlock): void {
		for (const handler of this.handlers) {
			try {
				handler(block);
			} catch (error) {
				if (this.config.debug) {
					console.error('[BlockStreamer] Handler error:', error);
				}
			}
		}
	}

	private mapEventTypeToBlockType(eventType: string): BlockType {
		switch (eventType) {
			case 'thinking':
			case 'thought':
				return 'thinking';
			case 'step_complete':
			case 'step_failed':
				return 'tool_result';
			case 'error':
				return 'error';
			case 'complete':
				return 'complete';
			default:
				return 'text';
		}
	}
}

/**
 * Create a block streamer
 */
export function createBlockStreamer(config?: Partial<BlockStreamerConfig>): BlockStreamer {
	return new BlockStreamer(config);
}
