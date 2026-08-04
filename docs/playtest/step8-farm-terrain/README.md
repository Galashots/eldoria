# Step 8 PR B Farm terrain evidence

These captures are deterministic before/after pairs for the render-only Farm terrain
integration. Each pair uses the same browser page, Farm map, camera, player coordinates
(`x=10*TILE`, `y=10*TILE`), facing (`down`), frozen clock (`1700000000000`), viewport,
device scale, and hero profile. The only difference is the test-only render flag that
forces the existing flat-diamond fallback for the `before` image.

| View | Ranger before | Ranger after | Mage before | Mage after |
|---|---|---|---|---|
| Desktop 1280×800 @1 | [before](desktop-adventurer-before.png) | [after](desktop-adventurer-after.png) | [before](desktop-mage-before.png) | [after](desktop-mage-after.png) |
| iPad landscape 1180×820 @2 | [before](ipad-landscape-adventurer-before.png) | [after](ipad-landscape-adventurer-after.png) | [before](ipad-landscape-mage-before.png) | [after](ipad-landscape-mage-after.png) |
| Phone portrait 390×844 @2 | [before](phone-portrait-adventurer-before.png) | [after](phone-portrait-adventurer-after.png) | [before](phone-portrait-mage-before.png) | [after](phone-portrait-mage-after.png) |

Capture command: `node tools/terrain-capture.mjs`

Focused gate: `node tools/terrain-test.mjs`

## Evidence summary

- Native 64×32 top-face geometry is retained; the 64×48 sprite anchor keeps the authored
  lower skirt below the ground diamond without row drift.
- Grass, packed path, tilled soil, and deep water remain distinguishable at all three
  viewports; both hero silhouettes and the Mira onboarding cue remain readable.
- The Farm adjacency scan found `grass|path`, `grass|soil`, `grass|water`, and `path|soil`.
  The first three use explicit transition families; `path|soil` uses the documented
  material-priority hard-edge rule (soil owns the boundary).
- Missing-image fallback, preload settlement, slicer byte stability, and save v4
  before/after byte equivalence are covered by the focused terrain suite.

## North Star alignment

**Intentional interim gap.** The Farm moves toward the current v2 North Star's crisp
pixel-art terrain, rich farm palette, warm upper-left readability, and clear routes while
remaining a bounded library-sheet integration rather than the final HD-2D environment pass.
No North Star refresh is recommended by this scoped change.
