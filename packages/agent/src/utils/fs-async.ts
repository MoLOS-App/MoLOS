/**
 * Async File System Utilities
 *
 * Provides non-blocking async alternatives to synchronous fs operations.
 * All operations return Promises and use the async/await pattern.
 *
 * ## Why Async?
 * Synchronous file operations (`fs.readFileSync`, `fs.statSync`, etc.)
 * block the Node.js event loop, degrading server responsiveness.
 * These async versions allow other operations to proceed while waiting
 * for file I/O to complete.
 *
 * ## Usage Pattern
 * ```typescript
 * // Instead of (blocking):
 * if (fs.existsSync(path)) { ... }
 *
 * // Use (non-blocking):
 * if (await pathExists(path)) { ... }
 * ```
 */

import { promises as fs, type Dirent } from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface FileStats {
	isFile: () => boolean;
	isDirectory: () => boolean;
	mtimeMs: number;
}

export interface DirectoryEntry {
	isFile: () => boolean;
	isDirectory: () => boolean;
	name: string;
}

/**
 * Check if a path exists (async alternative to fs.existsSync)
 *
 * @param filePath - Path to check
 * @returns true if path exists, false otherwise
 */
export async function pathExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Read a file's contents (async alternative to fs.readFileSync)
 *
 * @param filePath - Path to file
 * @param encoding - Character encoding (default: utf-8)
 * @returns File contents as string
 * @throws ENOENT if file doesn't exist
 */
export async function readFile(
	filePath: string,
	encoding: BufferEncoding = 'utf-8'
): Promise<string> {
	return fs.readFile(filePath, { encoding });
}

/**
 * Get file stats (async alternative to fs.statSync)
 *
 * @param filePath - Path to file
 * @returns FileStats object or null if file doesn't exist
 */
export async function stat(filePath: string): Promise<FileStats | null> {
	try {
		const stats = await fs.stat(filePath);
		return {
			isFile: () => stats.isFile(),
			isDirectory: () => stats.isDirectory(),
			mtimeMs: stats.mtimeMs
		};
	} catch {
		return null;
	}
}

/**
 * Read directory contents (async alternative to fs.readdirSync)
 *
 * @param dirPath - Path to directory
 * @param withFileTypes - Include file type info (default: true)
 * @returns Array of directory entries
 */
export async function readdir(dirPath: string, withFileTypes: true): Promise<DirectoryEntry[]>;
export async function readdir(dirPath: string, withFileTypes?: false): Promise<string[]>;
export async function readdir(
	dirPath: string,
	withFileTypes: boolean = true
): Promise<DirectoryEntry[] | string[]> {
	if (withFileTypes) {
		const entries = await fs.readdir(dirPath, { withFileTypes: true });
		return entries.map((entry: Dirent) => ({
			name: entry.name,
			isFile: () => entry.isFile(),
			isDirectory: () => entry.isDirectory()
		}));
	} else {
		return fs.readdir(dirPath);
	}
}

/**
 * Get the user's home directory
 *
 * Uses os.homedir() which is synchronous but very fast and cached.
 */
export function getHomeDir(): string {
	return os.homedir();
}

/**
 * Join path segments
 *
 * Uses path.join which is synchronous but very fast.
 */
export function joinPath(...segments: string[]): string {
	return path.join(...segments);
}
