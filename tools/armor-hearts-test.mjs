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

if (fails.length) { console.log('\n' + fails.length + ' FAILED'); process.exit(1); }
console.log('\nAll armor-hearts tests passed.');
