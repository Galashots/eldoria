"""Normalize Blender iso source renders into the Eldoria 64x64 engine contract.

Track 2(b) probe artifact. Separate from ranger_iso_scene.py because Blender's
bundled Python has no Pillow/numpy; this runs on the system Python 3.10.

Contract enforced (tools/3D_ISO_SPRITE_PIPELINE.md §3, and the machine gates in
tools/ranger-proof.mjs on work/ranger-character-pipeline-proof):

  * static facings   -> 64x64 RGBA, one file per engine slot
  * walk strip       -> 256x64 RGBA, four 64x64 frames laid left->right
  * binary alpha     -> every pixel is fully opaque or fully transparent
  * bottom anchor    -> the lowest opaque row of every frame is row 63
  * horizontal pad   -> at least one transparent column on each side
  * shared scale     -> one scale factor for every facing and every walk frame

Downscaling is done in PREMULTIPLIED alpha. Naive RGBA resizing blends edge
pixels toward transparent black and leaves a dark fringe once the alpha is
thresholded back to binary -- very visible at 64px.

Reproduce:
  python tools/3d/normalize_ranger_proof.py \
      --source _probe_local/renders/source \
      --out docs/visual/experiments/ranger-trellis-blender-probe/normalized
"""

import argparse
import os

import numpy as np
from PIL import Image

FRAME = 64
CONTENT_BOX = 60          # max content extent inside the frame -> guarantees padding
ALPHA_THRESHOLD = 128
ENGINE_SLOTS = ["right", "down", "left", "up"]
WALK_SLOT = "right"
WALK_FRAMES = 4


def load_rgba(path):
    return np.asarray(Image.open(path).convert("RGBA"), dtype=np.float64)


def opaque_bbox(alpha, threshold=ALPHA_THRESHOLD):
    ys, xs = np.nonzero(alpha >= threshold)
    if len(ys) == 0:
        raise SystemExit(f"empty render: no pixels above alpha {threshold}")
    return xs.min(), ys.min(), xs.max(), ys.max()


def premultiplied_resize(rgba, size):
    """Alpha-correct downscale: premultiply -> resize -> un-premultiply."""
    alpha = rgba[..., 3:4] / 255.0
    premul = np.concatenate([rgba[..., :3] * alpha, rgba[..., 3:4]], axis=-1)
    small = np.asarray(
        Image.fromarray(premul.round().clip(0, 255).astype(np.uint8), "RGBA")
        .resize(size, Image.LANCZOS),
        dtype=np.float64,
    )
    a = small[..., 3:4] / 255.0
    rgb = np.divide(small[..., :3], a, out=np.zeros_like(small[..., :3]), where=a > 0)
    return np.concatenate([rgb.clip(0, 255), small[..., 3:4]], axis=-1)


def to_binary_alpha(rgba):
    """Threshold alpha and zero the RGB of transparent pixels (byte determinism)."""
    out = rgba.copy()
    mask = out[..., 3] >= ALPHA_THRESHOLD
    out[..., 3] = np.where(mask, 255.0, 0.0)
    out[..., :3] *= mask[..., None]
    return out.round().clip(0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    names = [(f"adventurer-{s}.png", f"adventurer-{s}.png") for s in ENGINE_SLOTS]
    walk_names = [f"adventurer-{WALK_SLOT}-walk-{i}.png" for i in range(WALK_FRAMES)]
    has_walk = all(os.path.isfile(os.path.join(args.source, n)) for n in walk_names)

    sources = {n: load_rgba(os.path.join(args.source, n)) for n, _ in names}
    if has_walk:
        sources.update({n: load_rgba(os.path.join(args.source, n)) for n in walk_names})

    # --- one shared crop window + one shared scale across every frame ---------
    boxes = {n: opaque_bbox(img[..., 3]) for n, img in sources.items()}
    ux0 = min(b[0] for b in boxes.values())
    uy0 = min(b[1] for b in boxes.values())
    ux1 = max(b[2] for b in boxes.values())
    uy1 = max(b[3] for b in boxes.values())
    uw, uh = ux1 - ux0 + 1, uy1 - uy0 + 1
    scale = min(CONTENT_BOX / uh, CONTENT_BOX / uw)
    tw, th = max(1, round(uw * scale)), max(1, round(uh * scale))
    print(f"[norm] union box {uw}x{uh} @({ux0},{uy0})  scale={scale:.5f} -> {tw}x{th}")

    def normalize(img):
        crop = img[uy0:uy1 + 1, ux0:ux1 + 1]
        small = to_binary_alpha(premultiplied_resize(crop, (tw, th)))
        bx0, by0, bx1, by1 = opaque_bbox(small[..., 3], threshold=255)
        frame = np.zeros((FRAME, FRAME, 4), dtype=np.uint8)
        # Bottom-anchor this frame's own lowest opaque row onto row 63 (the foot
        # pivot the engine draws from), and centre horizontally on the SHARED
        # union centre so facings do not drift relative to each other.
        dy = (FRAME - 1) - by1
        dx = round(FRAME / 2 - (tw / 2))
        ys0, ys1 = max(0, dy), min(FRAME, dy + th)
        xs0, xs1 = max(0, dx), min(FRAME, dx + tw)
        frame[ys0:ys1, xs0:xs1] = small[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
        return frame

    for src_name, out_name in names:
        Image.fromarray(normalize(sources[src_name]), "RGBA").save(
            os.path.join(args.out, out_name))
        print(f"[norm] {out_name}")

    if has_walk:
        strip = np.zeros((FRAME, FRAME * WALK_FRAMES, 4), dtype=np.uint8)
        for i, n in enumerate(walk_names):
            strip[:, i * FRAME:(i + 1) * FRAME] = normalize(sources[n])
        out_name = f"adventurer-{WALK_SLOT}-walk.png"
        Image.fromarray(strip, "RGBA").save(os.path.join(args.out, out_name))
        print(f"[norm] {out_name} ({FRAME * WALK_FRAMES}x{FRAME})")
    else:
        print("[norm] no walk frames found; static facings only")


if __name__ == "__main__":
    main()
