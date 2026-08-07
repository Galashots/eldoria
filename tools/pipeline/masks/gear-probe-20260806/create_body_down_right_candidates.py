"""Create deterministic draft body-mask candidates from the committed Ranger frame.

This is a review artifact generator only. It uses explicit integer polygons on
the 64x64 runtime canvas; it does not inspect or optimize against generated
outputs. Every output remains DRAFT — NOT OWNER/REVIEW APPROVED.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


FRAME = 64
ROOT = Path(__file__).resolve().parents[4]
BASE_PATH = ROOT / "assets" / "adventurer-down-right.png"
REJECTED_MASK_PATH = ROOT / "tools" / "pipeline" / "masks" / "gear-probe-20260806" / "body-down-right.png"
OUT_DIR = ROOT / "tools" / "pipeline" / "masks" / "gear-probe-20260806" / "body-down-right-candidates"
CONTACT_SHEET = OUT_DIR / "body-down-right-candidates-review.png"
MANIFEST = OUT_DIR / "body-down-right-candidates.json"


# Integer polygons are intentionally conservative around the face, hair,
# hands, legs, boots, and cloak. Candidate C includes only small shoulder/strap
# allowances; none of the candidates is an approval decision.
CANDIDATES = {
    "A": {
        "description": "tight central chest and abdomen envelope",
        "polygons": [
            [(27, 29), (37, 29), (38, 33), (38, 38), (39, 42), (37, 47),
             (28, 47), (26, 44), (25, 41), (26, 37), (26, 33)],
        ],
    },
    "B": {
        "description": "wider fitted breastplate envelope with lower extension",
        "polygons": [
            [(26, 29), (38, 29), (40, 33), (39, 37), (40, 42), (39, 46),
             (37, 49), (27, 49), (25, 46), (24, 42), (25, 37), (24, 33)],
        ],
    },
    "C": {
        "description": "central plate with small strap/shoulder-edge allowances",
        "polygons": [
            [(27, 30), (37, 30), (38, 34), (37, 39), (38, 44), (37, 48),
             (27, 48), (26, 44), (27, 39), (26, 34)],
            [(25, 31), (27, 31), (28, 35), (27, 37), (25, 35)],
            [(37, 31), (39, 31), (39, 35), (37, 37)],
        ],
    },
}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_mask(polygons: list[list[tuple[int, int]]]) -> Image.Image:
    mask = Image.new("L", (FRAME, FRAME), 0)
    draw = ImageDraw.Draw(mask)
    for polygon in polygons:
        draw.polygon(polygon, fill=255)
    return mask


def overlay(base: Image.Image, mask: Image.Image) -> Image.Image:
    image = base.convert("RGBA")
    tint = Image.new("RGBA", image.size, (235, 45, 45, 0))
    tint.putalpha(mask.point(lambda value: 110 if value else 0))
    return Image.alpha_composite(image, tint)


def scale(image: Image.Image, size: int = 288) -> Image.Image:
    return image.resize((size, size), Image.Resampling.NEAREST)


def label(draw: ImageDraw.ImageDraw, text: str, x: int, y: int) -> None:
    draw.text((x + 8, y + 8), text, fill="white", stroke_width=2, stroke_fill="black")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    base = Image.open(BASE_PATH).convert("RGBA")
    if base.size != (FRAME, FRAME):
        raise ValueError(f"base must be 64x64, got {base.size}")

    records: dict[str, dict[str, object]] = {}
    masks: dict[str, Image.Image] = {}
    for name, spec in CANDIDATES.items():
        mask = make_mask(spec["polygons"])
        path = OUT_DIR / f"body-down-right-candidate-{name}.png"
        mask.save(path, format="PNG", optimize=False, compress_level=9)
        masks[name] = mask
        records[name] = {
            "status": "DRAFT — NOT OWNER/REVIEW APPROVED",
            "path": str(path.relative_to(ROOT)).replace("\\", "/"),
            "base_path": str(BASE_PATH.relative_to(ROOT)).replace("\\", "/"),
            "base_sha256": sha256_file(BASE_PATH),
            "description": spec["description"],
            "polygons": spec["polygons"],
            "canvas": "64x64",
            "mode": "L",
            "binary_values": [0, 255],
            "active_pixel_count": sum(value == 255 for value in mask.getdata()),
            "sha256": sha256_file(path),
            "source": "explicit integer polygons from the committed Ranger base; no generated output used",
        }

    # 4x2 enlarged nearest-neighbour sheet: original, rejected overlay, then
    # each candidate as raw mask and overlay.
    panel = 288
    sheet = Image.new("RGB", (panel * 4, panel * 2), (45, 45, 45))
    draw = ImageDraw.Draw(sheet)
    items: list[tuple[str, Image.Image]] = [
        ("Original Ranger", base),
        ("Rejected old mask overlay", overlay(base, Image.open(REJECTED_MASK_PATH).convert("L"))),
    ]
    for name in CANDIDATES:
        items.append((f"Candidate {name} raw mask", masks[name].convert("RGBA")))
        items.append((f"Candidate {name} overlay", overlay(base, masks[name])))

    for index, (title, image) in enumerate(items):
        x = (index % 4) * panel
        y = (index // 4) * panel
        tile = scale(image, panel)
        if tile.mode == "RGBA":
            background = Image.new("RGBA", tile.size, (80, 80, 80, 255))
            background.alpha_composite(tile)
            tile = background.convert("RGB")
        sheet.paste(tile.convert("RGB"), (x, y))
        label(draw, title, x, y)
    draw.rectangle((0, 0, sheet.width - 1, sheet.height - 1), outline=(255, 215, 0), width=4)
    draw.text((12, sheet.height - 24), "ALL CANDIDATES: DRAFT - NOT OWNER/REVIEW APPROVED", fill=(255, 215, 0))
    sheet.save(CONTACT_SHEET, format="PNG", optimize=False, compress_level=9)

    manifest = {
        "status": "DRAFT — NOT OWNER/REVIEW APPROVED",
        "base_path": str(BASE_PATH.relative_to(ROOT)).replace("\\", "/"),
        "base_sha256": sha256_file(BASE_PATH),
        "rejected_historical_mask": {
            "path": str(REJECTED_MASK_PATH.relative_to(ROOT)).replace("\\", "/"),
            "sha256": sha256_file(REJECTED_MASK_PATH),
            "classification": "REJECTED FOR BODY-SLOT PRODUCTION GEOMETRY — historical probe evidence only",
        },
        "candidates": records,
        "contact_sheet": {
            "path": str(CONTACT_SHEET.relative_to(ROOT)).replace("\\", "/"),
            "sha256": sha256_file(CONTACT_SHEET),
            "layout": "4x2 nearest-neighbour panels: original, rejected overlay, and each candidate raw/overlay pair",
        },
        "generation_authorization": "none; this artifact is zero-generation mask review evidence",
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
