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

if (fails.length) { console.log('\n' + fails.length + ' FAILED'); process.exit(1); }
console.log('\nAll armor-hearts tests passed.');
