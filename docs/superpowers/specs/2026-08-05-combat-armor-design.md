# Combat & Armor — umbrella design

**Date:** 2026-08-05
**Status:** owner-approved design; decomposed into sub-projects, each of which takes its own
implementation plan.
**Baseline:** `main` at `94cc35f` (post PR #51).
**Owner scope expansion (Leo, 2026-08-05):** combat and armor are explicitly widened into scope
*together*. This supersedes three "out of scope" entries in `docs/CURRENT_STATE.md`; see
§8.

## 1. Why this exists

Two owner goals, deliberately planned as one exercise because they are coupled: an armour visual
authored without knowing what the attack animation does is likely to need reauthoring, and a
combat animation authored without knowing how armour renders is likely to be wrong.

Three facts about the current code shaped every decision below, and are easy to get wrong from
memory:

1. **Combat has no sprites.** `openCombat()` (`js/05-combat-cooking.js`) opens the `combatModal`
   DOM panel: question text, answer buttons, a slash zone, a timer bar. The canvas, the hero
   sprite, and the enemy sprite play no part in a fight.
2. **There is no defense stat.** Every entry in `GEAR` (`js/03-maps-areas.js:239`) contributes
   only `damage` — including `iron_armor`, `mithril_armor`, and `wyrm_scale`. "Armor" is a damage
   stat with a different slot label.
3. **Equipment overlays are per-slot, not per-item.** The committed art is
   `adventurer-<facing>-{head,body,weapon,cape}.png` — one generic overlay per slot. All six
   weapons render identically; all four body armours render identically. They exist for the four
   cardinal facings only (`OVERLAY_DIRECTIONS`), while iso renders eight
   (`PLAYER_DIRECTIONS`).

## 2. Locked decisions

**Decision provenance is explicit.** Rows marked **OWNER** are Leo's decisions, selected by him
during the 2026-08-05 brainstorming session. They are settled inputs, not open questions, and are
**not** up for reconsideration in review. Rows marked *derived* are design consequences proposed by
the director seat; those are legitimately open to challenge.

| # | Decided by | Decision | Rationale |
| --- | --- | --- | --- |
| 1 | **OWNER** | **Combat moves into the world.** Fights play out on the iso map where the enemy stands; questions overlay as HUD. | Leo's call, selected over keeping the modal, a hybrid, or deferring. The modal is retired for iso. |
| 2 | **OWNER** | **The turn loop is unchanged.** answer → per-question damage budget → tap-to-slash window, verbatim. | Leo's call, selected over real-time and over positional turns. Preserves ELD-PLAY-001 and the ≥3-answered-questions boss floor; makes world combat a *presentation* change with no balance risk. |
| 3 | **OWNER** | **Armor grants effective HP**, not damage reduction. | Leo's call, selected over damage reduction, over math-visible defense, and over leaving armour as +damage. Simplest to tune and explain; no new damage formula. |
| 4 | **OWNER** | **Gear art is per-item** — all 16 `GEAR` items visually distinct. | Leo's call, selected over per-tier, per-tier-plus-trophies, and generic. Gear is a visible reward, not just a number. |
| 5 | **OWNER** | **Facing coverage starts as a combat-facing subset**, expanding on evidence. | Leo's call, selected over full 8-facing coverage and over staying at 4. Avoids committing ~256 overlays before a single item is proven. |
| 6 | **OWNER** | **Top-down rendering is retired**, in its own pure-deletion PR, placed first. | Leo's call, twice: to retire it at all, and then to front-load the deletion rather than gate it on iPad evidence at the end of sub-project 3. One-way door; see §3. |
| 7 | **OWNER** | **HP displays as discrete hearts.** | Leo's call, selected over an expanding bar, a hybrid, and a ticked bar. Countable units are child-legible and quietly arithmetic-friendly; makes armour visible. |
| 8 | **OWNER** | **Render model (overlay vs baked) is deferred** to the PixelLab research gate. | Leo's call — decide on evidence, not guesswork; see §6. |
| 9 | *derived* | 1 heart = 5 HP. | Base 20 HP is exactly 4 hearts and each Heart Crystal (+5) is exactly +1 heart. Falls out of decision 7 and the existing numbers. |
| 10 | *derived* | The guidance-doc realignment lands **before** the deletion PR. | `CURRENT_STATE.md` currently forbids retiring top-down; a reviewer reading it would correctly reject PR 1. See §8. |
| 11 | *derived* | A vertical slice of one gear item gates the bulk art spend. | Proves the chain against real pixels before the largest asset commitment in the project. |

## 3. Retiring top-down

Deleted: the dual-render branches, `OVERLAY_DIRECTIONS`, `cardinalFromVector()`,
`FACING_TO_CARDINAL`, and the `?iso=0` / `?iso=1` override machinery. The cardinal-only attack
strips (`*-attack.png`, `*-weapon-attack.png`) retire with the renderer — they are superseded by
the gear-aware combat animations in sub-project E.

Unlocked, and this is what makes per-item art affordable at all:

- **The 4-vs-8 facing asymmetry stops existing.** It was never a rendering problem; it was
  top-down's cardinal-only overlays constraining iso. With top-down gone, gear is authored once,
  for iso facings only.
- **`paperDollDirection` stops being a compromise.** `js/02-data-state.js:140` records that the
  Character screen uses `'right'` *only* because overlays are cardinal-only. It moves to
  `down-right` — true compass south, the face-visible view already chosen for title portraits.
- **Wilds, Deep Woods, and Mine default to iso.** The isometric conversion spec gated that flip
  on combat/quest parity; world combat *is* that parity work.

Constraints on the deletion PR:

- **Pure deletion, no other changes.** It must be cleanly `git revert`-able, because it removes
  the fallback renderer before iso combat is proven. That revert is the mitigation.
- Any save storing a cardinal facing migrates to the eight-way set.

## 4. Armor as effective HP

**Mechanic.** One term in one place:

```
computeMaxHp() = 20 (base) + level bonus + hpUpgrades×5 + buddy maxHP + armorHp
```

where `armorHp` sums the `hp` field of equipped items.

**Data.** Add `hp` alongside `damage` in `GEAR`. **Armor `hp` values are multiples of 5** so every
piece reads as a whole number of hearts.

**Saves are unaffected.** Saves store bare gear-ID strings and max HP is derived, so there is **no
schema migration and no save-version bump**. This is the main reason this option is cheap.

**Clamp rule.** Unequipping armour lowers max HP. Clamp `hp = min(hp, computeMaxHp())`, floored at
1 — a child who unequips mid-fight must never die from the act of unequipping.

**Open question, resolved during the armour PR:** whether armour's existing `damage` values are
removed. Removing them makes "weapons hit, armour protects" crisp but is a live balance change to
every fight; retaining them means armour gives both and muddies the lesson. Not pre-decided here
because it wants a balance pass, not a design opinion.

## 5. Hearts

- **1 heart = 5 HP.** Base 20 HP is exactly 4 hearts, and each Heart Crystal (+5) is exactly +1
  heart. Armour adds whole hearts.
- Rendered in **half-heart increments** by rounding to nearest half, with two guards: never show
  zero hearts while `hp > 0`, and never show a full row while `hp < maxHp`. Rounding must never
  lie about being alive or being hurt.
- The row must wrap sensibly as it grows; phone portrait is the binding constraint.
- Replaces the current fixed-width normalized bar, which renders a doubled max HP identically to
  none — armour would otherwise be mechanically real but visually invisible.

## 6. PixelLab research gate

This gate has two outputs, and the second is a standing owner goal in its own right: **the team is
using this to learn asset generation** so that Leo, Claude, ChatGPT, and Codex can eventually
handle all asset generation in-house.

1. **Durable documentation** — updated `tools/pipeline/PIXELLAB_API.md` and method notes
   committed to the repo. Not a one-off verdict in a chat.
2. **The render-model decision** (locked decision 8), chosen against these criteria:
   - can PixelLab produce per-item layers that align pixel-exactly to an existing hero body?
   - if not, can it regenerate a *consistent* character across outfit changes reliably enough
     that a deterministic difference-extraction step yields clean transparent overlays?
   - what does each route cost per item, measured, not estimated?

**Fallback if neither route is clean:** armour sets baked per tier rather than per item, accepting
locked decision 4's reduction in exchange for a shippable pipeline. This fallback is recorded so
the research has a defined exit rather than an open loop.

Leo's preference is to try the **web Creator UI** after research. This is precedented: the hero
walk strips came from his manual web-Creator regeneration. Generation of any kind remains gated on
explicit owner authorization per `docs/CURRENT_STATE.md`; this spec does not self-authorize spend.

The custody standard from PR #48 applies to everything committed: crop/translate-only, no
resampling, recolouring, or pixel alteration, enforced by `tools/npc-static-contract-test.py`.

## 7. Decomposition and sequencing

Each row is its own implementation plan and its own PR.

| Order | Sub-project | Art | Depends on |
| --- | --- | --- | --- |
| 0 | **Guidance-doc realignment** — authorize this scope, rank the plans, retire stale ones (§8) | none | — |
| 1 | **Retire top-down** — pure deletion; areas default to iso; facing-save migration | none | 0 |
| 2 | **Armor as effective HP + hearts** — `computeMaxHp` term, `GEAR.hp`, heart display, Character-screen comparisons | none | none (parallel with 1) |
| A | **PixelLab research** — runs from day one, no code; outputs docs + render-model verdict | none | — |
| 3 | **World combat staging** — same loop, sprites on the map, HUD-overlaid questions | none new | 1 |
| 4 | **Gear-art vertical slice** — one item, full chain, iPad evidence → owner authorizes bulk | small | A, 3 |
| 5 | **Bulk gear art + combat animations** — attack/hurt/death, gear-aware | large | 4 |

PRs 1, 2, and A start immediately and cannot conflict. **The slice at step 4 gates the bulk spend:
no batch is generated until one item has been proven end-to-end and inspected on the iPad.**

## 8. Guidance-doc realignment (sub-project 0)

**This lands before the deletion PR, not after.** `CURRENT_STATE.md` currently lists retiring
top-down as out of scope, so a reviewer reading it would *correctly* reject PR 1. The
authorization has to exist in the repo before the work it authorizes.

### Plan precedence, newest as top priority

Agents must resolve conflicts in this order. Anything lower that contradicts something higher is
stale and must be banner-marked, using the existing pattern from
`STEP8_ENVART_CONTRACT_20260804.md`.

| Rank | Document | Standing |
| --- | --- | --- |
| 1 | `AGENTS.md`, `docs/ai-team/AI_TEAM_CHARTER.md` | Standing authority. Not superseded by this plan. |
| 2 | `docs/VISUAL_NORTH_STAR.md` + current image | Visual authority. Not superseded. |
| 3 | `docs/CURRENT_STATE.md` | Status of record. Updated by sub-project 0. |
| 4 | **This design** | **Top-priority active plan.** |
| 5 | `docs/ai-team/EXECUTION_PLAN_20260805.md` | Standing rules 1–6 remain in force. Its **Lane A queue is superseded** by §7 here. Banner-mark the queue only. |
| 6 | `docs/superpowers/specs/2026-07-27-isometric-conversion-design.md` | Partially superseded: its top-down parity gates are moot once top-down retires. Banner-mark those sections. |
| 7 | `docs/superpowers/specs/2026-07-27-dumpling-collection-design.md` | §4 pricing + decision #7 historical — already queued in PR #52. |
| 8 | `STEP7_*`, `STEP8_*`, `HOTFIX_*`, `MOMO_*`, `TERRAIN_FIX_*` briefs | Historical execution records. Already banner-marked or inherently dated. |

### `CURRENT_STATE.md` corrections required

`docs/CURRENT_STATE.md` currently lists all three of the following as out of scope. The owner
expanded scope on 2026-08-05 and the file must be updated in the first PR that touches it:

1. combat-budget / combat changes — now authorized;
2. retirement of top-down rendering — now authorized;
3. PixelLab generation — in scope for this exercise, after the research gate and with explicit
   per-batch authorization.

Also outstanding, unrelated to this design but queued for the same doc pass: the recorded baseline
is stale, and `README.md:32` still embeds North Star v1 while `AGENTS.md:29` declares v2
authoritative.

## 9. Testing and evidence

- The turn loop is unchanged, so **the existing combat tests must pass untouched** through
  sub-project 3. Any change to them is a signal that decision 2 was violated.
- Heart rendering needs assertions for the two rounding guards, not just a screenshot.
- The armour clamp needs a regression for unequip-at-low-HP.
- Sub-project 1 needs the facing-save migration covered by the same central ingestion path as
  every other save change (`ingestSaveText`, `js/06-saves.js`).
- World combat needs real iPad evidence before the bulk art spend, per `LARGE_PR_EXECUTION.md`.
- Every visually relevant PR states a **North Star alignment** verdict.
