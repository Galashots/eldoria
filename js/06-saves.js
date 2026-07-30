// ---- Profiles & saving (localStorage, one save per kid) ----
// SAVE FORMAT v2 (slice 14, audit-hardening). The save is now versioned and grouped:
//   { version:2, area, x, y, player:{...}, areas:{ farm:{tiles}, town:{tiles}, wilds:{tiles} } }
// `player` holds everything about the hero (gold, seeds, crops, combat, gear, food);
// `areas.<name>.tiles` holds each area's per-plot soil state (keyed "row,col").
// applyState() still loads every OLDER flat save (v1/v0: farmTiles/townTiles/tiles,
// numeric seeds/crops) by normalizing it into the same shape — see normalizeSave().
var SAVE_VERSION = 2;

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
      dumplings: {},
      dumplingDough: 0,
      pullsSinceLegendary: 0
    },
    areas: { farm: { tiles: null }, town: { tiles: null }, wilds: { tiles: null }, deepwoods: { tiles: null }, mine: { tiles: null } }
  };
}

// Normalize ANY saved shape (v2 nested, or v1/v0 flat) into one predictable object:
//   { area, x, y, p:{...player fields...}, tiles:{ farm, town, wilds } }
// This is the single place that knows about old layouts, so applyState() below stays clean.
function normalizeSave(s) {
  s = s || {};
  var out = { area: s.area, x: s.x, y: s.y, p: {}, tiles: {} };
  if (s.version >= 2 && s.player) {
    // v2: hero fields live under .player, soil under .areas.<name>.tiles
    out.p = s.player;
    out.tiles.farm      = (s.areas && s.areas.farm)      ? s.areas.farm.tiles      : null;
    out.tiles.town      = (s.areas && s.areas.town)      ? s.areas.town.tiles      : null;
    out.tiles.wilds     = (s.areas && s.areas.wilds)     ? s.areas.wilds.tiles     : null;
    out.tiles.deepwoods = (s.areas && s.areas.deepwoods) ? s.areas.deepwoods.tiles : null;
    out.tiles.mine      = (s.areas && s.areas.mine)      ? s.areas.mine.tiles      : null;
  } else {
    // v1/v0 (flat): hero fields sit directly on the save; soil under farmTiles/townTiles
    // (and the very first single-area saves used `tiles` for the farm).
    out.p = s;
    out.tiles.farm      = s.farmTiles || s.tiles || null;
    out.tiles.town      = s.townTiles || null;
    out.tiles.wilds     = null;
    out.tiles.deepwoods = null;
    out.tiles.mine      = null;
  }
  return out;
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

function applyState(s) {
  var n = normalizeSave(s);
  var p = n.p;

  player.gold = (p.gold != null) ? p.gold : 10;
  player.questsDone = (p.questsDone != null) ? p.questsDone : 0;

  // Combat fields (slice 10c). Old saves predate these — default to a fresh level-1
  // hero at full HP so they load with no errors and no lost progress.
  player.level = (p.level != null) ? p.level : 1;
  player.maxHp = (p.maxHp != null) ? p.maxHp : 20;
  player.hp = (p.hp != null) ? p.hp : player.maxHp;
  if (player.hp > player.maxHp) player.hp = player.maxHp;   // guard against odd saves
  player.xp = (p.xp != null) ? p.xp : 0;
  // Heart Crystals bought (slice 19). Old saves predate it — default to 0.
  player.hpUpgrades = (p.hpUpgrades != null) ? p.hpUpgrades : 0;
  // Training sessions bought (slice 21). Old saves predate it — default to 0.
  player.atkUpgrades = (p.atkUpgrades != null) ? p.atkUpgrades : 0;

  // Gear (slice 10c-ii). Old saves have no gear field — default to all-empty slots.
  if (p.gear) {
    player.gear = {};
    for (var gs = 0; gs < EQUIPMENT_SLOTS.length; gs++)
      player.gear[EQUIPMENT_SLOTS[gs]] = p.gear[EQUIPMENT_SLOTS[gs]] || null;
  } else {
    player.gear = { weapon: null, head: null, body: null, cape: null };
  }

  // Spare-gear bag (slice 18). Old saves predate it — default to empty. Keep only ids
  // that are real gear, so a corrupt/edited save can't break the shop's sell list.
  player.inventory = [];
  if (Array.isArray(p.inventory)) {
    for (var iv = 0; iv < p.inventory.length; iv++)
      if (GEAR[p.inventory[iv]]) player.inventory.push(p.inventory[iv]);
  }

  // Food (slice 13a). Old saves predate it — default to an empty larder.
  player.food = {};
  for (var fi = 0; fi < FOOD_TYPES.length; fi++)
    player.food[FOOD_TYPES[fi]] = (p.food && p.food[FOOD_TYPES[fi]]) || 0;

  // Kill quest tracking (slice 26). Old saves default to empty.
  player.killCounts = p.killCounts || {};
  player.killQuest = p.killQuest || null;

  // Friendship meters (town villagers). Old saves default to 0.
  player.friends = {};
  for (var fi2 = 0; fi2 < NPCS.length; fi2++)
    player.friends[NPCS[fi2].id] = (p.friends && p.friends[NPCS[fi2].id]) || 0;

  // Squishy Dumpling collection MVP. Old saves predate it and start with an empty shelf.
  player.dumplings = {};
  for (var du = 0; du < DUMPLINGS.length; du++) {
    var savedCount = p.dumplings && parseInt(p.dumplings[DUMPLINGS[du].id], 10);
    if (savedCount > 0) player.dumplings[DUMPLINGS[du].id] = savedCount;
  }
  player.dumplingDough = Math.max(0, parseInt(p.dumplingDough, 10) || 0);
  player.pullsSinceLegendary = Math.max(0,
    Math.min(DUMPLING_PITY_PULLS - 1, parseInt(p.pullsSinceLegendary, 10) || 0));
  selectedDumplingId = firstOwnedDumplingId();

  // Old saves stored seeds/crops as plain numbers → convert to per-type objects.
  if (typeof p.seeds === 'number' || p.seeds == null) {
    var sc = (p.seeds != null) ? p.seeds : 4;
    player.seeds = { turnip: sc, carrot: 0, pumpkin: 0 };
  } else {
    player.seeds = {};
    for (var i = 0; i < CROP_TYPES.length; i++)
      player.seeds[CROP_TYPES[i]] = p.seeds[CROP_TYPES[i]] || 0;
  }
  if (typeof p.crops === 'number' || p.crops == null) {
    var cc = (p.crops != null) ? p.crops : 0;
    player.crops = { turnip: cc, carrot: 0, pumpkin: 0 };
  } else {
    player.crops = {};
    for (var i2 = 0; i2 < CROP_TYPES.length; i2++)
      player.crops[CROP_TYPES[i2]] = p.crops[CROP_TYPES[i2]] || 0;
  }

  // Per-area soil state (farm/town/wilds). Wilds has no soil today, so its tiles stay
  // empty — but the slot exists so future Wilds plots/chests can save with no new format.
  restoreAreaCrops('farm', n.tiles.farm);
  restoreAreaCrops('town', n.tiles.town);
  restoreAreaCrops('wilds', n.tiles.wilds);
  restoreAreaCrops('deepwoods', n.tiles.deepwoods);
  restoreAreaCrops('mine', n.tiles.mine);

  var area = areas[n.area] ? n.area : 'farm';   // accept any known area; default to farm
  activateArea(area);

  player.x = (n.x != null) ? n.x : 5 * TILE;
  player.y = (n.y != null) ? n.y : 8 * TILE;

  // Visual overlays need no sync step: they read player.gear directly, which this
  // function has already restored (see hasVisualEquipment).
}

function loadGame(profile) {
  try {
    var raw = localStorage.getItem('eldoria_save_' + profile);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
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
      pullsSinceLegendary: player.pullsSinceLegendary
    },
    areas: {
      farm:      { tiles: areas.farm.crops },
      town:      { tiles: areas.town.crops },
      wilds:     { tiles: areas.wilds.crops },
      deepwoods: { tiles: areas.deepwoods.crops },
      mine:      { tiles: areas.mine.crops }
    }
  };
  try { localStorage.setItem('eldoria_save_' + currentProfile, JSON.stringify(data)); } catch (e) {}
}

// The neutral default label for each slot, shown until the player types their own name.
var DEFAULT_NAMES = { adventurer: 'Adventurer', mage: 'Mage' };

// What to show for a slot: the player's typed-in name, or the neutral default. The
// typed name lives only in localStorage on this device — it is never in the game files.
function profileDisplayName(id) {
  try {
    var n = localStorage.getItem('eldoria_name_' + id);
    if (n && n.trim()) return n.trim();
  } catch (e) {}
  return DEFAULT_NAMES[id] || 'Hero';
}

// (Legacy name-keyed save migration removed for the public release. The old first-version
// saves were long since copied onto the neutral profile ids; saves now live only under
// eldoria_save_adventurer / eldoria_save_mage.)

// Repaint the two title-screen buttons with the current display names.
function refreshTitleLabels() {
  for (var id in DEFAULT_NAMES) {
    var el = document.getElementById('label-' + id);
    if (el) el.textContent = profileDisplayName(id);
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

// Pick a slot: migrate any old save, load it (or a fresh start), and begin playing.
function selectProfile(id) {
  currentProfile = id;
  applyState(loadGame(id) || defaultState());
  document.getElementById('profileName').textContent = profileDisplayName(id);
  document.getElementById('titleScreen').classList.add('hide');
  gameActive = true;
  updateHUD();
  if (!gameMuted) bgMusic.play().catch(function() {});
}

// Save and go back to the profile picker.
function switchProfile() {
  saveGame();
  closeShop();
  gameActive = false;
  currentProfile = null;
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
  document.getElementById('saveToolsModal').classList.add('open');
  focusModal('saveToolsModal');
}
function closeSaveTools() {
  document.getElementById('saveToolsModal').classList.remove('open');
  restoreFocus();
}
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
    try { JSON.parse(txt); } catch (err) { showToast("That file isn't a valid save."); return; }
    try {
      localStorage.setItem('eldoria_save_' + saveToolsProfile, txt);
      showToast('Loaded ' + name + "'s save from file!");
      document.getElementById('saveToolsText').value = txt;
    } catch (err) { showToast('Could not save (storage full?).'); }
  };
  reader.readAsText(file);
  evt.target.value = '';
}
// Import: validate pasted text is real JSON, then write it into the selected slot.
function importSave() {
  var txt = (document.getElementById('saveToolsText').value || '').trim();
  var name = profileDisplayName(saveToolsProfile);
  if (!txt) { showToast('Paste a backup first.'); return; }
  try { JSON.parse(txt); } catch (e) { showToast("That isn't valid save text."); return; }
  try {
    localStorage.setItem('eldoria_save_' + saveToolsProfile, txt);
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

