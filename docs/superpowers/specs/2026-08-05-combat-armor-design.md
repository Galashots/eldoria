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
| 11 | **OWNER** (2026-08-06, upgraded from *derived*) | **A composability slice gates the bulk art spend**: one full four-slot loadout plus one alternate item swapped while the other three stay stable, on both Ranger and Mage, in the combat-facing subset — paper doll and in-world idle/attack, iPad-inspected. | Leo's call, selected over the original one-item slice and over a two-stage gate. One item proves generation; the hard requirement is that independently equipped items stay visually independent when composited, and that is what the slice must test. |
| 12 | **OWNER** (2026-08-06) | **Armour is hearts-only.** `armour`/`head`/`cape` items lose their `damage` values; each slot carries exactly one stat (weapon = attack, everything else = hearts). | Leo's call, selected over keeping both stats and over deferring to the balance pass. "Weapons hit, armour protects" is the teachable shape, and one stat per slot keeps auto-equip and "is this better?" single-number simple. Removing up to ~10 damage from current loadouts is a live balance change: sub-project 2 must include a compensating balance pass with tests, and sell values are pinned via an explicit `sellValue` field so the economy does not move as a side effect. |
| 13 | **OWNER** (2026-08-06) | **Equipping armour grants the new HP immediately** (18/20 + 2 hearts → 28/30). Unequipping clamps to the new max, floored at 1; a defeated hero (`hp <= 0`) is never resurrected by recomputation; equipment changes remain unavailable during combat. | Leo's call, matching the Heart Crystal precedent ("the new health is yours right away — feels good"). Not exploitable mid-fight because equipment is locked during combat. |

## 3. Retiring top-down

Deleted: the dual-render branches, `OVERLAY_DIRECTIONS`, `cardinalFromVector()`,
`FACING_TO_CARDINAL`, and the `?iso=0` / `?iso=1` override machinery. The cardinal-only attack
strips (`*-attack.png`, `*-weapon-attack.png`) retire with the renderer — they are superseded by
the gear-aware combat animations in sub-project 5. (Exception per §3 below: the four cardinal
*equipment overlay* sets survive the deletion, scoped to the Character paper doll.)

Unlocked, and this is what makes per-item art affordable at all:

- **The 4-vs-8 facing asymmetry stops existing.** It was never a rendering problem; it was
  top-down's cardinal-only overlays constraining iso. With top-down gone, gear is authored once,
  for iso facings only.
- **`paperDollDirection` stops being a compromise — but not yet.** `js/02-data-state.js`
  records that the Character screen uses `'right'` *only* because overlays are cardinal-only.
  The iso renderer draws no gear at all, so the Character paper doll is the **only** place
  equipment is visible outside top-down — and it composes the cardinal per-slot overlays via
  `paperDollDirection`, with `onerror` silently hiding any missing layer. Moving to
  `down-right` in the deletion PR would therefore strip gear visibility from the whole game
  without a single error. So: **`paperDollDirection` stays `'right'`, and the four cardinal
  per-slot overlay sets are retained for the Character screen only**, until per-item art
  exists. The move to `down-right` — true compass south, the face-visible view already chosen
  for title portraits — happens in sub-project 4/5 with the art that makes it possible.
- **Wilds, Deep Woods, and Mine default to iso.** The isometric conversion spec gated that flip
  on combat/quest parity; world combat *is* that parity work. **The parity waiver is deliberate
  and bounded:** the flip happens here, before sub-project 3 delivers world combat, because
  today's DOM combat modal is renderer-independent and keeps working unchanged in iso areas.
  The waiver is not evidence that parity is already delivered; the revert window below is the
  mitigation.
- **No facing migration exists, because no facing is saved.** `saveGame()` never serializes
  `player.facing` (verified against `js/06-saves.js`). The deletion PR asserts that no save
  path stores a facing and adds no new save field, rather than migrating one that isn't there.

Constraints on the deletion PR:

- **Pure deletion, no other changes.** It must be cleanly `git revert`-able, because it removes
  the fallback renderer before iso combat is proven. That revert is the mitigation.
- The no-facing-saved assertion above is the save contract; the deletion adds no save field
  and migrates nothing.

## 4. Armor as effective HP

**Mechanic.** One term in one place:

```
computeMaxHp() = 20 (base) + (level − 1)×5 + hpUpgrades×HEART_HP + armorHp
```

where `armorHp` sums the `hp` field of equipped items. (A buddy/companion HP term is a
possible **future extension, explicitly excluded** from the initial formula and its tests —
no buddy system exists in the code today.)

**Correction (2026-08-06 review): max HP is *not* derived today.** `player.maxHp` is stored,
mutated state — `+= 5` on level-up, `+= HEART_HP` on Heart Crystal — serialized by
`saveGame()` and validated on ingest. Sub-project 2 **introduces** derivation. For every
well-formed save the derivation above reproduces the stored value exactly, so there is still
**no schema migration and no save-version bump**, but the custody rule must be explicit:
**on ingest (v0–v4) the derived value wins over a disagreeing stored `maxHp`**;
canonicalization ignores the stored value, clamps current `hp` to the derived max, and the
next save writes the canonical number. A defeated hero (`hp <= 0`) is never resurrected by
recomputation. One source of truth, no resurrection, no version bump.

**Data.** Per OWNER decision 12, `armour`/`head`/`cape` items **replace** `damage` with `hp`;
weapons keep `damage` and gain nothing. **Armor `hp` values are multiples of `HEART_HP` (5)**
so every piece reads as a whole number of hearts. Because each slot now carries exactly one
stat, auto-equip and the Character-screen comparisons stay single-number per slot — no
mixed-stat ranking rule is needed. Each item gains an explicit **`sellValue`** pinned to its
current sell price, so removing `damage` moves no economy number. The compensating balance
pass (fights get longer when loadouts lose up to ~10 damage) is part of sub-project 2, with
tests, not a follow-up.

**Equip/unequip HP custody (OWNER decision 13).** Equipping grants the new HP immediately
(18/20 + 2 hearts → 28/30), matching the Heart Crystal precedent. Unequipping clamps
`hp = min(hp, computeMaxHp())`, floored at 1 for a living hero. Equipment changes remain
unavailable during combat — this is what makes immediate grant unexploitable.

## 5. Hearts

- **Hearts are the PLAYER's display only.** Enemy HP keeps a compact exact display — enemy
  values are not multiples of 5 (Slime 15, Bat 22, Wolf 32…) and the Crystal Wyrm at 130 HP
  must not become a 26-heart row.
- **1 heart = 5 HP.** Base 20 HP is exactly 4 hearts, and each Heart Crystal (+5) is exactly +1
  heart. Armour adds whole hearts.
- Rendered in **half-heart increments, floored** (never rounded up — rounding up visually
  overstates health), with two guards: a living player (`hp > 0`) always shows at least half a
  heart, and a hurt player (`hp < maxHp`) never shows a full row. Rounding must never lie about
  being alive or being hurt.
- The exact `HP / Max HP` text stays alongside the hearts, with an accessible label.
- The sub-project 2 plan defines a **concrete phone-portrait contract** — maximum hearts per
  row, wrapping behavior, and rendered stress cases at 20, 40, 80, and the maximum attainable
  max HP — not "wrap sensibly".
- Replaces the current fixed-width normalized bar **for the player**, which renders a doubled
  max HP identically to none — armour would otherwise be mechanically real but visually
  invisible.

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
     (PixelLab's state route returns a complete edited character, not an engine-ready layer;
     difference extraction passes only when non-equipment pixels are identical or confined to
     an approved mask — "looks close" will ghost when composited.)
   - what does each route cost per item, measured, not estimated?

**The verdict may be per slot, not globally binary.** Body armour, helmets, capes, swords, and
staffs carry different occlusion and alignment risk; a mixed model (e.g. body baked, weapon/
cape/head overlaid) is a legitimate outcome. Whatever the model, it must pass hard criteria:

- four-slot composability with correct cape → base → body → head → weapon layer order;
- base-pixel and identity invariance outside an approved equipment mask;
- exact scale, canvas, pivot, and hand alignment;
- cross-facing recognizability of the same item;
- temporal stability through idle/walk/attack frames;
- measured failure rate, human repair minutes, and deterministic repairability;
- runtime request count, decoded memory, boot time, and offline caching on the iPad.

**Custody:** PR #48's `npc-static-contract-test.py` proves crop/translate-only custody for a
single static NPC frame; it is **not** sufficient for generated equipment. The research output
includes a dedicated deterministic **gear custody contract and validator** — alpha, alignment,
allowed masks, layer order, state coverage, and unchanged hero-identity pixels.

**A method-elimination probe may precede the composability slice.** Before the full two-hero
slice batch, sub-project A may propose a bounded probe — one hero, one body armour, one weapon,
static only, smallest useful facing subset — comparing direct overlay generation against
equipped-state generation plus deterministic difference extraction. This spends less before
learning and keeps the slice from becoming an expensive method-discovery batch. It changes no
gate: the probe is a generation batch like any other and **requires Leo's separate explicit
approval**, and the full composability slice still gates bulk spend (OWNER decision 11).

**Batch authorization contract.** Sub-project A defines the owner-facing request format every
generation batch must use — purpose/hypothesis, tool and live-schema verification date,
approved references, coverage, call count and quoted cost, a maximum authorized spend,
raw-output location, acceptance criteria, and immediate stop conditions. Unexpected extra
jobs, billing beyond the cap, schema mismatch, or off-mask identity changes **stop the batch**
rather than trigger retries — this repo has already paid for both failure modes (the
template-walk cost overrun and the Momo probe overrun). The supplemental research protocol on
PR #53 (probe design, controlled variables, per-slot evidence record, deferred animation and
prompt-enhancement experiments) is carried into sub-project A's implementation plan; claimed
PixelLab capabilities in that research are hypotheses until verified against the live API.

**Fallback if neither route is clean:** armour sets baked per tier rather than per item. This
is recorded so the research has a defined exit rather than an open loop — but it reduces OWNER
decision 4, so **it cannot self-authorize**: if research fails, return the measured evidence to
Leo for his explicit approval of that exception.

Leo's preference is to try the **web Creator UI** after research. This is precedented: the hero
walk strips came from his manual web-Creator regeneration. Generation of any kind remains gated on
explicit owner authorization per `docs/CURRENT_STATE.md`; this spec does not self-authorize spend.

**Custody, scoped by asset kind.** Approved source images are normalized only through
deterministic crop/translate operations where that operation applies — the PR #48 principle
(no unreviewed pixel alteration) stands, and `tools/npc-static-contract-test.py` continues to
enforce it for the static NPC frames it was built for. Generated equipment, masks, extracted
layers, composites, and animation strips follow the **dedicated gear custody contract and
validator defined by sub-project A** (above), not the static-NPC test.

## 7. Decomposition and sequencing

Each row is its own implementation plan and its own PR.

| Order | Sub-project | Art | Depends on |
| --- | --- | --- | --- |
| 0 | **Guidance-doc realignment** — authorize this scope, rank the plans, retire stale ones (§8) | none | — |
| 1 | **Retire top-down** — pure deletion; areas default to iso; no-facing-saved assertion; paper-doll overlays retained (§3) | none | 0 |
| 2 | **Armor hearts-only** — `computeMaxHp` derivation, `GEAR.hp` + `sellValue`, heart display, balance pass, Character-screen comparisons | none | 0 (parallel with 1) |
| A | **PixelLab research** — runs from day one, no code; outputs docs, gear custody contract + render-model verdict | optional bounded probe, owner-approved | — |
| 3 | **World combat staging** — same loop behind a controller/presentation seam, sprites on the map, HUD-overlaid questions | none new | 1 |
| 4 | **Gear-art composability slice** — four-slot loadout + one swap, both heroes, combat-facing subset, iPad evidence → owner authorizes bulk | small | A, 3 |
| 5 | **Bulk gear art + combat animations** — attack/hurt/death, gear-aware | large | 4 |

PRs 1, 2, and A **may proceed in parallel under explicit file ownership and merge order** — they
are not conflict-free by nature: deletion and armour both touch data/state, Character-screen
assumptions, HUD, tests, and guidance docs. Their implementation plans declare file ownership
before work starts. **The slice at step 4 gates the bulk spend** (OWNER decision 11): the bulk
batch is not generated until the composability loadout has been proven end-to-end and inspected
on the iPad. The slice's own generation batch is spend too — **it, like every batch, needs Leo's
explicit approval before generation**; inspection gates acceptance, not spend.

**Before any batch:** build an item × hero × facing × state coverage matrix and put the real
number in front of Leo — `16 × 2 × 8 = 256` counts *static overlays only* and excludes walk,
attack, hurt, death, repair attempts, icons, and paper-doll variants; a fully baked four-slot
loadout is combinatorial, not additive. The matrix defines the authorized generation ceiling,
and the plan chooses lazy loading or atlas packaging so iPad boot time and decoded memory do
not scale with every future asset.

**Sub-project 3 seam requirements.** Before the modal is replaced, phase transitions and damage
budgets are isolated from presentation (controller/presentation seam), and the world-HUD
implementation explicitly preserves: answer focus and keyboard/touch access; early-reader
question speech and Say-it-again; a visible ≥44px Flee action with an Escape-safe flee path;
frozen world movement and unrelated interactions during a fight; orientation-change and
backgrounding recovery; and rapid slash input affecting the budget immediately even while
visuals are still animating. This is what keeps OWNER decision 2 enforceable while the DOM
modal retires.

**Rollback custody for the deletion (sub-project 1).** Pure deletion is necessary but stops
being trivially revertable once dependent PRs land on top. The deletion PR records: the exact
pre-deletion SHA (tagged); a five-area iso smoke matrix run before merge; the reverse-order
rollback sequence; and a rollback window that stays open through world-combat iPad acceptance.
Front-loading the deletion is Leo's call — this section keeps it honest, not reversible-forever.

## 8. Guidance-doc realignment (sub-project 0)

**This lands before the deletion PR, not after.** `CURRENT_STATE.md` currently lists retiring
top-down as out of scope, so a reviewer reading it would *correctly* reject PR 1. The
authorization has to exist in the repo before the work it authorizes.

### Plan precedence — by domain first, then by rank

Each document governs its own domain: authority and workflow belong to `AGENTS.md` + the
Charter; visual direction to the North Star; accepted status to `CURRENT_STATE.md`;
combat/armor product and sequencing to this design; asset-production method to the
pipeline/API documents. **A document does not outrank another outside its own domain** — the
table below resolves conflicts *within and across* domains when two documents genuinely
claim the same question. Anything lower that contradicts something higher is stale and must be
banner-marked, using the existing pattern from `STEP8_ENVART_CONTRACT_20260804.md`.

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

(The README North Star v1 embed and the stale baseline that this section originally also
listed were corrected by PR #52; they are no longer outstanding. **Baselines:** `94cc35f` is
this spec's *authoring* baseline; the realignment PR *lands* on post-#52 `cc5df6d`.)

### Stale-document registry — who reconciles what

Sub-project 0 does not rewrite every stale document; it assigns each one an owner so no future
agent correctly follows dead guidance:

| Document | Stale claim | Reconciled by |
| --- | --- | --- |
| `docs/CHARACTER_INVENTORY.md` | generic per-slot overlays, damage-only comparisons, damage-based selling, "item art deferred" | sub-project 2 (stats/comparisons/selling), sub-project 5 (art) |
| `assets/README.md` | four-facing generic overlay contract | sub-project 1 (retention note), sub-project 5 (per-item contract) |
| `.claude/skills/asset-generation/SKILL.md` | current generation/run-book assumptions | sub-project A |
| `docs/superpowers/specs/2026-07-27-isometric-conversion-design.md` | top-down coexistence, parity gates, DOM-combat assumptions | banner-marked in sub-project 1 |
| `docs/ai-team/EXECUTION_PLAN_20260805.md` | Lane A queue | banner-marked in sub-project 0 (queue only; rules 1–6 stand) |

## 9. Testing and evidence

- The turn loop is unchanged, so the **mechanics assertions must pass untouched** through
  sub-project 3: damage budgets, the answer-to-slash loop, duplicate-input handling, and the
  ≥3-answered-questions boss floor. Any change to *those* is a signal that decision 2 was
  violated. Modal-shell, DOM-layout, focus, and presentation tests are **not** covered by this
  rule — the modal is intentionally retired, and those tests are *replaced* by equivalent
  world-HUD accessibility and lifecycle coverage (the §7 seam requirements), never silently
  dropped.
- Heart rendering needs assertions for the floor semantics and both rounding guards, not just a
  screenshot.
- The armour work needs regressions for: unequip-at-low-HP clamp (floor 1, living hero); no
  resurrection of `hp <= 0` by recomputation; derived-wins ingest custody on a disagreeing
  stored `maxHp`; immediate HP grant on equip; and the pinned `sellValue` economy check.
- Sub-project 1 asserts through the central ingestion path (`ingestSaveText`, `js/06-saves.js`)
  that no save stores a facing and that the deletion adds no save field.
- World combat needs real iPad evidence before the bulk art spend, per `LARGE_PR_EXECUTION.md`.
- Every visually relevant PR states a **North Star alignment** verdict.
