// ---- Profiles & saving (localStorage, one save per kid) ----
// SAVE FORMAT v4 (v3 + Mira's Guide onboarding). Versioned and grouped:
//   { version:4, area, x, y, player:{..., onboarding:{status, milestones}},
//     areas:{ <name>: { tiles: {...}|null, enemies: { <spawnId>: {alive,respawnAt} } } } }
// `player` holds everything about the hero (gold, seeds, crops, combat, gear, food);
// `player.onboarding` holds the Mira's Guide state (see js/11-onboarding.js):
// status 'active'|'skipped'|'completed' plus one boolean per guide milestone;
// `areas.<name>.tiles` holds each area's per-plot soil state (keyed "row,col");
// `areas.<name>.enemies` holds THIS PROFILE's mutable enemy life state keyed by the
// stable spawn ID (see enemySpawnId) — the spawn definitions themselves are the
// immutable ENEMY_SPAWNS templates and are never saved.
//
// ALL save input — normal profile loading, pasted imports, and file imports — flows
// through ONE central parse → validate → migrate → canonicalize path (ingestSaveText /
// ingestSaveObject below). Older shapes (v3 without onboarding; v2 nested; v1/v0 flat
// with farmTiles/townTiles/tiles and numeric seeds/crops) migrate deterministically to
// v4 with every enemy initially alive. Every pre-v4 save migrates with the guide
// 'skipped' — an established player is never forced into the tutorial. A v4 save
// missing the whole onboarding block is a supported recovery case and also migrates
// to 'skipped'. Invalid input is rejected without touching the stored save.
var SAVE_VERSION = 4;

// The canonical onboarding milestone ids, in guide order (mirrors ONBOARDING_MILESTONES
// in js/11-onboarding.js; duplicated as plain data so the ingestion path stays
// dependency-free the way the rest of this module is).
var ONBOARDING_MILESTONE_IDS = ['planted', 'harvested', 'usedCrop',
                                'metMira', 'acceptedQuest', 'enteredWilds'];
var ONBOARDING_STATUSES = { active: 1, skipped: 1, completed: 1 };

function defaultState() {
  return {
    version: SAVE_VERSION,
    area: 'farm', x: 5 * TILE, y: 8 * TILE,
    player: {
      gold: 10,
      seeds: { turnip: 4, carrot: 0, corn: 0, pumpkin: 0, starfruit: 0 },
      crops: { turnip: 0, carrot: 0, corn: 0, pumpkin: 0, starfruit: 0 },
      questsDone: 0,
      hp: 20, maxHp: 20, level: 1, xp: 0, hpUpgrades: 0, atkUpgrades: 0,
      gear: { weapon: null, head: null, body: null, cape: null },
      inventory: [],
      food: { veggie_soup: 0, carrot_stew: 0, corn_chowder: 0, pumpkin_pie: 0, starfruit_elixir: 0 },
      killCounts: {},
      killQuest: null,
      friends: {},
      dumplings: {},
      dumplingDough: 0,
      pullsSinceLegendary: 0,
      onboarding: defaultOnboarding('active')
    },
    areas: {
      farm:      { tiles: null, enemies: {} },
      town:      { tiles: null, enemies: {} },
      wilds:     { tiles: null, enemies: {} },
      deepwoods: { tiles: null, enemies: {} },
      mine:      { tiles: null, enemies: {} }
    }
  };
}

// A fresh onboarding block: every milestone false, in the given status.
function defaultOnboarding(status) {
  var milestones = {};
  for (var i = 0; i < ONBOARDING_MILESTONE_IDS.length; i++)
    milestones[ONBOARDING_MILESTONE_IDS[i]] = false;
  return { status: status, milestones: milestones };
}

// ---- Central save ingestion: parse → validate → migrate → canonicalize ----
// Dependency-free. Shared verbatim by profile loading, paste import, and file import,
// so every entry point accepts exactly the same saves and rejects exactly the same junk.

function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function isFiniteNumber(v) { return typeof v === 'number' && isFinite(v); }
// A field that is present but not a finite number is a corrupt save, not a legacy gap.
function badNumber(v) { return v != null && !isFiniteNumber(v); }

// Returns an error string, or null when the shape is acceptable to migrate.
// Missing legacy fields are fine (they get documented defaults in migrateSaveToV4);
// PRESENT-but-wrong fields are rejected.
function validateSaveShape(s) {
  if (!isPlainObject(s)) return 'save must be a plain JSON object';
  if (s.version != null) {
    if (!isFiniteNumber(s.version) || s.version % 1 !== 0 || s.version < 0)
      return 'invalid version field';
    if (s.version > SAVE_VERSION) return 'save is from a newer game version';
  }
  if (s.area != null) {
    if (typeof s.area !== 'string') return 'invalid area field';
    if (!areas[s.area]) return 'unknown area: ' + s.area;   // critical ID — never defaulted
  }
  if (badNumber(s.x) || badNumber(s.y)) return 'invalid position';

  var nested = (s.version >= 2);
  if (nested && !isPlainObject(s.player)) return 'missing player block';
  var p = nested ? s.player : s;

  var nums = ['gold', 'questsDone', 'hp', 'maxHp', 'level', 'xp',
              'hpUpgrades', 'atkUpgrades', 'dumplingDough', 'pullsSinceLegendary'];
  for (var i = 0; i < nums.length; i++)
    if (badNumber(p[nums[i]])) return 'invalid numeric field: ' + nums[i];
  if (p.maxHp != null && p.maxHp <= 0) return 'nonsensical maxHp';
  if (p.level != null && p.level < 1) return 'nonsensical level';
  // Nonsensical values are rejected, never silently clamped into a playable save.
  var nonNeg = ['gold', 'questsDone', 'hp', 'xp', 'hpUpgrades', 'atkUpgrades',
                'dumplingDough', 'pullsSinceLegendary'];
  for (var nn = 0; nn < nonNeg.length; nn++)
    if (p[nonNeg[nn]] != null && p[nonNeg[nn]] < 0) return 'negative ' + nonNeg[nn];
  // The last valid tile origin is (MAP_-1) * TILE; MAP_ * TILE is already off-map.
  if (s.x != null && (s.x < 0 || s.x > (MAP_W - 1) * TILE)) return 'off-map position x';
  if (s.y != null && (s.y < 0 || s.y > (MAP_H - 1) * TILE)) return 'off-map position y';

  // seeds/crops: legacy numeric, per-type object, or absent — anything else is corrupt.
  if (p.seeds != null && typeof p.seeds !== 'number' && !isPlainObject(p.seeds))
    return 'invalid seeds field';
  if (p.crops != null && typeof p.crops !== 'number' && !isPlainObject(p.crops))
    return 'invalid crops field';

  if (p.gear != null && !isPlainObject(p.gear)) return 'invalid gear field';
  if (p.inventory != null && !Array.isArray(p.inventory)) return 'invalid inventory field';
  var maps = ['food', 'killCounts', 'friends', 'dumplings'];
  for (var m = 0; m < maps.length; m++)
    if (p[maps[m]] != null && !isPlainObject(p[maps[m]])) return 'invalid ' + maps[m] + ' field';

  // Onboarding (v4): absent is fine (pre-v4 saves and v4 recovery saves migrate to
  // 'skipped'); a PRESENT v4 block must contain exactly the six canonical boolean
  // milestones. Unknown or missing keys, bad values, and contradictory completed
  // states are corrupt saves, never defaulted.
  if (p.onboarding != null && s.version >= 4) {
    var ob = p.onboarding;
    if (!isPlainObject(ob)) return 'invalid onboarding field';
    if (!ONBOARDING_STATUSES[ob.status]) return 'invalid onboarding status';
    if (!isPlainObject(ob.milestones)) return 'invalid onboarding milestones';
    if (Object.keys(ob.milestones).length !== ONBOARDING_MILESTONE_IDS.length)
      return 'onboarding milestones must contain exactly six keys';
    for (var oi = 0; oi < ONBOARDING_MILESTONE_IDS.length; oi++)
      if (!(ONBOARDING_MILESTONE_IDS[oi] in ob.milestones))
        return 'missing onboarding milestone: ' + ONBOARDING_MILESTONE_IDS[oi];
    for (var om in ob.milestones) {
      if (ONBOARDING_MILESTONE_IDS.indexOf(om) < 0)
        return 'unknown onboarding milestone: ' + om;
      if (typeof ob.milestones[om] !== 'boolean')
        return 'invalid onboarding milestone value: ' + om;
    }
    var allOnboardingDone = ONBOARDING_MILESTONE_IDS.every(function (id) {
      return ob.milestones[id] === true;
    });
    if (ob.status === 'completed' && !allOnboardingDone)
      return 'completed onboarding requires all milestones';
  }

  if (p.killQuest != null) {
    if (!isPlainObject(p.killQuest)) return 'invalid killQuest field';
    if (typeof p.killQuest.target !== 'string' || !ENEMIES[p.killQuest.target])
      return 'unknown killQuest target';
    if (badNumber(p.killQuest.count) || badNumber(p.killQuest.progress) ||
        badNumber(p.killQuest.reward)) return 'invalid killQuest numbers';
  }

  if (s.areas != null) {
    if (!isPlainObject(s.areas)) return 'invalid areas block';
    for (var a in s.areas) {
      if (!areas[a]) return 'unknown area: ' + a;
      var blk = s.areas[a];
      if (blk == null) continue;
      if (!isPlainObject(blk)) return 'invalid area block: ' + a;
      if (blk.tiles != null) {
        var tileErr = validateAreaTiles(a, blk.tiles);
        if (tileErr) return tileErr;
      }
      if (blk.enemies != null) {
        if (!isPlainObject(blk.enemies)) return 'invalid enemies block: ' + a;
        for (var eid in blk.enemies) {
          var es = blk.enemies[eid];
          if (!isPlainObject(es) || typeof es.alive !== 'boolean' ||
              badNumber(es.respawnAt) || (es.respawnAt != null && es.respawnAt < 0))
            return 'invalid enemy state: ' + eid;
        }
      }
    }
  }
  // v1/v0 flat soil blocks get the same per-tile validation as nested ones.
  if (!nested) {
    var flatErr = (s.farmTiles != null && validateAreaTiles('farm', s.farmTiles)) ||
                  (s.tiles != null && validateAreaTiles('farm', s.tiles)) ||
                  (s.townTiles != null && validateAreaTiles('town', s.townTiles));
    if (flatErr) return flatErr;
  }
  return null;
}

// Validate one area's saved soil map, record by record. restoreAreaCrops dereferences
// each record's fields, so a null/garbage entry that slipped through here would crash
// profile loading — every key and record must be provably safe before migration.
var CROP_TILE_STATUSES = { empty: 1, growing: 1, ready: 1 };
function validateAreaTiles(areaName, tiles) {
  if (!isPlainObject(tiles)) return 'invalid tiles: ' + areaName;
  for (var key in tiles) {
    var mtch = /^(\d+),(\d+)$/.exec(key);
    if (!mtch) return 'invalid tile key: ' + areaName + ' ' + key;
    var tr = parseInt(mtch[1], 10), tc = parseInt(mtch[2], 10);
    if (tr >= MAP_H || tc >= MAP_W || areas[areaName].map[tr][tc] !== SOIL)
      return 'tile is not soil: ' + areaName + ' ' + key;
    var rec = tiles[key];
    if (!isPlainObject(rec)) return 'invalid tile record: ' + areaName + ' ' + key;
    if (!CROP_TILE_STATUSES[rec.status]) return 'invalid tile status: ' + areaName + ' ' + key;
    if (rec.type != null && CROP_TYPES.indexOf(rec.type) < 0)
      return 'invalid tile crop type: ' + areaName + ' ' + key;
    if (rec.plantedAt != null && (!isFiniteNumber(rec.plantedAt) || rec.plantedAt < 0))
      return 'invalid tile plantedAt: ' + areaName + ' ' + key;
    if (rec.status !== 'empty' && rec.plantedAt == null)
      return 'growing tile missing plantedAt: ' + areaName + ' ' + key;
  }
  return null;
}

// Deterministically migrate a VALIDATED save of any supported version (v0–v4) into
// the canonical v4 shape. Pure: reads globals' static data tables only, mutates nothing.
// Documented defaults for missing legacy fields match the pre-v3 loader exactly.
function migrateSaveToV4(s) {
  var nested = (s.version >= 2 && isPlainObject(s.player));
  var p = nested ? s.player : s;
  var out = defaultState();
  var op = out.player;

  if (typeof s.area === 'string') out.area = s.area; // validated known; absent → farm
  if (s.x != null) out.x = s.x;
  if (s.y != null) out.y = s.y;

  if (p.gold != null) op.gold = p.gold;
  op.questsDone = (p.questsDone != null) ? p.questsDone : 0;
  op.level = (p.level != null) ? p.level : 1;
  op.xp = (p.xp != null) ? p.xp : 0;
  op.hpUpgrades = (p.hpUpgrades != null) ? p.hpUpgrades : 0;
  op.atkUpgrades = (p.atkUpgrades != null) ? p.atkUpgrades : 0;

  // Gear: keep only real gear ids (a corrupt/edited save can't break the paper doll).
  for (var gs = 0; gs < EQUIPMENT_SLOTS.length; gs++) {
    var slot = EQUIPMENT_SLOTS[gs];
    var gid = p.gear ? p.gear[slot] : null;
    op.gear[slot] = (gid && GEAR[gid]) ? gid : null;
  }
  op.inventory = [];
  if (Array.isArray(p.inventory))
    for (var iv = 0; iv < p.inventory.length; iv++)
      if (GEAR[p.inventory[iv]]) op.inventory.push(p.inventory[iv]);

  // Derived-wins max-HP custody (combat-armor spec §4): max HP is DERIVED from level,
  // Heart Crystals, and equipped armour — the stored maxHp is never trusted. This needs
  // op.gear resolved first (above). No save-version bump: for every well-formed post-
  // change save the derivation reproduces the stored value exactly. Current hp clamps
  // DOWN only; a defeated hero (hp <= 0) is never resurrected by recomputation.
  op.maxHp = maxHpFor(op.level, op.hpUpgrades, op.gear);
  var storedHp = (p.hp != null) ? p.hp : op.maxHp;
  op.hp = Math.min(storedHp, op.maxHp);

  for (var fi = 0; fi < FOOD_TYPES.length; fi++)
    op.food[FOOD_TYPES[fi]] = (p.food && isFiniteNumber(p.food[FOOD_TYPES[fi]]))
      ? p.food[FOOD_TYPES[fi]] : 0;

  op.killCounts = {};
  if (isPlainObject(p.killCounts))
    for (var kc in p.killCounts)
      if (ENEMIES[kc] && isFiniteNumber(p.killCounts[kc]) && p.killCounts[kc] > 0)
        op.killCounts[kc] = p.killCounts[kc];

  // Active kill quests are NORMALIZED against the CURRENT quest table, never copied
  // through — otherwise a legacy "Slay 3 Slimes" save would still hit the ELD-PLAY-002
  // waiting problem this schema exists to remove. Deterministic rules:
  //   - the quest becomes the current definition for its target (one kill, singular
  //     name, scaled reward), keeping min(saved progress, new count);
  //   - if saved progress ALREADY satisfies the current objective, the quest resolves
  //     during migration: the CURRENT scaled reward is credited to gold and the quest
  //     clears — non-punitive, no extra kill required (tested);
  //   - a target with no current quest definition drops the quest (cannot happen with
  //     today's tables — every legacy target still has a definition).
  op.killQuest = null;
  if (isPlainObject(p.killQuest) && ENEMIES[p.killQuest.target]) {
    var qdef = null;
    for (var kqi = 0; kqi < KILL_QUESTS.length; kqi++)
      if (KILL_QUESTS[kqi].target === p.killQuest.target) { qdef = KILL_QUESTS[kqi]; break; }
    var qprog = isFiniteNumber(p.killQuest.progress) ? Math.max(0, p.killQuest.progress) : 0;
    if (qdef) {
      if (qprog >= qdef.count) {
        op.gold += qdef.reward;   // resolved at migration: credit the scaled reward once
      } else {
        op.killQuest = { target: qdef.target, count: qdef.count, reward: qdef.reward,
                         name: qdef.name, progress: qprog };
      }
    }
  }

  // Onboarding (Mira's Guide): only a v4 save carries real guide state. EVERY pre-v4
  // save — and a v4 save missing the block — migrates 'skipped': those players
  // already know the loop, and a forced tutorial would be punitive. A present v4
  // block is exact-shape validated and copies every milestone through. An active
  // block with all six true canonicalizes to completed during migration.
  if (s.version >= 4 && isPlainObject(p.onboarding)) {
    op.onboarding = defaultOnboarding(p.onboarding.status);
    for (var om = 0; om < ONBOARDING_MILESTONE_IDS.length; om++) {
      var omId = ONBOARDING_MILESTONE_IDS[om];
      op.onboarding.milestones[omId] = p.onboarding.milestones[omId] === true;
    }
    // Mira's interaction is one real gameplay event. Repair saves from the draft
    // build (or imported edits) that captured metMira without acceptedQuest before
    // applying the active/completed canonicalization below; otherwise a later Wilds
    // completion could write a save that this same ingestion door rejects.
    if (op.onboarding.milestones.metMira)
      op.onboarding.milestones.acceptedQuest = true;
    var migratedAllOnboardingDone = ONBOARDING_MILESTONE_IDS.every(function (id) {
      return op.onboarding.milestones[id] === true;
    });
    if (op.onboarding.status === 'active' && migratedAllOnboardingDone)
      op.onboarding.status = 'completed';
  } else {
    op.onboarding = defaultOnboarding('skipped');
  }

  op.friends = {};
  for (var fr = 0; fr < NPCS.length; fr++)
    op.friends[NPCS[fr].id] = (p.friends && isFiniteNumber(p.friends[NPCS[fr].id]))
      ? p.friends[NPCS[fr].id] : 0;

  op.dumplings = {};
  for (var du = 0; du < DUMPLINGS.length; du++) {
    var savedCount = p.dumplings && parseInt(p.dumplings[DUMPLINGS[du].id], 10);
    if (savedCount > 0) op.dumplings[DUMPLINGS[du].id] = savedCount;
  }
  op.dumplingDough = Math.max(0, parseInt(p.dumplingDough, 10) || 0);
  op.pullsSinceLegendary = Math.max(0,
    Math.min(DUMPLING_PITY_PULLS - 1, parseInt(p.pullsSinceLegendary, 10) || 0));

  // Seeds/crops: legacy plain numbers become per-type objects (count lands on turnip).
  if (typeof p.seeds === 'number' || p.seeds == null) {
    var sc = (p.seeds != null) ? p.seeds : 4;
    for (var st = 0; st < CROP_TYPES.length; st++) op.seeds[CROP_TYPES[st]] = 0;
    op.seeds.turnip = sc;
  } else {
    for (var s1 = 0; s1 < CROP_TYPES.length; s1++)
      op.seeds[CROP_TYPES[s1]] = isFiniteNumber(p.seeds[CROP_TYPES[s1]]) ? p.seeds[CROP_TYPES[s1]] : 0;
  }
  if (typeof p.crops === 'number' || p.crops == null) {
    var cc = (p.crops != null) ? p.crops : 0;
    for (var ct = 0; ct < CROP_TYPES.length; ct++) op.crops[CROP_TYPES[ct]] = 0;
    op.crops.turnip = cc;
  } else {
    for (var c1 = 0; c1 < CROP_TYPES.length; c1++)
      op.crops[CROP_TYPES[c1]] = isFiniteNumber(p.crops[CROP_TYPES[c1]]) ? p.crops[CROP_TYPES[c1]] : 0;
  }

  // Soil tiles by version family; enemy state exists only in v3 saves — every older
  // save migrates with all enemies alive and timers cleared (empty enemies map).
  var names = ['farm', 'town', 'wilds', 'deepwoods', 'mine'];
  for (var an = 0; an < names.length; an++) {
    var nm = names[an];
    var tiles = null, enemies = {};
    if (nested) {
      var blk = (s.areas && isPlainObject(s.areas[nm])) ? s.areas[nm] : null;
      if (blk && isPlainObject(blk.tiles)) tiles = blk.tiles;
      if (s.version >= 3 && blk && isPlainObject(blk.enemies)) enemies = blk.enemies;
    } else if (nm === 'farm') {
      tiles = isPlainObject(s.farmTiles) ? s.farmTiles : (isPlainObject(s.tiles) ? s.tiles : null);
    } else if (nm === 'town') {
      tiles = isPlainObject(s.townTiles) ? s.townTiles : null;
    }
    out.areas[nm] = { tiles: tiles, enemies: enemies };
  }
  return out;
}

// The one ingestion door. Text in → { ok:true, state, canonicalText } or { ok:false, error }.
function ingestSaveText(txt) {
  var parsed;
  try { parsed = JSON.parse(txt); }
  catch (e) { return { ok: false, error: 'not valid JSON' }; }
  return ingestSaveObject(parsed);
}
function ingestSaveObject(s) {
  var err = validateSaveShape(s);
  if (err) return { ok: false, error: err };
  var v4 = migrateSaveToV4(s);
  return { ok: true, state: v4, canonicalText: JSON.stringify(v4) };
}

// Restore one area's crops: reset all its plots, then lay saved progress back on.
function restoreAreaCrops(name, tiles) {
  initAreaCrops(name);
  if (tiles) {
    var crops = areas[name].crops;
    for (var k in tiles) {
      if (crops[k]) {
        crops[k] = tiles[k];
        // Old saves lack a type field; default active crops to turnip.
        if (!crops[k].type && crops[k].status !== 'empty') crops[k].type = 'turnip';
      }
    }
  }
}

// Apply a CANONICAL v4 state (always the output of ingestSaveObject/ingestSaveText or
// defaultState) to the live game. All legacy-shape knowledge lives in the ingestion
// path above; this function is a straight setter.
function applyState(v3) {
  var p = v3.player;

  // Deep-copy the guide state so live play never mutates the ingested snapshot.
  player.onboarding = defaultOnboarding(p.onboarding.status);
  for (var oi = 0; oi < ONBOARDING_MILESTONE_IDS.length; oi++)
    player.onboarding.milestones[ONBOARDING_MILESTONE_IDS[oi]] =
      p.onboarding.milestones[ONBOARDING_MILESTONE_IDS[oi]] === true;

  player.gold = p.gold;
  player.questsDone = p.questsDone;
  player.level = p.level;
  player.maxHp = p.maxHp;
  player.hp = p.hp;
  player.xp = p.xp;
  player.hpUpgrades = p.hpUpgrades;
  player.atkUpgrades = p.atkUpgrades;

  player.gear = {};
  for (var gs = 0; gs < EQUIPMENT_SLOTS.length; gs++)
    player.gear[EQUIPMENT_SLOTS[gs]] = p.gear[EQUIPMENT_SLOTS[gs]] || null;
  player.inventory = p.inventory.slice();

  player.food = {};
  for (var fi = 0; fi < FOOD_TYPES.length; fi++)
    player.food[FOOD_TYPES[fi]] = p.food[FOOD_TYPES[fi]] || 0;

  player.killCounts = {};
  for (var kc in p.killCounts) player.killCounts[kc] = p.killCounts[kc];
  player.killQuest = p.killQuest ? {
    target: p.killQuest.target, count: p.killQuest.count, reward: p.killQuest.reward,
    name: p.killQuest.name, progress: p.killQuest.progress
  } : null;

  player.friends = {};
  for (var fr = 0; fr < NPCS.length; fr++)
    player.friends[NPCS[fr].id] = p.friends[NPCS[fr].id] || 0;

  player.dumplings = {};
  for (var du in p.dumplings) player.dumplings[du] = p.dumplings[du];
  player.dumplingDough = p.dumplingDough;
  player.pullsSinceLegendary = p.pullsSinceLegendary;
  selectedDumplingId = firstOwnedDumplingId();

  player.seeds = {};
  player.crops = {};
  for (var i = 0; i < CROP_TYPES.length; i++) {
    player.seeds[CROP_TYPES[i]] = p.seeds[CROP_TYPES[i]] || 0;
    player.crops[CROP_TYPES[i]] = p.crops[CROP_TYPES[i]] || 0;
  }

  // THIS PROFILE's enemy world: rebuilt from the immutable templates + saved life
  // state. Expired respawn timers normalize to alive inside buildProfileEnemies.
  AREA_ENEMIES = buildProfileEnemies(v3.areas);

  // Per-area soil state. Wilds/Deep Woods/Mine have no soil today, but the slots
  // exist so future plots/chests can save with no new format.
  restoreAreaCrops('farm', v3.areas.farm.tiles);
  restoreAreaCrops('town', v3.areas.town.tiles);
  restoreAreaCrops('wilds', v3.areas.wilds.tiles);
  restoreAreaCrops('deepwoods', v3.areas.deepwoods.tiles);
  restoreAreaCrops('mine', v3.areas.mine.tiles);

  activateArea(areas[v3.area] ? v3.area : 'farm');

  player.x = v3.x;
  player.y = v3.y;

  // Visual overlays need no sync step: they read player.gear directly, which this
  // function has already restored (see hasVisualEquipment).
}

// Load one profile's stored save through the central ingestion path. Returns the
// CANONICAL v4 state, null when no save exists, or { corrupt: true, error } when the
// stored text exists but fails ingestion — callers must not overwrite that raw data.
function loadGame(profile) {
  var raw = null;
  try { raw = localStorage.getItem('eldoria_save_' + profile); } catch (e) {}
  if (!raw) return null;
  var result = ingestSaveText(raw);
  if (!result.ok) return { corrupt: true, error: result.error };
  return result.state;
}

function saveGame() {
  if (!currentProfile) return;
  var data = {
    version: SAVE_VERSION,
    area: currentArea,
    x: player.x, y: player.y,
    player: {
      gold: player.gold, seeds: player.seeds, crops: player.crops,
      questsDone: player.questsDone,
      hp: player.hp, maxHp: player.maxHp, level: player.level, xp: player.xp,
      hpUpgrades: player.hpUpgrades, atkUpgrades: player.atkUpgrades,
      gear: player.gear, inventory: player.inventory, food: player.food,
      killCounts: player.killCounts, killQuest: player.killQuest,
      friends: player.friends,
      dumplings: player.dumplings,
      dumplingDough: player.dumplingDough,
      pullsSinceLegendary: player.pullsSinceLegendary,
      onboarding: player.onboarding
    },
    areas: (function () {
      var enemyState = serializeProfileEnemies();   // wilds/deepwoods/mine only
      return {
        farm:      { tiles: areas.farm.crops,      enemies: {} },
        town:      { tiles: areas.town.crops,      enemies: {} },
        wilds:     { tiles: areas.wilds.crops,     enemies: enemyState.wilds },
        deepwoods: { tiles: areas.deepwoods.crops, enemies: enemyState.deepwoods },
        mine:      { tiles: areas.mine.crops,      enemies: enemyState.mine }
      };
    })()
  };
  try { localStorage.setItem('eldoria_save_' + currentProfile, JSON.stringify(data)); } catch (e) {}
}

// What to show for a slot: the player's typed-in name, or the manifest's default role
// name (HERO_IDENTITIES — Ranger / Mage). The typed name lives only in localStorage on
// this device — it is never in the game files — and always wins as the hero's name.
function profileDisplayName(id) {
  try {
    var n = localStorage.getItem('eldoria_name_' + id);
    if (n && n.trim()) return n.trim();
  } catch (e) {}
  return (HERO_IDENTITIES[id] && HERO_IDENTITIES[id].defaultName) || 'Hero';
}

// (Legacy name-keyed save migration removed for the public release. The old first-version
// saves were long since copied onto the neutral profile ids; saves now live only under
// eldoria_save_adventurer / eldoria_save_mage.)

// Repaint the two title-screen buttons from the identity manifest: display name,
// grade label, and the approved south-facing title portrait. The manifest is the one
// source of truth for every player-facing identity surface.
function refreshTitleLabels() {
  for (var id in HERO_IDENTITIES) {
    var ident = HERO_IDENTITIES[id];
    var el = document.getElementById('label-' + id);
    if (el) el.textContent = profileDisplayName(id);
    var grade = document.getElementById('grade-' + id);
    if (grade) grade.textContent = ident.gradeLabel;
    var img = document.getElementById('portrait-' + id);
    if (img && img.getAttribute('src') !== ident.titlePortrait) img.src = ident.titlePortrait;
  }
}

// Let a player name (or rename) their hero. Stored locally only; kept short and tidy.
function renameProfile(id) {
  var name = prompt('What is your hero’s name?', profileDisplayName(id));
  if (name === null) return;                 // cancelled
  name = name.trim().slice(0, 16);
  try {
    if (name) localStorage.setItem('eldoria_name_' + id, name);
    else localStorage.removeItem('eldoria_name_' + id);
  } catch (e) {}
  refreshTitleLabels();
  if (currentProfile === id) {
    document.getElementById('profileName').textContent = profileDisplayName(id);
  }
}

// Pick a slot: ingest+migrate any stored save, load it (or a fresh start), and begin
// playing. A CORRUPT stored save refuses entry instead of loading defaults: entering
// would let the 3-second autosave silently overwrite recoverable raw data. The raw
// text stays untouched in localStorage for Save Tools export/repair/reset.
function selectProfile(id) {
  var loaded = loadGame(id);
  if (loaded && loaded.corrupt) {
    showToast(profileDisplayName(id) + "'s save looks damaged (" + loaded.error +
      '). Open Save Tools to export, repair, or reset it — nothing was erased.');
    speak('That save looks damaged. Ask a grown-up to open Save Tools and fix it.');
    return;
  }
  currentProfile = id;
  loadAudioLevels(id);            // each child keeps their own sound levels
  if (typeof clearLastInstruction === 'function') clearLastInstruction();
  if (typeof syncSoundSettingsUI === 'function') syncSoundSettingsUI();
  applyState(loaded || defaultState());
  document.getElementById('profileName').textContent = profileDisplayName(id);
  document.getElementById('titleScreen').classList.add('hide');
  gameActive = true;
  var heroBtn = document.getElementById('heroBtn');
  if (heroBtn) heroBtn.disabled = false;   // the Character screen needs an active profile
  updateHUD();
  if (!gameMuted) bgMusic.play().catch(function() {});
}

// Save and go back to the profile picker. Every open modal is closed through its safe
// path first so no overlay (or shell stack entry) can outlive the world it belongs to.
function switchProfile() {
  saveGame();
  closeAllModals();
  gameActive = false;
  currentProfile = null;
  if (typeof clearLastInstruction === 'function') clearLastInstruction();
  var heroBtn = document.getElementById('heroBtn');
  if (heroBtn) heroBtn.disabled = true;
  updateOnboardingChip();   // no active profile → the guide chip leaves the screen
  bgMusic.pause();
  document.getElementById('titleScreen').classList.remove('hide');
}

// Parent-gate: hold the Switch button for 2 seconds to prevent accidental profile switching.
(function () {
  var btn = document.getElementById('switchBtn');
  var HOLD_MS = 2000;
  var timer = null;
  var startTime = 0;
  var raf = null;

  function updateLabel() {
    var elapsed = Date.now() - startTime;
    var remaining = Math.ceil((HOLD_MS - elapsed) / 1000);
    if (remaining > 0) {
      btn.textContent = 'Hold ' + remaining + '…';
      raf = requestAnimationFrame(updateLabel);
    }
  }

  function startHold(e) {
    e.preventDefault();
    startTime = Date.now();
    timer = setTimeout(function () {
      cancelAnimationFrame(raf);
      btn.textContent = 'Switch';
      switchProfile();
    }, HOLD_MS);
    updateLabel();
  }

  function cancelHold() {
    if (timer) { clearTimeout(timer); timer = null; }
    cancelAnimationFrame(raf);
    btn.textContent = 'Switch';
  }

  btn.addEventListener('touchstart', startHold, { passive: false });
  btn.addEventListener('touchend', cancelHold);
  btn.addEventListener('touchcancel', cancelHold);
  btn.addEventListener('mousedown', startHold);
  btn.addEventListener('mouseup', cancelHold);
  btn.addEventListener('mouseleave', cancelHold);
})();

// ---- Save tools (slice 14): export / import / reset, from the title screen ----
// A small parent-facing backup panel. localStorage is easy to lose (a cleared browser,
// a new device), so this lets you copy a save out as text and paste it back. All offline.
var saveToolsProfile = 'adventurer';   // which slot the panel is acting on

function openSaveTools() {
  saveToolsProfile = 'adventurer';
  document.getElementById('saveToolsText').value = '';
  refreshSaveToolsUI();
  modalShellOpen('saveToolsModal');
}
function closeSaveTools() {
  modalShellClose('saveToolsModal');
}
registerModal('saveToolsModal', closeSaveTools);   // Escape = Done
function setSaveToolsProfile(id) {
  saveToolsProfile = id;
  document.getElementById('saveToolsText').value = '';
  refreshSaveToolsUI();
}
// Highlight the active slot tab and label it with the hero's display name.
function refreshSaveToolsUI() {
  ['adventurer', 'mage'].forEach(function (id) {
    var tab = document.getElementById('saveTab_' + id);
    if (!tab) return;
    tab.classList.toggle('active', id === saveToolsProfile);
    tab.textContent = profileDisplayName(id);
  });
}
// Export: dump the selected slot's raw save into the text box to copy somewhere safe.
function exportSave() {
  var raw = localStorage.getItem('eldoria_save_' + saveToolsProfile);
  var name = profileDisplayName(saveToolsProfile);
  if (!raw) { showToast('No save yet for ' + name); return; }
  document.getElementById('saveToolsText').value = raw;
  showToast('Exported ' + name + ' — copy the text!');
}
// Download: save as a .json file the kid can keep in Files / iCloud.
function downloadSave() {
  var raw = localStorage.getItem('eldoria_save_' + saveToolsProfile);
  var name = profileDisplayName(saveToolsProfile);
  if (!raw) { showToast('No save yet for ' + name); return; }
  var blob = new Blob([raw], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'eldoria-' + saveToolsProfile + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Downloaded ' + name + "'s save!");
}
// Load file: read a .json backup from the device and import it.
function loadSaveFile(evt) {
  var file = evt.target.files && evt.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    var txt = (e.target.result || '').trim();
    var name = profileDisplayName(saveToolsProfile);
    var result = ingestSaveText(txt);   // same central path as pasted imports
    if (!result.ok) { showToast("That file isn't a valid save (" + result.error + ').'); return; }
    try {
      // Store the CANONICAL v4 form, never the submitted raw text.
      localStorage.setItem('eldoria_save_' + saveToolsProfile, result.canonicalText);
      showToast('Loaded ' + name + "'s save from file!");
      document.getElementById('saveToolsText').value = result.canonicalText;
    } catch (err) { showToast('Could not save (storage full?).'); }
  };
  reader.readAsText(file);
  evt.target.value = '';
}
// Import: run pasted text through the central ingestion path, then store the
// canonical v3 result. A failed import never touches the existing stored save.
function importSave() {
  var txt = (document.getElementById('saveToolsText').value || '').trim();
  var name = profileDisplayName(saveToolsProfile);
  if (!txt) { showToast('Paste a backup first.'); return; }
  var result = ingestSaveText(txt);   // same central path as file imports
  if (!result.ok) { showToast("That isn't valid save text (" + result.error + ').'); return; }
  try {
    // Store the CANONICAL v3 form, never the submitted raw text.
    localStorage.setItem('eldoria_save_' + saveToolsProfile, result.canonicalText);
    showToast('Imported into ' + name + '!');
  } catch (e) { showToast('Could not save (storage full?).'); }
}
// Reset one slot (confirmed). Removes the save but keeps the typed-in hero name.
function resetProfileSave() {
  var name = profileDisplayName(saveToolsProfile);
  if (!confirm('Erase ' + name + "'s save? This cannot be undone.")) return;
  try { localStorage.removeItem('eldoria_save_' + saveToolsProfile); } catch (e) {}
  document.getElementById('saveToolsText').value = '';
  showToast(name + "'s save erased.");
}
// Reset ALL slots (confirmed) — a clean slate for both heroes.
function resetAllSaves() {
  if (!confirm('Erase ALL hero saves? This cannot be undone.')) return;
  ['adventurer', 'mage'].forEach(function (id) {
    try { localStorage.removeItem('eldoria_save_' + id); } catch (e) {}
  });
  document.getElementById('saveToolsText').value = '';
  showToast('All saves erased.');
}

