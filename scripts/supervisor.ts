import { spawn } from 'child_process';

const REBUILD_EXIT_CODE = 10;

async function runCommand(command: string, args: string[]): Promise<number | null> {
	return new Promise((resolve) => {
		console.log(`[Supervisor] Running: ${command} ${args.join(' ')}`);
		const child = spawn(command, args, { stdio: 'inherit', shell: true });

		child.on('exit', (code) => {
			resolve(code);
		});
	});
}

async function start() {
	console.log('[Supervisor] Starting MoLOS Automated Supervisor...');

	let rebuildRequested = false;

	while (true) {
		// 0. Sync/Cleanup modules before build
		console.log('\n[Supervisor] Phase 0: Synchronizing modules...');
		const syncCode = await runCommand('npm', ['run', 'module:sync']);

		if (syncCode !== 0) {
			console.error(`[Supervisor] Module sync failed with code ${syncCode}. Exiting.`);
			process.exit(syncCode || 1);
		}

		// 1. Build the project
		const allowProdBuild =
			process.env.MOLOS_ENABLE_PROD_BUILD === 'true' || process.env.FORCE_REBUILD === 'true';
		if (process.env.NODE_ENV === 'production' && !allowProdBuild && !rebuildRequested) {
			console.log('\n[Supervisor] Phase 1: Skipping build in production environment.');
		} else {
			console.log('\n[Supervisor] Phase 1: Building project...');
			const buildCode = await runCommand('npm', ['run', 'build']);

			if (buildCode !== 0) {
				console.error(`[Supervisor] Build failed with code ${buildCode}. Exiting.`);
				process.exit(buildCode || 1);
			}
			rebuildRequested = false;
		}

		// 2. Run the server
		let exitCode: number | null;
		if (process.env.NODE_ENV === 'production') {
			console.log('\n[Supervisor] Phase 2: Starting production server...');
			exitCode = await runCommand('node', ['build/index.js']);
		} else {
			console.log('\n[Supervisor] Phase 2: Starting preview server...');
			exitCode = await runCommand('npm', ['run', 'preview']);
		}

		if (exitCode === REBUILD_EXIT_CODE) {
			console.log('\n[Supervisor] 🔄 Rebuild requested (Exit Code 10). Restarting loop...');
			rebuildRequested = true;
			continue;
		} else {
			console.log(`\n[Supervisor] Server exited with code ${exitCode}. Stopping supervisor.`);
			process.exit(exitCode || 0);
		}
	}
}

start().catch((err) => {
	console.error('[Supervisor] Fatal error:', err);
	process.exit(1);
});
