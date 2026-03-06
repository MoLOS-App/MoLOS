import { dev } from '$app/environment';

export function load() {
	if (dev) {
		console.log('[Service Worker] Skipping registration in development mode');
		return;
	}

	if ('serviceWorker' in navigator) {
		navigator.serviceWorker
			.register('/service-worker.js', {
				scope: '/'
			})
			.then((registration) => {
				console.log('[Service Worker] Registered successfully:', registration.scope);

				// Check for updates
				registration.addEventListener('updatefound', () => {
					const newWorker = registration.installing;
					if (newWorker) {
						newWorker.addEventListener('statechange', () => {
							if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
								console.log('[Service Worker] New version available');
							}
						});
					}
				});
			})
			.catch((error) => {
				console.error('[Service Worker] Registration failed:', error);
			});

		// Handle service worker controlling the page
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			console.log('[Service Worker] Controller changed, reloading page...');
			window.location.reload();
		});
	} else {
		console.warn('[Service Worker] Not supported in this browser');
	}
}
