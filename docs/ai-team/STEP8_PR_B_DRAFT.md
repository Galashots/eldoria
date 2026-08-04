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

The committed `terrain-mask-map.json` is the labeled mask/contact mapping and runtime
family metadata. No props, road autotiles, probe sheets, raw July tile files, Town/Wilds
terrain, or other render layers are admitted in PR B; they remain source-only or deferred.

## Planned implementation and evidence

- deterministic native-resolution slicer with exact crop origins and pinned Pillow encoder;
- bit convention `bit0=N`, `bit1=E`, `bit2=S`, `bit3=W`, documented material priority and
  checkerboard tie-break;
- Farm adjacency-pair scan and activation-time precomputed draw records;
- decode-all-before-first-Farm-display, with soil → `drawIsoSoilTile` and all other missing
  families → `drawIsoTileDiamond` + `TILE_COLOR` fallbacks;
- manifest `--write --accept-new`, then `--check`;
- slicer byte-stability, dimensions/alpha/gutter checks, mask cases, fallback, boot, and
  render-only save-byte-equivalence tests;
- deterministic identical-state before/after captures for desktop, iPad landscape, and
  phone portrait, with both heroes.

No map, collision, save, gameplay, top-down, or PixelLab changes are permitted.
