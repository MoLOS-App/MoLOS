/**
 * File Utilities - Atomic Write Operations for Data Integrity
 *
 * ## Purpose
 * Provides safe file system operations that guarantee data integrity
 * even in the face of system crashes, power failures, or concurrent access.
 *
 * ## Key Concepts
 * - **Atomic writes**: Temp file + rename pattern prevents partial writes
 * - **fsync()**: Ensures data reaches physical storage (not just OS cache)
 * - **Directory sync**: Ensures rename is committed to directory structure
 * - **Secure permissions**: 0o600 restricts file access to owner only
 *
 * ## Safety Guarantees
 * 1. **Original file untouched**: Until rename completes successfully
 * 2. **Temp file cleanup**: On any error, temp file is removed
 * 3. **Data durability**: fsync() forces physical write
 * 4. **Rename commitment**: Directory sync ensures rename is permanent
 * 5. **Secure permissions**: 0o600 prevents unauthorized access
 *
 * ## Why fsync() is Critical
 * Modern operating systems use write caching for performance:
 * - `fs.writeFile()` may only write to OS page cache
 * - Data can be lost on power failure (data lives in RAM)
 * - `fsync()` forces data to physical storage
 * - Without fsync, atomic write pattern is NOT truly atomic
 *
 * ## Directory Sync is Essential
 * The rename() syscall only updates directory metadata:
 * - Directory entries cached by OS
 * - Crash after rename but before directory sync = lost file
 * - fsync(dirFd) ensures directory entry is permanent
 *
 * ## Usage Pattern
 * ```typescript
 * // CORRECT: Use for any persistent data
 * await writeFileAtomic('/path/to/data.json', JSON.stringify(data));
 *
 * // WRONG: Plain writeFile can corrupt on crash
 * await fs.writeFile('/path/to/data.json', JSON.stringify(data));
 * ```
 *
 * ## Context Optimization
 * - Batch multiple writes when possible (reduce fsync overhead)
 * - Consider write coalescing for frequent small updates
 * - 0o600 permission is default - don't increase unless necessary
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

/**
 * Read a file with optional encoding.
 *
 * @param filePath - Absolute or relative path to file
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
 * WriteFileAtomic - Atomically write data to a file using temp file + rename.
 *
 * ## Algorithm
 * 1. Create temp file with unique name (PID + random bytes)
 * 2. Write data to temp file with secure permissions (0o600)
 * 3. fsync() temp file to force physical storage
 * 4. rename() temp file to target (atomic on POSIX)
 * 5. fsync() directory to commit rename
 * 6. On error: unlink temp file and throw
 *
 * ## Safety Guarantees (in detail)
 *
 * **Original file preservation**:
 * - rename() only succeeds if temp file exists and is valid
 * - Original file remains intact until step 4
 * - If step 4 fails, original is untouched
 *
 * **Temp file cleanup**:
 * - On any error after temp file creation, it's unlinked
 * - Try/catch ensures cleanup even if write fails
 * - Errors during cleanup are ignored (not rethrown)
 *
 * **Data durability (fsync)**:
 * - Without fsync: OS may hold data in cache
 * - fsync(tempFd) ensures data is on disk
 * - fsync(dirFd) ensures rename is permanent
 *
 * **Secure permissions**:
 * - 0o600 = owner read/write only
 * - Prevents other users on system from reading data
 * - Critical for sensitive data (credentials, sessions, memory)
 *
 * ## Permission Security (0o600)
 * ```
 * 0o600 = ----rw---- (owner only)
 * 0o644 = -rw-r--r-- (world readable - UNSAFE for sensitive data)
 * ```
 *
 * Default 0o600 is correct for:
 * - Session storage
 * - Memory files
 * - Configuration with secrets
 * - Any data that shouldn't be shared
 *
 * @param filePath - Target file path
 * @param data - Content to write
 * @param filePermissions - Unix permissions (default: 0o600)
 * @throws Any I/O error during write, sync, rename, or cleanup
 */
export async function writeFileAtomic(
	filePath: string,
	data: string,
	filePermissions: number = 0o600
): Promise<void> {
	const dir = path.dirname(filePath);
	const filename = path.basename(filePath);
	// Unique temp file prevents collisions under concurrent writes
	// PID ensures temp files from crashed processes don't persist
	// Random bytes add uniqueness for parallel operations
	const tmpFilename = `.tmp-${process.pid}-${randomBytes(8).toString('hex')}-${filename}`;
	const tmpPath = path.join(dir, tmpFilename);

	try {
		// Ensure directory exists (creates parents recursively)
		await fs.mkdir(dir, { recursive: true });

		// Write data to temp file with secure permissions
		// Mode is set atomically during creation
		await fs.writeFile(tmpPath, data, { mode: filePermissions });

		// CRITICAL: Force data to physical storage
		// Without this, data may only be in OS cache and lost on crash
		const tmpFd = await fs.open(tmpPath, 'r');
		try {
			await tmpFd.sync();
		} finally {
			await tmpFd.close();
		}

		// Atomically rename temp file to target
		// rename() is atomic on POSIX systems
		// Target file is created and temp is removed in one step
		await fs.rename(tmpPath, filePath);

		// CRITICAL: Sync directory to commit rename
		// Directory changes may be cached separately from file data
		// Without this, crash could lose the file reference
		const dirFd = await fs.open(dir, 'r');
		try {
			await dirFd.sync();
		} finally {
			await dirFd.close();
		}
	} catch (error) {
		// Clean up temp file on error
		// Ignore errors during cleanup (original error is more important)
		try {
			await fs.unlink(tmpPath);
		} catch {
			// Ignore cleanup errors
		}

		throw error;
	}
}
