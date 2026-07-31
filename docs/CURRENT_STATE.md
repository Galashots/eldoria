# Current Project State

**Updated:** 2026-07-29  
**Baseline:** `main` at `a91135c1e95b5aec4b35faca41ca602bcb4e7d97`  
**Purpose:** cold-start continuity for the next implementation lead. This file records status; it does not grant authority or supersede the AI Team Charter.

## Live architecture

- One offline, vanilla HTML/CSS/JavaScript game rooted in `index.html`.
  Since Foundation B (2026-07-30) the inline blocks are extracted verbatim
  into `eldoria.css` and nine classic **deferred** scripts `js/01-*.js` …
  `js/09-*.js` loaded in numbered order at the end of `<body>`; split points
  are existing top-level section comments only, all declarations remain
  `var`/`function` globals, and behavior/rendering/DOM timing are unchanged
  (proven byte-identical by reconstruction, full suite green, and 16/16
  pixel-identical artifact captures vs the pre-split baseline).
- World coordinates, collision, maps, saves, economy, quests, and combat remain orthogonal and shared by both render modes.
- Farm and Town default to the isometric renderer. Wilds, Deep Woods, and Mine remain top-down by default; under the `?iso=1` development override they render in iso with real enemy sprites, but flipping their defaults stays out of scope until the iso spec's combat/quest parity gates are met.
- Town's validated isometric scope is intentionally partial: the General Store and Mira have dedicated placeholder treatments; the Forge and remaining villagers still use generic placeholders.
- The save schema is **version 3** (profile & quest-state integrity, 2026-07-30,
  owner-authorized migration): enemy life state (`alive`/`respawnAt` by stable
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

## Accepted delivery landmarks

| Work | Outcome |
| --- | --- |
| [PR #11](https://github.com/Galashots/eldoria/pull/11) | Merged bounded Ranger source-processing and animated-character proof at head `b065a224e74a264b5c66518dd62c38e0948162f1`. |
| [PR #12](https://github.com/Galashots/eldoria/pull/12) | Merged first Town isometric slice at head `078476822768d88aade4e9a0dcf3f8f689b09154`; CI run 101 passed. |
| [PR #13](https://github.com/Galashots/eldoria/pull/13) | Deliberately closed, not merged, as the reusable record that the probed TRELLIS/primitive-blockout route did not meet the North Star. |
| [PR #15](https://github.com/Galashots/eldoria/pull/15) | Merged the production asset-pipeline tools and decision record at head `1c6be80d672609923647150fdd28413015269019`; CI run 99 passed. |

## Art and pipeline state

- Production generation now follows [`tools/pipeline/PIPELINE.md`](../tools/pipeline/PIPELINE.md): ChatGPT-owned identity concepts where identity matters, PixelLab rotations/generation, deterministic normalization, fail-closed validation, human review, and North Star review before anything enters `assets/`.
- The four identity concepts (Mage, Mira, Shadow Warden, Crystal Wyrm), the full cast sheet, and the Farm landscape sheet were owner-approved during pipeline calibration.
- Mage v3 reference rotation preserved the approved identity across all eight generated directions.
- **Superseded 2026-07-30 by owner call (iso mode):** the four-facing compatibility subset is no longer the iso runtime limit. In iso the engine consumes all eight facings per hero (right=SE, down=SW, left=NW, up=NE, down-right=S, down-left=W, up-left=N, up-right=E), with walk strips per facing sourced from the owner's manual web-Creator regeneration of both heroes, curated to the engine's `{stand, step A, stand, step B}` contract, and played by the iso renderer. The top-down escape hatch keeps cardinal facings so its attack strips and equipment overlays (authored for the original four facings) always resolve.
- The approved Farm landscape candidates remain generation outputs until they are deliberately normalized, validated, committed under `assets/iso/`, wired into the renderer, and inspected in-game.
- Building kits are the next generation need. They must use the approved landscape as the style reference and still pass human and North Star review.
- [`tools/3D_ISO_SPRITE_PIPELINE.md`](../tools/3D_ISO_SPRITE_PIPELINE.md) is historical. Do not restart its generation route; only the retained engine-contract facts explicitly referenced by the v2 pipeline remain applicable.

## Recommended next outcome

Leo has authorized one **LARGE** next PR. “Large” permits coordinated delivery under one coherent outcome; it does not permit unrelated gameplay, map, save, economy, curriculum, or architecture changes.

Recommended outcome: **Phase 3 production-art integration foundation for the already-isometric Farm and bounded Town slice.**

In scope:

1. produce/ingest the approved-style Farm landscape and the minimum approved building/character assets needed by the Farm plus the General Store/Mira slice;
2. normalize and validate every production asset through the merged pipeline;
3. add the smallest asset registry/loading and bottom-anchor integration needed in `index.html`, retaining placeholder fallback when any asset is missing;
4. extend automated tests for asset presence, fallback behavior, anchors, depth order, Farm↔Town travel, direct tap and Action interaction, save invariance, and zero console errors;
5. retain desktop, phone portrait, iPad landscape, overlap/depth, and interaction evidence for exact-head review; and
6. update this status file and the relevant pipeline inventory to the delivered state.

Out of scope unless Leo explicitly expands it:

- Wilds, Deep Woods, or Mine conversion;
- map, collision, progression, economy, curriculum, dialogue, quest, or save-schema changes;
- retirement of top-down rendering;
- unapproved visual identities or silent North Star replacement; and
- framework, bundler, TypeScript, or real-time 3D migration.

If the required building or character art cannot clear visual review, keep the validated placeholder for that item and record the gap. Do not lower the North Star bar to make the PR appear complete.

## Required gates for the large PR

- Follow [`LARGE_PR_EXECUTION.md`](LARGE_PR_EXECUTION.md).
- `npm test` passes on the exact reviewed head and CI is green.
- Production sprite inputs pass the applicable validator gates; walking profiles use `--require-walks`.
- Visual evidence is inspected, not inferred from pixel metrics.
- The review states **Aligned**, **Intentional interim gap**, or **Refresh candidate** for North Star alignment.
- A non-author reviewer accepts the exact head before merge.
