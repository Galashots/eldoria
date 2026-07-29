"""Normalize raw sprite frames into the Eldoria 64x64 engine contract.

Generalization of the Track 2(b) probe normalizer (same math, no longer
hardcoded to one profile). Input is a directory of raw frames — from PixelLab,
ChatGPT, Blender, anywhere — named by ENGINE SLOT:

    <slot>.png              static facing        slot in {right, down, left, up}
    <slot>-walk-<i>.png     walk frame i (0..3)

Output is engine-ready files named for the profile:

    <profile>-<slot>.png        64x64 RGBA
    <profile>-<slot>-walk.png   256x64 strip, frames left->right

Contract enforced (see tools/pipeline/PIPELINE.md):
  * binary alpha (every pixel fully opaque or fully transparent)
  * bottom anchor: lowest opaque row of every frame is row 63 (foot pivot)
  * >=1 transparent column of padding each side
  * ONE shared scale across every frame of the profile, so facings and walk
    frames cannot drift in size relative to each other

Downscaling happens in PREMULTIPLIED alpha: naive RGBA resizing blends edges
toward transparent black and leaves a dark fringe after re-thresholding.

Reproduce:
  python tools/pipeline/normalize_sprite.py \
      --source _probe_local/pipeline/ranger/raw --out _probe_local/pipeline/ranger/normalized \
      --profile adventurer
"""

import argparse
import os

import numpy as np
from PIL import Image

FRAME = 64
CONTENT_BOX = 60
ALPHA_THRESHOLD = 128
ENGINE_SLOTS = ["right", "down", "left", "up"]
WALK_FRAMES = 4


def load_rgba(path):
    return np.asarray(Image.open(path).convert("RGBA"), dtype=np.float64)


def opaque_bbox(alpha, threshold=ALPHA_THRESHOLD):
    ys, xs = np.nonzero(alpha >= threshold)
    if len(ys) == 0:
        raise SystemExit("empty frame: no pixels above alpha threshold")
    return xs.min(), ys.min(), xs.max(), ys.max()


def premultiplied_resize(rgba, size):
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
    out = rgba.copy()
    mask = out[..., 3] >= ALPHA_THRESHOLD
    out[..., 3] = np.where(mask, 255.0, 0.0)
    out[..., :3] *= mask[..., None]
    return out.round().clip(0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--profile", required=True, help="output basename, e.g. adventurer")
    ap.add_argument("--frame", type=int, default=FRAME)
    args = ap.parse_args()
    frame_px = args.frame
    content_box = frame_px - 4
    os.makedirs(args.out, exist_ok=True)

    sources = {}
    statics, walks = [], {}
    for slot in ENGINE_SLOTS:
        p = os.path.join(args.source, f"{slot}.png")
        if os.path.isfile(p):
            sources[f"{slot}.png"] = load_rgba(p)
            statics.append(slot)
        frames = [os.path.join(args.source, f"{slot}-walk-{i}.png")
                  for i in range(WALK_FRAMES)]
        if all(os.path.isfile(f) for f in frames):
            for i, f in enumerate(frames):
                sources[f"{slot}-walk-{i}.png"] = load_rgba(f)
            walks[slot] = frames
    if not sources:
        raise SystemExit(f"no <slot>.png / <slot>-walk-<i>.png files in {args.source}")
    missing = [s for s in ENGINE_SLOTS if s not in statics]
    if missing:
        print(f"[norm] WARNING: missing static slots: {', '.join(missing)}")

    # one shared crop window + one shared scale across every frame
    boxes = {n: opaque_bbox(img[..., 3]) for n, img in sources.items()}
    ux0 = min(b[0] for b in boxes.values())
    uy0 = min(b[1] for b in boxes.values())
    ux1 = max(b[2] for b in boxes.values())
    uy1 = max(b[3] for b in boxes.values())
    uw, uh = ux1 - ux0 + 1, uy1 - uy0 + 1
    scale = min(content_box / uh, content_box / uw)
    tw, th = max(1, round(uw * scale)), max(1, round(uh * scale))
    print(f"[norm] union box {uw}x{uh} @({ux0},{uy0})  scale={scale:.5f} -> {tw}x{th}")

    def normalize(img):
        crop = img[uy0:uy1 + 1, ux0:ux1 + 1]
        small = to_binary_alpha(premultiplied_resize(crop, (tw, th)))
        _, _, _, by1 = opaque_bbox(small[..., 3], threshold=255)
        frame = np.zeros((frame_px, frame_px, 4), dtype=np.uint8)
        dy = (frame_px - 1) - by1
        dx = round(frame_px / 2 - (tw / 2))
        ys0, ys1 = max(0, dy), min(frame_px, dy + th)
        xs0, xs1 = max(0, dx), min(frame_px, dx + tw)
        frame[ys0:ys1, xs0:xs1] = small[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
        return frame

    for slot in statics:
        out_name = f"{args.profile}-{slot}.png"
        Image.fromarray(normalize(sources[f"{slot}.png"]), "RGBA").save(
            os.path.join(args.out, out_name))
        print(f"[norm] {out_name}")

    for slot, frames in walks.items():
        strip = np.zeros((frame_px, frame_px * WALK_FRAMES, 4), dtype=np.uint8)
        for i in range(WALK_FRAMES):
            strip[:, i * frame_px:(i + 1) * frame_px] = normalize(
                sources[f"{slot}-walk-{i}.png"])
        out_name = f"{args.profile}-{slot}-walk.png"
        Image.fromarray(strip, "RGBA").save(os.path.join(args.out, out_name))
        print(f"[norm] {out_name} ({frame_px * WALK_FRAMES}x{frame_px})")


if __name__ == "__main__":
    main()
