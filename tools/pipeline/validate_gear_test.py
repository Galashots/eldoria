"""Focused tests for validate_gear.py; no network or PixelLab calls."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
VALIDATOR = ROOT / "tools/pipeline/validate_gear.py"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(image: Image.Image, path: Path) -> None:
    image.save(path, format="PNG", optimize=False, compress_level=9)


def run_validator(folder: Path, candidate: Path, evidence: Path, kind: str = "composite") -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(VALIDATOR),
            "--base", str(folder / "base.png"),
            "--candidate", str(candidate),
            "--candidate-kind", kind,
            "--mask", str(folder / "mask.png"),
            "--slot", "body",
            "--facing", "down-right",
            "--evidence", str(evidence),
            "--layer-out", str(folder / f"layer-{kind}.png"),
            "--recomposed-out", str(folder / f"recomposed-{kind}.png"),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def make_evidence(folder: Path, status: str = "SCORED", verdict: str = "INCONCLUSIVE", mask_status: str = "APPROVED") -> Path:
    mask = folder / "mask.png"
    base = folder / "base.png"
    candidate = folder / "candidate.png"
    mask_record = {"status": mask_status}
    if mask_status in {"APPROVED", "PENDING"}:
        mask_record.update({"path": str(mask), "sha256": sha(mask)})
    if mask_status != "APPROVED":
        mask_record["reason"] = "Draft mask requires non-author visual review."
    evidence = {
        "status": status,
        "slot": "body",
        "facing": "down-right",
        "generation": {
            "approved_mask": mask_record,
            "canvas_custody": {
                "source_canvas_px": 64,
                "validation_canvas_px": 64,
                "mask_canvas_px": 64,
                "transform": "identity; no crop, scale, interpolation, rotation, or translation",
                "anchor": "origin (0,0)",
            },
        },
        "custody_validator": {
            "scoring_status": "SCORED" if status != "DRAFT" else "UNSCORED",
            "gc4_mask_containment": "PASS" if status != "DRAFT" else None,
            "gc5_offmask_pixels_changed": 0 if status != "DRAFT" else "UNSCORED",
            "gc6_layer_order": "PASS" if status != "DRAFT" else None,
            "gc8_determinism": "PASS" if status != "DRAFT" else None,
        },
        "human_verdicts": {
            "semantic_gate": "NOT_RUN" if status == "DRAFT" else "PASS",
            "heading_fidelity": "not evaluated" if status == "DRAFT" else "PASS",
            "cross_facing_recognizability": "not evaluated" if status == "DRAFT" else "PASS",
            "semantic_drift": "not evaluated" if status == "DRAFT" else "PASS",
            "temporal_stability": "not evaluated" if status == "DRAFT" else "N/A for static test",
            "north_star_alignment": "Intentional interim gap",
        },
        "custody": {
            "base_sha256": sha(base),
            "candidate_sha256": sha(candidate),
            "mask_sha256": sha(mask),
            "raw_output_location": "test fixture",
        },
        "verdict": verdict,
        "verdict_reason": "Focused validator fixture; not a visual approval.",
    }
    path = folder / f"evidence-{status.lower()}-{mask_status.lower()}.json"
    path.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    return path


def setup_fixture(folder: Path) -> None:
    base = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    base.putpixel((10, 10), (50, 70, 90, 255))
    base.putpixel((25, 25), (80, 90, 100, 255))
    save(base, folder / "base.png")

    mask = Image.new("L", (64, 64), 0)
    for y in range(20, 31):
        for x in range(20, 31):
            mask.putpixel((x, y), 255)
    save(mask, folder / "mask.png")

    candidate = base.copy()
    candidate.putpixel((25, 25), (180, 190, 200, 255))
    candidate.putpixel((28, 28), (210, 220, 230, 255))  # silhouette growth inside the mask is valid.
    save(candidate, folder / "candidate.png")


def test_composite_pass_and_determinism(folder: Path) -> None:
    evidence = make_evidence(folder)
    first = run_validator(folder, folder / "candidate.png", evidence)
    assert first.returncode == 0, first.stdout + first.stderr
    assert "ALL GEAR CUSTODY CHECKS PASS" in first.stdout
    assert (folder / "recomposed-composite.png").read_bytes() == (folder / "candidate.png").read_bytes()
    first_hash = sha(folder / "layer-composite.png")

    second = run_validator(folder, folder / "candidate.png", evidence)
    assert second.returncode == 0, second.stdout + second.stderr
    assert first_hash == sha(folder / "layer-composite.png")


def test_off_mask_coordinates_are_reported(folder: Path) -> None:
    candidate = Image.open(folder / "candidate.png").convert("RGBA")
    candidate.putpixel((5, 5), (255, 0, 0, 255))
    bad = folder / "candidate-off-mask.png"
    save(candidate, bad)
    evidence = make_evidence(folder)
    evidence_data = json.loads(evidence.read_text(encoding="utf-8"))
    evidence_data["custody"]["candidate_sha256"] = sha(bad)
    evidence.write_text(json.dumps(evidence_data), encoding="utf-8")
    result = run_validator(folder, bad, evidence)
    assert result.returncode == 1
    assert "OFF_MASK_CHANGED count=1 coordinates=[[5,5]]" in result.stdout


def test_draft_is_valid_but_win_is_not(folder: Path) -> None:
    draft_evidence = make_evidence(folder, status="DRAFT", verdict="INCONCLUSIVE", mask_status="PENDING")
    draft = run_validator(folder, folder / "candidate.png", draft_evidence)
    assert draft.returncode == 0, draft.stdout + draft.stderr
    assert "EVIDENCE status=DRAFT verdict=INCONCLUSIVE" in draft.stdout

    win_evidence = make_evidence(folder, status="DRAFT", verdict="WIN", mask_status="PENDING")
    win = run_validator(folder, folder / "candidate.png", win_evidence)
    assert win.returncode == 1
    assert "WIN requires" in win.stdout


def test_layer_input_recomposes(folder: Path) -> None:
    layer = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    layer.putpixel((28, 28), (210, 220, 230, 255))
    layer_path = folder / "candidate-layer.png"
    save(layer, layer_path)
    evidence = make_evidence(folder)
    evidence_data = json.loads(evidence.read_text(encoding="utf-8"))
    evidence_data["custody"]["candidate_sha256"] = sha(layer_path)
    evidence.write_text(json.dumps(evidence_data), encoding="utf-8")
    result = run_validator(folder, layer_path, evidence, kind="layer")
    assert result.returncode == 0, result.stdout + result.stderr
    assert "PASS recomposed output is byte-identical" in result.stdout


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="eldoria-gear-validator-") as temp:
        folder = Path(temp)
        setup_fixture(folder)
        test_composite_pass_and_determinism(folder)
        test_off_mask_coordinates_are_reported(folder)
        test_draft_is_valid_but_win_is_not(folder)
        test_layer_input_recomposes(folder)
    print("validate_gear tests passed: composite, off-mask coordinates, DRAFT/WIN guard, layer input, deterministic SHA")


if __name__ == "__main__":
    main()
