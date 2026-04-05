#!/usr/bin/env tsx

/**
 * MoLOS Module Developer CLI
 *
 * Comprehensive CLI tool for module development and management.
 * Simplifies common tasks and enforces best practices.
 *
 * Usage:
 *   npm run module:create <module-name>  - Create a new module scaffold
 *   npm run module:validate <path>       - Validate module structure
 *   npm run module:test <path>           - Run module tests
 */

import { CreateCommand } from './commands/create-command';
import { ValidateCommand } from './commands/validate-command';
import { TestCommand } from './commands/test-command';

interface ModuleOptions {
	name: string;
	author?: string;
	description?: string;
	version?: string;
}

/**
 * Main entry point for the CLI
 */
async function main() {
	const command = process.argv[2];
	const args = process.argv.slice(3);

	if (!command) {
		console.log(`
MoLOS Module Developer CLI

Usage:
  module:create <name> [--name "Display Name"] [--author "Author"] [--description "Description"]
  module:validate <path>
  module:test <path>

Examples:
  npm run module:create my-module
  npm run module:create my-module --name "My Module" --author "Your Name"
  npm run module:validate ./external_modules/my-module
  npm run module:test ./external_modules/my-module
`);
		process.exit(0);
	}

	try {
		switch (command) {
			case 'create': {
				const moduleName = args[0];
				if (!moduleName) {
					console.error('❌ Module name is required');
					process.exit(1);
				}

				const options: Partial<ModuleOptions> = {};
				for (let i = 1; i < args.length; i += 2) {
					const key = args[i]?.replace('--', '');
					const value = args[i + 1];
					if (key && value) {
						(options as any)[key] = value;
					}
				}

				await CreateCommand.execute(moduleName, options);
				break;
			}

			case 'validate': {
				const modulePath = args[0];
				if (!modulePath) {
					console.error('❌ Module path is required');
					process.exit(1);
				}
				await ValidateCommand.execute(modulePath);
				break;
			}

			case 'test': {
				const modulePath = args[0];
				if (!modulePath) {
					console.error('❌ Module path is required');
					process.exit(1);
				}
				await TestCommand.execute(modulePath);
				break;
			}

			default:
				console.error(`❌ Unknown command: ${command}`);
				console.error('Valid commands: create, validate, test');
				process.exit(1);
		}
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
