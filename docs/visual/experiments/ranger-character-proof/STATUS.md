# Ranger animated-character pipeline proof

**Status:** In progress — executable validation harness first
**Branch:** `work/ranger-character-pipeline-proof`
**Base inspected:** `main` at `8fedcafa05d1a98935dbb8746b39e459fba48e49`
**Scope:** four static Ranger facings plus one four-frame walk strip; no attack, equipment, enemies, or runtime integration yet

## Current decision gate

The proof is not visually approved and no generated candidate has been accepted. The current work establishes the deterministic evidence and validation path before visual production.

## Track 1 coordination

At branch creation, no remote branch named `work/iso-town-phase2-slice` and no open Town Phase 2 PR were visible. This branch does not modify `index.html`; it is isolated to proof tooling and documentation until runtime integration is justified.

## Repository contract recovered

- Engine mapping: `right` → SE, `down` → SW, `left` → NW, `up` → NE.
- Target static frame: 64×64 RGBA.
- Target walk strip: four 64×64 frames in one 256×64 horizontal strip.
- Shared bottom-centre foot pivot.
- One fixed orthographic camera and fixed upper-left light; character rotates under the camera.
- Visual semantics such as identity, camera quality, lighting, and North Star alignment require human image review and cannot be awarded by pixel metrics.

## First executable artifact

`tools/ranger-proof.mjs` provides:

- deterministic synthetic self-test fixtures;
- four-facing and walk-strip dimension checks;
- alpha, visible-bounds, bottom-anchor, horizontal-padding, scale-consistency, and walk-stability checks;
- facing-order and source-hash reporting;
- byte-stable evidence regeneration check;
- generated contact sheet, 1× runtime sheet, dark-background sheet, anchor/bounds overlay, walk preview, and machine-readable JSON report.

The self-test is wired into `npm test` so the exact PR head proves the harness in the repository environment.

## Tool and skill evaluation

### Used successfully

- **GitHub connector:** inspected current repository instructions, charter, engine/pipeline contracts, PR #7 pipeline, active branches/PRs, and created the bounded branch.
- **Game Studio routing:** classified source-model/GLB concerns under `web-3d-asset-pipeline`, final PNG/strip normalization under `sprite-pipeline`, and runtime visual verification under `game-playtest`.
- **Hugging Face repository metadata:** confirmed `microsoft/TRELLIS-image-large` is an MIT-licensed image-to-3D model with demo Spaces; confirmed `stabilityai/stable-fast-3d` is image-to-3D but gated.
- **Local deterministic tools:** authored and syntax-checked the proof validator. Full self-test execution is delegated to repository CI because the isolated local container does not have the repo's Puppeteer package installed.

### Evaluated but not yet needed

- **Runtime integration:** intentionally deferred; the proof can validate candidate PNGs without touching `index.html` or conflicting with Track 1.
- **GLB optimization/compression:** relevant after an actual source model exists, but premature for the first visual candidate.

### Blocked or unavailable

- **Hugging Face search/jobs endpoints:** connector discovery exposed them, but calls returned tool-not-found errors. Model metadata lookup works; an executable hosted image-to-3D route was not established through the connector.
- **Image generation using the approved North Star as an edit/reference:** the generation tool requires the exact image to be attached in the current conversation. The authoritative image exists in the repository and File Library, but the binary could not be opened through the current GitHub/File Library bridge. Minimum owner action: attach `docs/visual/eldoria-visual-north-star-v1.png` in the Track 2 conversation. Do not substitute an unrelated reference.
- **Local full harness run:** blocked only by missing local `puppeteer`; CI has the pinned repository dependency and is the intended execution environment.

## Next bounded action

1. Pass the new harness through CI.
2. Obtain the exact approved North Star image as a current-conversation attachment.
3. Generate one four-facing Ranger candidate only.
4. Normalize it through the harness and stop for owner visual judgment.

## North Star alignment

**Intentional interim gap.** The work preserves the North Star rules and creates no visible game change. It prepares machine evidence for a future candidate while explicitly reserving camera, identity, lighting, pixel treatment, and visual acceptance for non-author review and owner judgment.
