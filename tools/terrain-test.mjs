// Farm iso terrain gates: deterministic slicer, direct corner masks, four-cell
// vertex resolution, striping regression, render fallback, and save equivalence.
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
const maskMap = JSON.parse(await readFile('assets/iso/terrain/terrain-mask-map.json', 'utf8'));
const outputs = provenance.outputs || [];
check('map: schema uses direct corner-mask semantics',
  maskMap.schemaVersion === 2 &&
  maskMap.maskConvention.bit0.includes('bottom') &&
  maskMap.maskConvention.bit1.includes('left') &&
  maskMap.maskConvention.bit2.includes('right') &&
  maskMap.maskConvention.bit3.includes('top') &&
  maskMap.maskConvention.bitSetMeaning.includes('grass'));
check('map: vendor cells map directly 0..15 in gutter-aware order',
  maskMap.sourceGrid.length === 16 && maskMap.sourceGrid.every((entry, index) =>
    entry.mask === index && entry.sourceTile === `tile_${index}` &&
    entry.row === Math.floor(index / 4) && entry.column === index % 4));
check('map: no cardinal polarity conversion remains', !JSON.stringify(maskMap).includes('15 XOR'));
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
      var corners = isoTerrainCornerFamilies(centerRow, centerCol);
      return {
        mask: isoTerrainGrassCornerMask(corners),
        corners: corners.map(function (corner) { return corner.family; }),
        key: isoTerrainSpriteKey(centerRow, centerCol, family)
      };
    }
    var cases = {
      grassOpen: caseResult(GRASS, {}),
      grassNorthSoil: caseResult(GRASS, { north: SOIL }),
      grassEastSoil: caseResult(GRASS, { east: SOIL }),
      grassSouthSoil: caseResult(GRASS, { south: SOIL }),
      grassWestSoil: caseResult(GRASS, { west: SOIL }),
      mixedPriority: caseResult(GRASS, { north: SOIL, east: WATER }),
      soilBoundary: caseResult(SOIL, { west: GRASS })
    };
    var boundaryMap = makeGrid();
    var boundaryColumn = 12;
    for (var boundaryRow = 0; boundaryRow < MAP_H; boundaryRow++) {
      for (var boundaryCol = boundaryColumn; boundaryCol < MAP_W; boundaryCol++) boundaryMap[boundaryRow][boundaryCol] = SOIL;
    }
    map = boundaryMap;
    var currentBoundarySamples = [];
    for (var sampleCol = boundaryColumn - 1; sampleCol < boundaryColumn + 3; sampleCol++) {
      var sampleFamily = isoTerrainFamily(map[10][sampleCol]);
      var sampleKey = isoTerrainSpriteKey(10, sampleCol, sampleFamily);
      currentBoundarySamples.push({ family: sampleFamily, key: sampleKey, mask: sampleKey.match(/_(\d\d)$/) ? Number(sampleKey.slice(-2)) : null });
    }
    var boundaryCornerMap = makeGrid();
    boundaryCornerMap[0][0] = SOIL;
    map = boundaryCornerMap;
    var boundaryVertex = isoTerrainVertexFamily(0, 0);
    var fullyOutsideVertex = isoTerrainVertexFamily(-1, -1);
    map = originalMap;
    // Reproduce the pre-fix terrain-mask-map selection only as a RED baseline.
    // The production renderer below must never call this cardinal/XOR path.
    function legacyNeighbourFamily(row, col, centerFamily) {
      if (row < 0 || row >= MAP_H || col < 0 || col >= MAP_W) return centerFamily;
      return isoTerrainFamily(map[row][col]) || centerFamily;
    }
    function legacySameMask(row, col, centerFamily) {
      var mask = 0;
      if (legacyNeighbourFamily(row - 1, col, centerFamily) === centerFamily) mask |= 1;
      if (legacyNeighbourFamily(row, col + 1, centerFamily) === centerFamily) mask |= 2;
      if (legacyNeighbourFamily(row + 1, col, centerFamily) === centerFamily) mask |= 4;
      if (legacyNeighbourFamily(row, col - 1, centerFamily) === centerFamily) mask |= 8;
      return mask;
    }
    function legacyKey(row, col, centerFamily) {
      var sameMask = legacySameMask(row, col, centerFamily);
      if (centerFamily === 'grass') return 'iso_terrain_soil_' + String(sameMask).padStart(2, '0');
      return 'iso_terrain_' + centerFamily + '_' + String(15 ^ sameMask).padStart(2, '0');
    }
    map = boundaryMap;
    var legacyBoundaryKey = legacyKey(10, boundaryColumn, 'soil');
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
      boundarySamples: currentBoundarySamples,
      legacyBoundaryKey: legacyBoundaryKey,
      boundaryVertex: boundaryVertex,
      fullyOutsideVertex: fullyOutsideVertex,
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
  check('mask: open grass uses soil-derived base', result.cases.grassOpen.mask === 15 && result.cases.grassOpen.key === 'iso_terrain_grass_base_soil');
  check('mask: north secondary resolves direct grass mask 03', result.cases.grassNorthSoil.mask === 3 && result.cases.grassNorthSoil.key === 'iso_terrain_soil_03');
  check('mask: east secondary resolves direct grass mask 10', result.cases.grassEastSoil.mask === 10 && result.cases.grassEastSoil.key === 'iso_terrain_soil_10');
  check('mask: south secondary resolves direct grass mask 12', result.cases.grassSouthSoil.mask === 12 && result.cases.grassSouthSoil.key === 'iso_terrain_soil_12');
  check('mask: west secondary resolves direct grass mask 05', result.cases.grassWestSoil.mask === 5 && result.cases.grassWestSoil.key === 'iso_terrain_soil_05');
  check('vertex: four-cell mixed priority chooses water', result.cases.mixedPriority.corners.join(',') === 'water,grass,water,soil' && result.cases.mixedPriority.mask === 2 && result.cases.mixedPriority.key === 'iso_terrain_water_02');
  check('mask: non-grass center uses full-secondary mask 00', result.cases.soilBoundary.mask === 0 && result.cases.soilBoundary.key === 'iso_terrain_soil_00');
  check('vertex: map boundary ignores out-of-bounds cells', result.boundaryVertex === 'soil' && result.fullyOutsideVertex === 'grass');
  check('striping: pre-fix XOR polarity is RED', result.legacyBoundaryKey === 'iso_terrain_soil_08');
  check('striping: fixed straight boundary is GREEN',
    result.boundarySamples.map((sample) => sample.family).join('|') === 'grass|soil|soil|soil' &&
    result.boundarySamples.slice(1).every((sample) => sample.mask === 0));
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
