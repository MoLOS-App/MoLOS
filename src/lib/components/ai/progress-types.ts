/**
 * Progress state types for AI agent execution tracking
 */

export type ProgressStatus = 'idle' | 'thinking' | 'planning' | 'executing' | 'complete' | 'error';

export interface ExecutionLogEntry {
	id: string;
	type: 'info' | 'success' | 'error' | 'warning' | 'pending';
	message: string;
	step?: number;
	total?: number;
	timestamp: number;
	startTime?: number; // When the step started
	endTime?: number; // When the step completed
	// Additional details for expansion
	toolName?: string; // Name of the tool being executed
	parameters?: Record<string, unknown>; // Parameters passed to the tool
	result?: unknown; // Result from the tool
	errorDetail?: string; // Detailed error message
}

export interface CurrentAction {
	type: 'plan' | 'step_start' | 'step_complete' | 'step_failed' | 'thinking';
	message: string;
	step?: number;
	total?: number;
	timestamp: number;
}

export interface ProgressState {
	status: ProgressStatus;
	currentAction: CurrentAction | null;
	executionLog: ExecutionLogEntry[];
	planGoal?: string; // Goal of the current plan
	totalSteps?: number; // Total number of steps in the plan
}

export const INITIAL_PROGRESS_STATE: ProgressState = {
	status: 'idle',
	currentAction: null,
	executionLog: []
};

/**
 * Get icon for log entry type
 */
export function getLogEntryIcon(type: ExecutionLogEntry['type']): string {
	switch (type) {
		case 'success':
			return '✓';
		case 'error':
			return '✗';
		case 'pending':
			return '⟳';
		case 'warning':
			return '⚠';
		default:
			return '•';
	}
}

/**
 * Get CSS classes for log entry based on type
 */
export function getLogEntryClasses(type: ExecutionLogEntry['type']): string {
	const baseClasses = 'flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted/40';

	switch (type) {
		case 'error':
			return `${baseClasses} text-destructive`;
		case 'success':
			return `${baseClasses} text-green-600 dark:text-green-400`;
		case 'warning':
			return `${baseClasses} text-yellow-600 dark:text-yellow-400`;
		default:
			return `${baseClasses} text-muted-foreground`;
	}
}

/**
 * Format status text for display
 */
export function getStatusText(status: ProgressStatus): string {
	switch (status) {
		case 'thinking':
			return 'Thinking';
		case 'planning':
			return 'Planning';
		case 'executing':
			return 'Executing';
		case 'complete':
			return 'Complete';
		case 'error':
			return 'Error';
		default:
			return 'Working';
	}
}

/**
 * Format duration in milliseconds to human-readable format
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Get duration for an execution log entry
 */
export function getEntryDuration(entry: ExecutionLogEntry): string {
	if (!entry.startTime) return '';
	const endTime = entry.endTime || entry.timestamp;
	const duration = endTime - entry.startTime;
	return formatDuration(duration);
}
