/**
 * Writes the web app manifest icons.
 *
 *   node tools/make-icons.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawIcon } from './icon.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const targets = [
  { file: 'client/icons/icon-192.png', size: 192 },
  { file: 'client/icons/icon-512.png', size: 512 },
  { file: 'client/icons/maskable-512.png', size: 512, maskable: true }
];

for (const target of targets) {
  const out = path.join(root, target.file);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, drawIcon(target.size, { maskable: target.maskable }));
  console.log(`${target.file}  ${target.size}x${target.size}`);
}
