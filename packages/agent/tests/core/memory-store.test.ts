/**
 * Tests for Memory Store
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MemoryStore } from '../../src/core/memory-store.js';

describe('MemoryStore', () => {
	let tempDir: string;
	let memoryStore: MemoryStore;

	beforeEach(async () => {
		// Create a unique temp directory for each test
		tempDir = path.join(
			'/tmp',
			`molos-agent-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
		);
		await fs.mkdir(tempDir, { recursive: true });
		memoryStore = new MemoryStore({ workspace: tempDir });
	});

	afterEach(async () => {
		// Clean up temp directory
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe('readLongTerm', () => {
		it('should return empty string when file does not exist', async () => {
			const content = await memoryStore.readLongTerm();
			expect(content).toBe('');
		});

		it('should read existing MEMORY.md file', async () => {
			const memoryPath = path.join(tempDir, 'memory', 'MEMORY.md');
			await fs.mkdir(path.dirname(memoryPath), { recursive: true });
			await fs.writeFile(memoryPath, '# Long term memory\n\nI am a helpful assistant.', 'utf-8');

			const store = new MemoryStore({ workspace: tempDir });
			const content = await store.readLongTerm();
			expect(content).toBe('# Long term memory\n\nI am a helpful assistant.');
		});
	});

	describe('writeLongTerm', () => {
		it('should write content to MEMORY.md atomically', async () => {
			const content = '# Memory\n\nTest content';
			await memoryStore.writeLongTerm(content);

			// Verify file exists and has correct content
			const memoryPath = path.join(tempDir, 'memory', 'MEMORY.md');
			const readContent = await fs.readFile(memoryPath, 'utf-8');
			expect(readContent).toBe(content);
		});

		it('should create memory directory if it does not exist', async () => {
			const content = '# Memory\n\nTest content';
			await memoryStore.writeLongTerm(content);

			const memoryPath = path.join(tempDir, 'memory', 'MEMORY.md');
			await expect(fs.access(memoryPath)).resolves.not.toThrow();
		});

		it('should overwrite existing content', async () => {
			await memoryStore.writeLongTerm('First content');
			await memoryStore.writeLongTerm('Second content');

			const content = await memoryStore.readLongTerm();
			expect(content).toBe('Second content');
		});
	});

	describe('appendToday', () => {
		it('should create file with date header if does not exist', async () => {
			const content = 'Some daily notes';
			await memoryStore.appendToday(content);

			// Check that the file was created in the correct month directory
			const today = new Date();
			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, '0');
			const day = String(today.getDate()).padStart(2, '0');

			const expectedDir = path.join(tempDir, 'memory', `${year}${month}`);
			const expectedFile = path.join(expectedDir, `${year}${month}${day}.md`);

			const fileExists = await fs
				.access(expectedFile)
				.then(() => true)
				.catch(() => false);
			expect(fileExists).toBe(true);

			const fileContent = await fs.readFile(expectedFile, 'utf-8');
			expect(fileContent).toContain(`# ${year}-${month}-${day}`);
			expect(fileContent).toContain(content);
		});

		it('should append to existing daily note', async () => {
			const today = new Date();
			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, '0');
			const day = String(today.getDate()).padStart(2, '0');

			// Create month directory and file
			const monthDir = path.join(tempDir, 'memory', `${year}${month}`);
			await fs.mkdir(monthDir, { recursive: true });
			const todayPath = path.join(monthDir, `${year}${month}${day}.md`);
			await fs.writeFile(todayPath, `# ${year}-${month}-${day}\n\nExisting content`, 'utf-8');

			await memoryStore.appendToday('New content');

			const fileContent = await fs.readFile(todayPath, 'utf-8');
			expect(fileContent).toContain('Existing content');
			expect(fileContent).toContain('New content');
		});

		it('should create month directory if it does not exist', async () => {
			await memoryStore.appendToday('Content');

			const today = new Date();
			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, '0');
			const monthDir = path.join(tempDir, 'memory', `${year}${month}`);

			const dirExists = await fs
				.access(monthDir)
				.then(() => true)
				.catch(() => false);
			expect(dirExists).toBe(true);
		});
	});

	describe('getRecentDailyNotes', () => {
		it('should return empty string when no notes exist', async () => {
			const notes = await memoryStore.getRecentDailyNotes(3);
			expect(notes).toBe('');
		});

		it('should return notes from last N days', async () => {
			const today = new Date();

			// Create notes for today, yesterday, and 2 days ago
			for (let i = 0; i < 3; i++) {
				const date = new Date(today);
				date.setDate(date.getDate() - i);
				const year = date.getFullYear();
				const month = String(date.getMonth() + 1).padStart(2, '0');
				const day = String(date.getDate()).padStart(2, '0');

				const monthDir = path.join(tempDir, 'memory', `${year}${month}`);
				await fs.mkdir(monthDir, { recursive: true });

				const notePath = path.join(monthDir, `${year}${month}${day}.md`);
				const content = `Content for day ${i}`;
				await fs.writeFile(notePath, content, 'utf-8');
			}

			const notes = await memoryStore.getRecentDailyNotes(3);
			expect(notes).toContain('Content for day 0');
			expect(notes).toContain('Content for day 1');
			expect(notes).toContain('Content for day 2');
		});

		it('should skip days without notes', async () => {
			const today = new Date();
			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, '0');
			const day = String(today.getDate()).padStart(2, '0');

			// Create only today's note
			const monthDir = path.join(tempDir, 'memory', `${year}${month}`);
			await fs.mkdir(monthDir, { recursive: true });
			const notePath = path.join(monthDir, `${year}${month}${day}.md`);
			await fs.writeFile(notePath, "Today's content", 'utf-8');

			const notes = await memoryStore.getRecentDailyNotes(3);
			expect(notes).toContain("Today's content");
		});

		it('should use default of 3 days', async () => {
			const today = new Date();
			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, '0');
			const day = String(today.getDate()).padStart(2, '0');

			const monthDir = path.join(tempDir, 'memory', `${year}${month}`);
			await fs.mkdir(monthDir, { recursive: true });
			const notePath = path.join(monthDir, `${year}${month}${day}.md`);
			await fs.writeFile(notePath, 'Today content', 'utf-8');

			// Call without specifying days
			const notes = await memoryStore.getRecentDailyNotes();
			expect(notes).toContain('Today content');
		});
	});

	describe('getMemoryContext', () => {
		it('should return empty string when no memory exists', async () => {
			const context = await memoryStore.getMemoryContext();
			expect(context).toBe('');
		});

		it('should format long-term memory correctly', async () => {
			await memoryStore.writeLongTerm('I am a helpful AI assistant.');

			const context = await memoryStore.getMemoryContext();
			expect(context).toContain('## Long-term Memory');
			expect(context).toContain('I am a helpful AI assistant.');
		});

		it('should format recent daily notes correctly', async () => {
			const today = new Date();
			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, '0');
			const day = String(today.getDate()).padStart(2, '0');

			const monthDir = path.join(tempDir, 'memory', `${year}${month}`);
			await fs.mkdir(monthDir, { recursive: true });
			const notePath = path.join(monthDir, `${year}${month}${day}.md`);
			await fs.writeFile(notePath, 'Daily note content', 'utf-8');

			const context = await memoryStore.getMemoryContext();
			expect(context).toContain('## Recent Daily Notes');
			expect(context).toContain('Daily note content');
		});

		it('should combine long-term and daily notes with separator', async () => {
			await memoryStore.writeLongTerm('Long term memory content');

			const today = new Date();
			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, '0');
			const day = String(today.getDate()).padStart(2, '0');

			const monthDir = path.join(tempDir, 'memory', `${year}${month}`);
			await fs.mkdir(monthDir, { recursive: true });
			const notePath = path.join(monthDir, `${year}${month}${day}.md`);
			await fs.writeFile(notePath, 'Daily note content', 'utf-8');

			const context = await memoryStore.getMemoryContext();
			expect(context).toContain('## Long-term Memory');
			expect(context).toContain('## Recent Daily Notes');
			expect(context).toContain('---');
		});

		it('should not include empty sections', async () => {
			await memoryStore.writeLongTerm('Long term content');
			// No daily notes

			const context = await memoryStore.getMemoryContext();
			expect(context).toContain('## Long-term Memory');
			expect(context).not.toContain('## Recent Daily Notes');
		});
	});

	describe('date formatting', () => {
		it('should format month directory as YYYYMM', async () => {
			await memoryStore.appendToday('Test');

			const today = new Date();
			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, '0');
			const expectedDir = path.join(tempDir, 'memory', `${year}${month}`);

			const dirContents = await fs.readdir(path.join(tempDir, 'memory'));
			expect(dirContents).toContain(`${year}${month}`);
		});

		it('should format daily note filename as YYYYMMDD.md', async () => {
			await memoryStore.appendToday('Test');

			const today = new Date();
			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, '0');
			const day = String(today.getDate()).padStart(2, '0');

			const monthDir = path.join(tempDir, 'memory', `${year}${month}`);
			const dirContents = await fs.readdir(monthDir);
			expect(dirContents).toContain(`${year}${month}${day}.md`);
		});
	});

	describe('atomic writes', () => {
		it('should verify file exists after writeLongTerm completes', async () => {
			const content = 'Atomic write test';
			await memoryStore.writeLongTerm(content);

			const memoryPath = path.join(tempDir, 'memory', 'MEMORY.md');
			const stats = await fs.stat(memoryPath);
			expect(stats.isFile()).toBe(true);
		});

		it('should verify file exists after appendToday completes', async () => {
			await memoryStore.appendToday('Atomic test');

			const today = new Date();
			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, '0');
			const day = String(today.getDate()).padStart(2, '0');

			const notePath = path.join(tempDir, 'memory', `${year}${month}`, `${year}${month}${day}.md`);
			const stats = await fs.stat(notePath);
			expect(stats.isFile()).toBe(true);
		});
	});
});
