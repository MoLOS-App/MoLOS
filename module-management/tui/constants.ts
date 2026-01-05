import path from 'path';

const envDir = process.env.MOLOS_EXTERNAL_MODULES_DIR;
export const EXTERNAL_MODULES_DIR = envDir
	? path.resolve(process.cwd(), envDir)
	: path.resolve(process.cwd(), 'external_modules');
export const SAMPLE_MODULE_ID = 'MoLOS-Tasks';
