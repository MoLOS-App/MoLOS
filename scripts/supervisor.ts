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

	while (true) {
		// 0. Sync/Cleanup modules before build
		console.log('\n[Supervisor] Phase 0: Synchronizing modules...');
		const syncCode = await runCommand('npm', ['run', 'modules:sync']);

		if (syncCode !== 0) {
			console.error(`[Supervisor] Module sync failed with code ${syncCode}. Exiting.`);
			process.exit(syncCode || 1);
		}

		// 1. Build the project
		console.log('\n[Supervisor] Phase 1: Building project...');
		const buildCode = await runCommand('npm', ['run', 'build']);

		if (buildCode !== 0) {
			console.error(`[Supervisor] Build failed with code ${buildCode}. Exiting.`);
			process.exit(buildCode || 1);
		}

		// 2. Run the preview server
		console.log('\n[Supervisor] Phase 2: Starting preview server...');
		const exitCode = await runCommand('npm', ['run', 'preview']);

		if (exitCode === REBUILD_EXIT_CODE) {
			console.log('\n[Supervisor] 🔄 Rebuild requested (Exit Code 10). Restarting loop...');
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
