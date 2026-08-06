"""Process static NPC rotations without changing source pixels.

The supplied PixelLab packs are square RGBA canvases whose character pixels
already fit the Eldoria 64x64 frame. This tool removes only transparent outer
margin, translates the exact RGBA crop onto a 64x64 transparent canvas, and
never resamples, recolours, thresholds, sharpens, or redraws a pixel.

Example:
  python tools/pipeline/process_npc_static.py \
      --pack "mira|CHARACTER_ID|C:/path/Mira.zip" \
      --pack "bram|CHARACTER_ID|C:/path/Bram.zip" \
      --pack "gunnar|CHARACTER_ID|C:/path/Gunnar.zip" \
      --source-root docs/visual/reviews/npc-sprite-integration-20260805/source-rotations \
      --runtime-root assets/iso/npc \
      --validation-root _probe_local/pipeline/npc-static-validation \
      --report docs/visual/reviews/npc-sprite-integration-20260805/npc-direction-map.json
"""

import argparse
import hashlib
import io
import json
import zipfile
from pathlib import Path

from PIL import Image


FRAME = 64
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
DIRECTION_TO_SLOT = {
    "south": "down-right",
    "south-east": "right",
    "east": "up-right",
    "north-east": "up",
    "north": "up-left",
    "north-west": "left",
    "west": "down-left",
    "south-west": "down",
}


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    return sha256_bytes(path.read_bytes())


def relative(path, root):
    return path.resolve().relative_to(root.resolve()).as_posix()


def parse_pack(spec):
    parts = spec.split("|", 2)
    if len(parts) != 3 or not all(parts):
        raise SystemExit("--pack must be NPC_ID|CHARACTER_ID|ZIP_PATH")
    return parts[0], parts[1], Path(parts[2])


def process_frame(raw_png, label):
    image = Image.open(io.BytesIO(raw_png)).convert("RGBA")
    if image.width != image.height or image.width < FRAME:
        raise SystemExit(f"{label}: expected a square canvas at least {FRAME}x{FRAME}, got {image.size}")
    alpha_values = set(image.getchannel("A").getdata())
    if not alpha_values.issubset({0, 255}):
        raise SystemExit(f"{label}: source alpha is not binary: {sorted(alpha_values)}")
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise SystemExit(f"{label}: source frame is empty")
    crop = image.crop(bbox)
    if crop.width > FRAME or crop.height > FRAME:
        raise SystemExit(f"{label}: opaque crop {crop.size} exceeds {FRAME}x{FRAME}")
    left = (FRAME - crop.width) // 2
    top = FRAME - crop.height
    output = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    # Paste without a mask: transparent pixels inside the source crop are
    # preserved exactly instead of being composited or rewritten.
    output.paste(crop, (left, top))
    out_bbox = output.getchannel("A").getbbox()
    if out_bbox != (left, top, left + crop.width, FRAME):
        raise SystemExit(f"{label}: translation produced unexpected bbox {out_bbox}")
    return image, crop, output, bbox, left, top


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pack", action="append", required=True,
                        help="NPC_ID|CHARACTER_ID|ZIP_PATH; repeat once per NPC")
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--runtime-root", required=True)
    parser.add_argument("--validation-root", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()

    repo = Path.cwd().resolve()
    source_root = Path(args.source_root)
    runtime_root = Path(args.runtime_root)
    validation_root = Path(args.validation_root)
    report_path = Path(args.report)
    for path in (source_root, runtime_root, validation_root, report_path.parent):
        path.mkdir(parents=True, exist_ok=True)

    packs = []
    seen_ids = set()
    for spec in args.pack:
        npc_id, character_id, zip_path = parse_pack(spec)
        if npc_id in seen_ids:
            raise SystemExit(f"duplicate NPC id: {npc_id}")
        seen_ids.add(npc_id)
        if not zip_path.is_file():
            raise SystemExit(f"missing source ZIP: {zip_path}")
        zip_hash = sha256_file(zip_path)
        frames = []
        with zipfile.ZipFile(zip_path) as archive:
            for direction in DIRECTIONS:
                member = f"Idle/rotations/{direction}.png"
                try:
                    raw_png = archive.read(member)
                except KeyError as exc:
                    raise SystemExit(f"{zip_path}: missing {member}") from exc
                label = f"{npc_id}/{direction}"
                image, crop, output, bbox, left, top = process_frame(raw_png, label)
                source_path = source_root / npc_id / f"{direction}.png"
                source_path.parent.mkdir(parents=True, exist_ok=True)
                output.save(source_path)

                slot = DIRECTION_TO_SLOT[direction]
                validation_path = validation_root / f"{npc_id}-{slot}.png"
                validation_path.parent.mkdir(parents=True, exist_ok=True)
                output.save(validation_path)

                runtime_path = None
                if direction == "south":
                    runtime_path = runtime_root / f"{npc_id}-down-right.png"
                    runtime_path.parent.mkdir(parents=True, exist_ok=True)
                    output.save(runtime_path)

                frames.append({
                    "vendorDirection": direction,
                    "engineSlot": slot,
                    "sourceMember": member,
                    "sourcePngSha256": sha256_bytes(raw_png),
                    "sourceOpaqueBbox": list(bbox),
                    "sourceCropSize": [crop.width, crop.height],
                    "sourceCropRgbaSha256": sha256_bytes(crop.tobytes()),
                    "outputPath": relative(source_path, repo),
                    "outputSha256": sha256_file(source_path),
                    "outputPixelCropSha256": sha256_bytes(
                        output.crop((left, top, left + crop.width, FRAME)).tobytes()),
                    "runtimePath": relative(runtime_path, repo) if runtime_path else None,
                    "processing": "crop-transparent-bbox-and-translate-only",
                })
        packs.append({
            "npcId": npc_id,
            "characterId": character_id,
            "sourceZip": zip_path.name,
            "sourceZipSha256": zip_hash,
            "frames": frames,
        })

    packs.sort(key=lambda pack: pack["npcId"])
    report = {
        "frameSize": {"width": FRAME, "height": FRAME},
        "directionMap": DIRECTION_TO_SLOT,
        "processing": "lossless crop of transparent outer margin, then integer translation onto a 64x64 transparent canvas; no resampling, recolouring, thresholding, sharpening, or redraw",
        "packs": packs,
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "sourceFrames": len(packs) * len(DIRECTIONS),
        "runtimeFrames": len(packs),
        "report": relative(report_path, repo),
    }, indent=2))


if __name__ == "__main__":
    main()
