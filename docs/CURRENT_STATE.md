# Current Project State

**Updated:** 2026-07-29  
**Baseline:** `main` at `a91135c1e95b5aec4b35faca41ca602bcb4e7d97`  
**Purpose:** cold-start continuity for the next implementation lead. This file records status; it does not grant authority or supersede the AI Team Charter.

## Live architecture

- One offline, vanilla HTML/CSS/JavaScript game in `index.html`.
- World coordinates, collision, maps, saves, economy, quests, and combat remain orthogonal and shared by both render modes.
- Farm and Town default to the isometric renderer. Wilds, Deep Woods, and Mine remain top-down unless the development override is used.
- Town's validated isometric scope is intentionally partial: the General Store and Mira have dedicated placeholder treatments; the Forge and remaining villagers still use generic placeholders.
- The current save schema remains version 2. Isometric work must not change it unless Leo explicitly authorizes a migration.

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
- Mage v3 reference rotation preserved the approved identity across all eight generated directions. The engine continues to consume the four diagonal facings mapped to its existing slots.
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
