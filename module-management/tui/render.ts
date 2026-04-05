import { bold, dim } from './theme';

export function renderHeader(title: string) {
	console.log(`\n${bold(title)}\n${dim('-'.repeat(title.length))}`);
}

export function renderKeyValue(key: string, value: string) {
	console.log(`${dim(key.padEnd(18))} ${value}`);
}
