/**
 * Global loading state management store.
 * Uses Svelte 5 runes for reactive state management.
 *
 * Progress bar behavior:
 * 1. startLoading() - bar appears at 0% and slowly advances
 * 2. stopLoading() - bar fills to 100% then disappears
 */

function createLoadingStore() {
	let _isLoading = $state(false);
	let _progress = $state<number | undefined>(undefined);

	/**
	 * Guard flag to prevent multiple concurrent stopLoading operations.
	 */
	let _isStopping = false;

	function startLoading(): void {
		_isStopping = false;
		_isLoading = true;
		_progress = 0;
	}

	/**
	 * Stop loading - quickly fills bar to 100% then hides.
	 */
	async function stopLoading(): Promise<void> {
		if (_isStopping || !_isLoading) return;
		_isStopping = true;

		// Quickly fill to 100%
		_progress = 100;

		// Wait for the fill animation to complete
		await new Promise<void>((resolve) => setTimeout(resolve, 200));

		// Hide the bar
		_isLoading = false;
		_progress = undefined;
		_isStopping = false;
	}

	function stopLoadingImmediate(): void {
		_isLoading = false;
		_progress = undefined;
	}

	function setProgress(value: number): void {
		_isLoading = true;
		_progress = Math.min(100, Math.max(0, value));
	}

	return {
		get isLoading() {
			return _isLoading;
		},
		get progress() {
			return _progress;
		},
		startLoading,
		stopLoading,
		stopLoadingImmediate,
		setProgress
	};
}

export const loadingStore = createLoadingStore();

// Convenience exports
export const { isLoading, progress, startLoading, stopLoading, stopLoadingImmediate, setProgress } =
	loadingStore;
