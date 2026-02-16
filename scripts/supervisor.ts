import { spawn } from 'child_process';

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
	console.log('[Supervisor] Starting MoLOS Supervisor...');

	const nodeEnv = process.env.NODE_ENV || 'production';
	if (!process.env.PORT) {
		process.env.PORT = '4173';
	}

	console.log('\n[Supervisor] Phase 0: Synchronizing modules...');
	const syncCode = await runCommand('bun', ['run', 'module:sync']);

	if (syncCode !== 0) {
		console.error(`[Supervisor] Module sync failed with code ${syncCode}. Exiting.`);
		process.exit(syncCode || 1);
	}

	const allowProdBuild = process.env.MOLOS_ENABLE_PROD_BUILD === 'true';
	if (nodeEnv === 'production' && !allowProdBuild) {
		console.log('\n[Supervisor] Phase 1: Skipping build in production environment.');
	} else {
		console.log('\n[Supervisor] Phase 1: Building project...');
		const buildCode = await runCommand('bun', ['run', 'build']);

		if (buildCode !== 0) {
			console.error(`[Supervisor] Build failed with code ${buildCode}. Exiting.`);
			process.exit(buildCode || 1);
		}
	}

	let exitCode: number | null;
	if (nodeEnv === 'production') {
		console.log('\n[Supervisor] Phase 2: Starting production server...');
		exitCode = await runCommand('node', ['build/index.js']);
	} else {
		console.log('\n[Supervisor] Phase 2: Starting preview server...');
		exitCode = await runCommand('bun', ['run', 'preview']);
	}

	console.log(`\n[Supervisor] Server exited with code ${exitCode}.`);
	process.exit(exitCode || 0);
}

start().catch((err) => {
	console.error('[Supervisor] Fatal error:', err);
	process.exit(1);
});
