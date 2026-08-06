# Execution Plan — 2026-08-05 (post-PR #48)

**Author:** Claude (director seat). **Reviewers:** ChatGPT (non-author). **Executes with:** Codex (implementation), Claude (direction + exact-head acceptance), ChatGPT (visual lead + non-author review), Leo (merges, kid gates, owner decisions).
**Baseline:** `main = 25ed940`, CI green. This plan is the working queue for the next several days; the standing authority chain in `AGENTS.md`/the AI Team Charter is unchanged.

Every factual claim below was verified against the working tree on 2026-08-05 (file:line refs included so any seat can re-verify cold).

## Standing rules the incoming seats must not re-derive

1. **Custody standard (PR #48):** committed character art from supplied packs is crop/translate-ONLY — no resampling, recolouring, thresholding, or pixel alteration. `tools/npc-static-contract-test.py` enforces it. Sprite review order is always **heading fidelity first** (south family shows the face, north family the back), then drift, then style.
2. **Terrain standard (PR #47):** vendor transition sheets are corner-coded; vendor index 0–15 IS the grass-corner mask; vertex material resolves from the four meeting cells with priority water > soil > path > grass. One primary tileset per zone; soil-derived grass owns open Farm ground. No cell flipping, ever.
3. **CI on the pushed head is the authority for known platform variance** — exact-head Linux CI is authoritative for known browser-canvas variance and Windows browser-harness timeouts; focused local suites are still required and must pass; unrelated local failures must not be normalized or ignored.
4. **Acceptance reviews are exact-head with independent reproduction** (re-run slicers/processors/tests yourself; pixel-diff, don't height-compare).
5. **PixelLab generation is PAUSED.** Leo authorized one bounded 64px text-only `create8` probe; Codex produced three distinct characters, including two text-only camera variants and one reference-v3 result, without prior authorization for the additional generations. The overrun was recorded, Leo selected reference-v3, and the pause is back in force. Any new spend needs Leo's explicit re-open per item.
6. Kid names stay out of this public repo. Verdicts live in PR comments (shared account — GitHub approvals are unusable).

## Lane 0 — in flight right now

| Item | State | Next action |
| --- | --- | --- |
| **PR #49 docs reconciliation** (+ this plan) | Draft, CI green | ChatGPT non-author review → Leo merges. |
| **PR #50 Momo integration** (`MOMO_INTEGRATION_BRIEF_20260805.md`) | Draft, current head `5d4761307f43b78ac2fa83f64fb54f8324faebfa`; 24 Mira/Bram/Gunnar rotations are merged and Momo's additional 8 are pending | Evidence is in `docs/playtest/2026-08-05-momo-sprite-integration/`. Chain: Fable exact-head acceptance → ChatGPT's first in-game integration visual gate (the selected eight-direction source art was already reviewed and accepted) → Leo merges. |

## Lane A — gameplay (sequenced; one Codex slot at a time)

> **SUPERSEDED (2026-08-06, sub-project 0 of the combat/armor plan).** This queue is
> historical: A1 landed as PR #51 and A2 as PR #52. The active queue is
> [`docs/superpowers/specs/2026-08-05-combat-armor-design.md`](../superpowers/specs/2026-08-05-combat-armor-design.md) §7,
> as recorded in `docs/CURRENT_STATE.md`. **The standing rules above (1–6) remain in
> force** — only this queue is superseded.

### A1. ELD-PT-011 + 011a — audio channels, say-it-again, TTS allow-list, bulk buy (candidate pending Leo's decision; owner-scoped 2026-07-29)
Verified current state: no volume controls exist anywhere — one global mute (`eldoria_muted`, `js/02-data-state.js:430`), music hard-coded at 0.35 (`js/02:427`), procedural SFX with fixed gains (`js/07-hud-movement.js:60-90`), speech with no volume set (`js/07:110-133`). Shop buys exactly one seed per tap (`js/04-interaction.js:255-265`).
Build to Leo's recorded scope: per-profile music/speech/effects levels; every spoken instruction also visible; "say it again" speaker button on the current instruction; **routine actions never spoken** (acceptance: zero speech from purchases/pickups at any tap rate, tested by mashing); bulk buy 1/5/10/15/20 where buying more than affordable buys what gold covers **and says so honestly** (shown count = bought count).
Note: the TTS allow-list also covers the dumpling stall's spoken welcome (`js/04:496`) — remove that speech here even though the wording fix itself is A2's.

### A2. Dumpling decision-compliance + economy (owner decision #1 is currently VIOLATED in live code)
Verified violations of Leo's locked 2026-07-29 ruling:
- Discounted bundles are live: `DUMPLING_BUNDLES = { 1: 20, 3: 50, 10: 150 }` (`js/02:339`) — ordered removed.
- The exact forbidden nudge ships verbatim: `speak('…Save gold for a better bundle deal!')` (`js/04:496`).
- No odds display exists (ruling: show odds child-readably).
- Dough is earned (`js/04:420`) and displayed (`js/04:435`) but has **no spend path** — the ruled deterministic dough→completion pillar is unimplemented.
Scope: fix all four + Leo's dumpling-modal scrolling polish item. Spec: `docs/superpowers/specs/2026-07-27-dumpling-collection-design.md` (its Phase-2 spin/answer-beat stays out).
**OWNER DECISION REQUIRED (blocks A2 pricing math): boss respawn policy.** Bosses currently respawn a flat 30 s after defeat (`js/05-combat-cooking.js:475-476`, no once-only flag), so boss gold is re-farmable against the gacha economy. Options: (a) trophy bosses die once per profile; (b) long respawn (e.g. daily); (c) heavily reduced repeat rewards. The old checkTravel leg of this exploit is already fixed (travel honors `respawnAt`); this is the remaining leg.

### A3. Combat learning slice (owner decisions #2/#5/#6 — partially delivered)
Delivered: per-question damage budgets/caps (PR #40). NOT delivered (verified): **decision #5 "drop the timer, keep the tapping"** — a countdown still gates the slash window (`SLASH_TIME_ADV=3000` / `SLASH_TIME_MAGE=5000`, `js/05:291-295`, timer bar `js/05:359-366`). Change to: no countdown; child taps then presses Done; budget stays the bound. Decision #6's mitigation (visible per-hit damage numbers so diminishing returns are legible) rides along.
The larger ELD-PT-001/010 redesign (embedded learning, scaffolded retry ladder) **needs an owner design session with ChatGPT first** — do not start it from this plan alone.

### A-later. ELD-PT-008 (boss presentation), ELD-PT-014a (store "why the best seed wins" explanation — design alongside 010's feedback ladder).

## Lane B — art & engine (interleaves with Lane A; visual gates throughout)

1. **B1. Town terrain** under the corner-mask protocol. First step is FREE: browse the PixelLab web library for a grass→cobble (or equivalent) transition set the way the three Farm sheets were found — browser work for ChatGPT/Leo, zero generations. If no library set fits, a generation request goes to Leo for explicit re-open. One-primary-set-per-zone.
2. **B2. Actor contact shadows** — restrained 2:1 ellipses, per-actor dims, players/NPCs/enemies only. Sequenced AFTER Momo lands so shadows tune against the complete Town cast.
3. **B3. Camera-feel reassessment** from fresh iPad evidence (Jules's lerp stays queued, not committed: needs frame-rate independence, snap-on-transition, clamping).
4. **B4. Buildings + env props** — real PixelLab generation (farmhouse/shop kits, `style_images` locked to approved tiles). **Spend-gated on Leo.**
5. **B5. Iso Phase 2 completion** — port Wilds → Deep Woods → Mine (spec `docs/superpowers/specs/2026-07-27-isometric-conversion-design.md:207`). Note the Mine already upgrades with zero code when real art lands: `assets/rock.png`/`assets/cave-floor.png` are registered-but-absent by design (`js/02:53-56`). Phase 4 default-flip stays gated on combat/quest parity.
6. **B6. Grass harmonization** — separate visual-only PR, deterministic slicer recolor with before/after palette evidence (measured deltas recorded in `TERRAIN_FIX_BRIEF_20260805.md`).
7. **B7. NPC eight-direction runtime** — Mira/Bram/Gunnar's 24 source rotations are merged; Momo's additional 8 are pending PR #50. A bounded facing/state system for NPCs/monsters is the audit Leo wants eventually.
8. **B-LAST. UI theming** — deliberately last, so the UI is themed against the real world art, not a temporary baseline (owner ordering).

## Later visual debt

- **PR #47 path-interior seams:** the faint green seams were reviewed and
  accepted as recorded interim visual debt. The future fix is bounded to
  `path-00` only; preserve masks `1–15` and the corner resolver, and provide
  native path proof plus iPad before/after evidence. This is not part of the
  Momo review or the in-flight Lane 0.

## Lane C — hygiene (small, no gates beyond normal review)

- **C1.** Untracked leftovers in the main clone need a keep-or-drop decision: `tools/full-playtest.mjs` + `docs/playtest/2026-07-31-claude-playtest*` (code/evidence from a prior session — if kept, own small reviewed PR).
- **C2.** Raster-decoder hardening in tooling (Leo's 2026-08-04 item 5).
- **C3.** Dead reference: `loadSprite('player', 'assets/player.png')` (`js/02:177`) points at a file that doesn't exist (graceful fallback, but it's a permanent 404 at boot) — drop or ship the file. Also `tools/pipeline/PIPELINE.md:274` documents an un-built client `init_images` TODO.
- **C4.** ~20 merged remote branches to prune (`git push origin --delete …` batch; everything except `main` and live PR branches).
- **C5.** `PIXELLAB_API.md` fold-in of the Maps/Map-Editor findings (web-only layout tool; documented in owner notes, not yet in the canonical doc).

## Suggested order of execution

1. **Today:** #49 review+merge → PR #50 through its exact-head and visual gates → branch prune (C4).
2. **After PR #49 and PR #50, Leo chooses the next lane:** A1 (011/011a) or B1 (Town terrain). Recommendation: A1 first because it is fully scoped, kid-facing, and unblocks A3's input work; this remains a recommendation, not authorization.
3. **If Leo chooses A1:** A1 → A2 (after the boss-respawn decision) → B1 → B2 → A3 → B3, with kid iPad playtest after A2 lands.
4. **If Leo chooses B1:** B1 → B2 → A1 → A2 (after the boss-respawn decision) → A3 → B3.
5. **Owner decisions pending, in order of urgency:** post-#49/#50 lane choice (A1 vs B1); boss respawn policy (blocks A2); full-playtest.mjs keep/drop (C1); buildings generation re-open (B4, later).
