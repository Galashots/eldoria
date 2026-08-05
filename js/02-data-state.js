// ---- Tile types ----
// ROCK/CAVE exist so the Mine can read as an underground cavern instead of borrowing the
// forest's TREE tiles for its walls, which made the endgame zone look like a hedge maze
// (ELD-PT-003). Tile ids are never serialized — area maps are rebuilt from their build*Map()
// function on every load and only crop state is saved — so appending ids is save-safe.
var GRASS = 0, WATER = 1, TREE = 2, SOIL = 3, PATH = 4, HOUSE = 5, DOOR = 6, EXIT = 7,
    ROCK = 8, CAVE = 9;

var BLOCKED = {};
BLOCKED[WATER] = true;
BLOCKED[TREE]  = true;
BLOCKED[HOUSE] = true;
BLOCKED[ROCK]  = true;

var TILE_COLOR = {};
TILE_COLOR[GRASS] = '#4f8a35';
TILE_COLOR[WATER] = '#2a6cc0';
TILE_COLOR[TREE]  = '#1f5c1f';
TILE_COLOR[SOIL]  = '#6b4226';
TILE_COLOR[PATH]  = '#c9a86a';
TILE_COLOR[HOUSE] = '#8a8a8a';
TILE_COLOR[DOOR]  = '#7a4a1a';   // a wooden door you can walk onto (not blocked)
TILE_COLOR[EXIT]  = '#d4b483';   // a road tile at the map edge: step on it to travel
TILE_COLOR[ROCK]  = '#4a4152';   // cavern wall: cool violet-grey, clearly not foliage
TILE_COLOR[CAVE]  = '#2e2733';   // cavern floor: darker than the wall so the track reads

// ---- Sprite art (slice 8) ----
// Drop PNG files into the ./assets folder and they replace the gray boxes automatically.
// Any file that is missing or fails to load simply falls back to its colored shape, so
// the game ALWAYS renders. Everything is local & offline (relative paths, no network).
// See assets/README.md for the exact file list and recommended sizes.
var SPRITES = {};
function loadSprite(name, file) {
  var rec = { img: new Image(), ready: false };
  rec.img.onload  = function () { rec.ready = true; };
  rec.img.onerror = function () { rec.ready = false; };   // missing file → keep the fallback shape
  rec.img.src = file;
  SPRITES[name] = rec;
}
// Returns the loaded image for `name`, or null if it isn't available (use the fallback).
function spr(name) { var r = SPRITES[name]; return (r && r.ready) ? r.img : null; }

// Which file backs each tile type. Rename here if you prefer other filenames.
var TILE_SPRITE = {};
TILE_SPRITE[GRASS] = 'assets/grass.png';
TILE_SPRITE[WATER] = 'assets/water.png';
TILE_SPRITE[TREE]  = 'assets/tree.png';
TILE_SPRITE[SOIL]  = 'assets/soil.png';
TILE_SPRITE[PATH]  = 'assets/path.png';
TILE_SPRITE[HOUSE] = 'assets/house.png';
TILE_SPRITE[DOOR]  = 'assets/door.png';
TILE_SPRITE[EXIT]  = 'assets/exit.png';
// Optional cavern art. Absent today, so both fall back to their drawn shapes (below);
// dropping the PNGs in later upgrades the Mine with no code change.
TILE_SPRITE[ROCK]  = 'assets/rock.png';
TILE_SPRITE[CAVE]  = 'assets/cave-floor.png';

// Kick off loading everything up front (async; sprites pop in as they finish).
for (var ts in TILE_SPRITE) loadSprite('tile_' + ts, TILE_SPRITE[ts]);

// Farm iso terrain is preloaded as one complete batch. The renderer never creates
// terrain image requests on first use: every required transition and grass-base
// variant is registered while the data script is booting, then decoded before the
// first textured Farm frame is allowed to display.
var ISO_TERRAIN_FAMILIES = ['path', 'soil', 'water'];
var ISO_TERRAIN_MASKS = [];
var ISO_TERRAIN_ASSET_NAMES = [];
var isoTerrainDecodedCount = 0;
var isoTerrainSettledCount = 0;
var isoTerrainAllDecoded = false;
var isoTerrainPreloadSettled = false;
for (var im = 0; im < 16; im++) ISO_TERRAIN_MASKS.push(im);

function loadIsoTerrainSprite(name, file) {
  var rec = { img: new Image(), ready: false };
  rec.img.decoding = 'sync';
  rec.img.onload = function () {
    var finish = function () {
      if (rec.ready) return;
      rec.ready = true;
      isoTerrainDecodedCount++;
      isoTerrainSettledCount++;
      isoTerrainAllDecoded = isoTerrainDecodedCount === ISO_TERRAIN_ASSET_NAMES.length;
      isoTerrainPreloadSettled = isoTerrainSettledCount === ISO_TERRAIN_ASSET_NAMES.length;
    };
    if (typeof rec.img.decode === 'function') rec.img.decode().then(finish, finish);
    else finish();
  };
  rec.img.onerror = function () {
    rec.ready = false;
    isoTerrainSettledCount++;
    isoTerrainPreloadSettled = isoTerrainSettledCount === ISO_TERRAIN_ASSET_NAMES.length;
  };
  rec.img.src = file;
  SPRITES[name] = rec;
  ISO_TERRAIN_ASSET_NAMES.push(name);
}

for (var itf = 0; itf < ISO_TERRAIN_FAMILIES.length; itf++) {
  var terrainFamily = ISO_TERRAIN_FAMILIES[itf];
  for (var itm = 0; itm < ISO_TERRAIN_MASKS.length; itm++) {
    var terrainMask = String(ISO_TERRAIN_MASKS[itm]).padStart(2, '0');
    loadIsoTerrainSprite('iso_terrain_' + terrainFamily + '_' + terrainMask,
                         'assets/iso/terrain/' + terrainFamily + '-' + terrainMask + '.png');
  }
  loadIsoTerrainSprite('iso_terrain_grass_base_' + terrainFamily,
                       'assets/iso/terrain/grass-base-' + terrainFamily + '.png');
}
// Profile-specific, eight-direction player sprites. The legacy player.png stays loaded
// as a compatibility fallback while new art is still being added one file at a time.
// The original four slots keep their names and iso art mapping (right=SE, down=SW,
// left=NW, up=NE); the four world-diagonal slots map to the compass cardinals
// (down-right=S, down-left=W, up-left=N, up-right=E).
var PLAYER_DIRECTIONS = ['down', 'up', 'left', 'right',
                         'down-right', 'down-left', 'up-left', 'up-right'];
// Attack strips and equipment overlays are still authored against the original
// four facings only; requesting the missing diagonal files would 404 every boot.
var OVERLAY_DIRECTIONS = ['down', 'up', 'left', 'right'];
// Profiles are identified by reading level, not by a child's name: 'adventurer' is
// the older-reader slot, 'mage' is the early-reader slot. These ids double as the
// sprite-file prefixes (assets/adventurer-down.png, assets/mage-up-walk.png, ...).
var PLAYER_PROFILES = ['adventurer', 'mage'];
var EQUIPMENT_SLOTS = ['head', 'body', 'weapon', 'cape'];

// ---- Canonical hero identity manifest (Step 5) ----
// ONE static table governs every player-facing identity surface: default role label,
// title-screen identity + grade, title portrait source, and the Character-screen
// paper doll. 'adventurer' / 'mage' stay the INTERNAL profile IDs, localStorage
// save-key suffixes, and sprite-file prefixes — the manifest only decides what the
// kids SEE. Ranger and Mage are equal heroes; the grade label records each reader's
// math level, never an easier or harder mode.
var HERO_IDENTITIES = {
  adventurer: {
    role: 'Ranger',
    defaultName: 'Ranger',
    gradeLabel: 'Grade 5',
    // down-right IS compass south under the approved eight-direction mapping — the
    // strongest face-visible view, so it is the title portrait for both heroes.
    titlePortrait: 'assets/adventurer-down-right.png',
    // Equipment overlays are authored for the original four facings only (see
    // OVERLAY_DIRECTIONS), so the paper doll uses 'right' — the face-visible view
    // that can also dress its hero. The title portrait stays exact south.
    paperDollDirection: 'right'
  },
  mage: {
    role: 'Mage',
    defaultName: 'Mage',
    gradeLabel: 'Grade 2',
    titlePortrait: 'assets/mage-down-right.png',
    paperDollDirection: 'right'
  }
};
var WALK_FRAMES = 4;
var WALK_FRAME_MS = 110;
for (var pp = 0; pp < PLAYER_PROFILES.length; pp++) {
  for (var pd = 0; pd < PLAYER_DIRECTIONS.length; pd++) {
    var profile = PLAYER_PROFILES[pp];
    var direction = PLAYER_DIRECTIONS[pd];
    loadSprite('player_' + profile + '_' + direction,
      'assets/' + profile + '-' + direction + '.png');
    loadSprite('player_walk_' + profile + '_' + direction,
      'assets/' + profile + '-' + direction + '-walk.png');
    if (OVERLAY_DIRECTIONS.indexOf(direction) === -1) continue;
    loadSprite('player_attack_' + profile + '_' + direction,
      'assets/' + profile + '-' + direction + '-attack.png');
    for (var es = 0; es < EQUIPMENT_SLOTS.length; es++) {
      var slot = EQUIPMENT_SLOTS[es];
      loadSprite('equipment_' + profile + '_' + direction + '_' + slot,
        'assets/' + profile + '-' + direction + '-' + slot + '.png');
      loadSprite('equipment_walk_' + profile + '_' + direction + '_' + slot,
        'assets/' + profile + '-' + direction + '-' + slot + '-walk.png');
      loadSprite('equipment_attack_' + profile + '_' + direction + '_' + slot,
        'assets/' + profile + '-' + direction + '-' + slot + '-attack.png');
    }
  }
}
loadSprite('player', 'assets/player.png');
loadSprite('crop_growing', 'assets/crop_growing.png');
loadSprite('crop_ready', 'assets/crop_ready.png');
// Enemy sprites (slice 23 art pass). Each replaces the hand-drawn placeholder shape.
var ENEMY_TYPES_ALL = ['slime','bat','goblin','wolf','bear','troll','rock_golem','magma_slug','crystal_wyrm','shadow_warden'];
for (var ei = 0; ei < ENEMY_TYPES_ALL.length; ei++)
  loadSprite('enemy_' + ENEMY_TYPES_ALL[ei], 'assets/enemy_' + ENEMY_TYPES_ALL[ei] + '.png');
loadSprite('npc_mira', 'assets/npc_mira.png');
// Town's isometric NPCs are stationary idle characters today: use the supplied
// south-facing (engine slot down-right) frame while retaining the existing
// procedural fallback. The other seven supplied rotations remain source material
// until NPC facing/state data exists; this avoids inventing movement behavior here.
var ISO_NPC_IDLE_DIRECTION_KEY = 'down_right';
var ISO_NPC_IDS = ['mira', 'bram', 'gunnar'];
for (var ini = 0; ini < ISO_NPC_IDS.length; ini++) {
  var isoNpcId = ISO_NPC_IDS[ini];
  loadSprite('iso_npc_' + isoNpcId + '_' + ISO_NPC_IDLE_DIRECTION_KEY,
    'assets/iso/npc/' + isoNpcId + '-down-right.png');
}
loadSprite('cookpot', 'assets/cookpot.png');
loadSprite('shop_building', 'assets/shop_building.png');
loadSprite('grass2', 'assets/grass2.png');
loadSprite('grass3', 'assets/grass3.png');
loadSprite('deco_flowers', 'assets/flowers.png');
loadSprite('deco_boulder', 'assets/boulder.png');
loadSprite('deco_stump', 'assets/tree_stump.png');
loadSprite('deco_stone', 'assets/stone.png');

// Which equipment layers to draw. This is DERIVED from player.gear rather than stored,
// so the hero on screen can never disagree with the saved gear that combat and the shop
// actually use (ELD-PT-007). There is one source of truth; boot, import, equip and
// profile-switch all get the right answer for free because they all set player.gear.
function hasVisualEquipment(slot) {
  if (!currentProfile || EQUIPMENT_SLOTS.indexOf(slot) === -1) return false;
  return !!(player.gear && player.gear[slot]);
}

// Profile art is kept separate so equipment never lands on the legacy fallback sprite.
function profilePlayerSprite() {
  if (!currentProfile) return null;
  return spr('player_' + currentProfile + '_' + player.facing);
}

// A walk strip is 4 x 32px frames laid out horizontally. Never use one without
// its matching static base: that keeps partial art installs graceful.
function playerWalkSprite() {
  if (!currentProfile || !player.walking || !profilePlayerSprite()) return null;
  return spr('player_walk_' + currentProfile + '_' + player.facing);
}

function playerAttackSprite() {
  if (!currentProfile || !player.attacking || !profilePlayerSprite()) return null;
  return spr('player_attack_' + currentProfile + '_' + player.facing);
}

var ATTACK_FRAMES = 4;
var ATTACK_FRAME_MS = 80;

function equipmentAttackSprite(slot) {
  if (!player.attacking || !hasVisualEquipment(slot)) return null;
  return spr('equipment_attack_' + currentProfile + '_' + player.facing + '_' + slot);
}

function equipmentSprite(slot) {
  if (!hasVisualEquipment(slot)) return null;
  return spr('equipment_' + currentProfile + '_' + player.facing + '_' + slot);
}

function equipmentWalkSprite(slot) {
  if (!player.walking || !hasVisualEquipment(slot)) return null;
  return spr('equipment_walk_' + currentProfile + '_' + player.facing + '_' + slot);
}

function drawSpriteFrame(img, stripType, dx, dy) {
  // Frames are square, so the frame edge is the image height. Strips are at least
  // two frames wide — this keeps 128x32 legacy strips and 256x64 pipeline strips
  // both slicing correctly, and a 64x64 static can never be mistaken for a strip.
  var fw = img.naturalHeight;
  var isStrip = img.naturalWidth >= fw * 2;
  if (stripType === 'walk' && isStrip) {
    ctx.drawImage(img, player.walkFrame * fw, 0, fw, fw, dx, dy, TILE, TILE);
  } else if (stripType === 'attack' && isStrip) {
    ctx.drawImage(img, player.attackFrame * fw, 0, fw, fw, dx, dy, TILE, TILE);
  } else {
    ctx.drawImage(img, dx, dy, TILE, TILE);
  }
}

// Bucket a world motion vector into one of the eight facing slots. Octant 0 is
// pure +x ('right'); each further octant is 45 degrees clockwise in world space
// (screen-y grows downward, so atan2 already runs clockwise).
var FACING_OCTANTS = ['right', 'down-right', 'down', 'down-left',
                      'left', 'up-left', 'up', 'up-right'];
function facingFromVector(dx, dy) {
  var oct = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return FACING_OCTANTS[((oct % 8) + 8) % 8];
}

// Top-down keeps the original four facings: attack strips and equipment
// overlays only exist for those, so a diagonal facing under ?iso=0 would make
// the attack animation and equipped gear vanish. Diagonal input prefers the
// stronger axis; tied diagonals keep the horizontal direction (pre-8-direction
// behavior, unchanged).
function cardinalFromVector(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}
// Snap map for a diagonal facing carried into top-down mode (iso save, mode
// toggle): same horizontal-wins rule as cardinalFromVector.
var FACING_TO_CARDINAL = { 'down-right': 'right', 'up-right': 'right',
                           'down-left': 'left', 'up-left': 'left' };

// Prefer the selected child's directional art. Missing new art falls back to the
// original single player.png, then the existing yellow-box placeholder.
function playerSprite() {
  var directional = profilePlayerSprite();
  return directional || spr('player');
}

// ---- Crop types (slice 10a: crop variety) ----
// Each type has a different cost/reward/speed tradeoff — the math IS the strategy.
var CROPS = {
  turnip:    { name: 'Turnip',    cost: 2,  grow: 8000,  sell: 3,  color: '#66aa33', readyColor: '#88dd44' },
  carrot:    { name: 'Carrot',    cost: 4,  grow: 15000, sell: 5,  color: '#cc7722', readyColor: '#ff9933' },
  corn:      { name: 'Corn',      cost: 6,  grow: 20000, sell: 7,  color: '#e8c840', readyColor: '#ffe066' },
  pumpkin:   { name: 'Pumpkin',   cost: 8,  grow: 30000, sell: 9,  color: '#dd9922', readyColor: '#ffcc44' },
  starfruit: { name: 'Starfruit', cost: 15, grow: 45000, sell: 17, color: '#cc55cc', readyColor: '#ee88ee' }
};
var CROP_TYPES = ['turnip', 'carrot', 'corn', 'pumpkin', 'starfruit'];
// Crop Asset Lab: one three-frame iso strip per crop (sprout, growing, ready).
// Missing lab art keeps the existing deterministic canvas crop proof.
for (var ic = 0; ic < CROP_TYPES.length; ic++)
  loadSprite('iso_crop_' + CROP_TYPES[ic], 'assets/iso/crop-' + CROP_TYPES[ic] + '.png');

// ---- Squishy Dumplings MVP ----
// This slice proves the earned-gold pull, pity, duplicate, collection, and save loop.
// Buddy buffs are intentionally not active yet.
var DUMPLINGS = [
  { id: 'plain_bun',        name: 'Plain Bun',        rarity: 'common' },
  { id: 'rice_ball',        name: 'Rice Ball',        rarity: 'common' },
  { id: 'tofu_cube',        name: 'Tofu Cube',        rarity: 'common' },
  { id: 'egg_tart',         name: 'Egg Tart',         rarity: 'common' },
  { id: 'mochi_drop',       name: 'Mochi Drop',       rarity: 'common' },
  { id: 'pork_bun',         name: 'Pork Bun',         rarity: 'common' },
  { id: 'custard_bao',      name: 'Custard Bao',      rarity: 'rare' },
  { id: 'spicy_gyoza',      name: 'Spicy Gyoza',      rarity: 'rare' },
  { id: 'sesame_ball',      name: 'Sesame Ball',      rarity: 'rare' },
  { id: 'red_bean_bun',     name: 'Red Bean Bun',     rarity: 'rare' },
  { id: 'onion_pancake',    name: 'Onion Pancake',    rarity: 'rare' },
  { id: 'rainbow_mochi',    name: 'Rainbow Mochi',    rarity: 'epic' },
  { id: 'dragon_dumpling',  name: 'Dragon Dumpling',  rarity: 'epic' },
  { id: 'golden_gyoza',     name: 'Golden Gyoza',     rarity: 'epic' },
  { id: 'star_bao',         name: 'Star Bao',         rarity: 'epic' },
  { id: 'golden_dumpling',  name: 'Golden Dumpling',  rarity: 'legendary' },
  { id: 'warrior_dumpling', name: 'Warrior Dumpling', rarity: 'legendary' },
  { id: 'harvest_dumpling', name: 'Harvest Dumpling', rarity: 'legendary' }
];
var DUMPLING_BY_ID = {};
for (var di = 0; di < DUMPLINGS.length; di++) DUMPLING_BY_ID[DUMPLINGS[di].id] = DUMPLINGS[di];
var DUMPLING_BUNDLES = { 1: 20, 3: 50, 10: 150 };
var DUMPLING_DUPLICATE_REFUND = 4;
var DUMPLING_PITY_PULLS = 15;

// ---- Recipes (slice 13a: cooking) ----
// Each recipe turns crops into a food item that heals HP when eaten. The hidden math
// is RATIO/efficiency: which dish heals the most HP per crop you spend? (turnip soup is
// cheap-but-weak, pumpkin pie is expensive-but-strong.) `cost` is crops consumed, keyed
// by crop type; `heal` is HP restored per portion when eaten.
var RECIPES = {
  veggie_soup:      { name: 'Veggie Soup',      cost: { turnip: 2 },               heal: 8,  color: '#88cc55' },
  carrot_stew:      { name: 'Carrot Stew',      cost: { carrot: 2 },               heal: 18, color: '#ff9933' },
  corn_chowder:     { name: 'Corn Chowder',     cost: { corn: 2 },                 heal: 25, color: '#ffe066' },
  pumpkin_pie:      { name: 'Pumpkin Pie',      cost: { pumpkin: 1, carrot: 1 },   heal: 40, color: '#ffcc44' },
  starfruit_elixir: { name: 'Starfruit Elixir', cost: { starfruit: 1, pumpkin: 1 }, heal: 60, color: '#ee88ee' }
};
var FOOD_TYPES = ['veggie_soup', 'carrot_stew', 'corn_chowder', 'pumpkin_pie', 'starfruit_elixir'];

// ---- Player state ----
var player = {
  x: 5 * TILE,
  y: 8 * TILE,
  size: 22,
  speed: 2.4,
  facing: 'down',
  walking: false,
  walkFrame: 0,
  walkLastAt: 0,
  attackFrame: 0,
  attackLastAt: 0,
  attacking: false,
  gold: 10,
  seeds: { turnip: 4, carrot: 0, corn: 0, pumpkin: 0, starfruit: 0 },
  crops: { turnip: 0, carrot: 0, corn: 0, pumpkin: 0, starfruit: 0 },
  questsDone: 0,
  // ---- Combat stats (slice 10c) ----
  hp: 20, maxHp: 20,   // current / max health; lose a fight at 0, respawn at full
  level: 1, xp: 0,     // XP from winning fights; level up at level×50 XP
  hpUpgrades: 0,       // Heart Crystals bought in the shop (slice 19) — scales their price
  atkUpgrades: 0,      // Training sessions bought in the shop (slice 21) — scales their price
  gear: { weapon: null, head: null, body: null, cape: null },
  inventory: [],   // spare (un-equipped) gear item ids you can sell in the shop (slice 18)
  food: { veggie_soup: 0, carrot_stew: 0, corn_chowder: 0, pumpkin_pie: 0, starfruit_elixir: 0 },
  killCounts: {},
  killQuest: null,
  dumplings: {},
  dumplingDough: 0,
  pullsSinceLegendary: 0
};

var held = { up: false, down: false, left: false, right: false };

// ---- Shop state (the walk-in building) ----
var shopOpen = false;    // is the shop UI open?
var wasNearDoor = false; // was the player near the door last frame? (so we open only on approach)
var wasNearEnemy = false; // same idea for the Wilds enemy (open the battle only on approach)
var seedPickerOpen = false;  // is the "plant which seed?" picker showing?
var cookingOpen = false;     // is the cooking modal open?
var dumplingOpen = false;    // is the dumpling vendor / collection modal open?
var characterOpen = false;   // is the Character & Equipment screen open?
var selectedDumplingId = null;

// Totals across all crop types (for HUD and checks).
function totalSeeds() {
  var n = 0;
  for (var i = 0; i < CROP_TYPES.length; i++) n += player.seeds[CROP_TYPES[i]];
  return n;
}
function totalFood() {
  var n = 0;
  for (var i = 0; i < FOOD_TYPES.length; i++) n += player.food[FOOD_TYPES[i]];
  return n;
}
function totalCrops() {
  var n = 0;
  for (var i = 0; i < CROP_TYPES.length; i++) n += player.crops[CROP_TYPES[i]];
  return n;
}
function sellTotal() {
  var g = 0;
  for (var i = 0; i < CROP_TYPES.length; i++)
    g += player.crops[CROP_TYPES[i]] * CROPS[CROP_TYPES[i]].sell;
  return g;
}

// ---- Profile / save state ----
var currentProfile = null;   // 'adventurer' or 'mage' once chosen
var gameActive = false;      // false while the title/profile screen is up
var bgMusic = (typeof Audio !== 'undefined') ? new Audio('assets/music-town.mp3') : { loop: false, volume: 0, play: function(){ return Promise.resolve(); }, pause: function(){} };
bgMusic.loop = true;

var gameMuted = localStorage.getItem('eldoria_muted') === '1';
function toggleMute() {
  gameMuted = !gameMuted;
  localStorage.setItem('eldoria_muted', gameMuted ? '1' : '0');
  document.getElementById('muteBtn').innerHTML = gameMuted ? '&#x1f507;' : '&#x1f50a;';
  if (gameMuted) { bgMusic.pause(); } else if (gameActive) { bgMusic.play().catch(function(){}); }
}
// Sync button label on load
if (gameMuted) document.getElementById('muteBtn').innerHTML = '&#x1f507;';
bgMusic.volume = 0.35;

