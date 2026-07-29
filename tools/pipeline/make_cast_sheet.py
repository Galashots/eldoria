"""Contact sheet of generated cast characters for North Star review.

Scans a directory of PixelLab character downloads (one subdir per character,
as written by pixellab_client.py) and lays out each character's rotations on
one row. When a character was generated more than once, metadata.json names
the CURRENT folder — stale folders from earlier attempts are ignored.

Reproduce:
  python tools/pipeline/make_cast_sheet.py \
      --cast-dir _probe_local/pipeline/cast --out cast-review-sheet.png
"""

import argparse
import json
import os

from PIL import Image, ImageDraw

ORDER = ["south", "south-east", "east", "north-east",
         "north", "north-west", "west", "south-west"]


def character_rows(cast_dir):
    for name in sorted(os.listdir(cast_dir)):
        meta_path = os.path.join(cast_dir, name, "zip", "metadata.json")
        if not os.path.isfile(meta_path):
            continue
        with open(meta_path, encoding="utf-8") as fh:
            meta = json.load(fh)
        state = meta["states"][0]
        folder = os.path.join(cast_dir, name, "zip", state["folder"], "rotations")
        if not os.path.isdir(folder):
            continue
        frames = {}
        for fn in os.listdir(folder):
            frames[os.path.splitext(fn)[0]] = os.path.join(folder, fn)
        ordered = [frames[d] for d in ORDER if d in frames]
        yield name, ordered


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cast-dir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--cell", type=int, default=128)
    args = ap.parse_args()

    rows = list(character_rows(args.cast_dir))
    if not rows:
        raise SystemExit(f"no characters with metadata.json under {args.cast_dir}")
    cell, pad, label_h = args.cell, 8, 22
    cols = max(len(r[1]) for r in rows)
    W = pad + cols * (cell + pad)
    H = pad + len(rows) * (cell + label_h + pad)
    sheet = Image.new("RGB", (W, H), (30, 32, 38))
    d = ImageDraw.Draw(sheet)
    y = pad
    for name, paths in rows:
        d.text((pad, y), name, fill=(235, 235, 235))
        for i, p in enumerate(paths):
            img = Image.open(p).convert("RGBA").resize((cell, cell), Image.NEAREST)
            x = pad + i * (cell + pad)
            cellim = Image.new("RGB", (cell, cell), (30, 32, 38))
            cellim.paste(img, (0, 0), img)
            sheet.paste(cellim, (x, y + label_h))
        y += cell + label_h + pad
    sheet.save(args.out)
    print(f"{args.out}  {W}x{H}  ({len(rows)} characters)")


if __name__ == "__main__":
    main()
