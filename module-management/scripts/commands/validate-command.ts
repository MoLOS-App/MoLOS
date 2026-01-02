import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

/**
 * Validate Module Command
 * Handles validation of module structure and configuration
 */
export class ValidateCommand {
	/**
	 * Validate a module
	 */
	static async execute(modulePath: string): Promise<void> {
		const absolutePath = path.resolve(modulePath);

		if (!existsSync(absolutePath)) {
			console.error(`❌ Module path does not exist: ${absolutePath}`);
			process.exit(1);
		}

		console.log(`🔍 Validating module at: ${absolutePath}`);

		try {
			const result = execSync(`npx ts-node ${__dirname}/../validate-module.ts "${absolutePath}"`, {
				stdio: 'inherit',
				cwd: process.cwd()
			});
			console.log('✅ Module validation passed');
		} catch (error) {
			console.error('❌ Module validation failed');
			process.exit(1);
		}
	}
}