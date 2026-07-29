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
        # Fixed 8 labelled columns; None marks a missing direction so columns
        # never silently shift (the sheet must support direction review).
        yield name, [frames.get(d) for d in ORDER]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cast-dir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--cell", type=int, default=128)
    args = ap.parse_args()

    rows = list(character_rows(args.cast_dir))
    if not rows:
        raise SystemExit(f"no characters with metadata.json under {args.cast_dir}")
    cell, pad, label_h, header_h = args.cell, 8, 22, 20
    cols = len(ORDER)
    W = pad + cols * (cell + pad)
    H = header_h + pad + len(rows) * (cell + label_h + pad)
    sheet = Image.new("RGB", (W, H), (30, 32, 38))
    d = ImageDraw.Draw(sheet)
    for i, direction in enumerate(ORDER):
        d.text((pad + i * (cell + pad), 4), direction, fill=(150, 158, 172))
    y = header_h + pad
    for name, paths in rows:
        d.text((pad, y), name, fill=(235, 235, 235))
        for i, p in enumerate(paths):
            x = pad + i * (cell + pad)
            cellim = Image.new("RGB", (cell, cell), (30, 32, 38))
            if p is None:
                cd = ImageDraw.Draw(cellim)
                cd.line([(4, 4), (cell - 4, cell - 4)], fill=(198, 92, 76), width=3)
                cd.line([(cell - 4, 4), (4, cell - 4)], fill=(198, 92, 76), width=3)
                cd.text((8, cell // 2 - 6), "missing", fill=(198, 92, 76))
            else:
                img = Image.open(p).convert("RGBA").resize((cell, cell), Image.NEAREST)
                cellim.paste(img, (0, 0), img)
            sheet.paste(cellim, (x, y + label_h))
        y += cell + label_h + pad
    sheet.save(args.out)
    print(f"{args.out}  {W}x{H}  ({len(rows)} characters)")


if __name__ == "__main__":
    main()
