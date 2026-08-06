// ---- Collision ----
function tileAtPixel(px, py) {
  var c = Math.floor(px / TILE);
  var r = Math.floor(py / TILE);
  if (r < 0 || r >= MAP_H || c < 0 || c >= MAP_W) return TREE;
  return map[r][c];
}

function boxIsBlocked(x, y) {
  var s = player.size;
  return BLOCKED[tileAtPixel(x, y)] ||
         BLOCKED[tileAtPixel(x + s, y)] ||
         BLOCKED[tileAtPixel(x, y + s)] ||
         BLOCKED[tileAtPixel(x + s, y + s)];
}

// ---- Which tile is the player facing / standing on? ----
function getFacingTile() {
  var cx = player.x + player.size / 2;
  var cy = player.y + player.size / 2;
  var col = Math.floor(cx / TILE);
  var row = Math.floor(cy / TILE);

  // Check the tile the player is on first, then adjacent tiles within 1 tile range
  var checks = [
    [row, col],
    [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]
  ];

  for (var i = 0; i < checks.length; i++) {
    var r = checks[i][0], c = checks[i][1];
    if (r >= 0 && r < MAP_H && c >= 0 && c < MAP_W && map[r][c] === SOIL) {
      return { row: r, col: c };
    }
  }
  return null;
}

// ---- Is the player on or next to a door tile? (forgiving shop entry) ----
function isNearDoor() {
  var col = Math.floor((player.x + player.size / 2) / TILE);
  var row = Math.floor((player.y + player.size / 2) / TILE);
  var checks = [
    [row, col],
    [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]
  ];
  for (var i = 0; i < checks.length; i++) {
    var r = checks[i][0], c = checks[i][1];
    if (r >= 0 && r < MAP_H && c >= 0 && c < MAP_W && map[r][c] === DOOR) return true;
  }
  return false;
}

// ---- Is the player on or next to any NPC? Returns the NPC object or null. ----
function isNearNPC() {
  var col = Math.floor((player.x + player.size / 2) / TILE);
  var row = Math.floor((player.y + player.size / 2) / TILE);
  var checks = [
    [row, col],
    [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]
  ];
  for (var n = 0; n < NPCS.length; n++) {
    if (NPCS[n].area !== currentArea) continue;
    for (var i = 0; i < checks.length; i++) {
      if (checks[i][0] === NPCS[n].row && checks[i][1] === NPCS[n].col) return NPCS[n];
    }
  }
  return null;
}

// ---- Is the player on or next to the Farm cooking pot? (same forgiving 1-tile range) ----
function isNearCookpot() {
  if (currentArea !== 'farm') return false;
  var col = Math.floor((player.x + player.size / 2) / TILE);
  var row = Math.floor((player.y + player.size / 2) / TILE);
  var checks = [
    [row, col],
    [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]
  ];
  for (var i = 0; i < checks.length; i++) {
    if (checks[i][0] === FARM_COOKPOT.row && checks[i][1] === FARM_COOKPOT.col) return true;
  }
  return false;
}

// ---- Is the player on or next to any live Wilds enemy? Returns the enemy object or null. ----
function isNearEnemy() {
  if (!AREA_ENEMIES[currentArea]) return null;
  var col = Math.floor((player.x + player.size / 2) / TILE);
  var row = Math.floor((player.y + player.size / 2) / TILE);
  var checks = [
    [row, col],
    [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]
  ];
  for (var e = 0; e < currentEnemies.length; e++) {
    var en = currentEnemies[e];
    if (!en.alive) continue;
    for (var i = 0; i < checks.length; i++) {
      if (checks[i][0] === en.row && checks[i][1] === en.col) return en;
    }
  }
  return null;
}

// ---- Shared proximity + direct-world interaction helpers ----
// Action and direct taps intentionally dispatch through the same gameplay functions.
// Tapping a distant target gives useful feedback but does not bypass world navigation.
function isPlayerNearTile(row, col) {
  var playerCol = Math.floor((player.x + player.size / 2) / TILE);
  var playerRow = Math.floor((player.y + player.size / 2) / TILE);
  return Math.abs(playerRow - row) + Math.abs(playerCol - col) <= 1;
}

function faceWorldTile(row, col) {
  var playerCol = Math.floor((player.x + player.size / 2) / TILE);
  var playerRow = Math.floor((player.y + player.size / 2) / TILE);
  var dc = col - playerCol;
  var dr = row - playerRow;
  if (dc === 0 && dr === 0) return;
  // Same split as movement: eight-way only in iso, cardinal in top-down.
  player.facing = (typeof isoActive === 'function' && isoActive())
    ? facingFromVector(dc, dr) : cardinalFromVector(dc, dr);
}

function askToWalkCloser(label) {
  var msg = 'Walk closer to ' + label + '!';
  showToast(msg);
  speak(msg);
}

// ---- Update crop growth ----
function updateCrops() {
  var now = Date.now();
  for (var key in cropData) {
    var crop = cropData[key];
    var growTime = (crop.type && CROPS[crop.type]) ? CROPS[crop.type].grow : 8000;
    if (crop.status === 'growing' && now - crop.plantedAt >= growTime) {
      crop.status = 'ready';
    }
  }
}

function interactCropTile(tile) {
  var key = tile.row + ',' + tile.col;
  var crop = cropData[key];
  if (!crop) return;

  if (crop.status === 'empty') {
    // Figure out which seed types the player has.
    var available = [];
    for (var i = 0; i < CROP_TYPES.length; i++) {
      if (player.seeds[CROP_TYPES[i]] > 0) available.push(CROP_TYPES[i]);
    }
    if (available.length === 0) {
      showToast('No seeds! Buy some.');
    } else if (available.length === 1) {
      plantSeed(key, crop, available[0]);
    } else {
      openSeedPicker(key, crop);
    }
  } else if (crop.status === 'ready') {
    var harvestType = crop.type || 'turnip';
    crop.status = 'empty';
    crop.plantedAt = 0;
    crop.type = null;
    player.crops[harvestType]++;
    addPop(tile.row, tile.col, '+1');
    soundHarvest();
    showToast('Harvested 1 ' + CROPS[harvestType].name + '!');
    recordOnboardingMilestone('harvested');
  } else if (crop.status === 'growing') {
    var ct = crop.type || 'turnip';
    var pct = Math.round(((Date.now() - crop.plantedAt) / CROPS[ct].grow) * 100);
    showToast(CROPS[ct].name + ' growing... ' + Math.min(pct, 99) + '%');
  }

  updateHUD();
  saveGame();
}

// Try the exact tile the player tapped. Returns true when the tile is an
// interactable target, even if it is currently too far away.
function interactAtTile(row, col) {
  if (!gameActive) return false;
  if (shopOpen || mathOpen || seedPickerOpen || questOpen || combatOpen || cookingOpen || dumplingOpen) return false;

  for (var n = 0; n < NPCS.length; n++) {
    var npc = NPCS[n];
    if (npc.area !== currentArea || npc.row !== row || npc.col !== col) continue;
    faceWorldTile(row, col);
    if (!isPlayerNearTile(row, col)) askToWalkCloser(npc.name);
    else interactNPC(npc);
    return true;
  }

  if (AREA_ENEMIES[currentArea]) {
    for (var e = 0; e < currentEnemies.length; e++) {
      var enemy = currentEnemies[e];
      if (!enemy.alive || enemy.row !== row || enemy.col !== col) continue;
      faceWorldTile(row, col);
      if (!isPlayerNearTile(row, col)) askToWalkCloser(ENEMIES[enemy.type].name);
      else openCombat(enemy);
      return true;
    }
  }

  if (currentArea === 'farm' && row === FARM_COOKPOT.row && col === FARM_COOKPOT.col) {
    faceWorldTile(row, col);
    if (!isPlayerNearTile(row, col)) askToWalkCloser('the cooking pot');
    else openCooking();
    return true;
  }

  if (row >= 0 && row < MAP_H && col >= 0 && col < MAP_W && map[row][col] === DOOR) {
    faceWorldTile(row, col);
    if (!isPlayerNearTile(row, col)) askToWalkCloser('the shop');
    else openShop();
    return true;
  }

  var crop = cropData[row + ',' + col];
  if (crop) {
    faceWorldTile(row, col);
    if (!isPlayerNearTile(row, col)) askToWalkCloser('the soil plot');
    else interactCropTile({ row: row, col: col });
    return true;
  }

  return false;
}

// ---- Action button: plant, harvest, talk, shop, cook, or fight ----
function doAction() {
  if (!gameActive) return;         // no play until a profile is chosen
  if (shopOpen || mathOpen || seedPickerOpen || questOpen || combatOpen || cookingOpen || dumplingOpen) return;
  // Tapping Action beside the shop door opens the store.
  if (isNearDoor() && !shopOpen) { openShop(); return; }
  // Tapping Action beside any NPC dispatches per role.
  var nearNpc = isNearNPC();
  if (nearNpc) { interactNPC(nearNpc); return; }
  // Tapping Action beside the Farm cooking pot opens the cooking modal.
  if (isNearCookpot()) { openCooking(); return; }
  // Tapping Action beside a Wilds enemy starts a battle.
  var nearEn = isNearEnemy();
  if (nearEn) { openCombat(nearEn); return; }
  var tile = getFacingTile();
  if (!tile) {
    showToast('Stand near a soil plot!');
    return;
  }
  interactCropTile(tile);
}

// ---- Shop ----
// Keep the quantity chips and the Buy labels honest about what a tap will do.
function updateSeedBuyUI() {
  for (var i = 0; i < SEED_BUY_QUANTITIES.length; i++) {
    var qty = SEED_BUY_QUANTITIES[i];
    var chip = document.getElementById('qty_' + qty);
    if (chip) {
      var on = qty === seedBuyQuantity;
      chip.classList.toggle('selected', on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  for (var t = 0; t < CROP_TYPES.length; t++) {
    var type = CROP_TYPES[t];
    var btn = document.getElementById('btnBuy_' + type);
    if (!btn) continue;
    var info = CROPS[type];
    var can = affordableSeedCount(type, seedBuyQuantity);
    var partial = can > 0 && can < seedBuyQuantity;
    // Say what the tap will ACTUALLY do. "Buy 20" on a button that can only buy 3 is
    // the same broken promise the honest-partial rule exists to prevent, so a partial
    // button names the real count (review catch), and colour is never the only signal.
    if (seedBuyQuantity === 1) btn.textContent = 'Buy';
    else if (partial) btn.textContent = 'Buy ' + can + ' of ' + seedBuyQuantity;
    else btn.textContent = 'Buy ' + seedBuyQuantity;
    var willBuy = partial ? can : seedBuyQuantity;
    btn.setAttribute('aria-label', 'Buy ' + willBuy + ' ' + info.name +
      ' seed' + (willBuy === 1 ? '' : 's') + ' for ' + (willBuy * info.cost) + ' gold' +
      (partial ? ', all your gold can buy of ' + seedBuyQuantity : ''));
    btn.classList.toggle('btn-buy-partial', partial);
  }
}

// Bulk buy (ELD-PT-011a). Buying 20 seeds used to mean twenty taps.
var SEED_BUY_QUANTITIES = [1, 5, 10, 15, 20];
var seedBuyQuantity = 1;

function setSeedBuyQuantity(qty) {
  if (SEED_BUY_QUANTITIES.indexOf(qty) === -1) return;
  seedBuyQuantity = qty;
  updateSeedBuyUI();
}

// How many the child can actually afford, capped at what they asked for.
function affordableSeedCount(type, wanted) {
  var cost = CROPS[type].cost;
  if (cost <= 0) return wanted;
  return Math.max(0, Math.min(wanted, Math.floor(player.gold / cost)));
}

function buySeeds(type, requested) {
  var info = CROPS[type];
  var wanted = requested || seedBuyQuantity;
  var bought = affordableSeedCount(type, wanted);
  if (bought === 0) {
    // Never silently do nothing: say what it costs and what they have.
    announceRoutine('You need ' + info.cost + 'g for a ' + info.name +
      ' seed. You have ' + player.gold + 'g.');
    return;
  }
  var spent = bought * info.cost;
  player.gold -= spent;
  player.seeds[type] += bought;
  // The count shown is always the count actually bought. If they asked for more
  // than their gold covers we buy what it covers and SAY SO, rather than quietly
  // charging for fewer seeds than the button promised.
  var line = 'Bought ' + bought + ' ' + info.name + ' seed' + (bought === 1 ? '' : 's') +
    ' for ' + spent + 'g';
  if (bought < wanted) line += ' — that is all your gold could buy';
  announceRoutine(line + '.');
  updateHUD();
  updateSeedBuyUI();
  saveGame();
}

// ---- Heart Crystal upgrade (slice 19): a gold SINK that grants permanent +5 Max HP.
// Price climbs 15g per crystal already owned, so it scales into a real late-game sink.
// Max HP also persists in the save (no new save field needed beyond the purchase count).
var HEART_HP = 5;          // max HP gained per crystal
var HEART_BASE_PRICE = 30; // price of the first crystal
function heartCrystalPrice() {
  return HEART_BASE_PRICE + player.hpUpgrades * 15;
}
function buyHeartCrystal() {
  var price = heartCrystalPrice();
  if (player.gold < price) return;   // can't afford — button is also disabled in updateHUD
  player.gold -= price;
  player.maxHp += HEART_HP;
  player.hp += HEART_HP;             // the new health is yours right away (feels good)
  player.hpUpgrades++;
  soundCoin();
  showToast('Heart Crystal! Max HP is now ' + player.maxHp + '.');
  speak('Heart Crystal! Your max health is now ' + player.maxHp + '.');
  updateHUD();
  saveGame();
}

// ---- Training upgrade (slice 21): a gold SINK that grants permanent +2 Attack.
// Parallel to Heart Crystal — the attack counterpart. Price scales the same way.
var TRAIN_ATK = 2;
var TRAIN_BASE_PRICE = 25;
function trainingPrice() {
  return TRAIN_BASE_PRICE + player.atkUpgrades * 15;
}
function buyTraining() {
  var price = trainingPrice();
  if (player.gold < price) return;
  player.gold -= price;
  player.atkUpgrades++;
  soundCoin();
  showToast('Training complete! Attack +' + TRAIN_ATK + '!');
  speak('Training complete! Your attack power went up by ' + TRAIN_ATK + '.');
  updateHUD();
  saveGame();
}

function sellCrops() {
  if (totalCrops() === 0) return;
  var earned = sellTotal();
  announceRoutine('Sold crops for ' + earned + 'g!');
  soundCoin();
  player.gold += earned;
  for (var i = 0; i < CROP_TYPES.length; i++) player.crops[CROP_TYPES[i]] = 0;
  recordOnboardingMilestone('usedCrop');   // guarded above: only a real positive sale
  updateHUD();
  saveGame();
}

// Plant a specific seed type on a soil tile.
function plantSeed(key, crop, type) {
  player.seeds[type]--;
  crop.status = 'growing';
  crop.plantedAt = Date.now();
  crop.type = type;
  showToast('Planted ' + CROPS[type].name + '! (-1 seed)');
  recordOnboardingMilestone('planted');
  updateHUD();
  saveGame();
}

// Seed picker: choose which seed to plant when you have multiple types.
var seedPickerKey = null;
var seedPickerCrop = null;

function openSeedPicker(key, crop) {
  seedPickerKey = key;
  seedPickerCrop = crop;
  var box = document.getElementById('seedOptions');
  box.innerHTML = '';
  for (var i = 0; i < CROP_TYPES.length; i++) {
    var t = CROP_TYPES[i];
    if (player.seeds[t] <= 0) continue;
    var info = CROPS[t];
    var btn = document.createElement('button');
    btn.className = 'btn-seed';
    btn.style.borderLeft = '6px solid ' + info.color;
    btn.textContent = info.name + ' (' + player.seeds[t] + ')';
    btn.dataset.type = t;
    btn.addEventListener('click', onSeedPickerClick);
    box.appendChild(btn);
  }
  seedPickerOpen = true;
  modalShellOpen('seedPicker');
}

function onSeedPickerClick(e) {
  var type = e.currentTarget.dataset.type;
  var key = seedPickerKey;
  var crop = seedPickerCrop;
  closeSeedPicker();
  plantSeed(key, crop, type);
}

function closeSeedPicker() {
  seedPickerOpen = false;
  seedPickerKey = null;
  seedPickerCrop = null;
  modalShellClose('seedPicker');
}
registerModal('seedPicker', closeSeedPicker);   // Escape = cancel seed selection

// ---- Squishy Dumpling vendor + collection MVP ----
function dumplingCollectionCount() {
  var total = 0;
  for (var i = 0; i < DUMPLINGS.length; i++) {
    if ((player.dumplings[DUMPLINGS[i].id] || 0) > 0) total++;
  }
  return total;
}

function dumplingPool(rarity) {
  var pool = [];
  for (var i = 0; i < DUMPLINGS.length; i++) {
    if (DUMPLINGS[i].rarity === rarity) pool.push(DUMPLINGS[i]);
  }
  return pool;
}

function firstOwnedDumplingId() {
  for (var i = 0; i < DUMPLINGS.length; i++) {
    if ((player.dumplings[DUMPLINGS[i].id] || 0) > 0) return DUMPLINGS[i].id;
  }
  return null;
}

function rollDumpling() {
  var rarity;
  if (player.pullsSinceLegendary >= DUMPLING_PITY_PULLS - 1) {
    rarity = 'legendary';
  } else {
    // Walk the SAME table the child is shown, so the odds on screen are the odds
    // being rolled. Hard-coded thresholds here would silently drift from the display.
    var rarityRoll = Math.random();
    var cumulative = 0;
    rarity = DUMPLING_ODDS[DUMPLING_ODDS.length - 1].rarity;
    for (var band = 0; band < DUMPLING_ODDS.length; band++) {
      cumulative += DUMPLING_ODDS[band].chance;
      if (rarityRoll < cumulative) { rarity = DUMPLING_ODDS[band].rarity; break; }
    }
  }

  var pool = dumplingPool(rarity);
  var picked = pool[Math.min(pool.length - 1, Math.floor(Math.random() * pool.length))];
  var duplicate = (player.dumplings[picked.id] || 0) > 0;
  player.dumplings[picked.id] = (player.dumplings[picked.id] || 0) + 1;

  if (rarity === 'legendary') player.pullsSinceLegendary = 0;
  else player.pullsSinceLegendary++;

  if (duplicate) {
    player.gold += DUMPLING_DUPLICATE_REFUND;
    player.dumplingDough++;
  }
  return { id: picked.id, name: picked.name, rarity: rarity, duplicate: duplicate };
}

var dumplingPickMode = false;   // true while the child is choosing a dumpling with dough

function openDoughPicker() {
  if (!canPickWithDough()) return;
  dumplingPickMode = true;
  document.getElementById('dumplingStatus').textContent =
    'Tap the dumpling you want! It costs ' + DUMPLING_DOUGH_PER_PICK + ' dough.';
  renderDumplingModal();
  // Bring the shelf into view. Telling a child to tap a card that is scrolled off
  // the bottom of the panel is the same as not offering the choice at all.
  var grid = document.getElementById('dumplingGrid');
  if (grid && grid.scrollIntoView) grid.scrollIntoView({ block: 'nearest' });
}

function cancelDoughPicker() {
  dumplingPickMode = false;
  renderDumplingModal();
}

// ---- Dough: the deterministic completion path (owner-approved) ----
// Duplicates give dough; enough dough hand-picks a dumpling you don't own. This is
// what guarantees a child can finish the shelf without relying on luck.
function missingDumplings() {
  var missing = [];
  for (var i = 0; i < DUMPLINGS.length; i++) {
    if (!(player.dumplings[DUMPLINGS[i].id] > 0)) missing.push(DUMPLINGS[i]);
  }
  return missing;
}

function canPickWithDough() {
  return player.dumplingDough >= DUMPLING_DOUGH_PER_PICK && missingDumplings().length > 0;
}

// Spend dough on a specific dumpling the child chooses — never a random one, or it
// would be another pull wearing a different hat.
function pickDumplingWithDough(id) {
  if (!gameActive || !dumplingOpen) return false;
  var target = DUMPLING_BY_ID[id];
  if (!target || player.dumplings[id] > 0) return false;          // already owned
  if (player.dumplingDough < DUMPLING_DOUGH_PER_PICK) return false;

  player.dumplingDough -= DUMPLING_DOUGH_PER_PICK;
  player.dumplings[id] = (player.dumplings[id] || 0) + 1;
  selectedDumplingId = id;
  var message = 'You chose ' + target.name + ' with ' + DUMPLING_DOUGH_PER_PICK + ' dough!';
  document.getElementById('dumplingStatus').textContent = message;
  soundWin();
  showToast(message);
  speak(message);
  updateHUD();
  renderDumplingModal();
  saveGame();
  return true;
}

// Nothing left to pick: dough stops being a dead currency and turns into gold.
function exchangeDoughForGold() {
  if (!gameActive || !dumplingOpen) return false;
  if (player.dumplingDough < DUMPLING_DOUGH_PER_PICK) return false;
  if (missingDumplings().length > 0) return false;                // picking comes first
  player.dumplingDough -= DUMPLING_DOUGH_PER_PICK;
  player.gold += DUMPLING_DOUGH_GOLD_VALUE * DUMPLING_DOUGH_PER_PICK;
  var message = 'Traded ' + DUMPLING_DOUGH_PER_PICK + ' dough for ' +
    (DUMPLING_DOUGH_GOLD_VALUE * DUMPLING_DOUGH_PER_PICK) + ' gold!';
  document.getElementById('dumplingStatus').textContent = message;
  soundCoin();
  showToast(message);
  updateHUD();
  renderDumplingModal();
  saveGame();
  return true;
}

// Plain-language odds, built from the SAME table the roll uses (owner-approved:
// "visible odds in plain language"). Percentages are what the numbers actually are.
function dumplingOddsText() {
  var parts = [];
  for (var i = 0; i < DUMPLING_ODDS.length; i++) {
    parts.push(Math.round(DUMPLING_ODDS[i].chance * 100) + '% ' + DUMPLING_ODDS[i].rarity);
  }
  // "Base odds", not "Every pull": the pity counter forces a Legendary on the 15th
  // pull without one, so a flat "6% legendary" would be untrue on exactly the pull a
  // child is most likely to be watching. The pity line beside this one states the rest.
  return 'Base odds: ' + parts.join(' · ');
}

// Read Odds: the ONLY speech this stall produces, and only when a child taps it.
// Opening the stall stays silent (A1 routine-action TTS boundary), so the early
// reader still needs a deliberate way to HEAR the price and odds that the older
// reader simply reads. Tapped, never automatic.
function readDumplingOdds() {
  if (!dumplingOpen) return;
  var pity = document.getElementById('dumplingPity');
  speakAloud('Every pull costs ' + DUMPLING_PULL_COST + ' gold. ' +
    dumplingOddsText().replace(/·/g, ',') + '. ' +
    (pity ? pity.textContent : ''), true);
}

function selectDumpling(id) {
  if (!DUMPLING_BY_ID[id] || !(player.dumplings[id] > 0)) return;
  selectedDumplingId = id;
  renderDumplingModal();
}

function renderDumplingModal() {
  document.getElementById('dumplingGold').textContent = 'Gold: ' + player.gold + 'g';
  document.getElementById('dumplingOwned').textContent =
    'Collection: ' + dumplingCollectionCount() + '/' + DUMPLINGS.length;
  document.getElementById('dumplingDough').textContent = 'Dough: ' + player.dumplingDough;
  var untilPity = DUMPLING_PITY_PULLS - player.pullsSinceLegendary;
  document.getElementById('dumplingPity').textContent =
    'Legendary in ' + untilPity + ' pull' + (untilPity === 1 ? '' : 's') + ' or fewer';

  for (var pc = 0; pc < DUMPLING_PULL_COUNTS.length; pc++) {
    var pullCount = DUMPLING_PULL_COUNTS[pc];
    var pullButton = document.getElementById('dumplingPull' + pullCount);
    if (pullButton) {
      var pullPrice = dumplingPullCost(pullCount);
      pullButton.disabled = player.gold < pullPrice;
      // Say the price plainly. Same price per pull every time, so there is nothing
      // to "work out" and nothing to hold out for.
      pullButton.textContent = (pullCount === 1 ? '1 pull' : pullCount + ' pulls') +
        ' · ' + pullPrice + 'g';
    }
  }

  document.getElementById('dumplingOdds').textContent = dumplingOddsText();

  // Dough panel: either spend it on a missing dumpling, or trade it once the shelf
  // is full. Always says how much more is needed rather than just sitting disabled.
  var missing = missingDumplings();
  var doughBtn = document.getElementById('dumplingDoughAction');
  var doughHint = document.getElementById('dumplingDoughHint');
  if (doughBtn && doughHint) {
    var needed = DUMPLING_DOUGH_PER_PICK - player.dumplingDough;
    if (missing.length === 0) {
      doughBtn.textContent = 'Trade ' + DUMPLING_DOUGH_PER_PICK + ' dough for ' +
        (DUMPLING_DOUGH_GOLD_VALUE * DUMPLING_DOUGH_PER_PICK) + 'g';
      doughBtn.disabled = player.dumplingDough < DUMPLING_DOUGH_PER_PICK;
      doughBtn.onclick = function() { exchangeDoughForGold(); };
      doughHint.textContent = 'Shelf complete! Spare dough becomes gold.';
    } else if (dumplingPickMode) {
      // While choosing, the same button is the way back out. A child who taps
      // "choose" and changes their mind needs a visible exit, not a trapped screen.
      doughBtn.textContent = 'Cancel choosing';
      doughBtn.disabled = false;
      doughBtn.onclick = function() { cancelDoughPicker(); };
      doughHint.textContent = 'Tap the dumpling you want, or cancel.';
    } else {
      doughBtn.textContent = 'Choose a dumpling (' + DUMPLING_DOUGH_PER_PICK + ' dough)';
      doughBtn.disabled = !canPickWithDough();
      doughBtn.onclick = function() { openDoughPicker(); };
      doughHint.textContent = needed > 0
        ? ('Duplicates make dough. ' + needed + ' more dough and you can pick any dumpling you want.')
        : 'You can pick any dumpling you want!';
    }
  }

  if (!selectedDumplingId || !(player.dumplings[selectedDumplingId] > 0)) {
    selectedDumplingId = firstOwnedDumplingId();
  }
  var selected = selectedDumplingId ? DUMPLING_BY_ID[selectedDumplingId] : null;
  var showcase = document.getElementById('dumplingShowcase');
  var largeIcon = document.getElementById('dumplingLargeIcon');
  showcase.className = 'dumpling-showcase' + (selected ? ' ' + selected.rarity : '');
  largeIcon.className = 'dumpling-icon large' + (selected ? ' ' + selected.rarity : '');
  document.getElementById('dumplingSelectedName').textContent =
    selected ? selected.name : 'No dumpling selected';
  document.getElementById('dumplingSelectedRarity').textContent =
    selected ? selected.rarity : 'Pull one to begin';

  var grid = document.getElementById('dumplingGrid');
  grid.innerHTML = '';
  for (var i = 0; i < DUMPLINGS.length; i++) {
    var dumpling = DUMPLINGS[i];
    var owned = (player.dumplings[dumpling.id] || 0) > 0;
    // In pick mode the LOCKED cards are the live ones: the child taps the dumpling
    // they actually want and dough buys that one, not a random one.
    var pickable = dumplingPickMode && !owned && canPickWithDough();
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'dumpling-card' + (owned ? '' : ' locked') +
      (pickable ? ' pickable' : '') +
      (selectedDumplingId === dumpling.id ? ' selected' : '');
    card.dataset.id = dumpling.id;
    card.disabled = pickable ? false : !owned;
    card.setAttribute('aria-label', owned
      ? dumpling.name + ', ' + dumpling.rarity
      : (pickable ? 'Choose ' + dumpling.name + ' for ' + DUMPLING_DOUGH_PER_PICK + ' dough'
                  : 'Locked dumpling'));

    var icon = document.createElement('div');
    icon.className = 'dumpling-icon ' + dumpling.rarity;
    var face = document.createElement('span');
    face.textContent = '•ᴗ•';
    icon.appendChild(face);
    card.appendChild(icon);

    var label = document.createElement('div');
    label.textContent = owned ? dumpling.name : (pickable ? dumpling.name : '???');
    card.appendChild(label);
    if (pickable) {
      card.addEventListener('click', function() {
        dumplingPickMode = false;
        pickDumplingWithDough(this.dataset.id);
      });
    } else if (owned) {
      card.addEventListener('click', function() { selectDumpling(this.dataset.id); });
    }
    grid.appendChild(card);
  }
}

function openDumplingVendor() {
  if (!gameActive || shopOpen || mathOpen || seedPickerOpen || questOpen ||
      combatOpen || cookingOpen || dumplingOpen || characterOpen) return;
  dumplingOpen = true;
  // Dough-pick mode is a per-visit interaction, not a saved preference: a stall that
  // reopens already in "choose a dumpling" mode gives a child no visible cause for it.
  dumplingPickMode = false;
  if (dumplingCollectionCount() === 0) {
    document.getElementById('dumplingStatus').textContent =
      'Choose a pull to meet your first dumpling!';
  }
  renderDumplingModal();
  modalShellOpen('dumplingModal');
  // No spoken welcome here. The stall is a routine shop screen, and the previous
  // line also urged saving up for a bigger bundle, which owner decision #1 forbids.
  // Price and odds stay visible; the Read Odds button is the deliberate, tapped
  // path to hearing them (A1 routine-action TTS boundary).
}

function closeDumplingVendor() {
  dumplingOpen = false;
  // Clear selection mode on the way out too, so Escape and the close button leave
  // the stall in the same neutral state the next visit expects.
  dumplingPickMode = false;
  modalShellClose('dumplingModal');
}
registerModal('dumplingModal', closeDumplingVendor);   // Escape = leave the stall

function buyDumplingBundle(count) {
  if (!gameActive || !dumplingOpen) return false;
  if (DUMPLING_PULL_COUNTS.indexOf(count) === -1) return false;
  var cost = dumplingPullCost(count);
  if (player.gold < cost) {
    showToast('You need ' + cost + ' gold!');
    speak('You need ' + cost + ' gold.');
    return false;
  }

  player.gold -= cost;
  var results = [];
  var newCount = 0;
  var duplicateCount = 0;
  var foundLegendary = false;
  for (var i = 0; i < count; i++) {
    var result = rollDumpling();
    results.push(result);
    if (result.duplicate) duplicateCount++; else newCount++;
    if (result.rarity === 'legendary') foundLegendary = true;
  }

  var last = results[results.length - 1];
  selectedDumplingId = last.id;
  var message;
  if (count === 1) {
    message = (last.duplicate ? 'Duplicate! ' : 'NEW! ') + last.name +
      ' · ' + last.rarity + (last.duplicate ? ' · +4g and +1 dough' : '');
  } else {
    message = count + ' pulls: ' + newCount + ' new, ' + duplicateCount +
      ' duplicate' + (duplicateCount === 1 ? '' : 's') + '. Last: ' + last.name + '!';
  }
  document.getElementById('dumplingStatus').textContent = message;
  if (foundLegendary) soundWin(); else soundCoin();
  showToast(foundLegendary ? 'Legendary dumpling!' : 'Dumpling pull complete!');
  speak(message);
  updateHUD();
  renderDumplingModal();
  saveGame();
  return true;
}

// ---- Town NPC quest (slice 10b) ----
// One shared system for both players; only the question + reading level change per profile.
// The older-reader slot ('adventurer') gets multiplication word problems; the early-reader
// slot ('mage') gets counting/addition kept at or below 20 and read aloud. A correct answer
// pays GOLD (the learning track's reward); a wrong answer just gives no reward and you can
// ask again. Never a gate.
var questOpen = false;
var questAnswer = 0;

// Build a word problem sized to the profile. Returns { text, answer }.
function makeQuestProblem() {
  var a, b, templates;
  if (currentProfile === 'adventurer') {
    a = 2 + Math.floor(Math.random() * 8);   // 2..9
    b = 2 + Math.floor(Math.random() * 8);   // 2..9
    templates = [
      'Each basket holds ' + a + ' carrots. You fill ' + b + ' baskets. How many carrots in all?',
      'A crate fits ' + a + ' pumpkins. How many pumpkins fit in ' + b + ' crates?',
      'You plant ' + a + ' rows with ' + b + ' seeds in each row. How many seeds did you plant?'
    ];
    return { text: templates[Math.floor(Math.random() * templates.length)], answer: a * b };
  }
  // 'mage' (and any non-adventurer): counting / addition, total kept ≤ 20.
  a = 1 + Math.floor(Math.random() * 10);                       // 1..10
  b = 1 + Math.floor(Math.random() * Math.min(10, 20 - a));     // keeps a+b ≤ 20
  templates = [
    'You pick ' + a + ' red apples and ' + b + ' green apples. How many apples?',
    'There are ' + a + ' ducks on the pond and ' + b + ' more on the grass. How many ducks?',
    'You find ' + a + ' shiny coins, then ' + b + ' more. How many coins?'
  ];
  return { text: templates[Math.floor(Math.random() * templates.length)], answer: a + b };
}

// ---- NPC role titles for the quest modal header. ----
var NPC_TITLES = {
  mira: 'the Villager', bram: 'the Shopkeeper', gunnar: 'the Smith',
  dumpling_vendor: 'at the Squishy Stall'
};

// ---- NPC greetings: voiced on first interaction each session. ----
var NPC_GREETINGS = {
  mira: 'Hello, adventurer! I have a task for you.',
  bram: 'Welcome to my store! Solve this and I will cut you a deal.',
  gunnar: 'Hmm. Show me your math and I will forge something strong.',
  dumpling_vendor: 'Welcome! Every dumpling can be earned with game gold.'
};
var npcGreeted = {};

function interactNPC(npc) {
  if (npc.role === 'shop') { openShop(); return; }
  if (npc.role === 'dumplings') { openDumplingVendor(); return; }
  openQuest(npc);
}

function openQuest(npc) {
  var npcName = npc ? npc.name : 'Mira';
  var npcId = npc ? npc.id : 'mira';
  if (!gameActive || shopOpen || mathOpen || seedPickerOpen || questOpen || combatOpen || cookingOpen || dumplingOpen || characterOpen) return;

  // Voiced greeting on first interaction this session
  if (!npcGreeted[npcId]) {
    npcGreeted[npcId] = true;
    speak(npcName + ' says: ' + (NPC_GREETINGS[npcId] || 'Hello!'));
  }

  // A real Mira interaction reached (all modal/adjacency guards above passed).
  if (npcId === 'mira') {
    onboardingDeferMiraNarration();
    recordOnboardingMilestone('metMira');
  }

  // Offer a kill quest if the player doesn't have one active (Mira only)
  if (npcId === 'mira' && !player.killQuest) {
    var kq = assignKillQuest();
    if (kq) {
      player.killQuest = { target: kq.target, count: kq.count, reward: kq.reward, name: kq.name, progress: 0 };
      showToast('New quest: ' + kq.name + '!');
      speak(npcName + ' says: Can you help? ' + kq.name + '! I will pay ' + kq.reward + ' gold.');
      saveGame();
    }
  } else if (npcId === 'mira' && player.killQuest) {
    var kq = player.killQuest;
    var prog = kq.progress || 0;
    if (prog < kq.count) {
      showToast(kq.name + ': ' + prog + '/' + kq.count);
      speak('Remember, ' + kq.name + '! ' + prog + ' of ' + kq.count + ' done.');
    }
  }

  var q = makeQuestProblem();
  questAnswer = q.answer;
  document.getElementById('questTitle').textContent = npcName + ' ' + (NPC_TITLES[npcId] || '');
  document.getElementById('questText').textContent = q.text;
  speak(npcName + ' asks: ' + q.text);

  var box = document.getElementById('questAnswers');
  box.innerHTML = '';
  var opts = makeOptions(q.answer);   // reuse the math-bonus option builder
  for (var i = 0; i < opts.length; i++) {
    var btn = document.createElement('button');
    btn.className = 'btn-answer';
    btn.textContent = opts[i];
    btn.dataset.value = opts[i];
    btn.addEventListener('click', onQuestAnswerClick);
    box.appendChild(btn);
  }

  questOpen = true;
  modalShellOpen('questModal');
}

function onQuestAnswerClick(e) {
  answerQuest(parseInt(e.currentTarget.dataset.value, 10));
}

function answerQuest(value) {
  var correct = (value === questAnswer);
  // Keep the guide transition pending until the answer feedback has had its
  // normal toast + cancel-first speech turn. It is flushed below as a queued
  // follow-up so the child hears both lines in order.
  closeQuest({ deferMiraNarration: true });
  if (correct) {
    // Learning pays gold (the economy lever). The harder multiplication problems pay more.
    var reward = (currentProfile === 'adventurer') ? 8 : 5;
    player.gold += reward;
    player.questsDone++;
    soundCorrect();
    showToast('Quest done! +' + reward + 'g');
    speak('Correct! You earned ' + reward + ' gold!');
    updateHUD();
    saveGame();
  } else {
    showToast('Not quite — ask me again!');
    speak('Good try! Ask me again.');
  }
  onboardingFlushMiraNarration(true);
}

function closeQuest(options) {
  questOpen = false;
  modalShellClose('questModal');
  if (!(options && options.deferMiraNarration)) onboardingFlushMiraNarration(false);
}
registerModal('questModal', closeQuest);   // Escape = the existing close/decline path

// ---- Kill quests: Mira assigns "defeat a monster" tasks. ----
// ELD-PLAY-002 pacing rule: a quest may never ask for more kills than the world can
// offer at once. Each combat area currently places exactly ONE of every enemy type
// (see ENEMY_SPAWNS), and dead enemies take 30 seconds to respawn — so a multi-kill
// quest forced the kid to stand around waiting. Until multiple simultaneous instances
// exist, every offered quest requires ONE kill.
// Rewards keep the old per-kill economics deterministically:
//   new reward = Math.round(old reward / old count)   (round half up)
// slime 15/3→5 · bat 15/3→5 · goblin 20/2→10 · wolf 25/3→8 · bear 30/2→15 ·
// troll 35/2→18 · rock_golem 40/2→20 · magma_slug 40/2→20 · crystal_wyrm 50/1→50
// (already one kill — unchanged).
var KILL_QUESTS = [
  { target: 'slime',        count: 1, reward: 5,  name: 'Slay a Slime',          tier: 1 },
  { target: 'bat',          count: 1, reward: 5,  name: 'Slay a Bat',            tier: 1 },
  { target: 'goblin',       count: 1, reward: 10, name: 'Slay a Goblin',         tier: 1 },
  { target: 'wolf',         count: 1, reward: 8,  name: 'Slay a Wolf',           tier: 2 },
  { target: 'bear',         count: 1, reward: 15, name: 'Slay a Bear',           tier: 2 },
  { target: 'troll',        count: 1, reward: 18, name: 'Slay a Troll',          tier: 2 },
  { target: 'rock_golem',   count: 1, reward: 20, name: 'Slay a Rock Golem',     tier: 3 },
  { target: 'magma_slug',   count: 1, reward: 20, name: 'Slay a Magma Slug',     tier: 3 },
  { target: 'crystal_wyrm', count: 1, reward: 50, name: 'Slay the Crystal Wyrm', tier: 3 }
];

function assignKillQuest() {
  // Mage (younger player) only gets tier-1 quests; adventurer gets all tiers.
  var maxTier = (currentProfile === 'mage') ? 1 : 3;
  var available = [];
  for (var i = 0; i < KILL_QUESTS.length; i++) {
    var kq = KILL_QUESTS[i];
    if (ENEMIES[kq.target] && kq.tier <= maxTier) available.push(kq);
  }
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function checkKillQuest(enemyType) {
  if (!player.killQuest) return;
  var kq = player.killQuest;
  if (kq.target !== enemyType) return;
  kq.progress = (kq.progress || 0) + 1;
  if (kq.progress >= kq.count) {
    player.gold += kq.reward;
    soundWin();
    showToast('Quest done: ' + kq.name + '! +' + kq.reward + 'g');
    speak('Quest complete! ' + kq.name + '! You earned ' + kq.reward + ' gold!');
    player.killQuest = null;
    updateHUD();
  } else {
    showToast(kq.name + ': ' + kq.progress + '/' + kq.count);
  }
}

