"""Machine gates for normalized Eldoria sprites. Exit 0 = all gates pass.

Checks every <profile>-<slot>.png and <profile>-<slot>-walk.png in a directory
against the engine contract (tools/pipeline/PIPELINE.md):

  G1 frame size      static 64x64; walk strip 256x64
  G2 binary alpha    every pixel alpha is 0 or 255
  G3 bottom anchor   lowest opaque row of every frame is row 63
  G4 side padding    >=1 fully transparent column on each side of every frame
  G5 scale spread    opaque bbox height range across statics <= 4 px,
                     width range <= 8 px (facings must read as one character)
  G6 walk stability  within a strip: centre-x range <= 2 px, top-y range <= 4 px

These are the same gates the Track 2 harness (tools/ranger-proof.mjs on
work/ranger-character-pipeline-proof) proved out, in a dependency-light Python
form so this branch is self-contained. They say nothing about whether the art
is GOOD — that judgment stays with the North Star review.

Reproduce:
  python tools/pipeline/validate_sprites.py --dir <normalized-dir> --profile adventurer
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image

FRAME = 64
ENGINE_SLOTS = ["right", "down", "left", "up"]
WALK_FRAMES = 4

failures = []


def gate(ok, label):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok:
        failures.append(label)


def frames_of(path):
    img = np.asarray(Image.open(path).convert("RGBA"))
    n = img.shape[1] // FRAME
    return [img[:, i * FRAME:(i + 1) * FRAME] for i in range(n)], img


def frame_gates(frame, label):
    alpha = frame[..., 3]
    gate(np.isin(alpha, (0, 255)).all(), f"G2 binary alpha        {label}")
    ys, xs = np.nonzero(alpha == 255)
    if len(ys) == 0:
        gate(False, f"G3 bottom anchor       {label} (empty frame)")
        return None
    gate(ys.max() == FRAME - 1, f"G3 bottom anchor       {label} (bottom={ys.max()})")
    gate(xs.min() >= 1 and xs.max() <= FRAME - 2,
         f"G4 side padding        {label} (x {xs.min()}..{xs.max()})")
    return {"w": xs.max() - xs.min() + 1, "h": ys.max() - ys.min() + 1,
            "cx": (xs.min() + xs.max()) / 2, "top": ys.min()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--profile", required=True)
    args = ap.parse_args()

    boxes = {}
    for slot in ENGINE_SLOTS:
        path = os.path.join(args.dir, f"{args.profile}-{slot}.png")
        if not os.path.isfile(path):
            print(f"SKIP {slot} (no static file)")
            continue
        frames, img = frames_of(path)
        gate(img.shape[:2] == (FRAME, FRAME) and len(frames) == 1,
             f"G1 static size 64x64   {slot} ({img.shape[1]}x{img.shape[0]})")
        box = frame_gates(frames[0], f"{slot}")
        if box:
            boxes[slot] = box

    if len(boxes) > 1:
        hs = [b["h"] for b in boxes.values()]
        ws = [b["w"] for b in boxes.values()]
        gate(max(hs) - min(hs) <= 4, f"G5 height spread <=4   ({max(hs)-min(hs)} px)")
        gate(max(ws) - min(ws) <= 8, f"G5 width spread <=8    ({max(ws)-min(ws)} px)")

    for slot in ENGINE_SLOTS:
        path = os.path.join(args.dir, f"{args.profile}-{slot}-walk.png")
        if not os.path.isfile(path):
            continue
        frames, img = frames_of(path)
        gate(img.shape[0] == FRAME and img.shape[1] == FRAME * WALK_FRAMES,
             f"G1 walk strip 256x64   {slot} ({img.shape[1]}x{img.shape[0]})")
        stats = [frame_gates(f, f"{slot}-walk-{i}") for i, f in enumerate(frames)]
        stats = [s for s in stats if s]
        if len(stats) > 1:
            cxs = [s["cx"] for s in stats]
            tops = [s["top"] for s in stats]
            gate(max(cxs) - min(cxs) <= 2,
                 f"G6 walk centre <=2     {slot} ({max(cxs)-min(cxs):.1f} px)")
            gate(max(tops) - min(tops) <= 4,
                 f"G6 walk top <=4        {slot} ({max(tops)-min(tops)} px)")

    print(f"\n{'ALL GATES PASS' if not failures else f'{len(failures)} GATE(S) FAILED'}")
    sys.exit(0 if not failures else 1)


if __name__ == "__main__":
    main()
