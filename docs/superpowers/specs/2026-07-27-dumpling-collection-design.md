# Squishy Dumpling Collection — Design Spec

- **Date:** 2026-07-27
- **Game:** Realm of Eldoria (original / `eldoria-public`, single-file `index.html`)
- **Status:** Design approved in brainstorming; ready for implementation planning
- **Author:** Leo + Claude (brainstorming session)

## 1. Summary & goal

Add a **collectible squishy-dumpling gacha** to the original Realm of Eldoria, inspired by the
blind-box squishies you get at 7-Eleven. Leo's two kids love the farming and battling systems;
this feature gives them a wholesome collection goal that plugs into both. You spend **earned
in-game gold** to pull random dumplings of varying rarity, display them in a cute showcase, and
equip one at a time as a **buddy** whose small buff helps you farm or battle.

**Non-negotiable framing (kid-safe):** gold-only (never real money), generous pity so a kid is
never stuck chasing forever, and a duplicate system that guarantees you can always complete the
set. The design deliberately turns the manipulative parts of gacha into a "you'll always get
there" collection.

## 2. Locked design decisions (from brainstorming)

1. Dumplings are **collectible + functional** — each is a buddy with a small buff.
2. Acquisition is a **blind-box gacha pull** — random rarity, gold-only.
3. **One active buddy at a time** — only the equipped dumpling's buff applies.
4. **18 dumplings** across 4 rarities (data-driven; more can be added anytime).
5. **Pity guarantee** — a Legendary by ~15 pulls if none hit yet.
6. **Showcase view** — selected dumpling shown big on a rarity-themed backdrop; a **Spin button**
   (phase 2) rotates it.
7. **Math hook** — bundle pricing (compare cost-per-pull); optional active answer-for-discount beat is phase 2.
8. **Duplicates → "dumpling dough"** — small gold refund + dough; enough dough lets you hand-pick a
   missing dumpling (guaranteed completion).
9. **Everything gets balance-tested once running** — no numbers ship tuned by guesswork.
10. **Dumplings are 2D, permanently** (Leo, 2026-07-27) — even after the isometric conversion, the
    dumpling art stays 2D sprites and is out of scope for the 3D→iso pipeline. The UI follows the
    **gear/equip-screen pattern**: browsing and equipping a buddy should feel like selecting a
    piece of armor from a character-inventory screen.

## 3. Collection & rarity

18 dumplings, completable "shelf". Pull odds are per-rarity band, split evenly within a band.

| Rarity | Band odds | Count | Per-dumpling odds |
|---|---|---|---|
| ⚪ Common | 55% | 6 | ~9.17% |
| 🔵 Rare | 27% | 5 | ~5.4% |
| 🟣 Epic | 12% | 4 | 3% |
| 🟡 Legendary | 6% | 3 | 2% |

### Full dumpling list & buffs

Names are placeholders for art/flavour; buffs are the contract. All numbers are **starting
values pending balance-testing**.

**⚪ Common (6)**
1. **Plain Bun** — +1 gold per crop sold
2. **Rice Ball** — crops grow 5% faster
3. **Tofu Cube** — +2 max HP
4. **Egg Tart** — heal 3 HP after each battle win
5. **Mochi Drop** — 10% chance of +1 crop on harvest
6. **Pork Bun** — +1 gold per quest completed

**🔵 Rare (5)**
7. **Custard Bao** — crops grow 10% faster
8. **Spicy Gyoza** — +2 battle damage
9. **Sesame Ball** — 20% chance of +1 crop on harvest
10. **Red Bean Bun** — +5 max HP
11. **Onion Pancake** — seeds cost 1 less (min 1)

**🟣 Epic (4)**
12. **Rainbow Mochi** — crops grow 15% faster AND 10% chance of +1 crop
13. **Dragon Dumpling** — +3 damage AND heal 5 HP after wins
14. **Golden Gyoza** — +15% gold when selling crops
15. **Star Bao** — +25% battle XP

**🟡 Legendary (3)**
16. **Golden Dumpling** — +25% gold from all sources (crop sales, quests, battle rewards)
17. **Warrior Dumpling** — +4 damage, +10 max HP, heal 8 HP after wins
18. **Harvest Dumpling** — crops grow 25% faster + 25% chance of +1 crop

Battle buffs are intentionally small (base player damage is 5+). Even a Legendary should not, on
its own, trivialize combat. **Caveat:** stacked on the existing combat tap-exploit (see §9) these
could over-power; if the combat fix is greenlit separately, these numbers stay safe as-is.

## 4. Pull mechanic

- **Where:** a new **dumpling stall / vendor NPC in Town** (see §7).
- **Pricing (bundles — the math hook):**
  - 1 pull = **20g**
  - 3 pulls = **50g** (~16.7g each)
  - 10 pulls = **150g** (15g each)
  - The kid compares cost-per-pull — the same "which is the best deal?" lesson the crop shop
    already teaches. Passive; never a gate.
- **Farm linkage (owner-approved 2026-07-28):**
  - Keep seed costs and growth times unchanged so cooking and the familiar farming rhythm are not
    made more expensive.
  - Sale values are turnip 3g, carrot 5g, corn 7g, pumpkin 9g, and starfruit 17g.
  - After replacing seeds, a full 25-plot ordinary harvest nets 25g; starfruit nets 50g.
    This makes an ordinary full harvest fund one single pull and a premium full harvest fund the
    discounted three-pull bundle.
- **Roll:** pick a rarity band by weighted roll (reuse the existing weighted-chance pattern from
  `rollLoot`, index.html ~line 1899), then pick a dumpling uniformly within that band.
- **Pity:** track `pullsSinceLegendary`. If a pull would be the 15th since the last Legendary and
  no Legendary rolled, force a Legendary. Reset on any Legendary.
- **Multi-pull bundles resolve as N sequential single rolls** — each roll updates and can trigger
  pity independently (so a 10-pull can hit pity mid-bundle).
- **Phase 2 optional beat:** answer one quick math question (reuse `makeQuestion`/`makeOptions`) to
  shave a few gold off the next pull or nudge pity. Bonus only, never blocks.

## 5. Buddy system (equipping)

- Player equips **one** dumpling as the active buddy; only its buff applies.
- Swappable freely from the showcase ("Set as my buddy"). Encourages bringing a farm buddy while
  planting and a battle buddy in the Wilds — the intended recurring choice.
- Buff application hooks (existing functions from the audit):
  - **Gold on crop sale** → `sellCrops` (~1635)
  - **Grow speed** → see grow-time rule below
  - **Bonus crop on harvest** → harvest path in `doAction` (~1527) and `autoHarvestReady` (~2646),
    rolled per crop harvested
  - **Battle damage** → `playerDamage` (~1895)
  - **Max HP** → see max-HP rule below
  - **Post-win heal / bonus XP / bonus gold** → `winCombat` (~2209), `gainXp` (~2241)
  - **Seed discount** → `buySeeds` (~1582)
  - **Quest gold** → `answerQuest` (~1805)
  - **All-sources gold %** → the same set of gold-award sites
- Implement a single helper, e.g. `activeBuddyBuff()`, returning the equipped dumpling's buff
  object (or a no-op default), so each hook site reads one place.

### Buff resolution rules (resolve ambiguities before coding)

- **Max HP:** define one `computeMaxHp()` = base(20) + level bonus + `hpUpgrades`×5 + buddy maxHP
  bonus. Recompute on equip/unequip and on the existing HP sources; **clamp current `hp` to the new
  `maxHp`** whenever it changes (unequipping a +HP buddy must not leave `hp > maxHp`). Do **not**
  heal the player on equip — the bonus raises the ceiling only.
- **Grow speed:** capture the buddy's effective grow time **at plant time** and store it per-plot
  (add `growMs` to the `cropData` entry, alongside `status`/`plantedAt`/`type`). Swapping buddies
  afterward does **not** retroactively change crops already in the ground — simpler and predictable
  for a kid. Old saves without `growMs` fall back to the crop's base grow time.
- **Percentage buffs** (gold %, XP %) round to the nearest whole number, minimum +1 when the base
  reward is ≥1 (a % buff should never round down to zero benefit).

## 6. Duplicates & dumpling dough

- Pulling a dumpling you already own:
  - grants a small **instant gold refund (4g)**, and
  - grants **+1 dumpling dough**.
- **10 dough** → redeem to **hand-pick any dumpling you don't yet own** (guaranteed completion path).
- This makes every pull feel rewarding and guarantees a kid can reach 18/18 without infinite luck.
- **Fully-complete edge case:** once all 18 are owned, every pull is necessarily a duplicate. In
  that state, keep giving the gold refund but **convert dough directly to gold on redeem** (or hide
  the redeem button), since there's nothing left to hand-pick. The vendor stays usable without a
  dead-end.

## 7. Showcase view (the visual centerpiece)

- Tap any owned dumpling in the collection grid → it displays **big and centered on a
  rarity-themed background tile**:
  - ⚪ Common → plain wood/paper
  - 🔵 Rare → soft glow
  - 🟣 Epic → richer glow + subtle motion
  - 🟡 Legendary → sparkly, animated, clearly special
- Cute, chunky, squishy art style (7-Eleven vibe).
- **"Spin" button (PHASE 2):** animates the dumpling — **2D by decision** (locked decision #10).
  Rather than a fake 3D rotation (a flat CSS `rotateY` reads as a cheap card-flip), do a **squish
  bounce/wiggle-spin**: scale/rotate/squash-stretch keyframes on the 2D sprite, which suits a
  squishy toy better anyway. No turnaround art needed.
- **UI pattern (locked decision #10):** the collection + showcase is built like the game's
  **gear/equip screens** — a character-inventory feel where you browse dumplings like armor pieces
  and equip one, reusing the existing gear-sell/cooking modal layout (`renderGearSell`,
  `renderCooking`) as the structural template.
- **"Set as my buddy"** button lives here.
- Collection grid shows **owned vs. locked** (silhouette) tiles and an **N/18** completion counter —
  the visible-progress motivator.
- UI reuses existing patterns: `.modal`, shop/cooking/gear-sell layout, `.crop-dot` colour
  vocabulary, toast + `soundCoin`/`soundWin`.

## 8. Data model & save schema

Add to the `player` object (defensive-default pattern; the migration layer already tolerates
missing fields, so **no `SAVE_VERSION` bump and no migration risk**):

- `dumplings`: `{ <id>: count }` — owned dumplings and how many of each
- `activeBuddy`: `<id> | null` — currently equipped buddy
- `dumplingDough`: `number` — dough balance
- `pullsSinceLegendary`: `number` — pity counter

Touch three places (mirroring how `food` is handled):
- `defaultState()` (~2675): initialize the four fields empty/zero, `activeBuddy: null`.
- `saveGame()` (~2831): serialize the four fields in the `player` block.
- `applyState()` (~2735): default each field for old saves; validate `dumplings` ids and
  `activeBuddy` against the dumpling catalog (like `inventory` is validated against `GEAR`).

Define the catalog as a top-level data object (like `CROPS`/`GEAR`/`ENEMIES`), e.g. `DUMPLINGS`
with `{ id: { name, rarity, buff, ... } }`, plus a `DUMPLING_RARITIES` band/odds table.

## 9. Educational & kid-safety principles

- **Math hook:** bundle-price comparison (multiplication/division reasoning); phase-2 optional
  answer-for-discount. Consistent with the game's "learning hides in the fun, never a quiz-gate."
- **Kid-safe:** gold-only; generous pity; dough guarantees completion; no dark patterns, no timers
  pressuring pulls, no real money.

## 10. Scope, phasing & non-goals

**Pre-req (ships before or with the MVP):**
- **Close the boss-farm gold spigot.** Re-entering an area currently revives all enemies instantly
  (`checkTravel` ~line 3328 ignores `respawnAt`), so bosses can be farmed for a guaranteed 60g
  gear-dupe + 300–600 XP per lap. With infinite gold, a 20g gacha pull is meaningless — the
  collection only feels earned if gold stays somewhat scarce. Fix: honor `respawnAt` on re-entry
  (a few lines). The broader combat rebalance (tap-dominance) remains a separate initiative.

**MVP (phase 1):**
- `DUMPLINGS` catalog + rarity/odds tables (all 18 defined)
- Town dumpling vendor NPC + gacha modal (single + 3 + 10 bundles)
- Weighted roll + pity
- Collection grid (owned/locked + N/18)
- Showcase with **static** rarity backdrops + "Set as my buddy"
- All 18 buffs wired via `activeBuddyBuff()`
- Duplicates → gold + dough; dough → pick missing
- Save-schema additions
- **Placeholder art** so the system is playable/testable

**Phase 2 (polish):**
- Spin animation in the showcase
- Optional active math beat on pulls
- Final art

**Out of scope (separate initiatives):**
- Combat rebalance / tap-exploit fix (own initiative, flagged by the playthrough)
- 2.5D isometric conversion (own, larger initiative — parked)
- Any real-money mechanic (explicitly never)

## 11. Art production track (parallel to engineering)

- 18 dumpling sprites (across the 4 rarities) — **2D only** (locked decision #10); produced via
  the existing 2D pipeline (`tools/SPRITE_PIPELINE.md`), NOT the 3D→iso pipeline
- 4 rarity background tiles for the showcase
- 1 vendor/stall sprite (or reuse an NPC placeholder shape initially)
- Engineering proceeds against placeholders so art never blocks code. Per the playthrough, art is
  the bulk of the real effort here.
- Style note: cute/squishy for the dumplings themselves, but sitting inside the game's overall
  **sleek, slightly-badass** art direction — collectible toys in a cool world, not a cutesy game.

## 12. Balance testing (required before "done")

All numbers in §3–§6 are **starting values**. Once the feature runs, balance-test with the kids:
pull economics (is 20g/pull reachable but meaningful?), buff strengths (does a Legendary feel
special without breaking farming/combat?), dough threshold (does completion feel achievable?).
Nothing ships as "tuned" until observed in play.

## 13. Open items for Leo

1. **Repo location — DECIDED (2026-07-27):** implementation lands in `eldoria-public` (kept public
   so everyone can playtest).
2. **Privacy (recommended pre-req):** the playthrough found two real children's names
   hex-obfuscated in the legacy-save migration (~line 2873). Since the repo is staying public and
   opening up for wider playtesting, scrub these before/with this work. Awaiting Leo's go-ahead.
