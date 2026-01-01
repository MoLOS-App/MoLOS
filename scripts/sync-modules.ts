import { ModuleManager } from '../src/lib/server/modules/module-manager';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

// Load .env file manually for CLI
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

async function main() {
	loadEnv();
	console.log('[SyncModules] Starting module synchronization...');
	try {
		await ModuleManager.init();
		console.log('[SyncModules] Module synchronization complete.');
		process.exit(0);
	} catch (err) {
		console.error('[SyncModules] Failed to synchronize modules:', err);
		process.exit(1);
	}
}

main();
