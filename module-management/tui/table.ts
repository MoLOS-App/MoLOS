import type { ModuleRecord } from './types';
import { formatStatus, shortPath, stripAnsi, truncate } from './format';
import { bold, dim } from './theme';

export function renderModulesTable(modules: ModuleRecord[]) {
	if (modules.length === 0) {
		console.log(dim('No modules found.'));
		return;
	}

	const rows = modules.map((module) => {
		const displayName = module.manifest?.name || module.packageJson?.name || module.id;
		const version = module.manifest?.version || module.packageJson?.version || 'n/a';
		return [
			module.id,
			displayName,
			module.source,
			formatStatus(module.status),
			version,
			shortPath(module.path),
			truncate(module.repoUrl || 'n/a', 30)
		];
	});

	const headers = ['ID', 'Name', 'Source', 'Status', 'Version', 'Path', 'Repo'];
	const widths = headers.map((header, index) =>
		Math.max(
			header.length,
			...rows.map((row) => stripAnsi(row[index]).length)
		)
	);

	const pad = (value: string, width: number) => {
		const diff = width - stripAnsi(value).length;
		return diff > 0 ? `${value}${' '.repeat(diff)}` : value;
	};
	const headerLine = headers.map((header, i) => pad(header, widths[i])).join('  ');

	console.log(bold(headerLine));
	console.log(dim(widths.map((w) => '-'.repeat(w)).join('  ')));
	rows.forEach((row) => {
		console.log(row.map((cell, i) => pad(cell, widths[i])).join('  '));
	});
}
