/**
 * MCP Structured Logger
 *
 * Provides structured logging with context for MCP operations.
 */

/**
 * Log level
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log context
 */
export interface LogContext {
	[key: string]: unknown;
	userId?: string;
	apiKeyId?: string;
	sessionId?: string;
	requestId?: string;
	method?: string;
	toolName?: string;
	durationMs?: number;
}

/**
 * Log entry
 */
interface LogEntry {
	level: LogLevel;
	message: string;
	context?: LogContext;
	timestamp: string;
}

/**
 * Structured logger class
 */
class MCPStructuredLogger {
	private minLevel: LogLevel;
	private levelPriority: Record<LogLevel, number> = {
		debug: 0,
		info: 1,
		warn: 2,
		error: 3
	};

	constructor(minLevel: LogLevel = 'info') {
		this.minLevel = minLevel;
	}

	/**
	 * Check if a log level should be logged
	 */
	private shouldLog(level: LogLevel): boolean {
		return this.levelPriority[level] >= this.levelPriority[this.minLevel];
	}

	/**
	 * Format a log entry
	 */
	private format(level: LogLevel, message: string, context?: LogContext): string {
		const entry: LogEntry = {
			level,
			message,
			context,
			timestamp: new Date().toISOString()
		};
		return JSON.stringify(entry);
	}

	/**
	 * Write a log entry
	 */
	private write(level: LogLevel, message: string, context?: LogContext): void {
		if (!this.shouldLog(level)) {
			return;
		}

		const formatted = this.format(level, message, context);

		switch (level) {
			case 'error':
				console.error(formatted);
				break;
			case 'warn':
				console.warn(formatted);
				break;
			case 'debug':
				console.debug(formatted);
				break;
			default:
				console.log(formatted);
		}
	}

	/**
	 * Log an info message
	 */
	info(message: string, context?: LogContext): void {
		this.write('info', message, context);
	}

	/**
	 * Log a debug message
	 */
	debug(message: string, context?: LogContext): void {
		this.write('debug', message, context);
	}

	/**
	 * Log a warning message
	 */
	warn(message: string, context?: LogContext): void {
		this.write('warn', message, context);
	}

	/**
	 * Log an error message
	 */
	error(message: string, error?: Error, context?: LogContext): void {
		const errorContext: LogContext = {
			...context,
			error: error?.message,
			stack: error?.stack
		};
		this.write('error', message, errorContext);
	}

	/**
	 * Set the minimum log level
	 */
	setMinLevel(level: LogLevel): void {
		this.minLevel = level;
	}
}

/**
 * Singleton logger instance
 */
export const mcpLogger = new MCPStructuredLogger(
	(process.env.MCP_LOG_LEVEL as LogLevel) ?? 'info'
);

/**
 * Log a request (helper function)
 */
export function logRequest(
	method: string,
	context: LogContext,
	durationMs?: number
): void {
	mcpLogger.debug('MCP request', {
		...context,
		method,
		durationMs
	});
}

/**
 * Log a tool execution (helper function)
 */
export function logToolExecution(
	toolName: string,
	context: LogContext,
	durationMs?: number
): void {
	mcpLogger.debug('Tool executed', {
		...context,
		toolName,
		durationMs
	});
}

/**
 * Log a cache hit/miss (helper function)
 */
export function logCacheHit(
	key: string,
	hit: boolean,
	context?: LogContext
): void {
	mcpLogger.debug('Cache ' + (hit ? 'hit' : 'miss'), {
		...context,
		cacheKey: key,
		hit
	});
}
