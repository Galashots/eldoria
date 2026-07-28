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

// --- Suite 2: flag plumbing (Phase 1 farm + Phase 2 town ON, later areas still top-down) ---
{
  const { browser, page } = await launch('?iso=1');
  const r = await page.evaluate(() => {
    var on = isoActive();
    localStorage.removeItem('eldoria_iso');
    var farmDefault = isoActive();           // currentArea is 'farm' at boot
    currentArea = 'town';
    var townDefault = isoActive();           // ported by the Phase 2 first slice
    currentArea = 'wilds';
    var wildsDefault = isoActive();          // not ported yet
    currentArea = 'farm';
    return { on: on, farmDefault: farmDefault, townDefault: townDefault,
             wildsDefault: wildsDefault };
  });
  check('flag: ?iso=1 turns iso on', r.on === true);
  check('flag: farm defaults to iso (Phase 1)', r.farmDefault === true);
  check('flag: town defaults to iso (Phase 2 slice)', r.townDefault === true);
  check('flag: unported areas default to top-down', r.wildsDefault === false);
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

// --- Visual evidence: exact PR render at desktop, iPad, and phone sizes ---
{
  const evidenceDir = new URL('../artifacts/', import.meta.url);
  await mkdir(evidenceDir, { recursive: true });
  const viewports = [
    { name: 'desktop', width: 1363, height: 936 },
    { name: 'ipad-landscape', width: 1180, height: 820 },
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
  check('visual evidence: desktop, iPad, and phone crop frames captured', true);

  const { browser, page } = await launch('?iso=1');
  await page.setViewport({ width: 1180, height: 820, deviceScaleFactor: 2 });
  await page.evaluate(() => {
    selectProfile('adventurer');
    activateArea('farm');
    applyCanvasMode();
    var now = Date.now();
    for (var r = 3; r <= 7; r++) {
      for (var c = 14; c <= 18; c++) {
        var type = CROP_TYPES[(r + c) % CROP_TYPES.length];
        cropData[r + ',' + c] = {
          status: 'ready',
          plantedAt: now - CROPS[type].grow,
          type: type
        };
      }
    }
    player.x = 13 * TILE;
    player.y = 6 * TILE;
    drawIsoWorld();
  });
  await page.screenshot({
    path: fileURLToPath(new URL('crop-asset-lab-dense-ipad.png', evidenceDir)),
    fullPage: true
  });
  await browser.close();
  check('visual evidence: dense 25-crop iPad frame captured', true);
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

// --- Suite 14: Phase 2 Town slice — General Store + Mira on placeholder geometry ---
// The slice is bounded to ONE building (the General Store, the only Town building with a
// DOOR tile) and ONE villager (Mira, the only Town NPC clear of a DOOR — doAction() tests
// isNearDoor() before isNearNPC(), so a villager beside the door cannot exercise Action).
{
  const { browser, page, errors } = await launch();     // no override: exercise the real defaults
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    activateArea('town');
    applyCanvasMode();
    window.__isoDebug = true;

    var iso = isoActive();
    // Town renders through the iso path with the store standing on placeholder geometry.
    player.x = 7 * TILE; player.y = 7 * TILE;
    drawIsoWorld();
    var mid = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;

    // The store's own tiles are still collected in iso even though top-down art exists for
    // it. Top-down skips those tiles when shop_building.png loads; iso must not inherit that.
    var order = window.__isoDrawOrder;
    var storeTiles = order.filter(k => /^building@[456],[6789]$/.test(k));
    var topDownArt = !!spr('shop_building');
    var isoArt = !!spr('iso_shop_building');            // no iso art exists: placeholders only

    // Depth: the hero south of the store draws after it (in front)...
    player.x = 7 * TILE; player.y = 7 * TILE;
    drawIsoWorld();
    var front = window.__isoDrawOrder;
    var frontOk = front.indexOf('building@6,7') < front.indexOf('player');
    // ...and north of it draws before it (behind the wall).
    player.x = 7 * TILE; player.y = 3 * TILE;
    drawIsoWorld();
    var back = window.__isoDrawOrder;
    var backOk = back.indexOf('building@6,7') > back.indexOf('player');

    // Depth: same two-sided check for Mira. One world step along both axes is one step
    // straight up or down the screen, so these are the positions that actually overlap her.
    var mira = NPCS.filter(n => n.id === 'mira')[0];
    player.x = (mira.col - 1) * TILE; player.y = (mira.row - 1) * TILE;
    drawIsoWorld();
    var npcBehind = window.__isoDrawOrder;
    var npcBehindOk = npcBehind.indexOf('npc@mira') > npcBehind.indexOf('player');
    player.x = (mira.col + 1) * TILE; player.y = (mira.row + 1) * TILE;
    drawIsoWorld();
    var npcFront = window.__isoDrawOrder;
    var npcFrontOk = npcFront.indexOf('npc@mira') < npcFront.indexOf('player');
    var miraDrawn = npcFront.indexOf('npc@mira') !== -1;

    // Action beside Mira opens her quest, and a direct tap opens the very same modal.
    player.x = (mira.col - 1) * TILE; player.y = mira.row * TILE;
    doAction();
    var actionOpened = questOpen;
    closeQuest();
    var tapHandled = interactAtTile(mira.row, mira.col);
    var tapOpened = questOpen;
    closeQuest();

    // Tapping her from across the plaza is recognized but must not teleport the interaction.
    player.x = (mira.col - 6) * TILE; player.y = (mira.row + 4) * TILE;
    var farHandled = interactAtTile(mira.row, mira.col);
    var farStayedClosed = !questOpen;

    // The store's DOOR tile keeps its existing shop entry, by tap and by Action.
    player.x = 7 * TILE; player.y = 7 * TILE;
    var doorTapHandled = interactAtTile(6, 7);
    var doorTapOpened = shopOpen;
    closeShop();
    doAction();
    var doorActionOpened = shopOpen;
    closeShop();

    return { iso, mid: mid[0] + mid[1] + mid[2], storeTiles: storeTiles.length,
             topDownArt, isoArt, frontOk, backOk, miraDrawn, npcBehindOk, npcFrontOk,
             actionOpened, tapHandled, tapOpened, farHandled, farStayedClosed,
             doorTapHandled, doorTapOpened, doorActionOpened };
  });
  check('town: iso is the default render mode for Town', r.iso === true);
  check('town: iso Town paints the canvas', r.mid > 30);
  check('town: boot and Town render raise zero console errors', errors.length === 0);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));
  check('town: all 12 General Store tiles participate in the object pass', r.storeTiles === 12);
  check('town: store renders from placeholders, not the top-down building art',
    r.topDownArt === true && r.isoArt === false);
  check('depth: hero south of the store draws in front of it', r.frontOk === true);
  check('depth: hero north of the store is occluded by it', r.backOk === true);
  check('npc: Mira is collected at her projected tile', r.miraDrawn === true);
  check('depth: Mira draws in front of a hero standing north of her', r.npcBehindOk === true);
  check('depth: Mira draws behind a hero standing south of her', r.npcFrontOk === true);
  check('npc: Action beside Mira opens her existing quest', r.actionOpened === true);
  check('npc: direct tap on Mira opens the same quest path',
    r.tapHandled === true && r.tapOpened === true);
  check('npc: a distant Mira tap does not bypass walking to her',
    r.farHandled === true && r.farStayedClosed === true);
  check('door: tapping the store door opens the existing shop',
    r.doorTapHandled === true && r.doorTapOpened === true);
  check('door: Action at the store door opens the existing shop', r.doorActionOpened === true);
  await browser.close();
}

// --- Suite 15: Farm <-> Town travel and save/world-space integrity in iso ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('adventurer');

    // Farm -> Town across the farm's right-edge EXIT.
    activateArea('farm');
    player.x = (MAP_W - 1) * TILE; player.y = 8 * TILE;
    checkTravel();
    var toTown = currentArea;
    var townPos = { x: player.x, y: player.y };
    var townInside = player.x > 0 && player.x < MAP_W * TILE &&
                     player.y > 0 && player.y < MAP_H * TILE;
    var townIso = isoActive();

    // Town -> Farm across the town's left-edge EXIT.
    player.x = 0; player.y = 10 * TILE;
    checkTravel();
    var toFarm = currentArea;
    var farmInside = player.x > 0 && player.x < MAP_W * TILE &&
                     player.y > 0 && player.y < MAP_H * TILE;

    // World space is untouched by the render mode: the same Town position saves and
    // reloads identically with iso on and with iso forced off. No migration, no new fields.
    activateArea('town');
    player.x = 14 * TILE + 7; player.y = 11 * TILE + 3;
    saveGame();
    var isoSave = JSON.parse(localStorage.getItem('eldoria_save_adventurer'));
    localStorage.setItem('eldoria_iso', '0');
    activateArea('town');
    saveGame();
    var topSave = JSON.parse(localStorage.getItem('eldoria_save_adventurer'));
    localStorage.removeItem('eldoria_iso');

    player.x = 0; player.y = 0;
    applyState(isoSave);
    var restored = { x: player.x, y: player.y, area: isoSave.area };

    return { toTown, townPos, townInside, townIso, toFarm, farmInside,
             sameSchema: JSON.stringify(Object.keys(isoSave)) === JSON.stringify(Object.keys(topSave)),
             samePosition: isoSave.x === topSave.x && isoSave.y === topSave.y,
             version: isoSave.version, saveVersion: SAVE_VERSION, restored };
  });
  check('travel: the farm exit still lands the hero in Town', r.toTown === 'town');
  check('travel: Town arrival is inside the map bounds', r.townInside === true);
  check('travel: arriving in Town switches to the iso renderer', r.townIso === true);
  check('travel: the town exit still lands the hero back on the Farm', r.toFarm === 'farm');
  check('travel: Farm arrival is inside the map bounds', r.farmInside === true);
  check('save: iso and top-down Town saves share one schema', r.sameSchema === true);
  check('save: world-space position is render-mode independent', r.samePosition === true);
  // 2 is the schema version this slice started from; porting Town must not migrate saves.
  check('save: iso Town does not bump the save version',
    r.saveVersion === 2 && r.version === 2);
  check('save: a Town save reloads to the exact same world position',
    r.restored.x === 14 * 32 + 7 && r.restored.y === 11 * 32 + 3 && r.restored.area === 'town');
  await browser.close();
}

// --- Phase 2 Town slice visual evidence ---
{
  const evidenceDir = new URL('../artifacts/', import.meta.url);
  await mkdir(evidenceDir, { recursive: true });
  const viewports = [
    { name: 'desktop', width: 1363, height: 936 },
    { name: 'ipad-landscape', width: 1180, height: 820 },
    { name: 'phone-portrait', width: 390, height: 780 }
  ];
  // Device frames plus the depth and interaction states a reviewer needs to see.
  // x/y are tile col/row. The behind/front pair steps one tile along BOTH world axes,
  // which is one step straight up or down the screen — so the hero genuinely overlaps Mira.
  const frames = [
    { name: 'store', x: 7, y: 8, act: null },
    { name: 'store-behind', x: 7, y: 3, act: null },
    { name: 'behind', x: 13, y: 9, act: null },
    { name: 'front', x: 15, y: 11, act: null },
    { name: 'interaction', x: 13, y: 10, act: 'quest' },
    { name: 'arrival', x: null, y: null, act: 'travel' }
  ];
  for (const viewport of viewports) {
    const { browser, page } = await launch();
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 2 });
    await page.evaluate(() => {
      selectProfile('adventurer');
      activateArea('town');
      applyCanvasMode();
      player.x = 7 * TILE; player.y = 8 * TILE;
      drawIsoWorld();
    });
    await page.screenshot({
      path: fileURLToPath(new URL('iso-town-' + viewport.name + '.png', evidenceDir)),
      fullPage: true
    });
    await browser.close();
  }
  for (const frame of frames.slice(1)) {
    const { browser, page } = await launch();
    await page.setViewport({ width: 1180, height: 820, deviceScaleFactor: 2 });
    await page.evaluate((frame) => {
      selectProfile('adventurer');
      if (frame.act === 'travel') {
        activateArea('farm');
        player.x = (MAP_W - 1) * TILE; player.y = 8 * TILE;
        checkTravel();                       // real Farm -> Town transition
      } else {
        activateArea('town');
        player.x = frame.x * TILE; player.y = frame.y * TILE;
      }
      applyCanvasMode();
      if (frame.act === 'quest') doAction();  // Mira's existing quest modal
      drawIsoWorld();
    }, frame);
    await page.screenshot({
      path: fileURLToPath(new URL('iso-town-' + frame.name + '.png', evidenceDir)),
      fullPage: true
    });
    await browser.close();
  }
  check('visual evidence: Town device, depth, interaction, and travel frames captured', true);
}

if (fails.length) { console.error('ISO TEST FAILED: ' + fails.join(', ')); process.exit(1); }
console.log('Iso tests passed.');
