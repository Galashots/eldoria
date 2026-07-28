# Ranger animated-character pipeline proof

**Status:** Static candidate v1 ready for owner review; animation deliberately not started  
**Branch:** `work/ranger-character-pipeline-proof`  
**Scope:** four static Ranger facings at the current review gate; no walk, attack, equipment, enemies, or runtime integration

## Decision gate

**PROOF READY FOR OWNER REVIEW — STATIC FACINGS ONLY.**

The four normalized static facings exist, the source-to-frame pipeline is reproducible, and all applicable machine gates pass. This is not an art approval. A walk strip will not be generated until Leo accepts or rejects this static identity/camera seed.

The iteration limit was respected:

1. one four-facing candidate generated from the attached current Visual North Star;
2. one targeted corrective generation pass requested transparent isolation and crisper treatment;
3. no further image-generation pass was used;
4. remaining low-opacity floor shadow and halo contamination was removed through fixed deterministic alpha thresholds.

## Coordination

- Track 1 is paused at PR #12, head `51421612d6fafefbc14faba014166b873380d205`.
- Track 2(b) is paused at PR #13, head `7f0768d83ca8d1cf99275354d8e4750ac3e47a5c`.
- This branch does not modify `index.html`, so no gameplay or Town integration overlap exists.

## Candidate source

`art/source/characters/ranger-four-facing-source-v001.png`

The committed source is a 384×256, 256-colour indexed archival PNG produced as a deterministic 25% nearest-neighbour copy of the exact 1536×1024 generated output. This bounds repository size while preserving sufficient information for the 64×64 proof. Both source hashes are recorded in the machine report.

Source-cell mapping:

| Source cell | Engine slot | Iso facing |
| --- | --- | --- |
| top-left | `right` | SE |
| bottom-left | `down` | SW |
| bottom-right | `left` | NW |
| top-right | `up` | NE |

The source contains real transparency plus low-opacity floor shadows and halos. The processor removes the contamination with a fixed alpha threshold; it does not manually repaint the character.

## Normalized outputs

- `art/ranger-proof/normalized/adventurer-right.png`
- `art/ranger-proof/normalized/adventurer-down.png`
- `art/ranger-proof/normalized/adventurer-left.png`
- `art/ranger-proof/normalized/adventurer-up.png`

Each output is 64×64 RGBA with binary alpha and a shared bottom-centre foot pivot.

## Deterministic processing

`tools/process-ranger-source.mjs` fixes:

- 2×2 source-cell mapping;
- source alpha threshold `224`;
- one shared scale targeting a maximum visible height of `56` pixels;
- nearest-neighbour resampling;
- resized alpha threshold `128`;
- bottom-six-row opaque centroid aligned to `x=32`;
- visible bounds anchored to `y=63`;
- two-run output and evidence hash comparison.

Commands:

```sh
npm run ranger-source:process
npm run ranger-proof:candidate
npm run ranger-proof:self-test
```

The normal CI command regenerates the candidate before validating it, rather than merely syntax-checking the processor.

## Machine result

Report: `docs/visual/experiments/ranger-character-proof/candidate-v1/machine-check-report.json`

- four 64×64 RGBA frames: pass;
- expected naming and facing order: pass;
- binary alpha: pass;
- visible subject in each frame: pass;
- bottom anchor at row 63: pass;
- horizontal padding: pass;
- visible-height range: 1 px;
- visible-width range: 3 px;
- bottom-band foot-centre range: under 1 px;
- deterministic rerun: pass;
- walk dimensions and movement stability: **not assessed because no walk exists**.

Machine checks do not establish identity, camera, lighting, facing semantics, pixel quality, or North Star alignment.

## Evidence

Committed review evidence:

- `candidate-v1/four-facing-contact-sheet.png` — enlarged nearest-neighbour review sheet;
- `candidate-v1/machine-check-report.json` — metrics and hashes.

The processor and validator also regenerate the true 1× runtime sheet, dark-background sheet, magenta transparency sheet, and anchor/bounds overlay into CI artifacts on every run. They are generated rather than duplicated in Git.

## Visual self-check — not approval

- **Identity consistency:** promising, not exact. The older-child Ranger reads across all cells, but face shape, cloak drape, bow placement, and quiver size drift slightly.
- **Fixed-camera consistency:** uncertain. The set reads as one diagonal isometric family, but an AI-generated sheet cannot prove one mathematical camera.
- **Elevated projection:** likely pass for a source proof. Upper planes of hair, shoulders, cloak, and feet are visible; the pitch is gentler than the strongest North Star cues.
- **Facing readability:** likely pass. SE/SW are toward-facing diagonals; NW/NE are away-facing diagonals.
- **Upper-left lighting:** likely pass with minor drift.
- **Silhouette at 1×:** likely pass. Hair, cloak, bow/quiver, boots, and older-explorer role remain readable; small costume details become muddy.
- **Mage separation:** likely pass through height, green cloak, leather palette, and equipment silhouette.
- **Foot contact:** static alignment likely pass; movement is untested.
- **Pixel treatment:** promising but below final North Star quality. It remains softer and more anime-like than deliberately clustered production HD-2D art.
- **Equipment consistency:** uncertain enough that animation should wait for owner review.

## Tool and skill result

Used successfully:

- GitHub connector for branch, PR, exact-head checks, and CI evidence;
- image generation for one candidate and one bounded correction using the attached North Star;
- Game Studio routing across 3D source work, sprite normalization, and later runtime playtesting;
- sprite-pipeline rules for shared scale, pivot, slots, and preview-first review;
- local deterministic inspection for alpha, bounds, pivots, dimensions, and hashes.

Evaluated but deferred:

- runtime integration;
- walk generation;
- GLB optimization.

Blocked or unavailable:

- authenticated TRELLIS generation remains paused with Track 2(b);
- Blender is unavailable in the ChatGPT container, though Track 2(b) proved the external render rig.

## North Star alignment

**Intentional interim gap.**

The candidate preserves the older Ranger role, green-and-leather explorer identity, diagonal isometric read, warm upper-left light, child-friendly adventure tone, and clear Mage separation. It does not yet meet the final premium pixel-cluster, exact-camera, or runtime-context bar. No North Star refresh is recommended.

## Owner review question

Judge only the static set:

1. **Accept it as the seed for one four-frame walk proof**, or
2. **Reject it with one specific correction target**.
