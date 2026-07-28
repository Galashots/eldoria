import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = new URL('../', import.meta.url);
const SOURCE = fileURLToPath(new URL('art/source/crops/crop-family-source.png', ROOT));
const OUTPUT_DIR = fileURLToPath(new URL('assets/iso/', ROOT));
const ARTIFACT_DIR = fileURLToPath(new URL('artifacts/', ROOT));
const CROPS = ['turnip', 'carrot', 'corn', 'pumpkin', 'starfruit'];

async function main() {
  const source = await readFile(SOURCE);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    const result = await page.evaluate(async ({ sourceBase64, crops }) => {
      const FRAME = 64;
      const STAGES = 3;
      const LIMITS = [
        { width: 22, height: 20 },
        { width: 38, height: 36 },
        { width: 48, height: 48 },
      ];
      const PALETTE = [
        [18, 25, 18], [27, 40, 23], [39, 55, 28], [51, 75, 30],
        [67, 94, 31], [82, 116, 35], [105, 139, 42], [132, 165, 55],
        [162, 193, 70], [197, 218, 91], [34, 27, 20], [55, 36, 24],
        [79, 47, 27], [105, 61, 30], [135, 77, 32], [168, 91, 32],
        [201, 106, 27], [231, 137, 37], [249, 174, 55], [255, 211, 84],
        [255, 239, 126], [69, 35, 66], [96, 47, 89], [130, 63, 116],
        [166, 85, 144], [206, 132, 179], [113, 111, 75], [151, 141, 94],
        [189, 171, 118], [222, 205, 154], [244, 232, 193], [236, 241, 215],
      ];

      function canvas(width, height) {
        const el = document.createElement('canvas');
        el.width = width;
        el.height = height;
        return el;
      }

      function loadImage(src) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Could not decode crop source PNG'));
          img.src = src;
        });
      }

      function backgroundCandidate(r, g, b) {
        return Math.min(r, g, b) >= 120 && Math.max(r, g, b) - Math.min(r, g, b) <= 50;
      }

      function clearConnectedBackground(imageData) {
        const { data, width, height } = imageData;
        const total = width * height;
        const queued = new Uint8Array(total);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;

        function enqueue(index) {
          if (queued[index]) return;
          const offset = index * 4;
          if (!backgroundCandidate(data[offset], data[offset + 1], data[offset + 2])) return;
          queued[index] = 1;
          queue[tail++] = index;
        }

        for (let x = 0; x < width; x++) {
          enqueue(x);
          enqueue((height - 1) * width + x);
        }
        for (let y = 1; y < height - 1; y++) {
          enqueue(y * width);
          enqueue(y * width + width - 1);
        }
        while (head < tail) {
          const index = queue[head++];
          data[index * 4 + 3] = 0;
          const x = index % width;
          const y = Math.floor(index / width);
          if (x > 0) enqueue(index - 1);
          if (x + 1 < width) enqueue(index + 1);
          if (y > 0) enqueue(index - width);
          if (y + 1 < height) enqueue(index + width);
          if (x > 0 && y > 0) enqueue(index - width - 1);
          if (x + 1 < width && y > 0) enqueue(index - width + 1);
          if (x > 0 && y + 1 < height) enqueue(index + width - 1);
          if (x + 1 < width && y + 1 < height) enqueue(index + width + 1);
        }
      }

      function clearCellMargins(imageData) {
        const { data, width, height } = imageData;
        const marginX = Math.max(2, Math.round(width * 0.05));
        const marginY = Math.max(2, Math.round(height * 0.05));
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (x < marginX || x >= width - marginX || y < marginY || y >= height - marginY) {
              data[(y * width + x) * 4 + 3] = 0;
            }
          }
        }
      }

      function visibleBounds(imageData) {
        const { data, width, height } = imageData;
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] === 0) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
        return maxX < 0 ? null : {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
        };
      }

      function nearestPaletteColor(r, g, b) {
        let best = PALETTE[0];
        let bestDistance = Infinity;
        for (const color of PALETTE) {
          const dr = r - color[0];
          const dg = g - color[1];
          const db = b - color[2];
          const distance = dr * dr + dg * dg + db * db;
          if (distance < bestDistance) {
            best = color;
            bestDistance = distance;
          }
        }
        return best;
      }

      function applyPalette(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        for (let offset = 0; offset < imageData.data.length; offset += 4) {
          if (imageData.data[offset + 3] === 0) continue;
          const color = nearestPaletteColor(
            imageData.data[offset],
            imageData.data[offset + 1],
            imageData.data[offset + 2],
          );
          imageData.data[offset] = color[0];
          imageData.data[offset + 1] = color[1];
          imageData.data[offset + 2] = color[2];
          imageData.data[offset + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
      }

      function enforceBottomAnchor(stripCtx, stage) {
        const frameData = stripCtx.getImageData(stage * FRAME, 0, FRAME, FRAME);
        const bounds = visibleBounds(frameData);
        if (!bounds) return;
        const shift = FRAME - (bounds.y + bounds.height);
        if (shift <= 0) return;
        const frameCanvas = canvas(FRAME, FRAME);
        frameCanvas.getContext('2d').putImageData(frameData, 0, 0);
        stripCtx.clearRect(stage * FRAME, 0, FRAME, FRAME);
        stripCtx.drawImage(frameCanvas, stage * FRAME, shift);
      }

      function validateStrip(strip, crop) {
        const ctx = strip.getContext('2d');
        const imageData = ctx.getImageData(0, 0, strip.width, strip.height);
        const colors = new Set();
        let semiTransparent = 0;
        for (let offset = 0; offset < imageData.data.length; offset += 4) {
          const alpha = imageData.data[offset + 3];
          if (alpha > 0) colors.add([
            imageData.data[offset],
            imageData.data[offset + 1],
            imageData.data[offset + 2],
          ].join(','));
          if (alpha > 0 && alpha < 255) semiTransparent++;
        }

        const stages = [];
        for (let stage = 0; stage < STAGES; stage++) {
          const data = ctx.getImageData(stage * FRAME, 0, FRAME, FRAME);
          const bounds = visibleBounds(data);
          stages.push({
            stage,
            visible: Boolean(bounds),
            bottomAnchored: Boolean(bounds && bounds.y + bounds.height === FRAME),
            horizontallyPadded: Boolean(bounds && bounds.x > 0 && bounds.x + bounds.width < FRAME),
          });
        }
        const passed = strip.width === FRAME * STAGES &&
          strip.height === FRAME &&
          semiTransparent === 0 &&
          colors.size <= PALETTE.length &&
          stages.every(stage => stage.visible && stage.bottomAnchored && stage.horizontallyPadded);
        if (!passed) throw new Error(`${crop} validation failed: ${JSON.stringify({
          colors: colors.size,
          semiTransparent,
          stages,
        })}`);
        return { crop, colors: colors.size, stages };
      }

      const sourceImage = await loadImage(`data:image/png;base64,${sourceBase64}`);
      const clean = canvas(sourceImage.width, sourceImage.height);
      const cleanCtx = clean.getContext('2d', { willReadFrequently: true });
      cleanCtx.drawImage(sourceImage, 0, 0);
      const cleaned = cleanCtx.getImageData(0, 0, clean.width, clean.height);
      clearConnectedBackground(cleaned);
      cleanCtx.putImageData(cleaned, 0, 0);

      const outputs = [];
      const reports = [];
      const contact = canvas(FRAME * STAGES * 2, FRAME * crops.length * 2);
      const contactCtx = contact.getContext('2d');
      contactCtx.fillStyle = '#120f17';
      contactCtx.fillRect(0, 0, contact.width, contact.height);
      contactCtx.imageSmoothingEnabled = false;

      for (let cropIndex = 0; cropIndex < crops.length; cropIndex++) {
        const strip = canvas(FRAME * STAGES, FRAME);
        const stripCtx = strip.getContext('2d', { willReadFrequently: true });
        stripCtx.imageSmoothingEnabled = false;

        for (let stage = 0; stage < STAGES; stage++) {
          const left = Math.round(cropIndex * clean.width / crops.length);
          const right = Math.round((cropIndex + 1) * clean.width / crops.length);
          const top = Math.round(stage * clean.height / STAGES);
          const bottom = Math.round((stage + 1) * clean.height / STAGES);
          const cellData = cleanCtx.getImageData(left, top, right - left, bottom - top);
          clearCellMargins(cellData);
          const bounds = visibleBounds(cellData);
          if (!bounds) throw new Error(`${crops[cropIndex]} stage ${stage} is empty`);
          const limit = LIMITS[stage];
          const scale = Math.min(limit.width / bounds.width, limit.height / bounds.height);
          const width = Math.max(1, Math.round(bounds.width * scale));
          const height = Math.max(1, Math.round(bounds.height * scale));
          const destX = stage * FRAME + Math.floor((FRAME - width) / 2);
          const destY = FRAME - height;
          stripCtx.drawImage(
            clean,
            left + bounds.x,
            top + bounds.y,
            bounds.width,
            bounds.height,
            destX,
            destY,
            width,
            height,
          );
          enforceBottomAnchor(stripCtx, stage);
        }

        applyPalette(stripCtx, strip.width, strip.height);
        reports.push(validateStrip(strip, crops[cropIndex]));
        outputs.push({
          crop: crops[cropIndex],
          dataUrl: strip.toDataURL('image/png'),
        });
        contactCtx.drawImage(strip, 0, cropIndex * FRAME * 2, strip.width * 2, FRAME * 2);
      }

      return {
        source: { width: sourceImage.width, height: sourceImage.height },
        outputs,
        reports,
        contact: contact.toDataURL('image/png'),
      };
    }, {
      sourceBase64: source.toString('base64'),
      crops: CROPS,
    });

    for (const output of result.outputs) {
      await writeFile(
        `${OUTPUT_DIR}/crop-${output.crop}.png`,
        Buffer.from(output.dataUrl.split(',')[1], 'base64'),
      );
    }
    await writeFile(
      `${ARTIFACT_DIR}/crop-asset-lab-contact-sheet.png`,
      Buffer.from(result.contact.split(',')[1], 'base64'),
    );
    console.log(JSON.stringify({
      source: result.source,
      output: result.reports,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
