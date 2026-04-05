import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

interface ConsoleError {
	type: 'error' | 'warning' | 'pageerror';
	text: string;
	location?: { url: string; lineNumber: number; columnNumber: number };
}

interface PageErrorEvent {
	message: string;
}

class UIErrorDetector {
	private errors: ConsoleError[] = [];
	private page: Page;

	constructor(page: Page) {
		this.page = page;
		this.setupListeners();
	}

	private setupListeners() {
		this.page.on('console', (msg: ConsoleMessage) => {
			if (msg.type() === 'error' || msg.type() === 'warning') {
				this.errors.push({
					type: msg.type() as 'error' | 'warning',
					text: msg.text(),
					location: msg.location()
				});
			}
		});

		this.page.on('pageerror', (err: PageErrorEvent) => {
			this.errors.push({
				type: 'pageerror',
				text: err.message,
				location: { url: '', lineNumber: 0, columnNumber: 0 }
			});
		});
	}

	getErrors(): ConsoleError[] {
		return [...this.errors];
	}

	getErrorMessages(): string[] {
		return this.errors.map((e) => e.text);
	}

	hasErrors(): boolean {
		return this.errors.length > 0;
	}

	hasPageErrors(): boolean {
		return this.errors.some((e) => e.type === 'pageerror');
	}

	hasConsoleErrors(): boolean {
		return this.errors.some((e) => e.type === 'error');
	}

	clear() {
		this.errors = [];
	}

	report(): string {
		if (this.errors.length === 0) return 'No errors detected';
		return this.errors.map((e) => `[${e.type}] ${e.text}`).join('\n');
	}
}

test.describe('MCP UI Error Detection', () => {
	let errorDetector: UIErrorDetector;

	test.beforeEach(async ({ page }) => {
		errorDetector = new UIErrorDetector(page);
	});

	test.afterEach(async () => {
		const errors = errorDetector.getErrors();
		if (errors.length > 0) {
			console.log('Errors detected:', errorDetector.report());
		}
	});

	test('MCP Dashboard loads without errors', async ({ page }) => {
		await page.goto('/ui/ai/mcp');
		await page.waitForLoadState('networkidle');

		expect(errorDetector.hasPageErrors()).toBe(false);
		expect(errorDetector.hasConsoleErrors()).toBe(false);

		await expect(page.locator('h2:has-text("Dashboard")')).toBeVisible();
	});

	test('MCP Dashboard stats cards render without errors', async ({ page }) => {
		await page.goto('/ui/ai/mcp?tab=dashboard');
		await page.waitForLoadState('networkidle');

		const statsCards = page.locator('.grid.grid-cols-1.gap-4 >> .bg-card');
		const count = await statsCards.count();
		expect(count).toBeGreaterThan(0);

		expect(errorDetector.hasPageErrors()).toBe(false);
	});

	test('MCP Keys page loads without errors', async ({ page }) => {
		await page.goto('/ui/ai/mcp?tab=keys');
		await page.waitForLoadState('networkidle');

		expect(errorDetector.hasPageErrors()).toBe(false);
		expect(errorDetector.hasConsoleErrors()).toBe(false);
	});

	test('MCP Resources page loads without errors', async ({ page }) => {
		await page.goto('/ui/ai/mcp?tab=resources');
		await page.waitForLoadState('networkidle');

		expect(errorDetector.hasPageErrors()).toBe(false);
		expect(errorDetector.hasConsoleErrors()).toBe(false);
	});

	test('MCP Prompts page loads without errors', async ({ page }) => {
		await page.goto('/ui/ai/mcp?tab=prompts');
		await page.waitForLoadState('networkidle');

		expect(errorDetector.hasPageErrors()).toBe(false);
		expect(errorDetector.hasConsoleErrors()).toBe(false);
	});

	test('MCP Logs page loads without errors', async ({ page }) => {
		await page.goto('/ui/ai/mcp?tab=logs');
		await page.waitForLoadState('networkidle');

		expect(errorDetector.hasPageErrors()).toBe(false);
		expect(errorDetector.hasConsoleErrors()).toBe(false);
	});

	test('MCP OAuth Apps page loads without errors', async ({ page }) => {
		await page.goto('/ui/ai/mcp?tab=oauth');
		await page.waitForLoadState('networkidle');

		expect(errorDetector.hasPageErrors()).toBe(false);
		expect(errorDetector.hasConsoleErrors()).toBe(false);
	});

	test('MCP Tools page loads without errors', async ({ page }) => {
		await page.goto('/ui/ai/tools');
		await page.waitForLoadState('networkidle');

		expect(errorDetector.hasPageErrors()).toBe(false);
	});

	test.describe('Error detection on user interactions', () => {
		test('Creating a new API key does not cause errors', async ({ page }) => {
			await page.goto('/ui/ai/mcp?tab=keys');
			await page.waitForLoadState('networkidle');

			const createButton = page.locator('button:has-text("Create")').first();
			if (await createButton.isVisible()) {
				await createButton.click();
				await page.waitForTimeout(500);
			}

			expect(errorDetector.hasPageErrors()).toBe(false);
		});

		test('Tab navigation does not cause errors', async ({ page }) => {
			await page.goto('/ui/ai/mcp');
			await page.waitForLoadState('networkidle');

			const tabs = ['dashboard', 'keys', 'resources', 'prompts', 'logs', 'oauth'];

			for (const tab of tabs) {
				await page.goto(`/ui/ai/mcp?tab=${tab}`);
				await page.waitForLoadState('networkidle');
				expect(errorDetector.hasPageErrors()).toBe(false);
			}
		});

		test('Filtering on keys page does not cause errors', async ({ page }) => {
			await page.goto('/ui/ai/mcp?tab=keys');
			await page.waitForLoadState('networkidle');

			const filterInput = page
				.locator('input[placeholder*="Search"], input[type="search"]')
				.first();
			if (await filterInput.isVisible()) {
				await filterInput.fill('test');
				await page.waitForTimeout(300);
				await filterInput.clear();
				await page.waitForTimeout(300);
			}

			expect(errorDetector.hasPageErrors()).toBe(false);
		});
	});

	test.describe('Accessibility and error boundary tests', () => {
		test('Page has proper heading structure', async ({ page }) => {
			await page.goto('/ui/ai/mcp');
			await page.waitForLoadState('networkidle');

			const h1 = page.locator('h1');
			const h2 = page.locator('h2');

			if ((await h1.count()) > 0) {
				await expect(h1.first()).toBeVisible();
			}
			if ((await h2.count()) > 0) {
				await expect(h2.first()).toBeVisible();
			}
		});

		test('Interactive elements are focusable', async ({ page }) => {
			await page.goto('/ui/ai/mcp');
			await page.waitForLoadState('networkidle');

			const buttons = page.locator('button:not([disabled])');
			const firstButton = buttons.first();

			if (await firstButton.isVisible()) {
				await firstButton.focus();
				await expect(firstButton).toBeFocused();
			}
		});

		test('No unhandled promise rejections occur', async ({ page }) => {
			const promises: Promise<unknown>[] = [];
			page.on('pageerror', () => {
				promises.push(Promise.reject(new Error('Page error detected')));
			});

			await page.goto('/ui/ai/mcp');
			await page.waitForLoadState('networkidle');
			await page.reload();
			await page.waitForLoadState('networkidle');

			expect(promises).toHaveLength(0);
		});
	});

	test.describe('Responsive error detection', () => {
		test('Dashboard renders on mobile viewport', async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 });
			await page.goto('/ui/ai/mcp?tab=dashboard');
			await page.waitForLoadState('networkidle');

			expect(errorDetector.hasPageErrors()).toBe(false);
			expect(errorDetector.hasConsoleErrors()).toBe(false);
		});

		test('Keys table scrolls horizontally on small screens', async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 });
			await page.goto('/ui/ai/mcp?tab=keys');
			await page.waitForLoadState('networkidle');

			const table = page.locator('table').first();
			if (await table.isVisible()) {
				await page.evaluate(() => {
					const tableEl = document.querySelector('table');
					if (tableEl) tableEl.scrollLeft = 100;
				});
			}

			expect(errorDetector.hasPageErrors()).toBe(false);
		});
	});
});

test.describe('Global UI Error Detection', () => {
	test('No console errors on login page', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});

		await page.goto('/ui/login');
		await page.waitForLoadState('networkidle');

		expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
	});

	test('No console errors on signup page', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});

		await page.goto('/ui/signup');
		await page.waitForLoadState('networkidle');

		expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
	});

	test('No console errors on dashboard', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});

		await page.goto('/ui/dashboard');
		await page.waitForLoadState('networkidle');

		expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
	});

	test('No console errors on settings page', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});

		await page.goto('/ui/settings');
		await page.waitForLoadState('networkidle');

		expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
	});

	test('404 page renders without crashing', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => {
			errors.push(err.message);
		});

		await page.goto('/ui/nonexistent-page-12345');
		await page.waitForLoadState('networkidle');

		expect(errors).toHaveLength(0);
		await expect(page.locator('text=404, text=Page not found, text=back')).toBeVisible();
	});
});

test.describe('API Error Handling UI', () => {
	test('API error displays properly in UI', async ({ page }) => {
		await page.goto('/ui/ai/mcp?tab=keys');
		await page.waitForLoadState('networkidle');

		const errorAlert = page.locator('[role="alert"], .bg-destructive, .text-destructive');
		if ((await errorAlert.count()) > 0) {
			await expect(errorAlert.first()).toBeVisible();
		}
	});

	test('Loading states complete without errors', async ({ page }) => {
		const detector = new UIErrorDetector(page);
		await page.goto('/ui/ai/mcp?tab=keys');
		await page.waitForLoadState('networkidle');

		const loadingSpinner = page.locator('[aria-busy="true"], .animate-spin');
		if ((await loadingSpinner.count()) > 0) {
			await page.waitForSelector('[aria-busy="true"], .animate-spin', {
				state: 'hidden',
				timeout: 10000
			});
		}

		expect(detector.hasPageErrors()).toBe(false);
	});
});
