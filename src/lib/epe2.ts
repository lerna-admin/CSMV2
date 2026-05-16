const EPE2_PREFIX = 'EPE2:';

function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
}

function xor(text: string, key: string): string {
  if (!key) return text;
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    out.push(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return String.fromCharCode(...out);
}

export function encryptEpe2(plainText: string, fileNameKey: string): string {
  const key = hash(fileNameKey);
  const cipher = btoa(xor(plainText, key));
  const sig = hash(`${fileNameKey}:${cipher}`);
  const payload = btoa(JSON.stringify({ v: 2, p: cipher, s: sig }));
  return `${EPE2_PREFIX}${payload}`;
}

export function decryptEpe2(encrypted: string, fileNameKey: string): string {
  if (!encrypted.startsWith(EPE2_PREFIX)) throw new Error('Only EPE2 content is supported');
  const payload = JSON.parse(atob(encrypted.slice(EPE2_PREFIX.length)));
  const expected = hash(`${fileNameKey}:${payload.p}`);
  if (payload.s !== expected) throw new Error('EPE2 integrity validation failed');
  return xor(atob(payload.p), hash(fileNameKey));
}
