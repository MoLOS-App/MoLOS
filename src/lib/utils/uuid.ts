function randomBytesFallback(length: number): Uint8Array {
	const bytes = new Uint8Array(length);
	for (let i = 0; i < length; i += 1) {
		bytes[i] = Math.floor(Math.random() * 256);
	}
	return bytes;
}

function getRandomBytes(length: number): Uint8Array {
	const cryptoObj = globalThis.crypto;
	if (cryptoObj?.getRandomValues) {
		const bytes = new Uint8Array(length);
		cryptoObj.getRandomValues(bytes);
		return bytes;
	}
	return randomBytesFallback(length);
}

export function uuid(): string {
	const cryptoObj = globalThis.crypto;
	if (cryptoObj?.randomUUID) {
		return cryptoObj.randomUUID();
	}

	const bytes = getRandomBytes(16);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
	return (
		hex.slice(0, 4).join('') +
		'-' +
		hex.slice(4, 6).join('') +
		'-' +
		hex.slice(6, 8).join('') +
		'-' +
		hex.slice(8, 10).join('') +
		'-' +
		hex.slice(10, 16).join('')
	);
}
