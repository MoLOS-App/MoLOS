import path from 'path';
import type { ExternalModuleStatus } from './types';
import { dim, green, red, yellow } from './theme';

export function formatStatus(status?: ExternalModuleStatus) {
	if (!status) return dim('n/a');
	switch (status) {
		case 'active':
			return green(status);
		case 'pending':
			return yellow(status);
		case 'disabled':
			return dim(status);
		case 'deleting':
			return yellow(status);
		case 'error_manifest':
		case 'error_migration':
		case 'error_config':
			return red(status);
		default:
			return status;
	}
}

export function truncate(value: string, max = 44) {
	if (value.length <= max) return value;
	return `${value.slice(0, max - 3)}...`;
}

export function stripAnsi(value: string) {
	return value.replace(/\x1b\[[0-9;]*m/g, '');
}

export function shortPath(value?: string) {
	if (!value) return 'n/a';
	const relative = path.relative(process.cwd(), value);
	return truncate(relative === '' ? value : relative);
}
