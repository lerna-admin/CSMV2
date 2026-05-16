const EPE2_PREFIX = 'EPE2:';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
}

function bytesToBinary(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 1) output += String.fromCharCode(bytes[i]);
  return output;
}

function binaryToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i) & 255;
  return bytes;
}

function textToBinary(text: string): string {
  return bytesToBinary(textEncoder.encode(text));
}

function binaryToText(binary: string): string {
  return textDecoder.decode(binaryToBytes(binary));
}

function xorBinary(binary: string, key: string): string {
  if (!key) return binary;
  const out: number[] = [];
  for (let i = 0; i < binary.length; i += 1) {
    out.push((binary.charCodeAt(i) & 255) ^ key.charCodeAt(i % key.length));
  }
  return String.fromCharCode(...out);
}

export function encryptEpe2(plainText: string, fileNameKey: string): string {
  const key = hash(fileNameKey);
  const cipher = btoa(xorBinary(textToBinary(plainText), key));
  const sig = hash(`${fileNameKey}:${cipher}`);
  const payload = btoa(JSON.stringify({ v: 2, p: cipher, s: sig }));
  return `${EPE2_PREFIX}${payload}`;
}

export function decryptEpe2(encrypted: string, fileNameKey: string): string {
  if (!encrypted.startsWith(EPE2_PREFIX)) throw new Error('Only EPE2 content is supported');
  const payload = JSON.parse(atob(encrypted.slice(EPE2_PREFIX.length)));
  const expected = hash(`${fileNameKey}:${payload.p}`);
  if (payload.s !== expected) throw new Error('EPE2 integrity validation failed');
  return binaryToText(xorBinary(atob(payload.p), hash(fileNameKey)));
}
