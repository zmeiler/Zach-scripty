/**
 * Icon rasteriser shared by the web manifest icons and the Android launcher
 * icons. Node has no canvas, so the pixels are drawn by hand and encoded as a
 * PNG with zlib - no image dependency, and no binary assets in source control.
 */

import zlib from 'node:zlib';

const BACKGROUND = [27, 36, 48, 255];   // --bg-raised
const FIELD = [47, 109, 79, 255];       // Emberfall green
const GOLD = [242, 193, 78, 255];       // --accent
const DARK = [12, 17, 22, 255];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

export function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/**
 * Draws the icon: a rounded field with a golden pine tree, the same shapes the
 * game itself draws. `safe` insets the artwork for maskable icons, whose outer
 * 10% can be cropped to any shape by the launcher.
 */
export function drawIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const inset = maskable ? size * 0.14 : 0;
  const radius = maskable ? size / 2 : size * 0.22;
  const cx = size / 2;
  const cy = size / 2;

  const put = (x, y, colour) => {
    const i = (y * size + x) * 4;
    rgba[i] = colour[0];
    rgba[i + 1] = colour[1];
    rgba[i + 2] = colour[2];
    rgba[i + 3] = colour[3];
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Rounded square (or full bleed for maskable icons).
      const rx = Math.max(Math.abs(x - cx) - (size / 2 - radius), 0);
      const ry = Math.max(Math.abs(y - cy) - (size / 2 - radius), 0);
      const outside = !maskable && Math.hypot(rx, ry) > radius;
      if (outside) {
        put(x, y, [0, 0, 0, 0]);
        continue;
      }
      put(x, y, maskable ? BACKGROUND : BACKGROUND);

      // Grass field in the lower two-thirds.
      if (y > size * 0.62) put(x, y, FIELD);
    }
  }

  // A simple three-tier pine in gold.
  const treeTop = inset + size * 0.16;
  const treeBottom = size * 0.74;
  const halfWidth = (size * 0.3);
  for (let y = Math.floor(treeTop); y < treeBottom; y += 1) {
    const t = (y - treeTop) / (treeBottom - treeTop);
    const tier = Math.min(2, Math.floor(t * 3));
    const local = (t * 3) - tier;
    const spread = halfWidth * (0.35 + 0.65 * (tier / 2)) * (0.35 + 0.65 * local);
    for (let x = Math.floor(cx - spread); x <= Math.ceil(cx + spread); x += 1) {
      if (x < 0 || x >= size) continue;
      put(x, y, GOLD);
    }
  }
  // Trunk.
  const trunkHalf = size * 0.045;
  for (let y = Math.floor(treeBottom - size * 0.02); y < size * 0.84; y += 1) {
    for (let x = Math.floor(cx - trunkHalf); x <= Math.ceil(cx + trunkHalf); x += 1) {
      if (x < 0 || x >= size || y < 0 || y >= size) continue;
      put(x, y, DARK);
    }
  }

  return encodePng(size, size, rgba);
}

