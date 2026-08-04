#!/usr/bin/env python3
"""Deterministically crop Eldoria's 259x195 Farm transition sheets.

The source sheets are RGBA PNGs with a one-pixel gutter between 64x48 cells:
origins are x={0,65,130,195}, y={0,49,98,147}.  The encoder below is deliberately
small and stdlib-only: it writes filter-zero RGBA rows with zlib level 9 so the
same source pixels produce the same PNG bytes on every supported machine.

Production invocation:
  python tools/pipeline/slice_tileset.py \
    --source path=C:/Users/Leo/Downloads/lush_green_meadow_grass_transitioning_to_packed_li.png \
    --source soil=C:/Users/Leo/Downloads/lush_green_meadow_grass_transitioning_to_freshly_t.png \
    --source water=C:/Users/Leo/Downloads/lush_green_meadow_grass_transitioning_to_calm_deep.png \
    --out-dir assets/iso/terrain \
    --provenance-out assets/iso/terrain/terrain-provenance.json

No image is resized, colour-converted, or alpha-matted.  ``--self-test`` runs
without external files and proves crop coordinates, pixel preservation, and
byte-stability twice.
"""

from __future__ import annotations

import argparse
import binascii
import hashlib
import json
import os
from pathlib import Path
import struct
import tempfile
import zlib


MAGIC = b"\x89PNG\r\n\x1a\n"
SHEET_SIZE = (259, 195)
CELL_SIZE = (64, 48)
X_ORIGINS = (0, 65, 130, 195)
Y_ORIGINS = (0, 49, 98, 147)
MASKS = tuple(range(16))
ENCODER = "eldoria-terrain-slicer/1; stdlib PNG RGBA8; filter=0; zlib-level=9"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def png_chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", binascii.crc32(kind + data) & 0xFFFFFFFF)


def encode_png(width: int, height: int, pixels: bytes) -> bytes:
    expected = width * height * 4
    if len(pixels) != expected:
        raise ValueError(f"RGBA pixel payload is {len(pixels)} bytes; expected {expected}")
    scanlines = b"".join(b"\x00" + pixels[row * width * 4:(row + 1) * width * 4]
                          for row in range(height))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return MAGIC + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", zlib.compress(scanlines, 9)) + png_chunk(b"IEND", b"")


def decode_png(path: Path, expected_size: tuple[int, int] | None = SHEET_SIZE) -> tuple[int, int, bytes]:
    data = path.read_bytes()
    if not data.startswith(MAGIC):
        raise ValueError(f"{path}: not a PNG")
    pos = 8
    width = height = None
    bit_depth = color_type = interlace = None
    idat = bytearray()
    while pos + 12 <= len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        payload_start = pos + 8
        payload_end = payload_start + length
        if payload_end + 4 > len(data):
            raise ValueError(f"{path}: truncated {kind.decode('ascii', 'replace')} chunk")
        payload = data[payload_start:payload_end]
        if kind == b"IHDR":
            width, height, bit_depth, color_type, _compression, _filter, interlace = struct.unpack(">IIBBBBB", payload)
        elif kind == b"IDAT":
            idat.extend(payload)
        elif kind == b"IEND":
            break
        pos = payload_end + 4
    if expected_size is not None and (width, height) != expected_size:
        raise ValueError(f"{path}: expected {expected_size[0]}x{expected_size[1]}, got {width}x{height}")
    if (bit_depth, color_type, interlace) != (8, 6, 0):
        raise ValueError(f"{path}: expected non-interlaced RGBA8, got bit_depth={bit_depth} color_type={color_type} interlace={interlace}")
    raw = zlib.decompress(bytes(idat))
    stride = width * 4
    expected = height * (stride + 1)
    if len(raw) != expected:
        raise ValueError(f"{path}: decoded scanlines are {len(raw)} bytes; expected {expected}")
    pixels = bytearray(height * stride)
    previous = bytearray(stride)
    pos = 0
    for row in range(height):
        filter_type = raw[pos]
        pos += 1
        encoded = raw[pos:pos + stride]
        pos += stride
        decoded = bytearray(stride)
        for i, value in enumerate(encoded):
            left = decoded[i - 4] if i >= 4 else 0
            up = previous[i]
            up_left = previous[i - 4] if i >= 4 else 0
            if filter_type == 0:
                decoded[i] = value
            elif filter_type == 1:
                decoded[i] = (value + left) & 255
            elif filter_type == 2:
                decoded[i] = (value + up) & 255
            elif filter_type == 3:
                decoded[i] = (value + ((left + up) // 2)) & 255
            elif filter_type == 4:
                estimate = left + up - up_left
                pa = abs(estimate - left)
                pb = abs(estimate - up)
                pc = abs(estimate - up_left)
                predictor = left if pa <= pb and pa <= pc else up if pb <= pc else up_left
                decoded[i] = (value + predictor) & 255
            else:
                raise ValueError(f"{path}: unsupported PNG filter {filter_type}")
        pixels[row * stride:(row + 1) * stride] = decoded
        previous = decoded
    return width, height, bytes(pixels)


def crop_pixels(pixels: bytes, width: int, x: int, y: int) -> bytes:
    cell_w, cell_h = CELL_SIZE
    stride = width * 4
    return b"".join(
        pixels[(y + row) * stride + x * 4:(y + row) * stride + (x + cell_w) * 4]
        for row in range(cell_h)
    )


def parse_sources(values: list[str]) -> dict[str, Path]:
    result: dict[str, Path] = {}
    for value in values:
        if "=" not in value:
            raise ValueError(f"--source must be FAMILY=PATH, got {value!r}")
        family, raw_path = value.split("=", 1)
        if family not in {"path", "soil", "water"}:
            raise ValueError(f"unknown terrain family {family!r}")
        if family in result:
            raise ValueError(f"duplicate source family {family!r}")
        result[family] = Path(raw_path).expanduser().resolve()
    if set(result) != {"path", "soil", "water"}:
        raise ValueError("exactly one path, soil, and water source is required")
    return result


def slice_sources(sources: dict[str, Path], out_dir: Path, provenance_out: Path,
                  library_url: str, library_name: str, download_date: str) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    provenance = {
        "schemaVersion": 1,
        "encoder": ENCODER,
        "sourceGeometry": {
            "sheetWidth": SHEET_SIZE[0], "sheetHeight": SHEET_SIZE[1],
            "cellWidth": CELL_SIZE[0], "cellHeight": CELL_SIZE[1],
            "gutterX": 1, "gutterY": 1, "outerMargin": 0,
            "xOrigins": list(X_ORIGINS), "yOrigins": list(Y_ORIGINS),
            "rowOrder": "north-to-south, rows 0..3",
            "columnOrder": "west-to-east, columns 0..3",
            "maskOrder": "explicit mask map; not inferred at runtime",
        },
        "sources": [],
        "outputs": [],
    }
    for family in ("path", "soil", "water"):
        source_path = sources[family]
        source_bytes = source_path.read_bytes()
        width, height, pixels = decode_png(source_path, SHEET_SIZE)
        source_record = {
            "family": family,
            "sourceFilename": source_path.name,
            "sourceSha256": sha256(source_bytes),
            "libraryName": library_name,
            "libraryUrl": library_url,
            "downloadDate": download_date,
            "outputs": [],
        }
        for mask in MASKS:
            row, column = divmod(mask, 4)
            origin = (X_ORIGINS[column], Y_ORIGINS[row])
            crop = crop_pixels(pixels, width, *origin)
            filename = f"{family}-{mask:02d}.png"
            output_path = out_dir / filename
            output_bytes = encode_png(CELL_SIZE[0], CELL_SIZE[1], crop)
            output_path.write_bytes(output_bytes)
            output_record = {
                "path": f"assets/iso/terrain/{filename}",
                "runtimeKey": f"iso_terrain_{family}_{mask:02d}",
                "family": "farm-iso-terrain-transition",
                "renderLayer": "Farm ground Pass 1",
                "mask": mask,
                "sourceTile": f"tile_{mask}",
                "row": row,
                "column": column,
                "cropOrigin": {"x": origin[0], "y": origin[1]},
                "pixelSha256": sha256(crop),
                "sha256": sha256(output_bytes),
                "dimensions": {"width": CELL_SIZE[0], "height": CELL_SIZE[1]},
            }
            source_record["outputs"].append(output_record)
            provenance["outputs"].append(output_record)
        # Mask 15 is the all-grass base crop. Keep one deterministic variant per
        # source family so the Farm's plain grass has stable, authored variety.
        base_filename = f"grass-base-{family}.png"
        base_crop = crop_pixels(pixels, width, X_ORIGINS[3], Y_ORIGINS[3])
        base_bytes = encode_png(CELL_SIZE[0], CELL_SIZE[1], base_crop)
        (out_dir / base_filename).write_bytes(base_bytes)
        base_record = {
            "path": f"assets/iso/terrain/{base_filename}",
            "runtimeKey": f"iso_terrain_grass_base_{family}",
            "family": "farm-iso-terrain-grass-base",
            "renderLayer": "Farm ground Pass 1",
            "mask": 15,
            "sourceTile": "tile_15",
            "row": 3,
            "column": 3,
            "cropOrigin": {"x": X_ORIGINS[3], "y": Y_ORIGINS[3]},
            "pixelSha256": sha256(base_crop),
            "sha256": sha256(base_bytes),
            "dimensions": {"width": CELL_SIZE[0], "height": CELL_SIZE[1]},
        }
        source_record["grassBase"] = base_record
        provenance["outputs"].append(base_record)
        provenance["sources"].append(source_record)
    provenance["outputs"].sort(key=lambda item: item["path"])
    provenance["sources"].sort(key=lambda item: item["family"])
    provenance_out.parent.mkdir(parents=True, exist_ok=True)
    provenance_out.write_text(json.dumps(provenance, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return provenance


def self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="eldoria-terrain-slicer-") as raw:
        root = Path(raw)
        source_paths: dict[str, Path] = {}
        pixels = bytearray(SHEET_SIZE[0] * SHEET_SIZE[1] * 4)
        for y in range(SHEET_SIZE[1]):
            for x in range(SHEET_SIZE[0]):
                i = (y * SHEET_SIZE[0] + x) * 4
                in_cell = x % 65 < 64 and y % 49 < 48
                pixels[i:i + 4] = bytes(((x * 3) & 255, (y * 5) & 255, (x + y) & 255, 255 if in_cell else 0))
        for family in ("path", "soil", "water"):
            path = root / f"{family}.png"
            path.write_bytes(encode_png(*SHEET_SIZE, bytes(pixels)))
            source_paths[family] = path
        first = root / "first"
        second = root / "second"
        one = slice_sources(source_paths, first, first / "provenance.json", "https://example.invalid/pixellab", "self-test", "self-test")
        two = slice_sources(source_paths, second, second / "provenance.json", "https://example.invalid/pixellab", "self-test", "self-test")
        if json.dumps(one, sort_keys=True) != json.dumps(two, sort_keys=True):
            raise AssertionError("provenance differs between identical slicer runs")
        for path in sorted(first.glob("*.png")):
            other = second / path.name
            if path.read_bytes() != other.read_bytes():
                raise AssertionError(f"output bytes differ between runs: {path.name}")
        sample = first / "path-07.png"
        _w, _h, actual = decode_png(sample, None)
        expected = crop_pixels(bytes(pixels), SHEET_SIZE[0], X_ORIGINS[3], Y_ORIGINS[1])
        if actual != expected:
            raise AssertionError("pixel-for-pixel crop mismatch at mask 7")
        if len(list(first.glob("*.png"))) != 51:
            raise AssertionError("expected 48 transition outputs plus 3 grass bases")
    print("PASS terrain slicer self-test: crop origins, pixels, and bytes are stable")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", action="append", default=[], metavar="FAMILY=PATH")
    parser.add_argument("--out-dir", type=Path, default=Path("assets/iso/terrain"))
    parser.add_argument("--provenance-out", type=Path, default=Path("assets/iso/terrain/terrain-provenance.json"))
    parser.add_argument("--library-url", default="https://www.pixellab.ai/")
    parser.add_argument("--library-name", default="PixelLab library transition sheets")
    parser.add_argument("--download-date", default="2026-08-04 (local provenance capture)")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    try:
        sources = parse_sources(args.source)
        for path in sources.values():
            if not path.is_file():
                raise ValueError(f"source does not exist: {path}")
        result = slice_sources(sources, args.out_dir, args.provenance_out,
                               args.library_url, args.library_name, args.download_date)
    except (OSError, ValueError, zlib.error) as error:
        raise SystemExit(f"terrain slicer: {error}") from error
    print(f"Wrote {len(result['outputs'])} runtime PNGs and {args.provenance_out}")


if __name__ == "__main__":
    main()
