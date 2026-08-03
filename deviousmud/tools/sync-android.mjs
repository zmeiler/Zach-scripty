/**
 * Prepares the Android project: builds the single-file game into the app's
 * assets and regenerates the launcher icons at every density.
 *
 *   node tools/sync-android.mjs      (or: npm run android:sync)
 *
 * Run this before `./gradlew assembleDebug` whenever the game changes.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { drawIcon } from './icon.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res');
const assetsDir = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'game');

// Android launcher icon sizes, one per density bucket.
const MIPMAPS = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 }
];

async function main() {
  const { stdout } = await run(process.execPath, [path.join(here, 'bundle.mjs')], { cwd: root });
  process.stdout.write(stdout);

  await fs.mkdir(assetsDir, { recursive: true });
  await fs.copyFile(path.join(root, 'dist', 'deviousmud.html'), path.join(assetsDir, 'index.html'));
  console.log('android/app/src/main/assets/game/index.html');

  for (const target of MIPMAPS) {
    const dir = path.join(androidRes, target.dir);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'ic_launcher.png'), drawIcon(target.size));
    // Round icons use the maskable artwork, which is inset for circular crops.
    await fs.writeFile(path.join(dir, 'ic_launcher_round.png'), drawIcon(target.size, { maskable: true }));
    console.log(`${target.dir}/ic_launcher.png  ${target.size}x${target.size}`);
  }

  console.log('\nAssets ready. Build the APK with:\n  cd android && ./gradlew assembleDebug');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
