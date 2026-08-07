# H5 exact-result recovery log

Status: **raw PNG not recovered; no regeneration authorized or attempted**.

The authenticated PixelLab Pixelorama editor was kept open throughout. The
visible generated result remained at frame `2/3` and was restored there after a
zero-generation frame-1 export rehearsal.

## Attempts

1. Private project backup: opened Pixelorama Save As, named the backup
   `PR54-H5-Candidate-C-Inpaint-v3-backup.pxo`, and tried the embedded-images
   option. No `.pxo` appeared in `C:\Users\Leo\Downloads`; the browser download
   event also did not occur.
2. Normal PNG export: frame `2/3`, `Selected frames`, `Visible layers`,
   `Forward`, `100%`, `64x64`, PNG, nearest interpolation, with the mask and
   diagnostic overlays not visible. The relative output name completed without
   an error but produced no local PNG or browser download event.
3. Explicit local path export: set the path to
   `C:/Users/Leo/Downloads/PR54-H5-raw-candidate-C.png`. Pixelorama rejected it
   with `Directory path is not valid!`; the export path is an app virtual path,
   not a host filesystem path.
4. Zero-generation known-image rehearsal: selected frame `1/3` (the Ranger
   source), used the same 64x64 PNG export flow, and attempted
   `C:/Users/Leo/Downloads/PR54-H5-known-frame1-rehearsal.png`. It produced the
   same invalid-directory behavior and no local file. Frame `2/3` was restored.
5. Clipboard fallback: selected the H5 canvas and invoked Pixelorama Copy. The
   browser clipboard contained only the prior text filename; no PNG clipboard
   payload was exposed.

No screenshot reconstruction was used for custody. The existing
`candidate-c-v3-screen-derived.png` remains explicitly diagnostic only; its
999 off-mask changes must not be attributed to PixelLab.

## Disposition

The editor state is preserved for a later owner-approved recovery attempt. The
exact H5 PNG, raw SHA-256, authoritative validator result, and authoritative
contact sheet cannot be produced until a working Pixelorama-to-host file-save
path is established. No sword, extra facing, retry, or other paid method was
run.
