import { spawn } from 'child_process';
import { readdirSync, existsSync, readFileSync } from 'fs';
import path from 'path';

const EXTERNAL_MODULES_DIR = path.join(process.cwd(), 'external_modules');

async function runCommand(
	command: string,
	args: string[],
	cwd: string,
	prefix: string
): Promise<void> {
	return new Promise((resolve) => {
		console.log(`[${prefix}] Starting: ${command} ${args.join(' ')} in ${cwd}`);
		const child = spawn(command, args, {
			stdio: 'pipe',
			shell: true,
			cwd,
			env: { ...process.env, FORCE_COLOR: 'true' }
		});

		child.stdout?.on('data', (data: Buffer) => {
			process.stdout.write(`[${prefix}] ${data}`);
		});

		child.stderr?.on('data', (data: Buffer) => {
			process.stderr.write(`[${prefix}] ${data}`);
		});

		child.on('exit', (code: number | null) => {
			console.log(`[${prefix}] Exited with code ${code}`);
			resolve();
		});
	});
}

async function main() {
	if (!existsSync(EXTERNAL_MODULES_DIR)) {
		console.log('No external modules found.');
		return;
	}

	const modules = readdirSync(EXTERNAL_MODULES_DIR, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory() || dirent.isSymbolicLink())
		.map((dirent) => dirent.name);

	console.log(`🚀 Orchestrating ${modules.length} modules...`);

	const tasks: Promise<void>[] = [];

	for (const moduleId of modules) {
		const modulePath = path.join(EXTERNAL_MODULES_DIR, moduleId);
		const pkgJsonPath = path.join(modulePath, 'package.json');

		if (existsSync(pkgJsonPath)) {
			// 1. Database Sync (Drizzle)
			if (
				existsSync(path.join(modulePath, 'drizzle.config.ts')) ||
				existsSync(path.join(modulePath, 'drizzle.config.js'))
			) {
				console.log(`[${moduleId}] Syncing database...`);
				tasks.push(runCommand('npm', ['run', 'db:generate'], modulePath, `${moduleId}:db`));
				tasks.push(runCommand('npm', ['run', 'db:migrate'], modulePath, `${moduleId}:db`));
			}

			// 2. Dev Server (if standalone dev is supported)
			// We check for a 'dev' script in package.json
			const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
			if (pkg.scripts && pkg.scripts.dev) {
				console.log(`[${moduleId}] Starting dev server...`);
				tasks.push(runCommand('npm', ['run', 'dev'], modulePath, `${moduleId}:dev`));
			}
		}
	}

	// Also start the main MoLOS dev server
	tasks.push(runCommand('npm', ['run', 'dev'], process.cwd(), 'MoLOS:core'));

	await Promise.all(tasks);
}

main().catch(console.error);
