# Stage 0 PixelLab Pixelorama reconnaissance

**Date:** 2026-08-06  
**PR:** #54  
**Purpose:** no-generation browser reconnaissance and custody rehearsal preparation

## Verdict

**REVISE — reconnaissance completed; byte-exact import/export rehearsal is blocked
by Chrome file-upload permission. No PixelLab generation was submitted and no
credits were spent. Stage 1 must not begin until the exact local-file rehearsal
passes and the live price is disclosed for the selected route.**

## Official PixelLab documentation reviewed

- [Documentation index](https://www.pixellab.ai/docs)
- [Ways to use PixelLab](https://www.pixellab.ai/docs/ways-to-use-pixellab)
- [Introduction to Pixelorama](https://www.pixellab.ai/docs/introduction-pixelorama)
- [Init images and inpainting](https://www.pixellab.ai/docs/getting-started)
- [Inpaint](https://www.pixellab.ai/docs/tools/inpaint)
- [Inpainting options](https://www.pixellab.ai/docs/options/inpainting)
- [Inpaint v3](https://www.pixellab.ai/docs/tools/inpaint-v3)
- [Edit Animation Pro](https://www.pixellab.ai/docs/tools/edit-animation-pro)
- [Transfer Outfit Pro](https://www.pixellab.ai/docs/tools/transfer-outfit-pro)
- [Edit Image Pro](https://www.pixellab.ai/docs/tools/edit-image-pro)
- [Edit Image](https://www.pixellab.ai/docs/tools/edit-image)
- [General options](https://www.pixellab.ai/docs/options/general)
- [Init image options](https://www.pixellab.ai/docs/options/init-image)
- [Color options](https://www.pixellab.ai/docs/options/color)
- [Camera options](https://www.pixellab.ai/docs/options/camera)
- [Projection options](https://www.pixellab.ai/docs/options/projection)

Material observations:

- PixelLab documents Pixelorama as a desktop-browser editor with PixelLab tools
  integrated into the open-source editor.
- Standard Inpaint modifies only the areas marked on the inpainting layer. Its
  documented limits are 32×32 minimum and 100×100 maximum for tier 1, or 160×160
  for tier 2+.
- The general options document lists output methods including new layer, modify
  current layer, new frame, and modify current layer/only changes. Seed `0` is
  random; a nonzero seed is required for a fixed-seed experiment.
- Inpaint v3 is documented as 20 generations per use and is available in the
  Pixelorama/Aseprite extensions.
- The live documentation currently lists Edit Animation Pro as 20 generations
  for 32–80px, 20 for 81–128px, 25 for 129–170px, and 40 for 171–256px, with
  frame limits that differ from the addendum's older planning table. This is a
  live-doc discrepancy to resolve before using that route.
- Transfer Outfit Pro's live documentation matches the corrected addendum table:
  32–64px up to 15 frames/20 generations; 65–80px up to 8/20; 81–128px up to
  3/20; 129–170px up to 3/25; 171–256px up to 3/40. It requires at least two
  animation frames and one outfit reference.
- The written inpainting guide says the model may modify black-marked regions
  and leaves unmarked regions unchanged; this is a behavioral expectation, not a
  custody proof. The repository validator remains authoritative for evidence.

## Official tutorial review

These videos were linked from PixelLab's official landing page and inspected via
their current YouTube metadata:

| Title | URL | Length | Published |
|---|---|---:|---|
| Tutorial: Using inpainting to create style consistent characters | https://youtu.be/68BYzLoLh-U | 9:32 | 2025-01-17 |
| Tutorial: Animation to animation with PixelLab | https://youtu.be/owkamgYVWAs | 4:25 | 2025-06-20 |
| Tutorial: Generate rotations for your pixel art characters with PixelLab | https://youtu.be/ufQ72nGORC0 | 2:09 | 2023-11-27 |

The inpainting tutorial reinforces the init-image plus painted-mask workflow and
the need to choose an output method deliberately. The animation tutorial is
relevant only to a later coordinated experiment. Tutorials do not establish
current cost, byte identity, or custody guarantees.

## Official Pixelorama manual reviewed

- [Import](https://pixelorama.org/user_manual/Import/) — PNG import supports a
  new project, new layer, new frame, replace cel, and spritesheet modes. Multiple
  image imports are applied in reverse order, which matters for any frame batch.
- [Selecting](https://pixelorama.org/user_manual/selecting) — selections restrict
  drawing/effects to selected pixels; operations affect the currently selected
  cel, not every cel in a layer.
- [The Timeline](https://pixelorama.org/user_manual/user_interface/timeline/) —
  layers, frames, cels, linked cels, visibility, locks, clipping-mask properties,
  frame order, and frame selection behavior.
- [Save and Export](https://pixelorama.org/user_manual/save_and_export) — `.pxo`
  preserves the editable project; PNG export can select frames/layers and choose
  resize/interpolation. For custody, export must remain 1× with no interpolation.

The manual pages were last updated 2026-07-29 when inspected.

## Live Pixelorama UI reconnaissance

The authenticated PixelLab editor loaded in Chrome at `https://www.pixellab.ai/editor`.
The visible editor identified itself as **Pixelorama v1.1.9-stable**. The blank
project opened at **64×64**, current frame 1/1. Visible tool groups included
Create, UI, Edit, Rotate, Animate, Map, Inpaint, and Cleanup.

The Inpaint panel exposed three live routes:

### Inpaint v3

- Visible label: `Inpaint (v3)` with `PRO` badge.
- Controls: inpaint image, paint in selection, description, output method, remove
  background, crop to mask, advanced options.
- The live panel visibly stated: **This tool costs 20 generations.**

### Inpaint M-L (Pixpatch v2)

- Visible label: `Inpaint M-L (Pixpatch v2)` with `PRO` badge.
- Controls: description, camera view, direction, outline, shading, details,
  isometric, oblique projection, init image, palette, output method, remove
  background, and advanced options.
- No cost was visible in the inspected blank-project panel.

### Inpaint / Classic (Legacy)

- Visible label: `Inpaint`, with `Classic` under the expanded `Legacy` selector.
- Controls: description, isometric, oblique projection, use view and direction,
  camera view, direction, init image, limit colors, output method, remove
  background, and advanced options.
- Advanced options expose negative description, outline, shading, details,
  guidance weight, and seed. The observed seed field displayed `0 (random seed)`.
- The output-method choices included `New layer with changes`, `Modify current
  layer`, `New frame`, `New layer`, and `Modify current layer, only changes`.
- The inspected blank-project panel did **not** disclose a generation price before
  input or generation.

This means the addendum's planned Stage 1 budget cannot be treated as confirmed
for the live Classic route. The route and cost must be identified from the live
UI after the exact frame/mask are imported, without clicking Generate.

## Import/export dry rehearsal

The disposable copy was prepared from:

- Source: `assets/adventurer-down-right.png`
- SHA-256: `a59a6d7caec21752f99304e22390f8fbba7df14aced6efe4b8853b53b9f40300`
- Intended project: exact 64×64 RGBA Ranger `down-right` frame

The rehearsal could not begin. Chrome's ChatGPT extension rejected the file
chooser upload with `Not allowed` because **Allow access to file URLs** is not
enabled. This is an automation permission blocker, not a Pixelorama custody
failure. No source pixels were changed and no file was uploaded to PixelLab.

Screenshots of the Pixelorama welcome dialog, blank 64×64 editor, and the three
Inpaint panels were captured during reconnaissance. They are not committed here
because they are browser-session evidence rather than production art and the
file-upload permission is still pending.

## Automation and persistence findings

- Browser CUA can open the editor, dismiss the welcome dialog, select the Inpaint
  tool, switch among the visible Inpaint routes, expand advanced options, and
  inspect controls without generation.
- The editor is canvas-based inside an iframe; DOM snapshots expose little of the
  Pixelorama UI, so screenshots/coordinate-grounded controls are required for
  visual confirmation.
- Local file upload is currently blocked by the ChatGPT Chrome extension setting.
- The written Pixelorama manual recommends saving a `.pxo` project and exporting
  PNG separately. Browser download/save persistence and exact export bytes remain
  untested until the local PNG can be imported.

## Stage 0 disposition and next step

**REVISE.** Reconnaissance is valuable and complete enough to identify a material
method/cost discrepancy, but the byte-exact rehearsal and live price capture for
the intended standard route are pending. Do not click Generate, do not authorize
Stage 1, and do not spend any generations until:

1. Chrome's ChatGPT extension has file-URL access enabled;
2. the exact 64×64 PNG imports without resizing or palette conversion;
3. the disposable `.pxo` save and 1× PNG export round-trip is byte-identical;
4. the actual selected-route price is visible and within the staged cap; and
5. the draft masks receive the required visual review/approval.

## Additional Stage 0 reconnaissance: combat animation and armor workflows

This section extends the same no-generation reconnaissance record. The live
Pixelorama panel was inspected without importing a file and without clicking
`Generate`. The blank project remained 64×64.

### Live animation menu

The `Animate` workspace currently exposes these routes:

| Route | Observed inputs and output | Live cost signal | Eldoria disposition |
|---|---|---|---|
| `Edit Animation (pro)` | `Animation Frames (0/16)`, required description, `New frames` output, optional advanced seed, remove-background toggle | **20 generations** | Best later frame-edit candidate, but not authorized; exact source frames and approved masks remain prerequisites |
| `Interpolate (New)` | First-frame and last-frame references, action description, configurable new-frame count (default 3), `New frames` output, optional seed | **1–9**, depending on image size and frame count | Potential in-between-frame experiment; not a substitute for exact gear overlays |
| `Animate with Text (v3)` | First-frame reference, action description, frame count (default 4), `New frames` output, optional seed | Depends on image size and frame count | Full animation generation; not authorized |
| `Animate with Text (v2/pro)` | Reference image, action description, camera view, direction, `New frames` output | **20–40 generations per call**, depending on reference-image size | Full animation generation; not authorized |
| `Transfer Outfit to Animation (pro)` | Required outfit image, `Images to edit (0/15)`, optional directional/outfit instructions, `New frames` output | **20 generations** in the live 64×64 blank-project panel | Armor-to-animation route, but creates complete frames and remains owner-gated |
| `Create animated object/character (pro)` | Description, animation action, remove-background toggle, `New frames` output | **20 generations per call** | Creates a subject from scratch; unsuitable for direct overlay |
| `Animate with skeleton` | Reference image; estimate/edit skeleton or template/animation-to-animation; bipedal-realistic templates such as `walk, 4 frames`; camera, direction, transform and 3D controls; second step offers freeze/generate frame plans and optional inpainting | No price was visible in the inspected blank-project state | A pose/animation experiment, not a custody-safe armor-layer method |
| `Animation to animation` | New canvas or animation reference, frame count, description/action, camera/direction, outline/shading/details, init image, output frame, advanced AI freedom/guidance/seed | No price was visible in the inspected blank-project state | Restyling/reconstruction route; not authorized |

The live `Edit Animation` panel showed a maximum of 16 input frames and a
20-generation quote. This is the live UI observation for this session; the
written live documentation's frame-limit table differs in places from the
older addendum planning table, so the exact frame/cost contract must be captured
again before any future owner-gated experiment.

### Armor-specific findings

`Transfer Outfit to Animation` is the clearest direct armor workflow in the
animation menu: it takes one required outfit image and up to 15 animation images
to edit, with optional instructions describing how the character faces and how
the outfit should appear from that angle. Its output is `New frames`, not an
isolated armor layer. It therefore does not replace the Phase 1 custody method.

For Eldoria's controlled combat-gear test, the safer division remains:

1. Use standard PixelLab Inpaint in Pixelorama on the exact committed 64×64
   Ranger frame with one approved binary mask for the body or weapon slot.
2. Keep the hand, sword orientation, fixed seed, output layer, and live price
   as evidence fields.
3. Consider `Edit Animation` only after one facing passes visual and machine
   review, using the exact directional frames as inputs and treating the result
   as a new full-frame animation that must pass per-frame custody checks.

The animation menu's full-frame routes can help explore combat motion, but they
do not establish byte-safe equipment overlays. Any generated frame would still
need same-resolution comparison, approved-mask containment, deterministic layer
extraction, recomposition, and human semantic review.

### “InStudio” terminology check

No distinct official PixelLab product or route named `InStudio` was exposed by
the live editor or the focused official-site search. The authenticated web
surface is titled `PixelLab Pixelorama`, and the editor identifies itself as
Pixelorama v1.1.9-stable. PixelLab's current linked tutorial was titled
`Pixelorama + PixelLab: Create, Edit, Rotate, and Animate Pixel Art` and showed
an 11:38 runtime. This report treats “InStudio” as a possible name for the
in-browser integrated studio/editor, not as a separately verified method.
