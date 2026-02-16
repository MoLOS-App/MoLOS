import { ModuleManager } from '../module-management/server/module-manager';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { linkModuleRoutes } from './link-modules.js';

async function main() {
	console.log('[SyncModules] Starting module synchronization...');

	const modulesDir = path.resolve(process.cwd(), 'modules');

	try {
		await ModuleManager.init();

		// Link module routes
		console.log('[SyncModules] Linking module routes...');
		await linkModuleRoutes();

		console.log('[SyncModules] Module synchronization complete.');
	} catch (err) {
		console.error('[SyncModules] Failed to synchronize modules:', err);
		process.exit(1);
	}
}

main();
