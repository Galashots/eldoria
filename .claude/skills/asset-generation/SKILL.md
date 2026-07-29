---
name: asset-generation
description: Generate Eldoria character sprites end-to-end (concept -> PixelLab -> normalize -> validate -> review). Use for any request to create or update character/enemy/NPC art.
---

# Eldoria asset generation

Follow these steps exactly. Every command runs from the repo root
(`C:\Users\Leo\Desktop\eldoria-public`). **Always `Set-Location` / `cd` to the
repo root first — background jobs and other tools change the cwd.** Do not
improvise endpoint parameters; the decision table below encodes tested
behavior (calibrated 2026-07-28, walk-animation guidance added 2026-07-29,
see `tools/pipeline/PIPELINE.md`).

Read `tools/pipeline/PIXELLAB_MCP.md` before using PixelLab MCP tools. If
PixelLab MCP is connected, it is an interactive front end to the same service;
it does not replace Eldoria's routes, local normalization/validation, review
sheet, North Star review, or owner approval. If MCP is unavailable, continue
with the proven Python client below.

**Vendor behaviour lives in one place.** Costs, sizing, the identity route,
repair techniques, and API-vs-web-tool traps are in
[`tools/pipeline/PIXELLAB_API.md`](../../../tools/pipeline/PIXELLAB_API.md) and
the portable `pixellab` skill. **Read those before your first call** — they are
what stop a 64×64 sprite being billed at 256×256. This file is the Eldoria
run-book: engine contract, commands, gates, review. Where they overlap, the repo
docs win.

## 0. Preconditions

1. `python tools/pipeline/pixellab_client.py balance` must print a
   subscription. If it errors: the token lives in
   `_probe_local/pixellab.token` (one line). If the file is missing but
   `_probe_local/pixellab.token.txt` exists, rename it (Notepad adds `.txt`).
   If the token is invalid, ask Leo for a fresh one from
   https://pixellab.ai/account — do NOT create accounts or credentials.
   The shared `.mcp.json` reads the same token from the local
   `PIXELLAB_SECRET` environment variable; never commit its value.
2. For any visually relevant work, open `docs/VISUAL_NORTH_STAR.md` and
   include a **North Star alignment** note in your report (repo CLAUDE.md).

## 1. Choose the route (by character type)

| Character type | Route |
|---|---|
| Hero / boss / named NPC (identity matters) | ChatGPT concept first (§2), then v3 reference rotation (§3a) |
| Simple humanoid monster | `create8` standard, default mannequin template (§3b) |
| Quadruped (wolf, bear, big cat, horse) | `create8 --template-id dog|bear|cat|horse|lion` (§3b) |
| Non-template body (blob, slug, serpent, flyer) | `create8 --mode pro` (§3b) — costs 20-40 gens |

Engine slot mapping (locked): right=SE, down=SW, left=NW, up=NE. Keep the
four diagonal frames from any 8-direction set.

## 2. Identity concepts (ChatGPT)

Ready-to-paste prompts live in `tools/pipeline/CAST_INVENTORY.md`. Rules that
make concepts PixelLab-ready — every prompt must demand: one character, full
body, **flat front-on view at eye level**, neutral standing pose, feet visible,
plain flat light-grey background, no ground shadow, no text, square image. Save
results to `art-incoming/<name>-concept-v1.png` (gitignored).

### 2a. Plain front-on is Eldoria's tested default — verified 2026-07-29

**[VENDOR-DOCUMENTED]** PixelLab requires only *"South-facing reference image…
Max 256x256 pixels."* — no camera-elevation requirement exists. A flat eye-level
concept was fed to `create-v3` with `view=high top-down` (≈35°) and rotated
correctly in all eight directions.

Plain front-on at eye level is Eldoria's current tested reference default. An
elevated reference is unnecessary for this tested route, though it is not
universally wrong — it simply has not been tested and is harder for image
generators to produce reliably from a text prompt. Ask for plain front-on; set
the camera with `--view` on the PixelLab call instead.

### 2b. Concepts for heroes must be UNARMED

Eldoria composites gear as layers — `index.html` defines
`EQUIPMENT_SLOTS = ['head', 'body', 'weapon', 'cape']`, drawn cape → base →
body → head → weapon. A weapon baked into the base sprite cannot be swapped and
breaks every gear tier the character will ever be given.

It also fails on fidelity. Measured on the Ranger: at a 64 px reference the bow
was ~1 px wide and did not survive rotation — broken in `south`, featureless in
`north-east`, and **absent entirely in `south-west`**, the frame the engine maps
to walking toward the camera.

So: **the concept prompt asks for the hero with empty hands.** Weapons are
generated separately into the `weapon` slot. Gear variants of an existing
character use `create-character-state` (`PIXELLAB_API.md` §2), not a new concept.

If driving ChatGPT via the sandbox browser: the automation Chrome has its own
profile — Leo must be logged in there once. Always `switch_tab` to the
chatgpt.com tab immediately before each action (other tabs steal focus).
Download images by fetching inside the page (session-bound URLs) and
triggering an `<a download>` click; the file lands in `~/Downloads`.

## 3. Generate sprites (PixelLab)

Run long calls with `run_in_background` and ABSOLUTE paths.

**(a) Identity route (heroes, named NPCs, bosses)** — a concept reference is
**mandatory**, not optional. Generating a hero from a description alone is the
route that produced Eldoria's one rejected character; see `PIXELLAB_API.md` §3.

```powershell
python -c "from PIL import Image; Image.open('art-incoming/NAME-concept-v1.png').convert('RGBA').resize((64,64), Image.LANCZOS).save('_probe_local/pipeline/NAME/ref-64.png')"
python tools/pipeline/pixellab_client.py create-v3 --description "..." `
  --reference-image _probe_local/pipeline/NAME/ref-64.png --seed 11 `
  --view "high top-down" --out-dir _probe_local/pipeline/NAME
```

> **`create-v3` has no `--size` flag.** It is not in the subparser; passing it
> exits with *"unrecognized arguments"*. An earlier version of this run-book
> documented `--size 64` and would not have run. Do not re-add it without
> evidence that `image_size` does anything in reference mode — the spec calls it
> *advisory ("model picks its own size")*, and neither measured run sent it.

**[MEASURED IN ELDORIA] 2026-07-29, three runs — the reference is the only
proven size lever.**

| Reference | Figure out | Canvas | Charged |
|---|---|---|---|
| **64×64** | **~52 px** | 108 | **1 gen** |
| **64×64** (unarmed) | **~52–56 px** | 112 | **1 gen** |
| 128×128 | ~104 px | 216 | 2 gens |

Across three runs, figure height was preserved approximately 1:1 from the
reference (current measured working rule, not a universal vendor guarantee). The
canvas is padded approximately ~1.7× for animation room — two 64 px references
produced 108 and 112 canvases, so the exact size is not predictable. Rotation is
billed on the **reference** dimensions, not the output canvas.

So a 64 px reference lands the figure on Eldoria's ~52–56 px target for a 64×64
frame, at 1 generation, with no destructive resampling. **256 is the input
ceiling, never a target** — it costs 8 generations (projected) and requires a
destructive downscale.

Step up to a 128 px reference (2 gens) **only** when a fine prop must survive
rotation — and prefer removing the prop from the base sprite entirely (§2b).
Always confirm the real dimensions in `character.json`; do not assume.

**(b) Description route:**

```powershell
python tools/pipeline/pixellab_client.py create8 --description "..." `
  --size 64 --isometric --seed 11 [--template-id X | --mode pro] `
  --out-dir _probe_local/pipeline/cast/NAME
```

Known behaviors (do not re-derive):
- `create4` yields CARDINAL facings (front/side/back) — Eldoria needs the
  diagonals, so always use 8-direction endpoints and keep the 4 diagonals.
- `isometric: true` outputs a 92×92 canvas — fine, the normalizer handles it.
- `--direction-ref south=...` uses the reference AS-IS for south and
  generates the rest — expect a detail/scale gap and lost props (staff).
  v3 reference rotation is the better identity route. (PixelLab's own docs
  confirm why: object rotation "can lose the salience contest"; v3 character
  reference mode "reproduces the input faithfully.")
- `--seed` makes reruns reproducible; rerolls = change seed.
- Results also live server-side: `pixellab_client.py characters` lists them,
  `character --id X --out-dir Y` re-downloads. **Animation sets accumulate on
  the character** (named after the slugified action description). PixelLab
  exposes animation deletion, but Eldoria's current client/workflow does not
  automatically delete bad sets — re-downloads must pick the right folder.

**(c) Walk animation:**

```powershell
python tools/pipeline/pixellab_client.py animate --character-id ID `
  --action "walking with a steady stride, legs stepping, arms swinging naturally" `
  --frames 4 --isometric --seed 11 `
  --directions south-east,south-west,north-west,north-east `
  --out-dir _probe_local/pipeline/NAME-walk
# `animate` does NOT auto-download — the API response has no character_id
# for finish_async to key off. Always follow with:
python tools/pipeline/pixellab_client.py character --id ID --out-dir _probe_local/pipeline/NAME-walk
```

**Writing the action, and choosing template vs custom mode:** see
`PIXELLAB_API.md` §5. In short — never a bare `--action "walking"`, always
`--seed`, and write the action for *that character's* equipment (the
"arms swinging naturally" phrase above is wrong for anyone holding a bow, staff
or basket). `--template-id walk` is [VENDOR-DOCUMENTED] skeleton-driven and
1 gen/direction — [UNTESTED IN ELDORIA] but worth trying first; may reduce
semantic drift but is not immune (visual gate still applies).

**Mandatory visual gate before normalizing** — open the raw direction-labelled
sheet and check **heading fidelity first, then semantic drift**
(`PIXELLAB_API.md` §4, or the `pixellab` skill §3). Eldoria's stake in this:
`south-west` is engine slot **`down`**, so a back-facing `south-west` means the
hero walks *away* from the camera when the player moves down. That is exactly
how the rejected Ranger set failed while passing every gate in
`validate_sprites.py`.

**Engine walk contract — Eldoria-specific, keep here.** `--frames N` returns
N+1 files per direction (`frame_000`=stand, `frame_001..N`=generated). The
engine needs `{stand, A, stand-copy, B}`, curated as:

```
walk-0 = frame_000    walk-1 = frame_001
walk-2 = frame_000    walk-3 = frame_003   (walk-2 duplicates the stand)
```

Treat 001/003 as **default candidates observed in two characters, not a rule.**
Confirm per set that the two frames plant **opposite** feet, the gait reads at
64×64, the root does not bob or drift, and equipment stays in the same hand at
the same size. Otherwise pick different frames.

## 4. Review sheet, then normalize + validate

```powershell
python tools/pipeline/make_cast_sheet.py --cast-dir _probe_local/pipeline/cast --out _probe_local/pipeline/cast/cast-review-sheet.png --cell 96
# arrange chosen frames as <slot>.png / <slot>-walk-<i>.png, then:
python tools/pipeline/normalize_sprite.py --source RAWDIR --out NORMDIR --profile PROFILE
python tools/pipeline/validate_sprites.py --dir NORMDIR --profile PROFILE --require-walks
```

`--require-walks` is mandatory for any character that walks (heroes; any
enemy that later gains a walk) — without it a missing strip cannot fail the
run. Drop it only for statics-only characters; `--allow-partial` only for
intentionally partial profiles.

Walk strips: engine resets `walkFrame` to 0 when stationary, so frame 0 MUST
be a standing pose and frames 0/2 are byte-identical (stand, step A, stand,
step B) — only 3 distinct poses are ever generated. A validator FAIL is a
real defect (G5 once caught a 6px shrink from `/rotate`): reroll or fix, do
not relax gates.

**A validator PASS is not a visual pass.** The gates check size, alpha,
anchor, padding, scale spread and walk stability — nothing about whether the
art is right. A set has been rejected after passing almost every gate because
its `south-west` frame faced backwards. Machine-clean means "eligible for
review", never "approved".

## 5. Ship

Nothing reaches `assets/` without (1) all gates passing and (2) human +
North Star review of the sheet. Commit normalized PNGs only — raw API
output, concepts, and tokens stay in `_probe_local/` / `art-incoming/`
(gitignored). Report with a **North Star alignment** heading.

## Landscape (tiles + props)

**Terrain: use `tilespro` (per PixelLab's own map-tiles guidance), not
single tiles.** `tilespro --tile-type isometric --tile-size 64
--flat-top-px 2` gives engine-shaped diamonds; number variations in one
description ("1). grass 2). soil ..."); `--feature tileset` generates a
16-tile TRANSITION set with placement rules in `tiles.json` (describe as
"grass to water", first terrain is the main one); `--feature roads` gives
18-config path autotiles; `--feature building` gives wall/floor kits
(farmhouse, shop). `style_images` keeps later batches consistent with
approved tiles. Single `isotile --tile-shape "thin tile"` is for quick
style probes only — it cannot produce transitions. Props/deco:
`mapobject --size 64` (96 for trees). Append the style suffix to every description: "premium crisp
pixel art, warm upper-left light, down-right shadow, rich saturated warm
fantasy palette, child-friendly adventure". Map-object results come back via
a no-auth `download_url` (already handled by the client). The iso engine
loads only `assets/iso/crop-*.png` so far — landscape art is review-then-park
until the iso spec's Phase 3 wires up tile/prop loading; do NOT edit
`index.html` as part of asset generation.

## Traps that already burned a session

- Local `npm test` fails on this Windows box by design (canvas golden files
  built on CI) — `gh run list` is the authority, never call a branch red
  from a local failure.
- Killing a detached background batch does NOT kill its in-flight loop —
  check `ps` before assuming it stopped; duplicate batches overwrite each
  other's out-dirs (last writer wins).
- `make_cast_sheet.py` already handles stale duplicate folders by trusting
  each character's `metadata.json`.
- `animate` does not auto-download its result — always follow with the
  `character` subcommand (see §3c). A prior version of this doc claimed the
  client "re-downloads the zip"; it does not.
- A validator PASS is not a visual pass: the walk-hallucination trap (§3c)
  produces gate-clean PNGs. Eyeball every raw walk sheet before normalizing.
