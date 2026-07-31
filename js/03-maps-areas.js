// ---- Build a map ----
// ---- Iso mode flag ----
// Per-area rollout switch. An area flips true once its iso port passes the kid gate.
// farm: true since Phase 1 (2026-07-27) — the boys playtest iso Farm by default.
// town: true since the Phase 2 first slice (2026-07-28) — General Store + Mira on
//       placeholder geometry. The Forge and the other villagers still render through the
//       generic tile/NPC placeholders; they are not part of that validated slice.
// Override: ?iso=1 forces iso everywhere, ?iso=0 forces top-down; both persist via localStorage.
var ISO_AREAS = { farm: true, town: true, wilds: false, deepwoods: false, mine: false };
if (location.search.indexOf('iso=1') !== -1) { try { localStorage.setItem('eldoria_iso', '1'); } catch (e) {} }
if (location.search.indexOf('iso=0') !== -1) { try { localStorage.setItem('eldoria_iso', '0'); } catch (e) {} }
function isoActive() {
  var ov = null;
  try { ov = localStorage.getItem('eldoria_iso'); } catch (e) {}
  if (ov === '1') return true;
  if (ov === '0') return false;
  return !!ISO_AREAS[currentArea];
}

// Helper: a fresh MAP_W x MAP_H grid with a tree border all around.
function blankMap() {
  var m = [];
  for (var r = 0; r < MAP_H; r++) {
    m[r] = [];
    for (var c = 0; c < MAP_W; c++) {
      if (r === 0 || r === MAP_H - 1 || c === 0 || c === MAP_W - 1) {
        m[r][c] = TREE;
      } else {
        m[r][c] = GRASS;
      }
    }
  }
  return m;
}

// fillRect now takes the map to draw onto (so we can build several areas).
function fillRect(m, x, y, w, h, type) {
  for (var r = y; r < y + h; r++) {
    for (var c = x; c < x + w; c++) {
      if (r >= 0 && r < MAP_H && c >= 0 && c < MAP_W) {
        m[r][c] = type;
      }
    }
  }
}

// ---- Home Farm area: soil plots + water, NO shop. EXIT on the right edge → Town. ----
function buildFarmMap() {
  var m = blankMap();
  fillRect(m, 3, 3, 4, 3, WATER);
  // Soil kept at the SAME tiles as the old single-area map (rows 3-7, cols 14-18)
  // so old saves (their crop keys) map straight onto these plots — no lost crops.
  fillRect(m, 14, 3, 5, 5, SOIL);
  // Paths connecting key features to the right-edge exit.
  fillRect(m, 7, 8, MAP_W - 8, 2, PATH);   // main road from cookpot area to right exit
  fillRect(m, 12, 5, 2, 3, PATH);           // short spur from soil area down to the road
  m[8][MAP_W - 1] = EXIT;
  m[9][MAP_W - 1] = EXIT;
  // Scatter a few trees in the expanded south/east area
  m[14][3] = TREE; m[15][5] = TREE; m[16][2] = TREE;
  m[13][22] = TREE; m[15][25] = TREE; m[17][24] = TREE;
  m[18][10] = TREE; m[19][14] = TREE;
  return m;
}

// ---- Town area: village plaza with General Store, Forge, central well. ----
function buildTownMap() {
  var m = blankMap();
  // Main road across the full width (rows 10-11), both exits
  m[10][0] = EXIT; m[11][0] = EXIT;
  m[10][MAP_W - 1] = EXIT; m[11][MAP_W - 1] = EXIT;
  fillRect(m, 1, 10, MAP_W - 2, 2, PATH);
  // General Store (rows 4-6, cols 6-9) with door
  fillRect(m, 6, 4, 4, 3, HOUSE);
  m[6][7] = DOOR; m[6][8] = DOOR;
  fillRect(m, 7, 7, 2, 3, PATH); // path from road up to the store door
  // Forge (rows 4-6, cols 20-23) — PATH entrance, no DOOR
  fillRect(m, 20, 4, 4, 3, HOUSE);
  fillRect(m, 21, 7, 2, 3, PATH); // path from road up to the forge
  m[6][21] = PATH; m[6][22] = PATH;
  // Central plaza (rows 13-16, cols 12-17) — open gathering space with the well
  fillRect(m, 11, 13, 7, 4, PATH);
  fillRect(m, 13, 12, 3, 1, PATH); // path from road down to plaza
  // Side paths branching off the main road
  fillRect(m, 4, 8, 3, 2, PATH);   // left path up to store area
  fillRect(m, 24, 8, 3, 2, PATH);  // right path up to forge area
  // A small pond in the southeast corner
  fillRect(m, 22, 16, 3, 3, WATER);
  // Tree clusters along edges to break up the rectangle
  var treeClusters = [
    [2,2],[3,2],[2,3], [2,17],[3,18],[2,19],
    [25,2],[26,3],[27,2], [25,17],[26,18],[27,19],
    [10,3],[11,4], [17,3],[18,4],
    [5,15],[4,16],[6,17], [8,19],[9,18]
  ];
  for (var ti = 0; ti < treeClusters.length; ti++) {
    var tc = treeClusters[ti];
    if (tc[1] > 0 && tc[1] < MAP_H - 1 && tc[0] > 0 && tc[0] < MAP_W - 1)
      m[tc[1]][tc[0]] = TREE;
  }
  return m;
}

// ---- Wilds area (slice 10c): walk in from Town to explore and fight. ----
// Left-edge EXIT → back to Town. Right-edge EXIT → on to the Deep Woods (slice 16).
// A few trees make it feel like wilderness; three enemies stand on the trail.
function buildWildsMap() {
  var m = blankMap();
  m[8][0] = EXIT;                  // left edge → Town
  m[9][0] = EXIT;
  fillRect(m, 1, 8, MAP_W - 2, 2, PATH);  // a trail across the whole map (both exits reachable)
  m[8][MAP_W - 1] = EXIT;          // right edge → Deep Woods
  m[9][MAP_W - 1] = EXIT;
  // Scattered trees (TREE blocks movement) — keep them clear of the trail (rows 8-9).
  m[4][6] = TREE;  m[5][10] = TREE; m[12][8] = TREE;
  m[13][14] = TREE; m[6][18] = TREE; m[11][19] = TREE;
  return m;
}

// ---- Deep Woods area (slice 16): the tougher zone past the Wilds. Reached from the
// Wilds' right-edge EXIT; left-edge EXIT → back to the Wilds. Denser forest (more TREE
// walls) and three stronger enemies (Wolf → Bear → Troll) with tier-2 gear drops. ----
function buildDeepWoodsMap() {
  var m = blankMap();
  m[8][0] = EXIT;                  // left edge → back to the Wilds
  m[9][0] = EXIT;
  fillRect(m, 1, 8, MAP_W - 2, 2, PATH);  // a trail across the map
  m[8][MAP_W - 1] = EXIT;          // right edge → the Mine (opens up once you pass the boss)
  m[9][MAP_W - 1] = EXIT;
  // Denser tree cover than the Wilds, to read as "deeper / more dangerous".
  m[3][4] = TREE;  m[4][5] = TREE;  m[5][7] = TREE;  m[6][3] = TREE;
  m[11][6] = TREE; m[12][9] = TREE; m[13][5] = TREE; m[14][11] = TREE;
  m[4][13] = TREE; m[5][16] = TREE; m[6][12] = TREE; m[3][19] = TREE;
  m[12][15] = TREE; m[13][18] = TREE; m[11][21] = TREE; m[14][20] = TREE;
  return m;
}

// ---- The Mine area (slice 20): the underground endgame zone past the Deep Woods boss.
// Reached from the Deep Woods' right-edge EXIT; its left edge returns to the Deep Woods.
// No grass and no foliage — ROCK walls enclose a CAVE-floor track, so the zone reads as a
// cramped cavern rather than the forest it used to borrow its tiles from (ELD-PT-003).
// Two tier-3 enemies then the Crystal Wyrm boss at the end of the track. ----
function buildMineMap() {
  var m = blankMap();
  // Flood the whole cavern with rock (ROCK blocks movement) so only the carved track is walkable.
  // fillRect is (m, x=col, y=row, w=cols, h=rows).
  fillRect(m, 0, 0, MAP_W, MAP_H, ROCK);
  // Carve the mine track: the main horizontal tunnel (rows 8-9) the enemies stand in...
  fillRect(m, 0, 8, MAP_W, 2, CAVE);
  // ...plus a couple of side pockets off the track so it doesn't feel like one straight line.
  fillRect(m, 4, 6, 3, 4, CAVE);    // cols 4-6, rows 6-9 — opens upward off the track
  fillRect(m, 14, 9, 3, 4, CAVE);   // cols 14-16, rows 9-12 — opens downward off the track
  m[8][0] = EXIT;                   // left edge → back to the Deep Woods
  m[9][0] = EXIT;
  return m;
}

// ---- Areas: each holds its own map + crop state. ----
var areas = {
  farm:      { map: buildFarmMap(),      crops: {} },
  town:      { map: buildTownMap(),      crops: {} },
  wilds:     { map: buildWildsMap(),     crops: {} },
  deepwoods: { map: buildDeepWoodsMap(), crops: {} },
  mine:      { map: buildMineMap(),      crops: {} }
};

// Area travel order (left edge → previous area, right edge → next area).
var AREA_ORDER = ['farm', 'town', 'wilds', 'deepwoods', 'mine'];

// Friendly arrival message per destination.
var AREA_LABEL = {
  farm: 'Back to the Farm!', town: 'Welcome to Town!',
  wilds: 'Into the Wilds!', deepwoods: 'The Deep Woods... be careful!',
  mine: 'The Mine... danger ahead!'
};

// ---- Town NPCs: each villager has a position, role, and placeholder color. ----
var NPCS = [
  { id: 'mira',   name: 'Mira',   area: 'town', row: 10, col: 14, role: 'quests', color: '#9c6cd0' },
  { id: 'bram',   name: 'Bram',   area: 'town', row: 7,  col: 7,  role: 'shop',   color: '#d4a55a' },
  { id: 'gunnar', name: 'Gunnar', area: 'town', row: 7,  col: 21, role: 'forge',  color: '#7a8a9a' },
  { id: 'dumpling_vendor', name: 'Dumpling Vendor', area: 'town', row: 14, col: 17,
    role: 'dumplings', color: '#dc779f' }
];
var TOWN_SHOP = { row: 4, col: 6, w: 4, h: 3 };

// ---- Farm cooking pot (slice 13a): walk up to it on the Farm to open the cooking
// modal and turn crops into food. Placed on open grass below the player's start. ----
var FARM_COOKPOT = { row: 11, col: 5, name: 'Cooking Pot' };

// ---- Enemy data (slice 10c) ----
// One simple data object per enemy type. Stats are tuned so BOTH profiles can win:
// the player deals 5+ damage per correct answer (see playerDamage), so ~3 right
// answers beats a Slime. Enemy attacks never one-shot a level-1 hero.
// Each enemy has a `loot` table of { item, chance } entries for gear drops.
var ENEMIES = {
  // ---- Wilds (tier 1): tuned so a no-gear level-1 hero can win with perfect answers. ----
  slime:  { name: 'Slime',  hp: 15, attack: 2, xpReward: 20, color: '#5fa860',
            loot: [{ item: 'wooden_sword', chance: 0.35 }] },
  bat:    { name: 'Bat',    hp: 22, attack: 3, xpReward: 35, color: '#8866bb',
            loot: [{ item: 'leather_cap', chance: 0.30 }, { item: 'hero_cape', chance: 0.20 }] },
  goblin: { name: 'Goblin', hp: 25, attack: 4, xpReward: 50, color: '#bb7744',
            loot: [{ item: 'iron_armor', chance: 0.25 }, { item: 'crystal_blade', chance: 0.15 }] },
  // ---- Deep Woods (tier 2): stronger; meant for a leveled-up, geared hero. Losing is
  // never punitive (respawn at full HP), so an underleveled hero is just nudged to grind. ----
  wolf:  { name: 'Wolf',  hp: 32, attack: 4, xpReward: 70,  color: '#888888',
           loot: [{ item: 'steel_sword', chance: 0.30 }, { item: 'shadow_cape', chance: 0.20 }] },
  bear:  { name: 'Bear',  hp: 42, attack: 5, xpReward: 100, color: '#7a5230',
           loot: [{ item: 'guardian_armor', chance: 0.25 }, { item: 'crystal_crown', chance: 0.20 }] },
  troll: { name: 'Troll', hp: 55, attack: 6, xpReward: 150, color: '#6b8e4e',
           loot: [{ item: 'crystal_staff', chance: 0.22 }, { item: 'guardian_armor', chance: 0.25 }] },
  // ---- BOSS (slice 17): the capstone fight at the end of the Deep Woods. High HP makes it a
  // long battle (lots of math), but its attack still can't one-shot, and losing is penalty-free.
  // Drops the best weapon in the game on EVERY win (chance 1) — a guaranteed trophy. `boss: true`
  // flags it for a bigger placeholder shape and a special victory message. ----
  shadow_warden: { name: 'Shadow Warden', hp: 80, attack: 7, xpReward: 300, color: '#3a2a5a', boss: true,
                   loot: [{ item: 'eldoria_blade', chance: 1 }] },
  // ---- The Mine (tier 3, slice 20): the endgame zone past the Deep Woods boss. Built for a
  // hero who already beat the Shadow Warden (high level, Eldoria Blade). High HP = long, math-
  // heavy fights; attacks still can't one-shot and losing stays penalty-free. Drops tier-3 gear. ----
  rock_golem: { name: 'Rock Golem', hp: 65, attack: 7, xpReward: 220, color: '#7d7468',
                loot: [{ item: 'obsidian_blade', chance: 0.25 }, { item: 'titan_helm', chance: 0.25 }] },
  magma_slug: { name: 'Magma Slug', hp: 75, attack: 8, xpReward: 280, color: '#c0501f',
                loot: [{ item: 'mithril_armor', chance: 0.25 }, { item: 'dragon_cape', chance: 0.22 }] },
  // The Mine's capstone boss (from the original Wilds+Mine vision). Best ARMOR in the game,
  // guaranteed — the Eldoria Blade stays the best WEAPON (slice 17), so both bosses keep a trophy.
  crystal_wyrm: { name: 'Crystal Wyrm', hp: 130, attack: 9, xpReward: 600, color: '#2f6e8f', boss: true,
                  loot: [{ item: 'wyrm_scale', chance: 1 }] }
};

// ---- Gear (slice 10c-ii): dropped by enemies, auto-equipped, gives a damage bonus.
// Each item fills one equipment slot. If you already have something better in that slot
// the drop is acknowledged but not equipped. The sprite's visual overlay follows player.gear
// automatically (hasVisualEquipment), so there is nothing separate to keep in step.
var GEAR = {
  // Tier 1 (Wilds drops)
  wooden_sword:  { name: 'Wooden Sword',  slot: 'weapon', damage: 2 },
  leather_cap:   { name: 'Leather Cap',   slot: 'head',   damage: 1 },
  hero_cape:     { name: "Hero's Cape",    slot: 'cape',   damage: 1 },
  iron_armor:    { name: 'Iron Armor',     slot: 'body',   damage: 2 },
  crystal_blade: { name: 'Crystal Blade',  slot: 'weapon', damage: 5 },
  // Tier 2 (Deep Woods drops) — all stronger than their tier-1 slot-mates.
  steel_sword:    { name: 'Steel Sword',     slot: 'weapon', damage: 6 },
  crystal_staff:  { name: 'Crystal Staff',   slot: 'weapon', damage: 8 },
  crystal_crown:  { name: 'Crystal Crown',   slot: 'head',   damage: 3 },
  guardian_armor: { name: 'Guardian Armor',  slot: 'body',   damage: 4 },
  shadow_cape:    { name: 'Shadow Cape',     slot: 'cape',   damage: 3 },
  // Boss reward (Shadow Warden) — the best weapon in the game, a guaranteed first-kill trophy.
  eldoria_blade:  { name: 'Eldoria Blade',   slot: 'weapon', damage: 12 },
  // Tier 3 (Mine drops, slice 20) — all stronger than their tier-2 slot-mates. Weapons stay
  // BELOW the Eldoria Blade (12) so slice 17's "best weapon in the game" promise holds.
  obsidian_blade: { name: 'Obsidian Blade',  slot: 'weapon', damage: 10 },
  titan_helm:     { name: 'Titan Helm',      slot: 'head',   damage: 5 },
  dragon_cape:    { name: 'Dragon Cape',     slot: 'cape',   damage: 5 },
  mithril_armor:  { name: 'Mithril Armor',   slot: 'body',   damage: 6 },
  // Crystal Wyrm boss reward — best armor in the game, guaranteed every win.
  wyrm_scale:     { name: 'Wyrm Scale Armor', slot: 'body',  damage: 9 }
};

// ---- Area enemies (slice 10c-ii / 16, reworked for profile-owned state): monsters along
// each combat area's trail, easy → hard. Walk into one (or tap Action beside it) to start
// a battle.
//
// ENEMY_SPAWNS holds the IMMUTABLE spawn definitions (where each enemy stands and what it
// is). It is a shared template: nothing at runtime may mutate it. The MUTABLE life state
// ({ alive, respawnAt }) belongs to the selected PROFILE: it is rebuilt from the profile's
// save on load (buildProfileEnemies) and persisted per profile under
// areas.<area>.enemies.<spawnId> in save v3, so one kid's defeats never touch the other's
// world. Dead enemies revive when their 30-second respawnAt expires; the timer is honored
// across travel, reload, and profile switches — leaving and returning does NOT revive
// anything early.
var ENEMY_SPAWNS = {
  wilds: [
    { row: 8, col: 8,  type: 'slime'  },
    { row: 8, col: 14, type: 'bat'    },
    { row: 8, col: 20, type: 'goblin' }
  ],
  deepwoods: [
    { row: 8, col: 8,  type: 'wolf'  },
    { row: 8, col: 14, type: 'bear'  },
    { row: 8, col: 20, type: 'troll' },
    { row: 8, col: 22, type: 'shadow_warden' }  // the boss, at the very end of the trail
  ],
  // The Mine (slice 20): tier-3 trail, two enemies then the Crystal Wyrm boss at the end.
  mine: [
    { row: 8, col: 8,  type: 'rock_golem'   },
    { row: 8, col: 14, type: 'magma_slug'   },
    { row: 8, col: 22, type: 'crystal_wyrm' }  // the boss, at the very end of the trail
  ]
};

// Stable, area-qualified spawn ID — the save key for one placed enemy's mutable state.
// Derived from area + type + position so it survives reordering of the spawn arrays.
function enemySpawnId(area, spawn) {
  return area + ':' + spawn.type + ':r' + spawn.row + 'c' + spawn.col;
}

// Build the selected profile's runtime enemy collections from the immutable templates
// plus that profile's saved mutable state ({ alive, respawnAt } by spawn ID). Unknown
// saved IDs are ignored; missing entries mean "alive" (the legacy default); an already-
// expired respawn timer normalizes to alive right here so stale timers never linger.
function buildProfileEnemies(savedAreas) {
  var built = {};
  for (var area in ENEMY_SPAWNS) {
    var savedForArea = (savedAreas && savedAreas[area] && savedAreas[area].enemies) || {};
    built[area] = [];
    for (var i = 0; i < ENEMY_SPAWNS[area].length; i++) {
      var spawn = ENEMY_SPAWNS[area][i];
      var id = enemySpawnId(area, spawn);
      var saved = savedForArea[id];
      var runtime = { id: id, row: spawn.row, col: spawn.col, type: spawn.type,
                      alive: true, respawnAt: 0 };
      if (saved && saved.alive === false) {
        if (typeof saved.respawnAt === 'number' && isFinite(saved.respawnAt) &&
            saved.respawnAt > Date.now()) {
          runtime.alive = false;
          runtime.respawnAt = saved.respawnAt;
        }
        // else: timer expired (or malformed) → stays alive with a cleared timer.
      }
      built[area].push(runtime);
    }
  }
  return built;
}

// Serialize the profile-owned runtime state back into the save v3 shape.
function serializeProfileEnemies() {
  var out = {};
  for (var area in AREA_ENEMIES) {
    out[area] = {};
    for (var i = 0; i < AREA_ENEMIES[area].length; i++) {
      var e = AREA_ENEMIES[area][i];
      out[area][e.id] = { alive: !!e.alive, respawnAt: e.alive ? 0 : (e.respawnAt || 0) };
    }
  }
  return out;
}

// The SELECTED PROFILE's runtime enemy collections, keyed by area. Rebuilt on every
// profile load (applyState → buildProfileEnemies). Areas not listed (farm/town) have
// no enemies.
var AREA_ENEMIES = buildProfileEnemies(null);
// Live pointer to the current area's enemies (mirrors how `map`/`cropData` work).
var currentEnemies = [];

// ---- Crop state per area: keyed by "row,col" for each soil tile ----
// Each entry: { status: 'empty'|'growing'|'ready', plantedAt: number }
function initAreaCrops(name) {
  var m = areas[name].map;
  var crops = {};
  for (var r = 0; r < MAP_H; r++) {
    for (var c = 0; c < MAP_W; c++) {
      if (m[r][c] === SOIL) crops[r + ',' + c] = { status: 'empty', plantedAt: 0, type: null };
    }
  }
  areas[name].crops = crops;
}
initAreaCrops('farm');
initAreaCrops('town');
initAreaCrops('wilds');     // no soil in the Wilds, so this stays empty (kept for consistency)
initAreaCrops('deepwoods'); // likewise no soil in the Deep Woods
initAreaCrops('mine');      // no soil in the Mine either (kept for save-format consistency)

// Decorations: small sprites drawn on top of grass to break up monotony.
var AREA_DECORATIONS = {
  farm: [
    {col:2, row:1, spr:'deco_flowers'}, {col:8, row:2, spr:'deco_flowers'},
    {col:15, row:10, spr:'deco_flowers'}, {col:6, row:12, spr:'deco_flowers'},
    {col:10, row:9, spr:'deco_flowers'}, {col:1, row:8, spr:'deco_flowers'},
    {col:22, row:3, spr:'deco_flowers'}, {col:25, row:15, spr:'deco_flowers'},
    {col:11, row:1, spr:'deco_boulder'}, {col:18, row:11, spr:'deco_boulder'},
    {col:24, row:2, spr:'deco_boulder'}, {col:27, row:18, spr:'deco_boulder'},
    {col:4, row:10, spr:'deco_stump'}, {col:21, row:17, spr:'deco_stump'},
    {col:9, row:12, spr:'deco_stone'}, {col:2, row:10, spr:'deco_stone'},
    {col:12, row:2, spr:'deco_stone'}, {col:26, row:12, spr:'deco_stone'},
    // a little paddock fence run (decorative, no collision)
    {col:7, row:11, proc:'fence'}, {col:8, row:11, proc:'fence'},
    {col:9, row:11, proc:'fence'}, {col:10, row:11, proc:'fence'},
    // signpost by the right-edge exit → Town
    {col:27, row:7, proc:'signpost', dir:'right', label:'Town'}
  ],
  town: [
    {col:4, row:3, spr:'deco_flowers'}, {col:12, row:3, spr:'deco_flowers'},
    {col:16, row:2, spr:'deco_flowers'}, {col:26, row:5, spr:'deco_flowers'},
    {col:8, row:17, spr:'deco_flowers'}, {col:18, row:17, spr:'deco_flowers'},
    {col:10, row:8, spr:'deco_flowers'}, {col:24, row:14, spr:'deco_flowers'},
    {col:1, row:13, spr:'deco_boulder'}, {col:27, row:13, spr:'deco_boulder'},
    {col:15, row:2, spr:'deco_boulder'}, {col:7, row:19, spr:'deco_boulder'},
    {col:4, row:17, spr:'deco_stump'}, {col:25, row:17, spr:'deco_stump'},
    {col:13, row:1, spr:'deco_stone'}, {col:16, row:18, spr:'deco_stone'},
    {col:20, row:19, spr:'deco_stone'}, {col:3, row:8, spr:'deco_stone'},
    // Well in the center of the plaza
    {col:14, row:14, proc:'well'},
    // Signposts at both exits
    {col:2, row:9, proc:'signpost', dir:'left', label:'Farm'},
    {col:27, row:9, proc:'signpost', dir:'right', label:'Wilds'},
    // Fences along the main road
    {col:4, row:9, proc:'fence'}, {col:5, row:9, proc:'fence'},
    {col:24, row:9, proc:'fence'}, {col:25, row:9, proc:'fence'}
  ],
  wilds: [
    {col:3, row:3, spr:'deco_boulder'}, {col:12, row:5, spr:'deco_boulder'},
    {col:17, row:3, spr:'deco_boulder'}, {col:7, row:11, spr:'deco_stump'},
    {col:15, row:12, spr:'deco_stump'}, {col:9, row:4, spr:'deco_flowers'},
    {col:5, row:8, spr:'deco_stone'}, {col:14, row:2, spr:'deco_stone'},
    {col:19, row:10, spr:'deco_stone'}, {col:2, row:12, spr:'deco_boulder'},
    {col:10, row:10, spr:'deco_stump'},
    {col:24, row:4, spr:'deco_flowers'}, {col:26, row:14, spr:'deco_flowers'},
    {col:22, row:16, spr:'deco_stump'}, {col:25, row:6, spr:'deco_boulder'},
    {col:2, row:7, proc:'signpost', dir:'left', label:'Town'},
    {col:27, row:7, proc:'signpost', dir:'right', label:'Woods'}
  ],
  deepwoods: [
    {col:2, row:2, spr:'deco_stump'}, {col:9, row:6, spr:'deco_stump'},
    {col:16, row:2, spr:'deco_boulder'}, {col:13, row:11, spr:'deco_boulder'},
    {col:7, row:3, spr:'deco_flowers'}, {col:18, row:12, spr:'deco_flowers'},
    {col:4, row:10, spr:'deco_stump'}, {col:15, row:8, spr:'deco_stump'},
    {col:11, row:2, spr:'deco_boulder'}, {col:6, row:12, spr:'deco_stone'},
    {col:19, row:4, spr:'deco_stone'},
    {col:24, row:5, spr:'deco_stump'}, {col:26, row:14, spr:'deco_boulder'},
    {col:2, row:7, proc:'signpost', dir:'left', label:'Wilds'},
    {col:27, row:7, proc:'signpost', dir:'right', label:'Mine'}
  ],
  mine: [
    {col:5, row:3, spr:'deco_boulder'}, {col:12, row:2, spr:'deco_boulder'},
    {col:18, row:5, spr:'deco_boulder'}, {col:8, row:11, spr:'deco_boulder'},
    {col:3, row:8, spr:'deco_stone'}, {col:15, row:10, spr:'deco_stone'},
    {col:10, row:4, spr:'deco_stone'}, {col:19, row:12, spr:'deco_boulder'},
    {col:7, row:6, spr:'deco_stone'},
    {col:2, row:7, proc:'signpost', dir:'left', label:'Woods'}
  ]
};

// ---- Live pointers to the area the player is currently in. ----
// map / cropData always reference the active area, so the rest of the engine
// (drawing, collision, farming) needs no changes.
var currentArea = 'farm';
var map = areas.farm.map;
var cropData = areas.farm.crops;

function activateArea(name) {
  currentArea = name;
  map = areas[name].map;
  cropData = areas[name].crops;
  currentEnemies = AREA_ENEMIES[name] || [];
  applyCanvasMode();   // iso areas resize the canvas; legacy areas restore 640x480
}

