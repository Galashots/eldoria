// Acceptance tests for Step 5 "Identity and progression surface": canonical
// Ranger/Mage identity, title-screen correction, shared modal lifecycle
// (Foundation C2), Character & Equipment screen, and manual equip/unequip.
// Numbering mirrors the contract's 42 mandatory tests.
// Run: node tools/identity-progression-test.mjs
import { launch } from './smoke-test.mjs';

const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails.push(name); };

// --- Identity (1-7) ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(`(() => {
    localStorage.clear();
    refreshTitleLabels();
    var out = {};
    var la = document.getElementById('label-adventurer');
    var lm = document.getElementById('label-mage');
    var box = document.querySelector('.title-box');
    out.rangerLabel = la.textContent === 'Ranger' && lm.textContent === 'Mage';
    out.noAdventurer = box.textContent.indexOf('Adventurer') === -1;
    var pa = document.getElementById('portrait-adventurer');
    var pm = document.getElementById('portrait-mage');
    out.portraitSrcs = /assets\\/adventurer-down-right\\.png$/.test(pa.src) &&
                       /assets\\/mage-down-right\\.png$/.test(pm.src);
    out.portraitsLoaded = pa.complete && pa.naturalWidth > 0 && pm.complete && pm.naturalWidth > 0;
    var cs = getComputedStyle(pa);
    out.portraitRendering = cs.objectFit === 'contain' && cs.imageRendering === 'pixelated';
    // (4) A locally chosen custom name survives and stays the primary name.
    localStorage.setItem('eldoria_name_adventurer', 'ArcherLeo');
    refreshTitleLabels();
    out.customName = la.textContent === 'ArcherLeo';
    // (5) The canonical role stays visible on the Character screen with a custom name.
    selectProfile('adventurer');
    openCharacter();
    out.roleVisible = document.getElementById('characterName').textContent === 'ArcherLeo' &&
      document.getElementById('characterRole').textContent.indexOf('Ranger') !== -1;
    closeCharacter();
    // (6) Internal IDs and localStorage keys stay 'adventurer' / 'mage'.
    saveGame();
    out.internalIds = localStorage.getItem('eldoria_save_adventurer') !== null &&
      localStorage.getItem('eldoria_name_adventurer') === 'ArcherLeo' &&
      PLAYER_PROFILES.join(',') === 'adventurer,mage' &&
      HERO_IDENTITIES.adventurer.role === 'Ranger' && HERO_IDENTITIES.mage.role === 'Mage';
    // (7) An existing v3 save loads with no migration rewrite and no data loss.
    player.gold = 123;
    player.gear.weapon = 'crystal_blade';
    player.inventory = ['wooden_sword'];
    saveGame();
    var storedBefore = localStorage.getItem('eldoria_save_adventurer');
    switchProfile();
    selectProfile('adventurer');
    out.v3Loads = player.gold === 123 && player.gear.weapon === 'crystal_blade' &&
      player.inventory.length === 1 && player.inventory[0] === 'wooden_sword' &&
      localStorage.getItem('eldoria_save_adventurer') === storedBefore &&
      JSON.parse(storedBefore).version === 3;
    switchProfile();
    localStorage.clear();
    return out;
  })()`);
  check('IDENTITY-1: fresh title screen shows Ranger and Mage, not Adventurer', r.rangerLabel && r.noAdventurer);
  check('IDENTITY-2: both portraits resolve to the approved south-facing files', r.portraitSrcs);
  check('IDENTITY-3: portraits load and render uncropped/pixelated', r.portraitsLoaded && r.portraitRendering);
  check('IDENTITY-4: custom profile names survive as the primary name', r.customName);
  check('IDENTITY-5: canonical role stays visible beside a custom name', r.roleVisible);
  check('IDENTITY-6: internal IDs and localStorage keys remain adventurer/mage', r.internalIds);
  check('IDENTITY-7: existing v3 saves load without migration or data loss', r.v3Loads);
  check('IDENTITY: no console errors', errors.length === 0);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));
  await browser.close();
}

// --- Modal lifecycle (8-17) ---
{
  const { browser, page, errors } = await launch();
  const r1 = await page.evaluate(`(() => {
    localStorage.clear();
    var out = {};
    // Hero button needs an active profile.
    out.heroDisabledOnTitle = document.getElementById('heroBtn').disabled === true;
    selectProfile('adventurer');
    out.heroEnabledInGame = document.getElementById('heroBtn').disabled === false;

    // (8) Every listed modal opens through the shared lifecycle (activeModalId tracks it).
    var opened = {};
    function probe(id, openFn, closeFn) {
      openFn();
      opened[id] = activeModalId() === id &&
        document.getElementById(id).classList.contains('open');
      closeFn();
      opened[id] = opened[id] && activeModalId() === null &&
        !document.getElementById(id).classList.contains('open');
    }
    activateArea('farm');
    var k = Object.keys(cropData)[0];
    cropData[k].status = 'ready'; cropData[k].type = 'turnip';
    probe('mathModal', openMathBonus, closeMathBonus);
    cropData[k].status = 'empty'; cropData[k].type = null;
    probe('shopModal', openShop, closeShop);
    probe('dumplingModal', openDumplingVendor, closeDumplingVendor);
    probe('saveToolsModal', openSaveTools, closeSaveTools);
    probe('seedPicker', function () { openSeedPicker(k, cropData[k]); }, closeSeedPicker);
    probe('cookingModal', openCooking, closeCooking);
    probe('questModal', function () { openQuest(); }, closeQuest);
    probe('characterModal', openCharacter, closeCharacter);
    activateArea('wilds');
    probe('combatModal', function () { openCombat(currentEnemies[0]); }, fleeCombat);
    activateArea('farm');
    // doubleBatch stacks over cooking by design.
    player.crops.turnip = 4;
    openCooking();
    cookRecipe('veggie_soup');
    opened.doubleBatchModal = activeModalId() === 'doubleBatchModal';
    // (9) Only ONE modal is ACTIVE: the cooking modal beneath is inert.
    out.oneActive = modalStack.length === 2 &&
      document.getElementById('cookingModal').getAttribute('aria-hidden') === 'true';
    answerDoubleBatch(-1);
    opened.doubleBatchModal = opened.doubleBatchModal &&
      activeModalId() === 'cookingModal';
    closeCooking();
    out.allTen = ['mathModal','shopModal','dumplingModal','saveToolsModal','seedPicker',
      'cookingModal','doubleBatchModal','combatModal','questModal','characterModal']
      .every(function (id) { return opened[id]; });
    out.allRegistered = ['mathModal','shopModal','dumplingModal','saveToolsModal','seedPicker',
      'cookingModal','doubleBatchModal','combatModal','questModal','characterModal']
      .every(function (id) { return typeof MODAL_SAFE_ESCAPE[id] === 'function'; });

    // (10) Focus enters the active modal. (14) Background goes inert.
    openShop();
    var shopEl = document.getElementById('shopModal');
    out.focusEnters = shopEl.contains(document.activeElement);
    out.backgroundInert = document.getElementById('stage').getAttribute('aria-hidden') === 'true' &&
      document.getElementById('joystickZone').getAttribute('aria-hidden') === 'true';
    return out;
  })()`);
  // (11) Tab / Shift+Tab cannot escape the active modal (real key events).
  let tabOk = true;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    tabOk = tabOk && await page.evaluate(
      `document.getElementById('shopModal').contains(document.activeElement)`);
  }
  for (let i = 0; i < 6; i++) {
    await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
    tabOk = tabOk && await page.evaluate(
      `document.getElementById('shopModal').contains(document.activeElement)`);
  }
  // (12) Escape follows each modal's safe route: shop closes; combat FLEES.
  await page.keyboard.press('Escape');
  const r2 = await page.evaluate(`(() => {
    var out = {};
    out.shopEscaped = !shopOpen && activeModalId() === null;
    activateArea('wilds');
    currentEnemies[0].alive = true;
    openCombat(currentEnemies[0]);
    out.combatOpened = combatOpen === true;
    return out;
  })()`);
  await page.keyboard.press('Escape');
  const r3 = await page.evaluate(`(() => {
    var out = {};
    out.combatFled = !combatOpen && activeModalId() === null && player.hp === player.maxHp;
    activateArea('farm');

    // (13) Closing restores focus to the opener.
    var hero = document.getElementById('heroBtn');
    hero.focus();
    openCharacter();
    var focusMoved = document.getElementById('characterModal').contains(document.activeElement);
    closeCharacter();
    out.focusRestored = focusMoved && document.activeElement === hero;

    // (15) Character screen freezes movement; closing restores it.
    openCharacter();
    var x0 = player.x;
    held.right = true;
    update();
    var frozen = player.x === x0;
    closeCharacter();
    update();
    out.movementFreeze = frozen && player.x > x0;
    held.right = false;

    // (16) Profile switch and combat victory leave no stale active-modal state.
    openShop();
    switchProfile();
    var afterSwitch = modalStack.length === 0 && !shopOpen &&
      !document.getElementById('shopModal').classList.contains('open') &&
      document.getElementById('heroBtn').disabled === true;
    selectProfile('adventurer');
    activateArea('wilds');
    currentEnemies[0].alive = true;
    openCombat(currentEnemies[0]);
    combatEnemy.hp = 1;
    answerCombat(combatAnswer);   // lethal free hit -> winCombat closes indirectly
    out.noStale = afterSwitch && modalStack.length === 0 && !combatOpen &&
      !document.getElementById('combatModal').classList.contains('open');
    switchProfile();
    localStorage.clear();
    return out;
  })()`);
  check('MODAL-8: every listed modal opens through the shared lifecycle', r1.allTen && r1.allRegistered);
  check('MODAL-9: only one modal may be active (stacked cooking goes inert)', r1.oneActive);
  check('MODAL-10: focus enters the active modal', r1.focusEnters);
  check('MODAL-11: Tab and Shift+Tab cannot escape the active modal', tabOk);
  check('MODAL-12: Escape follows the safe route (shop closes, combat flees)',
    r2.shopEscaped && r2.combatOpened && r3.combatFled);
  check('MODAL-13: closing restores focus to the opener', r3.focusRestored);
  check('MODAL-14: background world controls are inert while a modal is open', r1.backgroundInert);
  check('MODAL-15: Character screen freezes movement and closing restores it',
    r3.movementFreeze && r1.heroDisabledOnTitle && r1.heroEnabledInGame);
  check('MODAL-16: profile switch and combat victory leave no stale modal state', r3.noStale);
  // (17) The existing modal-specific gameplay suites run in the same npm test chain
  // as this file; their PASS lines are the direct evidence. Here we assert the
  // lifecycle hooks they rely on stayed wired.
  check('MODAL-17: existing modal gameplay wiring intact (safe-escape map complete)', r1.allRegistered);
  check('MODAL: no console errors', errors.length === 0);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));
  await browser.close();
}

// --- Equipment integrity (18-33) + progression display (34-36) ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(`(() => {
    localStorage.clear();
    var out = {};
    selectProfile('adventurer');
    function multiset() {
      var ids = player.inventory.slice();
      for (var s in player.gear) if (player.gear[s]) ids.push(player.gear[s]);
      return ids.sort().join('|');
    }

    // (18)(19) Equipping a spare item removes that exact instance; old item bags.
    player.gear = { weapon: 'wooden_sword', head: null, body: null, cape: null };
    player.inventory = ['crystal_blade'];
    var before = multiset();
    out.equipOk = equipFromBag(0) === true &&
      player.gear.weapon === 'crystal_blade' &&
      player.inventory.length === 1 && player.inventory[0] === 'wooden_sword';
    // (21) Multiset preserved across the swap.
    out.multisetSwap = multiset() === before;

    // (20) Unequip moves the item into the bag and clears the slot.
    out.unequipOk = unequipSlot('weapon') === true &&
      player.gear.weapon === null &&
      player.inventory.slice().sort().join('|') === 'crystal_blade|wooden_sword' &&
      multiset() === before;

    // (22) Duplicate IDs: acting on index 2 removes THAT copy, not the first.
    player.gear = { weapon: 'eldoria_blade', head: null, body: null, cape: null };
    player.inventory = ['wooden_sword', 'crystal_blade', 'wooden_sword'];
    var dupBefore = multiset();
    equipFromBag(2);
    out.dupSafe = player.gear.weapon === 'wooden_sword' &&
      player.inventory.join('|') === 'wooden_sword|crystal_blade|eldoria_blade' &&
      multiset() === dupBefore;
    // (24) That was also a deliberate manual DOWNGRADE (12 dmg -> 2 dmg): allowed.
    out.downgrade = GEAR[player.gear.weapon].damage < GEAR.eldoria_blade.damage;

    // (23) Invalid indices/slots are no-ops.
    var snapshotGear = JSON.stringify(player.gear);
    var snapshotInv = player.inventory.join('|');
    out.invalidNoop = equipFromBag(99) === false && equipFromBag(-1) === false &&
      equipFromBag(1.5) === false && unequipSlot('feet') === false &&
      unequipSlot('head') === false &&   // empty slot: also a no-op
      JSON.stringify(player.gear) === snapshotGear && player.inventory.join('|') === snapshotInv;

    // (25) playerDamage changes by the exact expected delta on a swap.
    var pdBefore = playerDamage();
    var idx = player.inventory.indexOf('eldoria_blade');
    var expected = GEAR.eldoria_blade.damage - GEAR.wooden_sword.damage;
    equipFromBag(idx);
    out.damageDelta = playerDamage() === pdBefore + expected;

    // (26) Equip/unequip persists through save/reload.
    saveGame();
    switchProfile();
    selectProfile('adventurer');
    out.persisted = player.gear.weapon === 'eldoria_blade' &&
      player.inventory.slice().sort().join('|') === 'crystal_blade|wooden_sword|wooden_sword';

    // (27) Isolated across profiles.
    switchProfile();
    selectProfile('mage');
    out.mageClean = player.gear.weapon === null && player.inventory.length === 0;
    player.inventory = ['leather_cap'];
    equipFromBag(0);
    switchProfile();
    selectProfile('adventurer');
    out.isolated = out.mageClean && player.gear.head === null &&
      player.gear.weapon === 'eldoria_blade';

    // (28)(29) Auto-equip loot behavior unchanged.
    player.gear = { weapon: null, head: null, body: null, cape: null };
    player.inventory = [];
    equipGear('wooden_sword');
    var autoUp = player.gear.weapon === 'wooden_sword' && player.inventory.length === 0;
    equipGear('crystal_blade');
    out.autoEquip = autoUp && player.gear.weapon === 'crystal_blade' &&
      player.inventory.join('|') === 'wooden_sword';
    equipGear('wooden_sword');   // weaker drop -> straight to the bag
    out.weakerToBag = player.gear.weapon === 'crystal_blade' &&
      player.inventory.join('|') === 'wooden_sword|wooden_sword';

    // (30) Equipped gear never appears in the store sell list. (31) price = damage x 5.
    player.inventory = ['wooden_sword'];
    renderGearSell();
    var sellHtml = document.getElementById('gearSellList').innerHTML;
    out.sellList = sellHtml.indexOf('Wooden Sword') !== -1 && sellHtml.indexOf('Crystal Blade') === -1;
    out.sellPrice = gearSellPrice('eldoria_blade') === 60 && gearSellPrice('wooden_sword') === 10;

    // (32) Boss-trophy treatment for the Eldoria Blade and Wyrm Scale.
    player.gear = { weapon: 'eldoria_blade', head: null, body: 'wyrm_scale', cape: null };
    player.inventory = [];
    openCharacter();
    var slotsHtml = document.getElementById('equippedSlots').innerHTML;
    out.trophies = GEAR.eldoria_blade.trophy === 'Shadow Warden' &&
      GEAR.wyrm_scale.trophy === 'Crystal Wyrm' &&
      slotsHtml.indexOf('Trophy from Shadow Warden') !== -1 &&
      slotsHtml.indexOf('Trophy from Crystal Wyrm') !== -1;

    // (33) SAVE_VERSION remains 3.
    out.saveVersion = SAVE_VERSION === 3;

    // (34) Displayed progression matches live state.
    player.level = 4; player.xp = 30; player.hp = 18; player.maxHp = 35;
    player.hpUpgrades = 3; player.atkUpgrades = 2; player.questsDone = 7;
    renderCharacter();
    var stats = document.getElementById('characterStats').textContent;
    var total = playerDamage();
    var gearB = gearDamageBonus();
    var trainB = player.atkUpgrades * TRAIN_ATK;
    // The combined base+level contribution is labeled as exactly that — never as
    // level progression alone (it includes the base 5).
    out.statsLive = stats.indexOf('4') !== -1 &&
      stats.indexOf('30 / ' + xpForNextLevel()) !== -1 &&
      stats.indexOf('18 / 35') !== -1 &&
      stats.indexOf(String(total)) !== -1 &&
      stats.indexOf('base + level') !== -1 &&
      stats.indexOf('from level') === -1 &&
      stats.indexOf('+' + gearB) !== -1 &&
      stats.indexOf('+' + trainB) !== -1 &&
      stats.indexOf('7') !== -1;

    // (35) Empty slots and empty bag have clear child-readable states.
    player.gear = { weapon: null, head: null, body: null, cape: null };
    player.inventory = [];
    renderCharacter();
    var slotsEmpty = document.getElementById('equippedSlots').textContent;
    var bagEmpty = document.getElementById('bagList').textContent;
    out.emptyStates = (slotsEmpty.match(/Empty/g) || []).length === 4 &&
      bagEmpty.indexOf('No spare gear yet. Defeat enemies to find equipment.') !== -1;

    // (36) The screen updates immediately after equip/unequip/profile switch.
    player.inventory = ['iron_armor'];
    renderCharacter();
    equipFromBag(0);
    var afterEquip = document.getElementById('equippedSlots').textContent.indexOf('Iron Armor') !== -1 &&
      document.getElementById('bagList').textContent.indexOf('No spare gear yet') !== -1;
    unequipSlot('body');
    var afterUnequip = document.getElementById('bagList').textContent.indexOf('Iron Armor') !== -1;
    switchProfile();               // closes the screen (no stale modal)
    selectProfile('mage');
    openCharacter();
    // Default name === role, so the heading itself states the role and the
    // subtitle de-duplicates to just the grade.
    var mageView = document.getElementById('characterName').textContent === 'Mage' &&
      document.getElementById('characterRole').textContent === 'Grade 2';
    closeCharacter();
    out.liveUpdates = afterEquip && afterUnequip && mageView;
    switchProfile();
    localStorage.clear();
    return out;
  })()`);
  check('EQUIP-18: equipping removes that exact inventory instance', r.equipOk);
  check('EQUIP-19: the old equipped item moves into the bag', r.equipOk);
  check('EQUIP-20: unequip moves the item into the bag and clears the slot', r.unequipOk);
  check('EQUIP-21: gear-instance multiset preserved across equip/swap/unequip', r.multisetSwap && r.unequipOk);
  check('EQUIP-22: duplicate item IDs never remove the wrong instance', r.dupSafe);
  check('EQUIP-23: invalid inventory index and invalid slot make no changes', r.invalidNoop);
  check('EQUIP-24: manual downgrade is allowed and reflected accurately', r.downgrade);
  check('EQUIP-25: playerDamage() changes by the exact expected delta', r.damageDelta);
  check('EQUIP-26: equip/unequip persists through save/reload', r.persisted);
  check('EQUIP-27: equip/unequip remains isolated across profiles', r.isolated);
  check('EQUIP-28: auto-equip for newly dropped upgrades unchanged', r.autoEquip);
  check('EQUIP-29: weaker-drop-to-bag behavior unchanged', r.weakerToBag);
  check('EQUIP-30: equipped gear absent from the General Store sell list', r.sellList);
  check('EQUIP-31: spare gear sale price remains damage x 5', r.sellPrice);
  check('EQUIP-32: Eldoria Blade and Wyrm Scale show boss-trophy treatment', r.trophies);
  check('EQUIP-33: SAVE_VERSION remains 3', r.saveVersion);
  check('DISPLAY-34: progression display matches live player state', r.statsLive);
  check('DISPLAY-35: empty slots and empty bag have child-readable states', r.emptyStates);
  check('DISPLAY-36: screen updates immediately after equip/unequip/switch', r.liveUpdates);
  check('EQUIP: no console errors', errors.length === 0);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));
  await browser.close();
}

// --- Visual and accessibility (37-42), checked at all three viewports ---
{
  const VIEWPORTS = { desktop: [1280, 800], 'ipad-landscape': [1180, 820], 'phone-portrait': [390, 844] };
  let allOk = { errors: true, images: true, targets: true, overflow: true, bounded: true, names: true };
  for (const [label, [w, h]] of Object.entries(VIEWPORTS)) {
    const { browser, page, errors } = await launch();
    await page.setViewport({ width: w, height: h });
    const failedHeroImages = [];
    page.on('requestfailed', req => {
      if (/assets\/(adventurer|mage)-down-right\.png|assets\/(adventurer|mage)-right/.test(req.url()))
        failedHeroImages.push(req.url());
    });
    const v = await page.evaluate(`(() => {
      localStorage.clear();
      var out = {};
      selectProfile('adventurer');
      player.gear = { weapon: 'eldoria_blade', head: 'titan_helm', body: 'wyrm_scale', cape: 'dragon_cape' };
      player.inventory = ['crystal_blade', 'leather_cap'];
      openCharacter();
      // (38) Approved hero images all resolved (portraits + every paper-doll layer).
      var imgs = [].slice.call(document.querySelectorAll('#paperDoll img'))
        .concat([document.getElementById('portrait-adventurer'), document.getElementById('portrait-mage')]);
      out.imagesOk = imgs.length >= 7 && imgs.every(function (im) {
        return im.complete && im.naturalWidth > 0 && im.style.display !== 'none';
      });
      // (39) All Character-screen actions meet the 44x44 target.
      var buttons = [].slice.call(document.querySelectorAll('#characterModal button'));
      out.targetsOk = buttons.length >= 4 && buttons.every(function (b) {
        var r = b.getBoundingClientRect();
        return r.width >= 44 && r.height >= 44;
      });
      // (40) No horizontal overflow.
      out.noOverflow = document.documentElement.scrollWidth <= window.innerWidth + 1;
      // (41) Modal bounded inside the viewport and scrollable.
      var modal = document.querySelector('#characterModal .modal');
      var mr = modal.getBoundingClientRect();
      var mcs = getComputedStyle(modal);
      out.bounded = mr.width <= window.innerWidth && mr.height <= window.innerHeight + 1 &&
        mcs.overflowY === 'auto';
      // (42) Screen-reader names identify role, slot, item, comparison, and action.
      var html = document.getElementById('characterModal').innerHTML;
      out.names =
        document.getElementById('paperDoll').getAttribute('aria-label').indexOf('Ranger') !== -1 &&
        html.indexOf('aria-label="Unequip Eldoria Blade from the Weapon slot"') !== -1 &&
        /aria-label="Equip Crystal Blade in the Weapon slot\\. Attack \\d+ → \\d+ \\(-\\d+\\)"/.test(html) &&
        html.indexOf('aria-label="Close character and equipment"') !== -1 &&
        document.getElementById('heroBtn').getAttribute('aria-label') === 'Open character and equipment';
      closeCharacter();
      switchProfile();
      localStorage.clear();
      return out;
    })()`);
    allOk.errors = allOk.errors && errors.length === 0;
    allOk.images = allOk.images && v.imagesOk && failedHeroImages.length === 0;
    allOk.targets = allOk.targets && v.targetsOk;
    allOk.overflow = allOk.overflow && v.noOverflow;
    allOk.bounded = allOk.bounded && v.bounded;
    allOk.names = allOk.names && v.names;
    if (errors.length) console.log('  [' + label + '] errors: ' + errors.join(' | '));
    await browser.close();
  }
  check('VISUAL-37: zero console errors at all three viewports', allOk.errors);
  check('VISUAL-38: no missing approved hero-image requests', allOk.images);
  check('VISUAL-39: all Character-screen actions meet the 44x44 target', allOk.targets);
  check('VISUAL-40: no horizontal overflow at any viewport', allOk.overflow);
  check('VISUAL-41: modal bounded and scrollable at all three viewports', allOk.bounded);
  check('VISUAL-42: screen-reader names identify role, slot, item, comparison, action', allOk.names);
}

// --- Modal scroll containment at phone portrait (review round 1): EVERY modal
// panel must stay bounded inside the viewport and scroll its own overflow, with
// bottom actions reachable and focus still trapped after scrolling.
{
  const { browser, page, errors } = await launch();
  await page.setViewport({ width: 390, height: 844 });
  const r1 = await page.evaluate(`(() => {
    localStorage.clear();
    var out = { bounded: {} };
    selectProfile('adventurer');
    function panelContained(id) {
      var panel = document.querySelector('#' + id + ' .modal');
      if (!panel) return false;
      var rect = panel.getBoundingClientRect();
      var cs = getComputedStyle(panel);
      return rect.height <= window.innerHeight + 1 && rect.width <= window.innerWidth + 1 &&
        cs.overflowY === 'auto';
    }
    function probe(id, openFn, closeFn) {
      openFn();
      out.bounded[id] = panelContained(id);
      closeFn();
    }
    activateArea('farm');
    var k = Object.keys(cropData)[0];
    cropData[k].status = 'ready'; cropData[k].type = 'turnip';
    probe('mathModal', openMathBonus, closeMathBonus);
    cropData[k].status = 'empty'; cropData[k].type = null;
    probe('dumplingModal', openDumplingVendor, closeDumplingVendor);
    probe('saveToolsModal', openSaveTools, closeSaveTools);
    probe('seedPicker', function () { openSeedPicker(k, cropData[k]); }, closeSeedPicker);
    probe('questModal', function () { openQuest(); }, closeQuest);
    probe('characterModal', openCharacter, closeCharacter);
    // Populated long cooking panel (every recipe + every food owned).
    for (var f = 0; f < FOOD_TYPES.length; f++) player.food[FOOD_TYPES[f]] = 3;
    player.hp = 5;   // Eat buttons enabled -> full rows
    probe('cookingModal', openCooking, closeCooking);
    player.crops.turnip = 4;
    openCooking(); cookRecipe('veggie_soup');
    out.bounded.doubleBatchModal = panelContained('doubleBatchModal');
    answerDoubleBatch(-1); closeCooking();
    activateArea('wilds');
    currentEnemies[0].alive = true;
    probe('combatModal', function () { openCombat(currentEnemies[0]); }, fleeCombat);
    activateArea('farm');
    // The long-Store case: five seed rows, sell, two upgrades, a 25-item spare-gear
    // list, and the final Leave button — the panel must scroll, not the page.
    player.inventory = [];
    for (var i = 0; i < 25; i++) player.inventory.push('wooden_sword');
    openShop();
    out.bounded.shopModal = panelContained('shopModal');
    var panel = document.querySelector('#shopModal .modal');
    out.storeScrolls = panel.scrollHeight > panel.clientHeight;
    out.pageStaysPut = document.documentElement.scrollWidth <= window.innerWidth + 1;
    var leave = document.getElementById('btnClose');
    leave.scrollIntoView({ block: 'nearest' });
    var lr = leave.getBoundingClientRect();
    out.leaveReachable = lr.top >= 0 && lr.bottom <= window.innerHeight + 1;
    return out;
  })()`);
  // Focus stays trapped inside the scrolled Store under real Tab traversal.
  let scrolledTrap = true;
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    scrolledTrap = scrolledTrap && await page.evaluate(
      `document.getElementById('shopModal').contains(document.activeElement)`);
  }
  const r2 = await page.evaluate(`(() => {
    closeShop();
    var out = { stackClean: modalStack.length === 0 };
    switchProfile();
    localStorage.clear();
    return out;
  })()`);
  const allBounded = ['mathModal','shopModal','dumplingModal','saveToolsModal','seedPicker',
    'cookingModal','doubleBatchModal','combatModal','questModal','characterModal']
    .every(id => r1.bounded[id]);
  check('SCROLL-43: every registered modal panel bounded + scroll-contained at phone', allBounded);
  check('SCROLL-44: populated long Store scrolls inside its bounded panel', r1.storeScrolls && r1.pageStaysPut);
  check('SCROLL-45: the Store Leave action is reachable after scrolling', r1.leaveReachable);
  check('SCROLL-46: focus stays trapped in the scrolled Store (real Tab presses)', scrolledTrap && r2.stackClean);
  check('SCROLL: no console errors', errors.length === 0);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));
  await browser.close();
}

// --- Visual evidence: corrected title, fully equipped screen + bag, upgrade
// comparison, empty states — desktop / iPad landscape / phone portrait, into
// artifacts/ (retained on the CI workflow run, never committed).
{
  const { mkdir } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const evidenceDir = new URL('../artifacts/', import.meta.url);
  await mkdir(evidenceDir, { recursive: true });
  const VIEWPORTS = { desktop: [1280, 800], 'ipad-landscape': [1180, 820], 'phone-portrait': [390, 844] };
  for (const [label, [w, h]] of Object.entries(VIEWPORTS)) {
    const { browser, page } = await launch();
    await page.setViewport({ width: w, height: h });
    const shot = name =>
      page.screenshot({ path: fileURLToPath(new URL(`identity-${name}-${label}.png`, evidenceDir)) });
    await page.evaluate(`(() => { localStorage.clear(); refreshTitleLabels(); })()`);
    await shot('title');
    await page.evaluate(`(() => {
      selectProfile('adventurer');
      player.gear = { weapon: 'eldoria_blade', head: 'titan_helm', body: 'wyrm_scale', cape: 'dragon_cape' };
      player.inventory = ['crystal_blade', 'leather_cap', 'shadow_cape'];
      openCharacter();
    })()`);
    await shot('character-equipped');
    await page.evaluate(`(() => {
      // An UPGRADE comparison in the bag: stronger head item than the equipped cap.
      closeCharacter();
      player.gear.head = 'leather_cap';
      player.inventory = ['crystal_crown'];
      openCharacter();
      var bag = document.getElementById('bagList');
      if (bag && bag.scrollIntoView) bag.scrollIntoView();
    })()`);
    await shot('upgrade-comparison');
    await page.evaluate(`(() => {
      closeCharacter();
      player.gear = { weapon: null, head: null, body: null, cape: null };
      player.inventory = [];
      openCharacter();
    })()`);
    await shot('empty-states');
    await page.evaluate(`(() => { closeCharacter(); switchProfile(); localStorage.clear(); })()`);
    await browser.close();
  }
  console.log('PASS visual evidence: identity/progression frames captured (3 viewports x 4 states)');
}

if (fails.length) {
  console.error('\n' + fails.length + ' identity-progression test(s) failed.');
  process.exit(1);
}
console.log('Identity & progression surface tests passed.');
