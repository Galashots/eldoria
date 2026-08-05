# Step 8 contract — Environment art: Farm iso terrain + North Star v3 adoption

Status: ACCEPTED by ChatGPT (visual lead) 2026-08-04 with the clauses in the final section,
which are adopted verbatim into this contract. · Author: Claude (director) · Implementer: Codex
Date: 2026-08-04 · Baseline: main `ba0d7ffab1173261437e55634b6dac6a6779cad1` (post-#44)

## Goal

Replace the Farm's flat-color isometric ground with real pixel-art terrain from assets we
already own or downloaded free, and formally adopt the owner-approved pixelized North Star v3.
**Zero PixelLab generation credits: generation stays PAUSED.** Building kits, Town cobble
(if absent from the free library), and NPC sprites are explicitly OUT of scope — they are the
next contract, gated on the owner re-opening spend.

## PR A — CANCELLED (2026-08-04, owner + director)

Investigation during kickoff showed the "pixelized v3 candidate" from 2026-07-31 was never
durably saved (Drive and the ChatGPT Project Source both held the v2 bytes), and a fresh
regeneration produced an image the owner judged **the same as v2 — because v2 is already the
pixel-art rendition** (adopted 2026-07-30, PR #38). There is no substantive v3 delta, so per
the visual-lead clause ("PR A cannot merely copy or rename v2") there is nothing to adopt.
**v2 remains the authoritative North Star.** Every reference to "North Star v3" in this
contract now reads as the current authoritative North Star,
`docs/visual/eldoria-visual-north-star-v2.png`, including the six-point alignment gate.
A future v3 requires a genuinely new owner-approved image through the supersession protocol.

### PR B — Farm iso terrain sprites (LARGE, Codex) — branches from current main

**Sources (all already paid-for or free):**

1. Three free PixelLab library transition sheets currently in `C:\Users\Leo\Downloads`
   (grass→packed-light-dirt, grass→tilled-soil, grass→calm-deep-water). Measured: 259×195 px,
   4×4 transition grid, 64×48 cells, 64×32 top-face diamonds, 2 px flat top.
   **CAUTION (visual-lead finding): 259×195 is NOT a contiguous 256×192 grid — there are three
   extra pixels on each axis, consistent with 1 px internal gutters. The slicer must encode and
   test exact crop origins, never divide the sheet dimensions naively.**
2. The owned July generation batch in `_probe_local/pipeline/landscape/` (16 ground tiles,
   6 props, 3 transition sets, road autotiles) — promoted through the existing
   normalize→validate pipeline, never used raw.

**Key geometry fact (verified in source):** the iso renderer projects one TILE=32 world tile
to a **64×32 screen diamond** (`ISO_TW=64, ISO_TH=32`, `drawIsoTileDiamond`). The library
diamonds are therefore already exactly runtime size. **There is no downscale step.** Slice
at native resolution; any resampling is a defect.

**Work items:**

1. **Deterministic slicer** (committed tool, e.g. `tools/pipeline/slice_tileset.py`): cuts a
   259×195 sheet into its 16 variant cells (64×48 incl. flat-top skirt), writes
   `assets/iso/terrain/<family>-<variant>.png` plus a provenance block (source file name,
   SHA-256, library URL/name, grid position). Re-running must be byte-stable.
2. **Autotile selection** (render-only): a 16-variant marching-squares lookup keyed on the four
   edge neighbors (same-family vs other), mapping to the sheet's tile_rules layout. Pure
   presentation — `map` data, collision, travel, and interaction are untouched. Top-down mode
   untouched.
3. **Farm wiring**: GRASS (base variations from the July set), SOIL (tilled family), WATER
   (deep-water family + its grass transitions), PATH/EXIT/DOOR floor (packed-dirt family).
   Tall-object floors keep their current substitution rules (js/08-iso-renderer.js:160-164).
   Fallback: any missing sprite falls back to today's color diamond — the game must never
   render a hole.
4. **Performance guardrail**: sprites decoded once at load (same `spr()` registry pattern);
   no per-frame allocation or pattern rebuilds; iso Farm must stay smooth on iPad.
5. **Manifest**: every new asset registered (`node tools/asset-manifest.mjs --write
   --accept-new`), `--check` clean; assets/README provenance section updated.
6. **Tests** (extend tools/iso-test.mjs or a new terrain suite): slicer byte-stability;
   marching-squares variant selection for the canonical neighbor cases (isolated, edge,
   inner-corner, outer-corner, full-surround); missing-sprite fallback renders without error;
   zero console errors booting iso Farm; captures — iso Farm on desktop / iPad-landscape /
   phone-portrait for both heroes, before/after pair for the PR body.
7. **Scope fence**: Farm only. Town/Wilds ground stays color-diamond this PR. No gameplay,
   save, or top-down changes. No generation calls of any kind.

**Review chain:** Codex implements against this contract on a branch from current main →
director (Claude) exact-head acceptance review, including re-running the slicer and comparing
bytes → ChatGPT North Star v3 alignment verdict on the captures (visual lead — this is the
sprint's defining gate) → Leo merges. Standard gates: full `npm test`, manifest `--check`,
CI green on the exact reported head SHA.

**Playtest follow-up (owner):** after merge, Leo eyeballs iso Farm on the boys' iPad — terrain
readability at TARGET_VIEW_ROWS=18 is a kid-facing question no capture fully answers.

## Out of scope (next contract, spend-gated)

Building kits (farmhouse, General Store) · Town cobble generation if the free library lacks it
(browse first) · Mira/Bram sprites from the banked concepts (`art-incoming/`, need crop to
≤256 first) · Wilds/DeepWoods/Mine terrain · animated water.

## Visual-lead review clauses (ChatGPT, 2026-08-04 — adopted verbatim)

**PR A additions:**
- PR A must explain the SUBSTANTIVE v3 delta over v2 (corrected composition, newer production
  characters, stronger terrain direction, replacement of a known mismatch) — not merely copy or
  rename; include Leo's approval date and the exact reason v3 supersedes v2.
- Update every current-reference permanent and raw link to v3; historical records stay intact.
- Governance mechanics pre-approved; the v3 IMAGE itself still gets ChatGPT's visual inspection
  inside PR A before visual-lead acceptance.

**Slicer geometry (mandatory checks):**
- Encode exact crop origins (see the gutter caution above); record the crop layout explicitly
  (cell size, gutter size, outer margin, row order, column order).
- Validate all sixteen cells have identical anchor geometry; define the 64×48 sprite anchor
  relative to the engine's 64×32 ground diamond — the extra sixteen vertical pixels must never
  produce row drift, overlapping lips, or visible seams.
- Compare each decoded output pixel-for-pixel with its intended source rectangle; run the slicer
  twice and require identical output SHA-256s; pin the encoder/tool version. "Byte-stable" means
  deterministic generated PNGs (deterministic re-encoding), not literal byte-range copying.

**Autotile clarifications:**
- Commit ONE authoritative mask convention (bit 0 = north, bit 1 = east, bit 2 = south,
  bit 3 = west) plus a labeled contact sheet or JSON table mapping every source row/column to its
  mask — never infer the library's ordering inside runtime code.
- Material ownership and priority must be deterministic and documented (e.g. water edge > soil
  edge > path edge > plain grass); exact order may differ but must be intentional and visually
  reviewed.
- Scan the current Farm map for every adjacent material pair: each pair is proven absent,
  assigned a deliberate hard-edge treatment, or handled by an explicit composition rule.
- Ambiguous 2×2 checkerboard/saddle configurations: prove the Farm contains none, reject them in
  a topology test, or document a deterministic tie-break. Sheet ordering must never accidentally
  decide the visual result.
- Precompute masks and draw records at area activation (or map-reference change). The draw loop
  must not scan neighbors, allocate terrain records, create/decode images, or inspect pixels per
  frame — this replaces any CI frame-time threshold as the iPad guardrail.

**Loading and fallback:**
- "Decode once" means ALL terrain images are decoded before the Farm first displays — no lazy
  first-use hitch; no missing-image requests.
- Fallbacks use the EXISTING exact behavior: soil → `drawIsoSoilTile`; other ground families →
  `drawIsoTileDiamond` with `TILE_COLOR`.
- Once a terrain family is adopted, all sixteen required variants per production sheet are
  CI-REQUIRED: runtime fallback prevents holes; CI prevents silently shipping degraded terrain.

**Provenance and licensing (mandatory source-rights gate):**
- Record: original library page and author, exact license text, download date, original sheet
  filename and SHA-256, any attribution obligation, owned-July-batch provenance, and the full
  transformation chain from source to runtime output. "Free library" alone is NOT sufficient
  provenance — commit the applicable license record alongside the assets or in a third-party
  asset notice.
- The July-batch source set must be enumerated as a FIXED ALLOWLIST before implementation:
  every admitted source file, every derived runtime file, its runtime key/family, and whether it
  participates in ground Pass 1 or another authorized render layer. Anything outside the
  allowlist stays source-only or deferred.

**Additional tests and evidence:**
- All 16×3 transition outputs exist with exact dimensions; no gutter pixels, background halos,
  alpha fringes, or one-pixel cracks.
- Every current Farm material adjacency has a defined rule; map boundaries use a documented
  policy (prefer treating out-of-bounds as the same family unless explicit world-edge art
  exists).
- Tree/house, door/exit, soil/crop, and water floor substitutions remain correct (preserve the
  logical floor substitutions at js/08-iso-renderer.js:160-164).
- Onboarding highlights and interaction cues remain readable over textured terrain.
- Save v4 output is byte-equivalent for the same player state (proves render-only).
- Before/after evidence uses IDENTICAL deterministic state: same camera, player coordinates and
  facing, crop states, frozen time for animated cues, viewport and device scale, same hero — not
  two loosely similar manual screenshots.

**North Star v3 alignment gate for PR B (ChatGPT judges captures on):**
1. Projection: no seams, drift, mixed diamond geometry, or incorrect anchors.
2. Pixel language: no smoothing, inconsistent pixel density, or library-art collage effect.
3. Gameplay readability: soil, paths, exits, water boundaries, crops, heroes, and highlights
   remain immediately distinguishable.
4. Lighting and palette: terrain families feel like one world; warm upper-left light,
   restrained depth.
5. Visual hierarchy: terrain improves richness without overpowering characters, crops,
   interactables, or travel routes.
6. Fallback integrity: no black holes, transparent gaps, or flashing placeholders during load.

A visually incompatible source sheet must NOT be forced into production merely because it passes
geometry tests — it can remain source-only while its family keeps the fallback.

**Process:** no Step 9 contract before the agreed post-sprint reassessment with Leo.
