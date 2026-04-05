import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { parse } from 'yaml';
import { EXTERNAL_MODULES_DIR } from './constants';
import type { FsModule, ManifestInfo } from './types';
import { dim, red } from './theme';

type PackageJson = { name?: string; version?: string; description?: string };

function safeReadJson(filePath: string) {
	if (!existsSync(filePath)) return null;
	try {
		const content = readFileSync(filePath, 'utf-8');
		return JSON.parse(content) as PackageJson;
	} catch {
		return null;
	}
}

function safeReadManifest(filePath: string) {
	if (!existsSync(filePath)) return null;
	try {
		const content = readFileSync(filePath, 'utf-8');
		return parse(content) as ManifestInfo;
	} catch {
		return null;
	}
}

export function listModulesFromFilesystem(): FsModule[] {
	if (!existsSync(EXTERNAL_MODULES_DIR)) return [];

	const entries = readdirSync(EXTERNAL_MODULES_DIR, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
		.map((entry) => {
			const modulePath = path.join(EXTERNAL_MODULES_DIR, entry.name);
			const manifestPath = path.join(modulePath, 'manifest.yaml');
			const packageJsonPath = path.join(modulePath, 'package.json');

			return {
				id: entry.name,
				path: modulePath,
				manifest: safeReadManifest(manifestPath) || undefined,
				packageJson: safeReadJson(packageJsonPath) || undefined,
				hasManifest: existsSync(manifestPath),
				hasPackageJson: existsSync(packageJsonPath),
				hasRoutes: existsSync(path.join(modulePath, 'routes')),
				hasLib: existsSync(path.join(modulePath, 'lib')),
				hasConfig: existsSync(path.join(modulePath, 'config.ts')),
				hasDrizzle: existsSync(path.join(modulePath, 'drizzle'))
			};
		})
		.sort((a, b) => a.id.localeCompare(b.id));
}

export function previewFile(filePath: string, maxLines = 24) {
	if (!existsSync(filePath)) {
		console.log(red(`File not found: ${filePath}`));
		return;
	}
	const content = readFileSync(filePath, 'utf-8');
	const lines = content.split('\n').slice(0, maxLines);
	console.log(lines.join('\n'));
	if (lines.length >= maxLines) {
		console.log(dim(`... ${maxLines} lines shown`));
	}
}
