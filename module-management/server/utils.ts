import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	realpathSync,
	rmSync,
	symlinkSync
} from 'fs';
import path from 'path';

/**
 * Route directories for module route symlinks
 * SvelteKit requires routes to be in src/routes/, so we symlink module routes here
 */
export const ROUTE_CONFIG = {
	uiRoutesDir: path.join(process.cwd(), 'src/routes/ui/(modules)/(external_modules)'),
	apiRoutesDir: path.join(process.cwd(), 'src/routes/api/(external_modules)')
};

/**
 * Check if a path is a broken symlink
 */
export function isBrokenSymlink(p: string): boolean {
	try {
		const stats = lstatSync(p);
		if (stats.isSymbolicLink()) {
			return !existsSync(p);
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Create a symlink with proper error handling
 */
export function createSymlink(source: string, dest: string, _allowedRoot?: string): void {
	try {
		rmSync(dest, { recursive: true, force: true });

		const parent = path.dirname(dest);
		if (!existsSync(parent)) {
			mkdirSync(parent, { recursive: true });
		}

		const absoluteSource = path.resolve(source);
		const absoluteDest = path.resolve(dest);
		const stats = lstatSync(absoluteSource);

		if (stats.isSymbolicLink()) {
			throw new Error(`Refusing to create symlink from symlinked source: ${absoluteSource}`);
		}

		const type = stats.isDirectory() ? 'dir' : 'file';
		symlinkSync(absoluteSource, absoluteDest, type);
	} catch (e: unknown) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		throw new Error(`Failed to create symlink from ${source} to ${dest}: ${errorMessage}`);
	}
}

/**
 * Ensure all required parent directories exist for route symlinks
 */
export function ensureSymlinkDirectories(): void {
	const parentDirs = [ROUTE_CONFIG.uiRoutesDir, ROUTE_CONFIG.apiRoutesDir];

	for (const dir of parentDirs) {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
	}
}

/**
 * Get route symlink destinations for a module
 */
export function getModuleRouteSymlinks(moduleId: string): {
	uiRoutes?: string;
	apiRoutes?: string;
} {
	return {
		uiRoutes: path.join(ROUTE_CONFIG.uiRoutesDir, moduleId),
		apiRoutes: path.join(ROUTE_CONFIG.apiRoutesDir, moduleId)
	};
}

/**
 * Get route symlink sources for a module
 */
export function getModuleRouteSources(
	_moduleId: string,
	modulePath: string
): { uiRoutes?: string; apiRoutes?: string } {
	return {
		uiRoutes: path.join(modulePath, 'src/routes/ui'),
		apiRoutes: path.join(modulePath, 'src/routes/api')
	};
}

/**
 * Clean up module artifacts (route symlinks) for a specific module
 */
export function cleanupModuleArtifacts(moduleId: string): void {
	const destinations = getModuleRouteSymlinks(moduleId);
	const paths = Object.values(destinations).filter(Boolean) as string[];

	for (const p of paths) {
		try {
			if (existsSync(p) || isBrokenSymlink(p)) {
				rmSync(p, { recursive: true, force: true });
			}
		} catch {
			// Path doesn't exist or couldn't be accessed
		}
	}
}

/**
 * Clean up broken symlinks in the route directories
 */
export function cleanupBrokenSymlinks(): void {
	const symlinkDirs = [ROUTE_CONFIG.uiRoutesDir, ROUTE_CONFIG.apiRoutesDir];

	for (const dir of symlinkDirs) {
		if (!existsSync(dir)) continue;

		try {
			const items = readdirSync(dir, { withFileTypes: true });
			for (const item of items) {
				const itemPath = path.join(dir, item.name);
				if (item.isSymbolicLink() && isBrokenSymlink(itemPath)) {
					rmSync(itemPath, { recursive: true, force: true });
				}
			}
		} catch {
			// Ignore errors during cleanup
		}
	}
}
