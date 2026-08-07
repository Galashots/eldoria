"""Prepare zero-cost custody evidence for the approved Candidate C probe mask."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[4]
BASE = ROOT / "assets" / "adventurer-down-right.png"
CANDIDATE = ROOT / "tools" / "pipeline" / "masks" / "gear-probe-20260806" / "body-down-right-candidates" / "body-down-right-candidate-C.png"
OUT = ROOT / "docs" / "playtest" / "2026-08-06-pixellab-gear-probe" / "h5-inpaint-v3-candidate-c-armour-down-right"
MODEL_MASK = OUT / "pixellab-inpainting-black-body-down-right-candidate-c.png"
PROTECTED_MASK = OUT / "protected-identity-face-skin-hands-down-right.png"
RECORD = OUT / "mask-preflight.json"

FRAME = 64

# Explicit review geometry, independent of every generated result. Face/skin
# ends before y=30; arms/hands are protected separately for the identity check.
FACE_SKIN_POLYGONS = [
    [(27, 18), (36, 18), (38, 22), (37, 27), (35, 29), (29, 29), (26, 27), (26, 22)],
]
IDENTITY_POLYGONS = FACE_SKIN_POLYGONS + [
    [(18, 31), (24, 31), (25, 43), (22, 45), (18, 42)],
    [(40, 31), (46, 31), (46, 42), (43, 45), (40, 43)],
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_mask(polygons: list[list[tuple[int, int]]]) -> Image.Image:
    mask = Image.new("L", (FRAME, FRAME), 0)
    draw = ImageDraw.Draw(mask)
    for polygon in polygons:
        draw.polygon(polygon, fill=255)
    return mask


def active(mask: Image.Image) -> set[tuple[int, int]]:
    return {(index % FRAME, index // FRAME) for index, value in enumerate(mask.getdata()) if value == 255}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    base = Image.open(BASE).convert("RGBA")
    candidate = Image.open(CANDIDATE)
    if base.size != (FRAME, FRAME) or base.mode != "RGBA":
        raise ValueError("base must be exact 64x64 RGBA")
    if candidate.size != (FRAME, FRAME) or candidate.mode != "L":
        raise ValueError("Candidate C must be exact 64x64 grayscale")
    values = set(candidate.getdata())
    if not values.issubset({0, 255}):
        raise ValueError(f"Candidate C is not binary: {sorted(values)}")
    if sha256(CANDIDATE) != "454d285e9d3a4782ade5a16f65327d8941950a4fef01ad7bc9ba2a5b3163832d":
        raise ValueError("Candidate C SHA-256 does not match the approved review result")

    candidate_active = active(candidate)
    face_skin = make_mask(FACE_SKIN_POLYGONS)
    identity = make_mask(IDENTITY_POLYGONS)
    face_skin_active = active(face_skin)
    identity_active = active(identity)
    face_overlap = sorted(candidate_active & face_skin_active)
    identity_overlap = sorted(candidate_active & identity_active)
    if face_overlap or identity_overlap:
        raise ValueError(f"protected overlap: face/skin={face_overlap}, identity={identity_overlap}")

    # PixelLab's model-facing convention: black opaque editable pixels and
    # transparent pixels outside. Coordinates are copied, never transformed.
    model = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    model_pixels = model.load()
    for x, y in sorted(candidate_active, key=lambda point: (point[1], point[0])):
        model_pixels[x, y] = (0, 0, 0, 255)
    model.save(MODEL_MASK, format="PNG", optimize=False, compress_level=9)
    face_skin.save(PROTECTED_MASK, format="PNG", optimize=False, compress_level=9)

    record = {
        "status": "PROBE PREPARATION — ZERO GENERATIONS",
        "base": {
            "path": str(BASE.relative_to(ROOT)).replace("\\", "/"),
            "sha256": sha256(BASE),
            "canvas": "64x64",
            "mode": "RGBA",
        },
        "candidate_c": {
            "path": str(CANDIDATE.relative_to(ROOT)).replace("\\", "/"),
            "sha256": sha256(CANDIDATE),
            "active_pixel_count": len(candidate_active),
            "canvas": "64x64",
            "mode": "L",
            "binary_values": [0, 255],
            "active_coordinates": sorted(candidate_active, key=lambda point: (point[1], point[0])),
            "geometry_change": "none",
            "review_status": "APPROVED FOR ONE PR54 INPAINT V3 BODY-ARMOUR PROBE ONLY",
        },
        "protected_regions": {
            "face_skin_polygons": FACE_SKIN_POLYGONS,
            "identity_polygons": IDENTITY_POLYGONS,
            "face_skin_mask": str(PROTECTED_MASK.relative_to(ROOT)).replace("\\", "/"),
            "face_skin_active_pixel_count": len(face_skin_active),
            "identity_active_pixel_count": len(identity_active),
            "candidate_face_skin_overlap_count": len(face_overlap),
            "candidate_identity_overlap_count": len(identity_overlap),
            "candidate_face_skin_overlap_coordinates": face_overlap,
            "candidate_identity_overlap_coordinates": identity_overlap,
            "result": "PASS — zero overlap",
        },
        "pixellab_facing_mask": {
            "path": str(MODEL_MASK.relative_to(ROOT)).replace("\\", "/"),
            "sha256": sha256(MODEL_MASK),
            "active_pixel_count": len(active(Image.open(MODEL_MASK).getchannel("A"))),
            "representation": "black opaque active pixels; transparent outside",
            "active_coordinates_identical": active(Image.open(MODEL_MASK).getchannel("A")) == candidate_active,
            "geometry_change": "none; no dilation, erosion, expansion, translation, repaint, crop, scale, or interpolation",
        },
        "generation_authorization": "one Inpaint v3 call only after this preflight; no other paid method authorized",
    }
    RECORD.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
