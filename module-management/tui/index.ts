#!/usr/bin/env tsx

import { loadEnv } from './env';

async function main() {
	loadEnv();
	const { ModuleTUI } = await import('./app');
	const { SettingsRepository } =
		await import('../../src/lib/repositories/settings/settings-repository');
	const repo = new SettingsRepository();
	const tui = new ModuleTUI(repo);
	await tui.run();
}

main().catch((error) => {
	console.error('Fatal error:', error instanceof Error ? error.message : String(error));
	process.exit(1);
});
