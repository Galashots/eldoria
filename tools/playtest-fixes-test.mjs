// Regression tests for the 2026-07-29 playtest findings (docs/playtest/2026-07-29-findings.md).
// Each suite reproduces the tracker's original repro path and asserts the acceptance criteria,
// so a regression here names the exact finding that came back. Run: node tools/playtest-fixes-test.mjs
import { launch } from './smoke-test.mjs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails.push(name); };

// --- ELD-PT-002: a correct answer must deal damage without any tapping ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    activateArea('wilds');
    var target = currentEnemies[0];
    target.alive = true;

    // Correct answer, then deliberately never call executeSlash() — this is the tracker's
    // repro: answer right, don't tap, let the window expire.
    openCombat(target);
    combatEnemy.hp = combatEnemy.maxHp = 999;
    var beforeCorrect = combatEnemy.hp;
    answerCombat(combatAnswer);
    var correctDamage = beforeCorrect - combatEnemy.hp;
    var correctHits = slashHits;
    endSlashPhase();
    closeCombat();

    // Same again with a wrong answer: still no free hit, so tapping remains the only
    // way a miss deals damage. This is what keeps the answer worth more than the tap.
    openCombat(target);
    combatEnemy.hp = combatEnemy.maxHp = 999;
    var beforeWrong = combatEnemy.hp;
    answerCombat(combatAnswer + 1);
    var wrongDamage = beforeWrong - combatEnemy.hp;
    var wrongHits = slashHits;
    endSlashPhase();
    closeCombat();

    return { correctDamage, correctHits, wrongDamage, wrongHits, base: playerDamage() };
  });
  check('ELD-PT-002: a correct answer damages the enemy with zero taps', r.correctDamage > 0);
  check('ELD-PT-002: the free hit is worth the full correct-answer bonus', r.correctDamage === r.base * 2);
  check('ELD-PT-002: the free hit counts as exactly one hit', r.correctHits === 1);
  check('ELD-PT-002: a wrong answer gets no free hit', r.wrongDamage === 0 && r.wrongHits === 0);
  check('ELD-PT-002: answering beats tapping (correct untapped > wrong untapped)', r.correctDamage > r.wrongDamage);
  check('ELD-PT-002: no console errors', errors.length === 0);
  await browser.close();
}

// --- ELD-PT-003: the Mine must be a cavern, not a forest ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    var counts = {};
    var m = areas.mine.map;
    for (var row = 0; row < MAP_H; row++)
      for (var col = 0; col < MAP_W; col++) counts[m[row][col]] = (counts[m[row][col]] || 0) + 1;
    // Every other outdoor area should still be built from foliage — this fix is Mine-only.
    var woodsHasTrees = false;
    var w = areas.deepwoods.map;
    for (var r2 = 0; r2 < MAP_H; r2++)
      for (var c2 = 0; c2 < MAP_W; c2++) if (w[r2][c2] === TREE) woodsHasTrees = true;
    return {
      trees: counts[TREE] || 0,
      grass: counts[GRASS] || 0,
      rock: counts[ROCK] || 0,
      cave: counts[CAVE] || 0,
      rockBlocks: BLOCKED[ROCK] === true,
      caveWalkable: !BLOCKED[CAVE],
      woodsHasTrees
    };
  });
  check('ELD-PT-003: the Mine contains no tree tiles', r.trees === 0);
  check('ELD-PT-003: the Mine contains no grass tiles', r.grass === 0);
  check('ELD-PT-003: the Mine is walled with rock', r.rock > 0);
  check('ELD-PT-003: the Mine track is cavern floor', r.cave > 0);
  check('ELD-PT-003: rock blocks movement', r.rockBlocks === true);
  check('ELD-PT-003: cavern floor is walkable', r.caveWalkable === true);
  check('ELD-PT-003: the Deep Woods keeps its trees', r.woodsHasTrees === true);
  await browser.close();
}

// --- ELD-PT-004: combat must not leave the world HUD or the save stale ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    player.maxHp = 100; player.hp = 60;
    player.food.veggie_soup = 2;
    updateHUD();
    activateArea('wilds');
    var target = currentEnemies[0];
    target.alive = true;
    openCombat(target);
    combatEnemy.hp = combatEnemy.maxHp = 999;

    var hudFoodBefore = document.getElementById('food').textContent;
    eatInCombat();
    var hudFoodAfterEat = document.getElementById('food').textContent;
    var hudHpAfterEat = document.getElementById('hp').textContent;
    var savedAfterEat = JSON.parse(localStorage.getItem('eldoria_save_adventurer'));

    var hpAtFlee = player.hp;
    fleeCombat();
    var savedAfterFlee = JSON.parse(localStorage.getItem('eldoria_save_adventurer'));

    return {
      hudFoodBefore, hudFoodAfterEat, hudHpAfterEat,
      liveHp: String(player.hp),
      savedFood: savedAfterEat.player.food.veggie_soup,
      savedHpAtFlee: savedAfterFlee.player.hp,
      hpAtFlee,
      hudHpAfterFlee: document.getElementById('hp').textContent
    };
  });
  check('ELD-PT-004: HUD food count drops when you eat mid-combat',
        r.hudFoodBefore === '2' && r.hudFoodAfterEat === '1');
  check('ELD-PT-004: HUD health matches live health after eating', r.hudHpAfterEat === r.liveHp);
  check('ELD-PT-004: eating is persisted immediately', r.savedFood === 1);
  check('ELD-PT-004: HUD health is correct after fleeing', r.hudHpAfterFlee === String(r.hpAtFlee));
  check('ELD-PT-004: fleeing persists the fight-s outcome', r.savedHpAtFlee === r.hpAtFlee);
  await browser.close();
}

// --- ELD-PT-005: the visible silhouette of a tall object is tappable ---
{
  const { browser, page } = await launch('?iso=1');
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    activateArea('town');
    var mira = NPCS.filter(function (n) { return n.area === 'town'; })[0];
    // Stand right next to her so the tap resolves to the quest, not "walk closer".
    player.x = mira.col * TILE;
    player.y = (mira.row + 1) * TILE;

    // Iso screen-y is (px + py) / 2, so the tile one step UP-screen from her base — the
    // tile her head and shoulders are drawn over — is (row - 1, col - 1).
    var overhang = interactAtVisibleTile(mira.row - 1, mira.col - 1);
    var openedFromBody = questOpen;
    closeQuest();

    var base = interactAtVisibleTile(mira.row, mira.col);
    var openedFromBase = questOpen;
    closeQuest();

    // A tap far away must still do nothing: the reach is short on purpose.
    var faraway = interactAtVisibleTile(mira.row - 6, mira.col - 6);
    var openedFromFaraway = questOpen;
    if (questOpen) closeQuest();

    return { overhang, openedFromBody, base, openedFromBase, faraway, openedFromFaraway,
             reach: TAP_REACH };
  });
  check('ELD-PT-005: tapping an NPC-s body opens the interaction', r.overhang === true && r.openedFromBody === true);
  check('ELD-PT-005: tapping the base tile still works', r.base === true && r.openedFromBase === true);
  check('ELD-PT-005: a distant tap is not captured', r.faraway === false && r.openedFromFaraway === false);
  check('ELD-PT-005: the fallback reach stays short', r.reach === 2);
  await browser.close();
}

// --- ELD-PT-007: what the hero wears is derived from saved gear, never stored twice ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    player.gear.weapon = 'wooden_sword';
    player.gear.head = 'leather_cap';
    saveGame();

    // Reload the save exactly as boot / import / profile-switch do.
    applyState(loadGame('adventurer'));
    var afterReload = EQUIPMENT_SLOTS.map(function (s) { return hasVisualEquipment(s); });

    // Removing gear must remove the layer with no sync call. A separately stored flag
    // would still report true here — that was the actual defect.
    player.gear.weapon = null;
    var afterRemoval = hasVisualEquipment('weapon');

    // And the duplicate state itself must be gone.
    var duplicateGone = (typeof VISUAL_EQUIPMENT === 'undefined');

    return { afterReload, afterRemoval, duplicateGone, slots: EQUIPMENT_SLOTS.slice() };
  });
  check('ELD-PT-007: saved weapon shows on the hero after reload', r.afterReload[r.slots.indexOf('weapon')] === true);
  check('ELD-PT-007: saved head shows on the hero after reload', r.afterReload[r.slots.indexOf('head')] === true);
  check('ELD-PT-007: empty slots stay empty', r.afterReload[r.slots.indexOf('cape')] === false);
  check('ELD-PT-007: clearing gear clears the visual with no sync call', r.afterRemoval === false);
  check('ELD-PT-007: the duplicate equipment state is gone', r.duplicateGone === true);
  await browser.close();
}

// --- ELD-PT-015: the playfield must fit under the HUD ---
{
  const { browser, page } = await launch('?iso=1');
  for (const vp of [
    { name: 'desktop', width: 1363, height: 936 },
    { name: 'iPad landscape', width: 1180, height: 820 },
    { name: 'phone portrait', width: 390, height: 780 }
  ]) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 300));
    const r = await page.evaluate(() => {
      var rect = document.getElementById('game').getBoundingClientRect();
      return { bottom: rect.bottom, top: rect.top, height: rect.height,
               viewport: document.documentElement.clientHeight };
    });
    // 1px of tolerance for sub-pixel layout rounding.
    check(`ELD-PT-015: canvas fits the ${vp.name} viewport`, r.bottom <= r.viewport + 1);
    check(`ELD-PT-015: canvas still fills ${vp.name} below the HUD`, r.height > 0 && r.top >= 0);
  }
  await browser.close();
}

// --- Visual evidence: the Mine, so a reviewer can see it is a cavern and not a forest ---
{
  const evidenceDir = new URL('../artifacts/', import.meta.url);
  await mkdir(evidenceDir, { recursive: true });
  for (const viewport of [
    { name: 'desktop', width: 1363, height: 936 },
    { name: 'phone-portrait', width: 390, height: 780 }
  ]) {
    const { browser, page } = await launch();
    await page.setViewport({ width: viewport.width, height: viewport.height });
    await page.evaluate(() => {
      selectProfile('adventurer');
      activateArea('mine');
      // Stand on the track beside the first enemy so the frame shows walls, floor and a fight.
      player.x = 6 * TILE;
      player.y = 8 * TILE;
      draw();
    });
    await page.screenshot({
      path: fileURLToPath(new URL('mine-cavern-' + viewport.name + '.png', evidenceDir)),
      fullPage: true
    });
    await browser.close();
  }
  check('visual evidence: Mine cavern frames captured', true);
}

if (fails.length) { console.error('PLAYTEST FIX TESTS FAILED: ' + fails.join(', ')); process.exit(1); }
console.log('Playtest fix tests passed.');
