// Farm iso terrain gates: deterministic slicer, explicit masks, render fallback,
// adjacency coverage, preload settlement, and render-only save equivalence.
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { launch } from './smoke-test.mjs';

const fails = [];
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ` — ${detail}` : ''));
  if (!ok) fails.push(name);
};

const slicer = spawnSync('python', ['tools/pipeline/slice_tileset.py', '--self-test'], {
  encoding: 'utf8',
  cwd: process.cwd(),
});
check('slicer: self-test exits cleanly', slicer.status === 0, slicer.stderr.trim());
if (slicer.status === 0) check('slicer: reports byte-stable crop proof', slicer.stdout.includes('bytes are stable'));

const pngDimensions = (buf) => ({
  width: buf.readUInt32BE(16),
  height: buf.readUInt32BE(20),
});
const provenance = JSON.parse(await readFile('assets/iso/terrain/terrain-provenance.json', 'utf8'));
const outputs = provenance.outputs || [];
check('assets: provenance enumerates 51 derived files', outputs.length === 51);
check('assets: every derived file is 64x48', outputs.every((asset) => asset.dimensions.width === 64 && asset.dimensions.height === 48));
check('assets: transition coverage is exactly 16x3',
  ['path', 'soil', 'water'].every((family) => outputs.filter((asset) => asset.runtimeKey.startsWith(`iso_terrain_${family}_`)).length === 16));
for (const asset of outputs) {
  const buf = await readFile(asset.path);
  const dims = pngDimensions(buf);
  check(`asset: ${asset.path} has exact dimensions`, dims.width === 64 && dims.height === 48);
}

const browserErrors = [];
const { browser, page } = await launch('?iso=1');
page.on('pageerror', (error) => browserErrors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
try {
  await page.waitForFunction(() => window.isoTerrainPreloadSettled === true, { timeout: 10000 });
  const result = await page.evaluate(() => {
    selectProfile('adventurer');
    activateArea('farm');
    applyCanvasMode();
    var originalMap = map;
    var centerRow = 10, centerCol = 10;
    function makeGrid() {
      var next = [];
      for (var r = 0; r < MAP_H; r++) next.push(new Array(MAP_W).fill(GRASS));
      return next;
    }
    function caseResult(center, neighbours) {
      map = makeGrid();
      map[centerRow][centerCol] = center;
      if (neighbours.north !== undefined) map[centerRow - 1][centerCol] = neighbours.north;
      if (neighbours.east !== undefined) map[centerRow][centerCol + 1] = neighbours.east;
      if (neighbours.south !== undefined) map[centerRow + 1][centerCol] = neighbours.south;
      if (neighbours.west !== undefined) map[centerRow][centerCol - 1] = neighbours.west;
      var family = isoTerrainFamily(center);
      return { mask: isoTerrainSameMask(centerRow, centerCol, family), key: isoTerrainSpriteKey(centerRow, centerCol, family) };
    }
    var cases = {
      isolated: caseResult(SOIL, {}),
      edge: caseResult(SOIL, { north: SOIL }),
      innerCorner: caseResult(SOIL, { north: SOIL, east: SOIL }),
      outerCorner: caseResult(SOIL, { north: SOIL, west: SOIL }),
      fullSurround: caseResult(SOIL, { north: SOIL, east: SOIL, south: SOIL, west: SOIL })
    };
    map = originalMap;
    isoTerrainAreaActivated('farm');
    function flattenedOverlayGeometry() {
      var probe = document.createElement('canvas');
      probe.width = 64; probe.height = 48;
      var probeCtx = probe.getContext('2d');
      function bounds(row) {
        if (row < 16) return [31 - 2 * row, 32 + 2 * row];
        var distance = row - 16;
        return [2 * distance, 63 - 2 * distance];
      }
      for (var familyIndex = 0; familyIndex < ISO_TERRAIN_FAMILIES.length; familyIndex++) {
        var family = ISO_TERRAIN_FAMILIES[familyIndex];
        for (var mask = 0; mask < 16; mask++) {
          var transition = spr('iso_terrain_' + family + '_' + String(mask).padStart(2, '0'));
          probeCtx.clearRect(0, 0, 64, 48);
          probeCtx.drawImage(transition, 0, 0);
          var pixels = probeCtx.getImageData(0, 0, 64, 48).data;
          var opaque = 0;
          for (var row = 0; row < 48; row++) for (var column = 0; column < 64; column++) {
            var alpha = pixels[(row * 64 + column) * 4 + 3];
            if (!alpha) continue;
            opaque++;
            var outer = row < 32 ? bounds(row) : [1, 0];
            if (row >= 32 || column < outer[0] + 2 || column > outer[1] - 2) return false;
          }
          if (!opaque) return false;
        }
        var base = spr('iso_terrain_grass_base_' + family);
        probeCtx.clearRect(0, 0, 64, 48);
        probeCtx.drawImage(base, 0, 0);
        var basePixels = probeCtx.getImageData(0, 0, 64, 48).data;
        var baseOpaque = 0;
        for (var baseRow = 0; baseRow < 48; baseRow++) for (var baseColumn = 0; baseColumn < 64; baseColumn++) {
          var baseAlpha = basePixels[(baseRow * 64 + baseColumn) * 4 + 3];
          if (!baseAlpha) continue;
          baseOpaque++;
          var baseOuter = baseRow < 32 ? bounds(baseRow) : [1, 0];
          if (baseRow >= 32 || baseColumn < baseOuter[0] + 2 || baseColumn > baseOuter[1] - 2) return false;
        }
        if (!baseOpaque) return false;
      }
      return true;
    }
    var pairs = {};
    for (var r = 0; r < MAP_H; r++) for (var c = 0; c < MAP_W; c++) {
      var family = isoTerrainFamily(map[r][c]);
      if (c + 1 < MAP_W) {
        var east = isoTerrainFamily(map[r][c + 1]);
        if (family !== east) pairs[[family, east].sort().join('|')] = true;
      }
      if (r + 1 < MAP_H) {
        var south = isoTerrainFamily(map[r + 1][c]);
        if (family !== south) pairs[[family, south].sort().join('|')] = true;
      }
    }
    var savedBefore = null;
    var savedAfter = null;
    player.x = 10 * TILE; player.y = 10 * TILE;
    saveGame();
    savedBefore = localStorage.getItem('eldoria_save_adventurer');
    drawIsoWorld();
    saveGame();
    savedAfter = localStorage.getItem('eldoria_save_adventurer');

    var missing = isoTerrainRecords.filter(function (record) { return record.spriteKey; })[0];
    var missingBackup = SPRITES[missing.spriteKey];
    delete SPRITES[missing.spriteKey];
    var fallbackNoThrow = true;
    try { drawIsoWorld(); } catch (error) { fallbackNoThrow = false; }
    SPRITES[missing.spriteKey] = missingBackup;
    drawIsoWorld();
    return {
      preloadSettled: isoTerrainPreloadSettled,
      allDecoded: isoTerrainAllDecoded,
      records: isoTerrainRecords.length,
      nonNullRecords: isoTerrainRecords.filter(function (record) { return record.spriteKey; }).length,
      flattenedOverlayGeometry: flattenedOverlayGeometry(),
      cases: cases,
      pairs: Object.keys(pairs).sort(),
      fallbackNoThrow: fallbackNoThrow,
      saveEquivalent: savedBefore === savedAfter,
      canvasPainted: (function () {
        var d = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
        return d[0] + d[1] + d[2] > 30;
      })()
    };
  });
  check('preload: all terrain requests settle before Farm render', result.preloadSettled);
  check('preload: all 51 terrain images decode', result.allDecoded);
  check('assets: every terrain derivative is an inset transparent overlay', result.flattenedOverlayGeometry);
  check('activation: one precomputed record per Farm cell', result.records === 30 * 22 && result.nonNullRecords === result.records,
    `records=${result.records} nonNull=${result.nonNullRecords}`);
  check('mask: isolated case selects soil-15', result.cases.isolated.mask === 0 && result.cases.isolated.key === 'iso_terrain_soil_15');
  check('mask: edge case selects soil-14', result.cases.edge.mask === 1 && result.cases.edge.key === 'iso_terrain_soil_14');
  check('mask: inner-corner case selects soil-12', result.cases.innerCorner.mask === 3 && result.cases.innerCorner.key === 'iso_terrain_soil_12');
  check('mask: outer-corner case selects soil-06', result.cases.outerCorner.mask === 9 && result.cases.outerCorner.key === 'iso_terrain_soil_06');
  check('mask: full-surround case selects soil-00', result.cases.fullSurround.mask === 15 && result.cases.fullSurround.key === 'iso_terrain_soil_00');
  check('adjacency: current Farm pair scan is covered', JSON.stringify(result.pairs) === JSON.stringify(['grass|path', 'grass|soil', 'grass|water', 'path|soil']));
  check('fallback: missing terrain sprite keeps Farm render alive', result.fallbackNoThrow);
  check('render-only: save v4 is byte-equivalent before/after draw', result.saveEquivalent);
  check('render: Farm canvas is painted', result.canvasPainted);
} catch (error) {
  check('browser: Farm terrain boot and assertions', false, error.message);
} finally {
  await browser.close();
}
check('browser: zero Farm boot/runtime console errors', browserErrors.length === 0, browserErrors.join(' | '));

if (fails.length) {
  console.error(`\n${fails.length} terrain gate(s) failed.`);
  process.exit(1);
}
console.log('\nAll Farm iso terrain gates passed.');
