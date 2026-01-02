import { existsSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

async function main() {
	const modulePath = process.cwd();
	const manifestPath = path.join(modulePath, 'manifest.yaml');

	if (!existsSync(manifestPath)) {
		console.error('❌ Error: manifest.yaml not found. Run this script from the module root.');
		process.exit(1);
	}

	console.log('🚀 Initializing standalone development environment...');

	// 1. Ensure drizzle folder exists
	const drizzleDir = path.join(modulePath, 'drizzle');
	if (!existsSync(drizzleDir)) {
		mkdirSync(drizzleDir);
		console.log('📁 Created drizzle directory.');
	}

	// 2. Create a basic .env if missing
	const envPath = path.join(modulePath, '.env');
	if (!existsSync(envPath)) {
		writeFileSync(envPath, 'DATABASE_URL=sqlite://./dev.db\nNODE_ENV=development\n');
		console.log('📄 Created basic .env file.');
	}

	console.log('\n✅ Standalone environment ready.');
	console.log('To run migrations locally, you can use: npx drizzle-kit push:sqlite');
}

main().catch(console.error);
