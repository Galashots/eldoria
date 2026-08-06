# Current Project State

**Updated:** 2026-08-06  
**Baseline:** `main` at `cc5df6d` (post PR #52)  
**Purpose:** cold-start continuity for the next implementation lead. This file records status; it does not grant authority or supersede the AI Team Charter.

## Live architecture

- One offline, vanilla HTML/CSS/JavaScript game rooted in `index.html`.
  Since Foundation B (2026-07-30) the inline blocks are extracted verbatim
  into `eldoria.css` and classic **deferred** scripts `js/01-*.js` …
  `js/11-*.js` at the end of `<body>` (numbered order, except
  `js/11-onboarding.js`, which loads before `js/09-main.js` because main's
  top-level boot calls into it); split points
  are existing top-level section comments only, all declarations remain
  `var`/`function` globals, and behavior/rendering/DOM timing are unchanged
  (proven byte-identical by reconstruction, full suite green, and 16/16
  pixel-identical artifact captures vs the pre-split baseline).
- World coordinates, collision, maps, saves, economy, quests, and combat remain orthogonal and shared by both render modes.
- Farm and Town default to the isometric renderer. Wilds, Deep Woods, and Mine remain top-down by default; under the `?iso=1` development override they render in iso with real enemy sprites, but flipping their defaults waits on the iso spec's combat/quest parity gates. The combat/armor spec's sub-project 1 is that flip: world combat *is* the parity work, so the defaults move when top-down retires, not before.
- Town's isometric NPCs Mira, Bram, and Gunnar render from committed
  PixelLab idle sprites (PR #48, 2026-08-05): one lossless crop/translate-only
  south → `down-right` 64×64 frame each via the `spr()` path, with the
  procedural prism preserved as a live fallback. All eight source rotations
  per NPC are committed as manifest-classified (`scope: source`) reference
  assets under `docs/visual/reviews/npc-sprite-integration-20260805/`.
  Auntie Momo's additional eight source rotations and the runtime frame are
  pending PR #50; that PR wires the existing `dumpling_vendor` NPC without
  changing its position or behavior.
  **Custody standard set by PR #48: committed character art from supplied
  packs is crop/translate-only — no resampling, recolouring, or pixel
  alteration** (`tools/npc-static-contract-test.py` enforces it).
- Farm isometric ground is real sprite terrain (Step 8, PRs #45/#47,
  2026-08-05): 51 flattened tiles sliced deterministically from three owned
  transition sheets, **corner-coded masks** (vendor index 0–15 IS the
  grass-corner mask; bits = bottom/left/right/top screen corners; vertex
  material resolved from the four meeting cells, priority
  water > soil > path > grass), soil-derived grass owning open Farm ground
  with path/water grass confined to their transition boundaries, striping
  regression gate red-on-old/green-on-new
  (`assets/iso/terrain/terrain-mask-map.json`, `tools/terrain-test.mjs`).
- iPad input feel (PR #46, 2026-08-05): double-tap zoom killed via scoped
  `touch-action: manipulation` (pinch preserved), iso-only movement knob
  `ISO_SPEED_MULT = 1.5` (`js/01`, beside `TARGET_VIEW_ROWS`), adaptive
  spawn-at-touch joystick with a bounded 240×220 bottom-left catchment and
  hide-on-release; `?fixedJoystick=1` persistently restores the fixed rig.
- The save schema is **version 4** (Step 7 Mira's Guide onboarding, 2026-08-04,
  owner-authorized migration): `player.onboarding` carries the guide status
  (`active`/`skipped`/`completed`) plus one boolean per milestone (`planted`,
  `harvested`, `usedCrop`, `metMira`, `acceptedQuest`, `enteredWilds`).
  Brand-new profiles start `active`; every pre-v4 save migrates `skipped` so
  established players are never forced into the tutorial; malformed onboarding
  blocks are rejected by the same central ingestion door as everything else.
  The v3 layer (profile & quest-state integrity, 2026-07-30) is unchanged
  underneath: enemy life state (`alive`/`respawnAt` by stable
  spawn ID) is profile-owned under `areas.<name>.enemies`, spawn definitions are
  the immutable `ENEMY_SPAWNS` templates, and ALL save input (profile load,
  paste import, file import) flows through one central
  parse → validate → migrate → canonicalize path (`ingestSaveText` in
  `js/06-saves.js`). v0/v1/v2 saves migrate deterministically with every enemy
  alive; corrupt stored saves refuse profile entry rather than being silently
  overwritten by autosave. Kill quests are paced to what the world can offer
  (one kill per quest while each area places one instance of each enemy;
  rewards = `Math.round(oldReward/oldCount)`).
- Combat uses **per-question damage budgets** (2026-07-30, ELD-PLAY-001):
  correct zero-tap = 2× base; wrong ≤ 1× base; regular correct capped at 4×
  base; every boss question capped at `ceil(maxHp/3)` so the Shadow Warden and
  Crystal Wyrm always take ≥3 answered questions at any attainable loadout;
  spent budgets end the phase promptly with child-readable feedback
  (`questionDamageBudget` in `js/05-combat-cooking.js`).
- **Identity & progression surface** (Step 5, 2026-07-31): the canonical
  `HERO_IDENTITIES` manifest (`js/02-data-state.js`) governs every player-facing
  identity — the visible labels are **Ranger** (internal ID `adventurer`) and
  **Mage** (internal ID `mage`); internal IDs, save keys, and sprite prefixes are
  unchanged. Title portraits are the committed south-facing `*-down-right.png`
  sprites (legacy anime portraits removed). A **shared modal lifecycle**
  (Foundation C2, `js/01-core-canvas.js`) owns open/close, focus trap, Escape
  safe paths, and background inertness for all ten overlays. The HUD **Hero**
  button opens the Character & Equipment screen (`js/10-character.js`): paper
  doll from committed art, live progression stats, four equipment slots, and a
  bag with child-readable comparisons plus manual equip/unequip
  (`equipFromBag`/`unequipSlot` in `js/05`) that preserves the gear-instance
  multiset and saves immediately. Reference: `docs/CHARACTER_INVENTORY.md`.
- **Foundation D — repository-wide asset manifest** (Step 6, 2026-07-31):
  `assets/manifest.json` inventories every committed media/source-art file
  (scope/domain/status/visual-review/provenance) and declares every runtime
  asset slot the game code actually references — including which are required,
  which are intentionally optional, and each one's documented fallback.
  `tools/asset-manifest.mjs --check` is wired into `npm run assets:verify`;
  a live puppeteer cross-check (`tools/asset-manifest-test.mjs`, wired into
  `npm test`) verifies the declared bindings against the real running game's
  `SPRITES` registry rather than trusting a hand-maintained table alone. See
  `docs/ASSET_MANIFEST.md`. Governance only — no runtime, save, or visual delta.

## Accepted delivery landmarks

| Work | Outcome |
| --- | --- |
| [PR #11](https://github.com/Galashots/eldoria/pull/11) | Merged bounded Ranger source-processing and animated-character proof at head `b065a224e74a264b5c66518dd62c38e0948162f1`. |
| [PR #12](https://github.com/Galashots/eldoria/pull/12) | Merged first Town isometric slice at head `078476822768d88aade4e9a0dcf3f8f689b09154`; CI run 101 passed. |
| [PR #13](https://github.com/Galashots/eldoria/pull/13) | Deliberately closed, not merged, as the reusable record that the probed TRELLIS/primitive-blockout route did not meet the North Star. |
| [PR #15](https://github.com/Galashots/eldoria/pull/15) | Merged the production asset-pipeline tools and decision record at head `1c6be80d672609923647150fdd28413015269019`; CI run 99 passed. |
| [PR #36](https://github.com/Galashots/eldoria/pull/36)–[#41](https://github.com/Galashots/eldoria/pull/41) | PixelLab doc corrections, Foundation B (mechanical `index.html` split), North Star v2, save-schema v3, per-question combat damage budgets, and the Ranger/Mage identity + Character screen surface — all merged, `main` green throughout. |
| [PR #42](https://github.com/Galashots/eldoria/pull/42)–[#43](https://github.com/Galashots/eldoria/pull/43) | Foundation D (repository-wide asset manifest and integrity gate) plus its crop-carrot container-repair prerequisite — merged 2026-08-04. |
| [PR #44](https://github.com/Galashots/eldoria/pull/44) | Step 7 Mira's Guide onboarding (save v4 `player.onboarding`, milestone chain, derived-objective chip) — merged 2026-08-04 after four review rounds across three seats. |
| [PR #45](https://github.com/Galashots/eldoria/pull/45), [#47](https://github.com/Galashots/eldoria/pull/47) | Step 8 Farm iso terrain: deterministic slicer + flatten transform, then the corner-mask semantics rebuild after the human-verified cell legend gate — merged 2026-08-05, owner iPad-checked. |
| [PR #46](https://github.com/Galashots/eldoria/pull/46) | iPad input hotfix: double-tap zoom kill, `ISO_SPEED_MULT` knob, adaptive joystick with `?fixedJoystick` fallback — merged 2026-08-05. |
| [PR #48](https://github.com/Galashots/eldoria/pull/48) | Town NPC idle sprites (Mira/Bram/Gunnar) with the lossless crop/translate-only custody standard and all 24 source rotations retained — merged 2026-08-05. |
| [PR #49](https://github.com/Galashots/eldoria/pull/49), [#50](https://github.com/Galashots/eldoria/pull/50) | Docs reconciliation through PR #48, and the Auntie Momo isometric sprite integration (`dumpling_vendor` wired to a committed south frame, position and behavior unchanged) — merged 2026-08-05. |
| [PR #51](https://github.com/Galashots/eldoria/pull/51) | ELD-PT-011/011a: per-profile music/reading-voice/effects levels, Say-it-again, the routine-action TTS boundary (`announceRoutine`), and bulk seed buying with honest partial-purchase counts — merged 2026-08-05 at `94cc35f`. Mute silences music and effects but **not** the reading voice; reading voice at 0% is the separate speech-off control. |
| [PR #52](https://github.com/Galashots/eldoria/pull/52) | ELD-PT-013 dumpling decision compliance: flat 20g pulls (no bundle discount, no saving-up nudge), one `DUMPLING_ODDS` table driving both the roll and the visible "Base odds" line, a tapped Read Odds control that speaks plain-language rarity rather than percentages, dough as a deterministic hand-pick with its exit above the shelf, and boss respawn moved to 24h — merged 2026-08-06 at `cc5df6d`. |

## Art and pipeline state

- Production generation now follows [`tools/pipeline/PIPELINE.md`](../tools/pipeline/PIPELINE.md): ChatGPT-owned identity concepts where identity matters, PixelLab rotations/generation, deterministic normalization, fail-closed validation, human review, and North Star review before anything enters `assets/`.
- The four identity concepts (Mage, Mira, Shadow Warden, Crystal Wyrm), the full cast sheet, and the Farm landscape sheet were owner-approved during pipeline calibration.
- Mage v3 reference rotation preserved the approved identity across all eight generated directions.
- **Superseded 2026-07-30 by owner call (iso mode):** the four-facing compatibility subset is no longer the iso runtime limit. In iso the engine consumes all eight facings per hero (right=SE, down=SW, left=NW, up=NE, down-right=S, down-left=W, up-left=N, up-right=E), with walk strips per facing sourced from the owner's manual web-Creator regeneration of both heroes, curated to the engine's `{stand, step A, stand, step B}` contract, and played by the iso renderer. The top-down escape hatch keeps cardinal facings so its attack strips and equipment overlays (authored for the original four facings) always resolve.
- Farm terrain is committed and live (see Step 8 above); the three source
  transition sheets' grass bases are intentionally mismatched palettes —
  cross-set harmonization is a planned separate visual-only PR (measured
  deltas recorded in `docs/ai-team/TERRAIN_FIX_BRIEF_20260805.md`).
- PR #47's faint green seams in full path interiors were reviewed and accepted
  as interim visual debt. The later bounded follow-up is path-00-only, while
  preserving masks 1–15 and the corner resolver, with native path proof and
  iPad before/after evidence.
- Building kits are the next generation need. They must use the approved landscape as the style reference and still pass human and North Star review.
- **Auntie Momo (Squishy Dumpling Vendor) sprite selected 2026-08-05:** Leo
  authorized one bounded 64px text-only `create8` probe. Codex produced three
  distinct characters — two text-only camera variants and one
  reference-v3 result — without prior authorization for the additional
  generations; the overrun was recorded. Leo subsequently selected the
  `reference-v3` candidate, the only one whose 56–57px figure fits the 64×64
  frame crop/translate-only. Integration work order:
  `docs/ai-team/MOMO_INTEGRATION_BRIEF_20260805.md`. PixelLab generation was
  paused again after that overrun; the combat/armor spec re-opens it *as an
  exercise* but does not lift the pause — see the scope list below. Research is
  documentation only, and generation still needs Leo's explicit per-batch
  authorization.
- [`tools/3D_ISO_SPRITE_PIPELINE.md`](../tools/3D_ISO_SPRITE_PIPELINE.md) is historical. Do not restart its generation route; only the retained engine-contract facts explicitly referenced by the v2 pipeline remain applicable.

## Recommended next outcome

Seating (Leo, 2026-08-04/05): **Codex implements; Fable (Claude) directs and
performs exact-head acceptance reviews; ChatGPT is the standing visual lead
and non-author reviewer; Leo merges.** The agreed queue as of 2026-08-06:

**The active plan is [`docs/superpowers/specs/2026-08-05-combat-armor-design.md`](superpowers/specs/2026-08-05-combat-armor-design.md).**
Leo expanded scope on 2026-08-05 to cover combat and armor together. That spec is
owner-approved design and it takes precedence over the queue below for anything it
covers; the queue governs everything it does not. Its §2 decisions are marked OWNER
and are not to be reopened by any agent.

Its sub-projects, in order (each takes its own implementation plan and its own PR):

1. **Retire top-down rendering** — pure deletion, cleanly revertable; Wilds/Deep Woods/
   Mine default to iso; facing-save migration through `ingestSaveText`.
2. **Armor as effective HP + hearts** — a `GEAR.hp` term in `computeMaxHp()`, discrete
   hearts at 5 HP each, unequip clamp. No save-schema change. Parallel with 1.
3. **World combat staging** — the same turn loop, played on the map with the questions
   overlaid as HUD. Depends on 1.
4. **Gear-art vertical slice** — one item end to end, iPad-inspected. Gates the bulk spend.
5. **Bulk gear art + combat animations.** Depends on 4.

Running alongside from day one, no code: **PixelLab research** (sub-project A) — durable
documentation plus the overlay-vs-baked render-model verdict.

The rest of the queue, unchanged and still live where the spec is silent:

1. Leo chose ELD-PT-011/011a, delivered by PR #51. Remaining-area terrain
   (Town first, one-primary-tileset-per-zone rule) is still unstarted and
   unauthorized;
2. actor contact shadows (tuned against the landed NPC cast);
3. camera-feel reassessment from fresh iPad evidence;
4. env art for buildings/props, then missing NPC/monster sprites;
5. UI theming LAST, so it is not themed against a temporary baseline;
6. later: occlusion fading, cross-set grass harmonization, water/weather.

Out of scope unless Leo explicitly expands it:

- map, collision, economy, or curriculum changes;
- **combat changes — now authorized** for the combat/armor spec only, and only within
  it. Locked decision 2 holds the turn loop and the per-question damage budgets
  unchanged, so the existing combat tests must pass untouched; any need to edit them is
  a signal that the authorization has been exceeded;
- **retirement of top-down rendering — now authorized** as sub-project 1, on the
  spec's terms: a pure-deletion PR that lands first and stays cleanly `git revert`-able,
  because it removes the fallback renderer before iso combat is proven;
- unapproved visual identities or silent North Star replacement;
- **PixelLab generation — in scope for this exercise**, but still gated: the research
  phase is documentation only, the vertical slice at sub-project 4 must be inspected on
  the iPad first, and **every batch after it needs Leo's explicit per-batch
  authorization**. The generation pause from the Momo probe overrun is lifted only by
  that per-batch approval, never by a plan document; and
- framework, bundler, TypeScript, or real-time 3D migration.

If required art cannot clear visual review, keep the validated placeholder for
that item and record the gap. Do not lower the North Star bar to make a PR
appear complete.

## Required gates for the large PR

- Follow [`LARGE_PR_EXECUTION.md`](LARGE_PR_EXECUTION.md).
- `npm test` passes on the exact reviewed head and CI is green.
- Production sprite inputs pass the applicable validator gates; walking profiles use `--require-walks`.
- Visual evidence is inspected, not inferred from pixel metrics.
- The review states **Aligned**, **Intentional interim gap**, or **Refresh candidate** for North Star alignment.
- A non-author reviewer accepts the exact head before merge.
