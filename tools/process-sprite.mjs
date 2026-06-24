// process-sprite.mjs — turn a raw ChatGPT sprite export into a game-ready 32x32 PNG.
//
// What it does, in order:
//   1. Decode the raw PNG (handles RGB and RGBA, 8-bit).
//   2. Knock out the flat background -> transparency. Default keys on pure magenta
//      (#FF00FF) which we ask ChatGPT to paint behind the sprite (far easier to remove
//      cleanly than relying on ChatGPT's flaky "transparent background").
//   3. Trim to the sprite's content bounding box.
//   4. Downscale (area-average) to fit inside a target box, preserving aspect.
//   5. Compose onto a 32x32 canvas at the chosen anchor. With --align <base.png> the
//      overlay is horizontally centered on the BASE BODY's pixel centroid, so armor/
//      capes/helmets land on the hero instead of beside him.
//
// Usage:
//   node tools/process-sprite.mjs --in raw.png --out assets/flowers.png --bg magenta --fit 30 --vanchor bottom
//   node tools/process-sprite.mjs --in raw.png --out assets/adventurer-down-cape.png \
//        --bg magenta --fit 26 --align assets/adventurer-down.png --vanchor center
//
// No dependencies — built-ins only (fs, zlib).

import fs from 'node:fs';
import zlib from 'node:zlib';

// ---------- CRC32 (for PNG chunk checksums) ----------
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

// ---------- PNG decode -> { w, h, rgba (Uint8 length w*h*4) } ----------
function decodePNG(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG: ' + file);
  let p = 8, idat = [], w = 0, h = 0, bitDepth = 8, colorType = 6;
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') {
      w = b.readUInt32BE(p + 8); h = b.readUInt32BE(p + 12);
      bitDepth = b.readUInt8(p + 16); colorType = b.readUInt8(p + 17);
    } else if (type === 'IDAT') {
      idat.push(b.slice(p + 8, p + 8 + len));
    } else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2))
    throw new Error('unsupported PNG (need 8-bit RGB/RGBA): ' + file + ' bd=' + bitDepth + ' ct=' + colorType);
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const cur = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
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
      else { // Paeth
        const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c);
        out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c);
      }
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

// ---------- PNG encode (RGBA, filter 0) ----------
function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
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
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflated), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- background knockout ----------
// key: 'magenta' (#FF00FF) or 'auto' (sample top-left corner). Pixels within `tol`
// of the key colour become fully transparent; a light de-fringe pulls the key colour
// out of surviving edge pixels so we don't get a coloured halo.
function knockout(img, key, tol) {
  const { w, h, rgba } = img;
  let kr, kg, kb;
  if (key === 'magenta') { kr = 255; kg = 0; kb = 255; }
  else { kr = rgba[0]; kg = rgba[1]; kb = rgba[2]; } // auto: corner pixel
  const t2 = tol * tol * 3;
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const dr = r - kr, dg = g - kg, db = b - kb;
    const dist2 = dr * dr + dg * dg + db * db;
    if (dist2 <= t2) {
      rgba[i * 4 + 3] = 0; // background -> transparent
    } else if (key === 'magenta') {
      // de-fringe: magenta has high R and B, low G. Pull obvious purple halo down.
      if (r > 180 && b > 180 && g < 120) {
        rgba[i * 4 + 3] = Math.min(rgba[i * 4 + 3], 120);
      }
    }
  }
  return img;
}

// ---------- content bounding box (alpha > threshold) ----------
function bbox(img, aMin = 16) {
  const { w, h, rgba } = img;
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

// ---------- horizontal centroid of opaque pixels ----------
function centroidX(img, aMin = 16) {
  const { w, h, rgba } = img;
  let sx = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rgba[(y * w + x) * 4 + 3] > aMin) { sx += x; n++; }
  }
  return n ? sx / n : w / 2;
}

// ---------- area-average downscale of a sub-rect into dstW x dstH ----------
function downscaleRegion(img, box, dstW, dstH) {
  const { w, rgba } = img;
  const out = new Uint8Array(dstW * dstH * 4);
  const sxStep = box.bw / dstW, syStep = box.bh / dstH;
  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      const x0 = box.minX + Math.floor(dx * sxStep), x1 = box.minX + Math.max(Math.floor((dx + 1) * sxStep), Math.floor(dx * sxStep) + 1);
      const y0 = box.minY + Math.floor(dy * syStep), y1 = box.minY + Math.max(Math.floor((dy + 1) * syStep), Math.floor(dy * syStep) + 1);
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
        const i = (sy * w + sx) * 4, al = rgba[i + 3];
        r += rgba[i] * al; g += rgba[i + 1] * al; b += rgba[i + 2] * al; a += al; n++;
      }
      const di = (dy * dstW + dx) * 4;
      if (a > 0) { out[di] = r / a; out[di + 1] = g / a; out[di + 2] = b / a; out[di + 3] = a / n; }
    }
  }
  return { w: dstW, h: dstH, rgba: out };
}

// ---------- compose a small sprite onto a 32x32 canvas ----------
function compose(small, ox, oy) {
  const SIZE = 32;
  const out = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < small.h; y++) for (let x = 0; x < small.w; x++) {
    const dx = ox + x, dy = oy + y;
    if (dx < 0 || dy < 0 || dx >= SIZE || dy >= SIZE) continue;
    const si = (y * small.w + x) * 4, di = (dy * SIZE + dx) * 4;
    out[di] = small.rgba[si]; out[di + 1] = small.rgba[si + 1];
    out[di + 2] = small.rgba[si + 2]; out[di + 3] = small.rgba[si + 3];
  }
  return { w: SIZE, h: SIZE, rgba: out };
}

// ---------- arg parsing ----------
function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { a[argv[i].slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true; }
  }
  return a;
}

function main() {
  const a = parseArgs(process.argv);
  if (!a.in || !a.out) {
    console.error('usage: node tools/process-sprite.mjs --in raw.png --out assets/x.png [--bg magenta|auto] [--tol 60] [--fit 30] [--align base.png] [--vanchor top|center|bottom] [--nudgeY 0]');
    process.exit(1);
  }
  const SIZE = 32;
  const fit = a.fit ? parseInt(a.fit, 10) : 30;     // longest side fits in this many px
  const tol = a.tol ? parseInt(a.tol, 10) : 60;     // background colour tolerance
  const bg = a.bg || 'magenta';
  const vanchor = a.vanchor || 'center';
  const nudgeY = a.nudgeY ? parseInt(a.nudgeY, 10) : 0;

  let img = decodePNG(a.in);
  if (bg !== 'none') knockout(img, bg, tol);
  const box = bbox(img);
  if (!box) { console.error('no content found after knockout — check --bg/--tol'); process.exit(1); }

  // scale so the longest content side becomes `fit`
  const scale = fit / Math.max(box.bw, box.bh);
  let dstW = Math.max(1, Math.round(box.bw * scale));
  let dstH = Math.max(1, Math.round(box.bh * scale));
  if (dstW > SIZE) dstW = SIZE;
  if (dstH > SIZE) dstH = SIZE;
  const small = downscaleRegion(img, box, dstW, dstH);

  // horizontal placement
  let ox;
  if (a.align) {
    const base = decodePNG(a.align);
    const cx = centroidX(base);                 // base body's horizontal centre (often right-shifted)
    ox = Math.round(cx - dstW / 2);
  } else {
    ox = Math.round((SIZE - dstW) / 2);          // plain centre
  }

  // vertical placement
  let oy;
  if (vanchor === 'top') oy = 0;
  else if (vanchor === 'bottom') oy = SIZE - dstH;
  else oy = Math.round((SIZE - dstH) / 2);
  oy += nudgeY;

  // clamp
  ox = Math.max(0, Math.min(SIZE - dstW, ox));
  oy = Math.max(0, Math.min(SIZE - dstH, oy));

  const out = compose(small, ox, oy);
  fs.writeFileSync(a.out, encodePNG(SIZE, SIZE, out.rgba));
  console.log(`wrote ${a.out}  content ${box.bw}x${box.bh} -> ${dstW}x${dstH} at (${ox},${oy})` + (a.align ? `  aligned to ${a.align}` : ''));
}

main();
