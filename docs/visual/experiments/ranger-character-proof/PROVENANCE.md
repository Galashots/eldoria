# Ranger character proof — durable provenance record

The `machine-check-report.json` files in `candidate-v1/` and `walk-v1/` are
**generator-owned**: `npm run assets:build` rewrites them, so they can only
contain what the current tools emit. This file is the durable, hand-maintained
record for provenance facts the generators do not reproduce. It is never
written by any tool.

## Static candidate (candidate-v1)

Committed source: `art/source/characters/ranger-four-facing-source-v001.png`
(384×256, sha256 `ce0b98bb4833e030ebd2da177bdd48f0b2ceda4d244d3eec4bb71c7395be02f2`
— also recorded in the generated report).

Facts the 2026-07-30 re-baseline (PR #27, commit 460c176) removed from the
generated report because the current generator does not emit them:

- **Full generated source**: the committed 384×256 PNG is a 25% nearest-
  neighbour downsample of the original 1536×1024 generation, converted to a
  256-colour indexed archival PNG to bound repository size. Original's sha256:
  `f56089d9050f35209d400e97344dc6bc612d17dea74e96badc5c0c306c54b9b2`.
- **Quadrant mapping** of the 2×2 source grid:
  right = top-left, up = top-right, down = bottom-left, left = bottom-right.
  (The runtime mapping is encoded in `tools/process-ranger-source.mjs`
  `FACINGS`; this records the *source sheet* layout.)
- **Committed integrity repair** (recorded pre-re-baseline as
  `committedIntegrityRepair`, verbatim):
  - *reason*: "Recovered valid PNGs after committed IDAT corruption/truncation
    was found before walk generation."
  - *method*: "Rebuilt the SW frame deterministically from the committed
    source contract and rebuilt the contact sheet from the four accepted
    normalized frames."
  - *guard*: "npm run ranger-proof:integrity runs before any Ranger
    regeneration." (The guard still runs first in `npm test`.)

## Walk strip (walk-v1)

The generated report retains the full source block, including the owner
acceptance: source `art/source/characters/ranger-right-walk-source-v001.jpeg`
(1536×512, sha256 `3e8ac63f18a758bdc8f33f2485ccb2f12c4ff64c7649d5637c24fa4b8d1f6eae`),
"Owner-accepted corrected whole-strip source; baked checkerboard removed
deterministically." No provenance was lost for walk-v1; the block moved to the
end of the JSON file in the re-baseline.

## Re-baseline note (2026-07-30)

PR #27 replaced the normalized PNGs in `art/ranger-proof/normalized/` with the
pinned ubuntu CI environment's rendering (captured from CI run 30548602648) so
`npm run assets:verify` can enforce reproducibility. The prior committed bytes
matched no then-current platform because the old test chain regenerated and
silently overwrote them on every CI run. Pixel deltas are resampling rounding;
per-frame metric changes are visible in the regenerated reports (e.g. walk
`opaquePixels` 1180→1174 for frame 0).
