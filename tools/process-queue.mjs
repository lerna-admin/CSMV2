import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const queueDir = path.join(root, 'data', 'queue');

function hash(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
}

function xor(text, key) {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    out += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

function decryptEpe2(value, fileKey) {
  if (!value.startsWith('EPE2:')) throw new Error('Only EPE2 payloads are accepted');
  const payload = JSON.parse(Buffer.from(value.slice(5), 'base64').toString('utf8'));
  const expected = hash(`${fileKey}:${payload.p}`);
  if (expected !== payload.s) throw new Error('Invalid EPE2 signature');
  const key = hash(fileKey);
  return xor(Buffer.from(payload.p, 'base64').toString('utf8'), key);
}

async function upsertJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function main() {
  const files = await fs.readdir(queueDir).catch(() => []);
  for (const f of files.filter((n) => n.endsWith('.json'))) {
    const full = path.join(queueDir, f);
    const item = JSON.parse(await fs.readFile(full, 'utf8'));
    const plain = decryptEpe2(item.payload, `${item.command}.json`);
    const payload = JSON.parse(plain);

    if (item.command === 'register-user') {
      await upsertJson(path.join(root, 'data', 'users', `${payload.email}.json`), payload);
    }
    if (item.command === 'publish-site') {
      await upsertJson(path.join(root, 'data', 'sites', `${payload.project.slug}.json`), payload.project);
    }
    if (item.command === 'save-template') {
      await upsertJson(path.join(root, 'data', 'templates', `${payload.template.id}.json`), payload.template);
    }

    await fs.unlink(full);
  }
}

main();
