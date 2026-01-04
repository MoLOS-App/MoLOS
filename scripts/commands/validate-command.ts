import { execSync } from 'child_process';
import { existsSync } from 'fs';
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

		const validatorPath = path.resolve(process.cwd(), 'scripts', 'validate-module.ts');

		if (!existsSync(validatorPath)) {
			console.error(`❌ Validation script not found: ${validatorPath}`);
			process.exit(1);
		}

		try {
			execSync(`tsx "${validatorPath}" "${absolutePath}"`, {
				stdio: 'inherit',
				cwd: process.cwd()
			});
			console.log('✅ Module validation passed');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`❌ Module validation failed: ${message}`);
			process.exit(1);
		}
	}
}
