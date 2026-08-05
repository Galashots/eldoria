# Terrain Placement Fix Work Order — iPad playtest finding 1 (2026-08-05)

**Seat:** Codex implements. Fable directs + exact-head acceptance. **ChatGPT visual gate REQUIRED** (this changes what's on screen). Leo merges after iPad re-check.
**Sequence:** AFTER the hotfix PR (`HOTFIX_BRIEF_20260805.md`). Separate PR — different risk class.
**Branch suggestion:** `agent/step8b-terrain-placement-20260805`.

## Problem (owner-observed on iPad, root cause located)

Border tiles alternate materials — e.g. a single field edge reads **soil → grass → soil**. Two unverified assumptions in `assets/iso/terrain/terrain-mask-map.json` are the suspected mechanism:

1. **Row-major mask assumption:** the map assumes vendor 4×4 cells are laid out in mask order 0–15 (reading order). Never verified against the sheet artwork.
2. **XOR polarity reuse:** `secondaryCenter: sourceMask = 15 XOR sameFamilyMask` treats "grass with soil to the north" as the flipped twin of "soil with grass to the north." These are different authored drawings; transition art is not polarity-symmetric.

Also measured (Fable, 2026-08-05): the three sheets' grass bases are **100% pixel-different** (mean |RGB| deltas: path↔soil 27.9, path↔water 22.7, soil↔water 30.9; palette sizes 20/18/11) — cross-set grass mismatch is real and visible.

## Owner rulings (Leo, 2026-08-05)

- **Farm primary set = grass→tilled-soil.** Water set stays in use around the pond; path set along paths. Do NOT fall back to flat color for pond/path.
- **Cross-set grass mismatch is accepted short-term.** Committed FUTURE note required (see below): make sets transition seamlessly, likely by harmonizing grass colors so everything matches.
- One-primary-set-per-zone is the standing rule for future zones (Town etc.).
- **ChatGPT refinement (accepted 2026-08-05): grass localization rule.** Record the three grass bases as intentionally mismatched source palettes; the renderer must NOT freely mix them across open Farm grass. Soil-derived grass owns ALL general Farm ground; path- and water-derived grass tiles appear ONLY within their own transition boundaries. Future harmonization = a separate visual-only PR with before/after palette evidence.

## Work items

### 1. Verified cell legend (BLOCKING GATE, before any remap)
Generate a labeled contact sheet per family: all 16 source cells **in vendor sheet order** at legible scale, labeled with cell index only — **do NOT attach mask guesses to the contact sheets** (ChatGPT tightening: the sheets show what IS, the mapping comes after human inspection). Mechanical generation by Codex; **Leo + ChatGPT then visually identify each cell's actual topology** (which sides/corners are grass vs secondary) **before item 2 proceeds**, and the verified cell→mask mapping is committed as evidence. All under `docs/visual/terrain-legend/` as the placement authority. No AI-inferred geometry: what a cell IS comes from looking at it.

### 2. Rebuild the mask semantics — AMENDED per the closed legend gate (ChatGPT ruling PR #47 comment #5192711505, Fable concurring; awaiting Leo's confirmation)
**The vendor grid is CORNER-coded, not edge-coded** (cells 6/9 are opposite-corner checkerboards — impossible in an edge set). This is a semantics rebuild, not a cell reshuffle:
- **Vendor index 0–15 is used DIRECTLY as the grass-corner mask**: bit0=bottom screen corner (world SE), bit1=left (SW), bit2=right (NE), bit3=top (NW); set bit = that corner is grass.
- **Remove the `15 XOR sameFamilyMask` polarity conversion entirely.**
- **Replace cardinal-neighbor masking with corner/vertex resolution**: each vertex's material is defined from the FOUR map cells meeting at it (not merely one diagonal neighbor); mixed-material vertices resolve deterministically by priority water > soil > path > grass; the map-boundary vertex rule must be explicitly defined (and tested).
- Update the JSON legend, tests, topology proofs, and captures to the corner semantics. No flipping/mirroring of cells, ever.
- Preload/fallback machinery unchanged (accepted in PR #45).

### 3. Striping gate (test)
Along any straight region boundary in a synthetic topology, exactly two materials may appear in the crossing direction — a third material sample (grass appearing inside a soil↔soil run, etc.) fails. Wire into the existing terrain test suite. Regenerate `mixed-topology-proof.png` + `open-grass-8x8-proof.png` and the 6 capture pairs from the fixed map.

### 4. Committed FUTURE note (owner-required)
In `docs/THIRD_PARTY_ASSETS.md` or the terrain README: cross-set grass harmonization is planned — a deterministic slicer recolor pass (palette-map each sheet's grass colors to one canonical grass palette, provenance-recorded like `flatten-raised-block-v1`). Include the measured deltas above so the future implementer knows the scale of the problem. Note the palette-size mismatch (20/18/11) means nearest-color or rank mapping, not 1:1.

### 5. Manifest
`node tools/asset-manifest.mjs --write` then `--check` after all evidence/asset regeneration, before push (Step 8's red-CI lesson).

## Scope fence

IN: legend, mask-map regen, striping test, proofs/captures regen, future note, manifest.
OUT: actual grass harmonization/recolor (future item), Town/new zones, any generation (PixelLab PAUSED), hotfix items (separate PR), gameplay changes.

## Evidence for the gates

- Director gate: legend vs mask-map consistency re-derivable by script; striping test red on old map, green on new.
- ChatGPT visual gate: regenerated proofs + capture pairs — boundary continuity (no striping), pond/path edges correct, and an explicit note of the accepted grass-shade mismatch so it isn't flagged as a regression.
- Leo: iPad re-check on the Farm.
