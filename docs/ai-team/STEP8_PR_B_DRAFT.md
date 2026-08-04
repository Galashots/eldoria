# Draft PR B — Farm iso terrain sprites

Base: `main` at `ba0d7ffab1173261437e55634b6dac6a6779cad1`

Scope: LARGE, Farm ground Pass 1 only; render-only; PixelLab generation remains paused.

## Fixed July-batch allowlist (locked before implementation)

The following normalized July-batch transition outputs and rule metadata are admitted as
source evidence for this PR. They are never loaded directly by the runtime: the committed
deterministic slicer re-crops the owner-provided 259×195 source sheets into the derived
runtime files listed below and records the source SHA-256 plus crop origin.

### Admitted `_probe_local/pipeline/landscape/` files

Transition family `grass-to-path` (packed dirt; Farm PATH/EXIT/DOOR floor):

- `_probe_local/pipeline/landscape/grass-to-path/tiles.json`
- `_probe_local/pipeline/landscape/grass-to-path/tile_0.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_1.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_2.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_3.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_4.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_5.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_6.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_7.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_8.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_9.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_10.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_11.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_12.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_13.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_14.png`
- `_probe_local/pipeline/landscape/grass-to-path/tile_15.png`

Transition family `grass-to-soil` (tilled soil; Farm SOIL):

- `_probe_local/pipeline/landscape/grass-to-soil/tiles.json`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_0.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_1.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_2.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_3.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_4.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_5.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_6.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_7.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_8.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_9.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_10.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_11.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_12.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_13.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_14.png`
- `_probe_local/pipeline/landscape/grass-to-soil/tile_15.png`

Transition family `grass-to-water` (deep water; Farm WATER):

- `_probe_local/pipeline/landscape/grass-to-water/tiles.json`
- `_probe_local/pipeline/landscape/grass-to-water/tile_0.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_1.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_2.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_3.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_4.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_5.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_6.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_7.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_8.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_9.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_10.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_11.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_12.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_13.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_14.png`
- `_probe_local/pipeline/landscape/grass-to-water/tile_15.png`

### External source sheets admitted to the slicer

These are the owner-provided July library sheets in `C:\Users\Leo\Downloads`:

- `lush_green_meadow_grass_transitioning_to_packed_li.png` → `path`
- `lush_green_meadow_grass_transitioning_to_freshly_t.png` → `soil`
- `lush_green_meadow_grass_transitioning_to_calm_deep.png` → `water`

Each is required to be 259×195 RGBA PNG with crop origins
`x = 0,65,130,195`, `y = 0,49,98,147`, cell size 64×48, one-pixel internal gutters,
no outer margin. The 64×32 top-face diamond is copied at native resolution; no resampling
is permitted.

### Derived runtime files, keys, families, and render layer

All 48 transition outputs are Farm ground Pass 1 assets. `NN` is the source mask in
`terrain-mask-map.json`, not a guessed row-major index:

| Derived path pattern | Runtime key pattern | Family | Render layer |
|---|---|---|---|
| `assets/iso/terrain/path-NN.png` (00–15) | `iso_terrain_path_NN` | `farm-iso-terrain-transition` | Farm ground Pass 1 |
| `assets/iso/terrain/soil-NN.png` (00–15) | `iso_terrain_soil_NN` | `farm-iso-terrain-transition` | Farm ground Pass 1 |
| `assets/iso/terrain/water-NN.png` (00–15) | `iso_terrain_water_NN` | `farm-iso-terrain-transition` | Farm ground Pass 1 |

Three additional 64×48 native-resolution grass base variants are derived from the mask-15
crop of each admitted sheet:

| Derived path | Runtime key | Family | Render layer |
|---|---|---|---|
| `assets/iso/terrain/grass-base-path.png` | `iso_terrain_grass_base_path` | `farm-iso-terrain-grass-base` | Farm ground Pass 1 |
| `assets/iso/terrain/grass-base-soil.png` | `iso_terrain_grass_base_soil` | `farm-iso-terrain-grass-base` | Farm ground Pass 1 |
| `assets/iso/terrain/grass-base-water.png` | `iso_terrain_grass_base_water` | `farm-iso-terrain-grass-base` | Farm ground Pass 1 |

Exact derived-file inventory (all 64×48 PNGs, all `farm-iso-terrain-transition` or
`farm-iso-terrain-grass-base`, all Farm ground Pass 1):

- Path: `path-00` → `iso_terrain_path_00`; `path-01` → `iso_terrain_path_01`; `path-02` → `iso_terrain_path_02`; `path-03` → `iso_terrain_path_03`.
- Path: `path-04` → `iso_terrain_path_04`; `path-05` → `iso_terrain_path_05`; `path-06` → `iso_terrain_path_06`; `path-07` → `iso_terrain_path_07`.
- Path: `path-08` → `iso_terrain_path_08`; `path-09` → `iso_terrain_path_09`; `path-10` → `iso_terrain_path_10`; `path-11` → `iso_terrain_path_11`.
- Path: `path-12` → `iso_terrain_path_12`; `path-13` → `iso_terrain_path_13`; `path-14` → `iso_terrain_path_14`; `path-15` → `iso_terrain_path_15`.
- Soil: `soil-00` → `iso_terrain_soil_00`; `soil-01` → `iso_terrain_soil_01`; `soil-02` → `iso_terrain_soil_02`; `soil-03` → `iso_terrain_soil_03`.
- Soil: `soil-04` → `iso_terrain_soil_04`; `soil-05` → `iso_terrain_soil_05`; `soil-06` → `iso_terrain_soil_06`; `soil-07` → `iso_terrain_soil_07`.
- Soil: `soil-08` → `iso_terrain_soil_08`; `soil-09` → `iso_terrain_soil_09`; `soil-10` → `iso_terrain_soil_10`; `soil-11` → `iso_terrain_soil_11`.
- Soil: `soil-12` → `iso_terrain_soil_12`; `soil-13` → `iso_terrain_soil_13`; `soil-14` → `iso_terrain_soil_14`; `soil-15` → `iso_terrain_soil_15`.
- Water: `water-00` → `iso_terrain_water_00`; `water-01` → `iso_terrain_water_01`; `water-02` → `iso_terrain_water_02`; `water-03` → `iso_terrain_water_03`.
- Water: `water-04` → `iso_terrain_water_04`; `water-05` → `iso_terrain_water_05`; `water-06` → `iso_terrain_water_06`; `water-07` → `iso_terrain_water_07`.
- Water: `water-08` → `iso_terrain_water_08`; `water-09` → `iso_terrain_water_09`; `water-10` → `iso_terrain_water_10`; `water-11` → `iso_terrain_water_11`.
- Water: `water-12` → `iso_terrain_water_12`; `water-13` → `iso_terrain_water_13`; `water-14` → `iso_terrain_water_14`; `water-15` → `iso_terrain_water_15`.
- Grass base: `grass-base-path.png` → `iso_terrain_grass_base_path`; `grass-base-soil.png` → `iso_terrain_grass_base_soil`; `grass-base-water.png` → `iso_terrain_grass_base_water`.

The committed `terrain-mask-map.json` is the labeled mask/contact mapping and runtime
family metadata. No props, road autotiles, probe sheets, raw July tile files, Town/Wilds
terrain, or other render layers are admitted in PR B; they remain source-only or deferred.

## Delivered implementation and evidence

- deterministic native-resolution slicer with exact crop origins and a pinned stdlib PNG encoder;
- deterministic `flatten-raised-block-v1` derivative transform: the authored 16px skirt
  and repeated outer perimeter are transparent, while source pixels remain native inside
  a two-pixel-inset 64×32 top-face diamond;
- bit convention `bit0=N`, `bit1=E`, `bit2=S`, `bit3=W`, documented material priority and
  checkerboard tie-break;
- Farm adjacency-pair scan and activation-time precomputed draw records;
- decode-all-before-first-Farm-display, with a flat `drawIsoTileDiamond` underlay and the
  transparent overlay above it; missing soil → `drawIsoSoilTile`, all other missing
  families → `drawIsoTileDiamond` + `TILE_COLOR` fallbacks;
- manifest `--write --accept-new`, then `--check`;
- slicer byte-stability, exact dimensions, pixel-for-pixel July-source comparison, mask
  cases, fallback, boot, and render-only save-byte-equivalence tests;
- deterministic identical-state before/after captures for desktop, iPad landscape, and
  phone portrait, with both heroes.
- committed `open-grass-8x8-proof.png` and `mixed-topology-proof.png` proving native-scale
  continuous open grass and mixed-material transition composition before recapturing the
  six identical-state viewport pairs.

Focused gates passed:

- `python tools/pipeline/slice_tileset.py --self-test`
- `node tools/terrain-proof.mjs`
- `node tools/terrain-test.mjs`
- `node tools/asset-manifest.mjs --check` (`264 assets, 243 runtime bindings`)
- `node tools/asset-manifest-test.mjs`
- `node tools/smoke-test.mjs`
- `node tools/playtest-fixes-test.mjs`
- `node tools/profile-state-test.mjs`
- `node tools/combat-progression-test.mjs`
- `node tools/identity-progression-test.mjs`
- `node tools/onboarding-test.mjs`

The required local `npm.cmd test` passed its preceding suites but then hit the known
Windows-local `iso-test` timeout/hang with no output; no stale port-5173 listener was
present. Per the contract, CI on the pushed head is the gate of record for that known
environment issue.

Deterministic before/after captures and both round-2 visual proofs are recorded in
`docs/playtest/step8-farm-terrain/README.md`. North Star alignment remains **Intentional
interim gap** pending the visual lead's round-2 verdict; the raised-block normalization
is bounded to the slicer derivative and renderer composition. No PixelLab API or
generation call was made.

No map, collision, save, gameplay, top-down, or PixelLab changes are permitted.
