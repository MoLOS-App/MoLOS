/**
 * Common Type Definitions
 *
 * Shared types used across multiple features in MoLOS.
 */

/**
 * Pagination parameters
 */
export interface PaginationParams {
	page?: number;
	limit?: number;
	offset?: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
	items: T[];
	total: number;
	page: number;
	limit: number;
	hasMore: boolean;
}

/**
 * Generic API error response
 */
export interface ApiError {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: ApiError;
}

/**
 * Date range filter
 */
export interface DateRange {
	start: Date;
	end: Date;
}

/**
 * Generic filter options
 */
export interface FilterOptions {
	search?: string;
	limit?: number;
	offset?: number;
}

/**
 * Sort order
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Sort parameter
 */
export interface SortParam {
	field: string;
	order: SortOrder;
}
