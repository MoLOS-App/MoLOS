import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
	testDir: './tests/e2e',
	outputDir: './tests/e2e/results',
	timeout: 30000,
	expect: {
		timeout: 5000,
		toHaveScreenshot: { maxDiffPixels: 50 }
	},
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [['html', { outputFolder: 'tests/e2e/reports' }], ['list']],
	use: {
		baseURL: process.env.BASE_URL || 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		actionTimeout: 10000,
		launchOptions: {
			args: ['--disable-web-security']
		}
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] }
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] }
		},
		{
			name: 'Mobile Chrome',
			use: { ...devices['Pixel 5'] }
		},
		{
			name: 'Mobile Safari',
			use: { ...devices['iPhone 12'] }
		}
	],
	webServer: process.env.CI
		? undefined
		: {
				command: 'bun run dev',
				url: 'http://localhost:5173',
				reuseExistingServer: !process.env.CI,
				timeout: 120000
			}
});
