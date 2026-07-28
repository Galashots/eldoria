# Ranger TRELLIS/Blender feasibility probe — Track 2(b)

**Outcome:** `3D ROUTE BLOCKED BY IDENTIFIED TOOL/ACCESS GAP`
**Limiting factor:** tool availability (Hugging Face ZeroGPU quota). Secondary: visual quality of the local fallback source model.
**Branch:** `work/ranger-trellis-blender-probe`
**Base:** `main` at `8fedcafa05d1a98935dbb8746b39e459fba48e49`
**Scope:** Ranger only. Four static facings plus one four-frame walk strip for one facing. No attack, no equipment, no enemies, no eight facings, no runtime integration.

## One-paragraph answer

Everything downstream of the source model works and is reproducible on this machine: a scripted Blender 4.2 scene renders four correct isometric Ranger facings and a four-frame walk in ~16 seconds, and its normalized 64×64 output passes every machine gate in the Track 2 mainline harness. The blocker is upstream. TRELLIS is reachable but refuses to run image-to-3D on an anonymous account, so no genuine generated source mesh exists. The scripted blockout that stands in for it is legible but clearly below the North Star's premium pixel-art bar. **The probe proves the rig, not the character.**

## Tool report — what was actually available

| Tool | Status | Detail |
|---|---|---|
| Blender 4.2.22 LTS | **Worked** | `C:\Users\Leo\blender42\blender-4.2.22-windows-x64\blender.exe`. Headless render of 8 frames at 512×512 in ~16 s. Blender 5.x is known not to start on this Windows 10 machine — stay on 4.2 LTS. |
| Python 3.10.11 + Pillow 9.5 + numpy 1.26 | **Worked** | Used for the premultiplied-alpha normalization step. Blender's bundled Python has no Pillow, hence the two-script split. |
| `gradio_client` 2.5.0 | **Worked** | Installed and current. |
| TRELLIS.2 HF Space — reachability | **Worked** | `microsoft/TRELLIS.2`; `/start_session` and `/preprocess_image` both succeeded anonymously. The route is live and the API shape in Ninja Merge Academy's `generate_trellis.py` is still correct. |
| TRELLIS.2 HF Space — `/image_to_3d` | **BLOCKED** | `AppError: You have exceeded your ZeroGPU quota (120s requested vs. 173s left). Try again in 23:57:01.` Failed identically at `--resolution 1024` and at `--resolution 512`. No `HF_TOKEN` is set on this machine and no token file exists at `~/.cache/huggingface/token`. |
| Clean Ranger concept image | **Not available** | Pipeline Stage A wants a full-body ¾-front character on a plain background. No such asset exists in this repo, and no image-generation tool was available in this session. The only Ranger reference is the North Star scene itself. |
| Node 24 + puppeteer 25.4 | **Worked** | Used to run the Track 2 mainline validator unchanged. |
| Mixamo auto-rig | **Not attempted** | Needs an Adobe login and a browser session; out of probe scope. The walk here is hand-authored in the render script instead. |

### The TRELLIS input problem (independent of quota)

Even with a token, the input I could assemble is poor. The only Ranger in the repository is the crouching figure in `docs/visual/eldoria-visual-north-star-v1.png` — occluded by pumpkins, cropped by the planter box, seen from three-quarter rear, and only ~180 px tall in the source. TRELLIS's own preprocessor accepted it, but a crouching, half-hidden input produces a crouching, half-hallucinated mesh, which cannot be rotated into four standing facings.

**So the access gap is really two gaps, and the token only clears one.** A real attempt needs both an `HF_TOKEN` *and* a clean full-body ¾-front Ranger concept image.

## What was built and does work

### A. Source-model feasibility — route 1 attempted, blocked; route 2 executed

Priority order was followed. Route 1 (TRELLIS) got one primary attempt and one focused corrective attempt (lower resolution to reduce the GPU-seconds request); both hit the same quota wall, so the iteration limit was respected and the route was abandoned rather than faked. Route 2 (Blender blockout) was then executed end to end.

`tools/3d/ranger_iso_scene.py` builds the Ranger procedurally from primitives — no `.blend` binary, no committed mesh. Identity cues are taken from the North Star Ranger crop: brown tousled hair, green hooded cloak with a gold hem, brown leather jerkin and bracers, back quiver with arrows, slung bow, tall boots, blue eyes. The palette constants record the exact sampled pixel coordinates.

### B. Fixed scene setup — recorded

| Setting | Value | Why |
|---|---|---|
| Camera type | Orthographic | Perspective breaks tile alignment. |
| Elevation | `atan(0.5)` = **26.565051°** | The engine uses 64×32 diamonds (2:1), not "true" 30° isometric. |
| Azimuth | **45°** | |
| Ortho scale | **2.35** world units across the frame | Character authored 1.90 units tall. |
| Camera location | `(target + toward·16)`, target `(0, 0, 0.95)` | Distance is framing-neutral in ortho; it only sets clipping. |
| Camera rotation | `(63.435°, 0°, 45°)` | Places the camera at `(+X, −Y, +Z)`. |
| Render resolution | **512×512**, downscaled 8× to 64 | Supersampling for clean edges. |
| Transparency | `film_transparent = True`, RGBA, 8-bit | |
| View transform | **Standard** (not AgX) | A film curve desaturates the pixel-art palette. |
| Engine / samples | EEVEE Next, 64 TAA samples | |
| Key light | Sun, screen-space upper-left `(−1, +1, 0.35)`, colour `(1.00, 0.94, 0.82)`, energy 5.4, angle 6° | North Star: "warm upper-left light, down-right shadows". |
| Fill light | Sun, screen `(0.9, −0.25, 0.6)`, cool `(0.72, 0.80, 1.00)`, energy 1.6, angle 45° | |
| Rim light | Sun, screen `(0.55, 0.85, −1.0)`, energy 2.6, angle 12° | |
| World ambient | `(0.30, 0.36, 0.44)` at strength 0.45 | Keeps shadow sides readable. |

Light directions are declared in **screen space** and converted against the camera basis, so the key light stays upper-left even if the camera constants are retuned later.

### Facing rotation values

The camera is stationary; the character root rotates under it.

| Engine slot | Grid dir | Iso facing | Root yaw | World heading | Expected read | Observed |
|---|---|---|---|---|---|---|
| `right` | +col | SE | **+90°** | +X | face | face ✅ |
| `down` | +row | SW | **0°** | −Y | face | face ✅ |
| `left` | −col | NW | **−90°** | −X | back | back ✅ |
| `up` | −row | NE | **+180°** | +Y | back | back ✅ |

The model is authored facing −Y, so `down` is the identity rotation. The pipeline doc's sanity check (`down`/`right` must show the face, `up`/`left` the back) passes, which confirms the yaw sign is not flipped.

### C. Four static facings — rendered and normalized

Large source renders are 512×512 RGBA with a transparent background. Normalized outputs are 64×64 RGBA under `normalized/`, produced by `tools/3d/normalize_ranger_proof.py`.

Normalization notes worth keeping:
- Downscale is done in **premultiplied alpha**. Naive RGBA resizing blends edges toward transparent black and leaves a dark fringe once alpha is thresholded to binary — very visible at 64 px.
- One shared crop window and one shared scale factor across all eight frames, so facings cannot drift in size.
- Each frame is bottom-anchored on its own lowest opaque row (the foot pivot the engine draws from) and centred on the shared union centre.

### D. Walk test — produced

Four frames, `right`/SE only, packed into a 256×64 strip. Hand-authored in the render script (contact/passing/contact/passing) rather than rigged, matching `WALK_FRAME_MS = 110` in `index.html`.

### E. Validation — passed

The Track 2 mainline validator was run **unchanged and uncommitted** from a scratch copy of `origin/work/ranger-character-pipeline-proof:tools/ranger-proof.mjs`. No duplicate validator was added to this branch.

```
Ranger proof machine gates passed; deterministic=true
```

| Gate | Result |
|---|---|
| `statics` (64×64, binary alpha, visible, bottom-anchored, padded) | pass |
| `walkDimensions` (256×64) | pass |
| `walkFrames` | pass |
| `scaleConsistency` | pass — height range 2 px, width range 6 px |
| `walkStability` | pass — centre range 1.5 px, top range 2 px |
| Deterministic rerun | pass |

**This is the first time that harness has run against real rendered art rather than its synthetic self-test fixtures.** That is a genuine result for Track 2: the harness works on real input, and the 3D→normalize path can satisfy it.

### `npm test` — pre-existing failure on `main`, not caused by this probe

`npm test` fails at its first step, `assets:build`:

```
Error: corn committed pixels differ at 139,37
  at tools/process-crop-sheet.mjs
```

I verified this is a red baseline, not a regression: checking out clean `main` (`8fedcaf`) in a throwaway worktree and running `node tools/process-crop-sheet.mjs` reproduces the identical error. This probe touches only `.gitignore` and two new directories; `process-crop-sheet.mjs` reads `art/source/crops/crop-family-source.png` and writes `assets/iso/`, neither of which this branch modifies.

Flagging it for whoever owns Track 2 mainline. I have **not** fixed it — it is outside this probe's scope and touching `assets/iso/` would collide with the isometric slice work.

## Honest visual assessment — where this fails

The machine gates say nothing about whether it looks right. It does not.

- At true 1× runtime scale the figure is a muddy brown-and-green blob. Silhouette and facing are readable; the character is not.
- The head is a featureless ball. The face is a small skin patch with two blue dots — no nose, mouth, or brow.
- There is no pixel treatment at all: no palette quantization, no outline pass, no hand cleanup. It is a raw 3D downscale, which is exactly what the North Star's "premium, crisp pixel art with HD-2D depth" is not.
- Read is younger and dumpier than "the older adventurer". It does not yet sit as a credible elder brother to the Mage.
- First render was worse: the cloak was a bell that swallowed the arms and legs, and the hair fringe projected as a beak. The single corrective pass (narrower/shorter cape, arms pushed outboard, flatter fringe, smaller bow, brighter warmer key) fixed the silhouette but could not fix the fidelity ceiling of a primitive blockout.

**Conclusion: a scripted-primitive blockout is a fine stand-in for proving a render rig and a normalization contract. It is not a viable route to North Star character art.** The generated-mesh step is load-bearing, and that is the step that is blocked.

## Reproduce

```bash
git checkout work/ranger-trellis-blender-probe

# 1. Source renders (four facings + four walk frames), ~16 s
"C:/Users/Leo/blender42/blender-4.2.22-windows-x64/blender.exe" -b --python-exit-code 7 \
  -P tools/3d/ranger_iso_scene.py -- --out _probe_local/renders --walk

# 2. Normalize to the 64x64 engine contract
python tools/3d/normalize_ranger_proof.py \
  --source _probe_local/renders/source \
  --out docs/visual/experiments/ranger-trellis-blender-probe/normalized

# 3. Validate with the Track 2 mainline harness (scratch copy, not committed here)
mkdir -p _probe_local/harness/tools
git show origin/work/ranger-character-pipeline-proof:tools/ranger-proof.mjs \
  > _probe_local/harness/tools/ranger-proof.mjs
node _probe_local/harness/tools/ranger-proof.mjs \
  --input-dir  "$(pwd)/docs/visual/experiments/ranger-trellis-blender-probe/normalized" \
  --output-dir "$(pwd)/docs/visual/experiments/ranger-trellis-blender-probe/evidence" \
  --walk-direction right
```

To retry the blocked TRELLIS leg once a token exists:

```bash
export HF_TOKEN=hf_...   # never commit this
python /c/Users/Leo/Desktop/ninja-merge-academy/tools/image_to_3d/generate_trellis.py \
  --image <clean full-body 3/4-front Ranger concept>.png \
  --out _probe_local/ranger-trellis-raw.glb --resolution 1024 --seed 42
```

`_probe_local/` is gitignored. Raw 512 px renders, TRELLIS inputs and any `.glb`/`.blend` intermediates stay local; only the normalized PNGs and evidence sheets are committed.

## Evidence

| File | What it shows |
|---|---|
| `evidence/source-render-contact-sheet.png` | Large source renders, four facings |
| `evidence/source-walk-contact-sheet.png` | Large source renders, four walk frames |
| `evidence/four-facing-contact-sheet.png` | Normalized 64×64 at 2× |
| `evidence/runtime-scale-sheet.png` | Normalized at true 1× — the honest in-game read |
| `evidence/dark-background-sheet.png` | Transparency check on `#11131a` |
| `evidence/anchor-bounds-overlay.png` | Foot-anchor and bounds overlay |
| `evidence/walk-strip-preview.png` | Four-frame walk |
| `evidence/machine-check-report.json` | Machine report, all gates, hashes |
| `normalized/*.png` | The five contract-shaped PNGs |

## What the owner has to decide

The probe cannot proceed further without one of these, and I cannot supply either:

1. **A Hugging Face token** (`HF_TOKEN`) — free account gives roughly one model per day, PRO roughly twelve. This clears the quota wall.
2. **A clean full-body ¾-front Ranger concept image** on a plain background, in North Star identity — the input TRELLIS actually needs. Without it, a token alone still yields a crouching, occluded mesh.

My recommendation is to treat these as one request, not two, because either alone leaves the route blocked.

## Track 2 coordination

- Does **not** modify `index.html`. No runtime integration, no gameplay change.
- Does **not** duplicate or modify `tools/ranger-proof.mjs`; the mainline validator was run unchanged from an uncommitted scratch copy.
- No overlap with `work/iso-town-phase2-slice` (no world, tile, or camera-runtime files touched).
- Complements `work/ranger-character-pipeline-proof` (PR #11) rather than competing: PR #11 proved the harness against synthetic fixtures, this probe supplies the first real renders that harness has ever validated.
- New paths only: `tools/3d/`, `docs/visual/experiments/ranger-trellis-blender-probe/`, plus one `.gitignore` entry.

## North Star alignment

**Intentional interim gap.**

The probe establishes the route — fixed 2:1 orthographic camera at 26.565°, warm upper-left key with down-right shadows, transparent alpha, shared foot pivot, deterministic regeneration — all of which are North Star qualities expressed as reproducible constants rather than as art. It deliberately does **not** claim the "premium, crisp pixel art with HD-2D depth" quality or the Ranger's identity read; the committed figure is a blockout stand-in and is visibly short of that bar, as documented above.

No visible game change is introduced, the visual direction is unchanged, and no North Star refresh is recommended.
