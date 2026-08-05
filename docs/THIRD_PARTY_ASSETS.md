# Third-party and generated asset provenance

## Farm transition sheets (Step 8 PR B)

These three 259x195 RGBA transition sheets were supplied from the owner's PixelLab
library/downloads for the Farm iso-terrain integration. They are not loaded directly by
the runtime. The exact source SHA-256 values, crop origins, output pixel hashes, runtime
keys, and transformation metadata are recorded in
[`assets/iso/terrain/terrain-provenance.json`](../assets/iso/terrain/terrain-provenance.json).

| Runtime family | Original filename | SHA-256 | Source page | Author/creator record |
|---|---|---|---|---|
| `path` | `lush_green_meadow_grass_transitioning_to_packed_li.png` | `889D3C706958CCC3A54448D9B4D5A825C850BC709CF60F1D61B2DDB3D074317F` | [PixelLab create tiles documentation](https://www.pixellab.ai/docs/tools/create-tiles-pro) | PixelLab library/service; no creator name or embedded author metadata was present in the downloaded PNG |
| `soil` | `lush_green_meadow_grass_transitioning_to_freshly_t.png` | `434A9532F1593CFDAA7A2FE5E97814AFE8E5DA1B16F5246135190E97F0F98274` | [PixelLab create tiles documentation](https://www.pixellab.ai/docs/tools/create-tiles-pro) | PixelLab library/service; no creator name or embedded author metadata was present in the downloaded PNG |
| `water` | `lush_green_meadow_grass_transitioning_to_calm_deep.png` | `2CE53777F4FE4652A3BE766D30F11093E3373093DC10C48E5192DAC483398325` | [PixelLab create tiles documentation](https://www.pixellab.ai/docs/tools/create-tiles-pro) | PixelLab library/service; no creator name or embedded author metadata was present in the downloaded PNG |

**Capture/download date:** 2026-08-04 local provenance capture. The original library
download timestamp was not retained in the PNG metadata. The owner-provided normalized
July-batch files in `_probe_local/pipeline/landscape/grass-to-{path,soil,water}/` were
verified pixel-for-pixel against these three sheets using the same crop origins.

### Applicable license record

The [PixelLab Terms of Service](https://www.pixellab.ai/termsofservice) was checked on
2026-08-04; it reports “Last Updated: 2025-11-23.” Its applicable output-rights text is:

> **1.3** You own the copyrights to your creations, permitting usage for both commercial
> and non-commercial purposes with no need for permission.
>
> **3.3** You retain ownership of any content you create using PixelLab. You are free to
> use, modify, and distribute the outputs from our tools for any purpose, except for
> training other models without our explicit permission. However, you bear full legal
> responsibility for ensuring that the content you create complies with all applicable
> laws and does not infringe on the rights of any third parties.
>
> **4.1** By using PixelLab, you agree to comply with the terms listed in the Open RAIL-M
> license.

The linked Open RAIL-M text is retained at the [CreativeML Open RAIL-M license](https://github.com/CompVis/stable-diffusion/blob/main/LICENSE).
No separate attribution obligation was stated on the source page for these generated
sheets; this record preserves PixelLab as the service/library attribution and keeps the
source filenames and hashes reviewable.

### Transformation chain

1. The owner-provided 259x195 RGBA sheet is validated and decoded by
   `tools/pipeline/slice_tileset.py`.
2. The slicer crops exactly sixteen 64x48 rectangles at x origins `0,65,130,195` and y
   origins `0,49,98,147`; the one-pixel internal gutters are not copied (the sheets have
   no outer margin). It does not resize, resample, or recolor source pixels.
3. Each crop is encoded as a deterministic RGBA8 PNG using the committed stdlib encoder
   (`filter=0`, zlib level 9) and assigned its explicit mask, runtime key, and Pass 1 layer.
4. The deterministic `flatten-raised-block-v1` transform preserves source RGBA pixels
   inside a two-pixel-inset 64x32 diamond, makes the authored 16px skirt and repeated
   outer perimeter transparent, and records both source-crop and transformed hashes.
5. The renderer draws the existing flat material diamond first, then the native 64x48
   transparent overlay; it decodes every derived image during initial sprite preload,
   precomputes Farm draw records at area activation, and falls back to the existing
   color-diamond behavior if an image is missing.

### Future visual-only item: cross-set grass harmonization

The three admitted transition families intentionally retain different grass palettes for
now. Measured mean absolute RGB deltas are **27.9** for path↔soil, **22.7** for
path↔water, and **30.9** for soil↔water; the respective grass palette sizes are **20**,
**18**, and **11** colors. A future, separately reviewed visual-only PR may add a
deterministic slicer recolor pass that maps each set's grass colors to one canonical Farm
grass palette and records before/after pixel hashes and the palette mapping in provenance.
Because the palette sizes differ, that mapping must use nearest-color or rank-based
matching rather than a 1:1 color substitution. This terrain-placement fix does not
perform the harmonization.

The owned July-batch normalized files are provenance/evidence inputs only. Props, roads,
probe sheets, raw source sheets, and all other landscape artifacts remain outside the PR B
allowlist and are source-only/deferred.
