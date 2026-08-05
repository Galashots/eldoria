"""Make a deterministic nearest-neighbor sheet of retained NPC rotations."""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


DIRECTIONS = [
    "south",
    "south-east",
    "east",
    "north-east",
    "north",
    "north-west",
    "west",
    "south-west",
]
DEFAULT_NPCS = ["mira", "bram", "gunnar"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--cell", type=int, default=128)
    parser.add_argument("--npcs", nargs="+", default=DEFAULT_NPCS)
    args = parser.parse_args()

    root = Path(args.source_root)
    cell = args.cell
    pad = 8
    label_h = 22
    header_h = 20
    width = pad + len(DIRECTIONS) * (cell + pad)
    height = header_h + pad + len(args.npcs) * (cell + label_h + pad)
    sheet = Image.new("RGB", (width, height), (30, 32, 38))
    draw = ImageDraw.Draw(sheet)
    for index, direction in enumerate(DIRECTIONS):
        draw.text((pad + index * (cell + pad), 4), direction, fill=(150, 158, 172))

    y = header_h + pad
    for npc in args.npcs:
        draw.text((pad, y), npc, fill=(235, 235, 235))
        for index, direction in enumerate(DIRECTIONS):
            source = root / npc / f"{direction}.png"
            if not source.is_file():
                raise SystemExit(f"missing source frame: {source}")
            image = Image.open(source).convert("RGBA").resize(
                (cell, cell), Image.Resampling.NEAREST)
            x = pad + index * (cell + pad)
            sheet.paste(image, (x, y + label_h), image)
        y += cell + label_h + pad

    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)
    print(f"{output}  {width}x{height} ({len(args.npcs)} NPCs, {len(DIRECTIONS)} directions each)")


if __name__ == "__main__":
    main()
