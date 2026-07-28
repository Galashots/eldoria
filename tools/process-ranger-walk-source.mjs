import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SOURCE = path.join(ROOT, 'art/source/characters/ranger-right-walk-source-v001.jpeg');
const OUTPUT = path.join(ROOT, 'art/ranger-proof/normalized/adventurer-right-walk.png');
const EVIDENCE_DIR = path.join(ROOT, 'artifacts/ranger-walk-v1');
const REPORT = path.join(ROOT, 'docs/visual/experiments/ranger-character-proof/walk-v1/machine-check-report.json');
const FRAME = 64;
const SOURCE_WIDTH = 1536;
const SOURCE_HEIGHT = 512;
const SOURCE_CELL_WIDTH = 384;
const TARGET_MAX_HEIGHT = 56;
const LIGHT_NEUTRAL_MIN = 218;
const LIGHT_NEUTRAL_SPREAD = 24;
const RESIZED_ALPHA_THRESHOLD = 128;

function hash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function processSource(page, sourceBase64) {
  return page.evaluate(async contract => {
    const {
      sourceBase64,
      frame,
      sourceWidth,
      sourceHeight,
      sourceCellWidth,
      targetMaxHeight,
      lightNeutralMin,
      lightNeutralSpread,
      resizedAlphaThreshold,
    } = contract;
    const makeCanvas = (width, height) =>
      Object.assign(document.createElement('canvas'), { width, height });
    const encode = canvas => canvas.toDataURL('image/png').split(',')[1];
    const load = src => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not decode Ranger walk source JPEG'));
      image.src = src;
    });
    const scan = imageData => {
      let minX = imageData.width;
      let minY = imageData.height;
      let maxX = -1;
      let maxY = -1;
      let opaquePixels = 0;
      let semiTransparentPixels = 0;
      for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
          const alpha = imageData.data[(y * imageData.width + x) * 4 + 3];
          if (alpha) {
            opaquePixels++;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
          if (alpha > 0 && alpha < 255) semiTransparentPixels++;
        }
      }
      if (maxX < 0) return { bounds: null, opaquePixels, semiTransparentPixels };
      return {
        bounds: {
          x: minX,
          y: minY,
          maxX,
          maxY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
          centerX: (minX + maxX) / 2,
        },
        opaquePixels,
        semiTransparentPixels,
      };
    };
    const retainLargestComponent = imageData => {
      const { width, height, data } = imageData;
      const pixelCount = width * height;
      const seen = new Uint8Array(pixelCount);
      let largest = [];
      for (let start = 0; start < pixelCount; start++) {
        if (seen[start] || data[start * 4 + 3] === 0) continue;
        const component = [];
        const queue = [start];
        seen[start] = 1;
        for (let head = 0; head < queue.length; head++) {
          const index = queue[head];
          component.push(index);
          const x = index % width;
          const y = Math.floor(index / width);
          const neighbours = [
            x > 0 ? index - 1 : -1,
            x + 1 < width ? index + 1 : -1,
            y > 0 ? index - width : -1,
            y + 1 < height ? index + width : -1,
          ];
          for (const next of neighbours) {
            if (next < 0 || seen[next] || data[next * 4 + 3] === 0) continue;
            seen[next] = 1;
            queue.push(next);
          }
        }
        if (component.length > largest.length) largest = component;
      }
      const keep = new Uint8Array(pixelCount);
      for (const index of largest) keep[index] = 1;
      for (let i = 0; i < pixelCount; i++) if (!keep[i]) data[i * 4 + 3] = 0;
    };
    const footCenter = imageData => {
      const { width, height, data } = imageData;
      let bottom = -1;
      for (let i = 0; i < width * height; i++) {
        if (data[i * 4 + 3]) bottom = Math.max(bottom, Math.floor(i / width));
      }
      let sum = 0;
      let count = 0;
      for (let y = Math.max(0, bottom - 5); y <= bottom; y++) {
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * 4 + 3]) {
            sum += x;
            count++;
          }
        }
      }
      return count ? sum / count : width / 2;
    };

    const source = await load(`data:image/jpeg;base64,${sourceBase64}`);
    if (source.naturalWidth !== sourceWidth || source.naturalHeight !== sourceHeight) {
      throw new Error(`Expected ${sourceWidth}x${sourceHeight} source, got ${source.naturalWidth}x${source.naturalHeight}`);
    }
    const sourceCanvas = makeCanvas(sourceWidth, sourceHeight);
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
    sourceContext.drawImage(source, 0, 0);

    const cells = [];
    for (let index = 0; index < 4; index++) {
      const cellCanvas = makeCanvas(sourceCellWidth, sourceHeight);
      const cellContext = cellCanvas.getContext('2d', { willReadFrequently: true });
      cellContext.drawImage(
        sourceCanvas,
        index * sourceCellWidth, 0, sourceCellWidth, sourceHeight,
        0, 0, sourceCellWidth, sourceHeight,
      );
      const imageData = cellContext.getImageData(0, 0, sourceCellWidth, sourceHeight);
      for (let pixel = 0; pixel < imageData.data.length; pixel += 4) {
        const red = imageData.data[pixel];
        const green = imageData.data[pixel + 1];
        const blue = imageData.data[pixel + 2];
        const minimum = Math.min(red, green, blue);
        const maximum = Math.max(red, green, blue);
        const isCheckerboard =
          minimum >= lightNeutralMin && maximum - minimum <= lightNeutralSpread;
        imageData.data[pixel + 3] = isCheckerboard ? 0 : 255;
      }
      retainLargestComponent(imageData);
      cellContext.clearRect(0, 0, sourceCellWidth, sourceHeight);
      cellContext.putImageData(imageData, 0, 0);
      const measured = scan(imageData);
      if (!measured.bounds) throw new Error(`No visible Ranger subject in source cell ${index}`);
      cells.push({ index, canvas: cellCanvas, sourceBounds: measured.bounds });
    }

    const sharedScale = targetMaxHeight / Math.max(...cells.map(cell => cell.sourceBounds.height));
    const frames = [];
    const strip = makeCanvas(frame * 4, frame);
    const stripContext = strip.getContext('2d');
    stripContext.imageSmoothingEnabled = false;

    for (const cell of cells) {
      const resizedWidth = Math.max(1, Math.round(cell.sourceBounds.width * sharedScale));
      const resizedHeight = Math.max(1, Math.round(cell.sourceBounds.height * sharedScale));
      const resized = makeCanvas(resizedWidth, resizedHeight);
      const resizedContext = resized.getContext('2d', { willReadFrequently: true });
      resizedContext.imageSmoothingEnabled = false;
      resizedContext.drawImage(
        cell.canvas,
        cell.sourceBounds.x, cell.sourceBounds.y, cell.sourceBounds.width, cell.sourceBounds.height,
        0, 0, resizedWidth, resizedHeight,
      );
      const resizedData = resizedContext.getImageData(0, 0, resizedWidth, resizedHeight);
      for (let pixel = 0; pixel < resizedData.data.length; pixel += 4) {
        resizedData.data[pixel + 3] =
          resizedData.data[pixel + 3] >= resizedAlphaThreshold ? 255 : 0;
      }
      resizedContext.putImageData(resizedData, 0, 0);

      const sourceFootCenter = footCenter(resizedData);
      const left = Math.round(frame / 2 - sourceFootCenter);
      const top = frame - resizedHeight;
      const frameCanvas = makeCanvas(frame, frame);
      const frameContext = frameCanvas.getContext('2d', { willReadFrequently: true });
      frameContext.imageSmoothingEnabled = false;
      frameContext.drawImage(resized, left, top);
      const frameData = frameContext.getImageData(0, 0, frame, frame);
      const measured = scan(frameData);
      if (!measured.bounds) throw new Error(`No normalized subject in frame ${cell.index}`);
      frames.push({
        index: cell.index,
        sourceBounds: cell.sourceBounds,
        resizedSize: [resizedWidth, resizedHeight],
        placement: [left, top],
        bounds: measured.bounds,
        opaquePixels: measured.opaquePixels,
        semiTransparentPixels: measured.semiTransparentPixels,
        footBandCenterX: footCenter(frameData),
        canvas: frameCanvas,
      });
      stripContext.drawImage(frameCanvas, cell.index * frame, 0);
    }

    const dark = makeCanvas(frame * 8, frame * 2);
    const darkContext = dark.getContext('2d');
    darkContext.fillStyle = '#141821';
    darkContext.fillRect(0, 0, dark.width, dark.height);
    darkContext.imageSmoothingEnabled = false;
    frames.forEach(item => darkContext.drawImage(
      item.canvas,
      item.index * frame * 2, 0, frame * 2, frame * 2,
    ));

    const magenta = makeCanvas(frame * 8, frame * 2);
    const magentaContext = magenta.getContext('2d');
    magentaContext.fillStyle = '#ff00ff';
    magentaContext.fillRect(0, 0, magenta.width, magenta.height);
    magentaContext.imageSmoothingEnabled = false;
    frames.forEach(item => magentaContext.drawImage(
      item.canvas,
      item.index * frame * 2, 0, frame * 2, frame * 2,
    ));

    const overlay = makeCanvas(frame * 8, frame * 2);
    const overlayContext = overlay.getContext('2d');
    overlayContext.imageSmoothingEnabled = false;
    frames.forEach(item => {
      const offset = item.index * frame * 2;
      overlayContext.drawImage(item.canvas, offset, 0, frame * 2, frame * 2);
      const bounds = item.bounds;
      overlayContext.strokeStyle = '#00ff88';
      overlayContext.strokeRect(
        offset + bounds.x * 2 + 0.5,
        bounds.y * 2 + 0.5,
        bounds.width * 2 - 1,
        bounds.height * 2 - 1,
      );
      overlayContext.strokeStyle = '#ff3b6b';
      overlayContext.strokeRect(offset + frame - 3, frame * 2 - 4, 6, 3);
    });

    const range = values => Math.max(...values) - Math.min(...values);
    const metrics = {
      walkCenterRange: range(frames.map(item => item.bounds.centerX)),
      walkTopRange: range(frames.map(item => item.bounds.y)),
      footCenterRange: range(frames.map(item => item.footBandCenterX)),
    };
    const gates = {
      dimensions: strip.width === frame * 4 && strip.height === frame,
      frameCount: frames.length === 4,
      binaryAlpha: frames.every(item => item.semiTransparentPixels === 0),
      visible: frames.every(item => Boolean(item.bounds)),
      bottomAnchor: frames.every(item => item.bounds.maxY === frame - 1),
      horizontalPadding: frames.every(item => item.bounds.x > 0 && item.bounds.maxX < frame - 1),
      walkStability: metrics.walkCenterRange <= 6 && metrics.walkTopRange <= 4,
      footPivotConsistency: metrics.footCenterRange <= 1,
    };
    return {
      strip: encode(strip),
      evidence: {
        'runtime-scale-sheet.png': encode(strip),
        'walk-strip-preview.png': encode(dark),
        'magenta-transparency-sheet.png': encode(magenta),
        'anchor-bounds-overlay.png': encode(overlay),
      },
      report: {
        candidate: 'v1-right-se-four-frame-walk-owner-review',
        facing: 'right:SE',
        frameSize: [frame, frame],
        frameCount: 4,
        sourceGrid: [4, 1],
        normalization: {
          sourceCellSize: [sourceCellWidth, sourceHeight],
          lightNeutralMinimum: lightNeutralMin,
          lightNeutralMaximumSpread: lightNeutralSpread,
          componentRule: 'largest 4-connected non-background component per source cell',
          targetMaxHeight,
          sharedScale,
          resampling: 'nearest-neighbour',
          resizedAlphaThreshold,
          pivot: 'opaque pixels in bottom 6 rows centered at x=32; visible bounds bottom at y=63',
        },
        frames: frames.map(({ canvas: _canvas, ...item }) => item),
        metrics,
        gates,
        passed: Object.values(gates).every(Boolean),
        visualSemanticsNotMachineVerified: [
          'identity consistency',
          'equipment consistency',
          'gait quality',
          'directional readability',
          'upper-left lighting',
          'pixel treatment',
          'North Star alignment',
        ],
      },
    };
  }, {
    sourceBase64,
    frame: FRAME,
    sourceWidth: SOURCE_WIDTH,
    sourceHeight: SOURCE_HEIGHT,
    sourceCellWidth: SOURCE_CELL_WIDTH,
    targetMaxHeight: TARGET_MAX_HEIGHT,
    lightNeutralMin: LIGHT_NEUTRAL_MIN,
    lightNeutralSpread: LIGHT_NEUTRAL_SPREAD,
    resizedAlphaThreshold: RESIZED_ALPHA_THRESHOLD,
  });
}

async function main() {
  const source = await readFile(SOURCE);
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const first = await processSource(page, source.toString('base64'));
    const second = await processSource(page, source.toString('base64'));
    const firstBuffers = {
      'adventurer-right-walk.png': Buffer.from(first.strip, 'base64'),
      ...Object.fromEntries(Object.entries(first.evidence).map(
        ([name, base64]) => [name, Buffer.from(base64, 'base64')],
      )),
    };
    const secondBuffers = {
      'adventurer-right-walk.png': Buffer.from(second.strip, 'base64'),
      ...Object.fromEntries(Object.entries(second.evidence).map(
        ([name, base64]) => [name, Buffer.from(base64, 'base64')],
      )),
    };
    const firstHashes = Object.fromEntries(Object.entries(firstBuffers).map(
      ([name, buffer]) => [name, hash(buffer)],
    ));
    const secondHashes = Object.fromEntries(Object.entries(secondBuffers).map(
      ([name, buffer]) => [name, hash(buffer)],
    ));
    const deterministic = JSON.stringify(firstHashes) === JSON.stringify(secondHashes);
    if (!deterministic) throw new Error('Ranger walk output hashes differ across identical runs');
    if (!first.report.passed) throw new Error('Ranger walk machine gates failed');

    await mkdir(path.dirname(OUTPUT), { recursive: true });
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await mkdir(path.dirname(REPORT), { recursive: true });
    await writeFile(OUTPUT, firstBuffers['adventurer-right-walk.png']);
    for (const [name, buffer] of Object.entries(firstBuffers)) {
      if (name !== 'adventurer-right-walk.png') {
        await writeFile(path.join(EVIDENCE_DIR, name), buffer);
      }
    }
    const report = {
      ...first.report,
      source: {
        file: path.relative(ROOT, SOURCE),
        dimensions: [SOURCE_WIDTH, SOURCE_HEIGHT],
        bytes: source.length,
        sha256: hash(source),
        note: 'Owner-accepted corrected whole-strip source; baked checkerboard removed deterministically.',
      },
      deterministic,
      outputs: firstHashes,
    };
    await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Ranger walk processing passed; deterministic=${deterministic}; output=${path.relative(ROOT, OUTPUT)}`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
