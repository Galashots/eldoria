// make-anim-grid.mjs — compose a hero's walk or attack animation into a 4×4 reference grid.
//
// Layout: 4 columns (frames 0-3) × 4 rows (down, left, up, right)
// Each cell is 128×128 px → total 512×512
//
// Usage: node tools/make-anim-grid.mjs --profile adventurer --anim walk
//        node tools/make-anim-grid.mjs --profile adventurer --anim attack

import fs from 'node:fs';
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function decodePNG(file) {
  const b = fs.readFileSync(file);
  let p = 8, idat = [], w = 0, h = 0, colorType = 6;
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = b.readUInt32BE(p + 8); h = b.readUInt32BE(p + 12); colorType = b.readUInt8(p + 17); }
    else if (type === 'IDAT') idat.push(b.slice(p + 8, p + 8 + len));
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 4;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const cur = Buffer.alloc(stride), prev = Buffer.alloc(stride);
  const rgba = new Uint8Array(w * h * 4);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const v = raw[rp++];
      const a = x >= channels ? cur[x - channels] : 0;
      const bb = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let out;
      if (ft === 0) out = v;
      else if (ft === 1) out = v + a;
      else if (ft === 2) out = v + bb;
      else if (ft === 3) out = v + ((a + bb) >> 1);
      else { const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c); out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c); }
      cur[x] = out & 255;
    }
    for (let x = 0; x < w; x++) {
      const si = x * channels, di = (y * w + x) * 4;
      rgba[di] = cur[si]; rgba[di + 1] = cur[si + 1]; rgba[di + 2] = cur[si + 2];
      rgba[di + 3] = channels === 4 ? cur[si + 3] : 255;
    }
    cur.copy(prev);
  }
  return { w, h, rgba };
}

function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < stride; x++) raw[y * (stride + 1) + 1 + x] = rgba[y * stride + x];
  }
  const deflated = zlib.deflateSync(raw, { level: 9 });
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const cc = Buffer.alloc(4); cc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, cc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflated), chunk('IEND', Buffer.alloc(0))]);
}

const CELL = 128;
const COLS = 4, ROWS = 4;
const GRID_W = CELL * COLS, GRID_H = CELL * ROWS;
const SCALE = 3; // 32×3 = 96px per frame
const DIRS = ['down', 'left', 'up', 'right'];

function main() {
  const args = process.argv.slice(2);
  let profile = 'adventurer', anim = 'walk';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' && args[i + 1]) profile = args[++i];
    if (args[i] === '--anim' && args[i + 1]) anim = args[++i];
  }

  const canvas = new Uint8Array(GRID_W * GRID_H * 4);
  // Fill magenta
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    canvas[i * 4] = 255; canvas[i * 4 + 1] = 0; canvas[i * 4 + 2] = 255; canvas[i * 4 + 3] = 255;
  }

  for (let row = 0; row < DIRS.length; row++) {
    const dir = DIRS[row];
    const stripFile = `assets/${profile}-${dir}-${anim}.png`;
    if (!fs.existsSync(stripFile)) {
      console.error('missing: ' + stripFile + ' — skipping');
      continue;
    }
    const strip = decodePNG(stripFile);
    const frameW = 32, frameH = strip.h; // each frame is 32×32 in a 128×32 strip

    for (let col = 0; col < 4; col++) {
      // Extract frame from strip
      for (let y = 0; y < frameH; y++) {
        for (let x = 0; x < frameW; x++) {
          const si = (y * strip.w + col * frameW + x) * 4;
          if (strip.rgba[si + 3] < 32) continue;
          // Upscale and place in cell
          for (let sy = 0; sy < SCALE; sy++) {
            for (let sx = 0; sx < SCALE; sx++) {
              const dx = col * CELL + Math.floor((CELL - frameW * SCALE) / 2) + x * SCALE + sx;
              const dy = row * CELL + CELL - frameH * SCALE - 4 + y * SCALE + sy;
              if (dx >= 0 && dx < GRID_W && dy >= 0 && dy < GRID_H) {
                const di = (dy * GRID_W + dx) * 4;
                canvas[di] = strip.rgba[si]; canvas[di + 1] = strip.rgba[si + 1];
                canvas[di + 2] = strip.rgba[si + 2]; canvas[di + 3] = 255;
              }
            }
          }
        }
      }
    }
  }

  // Grid lines
  for (let t = 0; t < 2; t++) {
    for (let r = 1; r < ROWS; r++) {
      for (let x = 0; x < GRID_W; x++) {
        const di = ((r * CELL + t) * GRID_W + x) * 4;
        canvas[di] = 80; canvas[di + 1] = 80; canvas[di + 2] = 80; canvas[di + 3] = 255;
      }
    }
    for (let c = 1; c < COLS; c++) {
      for (let y = 0; y < GRID_H; y++) {
        const di = (y * GRID_W + c * CELL + t) * 4;
        canvas[di] = 80; canvas[di + 1] = 80; canvas[di + 2] = 80; canvas[di + 3] = 255;
      }
    }
  }

  const outPath = `art-incoming/ref-${profile}-${anim}.png`;
  fs.writeFileSync(outPath, encodePNG(GRID_W, GRID_H, canvas));
  console.log(`wrote ${outPath} (${GRID_W}×${GRID_H})`);
}

main();
