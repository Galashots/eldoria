import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FRAME = 64;
const FACINGS = [
  ['right', 'SE'], ['down', 'SW'], ['left', 'NW'], ['up', 'NE'],
].map(([engine, view]) => ({ engine, view, file: `adventurer-${engine}.png` }));

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function hash(buffer) { return createHash('sha256').update(buffer).digest('hex'); }

async function syntheticSources(page, walkDirection) {
  return page.evaluate(({ frame, facings, walkDirection }) => {
    const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
    function ranger(offset = 0, step = 0, turn = 0) {
      const c = canvas(frame, frame), x = 32 + offset, g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#15191a'; g.fillRect(x - 8, 20, 16, 28); g.fillRect(x - 10, 31, 20, 13);
      g.fillStyle = '#345b35'; g.fillRect(x - 7, 22, 14, 23); g.fillRect(x - 9, 29, 18, 11);
      g.fillStyle = '#7f5630'; g.fillRect(x - 6, 39, 12, 13);
      g.fillStyle = '#d6a06f'; g.fillRect(x - 6, 13, 12, 10);
      g.fillStyle = '#6e4027'; g.fillRect(x - 7, 11, 14, 5); g.fillRect(x - 9 + turn, 15, 4, 7);
      g.fillStyle = '#2b241f'; g.fillRect(x - 7 + step, 51, 5, 13); g.fillRect(x + 2 - step, 51, 5, 13);
      g.fillStyle = '#b88a3a'; g.fillRect(x + 7, 24, 3, 22); g.fillRect(x + 8, 22, 5, 3);
      return c;
    }
    const out = {};
    facings.forEach((f, i) => { out[f.file] = ranger(i % 2, 0, i).toDataURL('image/png').split(',')[1]; });
    const strip = canvas(frame * 4, frame), g = strip.getContext('2d');
    [-1, 0, 1, 0].forEach((step, i) => g.drawImage(ranger(0, step, 0), i * frame, 0));
    out[`adventurer-${walkDirection}-walk.png`] = strip.toDataURL('image/png').split(',')[1];
    return out;
  }, { frame: FRAME, facings: FACINGS, walkDirection });
}

async function fileSources(inputDir, walkDirection, staticOnly) {
  const names = FACINGS.map(f => f.file);
  if (!staticOnly) names.push(`adventurer-${walkDirection}-walk.png`);
  return Object.fromEntries(await Promise.all(names.map(async name => [name, (await readFile(path.join(inputDir, name))).toString('base64')])));
}

async function validate(page, sources, walkDirection, staticOnly) {
  return page.evaluate(async ({ frame, facings, sources, walkDirection, staticOnly }) => {
    const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
    const load = (b64, name) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Decode failed: ${name}`));
      image.src = `data:image/png;base64,${b64}`;
    });
    function scan(data) {
      let minX = data.width, minY = data.height, maxX = -1, maxY = -1, semi = 0, pixels = 0;
      for (let y = 0; y < data.height; y++) for (let x = 0; x < data.width; x++) {
        const a = data.data[(y * data.width + x) * 4 + 3];
        if (a) { pixels++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
        if (a > 0 && a < 255) semi++;
      }
      const bounds = maxX < 0 ? null : { x: minX, y: minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1, centerX: (minX + maxX) / 2 };
      return { bounds, pixels, semiTransparentPixels: semi };
    }
    const images = {};
    for (const [name, b64] of Object.entries(sources)) images[name] = await load(b64, name);
    const statics = facings.map(f => {
      const image = images[f.file], c = canvas(image.naturalWidth, image.naturalHeight), g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(image, 0, 0);
      const s = scan(g.getImageData(0, 0, c.width, c.height));
      return { ...f, width: c.width, height: c.height, ...s,
        dimensionsPass: c.width === frame && c.height === frame,
        binaryAlphaPass: s.semiTransparentPixels === 0,
        visiblePass: Boolean(s.bounds),
        bottomAnchorPass: Boolean(s.bounds && s.bounds.maxY === frame - 1),
        horizontalPaddingPass: Boolean(s.bounds && s.bounds.x > 0 && s.bounds.maxX < frame - 1) };
    });
    const range = values => Math.max(...values) - Math.min(...values);
    const metrics = {
      staticHeightRange: range(statics.map(x => x.bounds?.height || 0)),
      staticWidthRange: range(statics.map(x => x.bounds?.width || 0)),
    };
    const gates = {
      statics: statics.every(x => x.dimensionsPass && x.binaryAlphaPass && x.visiblePass && x.bottomAnchorPass && x.horizontalPaddingPass),
      scaleConsistency: metrics.staticHeightRange <= 6 && metrics.staticWidthRange <= 10,
    };
    let walkReport = { status: 'not-generated' };
    let walk = null;
    if (!staticOnly) {
      const walkName = `adventurer-${walkDirection}-walk.png`;
      walk = images[walkName];
      const wc = canvas(walk.naturalWidth, walk.naturalHeight), wg = wc.getContext('2d', { willReadFrequently: true });
      wg.drawImage(walk, 0, 0);
      const walkFrames = Array.from({ length: 4 }, (_, i) => ({ index: i, ...scan(wg.getImageData(i * frame, 0, frame, frame)) }));
      metrics.walkCenterRange = range(walkFrames.map(x => x.bounds?.centerX || 0));
      metrics.walkTopRange = range(walkFrames.map(x => x.bounds?.y || 0));
      gates.walkDimensions = wc.width === frame * 4 && wc.height === frame;
      gates.walkFrames = walkFrames.every(x => x.bounds && x.bounds.maxY === frame - 1 && x.semiTransparentPixels === 0);
      gates.walkStability = metrics.walkCenterRange <= 6 && metrics.walkTopRange <= 4;
      walkReport = { status: 'generated', file: walkName, width: wc.width, height: wc.height, frames: walkFrames };
    }
    const nearest = (g, image, sx, dx, scale) => { g.imageSmoothingEnabled = false; g.drawImage(image, sx, 0, frame, frame, dx, 0, frame * scale, frame * scale); };
    const contact = canvas(frame * 8, frame * 2), cg = contact.getContext('2d'); facings.forEach((f, i) => nearest(cg, images[f.file], 0, i * frame * 2, 2));
    const runtime = canvas(frame * 4, frame), rg = runtime.getContext('2d'); facings.forEach((f, i) => nearest(rg, images[f.file], 0, i * frame, 1));
    const dark = canvas(frame * 8, frame * 2), dg = dark.getContext('2d'); dg.fillStyle = '#11131a'; dg.fillRect(0, 0, dark.width, dark.height); facings.forEach((f, i) => nearest(dg, images[f.file], 0, i * frame * 2, 2));
    const overlay = canvas(frame * 8, frame * 2), og = overlay.getContext('2d'); facings.forEach((f, i) => { const x = i * frame * 2, b = statics[i].bounds; nearest(og, images[f.file], 0, x, 2); if (b) { og.strokeStyle = '#00ff88'; og.strokeRect(x + b.x * 2 + .5, b.y * 2 + .5, b.width * 2 - 1, b.height * 2 - 1); } og.strokeStyle = '#ff3b6b'; og.strokeRect(x + frame - 3, frame * 2 - 4, 6, 3); });
    const evidence = { 'four-facing-contact-sheet.png': contact, 'runtime-scale-sheet.png': runtime, 'dark-background-sheet.png': dark, 'anchor-bounds-overlay.png': overlay };
    if (!staticOnly) {
      const preview = canvas(frame * 8, frame * 2), pg = preview.getContext('2d'); pg.fillStyle = '#11131a'; pg.fillRect(0, 0, preview.width, preview.height); for (let i = 0; i < 4; i++) nearest(pg, walk, i * frame, i * frame * 2, 2);
      evidence['walk-strip-preview.png'] = preview;
    }
    return {
      report: { frameSize: [frame, frame], facingOrder: facings.map(f => `${f.engine}:${f.view}`), staticOnly, statics, walk: walkReport, metrics, gates, passed: Object.values(gates).every(Boolean), visualSemanticsNotMachineVerified: ['identity consistency','fixed-camera consistency','elevated isometric projection','facing readability','upper-left lighting','pixel treatment','North Star alignment'] },
      evidence: Object.fromEntries(Object.entries(evidence).map(([name, c]) => [name, c.toDataURL('image/png').split(',')[1]])),
    };
  }, { frame: FRAME, facings: FACINGS, sources, walkDirection, staticOnly });
}

async function main() {
  const selfTest = process.argv.includes('--self-test');
  const staticOnly = process.argv.includes('--static-only');
  const walkDirection = arg('--walk-direction', 'right');
  if (!['down','up','left','right'].includes(walkDirection)) throw new Error(`Invalid walk direction: ${walkDirection}`);
  const inputDir = path.resolve(ROOT, arg('--input-dir', 'art/ranger-proof/normalized'));
  const outputDir = path.resolve(ROOT, arg('--output-dir', selfTest ? 'artifacts/ranger-proof-self-test' : 'artifacts/ranger-proof'));
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const sources = selfTest ? await syntheticSources(page, walkDirection) : await fileSources(inputDir, walkDirection, staticOnly);
    const first = await validate(page, sources, walkDirection, staticOnly), second = await validate(page, sources, walkDirection, staticOnly);
    const firstHashes = Object.fromEntries(Object.entries(first.evidence).map(([n, b]) => [n, hash(Buffer.from(b, 'base64'))]));
    const secondHashes = Object.fromEntries(Object.entries(second.evidence).map(([n, b]) => [n, hash(Buffer.from(b, 'base64'))]));
    const deterministic = JSON.stringify(firstHashes) === JSON.stringify(secondHashes);
    if (!deterministic) throw new Error('Evidence rerun hashes differ');
    await mkdir(outputDir, { recursive: true });
    for (const [name, b64] of Object.entries(first.evidence)) await writeFile(path.join(outputDir, name), Buffer.from(b64, 'base64'));
    const report = { ...first.report, deterministic, sources: Object.fromEntries(Object.entries(sources).map(([n, b]) => [n, { bytes: Buffer.from(b, 'base64').length, sha256: hash(Buffer.from(b, 'base64')) }])), evidence: firstHashes };
    await writeFile(path.join(outputDir, 'machine-check-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    if (!report.passed) throw new Error(`Machine gates failed; see ${path.join(outputDir, 'machine-check-report.json')}`);
    console.log(`Ranger proof machine gates passed (${selfTest ? 'self-test' : inputDir}); staticOnly=${staticOnly}; deterministic=${deterministic}`);
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
