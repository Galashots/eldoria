// slice-anim-grid.mjs — take a 4×4 animation grid from ChatGPT and produce
// 4 direction-specific 128×32 animation strips (walk or attack).
//
// Grid layout (must match make-anim-grid.mjs):
//   4 columns (frames 0-3) × 4 rows (down, left, up, right)
//
// Usage:
//   node tools/slice-anim-grid.mjs --in art-incoming/cape-walk-grid.png --profile adventurer --slot cape --anim walk
//
// Output: assets/<profile>-<dir>-<slot>-<anim>.png (128×32 strips)

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

function knockout(rgba, w, h, tol) {
  const t2 = tol * tol * 3;
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const dr = r - 255, dg = g, db = b - 255;
    if (dr * dr + dg * dg + db * db <= t2) rgba[i * 4 + 3] = 0;
  }
}

function bbox(rgba, w, h, aMin) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rgba[(y * w + x) * 4 + 3] > aMin) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, bw: maxX - minX + 1, bh: maxY - minY + 1 };
}

function centroidX(rgba, w, h, aMin) {
  let sx = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rgba[(y * w + x) * 4 + 3] > aMin) { sx += x; n++; }
  }
  return n ? sx / n : w / 2;
}

const DIRS = ['down', 'left', 'up', 'right'];

function main() {
  const args = process.argv.slice(2);
  const a = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) a[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
  }
  if (!a.in || !a.profile || !a.slot || !a.anim) {
    console.error('usage: node tools/slice-anim-grid.mjs --in <grid.png> --profile <adventurer|mage> --slot <cape|body|head|weapon> --anim <walk|attack> [--fit 22]');
    process.exit(1);
  }

  const fit = a.fit ? parseInt(a.fit, 10) : 22;
  const img = decodePNG(a.in);
  const cellW = Math.floor(img.w / 4), cellH = Math.floor(img.h / 4);

  for (let row = 0; row < 4; row++) {
    const dir = DIRS[row];
    const strip = new Uint8Array(128 * 32 * 4); // output: 128×32 (4 frames of 32×32)

    for (let col = 0; col < 4; col++) {
      // Extract this cell from the grid
      const cx = col * cellW, cy = row * cellH;
      const cell = new Uint8Array(cellW * cellH * 4);
      for (let y = 0; y < cellH; y++) for (let x = 0; x < cellW; x++) {
        const si = ((cy + y) * img.w + (cx + x)) * 4, di = (y * cellW + x) * 4;
        cell[di] = img.rgba[si]; cell[di + 1] = img.rgba[si + 1];
        cell[di + 2] = img.rgba[si + 2]; cell[di + 3] = img.rgba[si + 3];
      }

      // Knockout magenta
      knockout(cell, cellW, cellH, 60);
      const box = bbox(cell, cellW, cellH, 16);
      if (!box) continue;

      // Scale to fit in 32×32
      const scale = Math.min(fit / Math.max(box.bw, box.bh), 1);
      let dw = Math.max(1, Math.round(box.bw * scale));
      let dh = Math.max(1, Math.round(box.bh * scale));
      if (dw > 32) dw = 32;
      if (dh > 32) dh = 32;

      // Downscale
      const small = new Uint8Array(dw * dh * 4);
      const sxStep = box.bw / dw, syStep = box.bh / dh;
      for (let dy = 0; dy < dh; dy++) for (let dx = 0; dx < dw; dx++) {
        const x0 = box.minX + Math.floor(dx * sxStep);
        const x1 = box.minX + Math.max(Math.floor((dx + 1) * sxStep), Math.floor(dx * sxStep) + 1);
        const y0 = box.minY + Math.floor(dy * syStep);
        const y1 = box.minY + Math.max(Math.floor((dy + 1) * syStep), Math.floor(dy * syStep) + 1);
        let r = 0, g = 0, b = 0, al = 0, n = 0;
        for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
          const i = (sy * cellW + sx) * 4, aa = cell[i + 3];
          r += cell[i] * aa; g += cell[i + 1] * aa; b += cell[i + 2] * aa; al += aa; n++;
        }
        const di = (dy * dw + dx) * 4;
        if (al > 0) { small[di] = r / al; small[di + 1] = g / al; small[di + 2] = b / al; small[di + 3] = al / n; }
      }

      // Align horizontally to the base walk/attack strip frame
      const baseStripFile = `assets/${a.profile}-${dir}-${a.anim}.png`;
      let ox;
      if (fs.existsSync(baseStripFile)) {
        const baseStrip = decodePNG(baseStripFile);
        // Extract the matching frame from the base strip to get its centroid
        const framePx = new Uint8Array(32 * 32 * 4);
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
          const si = (y * baseStrip.w + col * 32 + x) * 4, di = (y * 32 + x) * 4;
          framePx[di] = baseStrip.rgba[si]; framePx[di + 1] = baseStrip.rgba[si + 1];
          framePx[di + 2] = baseStrip.rgba[si + 2]; framePx[di + 3] = baseStrip.rgba[si + 3];
        }
        const cx2 = centroidX(framePx, 32, 32, 16);
        ox = Math.round(cx2 - dw / 2);
      } else {
        ox = Math.round((32 - dw) / 2);
      }
      const oy = Math.round((32 - dh) / 2);
      const oxC = Math.max(0, Math.min(32 - dw, ox));
      const oyC = Math.max(0, Math.min(32 - dh, oy));

      // Compose into the strip at column position
      for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
        const sx2 = col * 32 + oxC + x, sy2 = oyC + y;
        if (sx2 >= 128 || sy2 >= 32) continue;
        const si = (y * dw + x) * 4, di = (sy2 * 128 + sx2) * 4;
        strip[di] = small[si]; strip[di + 1] = small[si + 1];
        strip[di + 2] = small[si + 2]; strip[di + 3] = small[si + 3];
      }
    }

    const outFile = `assets/${a.profile}-${dir}-${a.slot}-${a.anim}.png`;
    fs.writeFileSync(outFile, encodePNG(128, 32, strip));
    console.log(`wrote ${outFile}`);
  }
}

main();
