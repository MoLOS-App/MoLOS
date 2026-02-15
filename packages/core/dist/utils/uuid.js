function randomBytesFallback(length) {
    var bytes = new Uint8Array(length);
    for (var i = 0; i < length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
}
function getRandomBytes(length) {
    var cryptoObj = globalThis.crypto;
    if (cryptoObj === null || cryptoObj === void 0 ? void 0 : cryptoObj.getRandomValues) {
        var bytes = new Uint8Array(length);
        cryptoObj.getRandomValues(bytes);
        return bytes;
    }
    return randomBytesFallback(length);
}
export function uuid() {
    var cryptoObj = globalThis.crypto;
    if (cryptoObj === null || cryptoObj === void 0 ? void 0 : cryptoObj.randomUUID) {
        return cryptoObj.randomUUID();
    }
    var bytes = getRandomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); });
    return (hex.slice(0, 4).join('') +
        '-' +
        hex.slice(4, 6).join('') +
        '-' +
        hex.slice(6, 8).join('') +
        '-' +
        hex.slice(8, 10).join('') +
        '-' +
        hex.slice(10, 16).join(''));
}
//# sourceMappingURL=uuid.js.map