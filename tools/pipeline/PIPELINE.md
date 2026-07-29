# Eldoria Asset Pipeline v2 — PixelLab + deterministic post-process

**Status: adopted 2026-07-29 via merged PR #15 at reviewed head `1c6be80d672609923647150fdd28413015269019`.**

This is the consolidated asset pipeline for Realm of Eldoria's 2.5D relaunch.
It replaces the generation stages of the two earlier pipeline docs and keeps
their proven parts:

| Earlier doc | What happens to it |
|---|---|
| `tools/SPRITE_PIPELINE.md` (ChatGPT + magenta key, 32×32 top-down) | Still valid for the live top-down game. Its **deterministic post-process** idea carries into v2 unchanged. |
| `tools/3D_ISO_SPRITE_PIPELINE.md` (TRELLIS → Mixamo → Blender) | Generation stages **superseded** — probed on PR #13 and blocked (TRELLIS quota/input gaps; blockout quality far below North Star). Its **engine contract** (§3) and camera constants carry into v2 unchanged. |

## Decision record (2026-07-28)

Options weighed for producing character facings + animation frames:

1. **PixelLab API** *(chosen)* — purpose-trained pixel-art models with
   first-class 4/8-direction characters, rotation of existing sprites,
   template/text/skeleton animation, palette forcing, isometric flag, and
   diagonal directions that map 1:1 onto our engine slots. Credit-priced
   (~$0.012 per 64×64 4-direction character; cents per animation). Official
   REST API + Python SDK + MCP server. Eldoria's repo-local calibration found
   it the strongest tested route for rotations + animation.
2. **Retro Diffusion API** — output-quality leader for single images; weaker
   rotation/animation story. Kept as an optional *base-image* source later;
   not needed for v1.
3. **Local Stable Diffusion + ControlNet** — evaluated for this machine
   (GTX 1060 6 GB, 16 GB RAM): SD1.5-class only, LoRA training impractical,
   days of tuning to reach what hosted purpose-trained models do out of the
   box for cents. **Rejected.** Local image-to-3D (TRELLIS-class) needs
   ≥16 GB VRAM — **not feasible at all** on this hardware.
4. **ChatGPT-only art** (status quo) — remains the **identity/North-Star
   authority** and the source of hero concept art, but rotations and
   animation frames by hand-prompting were the reliability pain point this
   pipeline exists to remove.

## The pipeline

```
IDENTITY (human + ChatGPT, North Star controlled)
   concept / approved sprite  ── ChatGPT stays visual-direction lead
        │
        ▼
GENERATE (PixelLab API, scripted, pennies)          tools/pipeline/pixellab_client.py
   pixelate    HD art → pixel art             (/image-to-pixelart)
   create4     4 facings from description     (/create-character-with-4-directions)
   rotate      approved sprite → other facing (/rotate)
   animate     walk/attack frames             (/animate-character)
        │   raw PNGs → _probe_local/pipeline/<name>/raw/   (never committed)
        ▼
NORMALIZE (deterministic, local)                    tools/pipeline/normalize_sprite.py
   premultiplied-alpha downscale → 64×64, binary alpha, foot pivot row 63,
   one shared scale per profile, 256×64 walk strips
        │
        ▼
VALIDATE (machine gates, exit code)                 tools/pipeline/validate_sprites.py
   size / alpha / anchor / padding / scale spread / walk stability
        │
        ▼
REVIEW (human + North Star)   →   commit to assets/
```

The generate stage is swappable by design — if PixelLab disappoints, the
normalize/validate contract doesn't change; only the client does.

## Camera + direction mapping (locked)

Engine slots map to PixelLab directions with `--isometric`:

| Engine slot | Iso facing | PixelLab direction |
|---|---|---|
| `right` | SE | `south-east` |
| `down`  | SW | `south-west` |
| `left`  | NW | `north-west` |
| `up`    | NE | `north-east` |

PixelLab `view` is `low top-down`. Note on the projection constant: 26.565°
(= atan 0.5) is the **screen slope of the 2:1 diamond edge** carried over
from the prior 3D contract — it is not, without qualification, a camera
elevation. Whether `low top-down` sits correctly on the engine's 64×32
diamonds is a **visual calibration gate** (in-game screenshot against the
grid), not something the machine gates check — see checklist below.

Walk animation is **4 frames** at `WALK_FRAME_MS=110`; the engine resets
`walkFrame` to 0 when stationary, so **frame 0 must be the standing pose** and
frames 0/2 are the same stand pose (stand, step A, stand, step B). If a
generated cycle returns 4 distinct poses, keep frames {stand, A, stand-copy, B}.

**`animate --frames N` returns N+1 files per direction, not N.** PixelLab's
`/animate-character` request schema (`keep_first_frame`, default `true`)
keeps the reference frame as `frame_000` alongside the `N` generated frames —
setting it `false` would strip the reference and store exactly `N`, but our
Python client does not expose that flag yet, and `frame_000` doubling as the
engine's required stand pose is desirable anyway, so leave it. Curate the
4-frame `{stand, A, stand-copy, B}` set from the 5 raw files as:
`walk-0=frame_000, walk-1=frame_001, walk-2=frame_000 (duplicated),
walk-3=frame_003`. Frames 001 and 003 were the consistently clearest "step"
poses across every direction/character checked 2026-07-29 (Ranger, Mage); 002
and 004 read closer to a passing/return-to-neutral pose. This is a reproducible,
evenly-spaced rule (1st and 3rd of four generated frames) — not a
per-character subjective pick.

## Setup (one-time, ~2 minutes)

1. Create an account at <https://pixellab.ai/account> (free trial: 40
   generations, no credit card) and copy the API token.
2. Save it to `_probe_local/pixellab.token` (gitignored) or set
   `PIXELLAB_SECRET`.
3. `python tools/pipeline/pixellab_client.py balance` should print credits.

## Commands (Ranger example)

```bash
# IDENTITY ROUTE (proven): concept -> <=256px -> v3 reference rotation
python -c "from PIL import Image; Image.open('art-incoming/ranger-concept-v1.png').convert('RGBA').resize((256,256), Image.LANCZOS).save('_probe_local/pipeline/ranger/ref-256.png')"
python tools/pipeline/pixellab_client.py create-v3 \
  --description "older ranger adventurer, weathered green hooded cloak, leather bracers, longbow and quiver" \
  --reference-image _probe_local/pipeline/ranger/ref-256.png --seed 11 \
  --out-dir _probe_local/pipeline/ranger
# -> 8 rotations; keep the 4 diagonals for the engine slots

# DESCRIPTION ROUTE: 8 directions (create4 yields cardinals only — do not
# use it for the engine's diagonal facings; its `directions` field is
# per-direction REFERENCE IMAGES, not a selector)
python tools/pipeline/pixellab_client.py create8 \
  --description "..." --size 64 --isometric --seed 11 \
  --out-dir _probe_local/pipeline/cast/NAME

# walk cycle for a created character (id in character.json; one job per
# direction). KNOWN CLIENT GAP: finish_async only auto-downloads when the API
# RESPONSE itself contains character_id — /animate-character's response only
# has background_job_ids, so nothing downloads after polling. Always follow
# with the `character` subcommand (below) to fetch the zip. Not yet fixed in
# pixellab_client.py; PIPELINE.md previously claimed otherwise, which was
# false (corrected 2026-07-29).
python tools/pipeline/pixellab_client.py animate \
  --character-id <id> --action "walking with a steady stride, legs stepping, arms swinging naturally" \
  --frames 4 --isometric --seed 11 \
  --directions south-east,south-west,north-west,north-east \
  --out-dir _probe_local/pipeline/ranger-walk
python tools/pipeline/pixellab_client.py character \
  --id <id> --out-dir _probe_local/pipeline/ranger-walk

# UNTESTED, RECOMMENDED NEXT EXPERIMENT: PixelLab's own template library
# (mode=template, e.g. --template-id walk / walking / walk-1..10 / crouched-walking)
# is skeleton-driven and priced at 1 generation/direction — a fraction of the
# ~3 gen/direction custom v3 cost above — and should be far less prone to the
# hallucination failure below since motion is constrained to a rig rather than
# invented from free text. `keep_first_frame`, `custom_start_frame`, and
# `end_frame` are explicitly NOT supported in template mode, so the frame_000
# =stand convention above needs separate verification before adopting this
# route. The full live template-ID list is intentionally not copied here (the
# vendor's own OpenAPI description truncates it, and it can change) — pull it
# fresh from the PixelLab MCP docs or interactive docs before relying on it.
python tools/pipeline/pixellab_client.py animate \
  --character-id <id> --template-id walk --isometric \
  --directions south-east,south-west,north-west,north-east \
  --out-dir _probe_local/pipeline/ranger-walk-template

# arrange raw frames as <slot>.png / <slot>-walk-<i>.png, then:
python tools/pipeline/normalize_sprite.py \
  --source _probe_local/pipeline/ranger/raw \
  --out _probe_local/pipeline/ranger/normalized --profile adventurer

# --require-walks whenever validating a character that walks: without it a
# missing walk strip would not fail the run
python tools/pipeline/validate_sprites.py \
  --dir _probe_local/pipeline/ranger/normalized --profile adventurer \
  --require-walks
```

Add `--dry-run` before the subcommand's flags to print the exact request
without spending credits. Add `--seed` for reproducible generations.

## First-run calibration checklist

Run once with trial credits before trusting the pipeline:

- [ ] `create4` with the four diagonal directions → do the sprites read as
      SE/SW/NW/NE at our camera, feet at a shared pivot?
- [ ] `low top-down` vs `high top-down` → which sits better on the 64×32
      diamonds in-game? (Screenshot both over the town map.)
- [ ] `animate --frames 4 "walking"` → is frame 0 a stand pose? If not,
      reorder to {stand, A, stand, B} before normalizing. **Always eyeball the
      raw walk sheet before normalizing** — a hallucinated prop/companion or
      artifact is a valid, gate-passing PNG; only your eyes catch it.
- [ ] Try `animate --template-id walk` (skeleton-based, 1 gen/direction)
      before spending more on custom-text walks — untested as of 2026-07-29,
      but plausibly the fix for the hallucination trap below at a third of
      the cost.
- [ ] Palette: does output need `--color-image` (North Star palette swatch)
      + `--force-colors` to stay on-palette?
- [ ] `rotate` from PR #11's approved down-facing Ranger → does identity
      survive rotation? If yes, this becomes the preferred route (identity
      stays ChatGPT/North-Star-controlled; PixelLab only turns the character).
- [ ] Normalize + validate → all gates pass → screenshot in-game at 1× and
      compare against the North Star.

## Calibration results (2026-07-28, run on trial + Tier 1)

- **Identity rotation: PASS.** `/rotate` on PR #11's approved SE Ranger → SW
  kept hair, cloak, palette, proportions and pose; moved the bow to the
  correct hip. The identity-preserving route is viable.
- **Walk from reference: PASS with caveats.** `animate-with-text` (reference
  image + "walking", 4 frames) held identity, but frame 0 is not guaranteed
  to be a stand pose and small gear details wobble between frames. Fix: pin
  frame 0 via `init_images` (client TODO) and expect to curate frames.
- **Machine gates caught a real defect:** the rotated SW came back 6 px
  shorter than the SE source → G5 height-spread FAIL. Reroll or nudge with
  `init_image` when this happens; do not relax the gate.
- **`create4` facings are CARDINAL** (pure front/side/back), even with
  `isometric: true` — not the 3/4 diagonals our camera wants. For diagonal
  facings use `create-character-with-8-directions` and keep the 4 diagonals.
  Also: `isometric: true` outputs a 92×92 canvas, not 64 — harmless, the
  normalizer downscales.
- **`directions` param is reference images per direction** (provide some
  facings, the AI generates the rest) — not a direction selector. This is the
  identity-preserving input for hero characters.
- Description-only generation quality is high (Mage candidate, seed 11).

**Round 2 (same day, hybrid ChatGPT + PixelLab):**

- **`create-character-v3` with `reference_image` is the identity route.**
  Fed the ChatGPT Mage concept (downscaled to the 256×256 cap, LANCZOS), it
  produced 8 rotations that kept the staff + glowing crystal, satchel, trim,
  hair and scale in every frame. Decisively better than `--direction-ref`
  on `create8`, which uses the south reference as-is but loses props and
  scale in the generated frames.
- **Default mannequin template makes every creature humanoid** (slime-person,
  bat-man). Quadrupeds: `--template-id bear/cat/dog/horse/lion`. Blobs,
  slugs, serpents, flyers: `--mode pro` (20–40 gens each).
- Full identity chain, proven end-to-end: ChatGPT concept (flat light-grey
  bg, ¾ front, full body) → 256² → v3 rotation → keep 4 diagonals →
  normalize → validate.

**Round 3 (landscape, after reading PixelLab's map-tiles guide):**

- **Terrain production route is `/create-tiles-pro`**, not single isometric
  tiles: `tile_type=isometric`, `tile_size=64`, `tile_flat_top_px=2`
  (classic pointed diamond = engine shape), numbered variations in one
  call, `tile_feature=tileset` for 16-tile terrain *transitions* with
  machine-readable placement rules, `roads` for path autotiles, `building`
  for wall/floor construction kits, `style_images` for cross-batch style
  lock. Single `/create-isometric-tile` calls are style probes only; the
  default `isometric_tile_shape` is a tall "block" — pass "thin tile".
- PixelLab's guide workflow for maps is init-image + overlapping inpainting
  (never inpaint the whole selection; describe the middle of the selected
  area) — relevant when we compose full map scenes rather than tiles.

**Round 4 (2026-07-29, hero v3 rotations + walks, then a full PixelLab MCP/API
docs review):**

- **Walk-generation hallucination trap, confirmed real:** a bare
  `--action "walking"` on the Ranger v3 character mutated the bow/quiver into
  a growing animal-companion-like object (SE/SW) and added dashed
  projectile-trail artifacts (NW) — while the *Mage's* bare `"walking"` run
  from the identical endpoint came out clean. This is **stochastic risk, not
  a deterministic property of the bare action.** Fix used: an explicit action
  description + fixed seed (`"walking with a steady stride, legs stepping,
  arms swinging naturally"`, `--seed 11`) produced a clean retry — mitigation,
  not a proven guarantee. Every failed frame was still a valid, correctly
  sized, alpha-clean PNG: **machine structure gates cannot catch this failure
  class.** Raw direction-labelled walk sheets must get human visual
  inspection before normalization, every time.
- **Animation sets append server-side**, named after the slugified action
  description (e.g. `animations/walking/` vs.
  `animations/walking_with_a_steady_stride_legs_stepping_arms_sw/`). A bad set
  is never removed from the character — future ZIP downloads must select the
  correct folder by name.
- **Seeds are not recorded in server-side `character.json`** (it stores id,
  prompt, view, directions, status — no seed). The exact command used is the
  only durable record; keep it in a batch script or session log.
- **G5 width-spread gate caught a second real defect** (the first was the
  6 px `/rotate` height shrink above): the Ranger v3 rotation set measured
  35 px opaque-bbox width facing `right` (bow held out to the side) vs. 25 px
  facing `up` (bow tucked, back-ish view) — a real 10 px per-direction
  silhouette difference from equipment posture, exceeding the 8 px limit.
  Reported as a gate FAIL, not loosened or forced through; a reroll or
  mirror-repair decision is an owner/lead call, not something to self-resolve.
- **Confirmed from PixelLab's own MCP tool docs** (`api.pixellab.ai/mcp/docs`,
  reviewed 2026-07-29) and the live OpenAPI spec
  (`api.pixellab.ai/v2/openapi.json`):
  - `keep_first_frame` (default `true`) is the exact mechanism behind the
    "N+1 files per direction" behavior noted above — see the walk-cycle note
    earlier in this file.
  - Official confirmation of our create-v3-over-create8 identity decision:
    for a character sprite, v3 reference-image mode "reproduces the input
    faithfully," while 8-direction *object* rotation "can lose the salience
    contest" when multiple reference elements compete — validates Round 2's
    finding, now with PixelLab's own stated reason.
  - **`mode="template"` with `template_animation_id`** (e.g. `walk`,
    `walking`, `walk-1..10`, `crouched-walking`, `sad-walk`, `scary-walk`,
    plus non-walk templates like `attack`, `backflip`, `breathing-idle`) is
    skeleton-based and priced at **1 generation/direction** — far cheaper
    than the custom v3 route used above (~3 gen/direction) and, being
    rig-constrained rather than free-text-driven, plausibly immune to the
    hallucination trap. **Not yet tested in this pipeline** — recommended as
    the first experiment before spending more custom-text walk generations.
    Our client already supports it end-to-end via `animate --template-id`
    (added earlier, never exercised until this review).
  - `enhance_prompt=true` (on both `create-character-v3` and
    `animate-character`) auto-expands a terse description/action into a
    richer one server-side for +0.05 generations — a cheaper alternative to
    hand-writing a fix like the steady-stride phrase above, though it is
    still free-text-driven so it likely mitigates rather than eliminates the
    hallucination risk. Untested here.
  - `reference_image`/`reference_image_url` should be preferred over inline
    base64 "for anything above ~32×32" when going through an MCP client —
    PixelLab's own docs warn MCP transports "routinely truncate large inline
    base64." Our Python client posts directly to the REST API (not through
    an MCP transport), so this specific truncation risk does not apply to it;
    it matters if/when agents drive PixelLab through the MCP server instead
    (see `tools/pipeline/PIXELLAB_MCP.md`).

## Cost reality

At list prices a full character (4 facings + 4-direction walk + attack) is
roughly **$0.05–0.30**. The entire cast of Eldoria is a few dollars. The free
trial covers the whole calibration checklist.

## North Star alignment

This PR establishes **process, not art** — no visible game change, no change
to the visual direction. Alignment is enforced structurally: identity stays
with ChatGPT (standing visual-direction lead), the palette can be forced from
a North Star swatch, the size/alpha/anchor/scale contract is pinned in the
normalize/validate gates (camera and facing correctness remain **visual**
review gates), and nothing reaches `assets/` without the human + North Star
review step. First generated art must be reviewed against
`docs/VISUAL_NORTH_STAR.md` before commit, per repo `CLAUDE.md`.
