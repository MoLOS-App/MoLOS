import { existsSync, lstatSync, readdirSync, rmSync } from 'fs';
import path from 'path';

const TARGET_DIRS = [
	'src/routes/api/(external_modules)',
	'src/routes/ui/(modules)/(external_modules)',
	'src/lib/config/external_modules',
	'src/lib/components/external_modules',
	'src/lib/models/external_modules',
	'src/lib/repositories/external_modules',
	'src/lib/stores/external_modules',
	'src/lib/utils/external_modules',
	'src/lib/server/ai/external_modules',
	'src/lib/server/db/schema/external_modules'
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
