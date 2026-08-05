"""Check the committed NPC source frames against the lossless processing report."""

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path.cwd()
REPORT = ROOT / "docs/visual/reviews/npc-sprite-integration-20260805/npc-direction-map.json"
failures = []


def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok:
        failures.append(label)


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


data = json.loads(REPORT.read_text(encoding="utf-8"))
frames = [(pack["npcId"], frame) for pack in data["packs"] for frame in pack["frames"]]
check("24 committed source direction records", len(frames) == 24)
check("processor declares crop/translate-only processing",
      data["processing"].startswith("lossless crop of transparent outer margin"))

for npc_id, frame in frames:
    path = ROOT / frame["outputPath"]
    label = f"{npc_id}/{frame['vendorDirection']}"
    exists = path.is_file()
    check(f"{label}: committed source exists", exists)
    if not exists:
        continue
    image = Image.open(path).convert("RGBA")
    check(f"{label}: 64x64 RGBA", image.size == (64, 64))
    alpha = set(image.getchannel("A").getdata())
    check(f"{label}: binary alpha", alpha.issubset({0, 255}))
    bbox = image.getchannel("A").getbbox()
    check(f"{label}: non-empty bottom-anchored frame",
          bbox is not None and bbox[3] == 64)
    if bbox is not None:
        center_error = abs((bbox[0] + bbox[2] - 1) - 63)
        check(f"{label}: horizontally centered", center_error <= 1)
        left, top, right, bottom = bbox
        crop_hash = sha256_bytes(image.crop((left, top, right, bottom)).tobytes())
        check(f"{label}: source crop pixels preserved",
              crop_hash == frame["sourceCropRgbaSha256"] == frame["outputPixelCropSha256"])
    if frame["runtimePath"]:
        runtime = ROOT / frame["runtimePath"]
        check(f"{label}: runtime frame exists", runtime.is_file())
        if runtime.is_file():
            check(f"{label}: runtime pixels match source frame",
                  runtime.read_bytes() == path.read_bytes())

if failures:
    print(f"\nNPC STATIC CONTRACT FAILED: {len(failures)} failure(s)")
    raise SystemExit(1)
print("NPC static contract passed.")
