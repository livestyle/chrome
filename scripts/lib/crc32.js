/**
 * Fast CRC32 algorithm for strings.
 * Original source: https://github.com/SheetJS/js-crc32
 * © 2014 SheetJS — http://sheetjs.com
 */
'use strict';

var table = new Array(256);
for (var n = 0, c; n != 256; ++n) {
	c = n;
	c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
	c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
	c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
	c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
	c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
	c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
	c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
	c = ((c&1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
	table[n] = c;
}

if (typeof Int32Array !== 'undefined') {
	table = new Int32Array(table);
}

export default function(str) {
	for (var crc = -1, i = 0, L=str.length, c, d; i < L;) {
		c = str.charCodeAt(i++);
		if (c < 0x80) {
			crc = (crc >>> 8) ^ table[(crc ^ c) & 0xFF];
		} else if (c < 0x800) {
			crc = (crc >>> 8) ^ table[(crc ^ (192|((c>>6)&31))) & 0xFF];
			crc = (crc >>> 8) ^ table[(crc ^ (128|(c&63))) & 0xFF];
		} else if (c >= 0xD800 && c < 0xE000) {
			c = (c&1023)+64; d = str.charCodeAt(i++) & 1023;
			crc = (crc >>> 8) ^ table[(crc ^ (240|((c>>8)&7))) & 0xFF];
			crc = (crc >>> 8) ^ table[(crc ^ (128|((c>>2)&63))) & 0xFF];
			crc = (crc >>> 8) ^ table[(crc ^ (128|((d>>6)&15)|(c&3))) & 0xFF];
			crc = (crc >>> 8) ^ table[(crc ^ (128|(d&63))) & 0xFF];
		} else {
			crc = (crc >>> 8) ^ table[(crc ^ (224|((c>>12)&15))) & 0xFF];
			crc = (crc >>> 8) ^ table[(crc ^ (128|((c>>6)&63))) & 0xFF];
			crc = (crc >>> 8) ^ table[(crc ^ (128|(c&63))) & 0xFF];
		}
	}
	return crc ^ -1;
};