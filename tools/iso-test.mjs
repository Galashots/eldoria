// Iso engine assertions, evaluated inside the live page. Run: node tools/iso-test.mjs
import { launch } from './smoke-test.mjs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails.push(name); };

// --- Suite 1: pure math ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    var out = { roundTrip: true, up: null, right: null, depth: null };
    // Round-trip world -> projected -> world over a coordinate sweep
    for (var px = 0; px <= 960; px += 96) for (var py = 0; py <= 704; py += 88) {
      var sx = isoPX(px, py), sy = isoPY(px, py);
      if (Math.abs(isoInvX(sx, sy) - px) > 1e-9 || Math.abs(isoInvY(sx, sy) - py) > 1e-9)
        out.roundTrip = false;
    }
    // Screen-relative input identities (spec section 6 sanity checks)
    out.up    = [isoInputX(0, -1), isoInputY(0, -1)];   // expect [-1, -1]
    out.right = [isoInputX(1, 0),  isoInputY(1, 0)];    // expect [0.5, -0.5]
    // Depth: nearer (larger px+py) sorts later
    out.depth = isoDepthKey(64, 64) > isoDepthKey(32, 32);
    return out;
  });
  check('math: projection round-trips', r.roundTrip === true);
  check('math: push-up maps to world NW', r.up[0] === -1 && r.up[1] === -1);
  check('math: push-right maps to world SE-ish', r.right[0] === 0.5 && r.right[1] === -0.5);
  check('math: depth key increases toward viewer', r.depth === true);
  await browser.close();
}

// --- Suite 2: flag plumbing (Phase 1: farm defaults ON, other areas still top-down) ---
{
  const { browser, page } = await launch('?iso=1');
  const r = await page.evaluate(() => {
    var on = isoActive();
    localStorage.removeItem('eldoria_iso');
    var farmDefault = isoActive();           // currentArea is 'farm' at boot
    currentArea = 'town';
    var townDefault = isoActive();           // town not ported yet
    currentArea = 'farm';
    return { on: on, farmDefault: farmDefault, townDefault: townDefault };
  });
  check('flag: ?iso=1 turns iso on', r.on === true);
  check('flag: farm defaults to iso (Phase 1)', r.farmDefault === true);
  check('flag: unported areas default to top-down', r.townDefault === false);
  await browser.close();
}

// --- Suite 2b: escape hatch — ?iso=0 must force top-down even where iso is the default ---
{
  const { browser, page } = await launch('?iso=0');
  const r = await page.evaluate(() => {
    return { off: isoActive(), stored: localStorage.getItem('eldoria_iso') };
  });
  check('flag: ?iso=0 forces top-down on farm', r.off === false);
  check('flag: ?iso=0 persists the opt-out', r.stored === '0');
  await browser.close();
}

// --- Suite 3: responsive canvas ---
{
  const { browser, page } = await launch('?iso=1');
  await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 3 });
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    applyCanvasMode();
    var rect = canvas.getBoundingClientRect();
    return { w: canvas.width, cssW: rect.width, scale: isoScale,
             expectW: Math.round(rect.width * 2) };  // DPR capped at 2, not 3
  });
  check('canvas: backing store = css width x capped DPR', r.w === r.expectW);
  check('canvas: isoScale set and positive', r.scale > 0);
  await browser.close();
}

// --- Suite 4: iso ground renders ---
{
  const { browser, page } = await launch('?iso=1');
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    applyCanvasMode();
    drawIsoWorld();
    // Sample the canvas center: must not be the untouched black background.
    var d = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  });
  check('ground: canvas center is painted (not black)', (r.r + r.g + r.b) > 30);
  await browser.close();
}

// --- Suite 5: depth-sorted objects ---
{
  const { browser, page } = await launch('?iso=1');
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    applyCanvasMode();
    window.__isoDebug = true;
    // Stand the hero mid-map between the farm's border trees.
    player.x = 8 * 32; player.y = 5 * 32;
    drawIsoWorld();
    var order = window.__isoDrawOrder;
    var playerIdx = order.indexOf('player');
    // A border tree NORTH of the hero (row 0) must draw before them,
    // a border tree SOUTH (row 21) after them.
    var north = order.indexOf('tree@0,8'), south = order.indexOf('tree@21,8');
    return { playerIdx: playerIdx, north: north, south: south, n: order.length };
  });
  check('objects: some objects collected', r.n > 10);
  check('objects: north tree draws before player', r.north !== -1 && r.north < r.playerIdx);
  check('objects: south tree draws after player', r.south !== -1 && r.south > r.playerIdx);
  await browser.close();
}

// --- Suite 6: screen-relative movement ---
{
  const { browser, page } = await launch('?iso=1');
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    player.x = 10 * 32; player.y = 10 * 32;   // open grass, no collisions
    var sy0 = isoPY(player.x, player.y);
    var sx0 = isoPX(player.x, player.y);
    __isoTestMove(0, -1, 30);                  // push straight up for 30 frames
    var sy1 = isoPY(player.x, player.y);
    var sx1 = isoPX(player.x, player.y);
    return { rose: sy1 < sy0, drift: Math.abs(sx1 - sx0) };
  });
  check('input: pushing up moves hero up-screen', r.rose === true);
  check('input: no sideways drift on pure-up', r.drift < 1);
  await browser.close();
}

// --- Suite 7: gameplay is mode-independent (the sacred-world proof) ---
{
  const { browser, page } = await launch('?iso=1');
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    // Stand on farm soil (soil block: cols 14-18, rows 3-7) and plant a turnip directly
    // through the same logic path the Action button uses.
    player.x = 14 * 32; player.y = 4 * 32;
    var key = '4,14';
    plantSeed(key, cropData[key], 'turnip');
    var planted = cropData[key].status === 'growing';
    saveGame();
    localStorage.setItem('eldoria_iso', '0');          // flip to top-down
    var saved = JSON.parse(localStorage.getItem('eldoria_save_adventurer'));
    var savedTile = saved.areas.farm.tiles[key];
    return { planted: planted, savedGrowing: savedTile && savedTile.status === 'growing',
             savedType: savedTile && savedTile.type };
  });
  check('gameplay: planting works in iso mode', r.planted === true);
  check('save: iso-planted crop persists in the schema', r.savedGrowing === true);
  check('save: crop type recorded', r.savedType === 'turnip');
  await browser.close();
}

// --- Suite 8: direct taps share Action's gameplay paths ---
{
  const { browser, page } = await launch('?iso=1');
  const r = await page.evaluate(() => {
    selectProfile('adventurer');

    // Iso crop: stand beside one exact plot and interact with that tapped tile.
    activateArea('farm');
    var cropKey = '4,14';
    cropData[cropKey] = { status: 'empty', plantedAt: 0, type: null };
    player.x = 13 * TILE; player.y = 4 * TILE;
    var cropHandled = interactAtTile(4, 14);
    var cropPlanted = cropData[cropKey].status === 'growing';

    // A distant plot is recognized but cannot bypass navigation.
    var farKey = '3,18';
    cropData[farKey] = { status: 'empty', plantedAt: 0, type: null };
    var farHandled = interactAtTile(3, 18);
    var farStayedEmpty = cropData[farKey].status === 'empty';

    // Top-down NPC: tapping Bram while adjacent opens the same shop path as Action.
    localStorage.setItem('eldoria_iso', '0');
    activateArea('town');
    var bram = NPCS.filter(n => n.id === 'bram')[0];
    player.x = (bram.col - 1) * TILE; player.y = bram.row * TILE;
    var npcHandled = interactAtTile(bram.row, bram.col);
    var npcOpenedShop = shopOpen;
    closeShop();

    // Top-down enemy: tapping an adjacent live enemy starts normal combat.
    activateArea('wilds');
    var enemy = currentEnemies[0];
    enemy.alive = true;
    player.x = (enemy.col - 1) * TILE; player.y = enemy.row * TILE;
    var enemyHandled = interactAtTile(enemy.row, enemy.col);
    var enemyOpenedCombat = combatOpen;

    return { cropHandled, cropPlanted, farHandled, farStayedEmpty,
             npcHandled, npcOpenedShop, enemyHandled, enemyOpenedCombat };
  });
  check('tap: exact iso crop uses normal plant path', r.cropHandled && r.cropPlanted);
  check('tap: distant crop asks for approach without planting', r.farHandled && r.farStayedEmpty);
  check('tap: adjacent NPC uses normal interaction path', r.npcHandled && r.npcOpenedShop);
  check('tap: adjacent enemy uses normal combat path', r.enemyHandled && r.enemyOpenedCombat);
  await browser.close();
}

// --- Suite 9: direct-tap coordinate conversion in both render modes ---
{
  const { browser, page } = await launch('?iso=1');
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    activateArea('farm');
    applyCanvasMode();
    player.x = 14 * TILE; player.y = 4 * TILE;
    drawIsoWorld();
    var wx = (14 + 0.5) * TILE, wy = (4 + 0.5) * TILE;
    var bx = (isoPX(wx, wy) - isoCamPX) * isoScale;
    var by = (isoPY(wx, wy) - isoCamPY) * isoScale;
    var isoTile = canvasBackingPointToTile(bx, by);
    var tapKey = '4,15';
    cropData[tapKey] = { status: 'empty', plantedAt: 0, type: null };
    var tapWx = 15.5 * TILE, tapWy = 4.5 * TILE;
    var tapBx = (isoPX(tapWx, tapWy) - isoCamPX) * isoScale;
    var tapBy = (isoPY(tapWx, tapWy) - isoCamPY) * isoScale;
    var rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: rect.left + tapBx * rect.width / canvas.width,
      clientY: rect.top + tapBy * rect.height / canvas.height,
      bubbles: true,
      pointerId: 91
    }));
    var pointerPlanted = cropData[tapKey].status === 'growing';

    localStorage.setItem('eldoria_iso', '0');
    activateArea('town');
    player.x = 7 * TILE; player.y = 7 * TILE;
    var cam = topDownCamera();
    var topTile = canvasBackingPointToTile(7.5 * TILE - cam.x, 7.5 * TILE - cam.y);
    return { isoTile, pointerPlanted, topTile };
  });
  check('tap math: iso screen point resolves exact world tile',
    r.isoTile.row === 4 && r.isoTile.col === 14);
  check('tap event: canvas pointer plants the exact adjacent crop', r.pointerPlanted);
  check('tap math: top-down screen point resolves exact world tile',
    r.topTile.row === 7 && r.topTile.col === 7);
  await browser.close();
}

// --- Suite 10: travel honors enemy respawn timers (dumpling-economy pre-req) ---
{
  const { browser, page } = await launch('?iso=0');
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    activateArea('wilds');
    var enemy = currentEnemies[0];
    enemy.alive = false;
    enemy.respawnAt = Date.now() + 30000;

    // Leave for Town, then immediately re-enter the Wilds.
    activateArea('town');
    player.x = (MAP_W - 1) * TILE;
    player.y = 10 * TILE;
    checkTravel();
    var stayedDead = enemy.alive === false;

    // The existing timer path still revives it once the delay has elapsed.
    enemy.respawnAt = Date.now() - 1;
    update();
    return { stayedDead, revivedOnTimer: enemy.alive === true };
  });
  check('economy: re-entry does not instantly revive enemies', r.stayedDead === true);
  check('economy: elapsed respawn timer still revives enemies', r.revivedOnTimer === true);
  await browser.close();
}

// --- Suite 11: crop proof has three deterministic visual stages ---
{
  const { browser, page } = await launch('?iso=1');
  const r = await page.evaluate(() => {
    var now = Date.now();
    return {
      early: cropVisualStage({ status: 'growing', plantedAt: now - 100, type: 'turnip' }, now),
      middle: cropVisualStage({ status: 'growing', plantedAt: now - 6000, type: 'turnip' }, now),
      ready: cropVisualStage({ status: 'ready', plantedAt: now - 9000, type: 'turnip' }, now)
    };
  });
  check('crop visuals: early seedling stage', r.early === 0);
  check('crop visuals: established growing stage', r.middle === 1);
  check('crop visuals: ready produce stage', r.ready === 2);
  await browser.close();
}

// --- Visual evidence: exact PR render at desktop and phone portrait sizes ---
{
  const evidenceDir = new URL('../artifacts/', import.meta.url);
  await mkdir(evidenceDir, { recursive: true });
  const viewports = [
    { name: 'desktop', width: 1363, height: 936 },
    { name: 'phone-portrait', width: 390, height: 780 }
  ];
  for (const viewport of viewports) {
    const { browser, page } = await launch('?iso=1');
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 2 });
    await page.evaluate(() => {
      selectProfile('adventurer');
      activateArea('farm');
      applyCanvasMode();
      var now = Date.now();
      for (var r = 3; r <= 7; r++) {
        for (var c = 14; c <= 18; c++) {
          cropData[r + ',' + c] = { status: 'empty', plantedAt: 0, type: null };
        }
      }
      cropData['4,14'] = { status: 'growing', plantedAt: now - 100, type: 'turnip' };
      cropData['4,15'] = { status: 'growing', plantedAt: now - 10000, type: 'carrot' };
      cropData['4,16'] = { status: 'ready', plantedAt: now - 25000, type: 'corn' };
      cropData['4,17'] = { status: 'ready', plantedAt: now - 35000, type: 'pumpkin' };
      cropData['4,18'] = { status: 'ready', plantedAt: now - 50000, type: 'starfruit' };
      player.x = 16 * TILE;
      player.y = 5 * TILE;
      drawIsoWorld();
    });
    await page.screenshot({
      path: fileURLToPath(new URL('phase15-crops-' + viewport.name + '.png', evidenceDir)),
      fullPage: true
    });
    await browser.close();
  }
  check('visual evidence: desktop and phone crop frames captured', true);
}

// --- Suite 12: owner-approved farming-to-dumpling economy preset ---
{
  const { browser, page } = await launch('?iso=1');
  const r = await page.evaluate(() => {
    var costs = CROP_TYPES.map(type => CROPS[type].cost);
    var sells = CROP_TYPES.map(type => CROPS[type].sell);
    var fullFarmProfit = CROP_TYPES.map(type => 25 * (CROPS[type].sell - CROPS[type].cost));
    return { costs, sells, fullFarmProfit };
  });
  check('economy: seed costs stay unchanged',
    JSON.stringify(r.costs) === JSON.stringify([2, 4, 6, 8, 15]));
  check('economy: approved crop sale values are locked',
    JSON.stringify(r.sells) === JSON.stringify([3, 5, 7, 9, 17]));
  check('economy: ordinary full harvests net 25 gold',
    r.fullFarmProfit.slice(0, 4).every(value => value === 25));
  check('economy: full starfruit harvest nets 50 gold',
    r.fullFarmProfit[4] === 50);
  await browser.close();
}

// --- Suite 13: Squishy Dumpling pull-loop MVP ---
{
  const { browser, page } = await launch('?iso=0');
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    activateArea('town');

    var rarityCounts = {};
    for (var i = 0; i < DUMPLINGS.length; i++) {
      rarityCounts[DUMPLINGS[i].rarity] = (rarityCounts[DUMPLINGS[i].rarity] || 0) + 1;
    }

    var vendor = NPCS.filter(npc => npc.role === 'dumplings')[0];
    player.x = (vendor.col - 1) * TILE;
    player.y = vendor.row * TILE;
    var vendorTapHandled = interactAtTile(vendor.row, vendor.col);
    var vendorOpened = dumplingOpen;

    player.gold = 19;
    var insufficientRejected = buyDumplingBundle(1) === false &&
      player.gold === 19 && dumplingCollectionCount() === 0;

    var originalRandom = Math.random;
    player.gold = 100;
    var firstRolls = [0, 0];
    Math.random = () => firstRolls.shift() || 0;
    var firstBought = buyDumplingBundle(1);
    var firstPull = {
      gold: player.gold,
      plain: player.dumplings.plain_bun,
      pity: player.pullsSinceLegendary
    };

    Math.random = () => 0;
    var duplicateBought = buyDumplingBundle(1);
    var duplicatePull = {
      gold: player.gold,
      plain: player.dumplings.plain_bun,
      dough: player.dumplingDough,
      pity: player.pullsSinceLegendary
    };

    player.pullsSinceLegendary = 14;
    var pityBought = buyDumplingBundle(1);
    var pityPull = {
      golden: player.dumplings.golden_dumpling,
      pity: player.pullsSinceLegendary
    };

    var saved = JSON.parse(localStorage.getItem('eldoria_save_adventurer'));
    player.dumplings = {};
    player.dumplingDough = 0;
    player.pullsSinceLegendary = 0;
    applyState(saved);
    var persisted = {
      plain: player.dumplings.plain_bun,
      golden: player.dumplings.golden_dumpling,
      dough: player.dumplingDough,
      pity: player.pullsSinceLegendary
    };

    player.gold = 200;
    player.dumplings = {};
    player.dumplingDough = 0;
    player.pullsSinceLegendary = 13;
    selectedDumplingId = null;
    Math.random = () => 0;
    var bundleBought = buyDumplingBundle(3);
    var bundle = {
      gold: player.gold,
      plain: player.dumplings.plain_bun,
      golden: player.dumplings.golden_dumpling,
      dough: player.dumplingDough,
      pity: player.pullsSinceLegendary,
      owned: dumplingCollectionCount()
    };
    Math.random = originalRandom;

    var shopCopy = document.getElementById('shopModal').textContent;
    closeDumplingVendor();
    return {
      catalogSize: DUMPLINGS.length,
      rarityCounts,
      pricing: DUMPLING_BUNDLES,
      refund: DUMPLING_DUPLICATE_REFUND,
      vendorTapHandled,
      vendorOpened,
      insufficientRejected,
      firstBought,
      firstPull,
      duplicateBought,
      duplicatePull,
      pityBought,
      pityPull,
      persisted,
      bundleBought,
      bundle,
      shopCopy,
      modalClosed: !dumplingOpen
    };
  });

  check('dumplings: catalog has the approved 6/5/4/3 rarity split',
    r.catalogSize === 18 &&
    r.rarityCounts.common === 6 && r.rarityCounts.rare === 5 &&
    r.rarityCounts.epic === 4 && r.rarityCounts.legendary === 3);
  check('dumplings: approved bundle prices and duplicate refund are locked',
    r.pricing['1'] === 20 && r.pricing['3'] === 50 && r.pricing['10'] === 150 && r.refund === 4);
  check('dumplings: direct vendor tap opens the collection modal',
    r.vendorTapHandled && r.vendorOpened);
  check('dumplings: insufficient gold cannot buy a pull', r.insufficientRejected);
  check('dumplings: first pull charges 20g and adds the deterministic common',
    r.firstBought && r.firstPull.gold === 80 && r.firstPull.plain === 1 && r.firstPull.pity === 1);
  check('dumplings: duplicate refunds 4g and grants one dough',
    r.duplicateBought && r.duplicatePull.gold === 64 && r.duplicatePull.plain === 2 &&
    r.duplicatePull.dough === 1 && r.duplicatePull.pity === 2);
  check('dumplings: fifteenth dry pull forces and resets a Legendary',
    r.pityBought && r.pityPull.golden === 1 && r.pityPull.pity === 0);
  check('dumplings: collection, dough, and pity survive save reload',
    r.persisted.plain === 2 && r.persisted.golden === 1 &&
    r.persisted.dough === 1 && r.persisted.pity === 0);
  check('dumplings: pity resolves sequentially inside a three-pull bundle',
    r.bundleBought && r.bundle.gold === 154 && r.bundle.plain === 2 &&
    r.bundle.golden === 1 && r.bundle.dough === 1 &&
    r.bundle.pity === 1 && r.bundle.owned === 2);
  check('economy UI: shop copy matches the approved crop values',
    r.shopCopy.includes('sells 5g') && r.shopCopy.includes('sells 7g') &&
    r.shopCopy.includes('sells 9g') && r.shopCopy.includes('sells 17g'));
  check('dumplings: vendor modal closes cleanly', r.modalClosed);
  await browser.close();
}

// --- Dumpling MVP visual evidence at desktop and narrow phone sizes ---
{
  const evidenceDir = new URL('../artifacts/', import.meta.url);
  await mkdir(evidenceDir, { recursive: true });
  const viewports = [
    { name: 'desktop', width: 1363, height: 936 },
    { name: 'phone-portrait', width: 390, height: 780 }
  ];
  let layoutOk = true;
  for (const viewport of viewports) {
    const { browser, page } = await launch('?iso=0');
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 2 });
    await page.evaluate(() => {
      selectProfile('adventurer');
      activateArea('town');
      player.gold = 170;
      player.dumplings = {
        plain_bun: 2,
        custard_bao: 1,
        rainbow_mochi: 1,
        golden_dumpling: 1
      };
      player.dumplingDough = 3;
      player.pullsSinceLegendary = 6;
      selectedDumplingId = 'rainbow_mochi';
      openDumplingVendor();
      document.getElementById('dumplingStatus').textContent =
        '3 pulls: 2 new, 1 duplicate. Last: Rainbow Mochi!';
    });
    const layout = await page.evaluate(() => {
      var modal = document.querySelector('#dumplingModal .dumpling-modal');
      var pull = document.getElementById('dumplingPull1').getBoundingClientRect();
      var close = document.querySelector('.dumpling-close-x').getBoundingClientRect();
      var modalRect = modal.getBoundingClientRect();
      return {
        modalHeight: modalRect.height,
        viewportHeight: window.innerHeight,
        overflowY: getComputedStyle(modal).overflowY,
        pullHeight: pull.height,
        closeHeight: close.height,
        closeVisible: close.top >= modalRect.top && close.bottom <= modalRect.bottom
      };
    });
    layoutOk = layoutOk && layout.modalHeight <= layout.viewportHeight * 0.91 &&
      layout.overflowY === 'auto' && layout.pullHeight >= 44 &&
      layout.closeHeight >= 44 && layout.closeVisible;
    await page.screenshot({
      path: fileURLToPath(new URL('dumpling-mvp-' + viewport.name + '.png', evidenceDir)),
      fullPage: true
    });
    await browser.close();
  }
  check('visual evidence: desktop and phone dumpling frames captured', true);
  check('dumplings: modal stays bounded, scrollable, and touch-sized', layoutOk);
}

if (fails.length) { console.error('ISO TEST FAILED: ' + fails.join(', ')); process.exit(1); }
console.log('Iso tests passed.');
