# Execution Plan — 2026-08-05 (post-PR #48)

**Author:** Claude (director seat). **Reviewers:** ChatGPT (non-author). **Executes with:** Codex (implementation), Claude (direction + exact-head acceptance), ChatGPT (visual lead + non-author review), Leo (merges, kid gates, owner decisions).
**Baseline:** `main = 25ed940`, CI green. This plan is the working queue for the next several days; the standing authority chain in `AGENTS.md`/the AI Team Charter is unchanged.

Every factual claim below was verified against the working tree on 2026-08-05 (file:line refs included so any seat can re-verify cold).

## Standing rules the incoming seats must not re-derive

1. **Custody standard (PR #48):** committed character art from supplied packs is crop/translate-ONLY — no resampling, recolouring, thresholding, or pixel alteration. `tools/npc-static-contract-test.py` enforces it. Sprite review order is always **heading fidelity first** (south family shows the face, north family the back), then drift, then style.
2. **Terrain standard (PR #47):** vendor transition sheets are corner-coded; vendor index 0–15 IS the grass-corner mask; vertex material resolves from the four meeting cells with priority water > soil > path > grass. One primary tileset per zone; soil-derived grass owns open Farm ground. No cell flipping, ever.
3. **CI on the pushed head is the authority** — Windows-local `npm test` fails by design (canvas goldens built on CI).
4. **Acceptance reviews are exact-head with independent reproduction** (re-run slicers/processors/tests yourself; pixel-diff, don't height-compare).
5. **PixelLab generation is PAUSED.** The 3-generation Momo probe is spent and closed. Any new spend needs Leo's explicit re-open per item.
6. Kid names stay out of this public repo. Verdicts live in PR comments (shared account — GitHub approvals are unusable).

## Lane 0 — in flight right now

| Item | State | Next action |
| --- | --- | --- |
| **PR #49 docs reconciliation** (+ this plan) | Draft, CI green | ChatGPT non-author review → Leo merges. |
| **Momo integration** (`MOMO_INTEGRATION_BRIEF_20260805.md`) | Codex has the work staged locally (runtime frame, 8 source rotations, review README, captures) | Codex pushes PR → Claude exact-head acceptance (independent pixel reproduction against the probe zip) → ChatGPT visual gate (Momo's FIRST formal visual review; must rule on the muted-palette-vs-cast question) → Leo merges. Review nit to catch: three `town-momo-*.png` captures are currently placed in the old `2026-08-05-npc-sprite-integration/` evidence folder — they belong in the PR's own evidence dir. |
| **Outstanding ruling from PR #47:** faint green seam lines in path interiors at 1:1 (underlay peeking at overlay seams) | Flagged at merge, never ruled | ChatGPT rules from existing captures: pass-at-iPad-scale or queue a bounded fix. Ten-minute item; do it with the Momo gate. |

## Lane A — gameplay (sequenced; one Codex slot at a time)

### A1. ELD-PT-011 + 011a — audio channels, say-it-again, TTS allow-list, bulk buy (NEXT SLOT, owner-scoped 2026-07-29)
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
7. **B7. NPC eight-direction runtime** — all 24+8 source rotations are now committed; a bounded facing/state system for NPCs/monsters is the audit Leo wants eventually.
8. **B-LAST. UI theming** — deliberately last, so the UI is themed against the real world art, not a temporary baseline (owner ordering).

## Lane C — hygiene (small, no gates beyond normal review)

- **C1.** Untracked leftovers in the main clone need a keep-or-drop decision: `tools/full-playtest.mjs` + `docs/playtest/2026-07-31-claude-playtest*` (code/evidence from a prior session — if kept, own small reviewed PR).
- **C2.** Raster-decoder hardening in tooling (Leo's 2026-08-04 item 5).
- **C3.** Dead reference: `loadSprite('player', 'assets/player.png')` (`js/02:177`) points at a file that doesn't exist (graceful fallback, but it's a permanent 404 at boot) — drop or ship the file. Also `tools/pipeline/PIPELINE.md:274` documents an un-built client `init_images` TODO.
- **C4.** ~20 merged remote branches to prune (`git push origin --delete …` batch; everything except `main` and live PR branches).
- **C5.** `PIXELLAB_API.md` fold-in of the Maps/Map-Editor findings (web-only layout tool; documented in owner notes, not yet in the canonical doc).

## Suggested order of execution

1. **Today:** #49 review+merge → Momo PR through all three gates → seam-line ruling (same ChatGPT sitting) → branch prune (C4).
2. **Next Codex slot:** A1 (011/011a). It is fully scoped, kid-facing, and unblocks A3's input work later. While Codex builds A1, ChatGPT/Leo do the B1 library browse, and Leo answers the boss-respawn question so A2 is ready next.
3. **Then:** A2 (dumpling compliance) → B1 (Town terrain) → B2 (shadows) → A3 (timer removal) → B3 (camera) — kid iPad playtest after A2 lands (audio + dumpling changes are the most kid-visible cluster).
4. **Owner decisions pending, in order of urgency:** boss respawn policy (blocks A2); A1-next confirmation; full-playtest.mjs keep/drop (C1); buildings generation re-open (B4, later).

## Notes for the incoming Claude seat (Opus)

- Session memory lives at `C:\Users\Leo\.claude\projects\C--Users-Leo-Desktop\memory\` — read `MEMORY.md` and `project-realm-of-eldoria-original.md` (tail = newest) before acting.
- ChatGPT coordination runs through Leo's "Eldoria Independent Playtest" chat in the automation Chrome (superpowers-chrome profile, stay-logged-in). Known hazard: drafts Leo stages in that conversation live-sync into the automation composer and merge into typed messages — verify the POSTED message, not the composer, and stop + coordinate with Leo if contamination recurs.
- Attach to existing Chrome sessions; never silently spawn fresh ones.
- Do not run `gh pr review --request-changes` (shared account, same-author error) — verdicts are PR comments.
