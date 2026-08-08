"""Build deterministic custody measurements and a six-panel gear contact sheet."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw


FRAME = 64


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, type=Path)
    parser.add_argument("--mask", required=True, type=Path)
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--layer", required=True, type=Path)
    parser.add_argument("--recomposed", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    base = Image.open(args.base).convert("RGBA")
    mask = Image.open(args.mask).convert("L")
    candidate = Image.open(args.candidate).convert("RGBA")
    layer = Image.open(args.layer).convert("RGBA")
    recomposed = Image.open(args.recomposed).convert("RGBA")
    if any(image.size != (FRAME, FRAME) for image in (base, mask, candidate, layer, recomposed)):
        raise SystemExit("all evidence images must be 64x64")
    base_pixels = list(base.getdata())
    candidate_pixels = list(candidate.getdata())
    active = list(mask.getdata())
    changed = [index for index, (before, after) in enumerate(zip(base_pixels, candidate_pixels)) if before != after]
    off_mask = [index for index in changed if active[index] != 255]
    to_coord = lambda indices: [[index % FRAME, index // FRAME] for index in indices]
    measurements = {
        "base_sha256": sha(args.base),
        "candidate_sha256": sha(args.candidate),
        "mask_sha256": sha(args.mask),
        "changed_pixel_count": len(changed),
        "changed_coordinates": to_coord(changed),
        "off_mask_changed_pixel_count": len(off_mask),
        "off_mask_changed_coordinates": to_coord(off_mask),
        "candidate_alpha_values": sorted({pixel[3] for pixel in candidate_pixels}),
        "extracted_layer_sha256": sha(args.layer),
        "recomposed_sha256": sha(args.recomposed),
        "recomposition_pixel_identical": recomposed.tobytes() == candidate.tobytes(),
        "deterministic_outputs": {
            "layer_sha256_repeat": sha(args.layer),
            "recomposed_sha256_repeat": sha(args.recomposed),
        },
    }
    (args.out_dir / "custody-measurements.json").write_text(
        json.dumps(measurements, indent=2) + "\n", encoding="utf-8"
    )

    scale = 3
    panel_size = (FRAME * scale, FRAME * scale)
    sheet = Image.new("RGBA", (panel_size[0] * 3, panel_size[1] * 2), (24, 24, 24, 255))
    draw = ImageDraw.Draw(sheet)

    def enlarge(image: Image.Image) -> Image.Image:
        return image.resize(panel_size, Image.Resampling.NEAREST)

    def mask_overlay() -> Image.Image:
        result = base.copy()
        pixels = list(result.getdata())
        for index, value in enumerate(active):
            if value == 255:
                r, g, b, a = pixels[index]
                pixels[index] = (255, 214, 0, max(a, 220))
        result.putdata(pixels)
        return result

    def diff_image() -> Image.Image:
        result = Image.new("RGBA", (FRAME, FRAME), (20, 20, 20, 255))
        pixels = list(result.getdata())
        for index in changed:
            pixels[index] = (255, 214, 0, 255) if active[index] == 255 else (230, 40, 40, 255)
        result.putdata(pixels)
        return result

    panels = [base, mask_overlay(), candidate, diff_image(), layer, recomposed]
    titles = ["Original Ranger", "Candidate C overlay", "Raw API result", "True changed pixels", "Extracted gear", "Recomposed Ranger"]
    for index, (panel, title) in enumerate(zip(panels, titles)):
        x = (index % 3) * panel_size[0]
        y = (index // 3) * panel_size[1]
        sheet.alpha_composite(enlarge(panel), (x, y))
        draw.rectangle((x, y, x + panel_size[0] - 1, y + 12), fill=(0, 0, 0, 210))
        draw.text((x + 2, y + 1), title, fill=(255, 255, 255, 255))
    sheet.save(args.out_dir / "api-inpaint-v3-candidate-c-contact-sheet.png", format="PNG", optimize=False, compress_level=9)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
