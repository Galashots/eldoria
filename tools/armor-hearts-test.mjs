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

if (fails.length) { console.log('\n' + fails.length + ' FAILED'); process.exit(1); }
console.log('\nAll armor-hearts tests passed.');
