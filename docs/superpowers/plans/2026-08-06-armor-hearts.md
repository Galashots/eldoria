# Armor-as-Hearts (Sub-project 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `armour`/`head`/`cape` items grant effective HP (whole hearts) instead of damage, with max HP derived from one source of truth, pinned sell values so no economy number moves, a floored half-heart player display, and a compensating balance pass — all with no save-version bump.

**Architecture:** `computeMaxHp()` becomes the single derivation of `player.maxHp` (base + level + Heart Crystals + equipped-armour hearts). Live equip grants the delta immediately; unequip clamps down (floor 1 for a living hero); save ingest recomputes and **derives-wins** over any disagreeing stored `maxHp`, clamping current `hp` down but never resurrecting `hp <= 0`. Weapons are untouched (they keep `damage`). All 16 `GEAR` items gain an explicit pinned `sellValue`. The player's combat HP bar is replaced by floored half-hearts; the enemy keeps its bar + exact readout.

**Tech Stack:** Vanilla ES5-style globals (`var`/`function`), one offline `index.html` + numbered `js/NN-*.js` deferred scripts + `eldoria.css`. Tests are Puppeteer scripts under `tools/*.mjs` launched via `tools/smoke-test.mjs`'s `launch()`, wired into `npm test`.

## Global Constraints

- **Base source:** branch `agent/armor-hearts-20260806` off `main` @ `cc5df6d`. **Merge order: rebase onto `main` AFTER sub-project 1 (retire-top-down) lands, then rerun all gates.**
- **No save-version bump.** `SAVE_VERSION` stays 4. No new save field. Derivation reproduces every well-formed *post-change* save exactly; old saves are reconciled by derived-wins on ingest.
- **No resurrection.** Ingest recomputation clamps `hp` DOWN only (`min`); a defeated hero (`hp <= 0`) is never raised.
- **Weapons keep `damage`; `armour`/`head`/`cape` lose `damage` and carry exactly one stat: `hp` (a multiple of `HEART_HP` = 5).**
- **Pinned economy.** Every item gains `sellValue` = its *current* sell price (old `damage * 5`). `gearSellPrice()` returns `sellValue`. No gold number moves.
- **Equipment locked during combat.** Immediate HP grant is only safe because equip/unequip cannot run mid-fight.
- **Hearts are the PLAYER display only**, floored to half-hearts, never rounding up, with both rounding guards. Enemy HP keeps its compact exact readout unchanged.
- **Do NOT touch** renderer files `js/07-hud-movement.js`, `js/08-*.js`, `js/09-main.js`; facing machinery; or enemy display beyond its existing compact exact readout.
- **Do NOT edit any existing mechanics/save test** (`combat-progression-test.mjs`, `playtest-fixes-test.mjs`, `profile-state-test.mjs`, `identity-progression-test.mjs`). New coverage goes in `tools/armor-hearts-test.mjs`. *If any existing mechanics test starts failing, STOP and report to Fable — that is a decision-2 / scope signal, not a test to "fix".*
- **STOP-and-report-to-Fable triggers:** any mechanics-test edit; any save-version temptation; any balance change beyond the compensating pass in Task 7; any file conflict with the retire-top-down lane.

## File ownership (declared for the parallel lanes 1 / 2 / A per spec §7)

Sub-project 2 **owns and edits**:
- `js/03-maps-areas.js` — the `GEAR` table only.
- `js/05-combat-cooking.js` — `computeMaxHp`/`maxHpFor`/`armorHpBonus`, `gearSellPrice`, `equipGear`, `equipFromBag`, `unequipSlot`, `updateCombatBars`, `renderGearSell` display strings.
- `js/06-saves.js` — `migrateSaveToV4` derived-wins block only.
- `js/10-character.js` — comparisons + slot display strings.
- `index.html` — the **player** combat HP row (`#youHp*`) only.
- `eldoria.css` — new heart styles only.
- `tools/armor-hearts-test.mjs` (new) + `package.json` test wiring.
- `docs/CHARACTER_INVENTORY.md` — stats/comparisons/selling reconciliation (spec §8 registry).

Sub-project 2 **must NOT touch** (owned by lane 1): `js/07/08/09`, `OVERLAY_DIRECTIONS`, `cardinalFromVector`, `FACING_TO_CARDINAL`, `?iso=` machinery, `paperDollDirection` (stays `'right'`). **Shared-file coordination:** `index.html` and the `tools/` test list are edited by both lanes — lane 2 edits only the `#youHp*` player row and appends its own test. Any overlapping hunk = STOP and report to Fable.

## Open decisions for Fable's direction (balance values — Leo locks per Charter)

These are *derived* proposals, not settled. The plan codes the recommended default so it is testable end-to-end; **Fable directs and Leo locks the magnitudes before merge.**

1. **Per-item `hp` magnitudes (Task 1).** Recommended **Option A: `hp = old_damage * 5`** (1 old damage point → 1 heart). It preserves the exact tier ordering, and makes each piece's hearts legible. Consequence: a full tier-3 armour set (Titan Helm 25 + Dragon Cape 25 + Wyrm Scale 45 = 95 HP = 19 hearts) roughly doubles a mid-game hero's HP. **Option B (gentler):** 5/5/5 (tier1), 10/10/10 (tier2), 15/15/15 + Wyrm 20 (tier3) → full tier-3 set = 50 HP = 10 hearts. Task 1 codes Option A; switching to B is a table edit + re-running Task 7.
2. **Compensating-pass shape (Task 7).** Recommended: **no offense buff.** Regular kills are unchanged (a correct zero-tap = `2*base` still one-shots small enemies), and boss per-question damage is already bounded by `phaseCap = ceil(maxHp/3)` regardless of loadout, so removing armour-damage only lengthens boss fights from ~3 to a bounded ~4–6 questions while the HP gain is the intended trade. Task 7 measures the envelope and asserts it stays bounded. If Fable wants fights shorter, the alternative is a flat weapon/base buff — same tests re-run.
3. **Phone-portrait heart cap (Task 6).** Recommended: 10 hearts/row, wrap; display cap **30 hearts (150 HP) = 3 rows**, then a compact `＋N` overflow chip with the exact `hp/maxHp` text authoritative. Concrete and testable; Fable may set a different cap.

---

## Task 1: Pin `sellValue` on all gear; swap armour `damage` → `hp`

**Files:**
- Modify: `js/03-maps-areas.js:239-263` (the `GEAR` table)
- Modify: `js/05-combat-cooking.js:59-64` (`gearSellPrice`)
- Test: `tools/armor-hearts-test.mjs` (new)

**Interfaces:**
- Produces: `GEAR[id].sellValue:number` on all 16 items; `GEAR[id].hp:number` on every `head`/`body`/`cape` item; `damage` remains only on `weapon` items. `gearSellPrice(id) === GEAR[id].sellValue`.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test.** Create `tools/armor-hearts-test.mjs`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `node tools/armor-hearts-test.mjs`
Expected: FAIL on `T1: armour has hp...` and `T1: sellValue pinned...` (fields don't exist yet).

- [ ] **Step 3: Replace the `GEAR` table** (`js/03-maps-areas.js:239-263`) with (Option A magnitudes; keep the surrounding comment block):

```js
var GEAR = {
  // Tier 1 (Wilds drops)
  wooden_sword:  { name: 'Wooden Sword',  slot: 'weapon', damage: 2, sellValue: 10, tier: 1, source: 'Wilds' },
  leather_cap:   { name: 'Leather Cap',   slot: 'head',   hp: 5,     sellValue: 5,  tier: 1, source: 'Wilds' },
  hero_cape:     { name: "Hero's Cape",   slot: 'cape',   hp: 5,     sellValue: 5,  tier: 1, source: 'Wilds' },
  iron_armor:    { name: 'Iron Armor',    slot: 'body',   hp: 10,    sellValue: 10, tier: 1, source: 'Wilds' },
  crystal_blade: { name: 'Crystal Blade', slot: 'weapon', damage: 5, sellValue: 25, tier: 1, source: 'Wilds' },
  // Tier 2 (Deep Woods drops) — all stronger than their tier-1 slot-mates.
  steel_sword:    { name: 'Steel Sword',    slot: 'weapon', damage: 6,  sellValue: 30, tier: 2, source: 'Deep Woods' },
  crystal_staff:  { name: 'Crystal Staff',  slot: 'weapon', damage: 8,  sellValue: 40, tier: 2, source: 'Deep Woods' },
  crystal_crown:  { name: 'Crystal Crown',  slot: 'head',   hp: 15,     sellValue: 15, tier: 2, source: 'Deep Woods' },
  guardian_armor: { name: 'Guardian Armor', slot: 'body',   hp: 20,     sellValue: 20, tier: 2, source: 'Deep Woods' },
  shadow_cape:    { name: 'Shadow Cape',    slot: 'cape',   hp: 15,     sellValue: 15, tier: 2, source: 'Deep Woods' },
  // Boss reward (Shadow Warden) — the best weapon in the game, a guaranteed boss/trophy drop.
  eldoria_blade:  { name: 'Eldoria Blade',  slot: 'weapon', damage: 12, sellValue: 60, tier: 2, source: 'Shadow Warden', trophy: 'Shadow Warden' },
  // Tier 3 (Mine drops) — weapons stay BELOW the Eldoria Blade (12) so "best weapon" holds.
  obsidian_blade: { name: 'Obsidian Blade', slot: 'weapon', damage: 10, sellValue: 50, tier: 3, source: 'Mine' },
  titan_helm:     { name: 'Titan Helm',     slot: 'head',   hp: 25,     sellValue: 25, tier: 3, source: 'Mine' },
  dragon_cape:    { name: 'Dragon Cape',    slot: 'cape',   hp: 25,     sellValue: 25, tier: 3, source: 'Mine' },
  mithril_armor:  { name: 'Mithril Armor',  slot: 'body',   hp: 30,     sellValue: 30, tier: 3, source: 'Mine' },
  // Crystal Wyrm boss reward — best armour in the game, guaranteed every win.
  wyrm_scale:     { name: 'Wyrm Scale Armor', slot: 'body', hp: 45,     sellValue: 45, tier: 3, source: 'Crystal Wyrm', trophy: 'Crystal Wyrm' }
};
```

- [ ] **Step 4: Point `gearSellPrice` at the pinned value** (`js/05-combat-cooking.js:59-64`):

```js
// What a spare gear item sells for. Pinned per item as `sellValue` (combat-armor spec §4)
// so removing `damage` from armour moves no economy number. Equipped gear isn't sellable,
// so this only ever runs on bag items.
function gearSellPrice(itemId) {
  var item = GEAR[itemId];
  return item ? item.sellValue : 0;
}
```

- [ ] **Step 5: Run the test to verify Task-1 checks pass.**

Run: `node tools/armor-hearts-test.mjs`
Expected: the four `T1:` checks PASS. (Later tasks' checks may not exist yet.)

- [ ] **Step 6: Run the existing sell-price regression to prove no economy drift.**

Run: `node tools/identity-progression-test.mjs`
Expected: PASS, including `gearSellPrice('eldoria_blade') === 60 && gearSellPrice('wooden_sword') === 10`. **If it fails, STOP and report to Fable.**

- [ ] **Step 7: Commit.**

```bash
git add js/03-maps-areas.js js/05-combat-cooking.js tools/armor-hearts-test.mjs
git commit -m "feat(armor): pin gear sellValue; armour/head/cape carry hp not damage"
```

---

## Task 2: Introduce `computeMaxHp()` / `maxHpFor()` (single source of truth)

**Files:**
- Modify: `js/05-combat-cooking.js` — add after `playerDamage()` (currently ~`:21`)
- Test: `tools/armor-hearts-test.mjs`

**Interfaces:**
- Consumes: `player.level`, `player.hpUpgrades`, `player.gear`, `GEAR`, `HEART_HP` (=5, defined in `js/04`), `EQUIPMENT_SLOTS` (`js/02`).
- Produces: `maxHpFor(level, hpUpgrades, gear) -> number`, `armorHpBonus() -> number`, `computeMaxHp() -> number`. Load order is safe: `js/05` defines them; `js/06` calls `maxHpFor` at runtime only.

- [ ] **Step 1: Write the failing test.** Append to `tools/armor-hearts-test.mjs` before the final `if (fails.length)` block:

```js
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
    // Armour adds its hearts; multiple pieces sum.
    player.gear.body = 'wyrm_scale'; player.gear.head = 'titan_helm';
    out.armourSums = computeMaxHp() === 65 + 45 + 25; // 135
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
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `node tools/armor-hearts-test.mjs`
Expected: FAIL — `computeMaxHp is not defined`.

- [ ] **Step 3: Add the functions** in `js/05-combat-cooking.js`, immediately after `playerDamage()`:

```js
// Sum of +HP (hearts) from all equipped armour. Weapons carry `damage`, not `hp`.
function armorHpBonus() {
  var bonus = 0;
  for (var i = 0; i < EQUIPMENT_SLOTS.length; i++) {
    var id = player.gear[EQUIPMENT_SLOTS[i]];
    if (id && GEAR[id] && typeof GEAR[id].hp === 'number') bonus += GEAR[id].hp;
  }
  return bonus;
}

// Pure derivation (combat-armor spec §4): the ONE formula for max HP. Takes explicit
// state so save ingest can derive from a canonical snapshot before `player` is live.
//   20 (base) + (level-1)*5 + hpUpgrades*HEART_HP + armour hearts
function maxHpFor(level, hpUpgrades, gear) {
  var armor = 0;
  for (var i = 0; i < EQUIPMENT_SLOTS.length; i++) {
    var id = gear[EQUIPMENT_SLOTS[i]];
    if (id && GEAR[id] && typeof GEAR[id].hp === 'number') armor += GEAR[id].hp;
  }
  return 20 + (level - 1) * 5 + hpUpgrades * HEART_HP + armor;
}

// Live reader over the current player. Single source of truth for player.maxHp.
function computeMaxHp() {
  return maxHpFor(player.level, player.hpUpgrades, player.gear);
}
```

- [ ] **Step 4: Run the test to verify Task-2 checks pass.**

Run: `node tools/armor-hearts-test.mjs`
Expected: all `T2:` checks PASS.

- [ ] **Step 5: Commit.**

```bash
git add js/05-combat-cooking.js tools/armor-hearts-test.mjs
git commit -m "feat(armor): add computeMaxHp/maxHpFor single source of truth"
```

---

## Task 3: Derived-wins ingest custody (no version bump, no resurrection)

**Files:**
- Modify: `js/06-saves.js:220-260` (`migrateSaveToV4` — reorder the maxHp/hp derivation to after gear is resolved)
- Test: `tools/armor-hearts-test.mjs`

**Interfaces:**
- Consumes: `maxHpFor` (Task 2), `EQUIPMENT_SLOTS`, `GEAR`.
- Produces: canonical `out.player.maxHp = maxHpFor(level, hpUpgrades, gear)`; `out.player.hp = min(storedHp, maxHp)`. `applyState` (a straight setter) needs no change; `canonicalText` idempotency holds because the derivation is deterministic.

- [ ] **Step 1: Write the failing test.** Append to `tools/armor-hearts-test.mjs`:

```js
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
    // derived = 20 + 6*5 + 45 = 95; hp clamps DOWN to min(20, 95) = 20 (not resurrected up).
    out.derivedWins = res.ok && res.state.player.maxHp === 95 && res.state.player.hp === 20;
    // (b) No resurrection: stored hp 0 stays 0 even though maxHp derives higher.
    var dead = { version: 4, player: { level: 3, hpUpgrades: 0, maxHp: 30, hp: 0,
                 gear: { weapon: null, head: null, body: 'iron_armor', cape: null } } };
    var dres = ingestSaveObject(dead);
    out.noResurrect = dres.ok && dres.state.player.maxHp === (20 + 2*5 + 10) && dres.state.player.hp === 0;
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
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `node tools/armor-hearts-test.mjs`
Expected: FAIL — `T3: derived maxHp wins...` (today migrate trusts the stored value; a level-7 save with no maxHp derivation returns 20, and a stored maxHp is copied verbatim).

- [ ] **Step 3: Edit `migrateSaveToV4`.** In `js/06-saves.js`, DELETE the three current maxHp/hp lines at `:233-235`:

```js
  op.maxHp = (p.maxHp != null) ? p.maxHp : 20;
  op.hp = (p.hp != null) ? p.hp : op.maxHp;
  if (op.hp > op.maxHp) op.hp = op.maxHp;
```

Leave `op.level`, `op.xp`, `op.hpUpgrades`, `op.atkUpgrades` and the gear block (`:240-244`) as-is. Then, immediately AFTER the gear block (after `op.inventory` is populated, ~`:249`), INSERT:

```js
  // Derived-wins max-HP custody (combat-armor spec §4): max HP is DERIVED from level,
  // Heart Crystals, and equipped armour — the stored maxHp is never trusted. This needs
  // op.gear resolved first (above). No save-version bump: for every well-formed post-
  // change save the derivation reproduces the stored value exactly. Current hp clamps
  // DOWN only; a defeated hero (hp <= 0) is never resurrected by recomputation.
  op.maxHp = maxHpFor(op.level, op.hpUpgrades, op.gear);
  var storedHp = (p.hp != null) ? p.hp : op.maxHp;
  op.hp = Math.min(storedHp, op.maxHp);
```

- [ ] **Step 4: Run the Task-3 checks.**

Run: `node tools/armor-hearts-test.mjs`
Expected: all `T3:` checks PASS.

- [ ] **Step 5: Run the full save-integrity regression.**

Run: `node tools/profile-state-test.mjs`
Expected: PASS (its gear fixtures never assert `maxHp`/`hp` values, and round-trip idempotency holds). **If any check fails, STOP and report to Fable.**

- [ ] **Step 6: Commit.**

```bash
git add js/06-saves.js tools/armor-hearts-test.mjs
git commit -m "feat(armor): derived-wins maxHp custody on save ingest (no version bump)"
```

---

## Task 4: Equip / unequip HP custody + auto-equip by the slot's stat

**Files:**
- Modify: `js/05-combat-cooking.js:40-57` (`equipGear`), `:113-131` (`equipFromBag`), `:133-143` (`unequipSlot`)
- Test: `tools/armor-hearts-test.mjs`

**Interfaces:**
- Consumes: `computeMaxHp` (Task 2), `combatOpen` (global, `js/05:8`).
- Produces: `applyEquipHpChange(previousMax)` helper; equip grants the max-HP delta to `hp` immediately; unequip clamps `hp` down, floored at 1 for a living hero; both refuse to run while `combatOpen`. Auto-equip upgrade test uses `hp` for armour, `damage` for weapons.

- [ ] **Step 1: Write the failing test.** Append to `tools/armor-hearts-test.mjs`:

```js
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

    // (a) Equipping armour grants the new HP immediately: 18/20 + iron_armor(10) -> 28/30.
    player.inventory = ['iron_armor'];
    equipFromBag(0);
    out.grantOnEquip = player.maxHp === 30 && player.hp === 28;

    // (b) Unequip clamps hp to the new max: 28/30 -> remove -> 18/20 (min(28,20)=20? no: hp>max -> 20).
    unequipSlot('body');
    out.clampOnUnequip = player.maxHp === 20 && player.hp === 20;

    // (c) Unequip floors a living hero at >=1 and never at 0.
    player.gear.body = 'wyrm_scale'; player.maxHp = computeMaxHp(); player.hp = 1; // 1/65
    unequipSlot('body');
    out.floorLiving = player.maxHp === 20 && player.hp >= 1;

    // (d) Auto-equip picks the higher-HP armour by hp, not damage.
    player.gear = { weapon: null, head: null, body: 'iron_armor', cape: null };
    player.inventory = [];
    player.maxHp = computeMaxHp(); player.hp = player.maxHp;
    equipGear('mithril_armor');                        // 30 hp > iron 10 -> upgrade
    out.autoUpgradeArmour = player.gear.body === 'mithril_armor' && player.inventory.indexOf('iron_armor') !== -1;
    equipGear('iron_armor');                           // 10 hp < 30 -> stays in bag
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
  check('T4: equip grants the new HP immediately (18/20 -> 28/30)', r.grantOnEquip);
  check('T4: unequip clamps hp to the new max', r.clampOnUnequip);
  check('T4: unequip floors a living hero at >=1', r.floorLiving);
  check('T4: auto-equip upgrades armour by hp', r.autoUpgradeArmour);
  check('T4: auto-equip keeps weaker armour in the bag', r.autoKeepWeaker);
  check('T4: equipment locked during combat', r.lockedDuringCombat);
  check('T4: no console errors', errors.length === 0);
}
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `node tools/armor-hearts-test.mjs`
Expected: FAIL — equip does not change `maxHp`; `equipGear('mithril_armor')` throws/compares `undefined` damage; no combat lock.

- [ ] **Step 3: Add the shared HP-change helper** in `js/05-combat-cooking.js`, just above `equipGear` (~`:39`):

```js
// Apply a max-HP change after gear changed. `previousMax` is the max BEFORE the gear edit.
// Equip (max grows): grant the delta to current hp immediately (Heart Crystal precedent).
// Unequip (max shrinks): clamp hp down to the new max, floored at 1 for a LIVING hero
// (a defeated hero at hp<=0 is left as-is — recomputation never resurrects).
function applyEquipHpChange(previousMax) {
  var newMax = computeMaxHp();
  player.maxHp = newMax;
  var delta = newMax - previousMax;
  if (delta > 0) player.hp += delta;                 // immediate grant
  if (player.hp > newMax) player.hp = newMax;         // clamp down
  if (player.hp > 0 && player.hp < 1) player.hp = 1;  // living-hero floor (defensive)
}
```

- [ ] **Step 4: Add the combat lock + HP grant to `equipFromBag`** (`js/05:113-131`). Add the guard as the first line and wrap the max-HP change around the gear edit:

```js
function equipFromBag(index) {
  if (combatOpen) return false;                       // equipment locked during combat (OWNER 13)
  if (typeof index !== 'number' || index % 1 !== 0) return false;
  if (index < 0 || index >= player.inventory.length) return false;
  var itemId = player.inventory[index];
  var item = GEAR[itemId];
  if (!item) return false;
  var previousMax = player.maxHp;
  player.inventory.splice(index, 1);            // remove THAT exact instance
  var current = player.gear[item.slot];
  if (current) player.inventory.push(current);  // the old item goes into the bag
  player.gear[item.slot] = itemId;
  applyEquipHpChange(previousMax);              // grant/clamp HP for armour swaps
  showToast('Equipped ' + item.name + '! ' + equipEffectText(item));
  speak('You equipped the ' + item.name + '.');
  updateHUD();
  if (characterOpen && typeof renderCharacter === 'function') renderCharacter();
  saveGame();
  return true;
}
```

- [ ] **Step 5: Add the combat lock + HP clamp to `unequipSlot`** (`js/05:133-143`):

```js
function unequipSlot(slot) {
  if (combatOpen) return false;                       // equipment locked during combat (OWNER 13)
  if (EQUIPMENT_SLOTS.indexOf(slot) === -1) return false;
  var itemId = player.gear[slot];
  if (!itemId || !GEAR[itemId]) return false;
  var previousMax = player.maxHp;
  player.inventory.push(itemId);
  player.gear[slot] = null;
  applyEquipHpChange(previousMax);              // clamp hp down (floor 1 for a living hero)
  showToast('Put ' + GEAR[itemId].name + ' in your bag.');
  speak('You put the ' + GEAR[itemId].name + ' in your bag.');
  updateHUD();
  if (characterOpen && typeof renderCharacter === 'function') renderCharacter();
  saveGame();
  return true;
}
```

- [ ] **Step 6: Fix `equipGear` (auto-equip loot path)** (`js/05:40-57`) to compare by the slot's stat and grant HP. Add a small stat accessor and an effect-text helper just above it:

```js
// The one number that ranks two items in the SAME slot: weapons by damage, armour by hp.
// (Each slot carries exactly one stat, so same-slot items always compare on the same field.)
function gearRankStat(itemId) {
  var g = GEAR[itemId];
  if (!g) return 0;
  return (typeof g.damage === 'number') ? g.damage : (g.hp || 0);
}

// Child-readable effect line for equip toasts: weapons say damage, armour says hearts.
function equipEffectText(item) {
  if (typeof item.damage === 'number') return '+' + item.damage + ' damage';
  return '+' + (item.hp / HEART_HP) + (item.hp === HEART_HP ? ' heart' : ' hearts');
}

function equipGear(itemId) {
  var item = GEAR[itemId];
  if (!item) return;
  var current = player.gear[item.slot];
  if (current && GEAR[current] && gearRankStat(current) >= gearRankStat(itemId)) {
    // Not an upgrade — keep it in the bag to sell for gold.
    player.inventory.push(itemId);
    showToast('Found ' + item.name + ' — in your bag to sell (' + gearSellPrice(itemId) + 'g).');
    speak('You found a ' + item.name + '. It is in your bag to sell.');
    return;
  }
  // It's an upgrade: the old item (if any) drops into the bag so it's not lost.
  var previousMax = player.maxHp;
  if (current) player.inventory.push(current);
  player.gear[item.slot] = itemId;
  applyEquipHpChange(previousMax);
  showToast('Equipped ' + item.name + '! ' + equipEffectText(item));
  speak('You found a ' + item.name + '! ' + equipEffectText(item) + '!');
  if (characterOpen && typeof renderCharacter === 'function') renderCharacter();
}
```

- [ ] **Step 7: Run the Task-4 checks.**

Run: `node tools/armor-hearts-test.mjs`
Expected: all `T4:` checks PASS.

- [ ] **Step 8: Run the identity/equipment regression** (weapon swaps, dup-safety, auto-equip weapons).

Run: `node tools/identity-progression-test.mjs`
Expected: PASS. **If it fails, STOP and report to Fable.**

- [ ] **Step 9: Commit.**

```bash
git add js/05-combat-cooking.js tools/armor-hearts-test.mjs
git commit -m "feat(armor): immediate HP grant on equip, clamp on unequip, combat lock, hp-ranked auto-equip"
```

---

## Task 5: Slot-aware comparisons and display strings (Character screen + shop)

**Files:**
- Modify: `js/10-character.js:37-49` (`attackComparison` → slot-aware), `:129-135` (equipped slot line), `:162-169` (bag row line)
- Modify: `js/05-combat-cooking.js:93-100` (`renderGearSell` row line)
- Test: `tools/armor-hearts-test.mjs`

**Interfaces:**
- Consumes: `gearRankStat`, `computeMaxHp`, `player`, `GEAR`.
- Produces: `gearCompare(itemId)` returning `{ text, cls }` (attack delta for weapons, heart/HP delta for armour); no `undefined` in any equipped/bag/shop string.

- [ ] **Step 1: Write the failing test.** Append to `tools/armor-hearts-test.mjs`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `node tools/armor-hearts-test.mjs`
Expected: FAIL — armour rows render `+undefined dmg` and `attackComparison` returns `NaN`/`undefined` text for armour.

- [ ] **Step 3: Replace `attackComparison` with a slot-aware `gearCompare`** (`js/10-character.js:34-49`):

```js
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
```

- [ ] **Step 4: Add a shared per-item stat label** in `js/10-character.js` (near `SLOT_LABELS`, ~`:23`):

```js
// The stat blurb for an item wherever it is listed: weapons in damage, armour in hearts.
function gearStatText(itemId) {
  var g = GEAR[itemId];
  if (!g) return '';
  if (typeof g.damage === 'number') return '+' + g.damage + ' dmg';
  var hearts = g.hp / HEART_HP;
  return '+' + hearts + (hearts === 1 ? ' heart' : ' hearts');
}
```

- [ ] **Step 5: Update the equipped-slot line** (`js/10-character.js:131-132`): replace `'+' + g.damage + ' dmg · tier ' + g.tier` with `gearStatText(itemId) + ' · tier ' + g.tier`. Update the bag row (`:161`) to call `gearCompare(itemId)` instead of `attackComparison(itemId)`, and (`:164`) replace `'+' + g.damage + ' dmg · sells '` with `gearStatText(itemId) + ' · sells '`.

- [ ] **Step 6: Update the shop sell row** (`js/05-combat-cooking.js:98`): replace `'+' + g.damage + ' dmg · sells '` with a stat-aware blurb. Add near the top of `renderGearSell` scope or reuse a local:

```js
    var blurb = (typeof g.damage === 'number')
      ? ('+' + g.damage + ' dmg')
      : ('+' + (g.hp / HEART_HP) + ((g.hp / HEART_HP) === 1 ? ' heart' : ' hearts'));
    html += '<div class="shop-row">' +
      '<div class="shop-info"><b>' + g.name + '</b><small>' + blurb + ' · sells ' + price + 'g</small></div>' +
      '<button class="btn-sell" onclick="sellGear(' + i + ')" aria-label="Sell ' + g.name + ' for ' + price + ' gold">Sell ' + price + 'g</button>' +
      '</div>';
```

- [ ] **Step 7: Run the Task-5 checks and the full identity regression.**

Run: `node tools/armor-hearts-test.mjs && node tools/identity-progression-test.mjs`
Expected: all `T5:` PASS; identity regression PASS (it asserts equipped gear is absent from the sell list and the weapon sell prices — no armour stat-string assertion). **If identity regression fails, STOP and report to Fable.**

- [ ] **Step 8: Commit.**

```bash
git add js/10-character.js js/05-combat-cooking.js tools/armor-hearts-test.mjs
git commit -m "feat(armor): slot-aware gear comparisons and hearts display strings"
```

---

## Task 6: Player hearts display (floored half-hearts) — combat player HP row

**Files:**
- Modify: `index.html:237-240` (the **You** HP row only)
- Modify: `js/05-combat-cooking.js:199-208` (`updateCombatBars` — render player hearts; enemy row untouched)
- Modify: `eldoria.css` (append heart styles)
- Test: `tools/armor-hearts-test.mjs`

**Interfaces:**
- Consumes: `player.hp`, `player.maxHp`, `HEART_HP`.
- Produces: `heartHalfUnits(hp, maxHp) -> integer half-heart count` (floored, both guards); `renderHearts(el, hp, maxHp)` writing full/half/empty heart glyphs + an accessible exact label. Enemy row (`#enemyHp*`) is NOT changed.

**Phone-portrait contract (concrete):** 1 heart = 5 HP; 1 half-heart = 2.5 HP; floored (never rounds up). Guard A: a living hero (`hp > 0`) shows **≥ half a heart**. Guard B: a hurt hero (`hp < maxHp`) **never shows a full row**. Layout: `.hearts` is `display:flex; flex-wrap:wrap;` capped at **10 hearts per row**; displayed hearts cap at **30 (150 HP = 3 rows)**; beyond that a `＋N` overflow chip is appended and the exact `hp/maxHp` text (always present, `aria-live`) is authoritative. Stress cases rendered + asserted: 20 HP (4 hearts), 40 HP (8), 80 HP (16, 2 rows), 150 HP (30, at cap), 200 HP (30 + `＋10`).

- [ ] **Step 1: Write the failing test.** Append to `tools/armor-hearts-test.mjs`:

```js
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
      var overflow = el.querySelectorAll('.heart-overflow').length;
      var num = document.getElementById('youHpNum').textContent;
      endSlashPhase(); closeCombat();
      return { full: full, half: half, overflow: overflow, num: num };
    }
    var s20 = heartsFor(20, 20), s40 = heartsFor(40, 40), s80 = heartsFor(80, 80),
        s150 = heartsFor(150, 150), s200 = heartsFor(200, 200);
    out.s20 = s20.full === 4 && s20.half === 0 && s20.num === '20/20';
    out.s40 = s40.full === 8 && s40.num === '40/40';
    out.s80 = s80.full === 16 && s80.num === '80/80';
    out.s150 = s150.full === 30 && s150.overflow === 0 && s150.num === '150/150';
    out.s200 = s200.full === 30 && s200.overflow === 1 && s200.num === '200/200'; // capped + chip
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
  check('T6: stress 20 HP = 4 hearts', r.s20);
  check('T6: stress 40 HP = 8 hearts', r.s40);
  check('T6: stress 80 HP = 16 hearts', r.s80);
  check('T6: stress 150 HP = 30 hearts (at cap)', r.s150);
  check('T6: stress 200 HP = 30 hearts + overflow chip', r.s200);
  check('T6: player HP fill bar is gone', r.noPlayerBar);
  check('T6: enemy bar + exact readout kept', r.enemyBarKept);
  check('T6: no console errors', errors.length === 0);
}
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `node tools/armor-hearts-test.mjs`
Expected: FAIL — `heartHalfUnits is not defined`; `#youHearts` missing.

- [ ] **Step 3: Replace the player HP row markup** in `index.html:237-240` (leave the enemy row `:232-236` untouched):

```html
    <div class="hp-row">
      <span class="hp-label">You</span>
      <div class="hearts" id="youHearts" role="img" aria-label="Your health"></div>
      <span class="hp-num" id="youHpNum" aria-live="polite">20/20</span>
    </div>
```

- [ ] **Step 4: Add heart functions and repoint `updateCombatBars`** in `js/05-combat-cooking.js`. Add above `updateCombatBars` (~`:198`):

```js
var HEART_HP_HALF = 2.5;        // 1 heart = 5 HP = 2 half-heart units
var HEARTS_PER_ROW = 10;        // phone-portrait wrap width (styling reflects this)
var HEART_DISPLAY_CAP = 30;     // hearts drawn before the +N overflow chip (150 HP)

// Half-heart units (integer), FLOORED, with both rounding guards (combat-armor spec §5):
//   Guard A: a living hero (hp>0) shows at least half a heart.
//   Guard B: a hurt hero (hp<maxHp) never shows a full row.
function heartHalfUnits(hp, maxHp) {
  var maxHalves = Math.round(maxHp / HEART_HP_HALF);   // maxHp is a multiple of 5 -> even
  var halves = Math.floor(hp / HEART_HP_HALF);         // floor: never rounds up
  if (halves < 0) halves = 0;
  if (halves > maxHalves) halves = maxHalves;
  if (hp > 0 && halves < 1) halves = 1;                // Guard A
  if (hp < maxHp && halves >= maxHalves) halves = maxHalves - 1;  // Guard B
  return halves;
}

// Draw hearts into `el` for hp/maxHp: full (♥), half, empty, capped with a +N chip.
function renderHearts(el, hp, maxHp) {
  if (!el) return;
  var maxHalves = Math.round(maxHp / HEART_HP_HALF);
  var filledHalves = heartHalfUnits(hp, maxHp);
  var totalHearts = maxHalves / 2;
  var shown = Math.min(totalHearts, HEART_DISPLAY_CAP);
  var html = '';
  for (var i = 0; i < shown; i++) {
    var heartHalves = filledHalves - i * 2;            // half-units remaining for THIS heart
    var cls = heartHalves >= 2 ? 'heart-full' : (heartHalves === 1 ? 'heart-half' : 'heart-empty');
    html += '<span class="' + cls + '" aria-hidden="true">♥</span>';
  }
  if (totalHearts > HEART_DISPLAY_CAP) {
    html += '<span class="heart-overflow" aria-hidden="true">＋' + (totalHearts - HEART_DISPLAY_CAP) + '</span>';
  }
  el.innerHTML = html;
  el.setAttribute('aria-label', 'Your health: ' + Math.max(0, hp) + ' of ' + maxHp);
}
```

Then rewrite `updateCombatBars` so the ENEMY branch is byte-for-byte unchanged and only the player branch swaps to hearts:

```js
function updateCombatBars() {
  if (!combatEnemy) return;
  var ePct = Math.max(0, combatEnemy.hp) / combatEnemy.maxHp * 100;
  document.getElementById('enemyName').textContent = combatEnemy.name;
  document.getElementById('enemyHpFill').style.width = ePct + '%';
  document.getElementById('enemyHpNum').textContent = Math.max(0, combatEnemy.hp) + '/' + combatEnemy.maxHp;
  renderHearts(document.getElementById('youHearts'), player.hp, player.maxHp);
  document.getElementById('youHpNum').textContent = Math.max(0, player.hp) + '/' + player.maxHp;
}
```

- [ ] **Step 5: Append heart styles** to `eldoria.css`:

```css
/* Player hearts (combat-armor spec §5): floored half-hearts, phone-portrait wrap. */
.hearts { display: flex; flex-wrap: wrap; align-items: center; gap: 1px;
  max-width: calc(10 * 1.15em); line-height: 1; }
.hearts .heart-full { color: #e53e3e; }
.hearts .heart-half { color: #e53e3e; opacity: 0.55; }
.hearts .heart-empty { color: #4a2b2b; }
.hearts .heart-overflow { color: #e53e3e; font-weight: 700; margin-left: 2px; font-size: 0.8em; }
```

- [ ] **Step 6: Run the Task-6 checks.**

Run: `node tools/armor-hearts-test.mjs`
Expected: all `T6:` checks PASS.

- [ ] **Step 7: Commit.**

```bash
git add index.html js/05-combat-cooking.js eldoria.css tools/armor-hearts-test.mjs
git commit -m "feat(armor): floored half-heart player HP display with phone-portrait contract"
```

---

## Task 7: Compensating balance pass (measured fight-length envelope)

**Files:**
- Test: `tools/armor-hearts-test.mjs`
- (Code change ONLY if Fable directs an offense buff — default is none.)

**Interfaces:**
- Consumes: `playerDamage`, `computeMaxHp`, `openCombat`, `answerCombat`, `executeSlash`, `endSlashPhase`, boss/enemy data.
- Produces: an asserted envelope proving hearts-only loadouts keep fights bounded and the ≥3-question boss floor intact, plus the survivability trade.

- [ ] **Step 1: Write the envelope test.** Append to `tools/armor-hearts-test.mjs`:

```js
// ---- Task 7: compensating balance pass (measured envelope) ----
{
  const { browser, page, errors } = await launch();
  const HELPERS = `
    function mash(n){ for (var i=0;i<n;i++) executeSlash(); }
    function fightBoss(area, index) {
      activateArea(area); var boss = currentEnemies[index]; boss.alive = true;
      openCombat(boss); combatEnemy.hp = combatEnemy.maxHp;
      var q = 0, guard = 60;
      while (combatOpen && guard-- > 0) { answerCombat(combatAnswer); mash(50); q++; if (combatOpen) endSlashPhase(); }
      return q;
    }
    function killRegular(area, index) {
      activateArea(area); var e = currentEnemies[index]; e.alive = true;
      openCombat(e); combatEnemy.hp = combatEnemy.maxHp;
      answerCombat(combatAnswer); var oneShot = !combatOpen || combatEnemy.hp <= 0;
      var dealt = combatEnemy.maxHp - Math.max(0, combatEnemy.hp);
      if (combatOpen) { endSlashPhase(); closeCombat(); }
      return { oneShot: oneShot, dealt: dealt };
    }
  `;
  const r = await page.evaluate(HELPERS + `(() => {
    var out = {};
    selectProfile('adventurer');
    // Hearts-only "strong" loadout: best weapon + full armour (armour now = HP, not damage).
    player.gear = { weapon: 'eldoria_blade', head: 'titan_helm', body: 'wyrm_scale', cape: 'dragon_cape' };
    player.atkUpgrades = 0; player.level = 20;
    player.maxHp = computeMaxHp(); player.hp = player.maxHp;
    out.strongMaxHp = player.maxHp;                       // armour visibly adds hearts
    out.wardenQ = fightBoss('deepwoods', 3);
    out.wyrmQ = fightBoss('mine', 2);
    // Bare loadout (no armour) survivability is strictly lower than armoured.
    var armouredMax = computeMaxHp();
    player.gear = { weapon: 'eldoria_blade', head: null, body: null, cape: null };
    var bareMax = computeMaxHp();
    out.survivabilityTrade = armouredMax > bareMax;
    // Regular enemies still die fast on a correct zero-tap (unchanged feel).
    player.gear = { weapon: 'wooden_sword', head: 'leather_cap', body: 'iron_armor', cape: 'hero_cape' };
    player.level = 2; player.maxHp = computeMaxHp(); player.hp = player.maxHp;
    out.slime = killRegular('wilds', 0);                  // Slime 15 HP
    return out;
  })()`);
  await browser.close();
  check('T7: armour adds hearts to max HP (strong loadout > base)', r.strongMaxHp > 20 + 19 * 5);
  check('T7: Shadow Warden still needs >= 3 answered questions', r.wardenQ >= 3);
  check('T7: Shadow Warden fight stays bounded (<= 12 questions)', r.wardenQ <= 12);
  check('T7: Crystal Wyrm still needs >= 3 answered questions', r.wyrmQ >= 3);
  check('T7: Crystal Wyrm fight stays bounded (<= 12 questions)', r.wyrmQ <= 12);
  check('T7: armour is the survivability trade (armoured max HP > bare)', r.survivabilityTrade);
  check('T7: regular Slime still one-shot by a correct zero-tap', r.slime.oneShot);
  check('T7: no console errors', errors.length === 0);
}
```

- [ ] **Step 2: Run it.**

Run: `node tools/armor-hearts-test.mjs`
Expected: all `T7:` checks PASS with the default (no offense buff).

- [ ] **Step 3 (CONDITIONAL — only if a bound fails or Fable directs a buff): STOP and report to Fable** with the measured `wardenQ`/`wyrmQ` numbers and the proposed one-line buff (base `5` in `playerDamage`, or specific weapon `damage` values). Do NOT change any balance number without Fable's direction and Leo's lock. Re-run this test after any directed change.

- [ ] **Step 4: Commit the evidence.**

```bash
git add tools/armor-hearts-test.mjs
git commit -m "test(armor): compensating balance envelope — bounded fights, survivability trade"
```

---

## Task 8: Doc reconciliation + wire the test into `npm test`

**Files:**
- Modify: `package.json:test` script
- Modify: `docs/CHARACTER_INVENTORY.md` (stats / comparisons / selling only — spec §8 registry assigns art to sub-project 5)
- Test: full `npm test`

- [ ] **Step 1: Wire the new test file** into `package.json`'s `test` script by appending ` && node tools/armor-hearts-test.mjs` to the end of the existing chain.

- [ ] **Step 2: Reconcile `docs/CHARACTER_INVENTORY.md`** — update the sections that describe damage-only stats, damage-based comparisons, and damage-based selling to the hearts model: armour/head/cape now grant hearts (max HP), comparisons read Attack (weapons) or Hearts (armour), and selling uses the pinned `sellValue`. Leave every art/overlay claim untouched (spec §8 assigns those to sub-project 5) and add a one-line pointer that item art remains deferred.

- [ ] **Step 3: Run the FULL gate.**

Run: `npm test`
Expected: every suite PASS, including `armor-hearts-test.mjs`. **If any pre-existing suite fails, STOP and report to Fable** (it means a change reached beyond this sub-project's scope).

- [ ] **Step 4: Manual iPad-portrait visual check (evidence, not inferred).** Load `index.html`, enter a fight at 20/20, 18/20 (hurt, half-heart shows), 1/20 (Guard A), and a high-HP armoured loadout (multi-row wrap); confirm hearts read cleanly in phone portrait and the exact number stays beside them. Capture screenshots for the PR per `LARGE_PR_EXECUTION.md`.

- [ ] **Step 5: Commit.**

```bash
git add package.json docs/CHARACTER_INVENTORY.md
git commit -m "chore(armor): wire armor-hearts test into npm test; reconcile CHARACTER_INVENTORY stats/selling"
```

---

## Self-review (spec coverage)

- **OWNER 12 (hearts-only, one stat/slot, pinned sellValue, compensating pass w/ tests):** Tasks 1 (data + sellValue), 7 (balance). ✓
- **OWNER 13 (immediate grant on equip; unequip clamp floor-1 living; no resurrection; locked in combat):** Task 4. ✓
- **§4 `computeMaxHp` + derived-wins ingest, no version bump, no resurrection:** Tasks 2 + 3. ✓
- **§4 armour hp = multiples of 5; weapons unchanged:** Task 1. ✓
- **§5 hearts player-only, floored half-hearts, both guards, exact text, concrete phone-portrait contract, enemy exact readout kept:** Task 6. ✓
- **§5 replaces the fixed-width normalized player bar** (`#youHpFill`): Task 6. ✓
- **§9 tests:** unequip floor-1 (T4), no-resurrection (T3), derived-wins custody (T3), immediate grant (T4), pinned sellValue (T1), heart floor + both guards (T6), mechanics tests pass untouched (T1/T3/T4/T5/T8 regressions). ✓
- **§7 file ownership + rebase-after-lane-1 merge order:** declared above. ✓

## Not in this sub-project (guardrails)

- Renderer files `js/07/08/09`, facing machinery, `paperDollDirection`, top-down retirement → lane 1.
- Per-item gear ART, `down-right` paper-doll move → sub-projects 4/5.
- Enemy HP display beyond its existing compact exact readout → untouched.
- Any balance number beyond Task 7's measured pass → STOP + Fable.
