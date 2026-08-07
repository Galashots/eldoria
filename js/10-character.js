// ---- Character & Equipment screen (Step 5: identity and progression surface) ----
// Opened from the Hero HUD button. Everything shown here is READ from live game
// state (player, GEAR, HERO_IDENTITIES) and every action goes through the manual
// equipment functions in js/05 — this file renders and routes, it never owns state.
// Layout intent ≈ 75% Diablo / 25% Minecraft: hero + four big slots first, the bag
// with plain child-readable comparisons beside them, no inventory-grid friction.

function openCharacter() {
  if (!gameActive || shopOpen || mathOpen || seedPickerOpen || questOpen ||
      combatOpen || cookingOpen || dumplingOpen || characterOpen) return;
  characterOpen = true;            // freezes movement via the update() modal guard
  renderCharacter();
  modalShellOpen('characterModal');
}

function closeCharacter() {
  characterOpen = false;           // movement resumes; the shell restores focus
  modalShellClose('characterModal');
}
registerModal('characterModal', closeCharacter);   // Escape = ordinary close

// Slot display names for the four equipment slots.
var SLOT_LABELS = { head: 'Head', body: 'Body', weapon: 'Weapon', cape: 'Cape' };
// Diablo-style slot order: reading order for the equipped panel.
var SLOT_ORDER = ['head', 'body', 'weapon', 'cape'];

// The stat blurb for an item wherever it is listed: weapons in damage, armour in hearts.
function gearStatText(itemId) {
  var g = GEAR[itemId];
  if (!g) return '';
  if (typeof g.damage === 'number') return '+' + g.damage + ' dmg';
  var hearts = g.hp / HEART_HP;
  return '+' + hearts + (hearts === 1 ? ' heart' : ' hearts');
}

// One escape hatch for text nodes built with innerHTML (custom hero names are the
// only free text that flows through here, and they are typed by the kids).
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Child-readable comparison for equipping a bag item: weapons compare total Attack,
// armour compares total hearts (max HP). Uses LIVE playerDamage()/computeMaxHp() as the
// base so it can never drift from real game math.
function gearCompare(itemId) {
  var item = GEAR[itemId];
  if (!item) return { text: '', cls: 'cmp-same' };
  var cur = player.gear[item.slot];
  if (typeof item.damage === 'number') {
    var dmgDelta = item.damage - (cur && GEAR[cur] ? (GEAR[cur].damage || 0) : 0);
    if (dmgDelta === 0) return { text: 'Same Attack', cls: 'cmp-same' };
    var now = playerDamage();
    return { text: 'Attack ' + now + ' → ' + (now + dmgDelta) + ' (' + (dmgDelta > 0 ? '+' : '') + dmgDelta + ')',
             cls: dmgDelta > 0 ? 'cmp-up' : 'cmp-down' };
  }
  // Armour: compare hearts (max HP).
  var hpDelta = (item.hp || 0) - (cur && GEAR[cur] ? (GEAR[cur].hp || 0) : 0);
  if (hpDelta === 0) return { text: 'Same Hearts', cls: 'cmp-same' };
  var nowMax = computeMaxHp();
  var hearts = hpDelta / HEART_HP;
  return { text: 'Hearts ' + (nowMax / HEART_HP) + ' → ' + ((nowMax + hpDelta) / HEART_HP) +
             ' (' + (hpDelta > 0 ? '+' : '') + hearts + ')',
           cls: hpDelta > 0 ? 'cmp-up' : 'cmp-down' };
}

// The boss-trophy marker, shown wherever a trophy item appears.
function trophyMarkHtml(itemId) {
  var g = GEAR[itemId];
  if (!g || !g.trophy) return '';
  return ' <span class="trophy" role="img" aria-label="Trophy from ' + g.trophy + '">🏆</span>';
}

function trophySmallText(itemId) {
  var g = GEAR[itemId];
  return (g && g.trophy) ? g.trophy + ' trophy · ' : '';
}

// Paper doll: the base hero in the manifest's paper-doll view with its equipment
// overlays stacked in the engine's draw order (cape behind, then base, body, head,
// weapon). Committed art only; a missing overlay hides just itself (onerror) and can
// never take the base hero with it. NOTE the generic slot overlays are not exact
// per-item art — an intentional interim gap until item/state art is approved.
function renderPaperDoll() {
  var doll = document.getElementById('paperDoll');
  if (!doll) return;
  var ident = HERO_IDENTITIES[currentProfile];
  if (!ident) { doll.innerHTML = ''; return; }
  var dir = ident.paperDollDirection;
  var base = 'assets/' + currentProfile + '-' + dir;
  var layers = [];
  if (player.gear.cape)   layers.push(base + '-cape.png');
  layers.push(base + '.png');
  if (player.gear.body)   layers.push(base + '-body.png');
  if (player.gear.head)   layers.push(base + '-head.png');
  if (player.gear.weapon) layers.push(base + '-weapon.png');
  var html = '';
  for (var i = 0; i < layers.length; i++) {
    html += '<img src="' + layers[i] + '" alt="" onerror="this.style.display=\'none\'">';
  }
  doll.innerHTML = html;
  doll.setAttribute('role', 'img');
  doll.setAttribute('aria-label', profileDisplayName(currentProfile) + ' the ' + ident.role +
    ' wearing their equipped gear');
}

// Progression statistics — every number is the live runtime value (or derived from
// it by subtraction), never a re-implemented formula that could drift.
function renderCharacterStats() {
  var box = document.getElementById('characterStats');
  if (!box) return;
  var total = playerDamage();
  var gearBonus = gearDamageBonus();
  var trainBonus = player.atkUpgrades * TRAIN_ATK;
  var baseLevel = total - gearBonus - trainBonus;   // derived, so it can never drift
  var rows = [
    ['Level', player.level],
    ['XP', player.xp + ' / ' + xpForNextLevel()],
    ['HP', player.hp + ' / ' + player.maxHp],
    ['Attack (total)', total],
    ['· base + level', baseLevel],
    ['· from gear', '+' + gearBonus],
    ['· from Training', '+' + trainBonus],
    ['Heart Crystals', player.hpUpgrades],
    ['Training sessions', player.atkUpgrades],
    ['Quests completed', player.questsDone]
  ];
  var html = '';
  for (var i = 0; i < rows.length; i++) {
    html += '<div class="stat-row"><b>' + rows[i][0] + '</b><span>' + rows[i][1] + '</span></div>';
  }
  box.innerHTML = html;
}

// The four equipped slots — always all four, empty ones included, each with an
// Unequip action when occupied.
function renderEquippedSlots() {
  var box = document.getElementById('equippedSlots');
  if (!box) return;
  var html = '';
  for (var i = 0; i < SLOT_ORDER.length; i++) {
    var slot = SLOT_ORDER[i];
    var itemId = player.gear[slot];
    var g = itemId ? GEAR[itemId] : null;
    if (g) {
      html += '<div class="slot-row">' +
        '<div class="slot-info"><b>' + SLOT_LABELS[slot] + ':</b> ' + g.name + trophyMarkHtml(itemId) +
        '<small>' + trophySmallText(itemId) + gearStatText(itemId) + ' · tier ' + g.tier + '</small></div>' +
        '<button class="btn-unequip" onclick="unequipSlot(\'' + slot + '\')" ' +
        'aria-label="Unequip ' + g.name + ' from the ' + SLOT_LABELS[slot] + ' slot">Unequip</button>' +
        '</div>';
    } else {
      html += '<div class="slot-row empty">' +
        '<div class="slot-info"><b>' + SLOT_LABELS[slot] + ':</b> Empty' +
        '<small>Defeat enemies to find ' + slot + ' gear!</small></div>' +
        '</div>';
    }
  }
  box.innerHTML = html;
}

// The bag: every spare gear instance in player.inventory, each with its comparison
// against the equipped item in its slot and an Equip action. Indices are the exact
// live inventory indices, so duplicates always act on the right instance.
function renderBag() {
  var box = document.getElementById('bagList');
  if (!box) return;
  if (player.inventory.length === 0) {
    box.innerHTML = '<p class="bag-empty">No spare gear yet. Defeat enemies to find equipment.</p>';
    return;
  }
  var html = '';
  for (var i = 0; i < player.inventory.length; i++) {
    var itemId = player.inventory[i];
    var g = GEAR[itemId];
    if (!g) continue;
    var cmp = gearCompare(itemId);
    html += '<div class="bag-row">' +
      '<div class="slot-info"><b>' + g.name + '</b>' + trophyMarkHtml(itemId) +
      '<small>' + SLOT_LABELS[g.slot] + ' · ' + trophySmallText(itemId) + gearStatText(itemId) +
      ' · sells ' + gearSellPrice(itemId) + 'g at the Store</small>' +
      '<small class="' + cmp.cls + '">' + cmp.text + '</small></div>' +
      '<button class="btn-equip" onclick="equipFromBag(' + i + ')" ' +
      'aria-label="Equip ' + g.name + ' in the ' + SLOT_LABELS[g.slot] + ' slot. ' + cmp.text + '">Equip</button>' +
      '</div>';
  }
  box.innerHTML = html;
}

// Rebuild the whole screen from live state. Called on open and after every
// equipment change while the screen is up.
function renderCharacter() {
  if (!currentProfile) return;
  var ident = HERO_IDENTITIES[currentProfile] || {};
  var name = profileDisplayName(currentProfile);
  var nameEl = document.getElementById('characterName');
  var roleEl = document.getElementById('characterRole');
  // The custom name stays the hero's name; the canonical role stays visible beside
  // it. When the display name IS the role (no custom name yet), the heading already
  // states the role, so the subtitle keeps just the grade instead of repeating it.
  if (nameEl) nameEl.innerHTML = escapeHtml(name);
  if (roleEl) roleEl.textContent = (name === ident.role)
    ? ident.gradeLabel
    : ident.role + ' · ' + ident.gradeLabel;
  renderPaperDoll();
  renderCharacterStats();
  renderEquippedSlots();
  renderBag();
}
