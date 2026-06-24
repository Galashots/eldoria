// slice-grid.mjs — take a 2×2 grid of equipment sprites from ChatGPT and produce
// 4 individual 32×32 direction PNGs aligned to the hero's base body.
//
// Usage:
//   node tools/slice-grid.mjs --in art-incoming/cape-grid.png --profile adventurer --slot cape
//   node tools/slice-grid.mjs --in art-incoming/cape-grid.png --profile adventurer --slot cape --mirror
//
// Grid layout (must match make-ref-grid.mjs):
//   ┌──────┬──────┐
//   │ DOWN │ LEFT │
//   ├──────┼──────┤
//   │ UP   │RIGHT │
//   └──────┴──────┘
//
// --mirror: only use the LEFT quadrant, flip it horizontally for RIGHT (saves a prompt)
// --mask-down: auto-mask the DOWN sprite to only show edges outside the body silhouette
//              (for capes that render behind the hero)
//
// Output: assets/<profile>-down-<slot>.png, assets/<profile>-left-<slot>.png, etc.

import fs from 'node:fs';
import zlib from 'node:zlib';

// ---- PNG decode/encode ----

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

// ---- Processing functions ----

function knockout(rgba, w, h, tol) {
  const kr = 255, kg = 0, kb = 255; // magenta
  const t2 = tol * tol * 3;
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const dr = r - kr, dg = g - kg, db = b - kb;
    if (dr * dr + dg * dg + db * db <= t2) rgba[i * 4 + 3] = 0;
  }
}

function extractQuadrant(rgba, w, h, col, row) {
  const qw = Math.floor(w / 2), qh = Math.floor(h / 2);
  const out = new Uint8Array(qw * qh * 4);
  const ox = col * qw, oy = row * qh;
  for (let y = 0; y < qh; y++) for (let x = 0; x < qw; x++) {
    const si = ((oy + y) * w + (ox + x)) * 4, di = (y * qw + x) * 4;
    out[di] = rgba[si]; out[di + 1] = rgba[si + 1]; out[di + 2] = rgba[si + 2]; out[di + 3] = rgba[si + 3];
  }
  return { w: qw, h: qh, rgba: out };
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

function downscaleRegion(rgba, w, box, dstW, dstH) {
  const out = new Uint8Array(dstW * dstH * 4);
  const sxStep = box.bw / dstW, syStep = box.bh / dstH;
  for (let dy = 0; dy < dstH; dy++) for (let dx = 0; dx < dstW; dx++) {
    const x0 = box.minX + Math.floor(dx * sxStep);
    const x1 = box.minX + Math.max(Math.floor((dx + 1) * sxStep), Math.floor(dx * sxStep) + 1);
    const y0 = box.minY + Math.floor(dy * syStep);
    const y1 = box.minY + Math.max(Math.floor((dy + 1) * syStep), Math.floor(dy * syStep) + 1);
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
      const i = (sy * w + sx) * 4, al = rgba[i + 3];
      r += rgba[i] * al; g += rgba[i + 1] * al; b += rgba[i + 2] * al; a += al; n++;
    }
    const di = (dy * dstW + dx) * 4;
    if (a > 0) { out[di] = r / a; out[di + 1] = g / a; out[di + 2] = b / a; out[di + 3] = a / n; }
  }
  return out;
}

function flipH(rgba, w, h) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = (y * w + x) * 4, di = (y * w + (w - 1 - x)) * 4;
    out[di] = rgba[si]; out[di + 1] = rgba[si + 1]; out[di + 2] = rgba[si + 2]; out[di + 3] = rgba[si + 3];
  }
  return out;
}

function processQuadrant(quad, baseFile, fit, isDown, isCape) {
  const SIZE = 32;
  knockout(quad.rgba, quad.w, quad.h, 60);
  const box = bbox(quad.rgba, quad.w, quad.h, 16);
  if (!box) return null;

  const scale = fit / Math.max(box.bw, box.bh);
  let dw = Math.max(1, Math.round(box.bw * scale));
  let dh = Math.max(1, Math.round(box.bh * scale));
  if (dw > SIZE) dw = SIZE;
  if (dh > SIZE) dh = SIZE;

  const small = downscaleRegion(quad.rgba, quad.w, box, dw, dh);

  // Horizontal alignment to base body
  let ox;
  if (fs.existsSync(baseFile)) {
    const base = decodePNG(baseFile);
    const cx = centroidX(base.rgba, base.w, base.h, 16);
    ox = Math.round(cx - dw / 2);
  } else {
    ox = Math.round((SIZE - dw) / 2);
  }
  const oy = Math.round((SIZE - dh) / 2);
  const oxC = Math.max(0, Math.min(SIZE - dw, ox));
  const oyC = Math.max(0, Math.min(SIZE - dh, oy));

  // Compose onto 32×32
  const out = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const dx = oxC + x, dy = oyC + y;
    if (dx < 0 || dy < 0 || dx >= SIZE || dy >= SIZE) continue;
    const si = (y * dw + x) * 4, di = (dy * SIZE + dx) * 4;
    out[di] = small[si]; out[di + 1] = small[si + 1]; out[di + 2] = small[si + 2]; out[di + 3] = small[si + 3];
  }

  // For down-facing capes: mask pixels that overlap the body silhouette
  if (isDown && isCape && fs.existsSync(baseFile)) {
    const body = decodePNG(baseFile);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const ci = (y * SIZE + x) * 4;
      if (out[ci + 3] < 16) continue;
      if (body.rgba[(y * SIZE + x) * 4 + 3] > 80 && y > 6) {
        let edgeOfBody = false;
        for (let dy2 = -1; dy2 <= 1; dy2++) for (let dx2 = -1; dx2 <= 1; dx2++) {
          const nx = x + dx2, ny = y + dy2;
          if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) {
            if (body.rgba[(ny * SIZE + nx) * 4 + 3] < 50) edgeOfBody = true;
          }
        }
        if (!edgeOfBody) out[ci + 3] = 0;
      }
    }
  }

  return out;
}

// ---- Main ----

function main() {
  const args = process.argv.slice(2);
  const a = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) a[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
  }
  if (!a.in || !a.profile || !a.slot) {
    console.error('usage: node tools/slice-grid.mjs --in <grid.png> --profile <adventurer|mage> --slot <cape|body|head|weapon> [--mirror] [--fit 22]');
    process.exit(1);
  }

  const fit = a.fit ? parseInt(a.fit, 10) : 22;
  const isCape = a.slot === 'cape';
  const mirror = !!a.mirror;

  const img = decodePNG(a.in);

  // Grid layout: down=TL, left=TR, up=BL, right=BR
  const DIRS = [
    { dir: 'down',  col: 0, row: 0 },
    { dir: 'left',  col: 1, row: 0 },
    { dir: 'up',    col: 0, row: 1 },
    { dir: 'right', col: 1, row: 1 }
  ];

  for (const d of DIRS) {
    const baseFile = `assets/${a.profile}-${d.dir}.png`;
    let quad;

    if (mirror && d.dir === 'right') {
      // Use left quadrant, flip it
      quad = extractQuadrant(img.rgba, img.w, img.h, 1, 0); // left is col1 row0
      knockout(quad.rgba, quad.w, quad.h, 60);
      // Process left, then flip the result
      const leftResult = processQuadrant(
        extractQuadrant(img.rgba, img.w, img.h, 1, 0),
        `assets/${a.profile}-left.png`, fit, false, isCape
      );
      if (leftResult) {
        const flipped = flipH(leftResult, 32, 32);
        const outFile = `assets/${a.profile}-right-${a.slot}.png`;
        fs.writeFileSync(outFile, encodePNG(32, 32, flipped));
        console.log(`wrote ${outFile} (flipped from left)`);
      }
      continue;
    }

    quad = extractQuadrant(img.rgba, img.w, img.h, d.col, d.row);
    const isDown = d.dir === 'down';
    const result = processQuadrant(quad, baseFile, fit, isDown, isCape);
    if (result) {
      const outFile = `assets/${a.profile}-${d.dir}-${a.slot}.png`;
      fs.writeFileSync(outFile, encodePNG(32, 32, result));
      console.log(`wrote ${outFile}`);
    } else {
      console.error(`no content found in ${d.dir} quadrant`);
    }
  }
}

main();
