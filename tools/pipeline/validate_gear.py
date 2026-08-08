"""Deterministic custody checks for generated or hand-reviewed gear evidence.

This validator deliberately operates on the committed 64x64 runtime canvas. A
future raw-source experiment must provide a same-resolution base, candidate, and
mask; it may not silently resize a PixelLab result during validation.

Examples:
  python tools/pipeline/validate_gear.py \
    --base assets/adventurer-down-right.png \
    --candidate evidence/equipped.png --candidate-kind composite \
    --mask tools/pipeline/masks/gear-probe-20260806/body-down-right.png \
    --slot body --facing down-right --evidence evidence.json \
    --layer-out evidence/extracted-body.png \
    --recomposed-out evidence/recomposed.png

Exit 0 means the image custody checks and evidence-state checks passed. This is
not a visual approval: human fields must still be completed by a non-author
reviewer before a record can become FINAL/WIN.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from io import BytesIO
from pathlib import Path
from typing import Any, Iterable

from PIL import Image


FRAME = 64
STATUSES = {"DRAFT", "SCORED", "FINAL"}
VERDICTS = {"WIN", "LOSE", "INCONCLUSIVE"}
HUMAN_FIELDS = (
    "semantic_gate",
    "heading_fidelity",
    "cross_facing_recognizability",
    "semantic_drift",
    "temporal_stability",
    "north_star_alignment",
)


class GearValidationError(Exception):
    """A user-facing validation failure."""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def png_bytes(image: Image.Image) -> bytes:
    """Encode PNG with fixed options so repeated output is byte-identical."""
    stream = BytesIO()
    image.save(stream, format="PNG", optimize=False, compress_level=9)
    return stream.getvalue()


def save_deterministic(image: Image.Image, path: Path) -> str:
    data = png_bytes(image)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    if data != png_bytes(image):
        raise GearValidationError(f"non-deterministic PNG encoding: {path}")
    return sha256_bytes(data)


def require_rgba_64(path: Path, label: str) -> Image.Image:
    if not path.is_file():
        raise GearValidationError(f"{label} does not exist: {path}")
    with Image.open(path) as source:
        if source.size != (FRAME, FRAME):
            raise GearValidationError(
                f"{label} must be 64x64, got {source.size[0]}x{source.size[1]}: {path}"
            )
        if source.mode != "RGBA":
            raise GearValidationError(f"{label} must be RGBA, got {source.mode}: {path}")
        image = source.copy()
    alpha = set(image.getchannel("A").getdata())
    if not alpha.issubset({0, 255}):
        raise GearValidationError(f"{label} alpha is not binary: {path}")
    return image


def require_mask_64(path: Path) -> tuple[Image.Image, list[bool]]:
    if not path.is_file():
        raise GearValidationError(f"approved mask does not exist: {path}")
    with Image.open(path) as source:
        if source.size != (FRAME, FRAME):
            raise GearValidationError(
                f"approved mask must be 64x64, got {source.size[0]}x{source.size[1]}: {path}"
            )
        if source.mode == "L":
            mask = source.copy()
            values = set(mask.getdata())
            if not values.issubset({0, 255}):
                raise GearValidationError(f"approved mask values are not binary: {path}")
            active = [value == 255 for value in mask.getdata()]
        elif source.mode == "RGBA":
            mask = source.copy()
            alpha = set(mask.getchannel("A").getdata())
            if not alpha.issubset({0, 255}):
                raise GearValidationError(f"approved mask alpha is not binary: {path}")
            active = [value == 255 for value in mask.getchannel("A").getdata()]
        else:
            raise GearValidationError(f"approved mask must be grayscale or RGBA, got {source.mode}: {path}")
    if not any(active):
        raise GearValidationError(f"approved mask is empty: {path}")
    if all(active):
        raise GearValidationError(f"approved mask covers the full canvas: {path}")
    return mask, active


def coords(indices: Iterable[int]) -> list[list[int]]:
    return [[index % FRAME, index // FRAME] for index in indices]


def pixels(image: Image.Image) -> list[tuple[int, int, int, int]]:
    return list(image.getdata())


def evidence_value(data: dict[str, Any], *keys: str) -> Any:
    value: Any = data
    for key in keys:
        if not isinstance(value, dict) or key not in value:
            return None
        value = value[key]
    return value


def nonempty_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_evidence(
    path: Path,
    slot: str,
    facing: str,
    mask_path: Path,
    base_path: Path,
    candidate_path: Path,
    mask_sha: str,
    base_sha: str,
    candidate_sha: str,
) -> tuple[str, str, list[str]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise GearValidationError(f"evidence JSON cannot be read: {path}: {error}") from error
    if not isinstance(data, dict):
        raise GearValidationError("evidence root must be an object")

    status = data.get("status")
    verdict = data.get("verdict")
    problems: list[str] = []
    if status not in STATUSES:
        problems.append(f"status must be one of {sorted(STATUSES)}")
    if data.get("slot") != slot:
        problems.append(f"evidence slot {data.get('slot')!r} does not match {slot!r}")
    if data.get("facing") != facing:
        problems.append(f"evidence facing {data.get('facing')!r} does not match {facing!r}")
    if verdict not in VERDICTS:
        problems.append(f"verdict must be one of {sorted(VERDICTS)}")
    if not nonempty_text(data.get("verdict_reason")):
        problems.append("verdict_reason must be non-empty")

    mask_record = evidence_value(data, "generation", "approved_mask")
    if not isinstance(mask_record, dict):
        problems.append("generation.approved_mask is required")
    else:
        mask_status = mask_record.get("status")
        if mask_status not in {"APPROVED", "PENDING", "MISSING"}:
            problems.append("approved mask status must be APPROVED, PENDING, or MISSING")
        if mask_status in {"APPROVED", "PENDING"}:
            if Path(str(mask_record.get("path", ""))).resolve() != mask_path.resolve():
                problems.append("evidence mask path does not match --mask")
            if mask_record.get("sha256") != mask_sha:
                problems.append("evidence mask SHA-256 does not match --mask")
        if mask_status in {"PENDING", "MISSING"} and not nonempty_text(mask_record.get("reason")):
            problems.append("pending/missing mask requires a reason")

    canvas_custody = evidence_value(data, "generation", "canvas_custody")
    if not isinstance(canvas_custody, dict):
        problems.append("generation.canvas_custody is required")
    else:
        for key in ("source_canvas_px", "validation_canvas_px", "mask_canvas_px", "transform", "anchor"):
            value = canvas_custody.get(key)
            if value is None or (isinstance(value, str) and not value.strip()):
                problems.append(f"generation.canvas_custody.{key} is required")
        if canvas_custody.get("validation_canvas_px") != 64:
            problems.append("generation.canvas_custody.validation_canvas_px must be 64")
        if canvas_custody.get("mask_canvas_px") != 64:
            problems.append("generation.canvas_custody.mask_canvas_px must be 64")

    custody = data.get("custody_validator")
    human = data.get("human_verdicts")
    if not isinstance(custody, dict):
        problems.append("custody_validator is required")
        custody = {}
    if not isinstance(human, dict):
        problems.append("human_verdicts is required")
        human = {}

    scoring = custody.get("scoring_status")
    if scoring not in {"SCORED", "UNSCORED"}:
        problems.append("custody_validator.scoring_status must be SCORED or UNSCORED")

    custody_hashes = data.get("custody")
    if isinstance(custody_hashes, dict):
        expected_hashes = {
            "base_sha256": base_sha,
            "candidate_sha256": candidate_sha,
            "mask_sha256": mask_sha,
        }
        for key, expected in expected_hashes.items():
            if key in custody_hashes and custody_hashes[key] != expected:
                problems.append(f"custody.{key} does not match the supplied file")

    if status == "DRAFT" and verdict == "WIN":
        problems.append("DRAFT evidence cannot have verdict WIN")

    if status in {"SCORED", "FINAL"}:
        mask_status = evidence_value(data, "generation", "approved_mask", "status")
        if mask_status != "APPROVED":
            if not (status == "FINAL" and verdict == "LOSE" and human.get("semantic_gate") == "FAIL"):
                problems.append("SCORED/FINAL custody requires an APPROVED mask")
        if status == "SCORED" and scoring != "SCORED":
            problems.append("SCORED evidence requires custody scoring_status=SCORED")

    if verdict == "WIN":
        if status != "FINAL":
            problems.append("WIN requires evidence status FINAL")
        if evidence_value(data, "generation", "approved_mask", "status") != "APPROVED":
            problems.append("WIN requires approved mask status APPROVED")
        required_machine = {
            "gc4_mask_containment": "PASS",
            "gc6_layer_order": "PASS",
            "gc8_determinism": "PASS",
        }
        for key, expected in required_machine.items():
            if custody.get(key) != expected:
                problems.append(f"WIN requires custody_validator.{key}={expected}")
        if scoring != "SCORED":
            problems.append("WIN requires custody scoring_status=SCORED")
        if custody.get("gc5_offmask_pixels_changed") != 0:
            problems.append("WIN requires gc5_offmask_pixels_changed=0")
        if human.get("semantic_gate") != "PASS":
            problems.append("WIN requires human semantic_gate=PASS")
        for key in HUMAN_FIELDS[1:]:
            if not nonempty_text(human.get(key)):
                problems.append(f"WIN requires complete human field {key}")
        for key, expected in {
            "base_sha256": base_sha,
            "candidate_sha256": candidate_sha,
            "mask_sha256": mask_sha,
        }.items():
            if not isinstance(custody_hashes, dict) or custody_hashes.get(key) != expected:
                problems.append(f"WIN requires matching custody.{key}")
        if not isinstance(custody_hashes, dict) or not nonempty_text(custody_hashes.get("raw_output_location")):
            problems.append("WIN requires durable raw_output_location custody evidence")

    return str(status), str(verdict), problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, type=Path)
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--candidate-kind", required=True, choices=("composite", "layer"))
    parser.add_argument("--mask", required=True, type=Path)
    parser.add_argument("--slot", required=True)
    parser.add_argument("--facing", required=True)
    parser.add_argument("--evidence", required=True, type=Path)
    parser.add_argument("--layer-out", required=True, type=Path)
    parser.add_argument("--recomposed-out", required=True, type=Path)
    args = parser.parse_args()

    try:
        base = require_rgba_64(args.base, "base")
        candidate = require_rgba_64(args.candidate, "candidate")
        _, mask_active = require_mask_64(args.mask)
        base_pixels = pixels(base)
        candidate_pixels = pixels(candidate)
        base_sha = sha256_file(args.base)
        candidate_sha = sha256_file(args.candidate)
        mask_sha = sha256_file(args.mask)
        status, verdict, evidence_problems = validate_evidence(
            args.evidence,
            args.slot,
            args.facing,
            args.mask,
            args.base,
            args.candidate,
            mask_sha,
            base_sha,
            candidate_sha,
        )
        failures = list(evidence_problems)

        if args.candidate_kind == "composite":
            changed = [index for index, (before, after) in enumerate(zip(base_pixels, candidate_pixels)) if before != after]
            erases_base = [index for index in changed if candidate_pixels[index][3] < base_pixels[index][3]]
            if erases_base:
                failures.append(
                    "candidate erases base alpha at coordinates " + json.dumps(coords(erases_base), separators=(",", ":"))
                )
        else:
            changed = [index for index, pixel in enumerate(candidate_pixels) if pixel[3] == 255]
            erases_base = []

        off_mask = [index for index in changed if not mask_active[index]]
        if off_mask:
            print(
                f"OFF_MASK_CHANGED count={len(off_mask)} "
                f"coordinates={json.dumps(coords(off_mask), separators=(',', ':'))}"
            )
            failures.append(f"{len(off_mask)} changed pixel(s) outside the approved mask")
        else:
            print(f"PASS changed pixels within approved mask count={len(changed)}")

        layer_pixels = [(0, 0, 0, 0)] * (FRAME * FRAME)
        for index in changed:
            layer_pixels[index] = candidate_pixels[index]
        layer = Image.new("RGBA", (FRAME, FRAME))
        layer.putdata(layer_pixels)
        recomposed_pixels = list(base_pixels)
        for index in changed:
            recomposed_pixels[index] = candidate_pixels[index]
        recomposed = Image.new("RGBA", (FRAME, FRAME))
        recomposed.putdata(recomposed_pixels)

        layer_sha = save_deterministic(layer, args.layer_out)
        recomposed_sha = save_deterministic(recomposed, args.recomposed_out)
        deterministic_layer = png_bytes(layer) == args.layer_out.read_bytes()
        deterministic_recomposed = png_bytes(recomposed) == args.recomposed_out.read_bytes()
        if not deterministic_layer or not deterministic_recomposed:
            failures.append("output PNG SHA-256 is not deterministic")

        if args.candidate_kind == "composite":
            exact = recomposed.tobytes() == candidate.tobytes()
        else:
            exact = all(recomposed_pixels[index] == candidate_pixels[index] for index in changed)
        if exact:
            print("PASS recomposed output is byte-identical to the candidate result")
        else:
            failures.append("recomposed output is not byte-identical to the candidate")

        print(f"EVIDENCE status={status} verdict={verdict}")
        print(f"EXTRACTED_LAYER_SHA256 {layer_sha}")
        print(f"RECOMPOSED_SHA256 {recomposed_sha}")
        print(f"DETERMINISTIC_SHA256 layer={layer_sha} recomposed={recomposed_sha}")
        if failures:
            for failure in failures:
                print(f"FAIL {failure}")
            return 1
        print("ALL GEAR CUSTODY CHECKS PASS")
        return 0
    except (GearValidationError, OSError, ValueError) as error:
        print(f"FAIL {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
