import { existsSync, lstatSync, readdirSync, rmSync } from 'fs';
import path from 'path';

/**
 * Cleanup broken symlinks in module route directories
 */
const TARGET_DIRS = [
	'src/routes/api/(external_modules)',
	'src/routes/ui/(modules)/(external_modules)'
];

function isBrokenSymlink(p: string): boolean {
	try {
		const stats = lstatSync(p);
		if (!stats.isSymbolicLink()) return false;
		return !existsSync(p);
	} catch {
		return false;
	}
}

function cleanupDir(relativeDir: string) {
	const dir = path.resolve(process.cwd(), relativeDir);
	if (!existsSync(dir)) return;
	const entries = readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (!entry.isSymbolicLink()) continue;
		if (isBrokenSymlink(fullPath)) {
			rmSync(fullPath, { recursive: true, force: true });
			console.log(`[ModuleCleanup] Removed broken symlink: ${fullPath}`);
		}
	}
}

for (const dir of TARGET_DIRS) {
	cleanupDir(dir);
}

console.log('[ModuleCleanup] Cleanup complete');
