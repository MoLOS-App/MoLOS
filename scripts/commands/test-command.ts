import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

/**
 * Test Module Command
 * Handles running tests for modules
 */
export class TestCommand {
	/**
	 * Run tests for a module
	 */
	static async execute(modulePath: string): Promise<void> {
		const absolutePath = path.resolve(modulePath);

		if (!existsSync(absolutePath)) {
			console.error(`❌ Module path does not exist: ${absolutePath}`);
			process.exit(1);
		}

		console.log(`🧪 Running tests for module at: ${absolutePath}`);

		try {
			const packageJsonPath = path.join(absolutePath, 'package.json');
			if (!existsSync(packageJsonPath)) {
				console.error('❌ package.json not found');
				process.exit(1);
			}

			const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

			if (!packageJson.scripts || !packageJson.scripts.test) {
				console.log('⚠️  No test script found in package.json');
				console.log('Add a "test" script to package.json to run tests');
				process.exit(0);
			}

			execSync('npm run test', {
				stdio: 'inherit',
				cwd: absolutePath
			});

			console.log('✅ Tests completed');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`❌ Tests failed: ${message}`);
			process.exit(1);
		}
	}
}
