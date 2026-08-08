"""Run the single authorized PR54 Inpaint v3 API confirmation probe.

This is deliberately fail-closed: it performs one POST at most, polls only
the returned background job, keeps the job record private, and writes the raw
PNG outside production assets. It is not a general-purpose generation tool.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

import requests
from PIL import Image


BASE_URL = "https://api.pixellab.ai/v2"
OPENAPI_URL = f"{BASE_URL}/openapi.json"
ENDPOINT = "/inpaint-v3"
POLL_PATH = "/background-jobs/{job_id}"
EXPECTED_BASE_SHA = "a59a6d7caec21752f99304e22390f8fbba7df14aced6efe4b8853b53b9f40300"
EXPECTED_MASK_SHA = "454d285e9d3a4782ade5a16f65327d8941950a4fef01ad7bc9ba2a5b3163832d"
EXPECTED_ACTIVE = 239
EXPECTED_COST = 20
PRIOR_PR54_SPEND = 45
CEILING = 100
SEED = 20260808
DESCRIPTION = (
    "Fitted brushed iron breastplate over the existing torso clothing, shaped to the "
    "Ranger's body and perspective, simple steel chest plate with restrained brown "
    "leather straps, readable RPG pixel-art armour."
)
ALLOWED_DOWNLOAD_HOSTS = ("pixellab.ai", "backblazeb2.com")
POLL_SECONDS = 5
POLL_TIMEOUT = 900
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def token() -> str:
    value = os.environ.get("PIXELLAB_SECRET", "").strip()
    if not value:
        raise RuntimeError("PIXELLAB_SECRET is not set")
    return value


def api(method: str, path: str, payload: object | None = None) -> dict:
    response = requests.request(
        method,
        BASE_URL + path,
        json=payload,
        headers={"Authorization": f"Bearer {token()}"},
        timeout=180,
        allow_redirects=False,
    )
    if 300 <= response.status_code < 400:
        raise RuntimeError(f"unexpected API redirect for {method} {path}")
    if response.status_code >= 400:
        raise RuntimeError(f"API {method} {path} returned HTTP {response.status_code}")
    return response.json()


def b64_png(path: Path) -> dict:
    return {"type": "base64", "base64": base64.b64encode(path.read_bytes()).decode("ascii")}


def sanitize_response(response: dict) -> dict:
    output = {key: value for key, value in response.items() if key != "last_response"}
    if "background_job_id" in output or "id" in output:
        output["background_job_id"] = "[REDACTED — private job id]"
        output.pop("id", None)
    return output


def fetch_png(url: str) -> bytes:
    for _ in range(6):
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        if parsed.scheme != "https" or not any(
            host == allowed or host.endswith("." + allowed) for allowed in ALLOWED_DOWNLOAD_HOSTS
        ):
            raise RuntimeError("result URL host is not an approved PixelLab/storage host")
        request = Request(url, headers={"User-Agent": "Eldoria-PR54-probe/1"})
        with urlopen(request, timeout=120) as response:
            if response.status in (301, 302, 303, 307, 308):
                location = response.headers.get("Location")
                if not location:
                    raise RuntimeError("result URL redirect had no Location")
                url = urljoin(url, location)
                continue
            data = response.read(25 * 1024 * 1024 + 1)
        if not data.startswith(PNG_MAGIC):
            raise RuntimeError("authoritative result was not a PNG")
        return data
    raise RuntimeError("too many result URL redirects")


def decode_base64(value: str) -> bytes:
    if "," in value and value.startswith("data:"):
        value = value.split(",", 1)[1]
    data = base64.b64decode(value, validate=True)
    if not data.startswith(PNG_MAGIC):
        raise RuntimeError("authoritative base64 result was not a PNG")
    return data


def find_image(value: object) -> bytes | None:
    if isinstance(value, dict):
        for key in ("base64", "data"):
            candidate = value.get(key)
            if isinstance(candidate, str):
                try:
                    return decode_base64(candidate)
                except Exception:
                    pass
        for key in ("download_url", "image_url", "url"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.startswith("https://"):
                return fetch_png(candidate)
        for child in value.values():
            found = find_image(child)
            if found is not None:
                return found
    elif isinstance(value, list):
        for child in value:
            found = find_image(child)
            if found is not None:
                return found
    return None


def schema_recon() -> tuple[dict, str]:
    with urlopen(OPENAPI_URL, timeout=30) as response:
        raw = response.read()
    schema = json.loads(raw)
    operation = schema["paths"][ENDPOINT]["post"]
    request_schema = schema["components"]["schemas"]["InpaintV3Request"]
    response_schema = schema["components"]["schemas"]["InpaintV3Response"]
    job_schema = schema["components"]["schemas"]["BackgroundJobResponse"]
    fields = list(request_schema["properties"])
    required = request_schema["required"]
    expected = {
        "description",
        "inpainting_image",
        "mask_image",
        "seed",
        "no_background",
        "crop_to_mask",
    }
    if not expected.issubset(fields) or not set(("description", "inpainting_image", "mask_image")).issubset(required):
        raise RuntimeError("live Inpaint v3 schema is missing an authorized request field")
    if "background_job_id" not in response_schema["required"]:
        raise RuntimeError("live Inpaint v3 schema no longer returns a background job id")
    if "last_response" not in job_schema["properties"]:
        raise RuntimeError("live background-job schema no longer exposes last_response")
    return {
        "url": OPENAPI_URL,
        "sha256": sha256(raw),
        "openapi": schema.get("openapi"),
        "endpoint": ENDPOINT,
        "operation_id": operation.get("operationId"),
        "request_fields": fields,
        "required_request_fields": required,
        "response_fields": list(response_schema["properties"]),
        "background_job_fields": list(job_schema["properties"]),
        "mask_convention": "white = generate; black = preserve",
        "authoritative_result_path": "GET /v2/background-jobs/{job_id} -> last_response",
    }, sha256(raw)


def balance() -> dict:
    data = api("GET", "/balance")
    subscription = data.get("subscription", {})
    credits = data.get("credits", {})
    return {
        "subscription_generations_remaining": subscription.get("generations"),
        "subscription_generations_total": subscription.get("total"),
        "subscription_status": subscription.get("status"),
        "credits_usd": credits.get("usd"),
    }


def validate_inputs(base: Path, mask: Path) -> dict:
    base_bytes = base.read_bytes()
    mask_bytes = mask.read_bytes()
    base_hash = sha256(base_bytes)
    mask_hash = sha256(mask_bytes)
    if base_hash != EXPECTED_BASE_SHA:
        raise RuntimeError(f"base SHA mismatch: {base_hash}")
    if mask_hash != EXPECTED_MASK_SHA:
        raise RuntimeError(f"mask SHA mismatch: {mask_hash}")
    with Image.open(base) as image:
        if image.size != (64, 64) or image.mode != "RGBA":
            raise RuntimeError(f"base must be 64x64 RGBA, got {image.size} {image.mode}")
    with Image.open(mask) as image:
        if image.size != (64, 64) or image.mode not in ("L", "RGBA"):
            raise RuntimeError(f"mask must be 64x64 L/RGBA, got {image.size} {image.mode}")
        values = list(image.getdata() if image.mode == "L" else image.getchannel("A").getdata())
        if set(values) != {0, 255} or values.count(255) != EXPECTED_ACTIVE:
            raise RuntimeError("mask is not the expected binary 239-pixel Candidate C")
    return {
        "base": {"path": "assets/adventurer-down-right.png", "sha256": base_hash, "size": "64x64", "mode": "RGBA"},
        "mask": {"path": "tools/pipeline/masks/gear-probe-20260806/body-down-right-candidates/body-down-right-candidate-C.png", "sha256": mask_hash, "active_pixels": EXPECTED_ACTIVE, "size": "64x64"},
    }


def main() -> int:
    repo = Path(__file__).resolve().parents[2]
    base = repo / "assets/adventurer-down-right.png"
    mask = repo / "tools/pipeline/masks/gear-probe-20260806/body-down-right-candidates/body-down-right-candidate-C.png"
    out = repo / "docs/playtest/2026-08-06-pixellab-gear-probe/api-confirmation-2026-08-08"
    if (out / "raw-api-result.png").exists() or (out / "private-job-response.json").exists():
        raise RuntimeError("probe output already exists; refusing a second API call")

    schema, schema_hash = schema_recon()
    inputs = validate_inputs(base, mask)
    before = balance()
    if PRIOR_PR54_SPEND + EXPECTED_COST > CEILING:
        raise RuntimeError("authorized PR54 ceiling would be exceeded")
    if before["subscription_generations_remaining"] is None:
        raise RuntimeError("account balance did not expose subscription generations")

    preflight = {
        "status": "PRECALL READ-ONLY GATE PASS",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "schema": schema,
        "inputs": inputs,
        "request": {
            "method": "POST",
            "path": ENDPOINT,
            "fields": ["description", "inpainting_image", "mask_image", "seed", "no_background", "crop_to_mask"],
            "seed": SEED,
            "no_background": False,
            "crop_to_mask": True,
            "description": DESCRIPTION,
            "input_convention": "Candidate C canonical mask; white = generate; black = preserve",
            "transforms": "none; exact 64x64 input and mask",
        },
        "charging": {
            "account_model": "subscription generations",
            "balance_before": before,
            "expected_call_cost_generations": EXPECTED_COST,
            "pr54_prior_spend_generations": PRIOR_PR54_SPEND,
            "pr54_expected_cumulative_generations": PRIOR_PR54_SPEND + EXPECTED_COST,
            "pr54_ceiling_generations": CEILING,
            "official_cost_basis": "PixelLab Inpaint v3 documentation: 20 generations per use",
        },
        "authorization": "exactly one POST, then poll only its returned job; stop after this call",
    }
    write_json(out / "preflight-public.json", preflight)

    payload = {
        "description": DESCRIPTION,
        "inpainting_image": {"image": b64_png(base), "size": {"width": 64, "height": 64}},
        "mask_image": {"image": b64_png(mask), "size": {"width": 64, "height": 64}},
        "seed": SEED,
        "no_background": False,
        "crop_to_mask": True,
    }
    write_json(out / "request-public.json", {
        "method": "POST",
        "path": ENDPOINT,
        "description": DESCRIPTION,
        "seed": SEED,
        "no_background": False,
        "crop_to_mask": True,
        "base_sha256": EXPECTED_BASE_SHA,
        "mask_sha256": EXPECTED_MASK_SHA,
        "base_size": "64x64",
        "mask_size": "64x64",
        "mask_convention": "white = generate; black = preserve",
        "secrets": "excluded",
    })

    # This is the only generating request in this script.
    response = api("POST", ENDPOINT, payload)
    write_json(out / "private-post-response.json", response)
    write_json(out / "post-response-public.json", sanitize_response(response))
    job_id = response.get("background_job_id")
    if not isinstance(job_id, str) or not job_id:
        raise RuntimeError("Inpaint v3 response did not contain a background job id")

    started = time.monotonic()
    final = None
    poll_count = 0
    while True:
        final = api("GET", f"/background-jobs/{job_id}")
        poll_count += 1
        status = final.get("status")
        if status == "completed":
            break
        if status == "failed":
            write_json(out / "private-job-response.json", final)
            raise RuntimeError("Inpaint v3 background job failed")
        if time.monotonic() - started > POLL_TIMEOUT:
            raise RuntimeError("Inpaint v3 background job exceeded polling timeout")
        time.sleep(POLL_SECONDS)
    write_json(out / "private-job-response.json", final)
    write_json(out / "job-completion-public.json", {
        "status": final.get("status"),
        "poll_count": poll_count,
        "usage": final.get("usage"),
        "result_source": "completed background job last_response; private job id redacted",
    })

    raw = find_image(final.get("last_response"))
    if raw is None:
        raise RuntimeError("completed job last_response contained no authoritative image")
    (out / "raw-api-result.png").write_bytes(raw)
    with Image.open(out / "raw-api-result.png") as image:
        alpha = image.getchannel("A") if "A" in image.getbands() else None
        metadata = {
            "raw_sha256": sha256(raw),
            "bytes": len(raw),
            "size": list(image.size),
            "mode": image.mode,
            "alpha_values": sorted(set(alpha.getdata())) if alpha else None,
            "source": "authoritative completed background job last_response",
            "raw_location": "private untracked file; outside assets/",
        }
    after = balance()
    charged = before["subscription_generations_remaining"] - after["subscription_generations_remaining"]
    metadata["balance_before"] = before
    metadata["balance_after"] = after
    metadata["actual_charge_generations"] = charged
    metadata["pr54_cumulative_spend_if_expected"] = PRIOR_PR54_SPEND + charged
    write_json(out / "raw-result-metadata.json", metadata)
    print(json.dumps({
        "status": "completed",
        "poll_count": poll_count,
        "raw_sha256": metadata["raw_sha256"],
        "size": metadata["size"],
        "mode": metadata["mode"],
        "alpha_values": metadata["alpha_values"],
        "actual_charge_generations": charged,
        "balance_after_generations": after["subscription_generations_remaining"],
    }))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"PROBE STOPPED: {error}", file=sys.stderr)
        raise SystemExit(1)
