# Auntie Momo sprite integration review

This review package integrates the owner-selected Auntie Momo v3 PixelLab
rotation into the existing isometric `dumpling_vendor` NPC. It changes only
the stationary Town NPC's iso idle art; dialogue, position, dumpling logic,
movement, animation, and save behavior are unchanged.

## Selected source and custody

Leo selected `momo-reference-v3` on 2026-08-05 with the verdict “Momo v3
looks good to me.” The selected PixelLab character is:

| Item | Value |
| --- | --- |
| Character ID | `da8c93d3-17a9-4dae-8726-e29c6ac9bb39` |
| Canvas | 120×120 RGBA per direction |
| Output | 8 idle directions, `Idle/rotations/{direction}.png` |
| PixelLab view | `high top-down` |
| Source ZIP SHA-256 | `71e9cc512b6a6ad2e83e56a037bf73aed6d887e02f90858652fb174441d87692` |

The probe was a bounded workflow experiment comparing text-only generation,
the high-top-down text route, and reference-conditioned rotation. The two
retired candidates remain in `_probe_local` only and are not committed:

- `968d2728-5f9f-402e-9ff7-3e9d40063b3d` (`momo-create8-high`)
- `ada91453-5f3b-4e08-9351-f0c44a8247f8` (`momo-create8-low`)

They were retired because their 68–70px figures could not fit the 64×64
runtime frame without resampling. The selected v3 figure is approximately
56–57px and fits the existing lossless processing contract.

The raw ZIP, reference image, and retired outputs remain outside Git under
`_probe_local`. The committed custody record is
[`npc-direction-map.json`](npc-direction-map.json), which records the source
ZIP hash, source member hashes, crop bounds, output hashes, and engine-slot
mapping.

## Deterministic processing

`tools/pipeline/process_npc_static.py` removes only the transparent outer
margin, centers the exact RGBA crop with `floor((64 - width) / 2)`, and
translates its lowest opaque row to row 63 on a 64×64 transparent canvas. It
does not resample, recolour, threshold, sharpen, or redraw pixels.

The vendor-to-engine mapping is the repository-wide mapping already used for
the other Town NPC source packs:

| Vendor direction | Engine slot |
| --- | --- |
| south | down-right |
| south-east | right |
| east | up-right |
| north-east | up |
| north | up-left |
| north-west | left |
| west | down-left |
| south-west | down |

All eight processed source directions are retained under
`source-rotations/momo/`. The stationary runtime currently loads only the
south/down-right frame as `assets/iso/npc/momo-down-right.png`; the renderer
maps that asset to the existing `dumpling_vendor` NPC ID. The procedural
`drawIsoNpc` body/head remains the fallback if the image is unavailable.

## Evidence

- [`source-rotation-contact-sheet.png`](source-rotation-contact-sheet.png) —
  deterministic nearest-neighbor review sheet of all eight directions.
- `docs/playtest/2026-08-05-momo-sprite-integration/` — desktop,
  iPad-landscape, and phone-portrait captures through the real iso renderer.

## Validation

- `python tools/npc-static-contract-test.py` — all 32 retained source frames
  and both runtime custody sets pass 64×64 RGBA, binary-alpha,
  bottom-anchor, centering, crop-pixel preservation, and runtime-byte-match
  checks.
- `node tools/npc-sprite-test.mjs` — Town iso boot, all four NPC sprite
  bindings, sprite branches, and asset paths.
- `node tools/npc-sprite-test.mjs --capture` — refreshed real-render evidence.
- `node tools/asset-manifest.mjs --check` — clean after manifest regeneration.

## North Star alignment

**Intentional interim gap.** Momo's approved identity and high-top-down
silhouette fit Eldoria's readable pixel-art NPC direction and the existing
Town renderer. Her muted brown palette is less vivid than the current
Mira/Bram/Gunnar cast; this PR preserves the approved pixels and deliberately
does not perform an unapproved recolour. A future palette-harmonization pass
would require a separate explicit visual decision.

## Scope fence

This PR does not add dialogue, vendor behavior, placement changes, walking or
animation, recolouring, further PixelLab calls, or runtime use of the other
seven directions.
