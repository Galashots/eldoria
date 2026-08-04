// Deterministic visual proofs for the flattened Farm terrain derivatives.
// The proofs draw the same native 64x32 flat diamonds and 64x48 transparent overlays
// used by the renderer, without upscaling or smoothing.
import { mkdir } from 'node:fs/promises';
import { launch } from './smoke-test.mjs';

const outDir = 'docs/playtest/step8-farm-terrain';
await mkdir(outDir, { recursive: true });

const { browser, page } = await launch('?iso=1');
try {
  await page.waitForFunction(() => window.isoTerrainPreloadSettled === true, { timeout: 10000 });

  async function renderProof(kind, path) {
    const viewport = kind === 'open' ? { width: 512, height: 288, deviceScaleFactor: 1 }
      : { width: 640, height: 400, deviceScaleFactor: 1 };
    await page.setViewport(viewport);
    await page.evaluate((proofKind) => {
      document.body.innerHTML = '';
      document.body.style.margin = '0';
      document.body.style.background = '#101820';
      const canvas = document.createElement('canvas');
      canvas.width = proofKind === 'open' ? 512 : 640;
      canvas.height = proofKind === 'open' ? 288 : 400;
      canvas.style.display = 'block';
      document.body.appendChild(canvas);
      const proof = canvas.getContext('2d');
      proof.imageSmoothingEnabled = false;
      proof.fillStyle = '#101820';
      proof.fillRect(0, 0, canvas.width, canvas.height);
      proof.fillStyle = '#f2d28b';
      proof.font = 'bold 12px monospace';
      proof.fillText(proofKind === 'open' ? 'OPEN GRASS 8x8 — native 1:1 overlay tiling' : 'MIXED FARM TOPOLOGY — native 1:1 overlay composition', 8, 15);

      const tileForFamily = { grass: GRASS, path: PATH, soil: SOIL, water: WATER };
      const colorForFamily = (family) => TILE_COLOR[tileForFamily[family]] || '#333333';
      const center = (row, column, originX, originY) => ({
        x: originX + (column - row) * 32,
        y: originY + (column + row) * 16
      });
      const drawDiamond = (x, y, color) => {
        proof.beginPath();
        proof.moveTo(x, y - 16);
        proof.lineTo(x + 32, y);
        proof.lineTo(x, y + 16);
        proof.lineTo(x - 32, y);
        proof.closePath();
        proof.fillStyle = color;
        proof.fill();
      };
      const drawCell = (row, column, family, key, originX, originY) => {
        const point = center(row, column, originX, originY);
        drawDiamond(point.x, point.y, colorForFamily(family));
        const image = spr(key);
        if (image) proof.drawImage(image, point.x - 32, point.y - 16);
      };

      if (proofKind === 'open') {
        const baseFamilies = ['path', 'soil', 'water'];
        for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
          const baseFamily = baseFamilies[(row * 31 + column * 17) % baseFamilies.length];
          drawCell(row, column, 'grass', 'iso_terrain_grass_base_' + baseFamily, 256, 48);
        }
      } else {
        const pattern = [
          'gggpppssswww',
          'gggpppssswww',
          'gggpppssswww',
          'gggpppssswww',
          'ggpppssswwwg',
          'gpppssswwwgg',
          'pppssswwwggg',
          'ppsswwggggpp'
        ];
        const symbols = { g: 'grass', p: 'path', s: 'soil', w: 'water' };
        const tiles = { g: GRASS, p: PATH, s: SOIL, w: WATER };
        const baseRow = 6, baseColumn = 9;
        const topology = [];
        for (let row = 0; row < MAP_H; row++) topology.push(new Array(MAP_W).fill(GRASS));
        for (let row = 0; row < pattern.length; row++) for (let column = 0; column < pattern[row].length; column++) {
          topology[baseRow + row][baseColumn + column] = tiles[pattern[row][column]];
        }
        const originalMap = map;
        map = topology;
        for (let row = 0; row < pattern.length; row++) for (let column = 0; column < pattern[row].length; column++) {
          const symbol = pattern[row][column];
          const family = symbols[symbol];
          const absoluteRow = baseRow + row;
          const absoluteColumn = baseColumn + column;
          drawCell(row, column, family, isoTerrainSpriteKey(absoluteRow, absoluteColumn, family), 256, 48);
        }
        map = originalMap;
        proof.font = '10px monospace';
        proof.fillStyle = '#f2d28b';
        proof.fillText('grass', 8, 382);
        proof.fillText('path', 72, 382);
        proof.fillText('soil', 128, 382);
        proof.fillText('water', 184, 382);
        for (const [x, family] of [[42, 'grass'], [106, 'path'], [162, 'soil'], [226, 'water']]) {
          proof.fillStyle = colorForFamily(family);
          proof.fillRect(x, 374, 8, 8);
        }
      }
    }, kind);
    await page.screenshot({ path });
  }

  await renderProof('open', `${outDir}/open-grass-8x8-proof.png`);
  await renderProof('mixed', `${outDir}/mixed-topology-proof.png`);
} finally {
  await browser.close();
}
console.log('Wrote open-grass-8x8-proof.png and mixed-topology-proof.png');
