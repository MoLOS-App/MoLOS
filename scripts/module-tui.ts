#!/usr/bin/env tsx

/**
 * MoLOS Module Management TUI
 *
 * Interactive CLI for module management operations
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';

// Load .env file manually for CLI BEFORE other imports
function loadEnv() {
	const envPath = path.resolve(process.cwd(), '.env');
	if (existsSync(envPath)) {
		const envContent = readFileSync(envPath, 'utf-8');
		envContent.split('\n').forEach((line) => {
			const [key, ...valueParts] = line.split('=');
			if (key && valueParts.length > 0) {
				const value = valueParts
					.join('=')
					.trim()
					.replace(/^["']|["']$/g, '');
				process.env[key.trim()] = value;
			}
		});
	}
}
loadEnv();

import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { SettingsRepository } from '../src/lib/repositories/settings/settings-repository';
import { ExternalModuleStatus } from '../src/lib/server/db/schema/settings/tables';

class ModuleTUI {
	private settingsRepo: SettingsRepository;

	constructor() {
		this.settingsRepo = new SettingsRepository();
	}

	async mainMenu() {
		let exit = false;
		while (!exit) {
			console.log('\n--- 🚀 MoLOS Module Management TUI ---\n');

			const { action } = await inquirer.prompt([
				{
					type: 'rawlist',
					name: 'action',
					message: 'What would you like to do?',
					choices: [
						{ name: '📊 View Modules Table', value: 'view_modules' },
						{ name: '🔄 Sync Modules', value: 'sync_modules' },
						{ name: '➕ Create New Module', value: 'create_module' },
						{ name: '📦 Install Module from Git', value: 'install_git' },
						{ name: '📋 Install Module from Local Path', value: 'install_local' },
						{ name: '🗑️  Delete Module', value: 'delete_module' },
						{ name: '🔧 Update Module Status', value: 'update_status' },
						{ name: '✅ Validate Module', value: 'validate_module' },
						{ name: '🧪 Test Module', value: 'test_module' },
						{ name: '📋 View Server Logs', value: 'view_logs' },
						{ name: '❌ Exit', value: 'exit' }
					]
				}
			]);

			switch (action) {
				case 'view_modules':
					await this.viewModules();
					break;
				case 'sync_modules':
					await this.syncModules();
					break;
				case 'create_module':
					await this.createModule();
					break;
				case 'install_git':
					await this.installFromGit();
					break;
				case 'install_local':
					await this.installFromLocal();
					break;
				case 'delete_module':
					await this.deleteModule();
					break;
				case 'update_status':
					await this.updateModuleStatus();
					break;
				case 'validate_module':
					await this.validateModule();
					break;
				case 'test_module':
					await this.testModule();
					break;
				case 'view_logs':
					await this.viewLogs();
					break;
				case 'exit':
					console.log('Goodbye! 👋');
					exit = true;
					break;
				default:
					console.log(`Unknown action: ${action}`);
			}

			if (!exit) {
				console.log('\n--- Returning to Main Menu ---\n');
			}
		}
	}

	async viewModules() {
		console.log('\n📊 External Modules Table\n');

		try {
			const modules = await this.settingsRepo.getExternalModules();

			if (modules.length === 0) {
				console.log('No external modules found.');
				return;
			}

			console.table(
				modules.map((m) => ({
					ID: m.id,
					'Repo URL': m.repoUrl,
					Status: m.status,
					'Last Error': m.lastError || 'None',
					'Installed At': m.installedAt ? new Date(m.installedAt).toLocaleString() : 'N/A',
					'Updated At': new Date(m.updatedAt).toLocaleString()
				}))
			);
		} catch (error) {
			console.error('Failed to fetch modules:', error);
		}
	}

	async syncModules() {
		console.log('\n🔄 Syncing Modules...\n');

		try {
			execSync('npm run modules:sync', { stdio: 'inherit' });
			console.log('\n✅ Modules synced successfully!');
		} catch {
			console.error('\n❌ Failed to sync modules');
		}
	}

	async createModule() {
		console.log('\n➕ Create New Module\n');

		const answers = await inquirer.prompt([
			{
				type: 'input',
				name: 'name',
				message: 'Module name (alphanumeric, hyphens, underscores only):',
				validate: (input) => /^[a-zA-Z0-9_-]+$/.test(input) || 'Invalid module name'
			},
			{
				type: 'input',
				name: 'displayName',
				message: 'Display name (optional):',
				default: (answers: { name: string }) => answers.name
			},
			{
				type: 'input',
				name: 'author',
				message: 'Author (optional):',
				default: 'Module Developer'
			},
			{
				type: 'input',
				name: 'description',
				message: 'Description (optional):',
				default: 'A new MoLOS module'
			},
			{
				type: 'input',
				name: 'version',
				message: 'Version (optional):',
				default: '1.0.0'
			}
		]);

		try {
			const args = [
				answers.name,
				`--name "${answers.displayName}"`,
				`--author "${answers.author}"`,
				`--description "${answers.description}"`,
				`--version "${answers.version}"`
			].join(' ');

			execSync(`npm run module:create ${args}`, { stdio: 'inherit' });
			console.log('\n✅ Module created successfully!');
		} catch {
			console.error('\n❌ Failed to create module');
		}
	}

	async installFromGit() {
		console.log('\n📦 Install Module from Git\n');

		const { repoUrl } = await inquirer.prompt([
			{
				type: 'input',
				name: 'repoUrl',
				message: 'Git repository URL:',
				validate: (input) => input.trim() !== '' || 'Repository URL is required'
			}
		]);

		try {
			// Extract module name from repo URL
			const moduleName = repoUrl.split('/').pop()?.replace('.git', '') || 'unknown-module';

			// Register the module in DB
			await this.settingsRepo.registerExternalModule(moduleName, repoUrl);

			console.log(`\n📦 Module ${moduleName} registered. Running sync to install...`);
			execSync('npm run modules:sync', { stdio: 'inherit' });

			console.log('\n✅ Module installed successfully!');
		} catch {
			console.error('\n❌ Failed to install module');
		}
	}

	async installFromLocal() {
		console.log('\n📋 Install Module from Local Path\n');

		const { localPath } = await inquirer.prompt([
			{
				type: 'input',
				name: 'localPath',
				message: 'Local path to module directory:',
				validate: (input) => existsSync(input) || 'Path does not exist'
			}
		]);

		try {
			const moduleName = path.basename(localPath);

			// Register the module in DB with local:// prefix (using absolute path)
			await this.settingsRepo.registerExternalModule(
				moduleName,
				`local://${path.resolve(localPath)}`
			);

			console.log(`\n📋 Module ${moduleName} registered. Running sync to install...`);
			execSync('npm run modules:sync', { stdio: 'inherit' });

			console.log('\n✅ Module installed successfully!');
		} catch {
			console.error('\n❌ Failed to install module');
		}
	}

	async deleteModule() {
		console.log('\n🗑️  Delete Module\n');

		const modules = await this.settingsRepo.getExternalModules();
		if (modules.length === 0) {
			console.log('No modules available to delete.');
			return;
		}

		const { moduleId } = await inquirer.prompt([
			{
				type: 'rawlist',
				name: 'moduleId',
				message: 'Select module to delete:',
				choices: modules.map((m) => ({
					name: `${m.id} (${m.status})`,
					value: m.id
				}))
			}
		]);

		const { confirm } = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'confirm',
				message: `Are you sure you want to delete module "${moduleId}"? This action cannot be undone.`,
				default: false
			}
		]);

		if (!confirm) {
			console.log('Deletion cancelled.');
			return;
		}

		try {
			// Mark for deletion
			await this.settingsRepo.updateExternalModuleStatus(moduleId, 'deleting');

			// Run sync to process deletion
			console.log('Processing deletion...');
			execSync('npm run modules:sync', { stdio: 'inherit' });

			console.log('\n✅ Module deleted successfully!');
		} catch {
			console.error('\n❌ Failed to delete module');
		}
	}

	async updateModuleStatus() {
		console.log('\n🔧 Update Module Status\n');

		const modules = await this.settingsRepo.getExternalModules();
		if (modules.length === 0) {
			console.log('No modules available.');
			return;
		}

		const { moduleId } = await inquirer.prompt([
			{
				type: 'rawlist',
				name: 'moduleId',
				message: 'Select module:',
				choices: modules.map((m) => ({
					name: `${m.id} (${m.status})`,
					value: m.id
				}))
			}
		]);

		const { newStatus } = await inquirer.prompt([
			{
				type: 'rawlist',
				name: 'newStatus',
				message: 'Select new status:',
				choices: [
					{ name: 'Active', value: ExternalModuleStatus.ACTIVE },
					{ name: 'Disabled', value: ExternalModuleStatus.DISABLED },
					{ name: 'Pending', value: ExternalModuleStatus.PENDING }
				]
			}
		]);

		try {
			await this.settingsRepo.updateExternalModuleStatus(moduleId, newStatus);
			console.log(`\n✅ Module ${moduleId} status updated to ${newStatus}!`);
		} catch {
			console.error('\n❌ Failed to update module status');
		}
	}

	async validateModule() {
		console.log('\n✅ Validate Module\n');

		const { modulePath } = await inquirer.prompt([
			{
				type: 'input',
				name: 'modulePath',
				message: 'Path to module directory:',
				validate: (input) => existsSync(input) || 'Path does not exist'
			}
		]);

		try {
			execSync(`npm run module:validate "${modulePath}"`, { stdio: 'inherit' });
			console.log('\n✅ Module validation completed!');
		} catch {
			console.error('\n❌ Module validation failed');
		}
	}

	async testModule() {
		console.log('\n🧪 Test Module\n');

		const { modulePath } = await inquirer.prompt([
			{
				type: 'input',
				name: 'modulePath',
				message: 'Path to module directory:',
				validate: (input) => existsSync(input) || 'Path does not exist'
			}
		]);

		try {
			execSync(`npm run module:test "${modulePath}"`, { stdio: 'inherit' });
			console.log('\n✅ Module tests completed!');
		} catch {
			console.error('\n❌ Module tests failed');
		}
	}

	async viewLogs() {
		console.log('\n📋 Server Logs\n');

		try {
			const logs = await this.settingsRepo.getServerLogs(20); // Last 20 logs

			if (logs.length === 0) {
				console.log('No logs found.');
				return;
			}

			console.table(
				logs.map((log) => ({
					Time: new Date(log.createdAt).toLocaleString(),
					Level: log.level.toUpperCase(),
					Source: log.source,
					Message: log.message.length > 50 ? log.message.substring(0, 50) + '...' : log.message
				}))
			);
		} catch {
			console.error('Failed to fetch logs');
		}
	}
}

// Main execution
async function main() {
	const tui = new ModuleTUI();
	await tui.mainMenu();
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
