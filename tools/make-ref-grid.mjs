// make-ref-grid.mjs — compose a hero's 4 base sprites into a labeled 2×2 reference grid.
//
// Output: a 512×512 PNG with magenta background, the hero upscaled (nearest-neighbor)
// into each quadrant, grid lines, and direction labels. Give this to ChatGPT so it can
// draw equipment overlays on the same grid with a shared anchor.
//
// Usage: node tools/make-ref-grid.mjs --profile adventurer
//        node tools/make-ref-grid.mjs --profile mage
//
// Output lands in art-incoming/ref-<profile>.png

import fs from 'node:fs';
import zlib from 'node:zlib';

// ---- PNG decode/encode (same as process-sprite.mjs) ----

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
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG: ' + file);
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
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflated), chunk('IEND', Buffer.alloc(0))]);
}

// ---- Grid composition ----

const CELL = 256;        // each quadrant is 256×256
const GRID = CELL * 2;   // total output: 512×512
const SCALE = 6;         // 32×6 = 192px character in each cell
const CHAR_SIZE = 32 * SCALE;

// Direction layout: [quadrant index] = { dir, label, col, row }
const LAYOUT = [
  { dir: 'down',  label: '↓ DOWN',  col: 0, row: 0 },
  { dir: 'left',  label: '← LEFT',  col: 1, row: 0 },
  { dir: 'up',    label: '↑ UP',    col: 0, row: 1 },
  { dir: 'right', label: '→ RIGHT', col: 1, row: 1 }
];

function upscaleNN(src, sw, sh, scale) {
  const dw = sw * scale, dh = sh * scale;
  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const sy = Math.floor(y / scale);
    for (let x = 0; x < dw; x++) {
      const sx = Math.floor(x / scale);
      const si = (sy * sw + sx) * 4, di = (y * dw + x) * 4;
      out[di] = src[si]; out[di + 1] = src[si + 1]; out[di + 2] = src[si + 2]; out[di + 3] = src[si + 3];
    }
  }
  return { w: dw, h: dh, rgba: out };
}

// Simple bitmap font for labels (5×7 glyphs for A-Z, 0-9, arrows, space)
const GLYPHS = {
  'D': [0x70,0x88,0x88,0x88,0x88,0x88,0x70],
  'O': [0x70,0x88,0x88,0x88,0x88,0x88,0x70],
  'W': [0x88,0x88,0x88,0xa8,0xa8,0xd8,0x88],
  'N': [0x88,0xc8,0xa8,0x98,0x88,0x88,0x88],
  'L': [0x80,0x80,0x80,0x80,0x80,0x80,0xf8],
  'E': [0xf8,0x80,0x80,0xf0,0x80,0x80,0xf8],
  'F': [0xf8,0x80,0x80,0xf0,0x80,0x80,0x80],
  'T': [0xf8,0x20,0x20,0x20,0x20,0x20,0x20],
  'U': [0x88,0x88,0x88,0x88,0x88,0x88,0x70],
  'P': [0xf0,0x88,0x88,0xf0,0x80,0x80,0x80],
  'R': [0xf0,0x88,0x88,0xf0,0xa0,0x90,0x88],
  'I': [0x70,0x20,0x20,0x20,0x20,0x20,0x70],
  'G': [0x70,0x88,0x80,0xb8,0x88,0x88,0x70],
  'H': [0x88,0x88,0x88,0xf8,0x88,0x88,0x88],
  ' ': [0x00,0x00,0x00,0x00,0x00,0x00,0x00],
  '↓': [0x20,0x20,0x20,0x20,0xa8,0x70,0x20],
  '←': [0x00,0x20,0x40,0xf8,0x40,0x20,0x00],
  '↑': [0x20,0x70,0xa8,0x20,0x20,0x20,0x20],
  '→': [0x00,0x20,0x10,0xf8,0x10,0x20,0x00]
};

function drawText(canvas, cw, text, tx, ty, color, scale) {
  const s = scale || 2;
  for (let ci = 0; ci < text.length; ci++) {
    const g = GLYPHS[text[ci]];
    if (!g) continue;
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        if (g[gy] & (0x80 >> gx)) {
          for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) {
            const px = tx + ci * 6 * s + gx * s + sx;
            const py = ty + gy * s + sy;
            if (px >= 0 && px < cw && py >= 0 && py < cw) {
              const di = (py * cw + px) * 4;
              canvas[di] = color[0]; canvas[di + 1] = color[1]; canvas[di + 2] = color[2]; canvas[di + 3] = 255;
            }
          }
        }
      }
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  let profile = 'adventurer';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' && args[i + 1]) profile = args[++i];
  }

  const canvas = new Uint8Array(GRID * GRID * 4);

  // Fill with magenta
  for (let i = 0; i < GRID * GRID; i++) {
    canvas[i * 4] = 255; canvas[i * 4 + 1] = 0; canvas[i * 4 + 2] = 255; canvas[i * 4 + 3] = 255;
  }

  // Draw each direction
  for (const slot of LAYOUT) {
    const file = `assets/${profile}-${slot.dir}.png`;
    if (!fs.existsSync(file)) { console.error('missing: ' + file); continue; }
    const src = decodePNG(file);
    const big = upscaleNN(src.rgba, src.w, src.h, SCALE);

    // Center the upscaled character in the cell, anchored to bottom
    const ox = slot.col * CELL + Math.floor((CELL - big.w) / 2);
    const oy = slot.row * CELL + CELL - big.h - 8; // 8px padding from bottom

    for (let y = 0; y < big.h; y++) {
      for (let x = 0; x < big.w; x++) {
        const si = (y * big.w + x) * 4;
        if (big.rgba[si + 3] < 32) continue; // skip transparent
        const dx = ox + x, dy = oy + y;
        if (dx < 0 || dy < 0 || dx >= GRID || dy >= GRID) continue;
        const di = (dy * GRID + dx) * 4;
        canvas[di] = big.rgba[si]; canvas[di + 1] = big.rgba[si + 1];
        canvas[di + 2] = big.rgba[si + 2]; canvas[di + 3] = 255;
      }
    }

    // Label
    drawText(canvas, GRID, slot.label, slot.col * CELL + 10, slot.row * CELL + 10, [255, 255, 255], 3);
  }

  // Grid lines (dark gray, 2px)
  for (let t = 0; t < 2; t++) {
    // Horizontal center line
    for (let x = 0; x < GRID; x++) {
      const y = CELL + t;
      const di = (y * GRID + x) * 4;
      canvas[di] = 80; canvas[di + 1] = 80; canvas[di + 2] = 80; canvas[di + 3] = 255;
    }
    // Vertical center line
    for (let y = 0; y < GRID; y++) {
      const x = CELL + t;
      const di = (y * GRID + x) * 4;
      canvas[di] = 80; canvas[di + 1] = 80; canvas[di + 2] = 80; canvas[di + 3] = 255;
    }
  }

  const outPath = `art-incoming/ref-${profile}.png`;
  fs.writeFileSync(outPath, encodePNG(GRID, GRID, canvas));
  console.log(`wrote ${outPath} (${GRID}×${GRID})`);
}

main();
