import { execSync } from 'child_process';

export function runCommand(command: string) {
	execSync(command, { stdio: 'inherit' });
}
