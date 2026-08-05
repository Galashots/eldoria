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

Flattening proofs: `open-grass-8x8-proof.png` is an 8x8 native-scale open-grass tiling
proof using the soil-derived grass base; `mixed-topology-proof.png` is a labeled mixed
grass/path/soil/water topology sheet. Both use the same flat-diamond-underlay plus
transparent-overlay composition and activation-time vertex resolver as the live renderer.

Focused gate: `node tools/terrain-test.mjs`

## Evidence summary

- Native 64×32 top-face pixels are retained inside a deterministic two-pixel-inset
  overlay; the authored 16px raised-block skirt and repeated perimeter are transparent.
  The renderer draws a continuous flat material diamond underneath every Farm cell.
- The open-grass 8x8 proof shows continuous soil-derived grass without the former dark
  raised-block lattice; the mixed topology proof shows direct corner-mask transitions
  without false elevation.
- Every vertex resolves from the four map cells meeting there, with water > soil > path >
  grass priority and out-of-bounds cells ignored. Open Farm grass uses only the soil-derived
  base; path/water-derived grass appears only inside its own transition boundaries.
- The striping gate proves the pre-fix XOR polarity model RED and the direct corner resolver
  GREEN on a straight grass/soil boundary; a secondary run cannot acquire a grass corner.
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
