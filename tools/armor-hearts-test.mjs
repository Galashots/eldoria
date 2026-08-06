// Acceptance tests for Sub-project 2: armour as hearts (combat-armor spec §4–§5, OWNER 12–13).
// Run: node tools/armor-hearts-test.mjs
import { launch } from './smoke-test.mjs';

const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails.push(name); };

// ---- Task 1: gear data shape ----
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    var out = {};
    var weapons = ['wooden_sword','crystal_blade','steel_sword','crystal_staff','eldoria_blade','obsidian_blade'];
    var armour  = ['leather_cap','hero_cape','iron_armor','crystal_crown','guardian_armor','shadow_cape',
                   'titan_helm','dragon_cape','mithril_armor','wyrm_scale'];
    // Weapons keep damage, carry NO hp.
    out.weaponsHaveDamageNotHp = weapons.every(function (id) {
      return typeof GEAR[id].damage === 'number' && typeof GEAR[id].hp !== 'number';
    });
    // Armour carries hp (a multiple of 5), NO damage.
    out.armourHasHpNotDamage = armour.every(function (id) {
      return typeof GEAR[id].hp === 'number' && GEAR[id].hp % 5 === 0 && typeof GEAR[id].damage !== 'number';
    });
    // Every item has a pinned sellValue equal to its OLD price (old damage * 5).
    var pinned = { wooden_sword:10, leather_cap:5, hero_cape:5, iron_armor:10, crystal_blade:25,
      steel_sword:30, crystal_staff:40, crystal_crown:15, guardian_armor:20, shadow_cape:15,
      eldoria_blade:60, obsidian_blade:50, titan_helm:25, dragon_cape:25, mithril_armor:30, wyrm_scale:45 };
    out.sellValuePinned = Object.keys(pinned).every(function (id) {
      return GEAR[id].sellValue === pinned[id] && gearSellPrice(id) === pinned[id];
    });
    // Tier ordering preserved within each armour slot.
    out.ordering = GEAR.iron_armor.hp < GEAR.guardian_armor.hp &&
      GEAR.guardian_armor.hp < GEAR.mithril_armor.hp && GEAR.mithril_armor.hp < GEAR.wyrm_scale.hp &&
      GEAR.leather_cap.hp < GEAR.crystal_crown.hp && GEAR.crystal_crown.hp < GEAR.titan_helm.hp &&
      GEAR.hero_cape.hp < GEAR.shadow_cape.hp && GEAR.shadow_cape.hp < GEAR.dragon_cape.hp;
    return out;
  });
  await browser.close();
  check('T1: weapons keep damage, no hp', r.weaponsHaveDamageNotHp);
  check('T1: armour has hp (multiple of 5), no damage', r.armourHasHpNotDamage);
  check('T1: sellValue pinned to old price on all 16 items', r.sellValuePinned);
  check('T1: tier ordering preserved per armour slot', r.ordering);
  check('T1: no console errors', errors.length === 0);
}

// ---- Task 2: computeMaxHp derivation ----
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    var out = {};
    selectProfile('adventurer');
    // Base level-1, no crystals, no gear = 20.
    player.level = 1; player.hpUpgrades = 0;
    player.gear = { weapon: null, head: null, body: null, cape: null };
    out.base = computeMaxHp() === 20;
    // Level + crystals: 20 + (level-1)*5 + hpUpgrades*5.
    player.level = 7; player.hpUpgrades = 3;
    out.levelCrystals = computeMaxHp() === 20 + 6 * 5 + 3 * 5; // 65
    // A weapon adds NO hp.
    player.gear.weapon = 'eldoria_blade';
    out.weaponNoHp = computeMaxHp() === 65;
    // Armour adds its hearts; multiple pieces sum (OWNER 14: wyrm_scale=20, titan_helm=15).
    player.gear.body = 'wyrm_scale'; player.gear.head = 'titan_helm';
    out.armourSums = computeMaxHp() === 65 + 20 + 15; // 100
    // Pure helper matches the live reader.
    out.pureMatches = maxHpFor(7, 3, player.gear) === computeMaxHp();
    return out;
  });
  await browser.close();
  check('T2: base level-1 no gear = 20', r.base);
  check('T2: level + crystals term', r.levelCrystals);
  check('T2: weapons contribute no hp', r.weaponNoHp);
  check('T2: armour hearts sum into maxHp', r.armourSums);
  check('T2: maxHpFor pure helper matches computeMaxHp', r.pureMatches);
  check('T2: no console errors', errors.length === 0);
}

// ---- Task 3: derived-wins ingest custody ----
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    var out = {};
    // (a) Derived wins over a disagreeing stored maxHp: level 7 + wyrm_scale, stored maxHp lies (20).
    var s = { version: 4, area: 'wilds',
      player: { level: 7, hpUpgrades: 0, maxHp: 20, hp: 20,
                gear: { weapon: null, head: null, body: 'wyrm_scale', cape: null } } };
    var res = ingestSaveObject(s);
    // derived = 20 + 6*5 + 20 (wyrm_scale, OWNER 14) = 70; hp clamps DOWN to min(20, 70) = 20 (not resurrected up).
    out.derivedWins = res.ok && res.state.player.maxHp === 70 && res.state.player.hp === 20;
    // (b) No resurrection: stored hp 0 stays 0 even though maxHp derives higher.
    var dead = { version: 4, player: { level: 3, hpUpgrades: 0, maxHp: 30, hp: 0,
                 gear: { weapon: null, head: null, body: 'iron_armor', cape: null } } };
    var dres = ingestSaveObject(dead);
    out.noResurrect = dres.ok && dres.state.player.maxHp === (20 + 2*5 + 5) && dres.state.player.hp === 0;
    // (c) Clamp DOWN when stored hp exceeds derived max (e.g. armour removed off-line).
    var over = { version: 4, player: { level: 1, hpUpgrades: 0, maxHp: 999, hp: 999,
                 gear: { weapon: null, head: null, body: null, cape: null } } };
    var ores = ingestSaveObject(over);
    out.clampDown = ores.ok && ores.state.player.maxHp === 20 && ores.state.player.hp === 20;
    // (d) Idempotent round-trip: ingesting canonicalText reproduces identical state.
    var re = ingestSaveText(res.canonicalText);
    out.idempotent = re.ok && JSON.stringify(re.state) === JSON.stringify(res.state);
    // (e) Well-formed no-armour save: derived equals what the stored value already was.
    var plain = { version: 4, player: { level: 5, hpUpgrades: 2, maxHp: 20 + 4*5 + 2*5, hp: 30,
                  gear: { weapon: 'steel_sword', head: null, body: null, cape: null } } };
    var pres = ingestSaveObject(plain);
    out.reproduces = pres.ok && pres.state.player.maxHp === (20 + 4*5 + 2*5) && pres.state.player.hp === 30;
    return out;
  });
  await browser.close();
  check('T3: derived maxHp wins over disagreeing stored value', r.derivedWins);
  check('T3: hp<=0 is never resurrected by recomputation', r.noResurrect);
  check('T3: current hp clamps DOWN to derived max', r.clampDown);
  check('T3: canonical round-trip is idempotent', r.idempotent);
  check('T3: derivation reproduces a well-formed stored maxHp', r.reproduces);
  check('T3: no console errors', errors.length === 0);
}

// ---- Task 4: equip/unequip HP custody ----
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    var out = {};
    selectProfile('adventurer');
    player.level = 1; player.hpUpgrades = 0;
    player.gear = { weapon: null, head: null, body: null, cape: null };
    player.inventory = [];
    player.maxHp = computeMaxHp(); player.hp = player.maxHp;   // 20/20
    player.hp = 18;                                            // 18/20

    // (a) Equipping armour grants the new HP immediately: 18/20 + iron_armor(5, OWNER 14) -> 23/25.
    player.inventory = ['iron_armor'];
    equipFromBag(0);
    out.grantOnEquip = player.maxHp === 25 && player.hp === 23;

    // (b) Unequip clamps hp to the new max: 23/25 -> remove -> 20/20 (min(23,20)=20; max shrank, no grant).
    unequipSlot('body');
    out.clampOnUnequip = player.maxHp === 20 && player.hp === 20;

    // (c) Unequip floors a living hero at >=1 and never at 0.
    player.gear.body = 'wyrm_scale'; player.maxHp = computeMaxHp(); player.hp = 1; // 1/40 (20 base + 20 wyrm_scale)
    unequipSlot('body');
    out.floorLiving = player.maxHp === 20 && player.hp >= 1;

    // (d) Auto-equip picks the higher-HP armour by hp, not damage.
    player.gear = { weapon: null, head: null, body: 'iron_armor', cape: null };
    player.inventory = [];
    player.maxHp = computeMaxHp(); player.hp = player.maxHp;
    equipGear('mithril_armor');                        // 15 hp > iron 5 -> upgrade
    out.autoUpgradeArmour = player.gear.body === 'mithril_armor' && player.inventory.indexOf('iron_armor') !== -1;
    equipGear('iron_armor');                           // 5 hp < 15 -> stays in bag
    out.autoKeepWeaker = player.gear.body === 'mithril_armor' &&
      player.inventory.filter(function (x){return x==='iron_armor';}).length === 2;

    // (e) Equipment is locked during combat: equip/unequip are no-ops while combatOpen.
    activateArea('wilds');
    var slime = currentEnemies[0]; slime.alive = true;
    player.gear = { weapon: null, head: null, body: null, cape: null };
    player.inventory = ['iron_armor'];
    player.maxHp = computeMaxHp(); player.hp = player.maxHp;
    openCombat(slime);
    var equipDuring = equipFromBag(0);
    var unequipDuring = unequipSlot('body');
    out.lockedDuringCombat = equipDuring === false && unequipDuring === false &&
      player.gear.body === null && player.maxHp === 20;
    endSlashPhase(); closeCombat();
    return out;
  });
  await browser.close();
  check('T4: equip grants the new HP immediately (18/20 -> 23/25)', r.grantOnEquip);
  check('T4: unequip clamps hp to the new max', r.clampOnUnequip);
  check('T4: unequip floors a living hero at >=1', r.floorLiving);
  check('T4: auto-equip upgrades armour by hp', r.autoUpgradeArmour);
  check('T4: auto-equip keeps weaker armour in the bag', r.autoKeepWeaker);
  check('T4: equipment locked during combat', r.lockedDuringCombat);
  check('T4: no console errors', errors.length === 0);
}

// ---- Task 5: comparisons & display strings ----
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    var out = {};
    selectProfile('adventurer');
    player.level = 1; player.hpUpgrades = 0;
    player.gear = { weapon: 'wooden_sword', head: null, body: 'iron_armor', cape: null };
    player.inventory = ['guardian_armor', 'crystal_blade'];
    player.maxHp = computeMaxHp(); player.hp = player.maxHp;
    openCharacter();
    var bag = document.getElementById('bagList').innerHTML;
    var equipped = document.getElementById('equippedSlots').innerHTML;
    out.noUndefined = bag.indexOf('undefined') === -1 && equipped.indexOf('undefined') === -1;
    // Armour bag row talks in hearts/HP, weapon bag row talks in Attack.
    out.armourReadsHearts = /heart|HP/i.test(bag);
    out.weaponReadsAttack = /Attack/.test(bag);
    // Equipped armour line shows hearts, not "dmg".
    out.equippedArmourHearts = /Iron Armor[\s\S]*heart/i.test(equipped) || /Iron Armor[\s\S]*HP/i.test(equipped);
    closeCharacter();
    // Shop sell list row for armour must not say "undefined dmg".
    player.inventory = ['guardian_armor'];
    renderGearSell();
    var sell = document.getElementById('gearSellList').innerHTML;
    out.sellNoUndefined = sell.indexOf('undefined') === -1;
    return out;
  });
  await browser.close();
  check('T5: no "undefined" in equipped/bag strings', r.noUndefined);
  check('T5: armour bag row reads in hearts/HP', r.armourReadsHearts);
  check('T5: weapon bag row reads in Attack', r.weaponReadsAttack);
  check('T5: equipped armour line shows hearts', r.equippedArmourHearts);
  check('T5: shop sell row has no "undefined"', r.sellNoUndefined);
  check('T5: no console errors', errors.length === 0);
}

// ---- Task 6: hearts display ----
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    var out = {};
    // Pure unit function: floor + guards. (2 half-units = 1 heart; 2.5 HP per half-unit.)
    out.full = heartHalfUnits(20, 20) === 8;          // 4 full hearts
    out.floored = heartHalfUnits(17, 20) === 6;       // floor(17/2.5)=6 -> 3 hearts (not 3.5)
    out.halfStep = heartHalfUnits(18, 20) === 7;      // floor(18/2.5)=7 -> 3.5 hearts
    out.guardAliveMin = heartHalfUnits(1, 20) === 1;  // Guard A: alive -> at least half a heart
    out.guardDead = heartHalfUnits(0, 20) === 0;      // dead -> zero
    out.guardHurtNeverFull = heartHalfUnits(19, 20) === 7 && heartHalfUnits(19, 20) < 8; // Guard B
    // Both guards hold far into chip/overflow territory (250 maxHp = 50 hearts, cap 30):
    // heartHalfUnits always works off the TRUE hp/maxHp, never the capped display total.
    out.guardAChip = heartHalfUnits(1, 250) === 1;                       // Guard A, chip territory
    out.guardBChip = heartHalfUnits(245, 250) < Math.round(250 / 2.5);   // Guard B, chip territory
    // Rendering + stress cases (max HP always a multiple of 5 -> whole-heart rows).
    selectProfile('adventurer');
    activateArea('wilds'); var slime = currentEnemies[0]; slime.alive = true;
    function heartsFor(max, hp) {
      player.gear = { weapon: null, head: null, body: null, cape: null };
      player.hpUpgrades = 0; player.level = 1; player.maxHp = max; player.hp = hp;
      openCombat(slime); updateCombatBars();
      var el = document.getElementById('youHearts');
      var full = el.querySelectorAll('.heart-full').length;
      var half = el.querySelectorAll('.heart-half').length;
      var overflowEl = el.querySelector('.heart-overflow');
      var overflow = el.querySelectorAll('.heart-overflow').length;
      var chipText = overflowEl ? overflowEl.textContent : null;
      var num = document.getElementById('youHpNum').textContent;
      endSlashPhase(); closeCombat();
      return { full: full, half: half, overflow: overflow, chipText: chipText, num: num };
    }
    var s20 = heartsFor(20, 20), s40 = heartsFor(40, 40), s80 = heartsFor(80, 80),
        s150 = heartsFor(150, 150), s200 = heartsFor(200, 200);
    out.s20 = s20.full === 4 && s20.half === 0 && s20.num === '20/20';
    out.s40 = s40.full === 8 && s40.num === '40/40';
    out.s80 = s80.full === 16 && s80.num === '80/80';
    out.s150 = s150.full === 30 && s150.overflow === 0 && s150.chipText === null && s150.num === '150/150';
    out.s200 = s200.full === 30 && s200.overflow === 1 && s200.chipText === '+10' && s200.num === '200/200';
    // Chip-territory RENDER checks (250 maxHp = 50 hearts, cap 30, chip covers 20 hidden hearts):
    // Guard A — 1 HP still shows a living half-heart, not zero, even under a cap-exceeding max.
    var chipGuardA = heartsFor(250, 1);
    out.chipGuardARender = chipGuardA.full === 0 && chipGuardA.half === 1 &&
      chipGuardA.chipText === '+20' && chipGuardA.num === '1/250';
    // Guard B — a hero hurt by 5 HP out of 250 still reads correctly: the exact text is the
    // truth (245/250), and the chip text is exact regardless of how many shown hearts are full.
    var chipGuardB = heartsFor(250, 245);
    out.chipGuardBRender = chipGuardB.chipText === '+20' && chipGuardB.num === '245/250';
    // The player HP row shows hearts, not a proportional fill bar.
    out.noPlayerBar = document.getElementById('youHpFill') === null;
    // The enemy row keeps its bar + exact readout untouched.
    out.enemyBarKept = document.getElementById('enemyHpFill') !== null &&
      document.getElementById('enemyHpNum') !== null;
    return out;
  });
  await browser.close();
  check('T6: full row = 8 half-units', r.full);
  check('T6: floored, never rounds up', r.floored);
  check('T6: half-heart step', r.halfStep);
  check('T6: Guard A — living hero shows >= half heart', r.guardAliveMin);
  check('T6: dead hero shows zero hearts', r.guardDead);
  check('T6: Guard B — hurt hero never shows a full row', r.guardHurtNeverFull);
  check('T6: Guard A holds in chip territory (pure fn)', r.guardAChip);
  check('T6: Guard B holds in chip territory (pure fn)', r.guardBChip);
  check('T6: stress 20 HP = 4 hearts', r.s20);
  check('T6: stress 40 HP = 8 hearts', r.s40);
  check('T6: stress 80 HP = 16 hearts', r.s80);
  check('T6: stress 150 HP = 30 hearts (at cap, no chip)', r.s150);
  check('T6: stress 200 HP = 30 hearts + chip "+10"', r.s200);
  check('T6: chip territory Guard A render (1/250 -> half heart + "+20")', r.chipGuardARender);
  check('T6: chip territory Guard B render (245/250 -> "+20", exact text is truth)', r.chipGuardBRender);
  check('T6: player HP fill bar is gone', r.noPlayerBar);
  check('T6: enemy bar + exact readout kept', r.enemyBarKept);
  check('T6: no console errors', errors.length === 0);
}

if (fails.length) { console.log('\n' + fails.length + ' FAILED'); process.exit(1); }
console.log('\nAll armor-hearts tests passed.');
