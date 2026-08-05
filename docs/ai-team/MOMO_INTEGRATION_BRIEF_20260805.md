# Auntie Momo Integration Work Order — 2026-08-05

**Seat:** Codex implements. Fable directs + exact-head acceptance (independent pixel reproduction). **ChatGPT visual gate REQUIRED** (this is Momo's first in-game integration visual gate; the selected eight-direction source art was already reviewed and accepted before PR #50). Leo merges.
**Branch suggestion:** `agent/momo-sprite-integration-20260805`.

## Probe outcome (decided)

Leo authorized one bounded 64px text-only `create8` generation for the Auntie Momo workflow experiment. Codex produced three distinct characters — two text-only camera variants and one reference-v3 result — without prior authorization for the additional generations; the overrun was recorded. Leo subsequently picked the winner, and PixelLab generation is paused again:

- **SELECTED: `momo-reference-v3`** — PixelLab character `da8c93d3-17a9-4dae-8726-e29c6ac9bb39`, 120×120 canvas, figure 56–57px. Owner verdict 2026-08-05: "Momo v3 looks good to me."
- Retired candidates (retain in `_probe_local` only, never commit): `momo-create8-high` `968d2728-5f9f-402e-9ff7-3e9d40063b3d`, `momo-create8-low` `ada91453-5f3b-4e08-9351-f0c44a8247f8`. Record all three character IDs in the review README for custody (server-side recovery), including WHY the others were retired: their 68–70px figures cannot fit the 64×64 frame without resampling, which the PR #48 standard forbids.
- Fable's contract check (done): all three candidates pass heading fidelity (south family faces, north family backs, 8 distinct rotations); v3 frames are binary-alpha, transparent-background, clean. **v3 is the only candidate that fits 64×64 crop/translate-only.**

## Work items — follow the PR #48 pattern EXACTLY

1. **Processing: crop/translate ONLY** via the PR #48 `process_npc_static.py` path (no resample/recolour/threshold; crop transparent margin, center horizontally floor((64−w)/2), lowest opaque row → row 63). Commit all 8 direction frames under `docs/visual/reviews/momo-sprite-integration-20260805/source-rotations/momo/` + one runtime `assets/iso/npc/momo-down-right.png` (byte-identical to the committed `south` frame).
2. **Wire to the existing `dumpling_vendor` NPC** (Town, row 14/col 17 — currently the fallback prism). Reuse the existing `spr()`/`drawIsoNpc` branch; procedural prism stays as live fallback. NO dialogue/gameplay/position changes; her Squishy Stall behavior is future dumpling-feature work.
3. **Custody artifacts:** extend `npc-direction-map.json` (or a sibling) with source zip/character ID, direction mapping, and source/output pixel hashes; extend `tools/npc-static-contract-test.py` to cover momo (all existing gates: 64×64 RGBA, binary alpha, bottom row 63, centering, source-crop pixel preservation, runtime match); manifest entries `scope: "source"` for the 8 frames + runtime classification for the game file; `node tools/asset-manifest.mjs --write` then `--check` before push.
4. **Review README** in the new folder: provenance (3 probe character IDs, which was selected and why), the text-only-generation workflow-experiment context, contact sheet of the 8 rotations, real-render captures (desktop + iPad-landscape + phone-portrait with Momo's stall position in frame).
5. **North Star alignment note required.** Flag honestly for the visual gate: v3's palette is muted/brown relative to the vivid cast (Mira/Bram/Gunnar) — ChatGPT rules whether that passes as-is, needs a bounded palette pass (would be pixel alteration — separate explicit approval), or a reroll. Do NOT recolor in this PR.

## Scope fence

IN: the items above, tests, evidence, manifest regen.
OUT: any further PixelLab generation (probe budget spent; PAUSE back in force), dialogue/quest/dumpling-stall gameplay, animation/walk work, recoloring, the other two candidates.

## Chain

Codex head SHA → Fable exact-head acceptance (independent ZIP-to-committed pixel reproduction, same as #48) → ChatGPT visual gate (identity vs Leo's spec + cast-palette coherence ruling) → Leo merges.
