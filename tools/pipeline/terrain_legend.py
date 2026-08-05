#!/usr/bin/env python3
"""Generate the human-verification contact sheets for Farm terrain sources.

This is deliberately a legend generator, not a terrain mapper. It crops the same
vendor sheets consumed by ``slice_tileset.py`` in the measured gutter-aware order:

  sheet 259x195; cells 64x48; x origins 0,65,130,195; y origins 0,49,98,147

Each output is a 4x4 contact sheet. Cell 0..15 are shown in vendor reading order
and the only labels in the image are those decimal cell indices. No mask, topology,
polarity, or material interpretation is inferred or emitted. Source pixels are
expanded by integer nearest-neighbor replication only; no smoothing or resampling
is used. Transparent source pixels are composited onto a fixed dark inspection
background so the authored silhouette remains visible in ordinary image viewers.

Production invocation from the repository root:

  python tools/pipeline/terrain_legend.py \
    --source path=C:/Users/Leo/Downloads/lush_green_meadow_grass_transitioning_to_packed_li.png \
    --source soil=C:/Users/Leo/Downloads/lush_green_meadow_grass_transitioning_to_freshly_t.png \
    --source water=C:/Users/Leo/Downloads/lush_green_meadow_grass_transitioning_to_calm_deep.png

The default output is docs/visual/terrain-legend/ and includes three PNGs plus
terrain-legend-provenance.json. ``--self-test`` generates two identical runs from
synthetic RGBA8 source bytes and compares every output byte.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import tempfile
import zlib

from slice_tileset import (
    CELL_SIZE,
    SHEET_SIZE,
    X_ORIGINS,
    Y_ORIGINS,
    crop_pixels,
    decode_png,
    encode_png,
)


UPSCALE = 4
LABEL_HEIGHT = 36
SHEET_GAP = 12
BACKGROUND = (38, 26, 14, 255)
PANEL = (62, 42, 22, 255)
LABEL_INK = (255, 220, 120, 255)
CELL_OUTPUT_SIZE = (CELL_SIZE[0] * UPSCALE, CELL_SIZE[1] * UPSCALE)
PANEL_SIZE = (CELL_OUTPUT_SIZE[0], CELL_OUTPUT_SIZE[1] + LABEL_HEIGHT)
OUTPUT_SIZE = (
    PANEL_SIZE[0] * 4 + SHEET_GAP * 3,
    PANEL_SIZE[1] * 4 + SHEET_GAP * 3,
)

# A tiny deterministic 5x7 font for decimal cell indices. These glyphs are labels,
# not source-art pixels; all source image pixels are handled separately below.
DIGITS = {
    "0": ("11111", "10001", "10001", "10001", "10001", "10001", "11111"),
    "1": ("00100", "01100", "00100", "00100", "00100", "00100", "01110"),
    "2": ("11111", "00001", "00001", "11111", "10000", "10000", "11111"),
    "3": ("11111", "00001", "00001", "01111", "00001", "00001", "11111"),
    "4": ("10001", "10001", "10001", "11111", "00001", "00001", "00001"),
    "5": ("11111", "10000", "10000", "11111", "00001", "00001", "11111"),
    "6": ("11111", "10000", "10000", "11111", "10001", "10001", "11111"),
    "7": ("11111", "00001", "00010", "00100", "01000", "01000", "01000"),
    "8": ("11111", "10001", "10001", "11111", "10001", "10001", "11111"),
    "9": ("11111", "10001", "10001", "11111", "00001", "00001", "11111"),
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def blend_over_background(rgba: bytes, pixel_index: int) -> tuple[int, int, int, int]:
    """Composite one source pixel onto the fixed opaque inspection background."""
    offset = pixel_index * 4
    sr, sg, sb, alpha = rgba[offset:offset + 4]
    if alpha == 255:
        return sr, sg, sb, 255
    if alpha == 0:
        return BACKGROUND
    br, bg, bb, _ = BACKGROUND
    return (
        (sr * alpha + br * (255 - alpha) + 127) // 255,
        (sg * alpha + bg * (255 - alpha) + 127) // 255,
        (sb * alpha + bb * (255 - alpha) + 127) // 255,
        255,
    )


def draw_scaled_cell(out: bytearray, crop: bytes, panel_x: int, panel_y: int) -> None:
    """Copy every source pixel to a UPSCALE x UPSCALE block, with no filtering."""
    cell_width, cell_height = CELL_SIZE
    output_width = OUTPUT_SIZE[0]
    for source_y in range(cell_height):
        for source_x in range(cell_width):
            color = blend_over_background(crop, source_y * cell_width + source_x)
            for dy in range(UPSCALE):
                target_y = panel_y + source_y * UPSCALE + dy
                row_offset = target_y * output_width * 4
                for dx in range(UPSCALE):
                    target_x = panel_x + source_x * UPSCALE + dx
                    target = row_offset + target_x * 4
                    out[target:target + 4] = bytes(color)


def draw_label(out: bytearray, label: str, panel_x: int, panel_y: int) -> None:
    """Draw the decimal index only, centered in the panel's label strip."""
    scale = 3
    glyph_width = 5 * scale
    spacing = scale
    total_width = len(label) * glyph_width + (len(label) - 1) * spacing
    start_x = panel_x + (PANEL_SIZE[0] - total_width) // 2
    start_y = panel_y + CELL_OUTPUT_SIZE[1] + (LABEL_HEIGHT - 7 * scale) // 2
    output_width = OUTPUT_SIZE[0]
    for glyph_number, glyph_char in enumerate(label):
        glyph = DIGITS[glyph_char]
        glyph_x = start_x + glyph_number * (glyph_width + spacing)
        for row, bits in enumerate(glyph):
            for column, bit in enumerate(bits):
                if bit != "1":
                    continue
                for dy in range(scale):
                    target_y = start_y + row * scale + dy
                    row_offset = target_y * output_width * 4
                    for dx in range(scale):
                        target_x = glyph_x + column * scale + dx
                        target = row_offset + target_x * 4
                        out[target:target + 4] = bytes(LABEL_INK)


def generate_sheet(source_path: Path, output_path: Path) -> dict:
    source_bytes = source_path.read_bytes()
    width, height, pixels = decode_png(source_path, SHEET_SIZE)
    output = bytearray(BACKGROUND * (OUTPUT_SIZE[0] * OUTPUT_SIZE[1]))
    cells = []
    for index in range(16):
        row, column = divmod(index, 4)
        origin = (X_ORIGINS[column], Y_ORIGINS[row])
        crop = crop_pixels(pixels, width, *origin)
        panel_x = column * (PANEL_SIZE[0] + SHEET_GAP)
        panel_y = row * (PANEL_SIZE[1] + SHEET_GAP)
        # PANEL is a border/label surface; the tile itself is then copied at 1:1
        # source-pixel identity per nearest-neighbor block.
        for y in range(PANEL_SIZE[1]):
            row_start = ((panel_y + y) * OUTPUT_SIZE[0] + panel_x) * 4
            output[row_start:row_start + PANEL_SIZE[0] * 4] = bytes(PANEL) * PANEL_SIZE[0]
        draw_scaled_cell(output, crop, panel_x, panel_y)
        draw_label(output, str(index), panel_x, panel_y)
        cells.append({
            "cellIndex": index,
            "vendorRow": row,
            "vendorColumn": column,
            "cropOrigin": {"x": origin[0], "y": origin[1]},
            "sourcePixelSha256": sha256(crop),
        })
    output_bytes = encode_png(OUTPUT_SIZE[0], OUTPUT_SIZE[1], bytes(output))
    output_path.write_bytes(output_bytes)
    return {
        "output": output_path.name,
        "outputSha256": sha256(output_bytes),
        "dimensions": {"width": OUTPUT_SIZE[0], "height": OUTPUT_SIZE[1]},
        "cells": cells,
    }


def generate(sources: dict[str, Path], output_dir: Path, provenance_path: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for family in ("path", "soil", "water"):
        source_path = sources[family]
        output_path = output_dir / f"{family}-contact-sheet.png"
        record = generate_sheet(source_path, output_path)
        record.update({
            "family": family,
            "sourceFilename": source_path.name,
            "sourceSha256": sha256(source_path.read_bytes()),
        })
        records.append(record)
    provenance = {
        "schemaVersion": 1,
        "generator": "eldoria-terrain-legend/1; stdlib PNG RGBA8; filter=0; zlib-level=9",
        "purpose": "Human cell legend only; no mask or topology inference is recorded.",
        "sourceGeometry": {
            "sheetWidth": SHEET_SIZE[0],
            "sheetHeight": SHEET_SIZE[1],
            "cellWidth": CELL_SIZE[0],
            "cellHeight": CELL_SIZE[1],
            "gutterX": 1,
            "gutterY": 1,
            "outerMargin": 0,
            "xOrigins": list(X_ORIGINS),
            "yOrigins": list(Y_ORIGINS),
            "order": "vendor reading order: row north-to-south, column west-to-east",
        },
        "rendering": {
            "upscale": UPSCALE,
            "filter": "nearest-neighbor integer replication only",
            "smoothing": False,
            "label": "decimal cell index only",
            "outputDimensions": {"width": OUTPUT_SIZE[0], "height": OUTPUT_SIZE[1]},
        },
        "families": sorted(records, key=lambda item: item["family"]),
    }
    provenance_path.parent.mkdir(parents=True, exist_ok=True)
    provenance_path.write_text(json.dumps(provenance, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return provenance


def parse_sources(values: list[str], root: Path) -> dict[str, Path]:
    result = {}
    for value in values:
        if "=" not in value:
            raise ValueError(f"--source must be FAMILY=PATH, got {value!r}")
        family, raw_path = value.split("=", 1)
        if family not in {"path", "soil", "water"}:
            raise ValueError(f"unknown terrain family {family!r}")
        if family in result:
            raise ValueError(f"duplicate source family {family!r}")
        path = Path(raw_path).expanduser()
        result[family] = path if path.is_absolute() else root / path
    if set(result) != {"path", "soil", "water"}:
        raise ValueError("exactly one path, soil, and water source is required")
    return result


def self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="eldoria-terrain-legend-") as raw:
        root = Path(raw)
        pixels = bytearray(SHEET_SIZE[0] * SHEET_SIZE[1] * 4)
        for y in range(SHEET_SIZE[1]):
            for x in range(SHEET_SIZE[0]):
                index = (y * SHEET_SIZE[0] + x) * 4
                in_cell = x % 65 < 64 and y % 49 < 48
                pixels[index:index + 4] = bytes(((x * 3) & 255, (y * 5) & 255, (x + y) & 255, 255 if in_cell else 0))
        sources = {}
        for family in ("path", "soil", "water"):
            source = root / f"{family}.png"
            source.write_bytes(encode_png(*SHEET_SIZE, bytes(pixels)))
            sources[family] = source
        first = root / "first"
        second = root / "second"
        generate(sources, first, first / "provenance.json")
        generate(sources, second, second / "provenance.json")
        for first_file in sorted(first.iterdir()):
            if first_file.read_bytes() != (second / first_file.name).read_bytes():
                raise AssertionError(f"output differs between identical runs: {first_file.name}")
    print("PASS terrain legend self-test: crop origins, labels, and bytes are stable")


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", action="append", default=[], metavar="FAMILY=PATH")
    parser.add_argument("--out-dir", type=Path, default=root / "docs/visual/terrain-legend")
    parser.add_argument("--provenance-out", type=Path, default=None)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    defaults = [
        f"path={Path.home() / 'Downloads/lush_green_meadow_grass_transitioning_to_packed_li.png'}",
        f"soil={Path.home() / 'Downloads/lush_green_meadow_grass_transitioning_to_freshly_t.png'}",
        f"water={Path.home() / 'Downloads/lush_green_meadow_grass_transitioning_to_calm_deep.png'}",
    ]
    try:
        sources = parse_sources(args.source or defaults, root)
        for source in sources.values():
            if not source.is_file():
                raise ValueError(f"source does not exist: {source}")
        output_dir = args.out_dir if args.out_dir.is_absolute() else root / args.out_dir
        provenance = args.provenance_out or output_dir / "terrain-legend-provenance.json"
        if not provenance.is_absolute():
            provenance = root / provenance
        result = generate(sources, output_dir, provenance)
    except (OSError, ValueError, zlib.error) as error:
        raise SystemExit(f"terrain legend: {error}") from error
    print(f"Wrote {len(result['families'])} terrain legend contact sheets and {provenance}")


if __name__ == "__main__":
    main()
