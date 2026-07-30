import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FRAME = 64;
const TARGET_MAX_HEIGHT = 56;
const SOURCE_ALPHA_THRESHOLD = 224;
const RESIZED_ALPHA_THRESHOLD = 128;
const FACINGS = [
  { engine: 'right', view: 'SE', cell: [0, 0] },
  { engine: 'down', view: 'SW', cell: [0, 1] },
  { engine: 'left', view: 'NW', cell: [1, 1] },
  { engine: 'up', view: 'NE', cell: [1, 0] },
];

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function hash(buffer) { return createHash('sha256').update(buffer).digest('hex'); }

// Decoded-pixel comparison (not byte comparison): PNG encoders differ across
// platforms, but the decoded RGBA data is the contract.
async function assertPixelsMatchCommitted(page, name, producedBase64, committedPath) {
  let committed;
  try {
    committed = await readFile(committedPath);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`--check: committed file missing: ${committedPath}`);
    throw error;
  }
  const equal = await page.evaluate(async ({ produced, existing }) => {
    const load = src => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not decode PNG for comparison'));
      image.src = src;
    });
    const decode = async b64 => {
      const image = await load(`data:image/png;base64,${b64}`);
      const c = Object.assign(document.createElement('canvas'), { width: image.width, height: image.height });
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      return { width: image.width, height: image.height, data: Array.from(ctx.getImageData(0, 0, image.width, image.height).data) };
    };
    const a = await decode(produced);
    const b = await decode(existing);
    if (a.width !== b.width || a.height !== b.height) return false;
    for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) return false;
    return true;
  }, { produced: producedBase64, existing: committed.toString('base64') });
  if (!equal) throw new Error(`--check: ${name} pixels differ from committed ${committedPath}`);
}

async function render(page, sourceBase64) {
  return page.evaluate(async ({ sourceBase64, frame, targetMaxHeight, sourceAlphaThreshold, resizedAlphaThreshold, facings }) => {
    const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
    const load = src => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not decode Ranger source PNG'));
      image.src = src;
    });
    const encode = c => c.toDataURL('image/png').split(',')[1];
    function scan(imageData) {
      let minX = imageData.width, minY = imageData.height, maxX = -1, maxY = -1;
      let opaquePixels = 0, semiTransparentPixels = 0;
      for (let y = 0; y < imageData.height; y++) for (let x = 0; x < imageData.width; x++) {
        const a = imageData.data[(y * imageData.width + x) * 4 + 3];
        if (a) {
          opaquePixels++;
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
        if (a > 0 && a < 255) semiTransparentPixels++;
      }
      if (maxX < 0) return { bounds: null, opaquePixels, semiTransparentPixels };
      return {
        bounds: { x: minX, y: minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1, centerX: (minX + maxX) / 2 },
        opaquePixels,
        semiTransparentPixels,
      };
    }
    function threshold(imageData, minimumAlpha) {
      for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i + 3] >= minimumAlpha) imageData.data[i + 3] = 255;
        else {
          imageData.data[i] = 0; imageData.data[i + 1] = 0; imageData.data[i + 2] = 0; imageData.data[i + 3] = 0;
        }
      }
    }
    function footBandCenter(imageData, bounds) {
      const xs = [];
      const minY = Math.max(bounds.y, bounds.maxY - 5);
      for (let y = minY; y <= bounds.maxY; y++) for (let x = bounds.x; x <= bounds.maxX; x++) {
        if (imageData.data[(y * imageData.width + x) * 4 + 3]) xs.push(x);
      }
      return xs.reduce((sum, x) => sum + x, 0) / xs.length;
    }
    function nearest(ctx, image, dx, scale = 1) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, dx, 0, frame * scale, frame * scale);
    }

    const source = await load(`data:image/png;base64,${sourceBase64}`);
    if (source.naturalWidth % 2 || source.naturalHeight % 2) throw new Error(`Source must split into a 2x2 grid: ${source.naturalWidth}x${source.naturalHeight}`);
    const cellWidth = source.naturalWidth / 2, cellHeight = source.naturalHeight / 2;
    const cropped = [];
    for (const facing of facings) {
      const cell = canvas(cellWidth, cellHeight), cg = cell.getContext('2d', { willReadFrequently: true });
      cg.drawImage(source, facing.cell[0] * cellWidth, facing.cell[1] * cellHeight, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
      const data = cg.getImageData(0, 0, cellWidth, cellHeight);
      threshold(data, sourceAlphaThreshold);
      cg.putImageData(data, 0, 0);
      const sourceScan = scan(data);
      if (!sourceScan.bounds) throw new Error(`No visible pixels for ${facing.engine}`);
      const b = sourceScan.bounds;
      const cut = canvas(b.width, b.height), cutg = cut.getContext('2d');
      cutg.drawImage(cell, b.x, b.y, b.width, b.height, 0, 0, b.width, b.height);
      cropped.push({ facing, cut, sourceBounds: b });
    }
    const maxSourceHeight = Math.max(...cropped.map(item => item.cut.height));
    const sharedScale = targetMaxHeight / maxSourceHeight;
    const frames = [];
    for (const item of cropped) {
      const width = Math.max(1, Math.round(item.cut.width * sharedScale));
      const height = Math.max(1, Math.round(item.cut.height * sharedScale));
      const resized = canvas(width, height), rg = resized.getContext('2d', { willReadFrequently: true });
      rg.imageSmoothingEnabled = false;
      rg.drawImage(item.cut, 0, 0, item.cut.width, item.cut.height, 0, 0, width, height);
      const resizedData = rg.getImageData(0, 0, width, height);
      threshold(resizedData, resizedAlphaThreshold);
      rg.putImageData(resizedData, 0, 0);
      const resizedScan = scan(resizedData);
      const footCenter = footBandCenter(resizedData, resizedScan.bounds);
      const x = Math.round(frame / 2 - footCenter), y = frame - height;
      const out = canvas(frame, frame), og = out.getContext('2d', { willReadFrequently: true });
      og.drawImage(resized, x, y);
      const finalData = og.getImageData(0, 0, frame, frame);
      const finalScan = scan(finalData);
      const finalFootCenter = footBandCenter(finalData, finalScan.bounds);
      frames.push({
        ...item.facing,
        canvas: out,
        metrics: {
          width: frame,
          height: frame,
          sourceBounds: item.sourceBounds,
          resizedSize: [width, height],
          placement: [x, y],
          ...finalScan,
          footBandCenterX: finalFootCenter,
        },
      });
    }

    const runtime = canvas(frame * 4, frame), runtimeG = runtime.getContext('2d');
    frames.forEach((item, i) => nearest(runtimeG, item.canvas, i * frame));
    const contact = canvas(frame * 16, frame * 4), contactG = contact.getContext('2d');
    frames.forEach((item, i) => nearest(contactG, item.canvas, i * frame * 4, 4));
    const dark = canvas(contact.width, contact.height), darkG = dark.getContext('2d');
    darkG.fillStyle = '#11131a'; darkG.fillRect(0, 0, dark.width, dark.height);
    frames.forEach((item, i) => nearest(darkG, item.canvas, i * frame * 4, 4));
    const magenta = canvas(contact.width, contact.height), magentaG = magenta.getContext('2d');
    magentaG.fillStyle = '#ff00ff'; magentaG.fillRect(0, 0, magenta.width, magenta.height);
    frames.forEach((item, i) => nearest(magentaG, item.canvas, i * frame * 4, 4));
    const overlay = canvas(contact.width, contact.height), overlayG = overlay.getContext('2d');
    frames.forEach((item, i) => {
      const dx = i * frame * 4, b = item.metrics.bounds;
      nearest(overlayG, item.canvas, dx, 4);
      overlayG.strokeStyle = '#00ff88'; overlayG.lineWidth = 2;
      overlayG.strokeRect(dx + b.x * 4 + .5, b.y * 4 + .5, b.width * 4 - 1, b.height * 4 - 1);
      overlayG.fillStyle = '#ff3b6b'; overlayG.fillRect(dx + frame * 2 - 3, frame * 4 - 4, 6, 3);
    });

    const range = values => Math.max(...values) - Math.min(...values);
    const metrics = {
      staticHeightRange: range(frames.map(item => item.metrics.bounds.height)),
      staticWidthRange: range(frames.map(item => item.metrics.bounds.width)),
      footCenterRange: range(frames.map(item => item.metrics.footBandCenterX)),
    };
    const gates = {
      dimensions: frames.every(item => item.metrics.width === frame && item.metrics.height === frame),
      binaryAlpha: frames.every(item => item.metrics.semiTransparentPixels === 0),
      visible: frames.every(item => item.metrics.opaquePixels > 0),
      bottomAnchor: frames.every(item => item.metrics.bounds.maxY === frame - 1),
      horizontalPadding: frames.every(item => item.metrics.bounds.x > 0 && item.metrics.bounds.maxX < frame - 1),
      scaleConsistency: metrics.staticHeightRange <= 6 && metrics.staticWidthRange <= 10,
      footPivotConsistency: metrics.footCenterRange <= 2,
    };
    return {
      normalized: Object.fromEntries(frames.map(item => [`adventurer-${item.engine}.png`, encode(item.canvas)])),
      evidence: {
        'runtime-scale-sheet.png': encode(runtime),
        'four-facing-contact-sheet.png': encode(contact),
        'dark-background-sheet.png': encode(dark),
        'magenta-sheet.png': encode(magenta),
        'anchor-bounds-overlay.png': encode(overlay),
      },
      report: {
        candidate: 'v1-static-owner-review',
        frameSize: [frame, frame],
        facingOrder: frames.map(item => `${item.engine}:${item.view}`),
        source: { size: [source.naturalWidth, source.naturalHeight] },
        normalization: {
          sourceGrid: [2, 2],
          alphaThreshold: sourceAlphaThreshold,
          targetMaxHeight,
          sharedScale,
          resampling: 'nearest-neighbour',
          resizedAlphaThreshold,
          pivot: 'bottom-six-row opaque centroid aligned to x=32; visible bounds bottom at y=63',
        },
        statics: Object.fromEntries(frames.map(item => [item.engine, item.metrics])),
        metrics,
        gates,
        passed: Object.values(gates).every(Boolean),
        walk: { status: 'not-generated', reason: 'Static facings require owner visual judgment before animation generation.' },
        visualSemanticsNotMachineVerified: ['identity consistency','fixed-camera consistency','elevated isometric projection','facing readability','upper-left lighting','pixel treatment','North Star alignment'],
      },
    };
  }, { sourceBase64, frame: FRAME, targetMaxHeight: TARGET_MAX_HEIGHT, sourceAlphaThreshold: SOURCE_ALPHA_THRESHOLD, resizedAlphaThreshold: RESIZED_ALPHA_THRESHOLD, facings: FACINGS });
}

async function main() {
  const sourcePath = path.resolve(ROOT, arg('--source', 'art/source/characters/ranger-four-facing-source-v001.png'));
  const normalizedDir = path.resolve(ROOT, arg('--normalized-dir', 'art/ranger-proof/normalized'));
  const evidenceDir = path.resolve(ROOT, arg('--evidence-dir', 'docs/visual/experiments/ranger-character-proof/candidate-v1'));
  const source = await readFile(sourcePath);
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const first = await render(page, source.toString('base64'));
    const second = await render(page, source.toString('base64'));
    const firstHashes = Object.fromEntries([...Object.entries(first.normalized), ...Object.entries(first.evidence)].map(([name, b64]) => [name, hash(Buffer.from(b64, 'base64'))]));
    const secondHashes = Object.fromEntries([...Object.entries(second.normalized), ...Object.entries(second.evidence)].map(([name, b64]) => [name, hash(Buffer.from(b64, 'base64'))]));
    const deterministic = JSON.stringify(firstHashes) === JSON.stringify(secondHashes);
    if (!deterministic) throw new Error('Ranger source processing produced different rerun hashes');
    if (!first.report.passed) throw new Error(`Ranger source processing gates failed: ${JSON.stringify(first.report.gates)}`);
    if (process.argv.includes('--check')) {
      for (const [name, b64] of Object.entries(first.normalized)) {
        await assertPixelsMatchCommitted(page, name, b64, path.join(normalizedDir, name));
      }
      console.log('Ranger static candidate --check passed: gates green, deterministic, committed pixels match');
      return;
    }
    await mkdir(normalizedDir, { recursive: true });
    await mkdir(evidenceDir, { recursive: true });
    for (const [name, b64] of Object.entries(first.normalized)) await writeFile(path.join(normalizedDir, name), Buffer.from(b64, 'base64'));
    for (const [name, b64] of Object.entries(first.evidence)) await writeFile(path.join(evidenceDir, name), Buffer.from(b64, 'base64'));
    const report = { ...first.report, deterministic, source: { ...first.report.source, file: path.relative(ROOT, sourcePath), bytes: source.length, sha256: hash(source) }, outputs: firstHashes };
    await writeFile(path.join(evidenceDir, 'machine-check-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Ranger static candidate processed; deterministic=${deterministic}`);
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
