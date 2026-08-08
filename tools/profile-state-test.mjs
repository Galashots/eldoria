// Acceptance tests for the Profile & quest-state integrity PR:
//   - central save ingestion (parse → validate → migrate → canonicalize, save v3)
//   - ELD-STATE-001: enemy life/respawn state is profile-owned
//   - ELD-PLAY-002: kill quests never ask for more targets than the world offers
// Run: node tools/profile-state-test.mjs
import { launch } from './smoke-test.mjs';

const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails.push(name); };

// --- Save integrity: rejection, migration, canonical storage, round-trip ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(async () => {
    localStorage.clear();
    var out = {};

    // (2) Junk shapes are rejected by the ONE ingestion door.
    out.rejects = ['not json at all', 'null', '[1,2]', '"hello"', '17',
      JSON.stringify({ version: 99, player: {} }),            // future version
      JSON.stringify({ version: 2 }),                          // missing player block
      JSON.stringify({ version: 2, player: { gold: 'lots' } }),// non-numeric required field
      JSON.stringify({ version: 2, player: { maxHp: -5 } }),   // nonsensical numeric
      JSON.stringify({ version: 2, player: { killQuest: { target: 'dragon', count: 1, reward: 5 } } }), // unknown critical ID
      JSON.stringify({ version: 3, player: {}, areas: { wilds: { enemies: { x: { alive: 'yes' } } } } }) // malformed v3 enemy state
    ].map(function (t) { return ingestSaveText(t).ok === false; });

    // (1) A failed import leaves the prior save byte-for-byte unchanged.
    var good = JSON.stringify({ version: 2, area: 'farm', x: 160, y: 256,
      player: { gold: 77 }, areas: {} });
    localStorage.setItem('eldoria_save_mage', ingestSaveText(good).canonicalText);
    var before = localStorage.getItem('eldoria_save_mage');
    saveToolsProfile = 'mage';
    document.getElementById('saveToolsText').value = '{"version":2,"player":{"gold":"corrupt"}}';
    importSave();
    out.failedImportUntouched = localStorage.getItem('eldoria_save_mage') === before;

    // (3) v0 / v1 / v2 fixtures migrate to canonical v3 with state intact and
    // every enemy alive. '3,14'/'4,15' are real farm SOIL tiles.
    var v0 = { gold: 33, seeds: 3, crops: 2, tiles: { '3,14': { status: 'growing', plantedAt: 1 } } };
    var v1 = { gold: 44, level: 4, farmTiles: { '4,15': { status: 'ready', plantedAt: 1, type: 'corn' } },
               gear: { weapon: 'wooden_sword' },
               killQuest: { target: 'slime', count: 3, reward: 15, name: 'Slay 3 Slimes', progress: 1 } };
    var v1b = { gold: 10,
               killQuest: { target: 'goblin', count: 2, reward: 20, name: 'Slay 2 Goblins', progress: 0 } };
    var v2 = { version: 2, area: 'wilds', x: 96, y: 128,
      player: { gold: 55, level: 7, xp: 10, gear: { weapon: 'steel_sword', head: 'crystal_crown' },
                inventory: ['iron_armor', 'not_real_gear'], killCounts: { slime: 4 },
                dumplingDough: 12 },
      areas: { farm: { tiles: { '3,14': { status: 'growing', plantedAt: 2, type: 'carrot' } } } } };
    function m(s) { return ingestSaveObject(s); }
    var r0 = m(v0), r1 = m(v1), r1b = m(v1b), r2 = m(v2);
    function allAlive(st) {
      return ['wilds', 'deepwoods', 'mine'].every(function (a) {
        return Object.keys(st.areas[a].enemies).length === 0;
      });
    }
    out.v0 = r0.ok && r0.state.version === 4 && r0.state.player.gold === 33 &&
      r0.state.player.seeds.turnip === 3 && r0.state.player.crops.turnip === 2 &&
      r0.state.areas.farm.tiles['3,14'].status === 'growing' && allAlive(r0.state);
    // Legacy ACTIVE quest whose progress (1) already satisfies the current one-kill
    // objective: it resolves during migration — the CURRENT scaled reward (5g for
    // slime) is credited exactly once and the quest clears. Documented in
    // migrateSaveToV4.
    out.v1 = r1.ok && r1.state.player.gold === 49 && r1.state.player.level === 4 &&
      r1.state.player.gear.weapon === 'wooden_sword' &&
      r1.state.areas.farm.tiles['4,15'].type === 'corn' &&
      r1.state.player.killQuest === null && allAlive(r1.state);
    // Legacy active quest with NO progress normalizes to the current one-kill
    // definition (singular name, scaled reward), progress preserved.
    out.v1b = r1b.ok && r1b.state.player.gold === 10 &&
      r1b.state.player.killQuest !== null &&
      r1b.state.player.killQuest.count === 1 &&
      r1b.state.player.killQuest.reward === 10 &&
      r1b.state.player.killQuest.name === 'Slay a Goblin' &&
      r1b.state.player.killQuest.progress === 0;
    out.v2 = r2.ok && r2.state.player.gold === 55 && r2.state.area === 'wilds' &&
      r2.state.player.gear.head === 'crystal_crown' &&
      r2.state.player.inventory.length === 1 &&           // unknown gear id dropped
      r2.state.player.killCounts.slime === 4 &&
      r2.state.player.dumplingDough === 12 && allAlive(r2.state);

    // Malformed crop tiles are rejected BEFORE they can crash restoreAreaCrops:
    // null records, junk statuses, off-soil coordinates, unknown areas, negative
    // numerics, off-map positions.
    out.tileRejects = [
      { version: 2, player: {}, areas: { farm: { tiles: { '3,14': null } } } },
      { version: 2, player: {}, areas: { farm: { tiles: { '3,14': { status: 'weird' } } } } },
      { version: 2, player: {}, areas: { farm: { tiles: { '0,0': { status: 'empty' } } } } },   // not soil
      { version: 2, player: {}, areas: { farm: { tiles: { '3,14': { status: 'growing' } } } } }, // no plantedAt
      { version: 2, player: {}, areas: { farm: { tiles: { '3,14': { status: 'ready', plantedAt: -5 } } } } },
      { version: 2, player: {}, areas: { atlantis: {} } },                                       // unknown area
      { version: 2, player: { gold: -10 } },                                                     // negative gold
      { version: 2, x: -64, player: {} },                                                        // off-map (negative)
      { version: 2, area: 'atlantis', player: {} },                                              // unknown TOP-LEVEL area
      { version: 2, x: MAP_W * TILE, player: {} },                                               // one tile past the right edge
      { version: 2, y: MAP_H * TILE, player: {} },                                               // one tile past the bottom edge
      { gold: 5, farmTiles: { '3,14': 'weeds' } }                                                // flat v1 junk tile
    ].map(function (s) { return ingestSaveObject(s).ok === false; });
    // Boundary sanity: the LAST valid tile origin is still accepted.
    out.boundaryOk = ingestSaveObject({ version: 2, x: (MAP_W - 1) * TILE, y: (MAP_H - 1) * TILE,
      player: {} }).ok === true;

    // An existing stored save carrying an unknown top-level area refuses entry and
    // stays byte-identical (the "invalid saves are rejected, never quietly rewritten"
    // promise, proven on the area field specifically).
    var badAreaSave = JSON.stringify({ version: 2, area: 'atlantis', player: { gold: 3 } });
    localStorage.setItem('eldoria_save_adventurer', badAreaSave);
    selectProfile('adventurer');
    out.badAreaRefused = (gameActive === false) && (currentProfile === null) &&
      localStorage.getItem('eldoria_save_adventurer') === badAreaSave;
    localStorage.removeItem('eldoria_save_adventurer');

    // A malformed tile inside an EXISTING stored save refuses profile entry and the
    // stored text stays byte-for-byte untouched.
    var badTileSave = JSON.stringify({ version: 2, player: { gold: 9 },
      areas: { farm: { tiles: { '3,14': null } } } });
    localStorage.setItem('eldoria_save_adventurer', badTileSave);
    selectProfile('adventurer');
    out.badTileRefused = (gameActive === false) && (currentProfile === null) &&
      localStorage.getItem('eldoria_save_adventurer') === badTileSave;
    localStorage.removeItem('eldoria_save_adventurer');

    // (4) Paste import and file import share the identical validator/migrator and
    // store the identical canonical text.
    var fixtureText = JSON.stringify(v2);
    document.getElementById('saveToolsText').value = fixtureText;
    importSave();
    var pasted = localStorage.getItem('eldoria_save_mage');
    localStorage.removeItem('eldoria_save_mage');
    loadSaveFile({ target: { files: [new File([fixtureText], 's.json')], value: '' } });
    await new Promise(function (res) { setTimeout(res, 300); });   // FileReader is async
    var filed = localStorage.getItem('eldoria_save_mage');
    out.sameDoor = pasted !== null && pasted === filed &&
      pasted === ingestSaveText(fixtureText).canonicalText;

    // (5) Export → import → load round-trip preserves canonical v3 state.
    localStorage.clear();
    selectProfile('adventurer');
    player.gold = 123; player.gear.weapon = 'crystal_blade';
    activateArea('wilds');
    currentEnemies[0].alive = false;
    currentEnemies[0].respawnAt = Date.now() + 25000;
    saveGame();
    var exported = localStorage.getItem('eldoria_save_adventurer');   // what exportSave shows
    var re1 = ingestSaveText(exported);
    var re2 = ingestSaveText(re1.canonicalText);                       // import of the export
    out.roundTrip = re1.ok && re2.ok &&
      JSON.stringify(re1.state) === JSON.stringify(re2.state) &&
      re2.state.player.gold === 123 && re2.state.player.gear.weapon === 'crystal_blade' &&
      re2.state.areas.wilds.enemies[currentEnemies[0].id].alive === false;
    switchProfile();

    // (6) A corrupt EXISTING save refuses profile entry and cannot be silently
    // overwritten by defaultState/autosave.
    var corrupt = '{"version":3,"player":{"gold":"corrupt"}}';
    localStorage.setItem('eldoria_save_adventurer', corrupt);
    selectProfile('adventurer');
    out.corruptRefused = (gameActive === false) && (currentProfile === null);
    saveGame();   // must be a no-op with no profile selected
    out.corruptPreserved = localStorage.getItem('eldoria_save_adventurer') === corrupt;
    localStorage.clear();
    return out;
  });
  check('SAVE: all junk/future/malformed inputs rejected', r.rejects.every(Boolean));
  check('SAVE: failed import leaves prior save byte-for-byte unchanged', r.failedImportUntouched);
  check('SAVE: v0 fixture migrates to canonical v4, all enemies alive', r.v0);
  check('SAVE: v1 satisfied legacy quest resolves at migration, scaled reward credited once', r.v1);
  check('SAVE: v1 unfinished legacy quest normalizes to the current one-kill definition', r.v1b);
  check('SAVE: v2 fixture migrates with progression intact, unknown gear dropped', r.v2);
  check('SAVE: malformed tiles/areas/negatives/off-map are all rejected', r.tileRejects.every(Boolean));
  check('SAVE: the last valid tile origin is still accepted', r.boundaryOk);
  check('SAVE: unknown top-level area in an existing save refuses entry, storage untouched', r.badAreaRefused);
  check('SAVE: malformed tile in an existing save refuses entry, storage untouched', r.badTileRefused);
  check('SAVE: paste and file import share one door and store identical canonical v4', r.sameDoor);
  check('SAVE: export -> import -> load round-trip preserves canonical state', r.roundTrip);
  check('SAVE: corrupt existing profile refuses entry', r.corruptRefused);
  check('SAVE: corrupt existing save is never silently overwritten', r.corruptPreserved);
  await browser.close();
}

// --- ELD-STATE-001: enemy life/respawn state is owned by the selected profile ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    localStorage.clear();
    var out = {};

    // Adventurer defeats the Wilds Slime through the real combat path.
    selectProfile('adventurer');
    activateArea('wilds');
    var slime = currentEnemies[0];
    var slimeId = slime.id;
    openCombat(slime);
    combatEnemy.hp = 0;
    winCombat();
    out.advSlimeDead = slime.alive === false && slime.respawnAt > Date.now();
    var advTimer = slime.respawnAt;

    // (1) Switch to Mage before the timer expires: Mage's Slime is alive.
    switchProfile();
    selectProfile('mage');
    activateArea('wilds');
    out.mageSlimeAlive = currentEnemies[0].alive === true && currentEnemies[0].respawnAt === 0;
    // (5) Mage's kill counts and quest state are untouched by Adventurer's kill.
    out.mageStateClean = !player.killCounts.slime && player.killQuest === null;

    // (2) Switch back before expiry: Adventurer's Slime is still dead, same timer.
    switchProfile();
    selectProfile('adventurer');
    activateArea('wilds');
    var slime2 = currentEnemies[0];
    out.advStillDead = slime2.alive === false && slime2.respawnAt === advTimer;

    // (4) Leaving, re-entering, and a full save/reload preserve a non-expired timer.
    activateArea('town');
    activateArea('wilds');
    out.travelKeepsTimer = currentEnemies[0].alive === false && currentEnemies[0].respawnAt === advTimer;
    saveGame();
    applyState(loadGame('adventurer'));
    activateArea('wilds');
    out.reloadKeepsTimer = currentEnemies[0].alive === false && currentEnemies[0].respawnAt === advTimer;

    // (3) Controlled time: expire the timer, tick once, only THIS profile's Slime revives.
    currentEnemies[0].respawnAt = Date.now() - 1;
    update();
    out.expiredRevives = currentEnemies[0].alive === true && currentEnemies[0].respawnAt === 0;

    // (6) Legacy saves initialize every enemy alive (v2 has no enemy block).
    var legacy = ingestSaveObject({ version: 2, player: { gold: 5 }, areas: {} });
    out.legacyAllAlive = ['wilds', 'deepwoods', 'mine'].every(function (a) {
      return Object.keys(legacy.state.areas[a].enemies).length === 0;
    });

    // (7) Combat loss revives/clears ONLY the active profile's current-area enemies —
    // proven against an INACTIVE profile that holds real dead-with-timer state, so an
    // accidental cross-profile clear cannot hide behind an all-alive default.
    // First: Adventurer (still selected) leaves a dead bat with a future timer.
    var bat = currentEnemies[1];
    openCombat(bat);
    combatEnemy.hp = 0;
    winCombat();
    var advBatTimer = bat.respawnAt;
    out.advBatDead = bat.alive === false && advBatTimer > Date.now();
    switchProfile();

    // Mage (active) also gives itself an active quest, then LOSES combat.
    selectProfile('mage');
    activateArea('wilds');
    player.killQuest = { target: 'bat', count: 1, reward: 5, name: 'Slay a Bat', progress: 0 };
    saveGame();
    openCombat(currentEnemies[2]);
    loseCombat();                      // faint: Mage's current area all alive, timers cleared
    out.lossRevivesArea = currentEnemies.every(function (e) { return e.alive && e.respawnAt === 0; });
    // Mage completing its own quest must not touch Adventurer's quest below.
    checkKillQuest('bat');
    out.mageQuestDone = player.killQuest === null;
    switchProfile();

    // Adventurer's dead bat (inactive during the loss) is STILL dead with the same
    // timer, and Adventurer now takes a quest that Mage's completion never touched.
    selectProfile('adventurer');
    activateArea('wilds');
    out.lossLeftInactiveDead = currentEnemies[1].alive === false &&
      currentEnemies[1].respawnAt === advBatTimer;
    player.killQuest = { target: 'goblin', count: 1, reward: 10, name: 'Slay a Goblin', progress: 0 };
    saveGame();
    switchProfile();

    // Mage completes another quest; Adventurer's active quest survives untouched.
    selectProfile('mage');
    player.killQuest = { target: 'slime', count: 1, reward: 5, name: 'Slay a Slime', progress: 0 };
    checkKillQuest('slime');
    switchProfile();
    selectProfile('adventurer');
    out.inactiveQuestPreserved = player.killQuest !== null &&
      player.killQuest.target === 'goblin' && player.killQuest.progress === 0;
    switchProfile();
    localStorage.clear();
    return out;
  });
  check('ELD-STATE-001: defeat marks only the Adventurer Slime dead with a timer', r.advSlimeDead);
  check('ELD-STATE-001: Mage\'s Slime is alive before the timer expires', r.mageSlimeAlive);
  check('ELD-STATE-001: Mage\'s kill counts and quest are untouched', r.mageStateClean);
  check('ELD-STATE-001: switching back before expiry keeps the Slime dead, same timer', r.advStillDead);
  check('ELD-STATE-001: travel honors a non-expired timer', r.travelKeepsTimer);
  check('ELD-STATE-001: save/reload preserves a non-expired timer', r.reloadKeepsTimer);
  check('ELD-STATE-001: an expired timer revives on the next tick', r.expiredRevives);
  check('ELD-STATE-001: legacy saves initialize every enemy alive', r.legacyAllAlive);
  check('ELD-STATE-001: inactive profile holds a real dead-with-timer enemy first', r.advBatDead);
  check('ELD-STATE-001: combat loss revives only the active area, timers cleared', r.lossRevivesArea);
  check('ELD-STATE-001: active profile\'s own quest completion works', r.mageQuestDone);
  check('ELD-STATE-001: loss left the INACTIVE profile\'s dead enemy dead, same timer', r.lossLeftInactiveDead);
  check('ELD-STATE-001: inactive profile\'s ACTIVE quest survives the other\'s completion', r.inactiveQuestPreserved);
  await browser.close();
}

// --- ELD-PLAY-002: quest pacing matches what the world can actually offer ---
{
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    localStorage.clear();
    var out = {};

    // (1) Every offered count is no greater than the number of simultaneously
    // available instances of that target (currently one of each per area).
    var instanceCount = {};
    for (var a in ENEMY_SPAWNS)
      for (var i = 0; i < ENEMY_SPAWNS[a].length; i++) {
        var t = ENEMY_SPAWNS[a][i].type;
        instanceCount[t] = (instanceCount[t] || 0) + 1;
      }
    out.countsFeasible = KILL_QUESTS.every(function (q) {
      return q.count >= 1 && q.count <= (instanceCount[q.target] || 0);
    });

    // (4) Rewards follow the documented deterministic scaling rule:
    // new reward = Math.round(old reward / old count).
    var OLD = { slime: [3, 15], bat: [3, 15], goblin: [2, 20], wolf: [3, 25], bear: [2, 30],
                troll: [2, 35], rock_golem: [2, 40], magma_slug: [2, 40], crystal_wyrm: [1, 50] };
    out.rewardRule = KILL_QUESTS.every(function (q) {
      var o = OLD[q.target];
      return o && q.reward === Math.round(o[1] / o[0]);
    });
    out.wyrmUnchanged = KILL_QUESTS.some(function (q) {
      return q.target === 'crystal_wyrm' && q.count === 1 && q.reward === 50;
    });

    // (6) Tier restrictions are intact: Mage draws only tier-1 quests.
    selectProfile('mage');
    var mageOk = true;
    for (var d = 0; d < 40; d++) {
      var kq = assignKillQuest();
      if (!kq || kq.tier !== 1) { mageOk = false; break; }
    }
    out.mageTier1Only = mageOk;
    switchProfile();
    selectProfile('adventurer');
    var tiers = {};
    for (var d2 = 0; d2 < 120; d2++) { var q2 = assignKillQuest(); if (q2) tiers[q2.tier] = true; }
    out.advAllTiers = tiers[1] && tiers[2] && tiers[3];

    // (2)(3)(5) One matching defeat completes; nonmatching gives no progress;
    // the reward is granted exactly once; active quests survive save/reload
    // profile-isolated.
    player.killQuest = { target: 'slime', count: 1, reward: 5, name: 'Slay a Slime', progress: 0 };
    saveGame();
    applyState(loadGame('adventurer'));
    out.questSurvivesReload = player.killQuest && player.killQuest.target === 'slime' &&
      player.killQuest.progress === 0;
    var goldBefore = player.gold;
    checkKillQuest('bat');                       // nonmatching: no progress
    out.nonMatchingNoProgress = player.killQuest && (player.killQuest.progress || 0) === 0;
    checkKillQuest('slime');                     // matching: completes + pays once
    var paidOnce = (player.gold === goldBefore + 5) && player.killQuest === null;
    checkKillQuest('slime');                     // no quest left: nothing happens
    out.rewardOnce = paidOnce && player.gold === goldBefore + 5;
    // Profile isolation of quest state:
    switchProfile();
    selectProfile('mage');
    out.questIsolated = player.killQuest === null;
    switchProfile();
    localStorage.clear();
    return out;
  });
  check('ELD-PLAY-002: every offered count fits simultaneously-available instances', r.countsFeasible);
  check('ELD-PLAY-002: rewards follow Math.round(oldReward/oldCount)', r.rewardRule);
  check('ELD-PLAY-002: Crystal Wyrm quest unchanged', r.wyrmUnchanged);
  check('ELD-PLAY-002: Mage draws only tier-1 quests', r.mageTier1Only);
  check('ELD-PLAY-002: Adventurer draws all tiers', r.advAllTiers);
  check('ELD-PLAY-002: active quest survives save/reload', r.questSurvivesReload);
  check('ELD-PLAY-002: nonmatching kill gives no progress', r.nonMatchingNoProgress);
  check('ELD-PLAY-002: matching kill completes and pays exactly once', r.rewardOnce);
  check('ELD-PLAY-002: quest state is profile-isolated', r.questIsolated);
  await browser.close();
}

// --- Retire top-down (sub-project 1): no save stores a facing, and no field was added ---
// The top-down renderer is gone; player.facing is runtime-only. saveGame() must serialize no
// facing, ingestSaveText must drop an incoming facing (no migration), and the schema stays v4.
{
  const { browser, page } = await launch();
  const r = await page.evaluate(() => {
    localStorage.clear();
    selectProfile('adventurer');
    player.facing = 'down-right';
    saveGame();
    var stored = localStorage.getItem('eldoria_save_adventurer');

    // Feed a save that explicitly carries a facing through the ONE ingestion door.
    var parsed = JSON.parse(stored);
    var withFacing = JSON.stringify({
      version: 4, area: 'farm', x: parsed.x, y: parsed.y,
      player: Object.assign({ facing: 'left' }, parsed.player),
      areas: parsed.areas
    });
    var ing = ingestSaveText(withFacing);
    var playerKeys = Object.keys(defaultState().player);
    localStorage.clear();
    return {
      savedHasFacing: stored.indexOf('"facing"') !== -1,
      ingestOk: ing.ok,
      canonicalHasFacing: ing.ok ? ing.canonicalText.indexOf('"facing"') !== -1 : true,
      version: SAVE_VERSION,
      playerHasFacingKey: playerKeys.indexOf('facing') !== -1
    };
  });
  check('FACING: saveGame() serializes no facing field', r.savedHasFacing === false);
  check('FACING: ingestSaveText drops an incoming facing (no migration, not stored)',
    r.ingestOk === true && r.canonicalHasFacing === false);
  check('FACING: the deletion adds no save field (schema stays v4)', r.version === 4);
  check('FACING: defaultState player shape carries no facing key', r.playerHasFacingKey === false);
  await browser.close();
}

if (fails.length) {
  console.error('\n' + fails.length + ' profile-state test(s) failed.');
  process.exit(1);
}
console.log('Profile & quest-state integrity tests passed.');
