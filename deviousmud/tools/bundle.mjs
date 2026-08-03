/**
 * Single-file build.
 *
 * Inlines the stylesheet and every ES module reachable from client/js/main.js
 * into one HTML document that runs from a file:// URL, from a phone's Downloads
 * folder, or inside an Android WebView. No bundler dependency: the modules use
 * a consistent subset of ESM (named imports and exports only), so a small
 * transform to a CommonJS-style registry is enough.
 *
 *   node tools/bundle.mjs            -> dist/deviousmud.html  (standalone)
 *   node tools/bundle.mjs --body     -> dist/deviousmud.body.html (no <html>)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const ENTRY = path.join(root, 'client', 'js', 'main.js');

const IMPORT_RE = /^\s*import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm;
const SIDE_EFFECT_IMPORT_RE = /^\s*import\s*['"]([^'"]+)['"];?\s*$/gm;

/** Collects a module and everything it imports, depth first. */
async function collect(file, seen = new Map()) {
  const key = path.relative(root, file);
  if (seen.has(key)) return seen;
  const source = await fs.readFile(file, 'utf8');
  seen.set(key, { file, source, deps: [] });

  const deps = [];
  for (const match of source.matchAll(IMPORT_RE)) deps.push(match[2]);
  for (const match of source.matchAll(SIDE_EFFECT_IMPORT_RE)) deps.push(match[1]);

  for (const spec of deps) {
    if (!spec.startsWith('.')) throw new Error(`${key}: only relative imports are supported (${spec})`);
    const resolved = path.resolve(path.dirname(file), spec);
    seen.get(key).deps.push(path.relative(root, resolved));
    await collect(resolved, seen);
  }
  return seen;
}

/**
 * Rewrites one module: imports become registry lookups, exports become
 * assignments onto the module's exports object. The module body keeps its own
 * scope, so identical helper names in different files cannot collide.
 */
function transform(key, source) {
  const dir = path.dirname(key);
  const exported = new Set();

  let out = source.replace(IMPORT_RE, (_match, names, spec) => {
    const target = path.normalize(path.join(dir, spec)).split(path.sep).join('/');
    return `const { ${names.trim()} } = __require(${JSON.stringify(target)});`;
  });

  out = out.replace(SIDE_EFFECT_IMPORT_RE, (_match, spec) => {
    const target = path.normalize(path.join(dir, spec)).split(path.sep).join('/');
    return `__require(${JSON.stringify(target)});`;
  });

  // `export { a, b };`
  out = out.replace(/^\s*export\s*\{([^}]*)\};?\s*$/gm, (_match, names) => {
    for (const name of names.split(',')) {
      const trimmed = name.trim();
      if (trimmed) exported.add(trimmed);
    }
    return '';
  });

  // `export const X`, `export function X`, `export class X`, `export async function X`
  out = out.replace(/^\s*export\s+(const|let|var|function\*?|class|async\s+function\*?)\s+([A-Za-z_$][\w$]*)/gm,
    (_match, kind, name) => {
      exported.add(name);
      return `${kind} ${name}`;
    });

  if (/^\s*export\s/m.test(out)) {
    throw new Error(`${key}: unsupported export syntax (default exports and re-exports are not handled)`);
  }

  const assignments = [...exported].map((name) => `  __exports.${name} = ${name};`).join('\n');
  return `__modules[${JSON.stringify(key.split(path.sep).join('/'))}] = function (__exports, __require) {\n${out}\n${assignments}\n};`;
}

function runtime(entryKey) {
  return `
const __modules = {};
const __cache = {};
function __require(key) {
  if (__cache[key]) return __cache[key].__exports;
  const factory = __modules[key];
  if (!factory) throw new Error('Missing module: ' + key);
  const record = { __exports: {} };
  __cache[key] = record;
  factory(record.__exports, __require);
  return record.__exports;
}
`.trimStart() + `\n__require(${JSON.stringify(entryKey)});\n`;
}

async function build() {
  const modules = await collect(ENTRY);
  const entryKey = path.relative(root, ENTRY).split(path.sep).join('/');

  const pieces = [];
  for (const [key, module] of modules) {
    pieces.push(transform(key, module.source));
  }

  const css = await fs.readFile(path.join(root, 'client', 'css', 'styles.css'), 'utf8');
  const html = await fs.readFile(path.join(root, 'client', 'index.html'), 'utf8');

  // Take the page markup from the real client so the two never drift apart.
  const body = html
    .slice(html.indexOf('<body'), html.indexOf('</body>'))
    .replace(/^<body[^>]*>/, '')
    .replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '')
    .trim();

  const script = [
    '(function () {',
    "'use strict';",
    'window.__DEVIOUSMUD_BUNDLED__ = true;',
    runtime(entryKey).split('\n').slice(0, -2).join('\n'),
    ...pieces,
    `__require(${JSON.stringify(entryKey)});`,
    '})();'
  ].join('\n\n');

  const bodyOnly = process.argv.includes('--body');
  const page = bodyOnly
    ? `<style>\n${css}\n</style>\n${body}\n<script>\n${script}\n</script>\n`
    : `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#1b2430" />
<meta name="description" content="DeviousMud - a family-friendly browser MMORPG. Explore Emberfall, train ten skills and finish quests." />
<title>DeviousMud - Emberfall</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%232f6d4f'/%3E%3Cpath d='M9 22l7-14 7 14z' fill='%23f2c14e'/%3E%3C/svg%3E" />
<style>
${css}
</style>
</head>
<body class="loading">
${body}
<script>
${script}
</script>
</body>
</html>
`;

  const outDir = path.join(root, 'dist');
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, bodyOnly ? 'deviousmud.body.html' : 'deviousmud.html');
  await fs.writeFile(outFile, page, 'utf8');

  const kb = (Buffer.byteLength(page, 'utf8') / 1024).toFixed(0);
  console.log(`${path.relative(root, outFile)}  (${modules.size} modules, ${kb} KB)`);
  return outFile;
}

build().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
