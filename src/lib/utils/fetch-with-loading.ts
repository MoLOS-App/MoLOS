import { startLoading, stopLoading } from '$lib/stores/loading-store.svelte.js';

/**
 * Fetch wrapper that automatically manages global loading state.
 * Shows the loading bar during fetch requests.
 *
 * @example
 * ```typescript
 * // Simple GET request
 * const data = await fetchWithLoading('/api/users');
 *
 * // POST request with body
 * const result = await fetchWithLoading('/api/users', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'John' }),
 *   headers: { 'Content-Type': 'application/json' }
 * });
 *
 * // With explicit progress (for file uploads, etc.)
 * const data = await fetchWithLoading('/api/upload', {
 *   method: 'POST',
 *   body: formData
 * });
 * ```
 *
 * @param input - The resource to fetch (URL or Request object)
 * @param init - Optional fetch options
 * @returns The parsed JSON response data
 * @throws Re-throws any fetch errors after calling stopLoading
 */
export async function fetchWithLoading<T = unknown>(
	input: Request | URL | string,
	init?: RequestInit
): Promise<T> {
	startLoading();

	try {
		const response = await fetch(input, init);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		return data as T;
	} catch (error) {
		// Re-throw after stopping loading to ensure clean state
		throw error;
	} finally {
		stopLoading();
	}
}

/**
 * Fetch wrapper that returns the raw Response object.
 * Still manages loading state but gives more control to caller.
 *
 * @example
 * ```typescript
 * const response = await fetchWithLoadingRaw('/api/users');
 * if (response.ok) {
 *   const data = await response.json();
 * }
 * ```
 */
export async function fetchWithLoadingRaw(
	input: Request | URL | string,
	init?: RequestInit
): Promise<Response> {
	startLoading();

	try {
		const response = await fetch(input, init);
		return response;
	} catch (error) {
		throw error;
	} finally {
		stopLoading();
	}
}
