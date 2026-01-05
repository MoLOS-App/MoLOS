import { existsSync, readFileSync } from 'fs';
import path from 'path';

export function loadEnv() {
	const envPath = path.resolve(process.cwd(), '.env');
	if (!existsSync(envPath)) return;

	const envContent = readFileSync(envPath, 'utf-8');
	envContent.split('\n').forEach((line) => {
		const [key, ...valueParts] = line.split('=');
		if (!key || valueParts.length === 0) return;
		const value = valueParts
			.join('=')
			.trim()
			.replace(/^["']|["']$/g, '');
		process.env[key.trim()] = value;
	});
}
