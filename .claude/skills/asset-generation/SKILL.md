---
name: asset-generation
description: Generate Eldoria character sprites end-to-end (concept -> PixelLab -> normalize -> validate -> review). Use for any request to create or update character/enemy/NPC art.
---

# Eldoria asset generation

Follow these steps exactly. Every command runs from the repo root
(`C:\Users\Leo\Desktop\eldoria-public`). **Always `Set-Location` / `cd` to the
repo root first — background jobs and other tools change the cwd.** Do not
improvise endpoint parameters; the decision table below encodes tested
behavior (calibrated 2026-07-28, see `tools/pipeline/PIPELINE.md`).

Read `tools/pipeline/PIXELLAB_MCP.md` before using PixelLab MCP tools. If
PixelLab MCP is connected, it is an interactive front end to the same service;
it does not replace Eldoria's routes, local normalization/validation, review
sheet, North Star review, or owner approval. If MCP is unavailable, continue
with the proven Python client below.

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
body, three-quarter FRONT view, neutral standing pose, feet visible, plain
flat light-grey background, no ground shadow, no text, square image. Save
results to `art-incoming/<name>-concept-v1.png` (gitignored).

If driving ChatGPT via the sandbox browser: the automation Chrome has its own
profile — Leo must be logged in there once. Always `switch_tab` to the
chatgpt.com tab immediately before each action (other tabs steal focus).
Download images by fetching inside the page (session-bound URLs) and
triggering an `<a download>` click; the file lands in `~/Downloads`.

## 3. Generate sprites (PixelLab)

Run long calls with `run_in_background` and ABSOLUTE paths.

**(a) Identity route** — reference must be ≤256×256 (downscale with LANCZOS):

```powershell
python -c "from PIL import Image; Image.open('art-incoming/NAME-concept-v1.png').convert('RGBA').resize((256,256), Image.LANCZOS).save('_probe_local/pipeline/NAME/ref-256.png')"
python tools/pipeline/pixellab_client.py create-v3 --description "..." `
  --reference-image _probe_local/pipeline/NAME/ref-256.png --seed 11 `
  --out-dir _probe_local/pipeline/NAME
```

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
  v3 reference rotation is the better identity route.
- `--seed` makes reruns reproducible; rerolls = change seed.
- Results also live server-side: `pixellab_client.py characters` lists them,
  `character --id X --out-dir Y` re-downloads.

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
