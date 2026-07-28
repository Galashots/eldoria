# Ranger animated-character pipeline proof

**Status:** Static candidate v1 ready for owner review; animation deliberately not started  
**Branch:** `work/ranger-character-pipeline-proof`  
**Base inspected:** `main` at `8fedcafa05d1a98935dbb8746b39e459fba48e49`  
**Scope:** four static Ranger facings only at the current owner-review gate; no walk, attack, equipment, enemies, or runtime integration

## Current decision gate

**PROOF READY FOR OWNER REVIEW — STATIC FACINGS ONLY.**

The four normalized static facings exist, the source-to-frame processing path is reproducible, and all applicable machine gates pass. This is not an art approval. The walk strip is intentionally withheld until Leo accepts or rejects the static identity/camera set.

The image-generation limit was respected:

1. one four-facing candidate generated from the attached current Visual North Star;
2. one targeted corrective generation pass requested transparent isolation and cleaner pixel treatment;
3. no further generation pass was used;
4. remaining halo/shadow contamination was removed deterministically during normalization rather than through another generation loop.

## Track coordination

- Track 1 is now PR #12 at head `51421612d6fafefbc14faba014166b873380d205` and does not overlap this branch's files.
- Track 2(b) is PR #13 at head `7f0768d83ca8d1cf99275354d8e4750ac3e47a5c`. It proved the Blender camera/render/normalization route, but TRELLIS mesh generation remained quota-blocked.
- This branch still does not modify `index.html`; runtime integration waits until the static proof is accepted and Track 1 lands or rebases cleanly.

## Candidate v1

### Source

`art/source/characters/ranger-four-facing-source-v001.png`

To bound repository size, the committed source is a deterministic 50% nearest-neighbour archival copy (768×512) of the exact 1536×1024 generated output; both SHA-256 values are retained in the machine report. The committed source remains large enough for the 64×64 proof and is the reproducible pipeline input.

The generated sheet is a 2×2 arrangement with this recovered mapping:

| Source cell | Engine slot | Iso facing |
| --- | --- | --- |
| top-left | `right` | SE |
| bottom-left | `down` | SW |
| bottom-right | `left` | NW |
| top-right | `up` | NE |

The source contains real transparency, but also low-opacity floor shadows and halos. The processor removes those through a fixed alpha threshold; it does not repaint or manually edit character pixels.

### Normalized outputs

- `art/ranger-proof/normalized/adventurer-right.png`
- `art/ranger-proof/normalized/adventurer-down.png`
- `art/ranger-proof/normalized/adventurer-left.png`
- `art/ranger-proof/normalized/adventurer-up.png`

Each output is 64×64 RGBA with binary alpha and a shared bottom-centre foot pivot.

### Deterministic processing

`tools/process-ranger-source.mjs` records all production constants:

- 2×2 fixed source-cell mapping;
- source alpha threshold `224`;
- one shared scale based on a maximum visible height of `56` pixels;
- nearest-neighbour resampling;
- resized alpha threshold `128`;
- bottom-six-row opaque centroid aligned to `x=32`;
- visible bounds anchored to `y=63`;
- two-run output/evidence hash comparison.

Regenerate:

```sh
npm run ranger-source:process
```

Validate committed statics:

```sh
npm run ranger-proof:candidate
```

The full synthetic static-plus-walk harness remains covered by:

```sh
npm run ranger-proof:self-test
```

## Machine-check result

Candidate report: `docs/visual/experiments/ranger-character-proof/candidate-v1/machine-check-report.json`

- four 64×64 RGBA frames: pass;
- expected facing order and naming: pass;
- binary alpha: pass;
- visible subject in every frame: pass;
- bottom anchor at row 63: pass;
- horizontal padding: pass;
- shared-scale consistency: pass — visible-height range 1 px, width range 3 px;
- foot-pivot consistency: pass — bottom-band centre range under 1 px;
- walk dimensions/stability: **not assessed because no walk was generated**.

Machine checks do not establish identity, camera, lighting, facing semantics, pixel quality, or North Star alignment.

## Evidence

Under `docs/visual/experiments/ranger-character-proof/candidate-v1/`:

- `four-facing-contact-sheet.png` — 4× nearest-neighbour view;
- `runtime-scale-sheet.png` — true 1× frames;
- `dark-background-sheet.png` — edge and silhouette review;
- `magenta-sheet.png` — transparency contamination review;
- `anchor-bounds-overlay.png` — bounds and bottom-centre pivot evidence;
- `machine-check-report.json` — deterministic metrics and hashes.

## Visual self-check — not approval

- **Identity consistency:** promising, not exact. The same older child Ranger reads across all four cells, but face shape, cloak drape, bow placement, and quiver size drift slightly.
- **Fixed-camera consistency:** uncertain. The set reads as one diagonal isometric family, but an AI-generated sheet cannot prove one mathematical camera; the rear cells show small pitch/proportion differences.
- **Elevated isometric projection:** likely pass for a source proof. Hair, shoulders, cloak, and feet expose upper planes, though the pitch reads somewhat gentler than the strongest North Star cues.
- **Facing readability:** likely pass. SE/SW show the face; NW/NE read as away-facing diagonals.
- **Upper-left lighting:** likely pass with minor drift. Warm upper-left highlights and darker lower-right forms are present across the set.
- **Silhouette at 1×:** likely pass. Hair, cloak, quiver, bow, boots, and older-explorer read remain visible; small costume details become muddy.
- **Separation from the Mage:** likely pass. Green cloak, bow/quiver, earthy leather, and older/taller silhouette distinguish the Ranger.
- **Foot contact and stability:** static alignment likely pass. Movement stability is not assessed until a real walk strip exists.
- **Pixel treatment:** promising but below final North Star quality. It reads as pixel art at 64×64, yet remains softer, more anime-like, and less deliberately clustered than production-ready HD-2D art.
- **Equipment-side consistency:** uncertain. The quiver remains on the back, but bow/quiver projection shifts enough that animation should not begin until the owner accepts the set or asks for a specific correction.

## Tool and skill evaluation

### Used successfully

- **GitHub connector:** branch/PR work, exact-head inspection, CI, evidence retention, and coordination with PRs #12 and #13.
- **Image generation:** one candidate plus one targeted correction using the attached North Star as primary reference.
- **Game Studio routing:** 3D source handling routed to the 3D asset pipeline; normalized PNGs follow the 2D sprite-pipeline invariants; runtime review remains a game-playtest step after acceptance.
- **Sprite-pipeline rules:** one shared scale, shared bottom-centre anchor, fixed slots, and no frame-by-frame animation generation.
- **Game-playtest rules:** actual 1× and background evidence retained; DOM-only assertions are not treated as visual proof.
- **Hugging Face metadata:** TRELLIS route identified; Track 2(b) established that anonymous hosted execution is quota-blocked.
- **Local deterministic tools:** alpha inspection, component isolation, shared-scale normalization, pivot metrics, contact sheets, and hashes.

### Evaluated but not needed yet

- **Runtime integration:** deferred until owner accepts the static set.
- **GLB optimization/compression:** Track 2(b) proved the rig but no acceptable generated mesh exists.
- **Walk generation:** deliberately deferred to avoid animating an unapproved identity/camera set.

### Blocked or unavailable

- **True TRELLIS mesh generation:** Track 2(b) remains blocked by hosted ZeroGPU quota / missing authenticated capacity. The clean standing source image gap is now substantially reduced by candidate v1, but the access gap remains.
- **Local Blender in this ChatGPT environment:** unavailable; Claude's Track 2(b) machine provided the executable Blender proof.

## North Star alignment

**Intentional interim gap.**

The candidate preserves the North Star's older Ranger role, green-and-leather explorer identity, diagonal isometric read, warm upper-left light, child-friendly adventure tone, and clear Mage separation. It does not yet achieve the North Star's final premium pixel clustering, exact camera certainty, or runtime-context polish. No North Star refresh is recommended.

## Owner review question

Judge only the static set at this gate:

1. **Accept as the identity/camera seed for one four-frame walk proof**, or
2. **Reject with one specific correction target**.

Do not evaluate attack, equipment animation, or runtime integration yet; none has been produced.
