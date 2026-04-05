const ANSI = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	dim: '\x1b[2m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	cyan: '\x1b[36m'
};

const useColor = process.stdout.isTTY;
const paint = (code: string, text: string) => (useColor ? `${code}${text}${ANSI.reset}` : text);

export const bold = (text: string) => paint(ANSI.bold, text);
export const dim = (text: string) => paint(ANSI.dim, text);
export const red = (text: string) => paint(ANSI.red, text);
export const green = (text: string) => paint(ANSI.green, text);
export const yellow = (text: string) => paint(ANSI.yellow, text);
export const cyan = (text: string) => paint(ANSI.cyan, text);
