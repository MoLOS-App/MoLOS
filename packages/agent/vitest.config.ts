import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		exclude: ['node_modules', 'dist'],
		globals: true,
		environment: 'node',
		clearMocks: true,
		setupFiles: ['./tests/setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 70,
				statements: 80
			},
			include: ['src/**/*.ts'],
			exclude: [
				'*.test.ts',
				'*.spec.ts',
				'tests/**',
				'node_modules/**',
				'dist/**',
				'src/**/*.d.ts',
				'src/index.ts'
			]
		}
	}
});
