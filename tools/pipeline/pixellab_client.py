"""Thin PixelLab API client for the Eldoria asset pipeline.

No SDK dependency; talks straight to the documented REST API
(https://api.pixellab.ai/v2/openapi.json) with `requests`, which is already on
this machine. Every generation stays raw in a working directory; nothing here
writes into assets/ — the deterministic normalize + validate steps own that.

Auth: a Bearer token, read from (in order)
  1. env var PIXELLAB_SECRET
  2. _probe_local/pixellab.token   (one line; _probe_local/ is gitignored)
Get a token at https://pixellab.ai/account (free trial: 40 generations).

Every generating subcommand supports --dry-run: it prints the exact JSON that
would be POSTed (base64 bodies elided) and exits without spending credits.

Examples:
  python tools/pipeline/pixellab_client.py balance
  python tools/pipeline/pixellab_client.py create4 \
      --description "older ranger adventurer, green hooded cloak, longbow" \
      --size 64 --isometric --directions south-east,south-west,north-west,north-east \
      --out-dir _probe_local/pipeline/ranger
  python tools/pipeline/pixellab_client.py animate --character-id <id> \
      --action "walking" --frames 4 --out-dir _probe_local/pipeline/ranger
  python tools/pipeline/pixellab_client.py rotate \
      --from-image art-incoming/ranger-down.png --from-direction south-west \
      --to-direction south-east --isometric --size 64 --out _probe_local/pipeline/se.png
"""

import argparse
import base64
import io
import json
import os
import re
import sys
import time
import zipfile
from urllib.parse import urljoin, urlparse

import requests

BASE = "https://api.pixellab.ai/v2"

# Download / extraction guardrails. PixelLab is the trusted vendor, but this
# client runs on a developer machine with a valuable token and a repository
# checkout — a compromised response must not be able to write outside the
# chosen output directory or exhaust disk. Extend the host list deliberately
# (one-line edit) if PixelLab moves storage providers.
ALLOWED_DOWNLOAD_HOSTS = ("pixellab.ai", "backblazeb2.com")
MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024
ZIP_MAX_ENTRIES = 512
ZIP_MAX_TOTAL_BYTES = 100 * 1024 * 1024
ZIP_ALLOWED_EXTENSIONS = {".png", ".json", ".gif"}
MAX_REDIRECTS = 5
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TOKEN_FILE = os.path.join(REPO, "_probe_local", "pixellab.token")

# Engine slot -> PixelLab direction, per the locked 2.5D camera
# (right=SE, down=SW, left=NW, up=NE; see tools/pipeline/PIPELINE.md).
ENGINE_DIRECTIONS = {
    "right": "south-east",
    "down": "south-west",
    "left": "north-west",
    "up": "north-east",
}

POLL_SECONDS = 4
POLL_TIMEOUT = 600


def get_token():
    tok = os.environ.get("PIXELLAB_SECRET", "").strip()
    if not tok and os.path.isfile(TOKEN_FILE):
        with open(TOKEN_FILE, "r", encoding="utf-8") as fh:
            tok = fh.read().strip()
    if not tok:
        sys.exit(
            "No PixelLab token. Set PIXELLAB_SECRET or put the token in "
            f"{TOKEN_FILE} (from https://pixellab.ai/account)."
        )
    return tok


def reject_redirect(method, path, resp):
    """Fail closed on any API 3xx: requests forwards explicitly-passed headers
    across redirects, so following one could hand the bearer token to an
    unapproved or internal host, bypassing check_download_url()."""
    if 300 <= resp.status_code < 400:
        location = resp.headers.get("location") or resp.headers.get("Location")
        sys.exit(f"API {method} {path} unexpectedly redirected "
                 f"({resp.status_code} -> {str(location)[:120]}); refusing to "
                 "follow with an authenticated request")


def api(method, path, payload=None, raw=False):
    headers = {"Authorization": f"Bearer {get_token()}"}
    if raw:
        # Bounded streaming: the character-zip path must not buffer an
        # unlimited response before safe_extract gets to inspect it.
        chunks = []
        total = 0
        with requests.request(
            method, BASE + path, json=payload, headers=headers,
            timeout=180, stream=True, allow_redirects=False,
        ) as resp:
            reject_redirect(method, path, resp)
            if resp.status_code >= 400:
                sys.exit(f"API {method} {path} -> {resp.status_code}: {resp.text[:800]}")
            for chunk in resp.iter_content(65536):
                total += len(chunk)
                if total > MAX_DOWNLOAD_BYTES:
                    sys.exit(f"API {method} {path} raw response exceeds "
                             f"{MAX_DOWNLOAD_BYTES} byte cap; refusing")
                chunks.append(chunk)
        return b"".join(chunks)
    resp = requests.request(
        method, BASE + path, json=payload, headers=headers,
        timeout=180, allow_redirects=False,
    )
    reject_redirect(method, path, resp)
    if resp.status_code >= 400:
        sys.exit(f"API {method} {path} -> {resp.status_code}: {resp.text[:800]}")
    return resp.json()


def b64_image(path):
    with open(path, "rb") as fh:
        return {"type": "base64", "base64": base64.b64encode(fh.read()).decode()}


def elide(obj):
    """Copy of a payload with base64 bodies shortened for printing."""
    if isinstance(obj, dict):
        return {
            k: ("<base64 %d chars>" % len(v) if k == "base64" else elide(v))
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [elide(v) for v in obj]
    return obj


def post(path, payload, dry_run):
    if dry_run:
        print(f"[dry-run] POST {BASE}{path}")
        print(json.dumps(elide(payload), indent=2))
        return None
    return api("POST", path, payload)


def save_images(obj, out_dir, prefix, _count=None):
    """Recursively save every base64 image found in an API response."""
    if _count is None:
        _count = [0]
    if isinstance(obj, dict):
        if "base64" in obj and isinstance(obj["base64"], str):
            os.makedirs(out_dir, exist_ok=True)
            name = f"{prefix}-{_count[0]}.png"
            with open(os.path.join(out_dir, name), "wb") as fh:
                fh.write(base64.b64decode(obj["base64"]))
            print(f"[save] {os.path.join(out_dir, name)}")
            _count[0] += 1
        else:
            for v in obj.values():
                save_images(v, out_dir, prefix, _count)
    elif isinstance(obj, list):
        for v in obj:
            save_images(v, out_dir, prefix, _count)
    return _count[0]


def poll_job(job_id):
    start = time.time()
    while True:
        job = api("GET", f"/background-jobs/{job_id}")
        status = job.get("status")
        print(f"[job {job_id}] {status}")
        if status == "completed":
            return job
        if status == "failed":
            # Fail closed: a failed generation must not exit 0.
            sys.exit(f"job {job_id} FAILED: {str(job)[:500]}")
        if time.time() - start > POLL_TIMEOUT:
            sys.exit(f"job {job_id} still {status} after {POLL_TIMEOUT}s; giving up")
        time.sleep(POLL_SECONDS)


PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def check_download_url(url):
    """Require HTTPS and an allow-listed vendor/storage host before fetching."""
    parts = urlparse(url)
    if parts.scheme != "https":
        sys.exit(f"refusing non-HTTPS download url: {url[:120]}")
    host = (parts.hostname or "").lower()
    if not any(host == h or host.endswith("." + h) for h in ALLOWED_DOWNLOAD_HOSTS):
        sys.exit(
            f"download host {host!r} is not on the allow-list "
            f"{ALLOWED_DOWNLOAD_HOSTS}; if PixelLab changed storage providers, "
            "extend ALLOWED_DOWNLOAD_HOSTS deliberately."
        )


def fetch_binary(url):
    """Download a result file; enforce host allow-list (re-validated on every
    redirect hop, since requests' auto-follow would skip our checks), size cap,
    and PNG magic."""
    for _ in range(MAX_REDIRECTS + 1):
        check_download_url(url)
        chunks = []
        total = 0
        with requests.get(url, timeout=120, stream=True, allow_redirects=False) as resp:
            if resp.status_code in (301, 302, 303, 307, 308):
                location = resp.headers.get("location") or resp.headers.get("Location")
                if not location:
                    sys.exit(f"redirect from {url[:80]}... carries no Location header")
                url = urljoin(url, location)
                continue
            resp.raise_for_status()
            content_type = resp.headers.get("content-type")
            for chunk in resp.iter_content(65536):
                total += len(chunk)
                if total > MAX_DOWNLOAD_BYTES:
                    sys.exit(f"download from {url[:80]}... exceeds "
                             f"{MAX_DOWNLOAD_BYTES} byte cap; refusing")
                chunks.append(chunk)
        content = b"".join(chunks)
        if not content.startswith(PNG_MAGIC):
            sys.exit(f"download from {url[:80]}... is not a PNG "
                     f"({content_type}, {len(content)} bytes)")
        return content
    sys.exit(f"more than {MAX_REDIRECTS} redirects fetching {url[:80]}...; refusing")


def safe_member_name(key):
    """Reduce a vendor-provided filename/key to a safe basename."""
    name = os.path.basename(str(key).replace("\\", "/"))
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    if not name or name.strip(".") == "":
        sys.exit(f"unsafe vendor filename {key!r}; refusing to write it")
    return name


def unique_safe_names(keys):
    """Sanitize every vendor key and refuse silent overwrites: two distinct
    keys that collapse to the same safe basename are an error, not a merge."""
    names = {}
    claimed = {}
    for key in keys:
        name = safe_member_name(key)
        if name in claimed:
            sys.exit(f"vendor keys {claimed[name]!r} and {key!r} both sanitize "
                     f"to {name!r}; refusing to overwrite one with the other")
        claimed[name] = key
        names[key] = name
    return names


def safe_extract(zf, dest):
    """extractall with caps: entry count, total uncompressed bytes, extension
    allow-list, and every resolved path confined to the destination."""
    infos = [i for i in zf.infolist() if not i.is_dir()]
    if len(infos) > ZIP_MAX_ENTRIES:
        sys.exit(f"zip has {len(infos)} members; cap is {ZIP_MAX_ENTRIES}")
    dest = os.path.abspath(dest)
    total = 0
    for info in infos:
        name = info.filename.replace("\\", "/")
        if os.path.splitext(name)[1].lower() not in ZIP_ALLOWED_EXTENSIONS:
            sys.exit(f"zip member {name!r}: extension not allowed "
                     f"(allowed: {sorted(ZIP_ALLOWED_EXTENSIONS)})")
        target = os.path.abspath(os.path.join(dest, name))
        if os.path.commonpath([dest, target]) != dest:
            sys.exit(f"zip member {name!r} escapes the extraction directory")
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with zf.open(info) as src, open(target, "wb") as out:
            while True:
                chunk = src.read(65536)
                if not chunk:
                    break
                total += len(chunk)
                if total > ZIP_MAX_TOTAL_BYTES:
                    sys.exit(f"zip uncompressed content exceeds "
                             f"{ZIP_MAX_TOTAL_BYTES} byte cap; refusing")
                out.write(chunk)
    return len(infos)


def download_character(character_id, out_dir):
    detail = api("GET", f"/characters/{character_id}")
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "character.json"), "w", encoding="utf-8") as fh:
        json.dump(detail, fh, indent=2)
    blob = api("GET", f"/characters/{character_id}/zip", raw=True)
    zpath = os.path.join(out_dir, "character.zip")
    with open(zpath, "wb") as fh:
        fh.write(blob)
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        count = safe_extract(zf, os.path.join(out_dir, "zip"))
    print(f"[save] {zpath} ({count} files) -> {out_dir}/zip/")
    return detail


def finish_async(resp, out_dir, prefix):
    """Handle sync-or-async responses: poll if needed, then save everything."""
    if resp is None:                          # dry run
        return
    print(json.dumps({k: v for k, v in resp.items() if k != "images"}, indent=2)[:600])
    job_id = resp.get("background_job_id")
    if job_id:
        poll_job(job_id)
    for jid in resp.get("background_job_ids") or []:   # e.g. one per direction
        poll_job(jid)
    character_id = resp.get("character_id")
    if character_id:
        download_character(character_id, out_dir)
    n = save_images(resp, out_dir, prefix)
    if n:
        print(f"[save] {n} inline image(s)")


def cmd_balance(args):
    print(json.dumps(api("GET", "/balance"), indent=2))


def cmd_create4(args):
    payload = {
        "description": args.description,
        "image_size": {"width": args.size, "height": args.size},
        "view": args.view,
        "isometric": args.isometric,
    }
    if args.directions:
        payload["directions"] = args.directions.split(",")
    if args.proportions:
        payload["proportions"] = args.proportions
    if args.seed is not None:
        payload["seed"] = args.seed
    if args.color_image:
        payload["color_image"] = b64_image(args.color_image)
        payload["force_colors"] = args.force_colors
    finish_async(post("/create-character-with-4-directions", payload, args.dry_run),
                 args.out_dir, "create4")


def cmd_animate(args):
    payload = {
        "character_id": args.character_id,
        "frame_count": args.frames,
        "isometric": args.isometric,
    }
    if args.action:
        payload["action_description"] = args.action
    if args.template_id:
        payload["template_animation_id"] = args.template_id
    if args.animation_name:
        payload["animation_name"] = args.animation_name
    if args.directions:
        payload["directions"] = args.directions.split(",")
    if args.seed is not None:
        payload["seed"] = args.seed
    finish_async(post("/animate-character", payload, args.dry_run),
                 args.out_dir, "animate")


def cmd_create8(args):
    payload = {
        "description": args.description,
        "image_size": {"width": args.size, "height": args.size},
        "view": args.view,
        "isometric": args.isometric,
    }
    if args.template_id:
        payload["template_id"] = args.template_id
    if args.mode:
        payload["mode"] = args.mode
    if args.direction_ref:
        refs = {}
        for spec in args.direction_ref:
            direction, path = spec.split("=", 1)
            refs[direction] = b64_image(path)
        payload["directions"] = refs
    if args.proportions:
        payload["proportions"] = args.proportions
    if args.seed is not None:
        payload["seed"] = args.seed
    if args.color_image:
        payload["color_image"] = b64_image(args.color_image)
        payload["force_colors"] = args.force_colors
    finish_async(post("/create-character-with-8-directions", payload, args.dry_run),
                 args.out_dir, "create8")


def cmd_isotile(args):
    payload = {
        "description": args.description,
        "image_size": {"width": args.size, "height": args.size},
        "isometric_tile_size": args.tile_size,
        "isometric_tile_shape": args.tile_shape,
    }
    if args.seed is not None:
        payload["seed"] = args.seed
    resp = post("/create-isometric-tile", payload, args.dry_run)
    if resp is None:
        return
    print(json.dumps(resp, indent=2)[:400])
    job_id = resp.get("background_job_id")
    if job_id:
        poll_job(job_id)
    tile_id = resp.get("tile_id") or resp.get("isometric_tile_id") or resp.get("id")
    if tile_id:
        detail = api("GET", f"/isometric-tiles/{tile_id}")
        n = save_images(detail, os.path.dirname(os.path.abspath(args.out)),
                        os.path.splitext(os.path.basename(args.out))[0])
        if n == 1:
            base = os.path.splitext(os.path.abspath(args.out))[0]
            os.replace(base + "-0.png", os.path.abspath(args.out))
            print(f"[save] {args.out}")


def cmd_tilespro(args):
    """Terrain via tiles-pro: numbered variations, autotile sets, buildings."""
    payload = {
        "description": args.description,
        "tile_type": args.tile_type,
        "tile_size": args.tile_size,
    }
    if args.tile_view:
        payload["tile_view"] = args.tile_view
    if args.flat_top_px:
        payload["tile_flat_top_px"] = args.flat_top_px
    if args.feature:
        payload["tile_feature"] = args.feature
    if args.style_image:
        payload["style_images"] = [b64_image(p) for p in args.style_image]
    if args.seed is not None:
        payload["seed"] = args.seed
    resp = post("/create-tiles-pro", payload, args.dry_run)
    if resp is None:
        return
    print(json.dumps(resp, indent=2)[:400])
    job_id = resp.get("background_job_id")
    if job_id:
        poll_job(job_id)
    tile_id = resp.get("tile_id") or resp.get("tiles_pro_id") or resp.get("id")
    detail = api("GET", f"/tiles-pro/{tile_id}")
    os.makedirs(args.out_dir, exist_ok=True)
    with open(os.path.join(args.out_dir, "tiles.json"), "w", encoding="utf-8") as fh:
        json.dump({k: v for k, v in detail.items() if k != "storage_urls"}, fh, indent=2)
    storage_urls = detail.get("storage_urls") or {}
    names = unique_safe_names(storage_urls.keys())
    for key, url in storage_urls.items():
        blob = fetch_binary(url)
        with open(os.path.join(args.out_dir, f"{names[key]}.png"), "wb") as fh:
            fh.write(blob)
        print(f"[save] {args.out_dir}/{names[key]}.png")


def cmd_mapobject(args):
    payload = {
        "description": args.description,
        "image_size": {"width": args.size, "height": args.size},
        "view": args.view,
    }
    if args.seed is not None:
        payload["seed"] = args.seed
    resp = post("/map-objects", payload, args.dry_run)
    if resp is None:
        return
    print(json.dumps(resp, indent=2)[:400])
    job_id = resp.get("background_job_id")
    if job_id:
        poll_job(job_id)
    detail = api("GET", f"/map-objects/{resp['object_id']}")
    url = detail.get("download_url")
    if url:
        blob = fetch_binary(url)
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "wb") as fh:
            fh.write(blob)
        print(f"[save] {args.out} ({len(blob)} bytes)")
    else:
        sys.exit(f"no download_url; status={detail.get('status')}")


def cmd_create_v3(args):
    """v3: highest quality; with --reference-image it ROTATES that identity."""
    payload = {
        "description": args.description,
        "view": args.view,
        "no_background": True,
    }
    if args.reference_image:
        payload["reference_image"] = b64_image(args.reference_image)
    if args.template_id:
        payload["template_id"] = args.template_id
    if args.seed is not None:
        payload["seed"] = args.seed
    finish_async(post("/create-character-v3", payload, args.dry_run),
                 args.out_dir, "create-v3")


def cmd_animate_text(args):
    """Animate OUR reference image directly — no PixelLab character needed."""
    payload = {
        "image_size": {"width": args.size, "height": args.size},
        "description": args.description,
        "action": args.action,
        "n_frames": args.frames,
        "view": args.view,
        "direction": args.direction,
        "reference_image": b64_image(args.reference_image),
    }
    if args.seed is not None:
        payload["seed"] = args.seed
    resp = post("/animate-with-text", payload, args.dry_run)
    if resp is not None:
        save_images(resp, args.out_dir, args.prefix)


def cmd_rotate(args):
    payload = {
        "from_image": b64_image(args.from_image),
        "image_size": {"width": args.size, "height": args.size},
        "from_direction": args.from_direction,
        "to_direction": args.to_direction,
        "from_view": args.from_view,
        "to_view": args.to_view,
        "isometric": args.isometric,
        "oblique_projection": args.oblique,
    }
    if args.seed is not None:
        payload["seed"] = args.seed
    resp = post("/rotate", payload, args.dry_run)
    if resp is not None:
        out_dir, name = os.path.split(os.path.abspath(args.out))
        n = save_images(resp, out_dir, os.path.splitext(name)[0])
        if n == 1:
            os.replace(os.path.join(out_dir, os.path.splitext(name)[0] + "-0.png"),
                       os.path.join(out_dir, name))
            print(f"[save] {args.out}")


def cmd_pixelate(args):
    payload = {
        "image": b64_image(args.image),
        "image_size": {"width": args.size, "height": args.size},
        "output_size": {"width": args.output_size, "height": args.output_size},
    }
    resp = post("/image-to-pixelart", payload, args.dry_run)
    if resp is not None:
        out_dir, name = os.path.split(os.path.abspath(args.out))
        n = save_images(resp, out_dir, os.path.splitext(name)[0])
        if n == 1:
            os.replace(os.path.join(out_dir, os.path.splitext(name)[0] + "-0.png"),
                       os.path.join(out_dir, name))
            print(f"[save] {args.out}")


def cmd_job(args):
    print(json.dumps(poll_job(args.id), indent=2)[:2000])


def cmd_characters(args):
    print(json.dumps(api("GET", "/characters"), indent=2)[:4000])


def cmd_character(args):
    download_character(args.id, args.out_dir)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true",
                    help="print the request instead of sending it")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("balance").set_defaults(fn=cmd_balance)

    p = sub.add_parser("create4", help="character with 4 directions")
    p.add_argument("--description", required=True)
    p.add_argument("--size", type=int, default=64)
    p.add_argument("--view", default="low top-down",
                   choices=["side", "low top-down", "high top-down"])
    p.add_argument("--isometric", action="store_true")
    p.add_argument("--directions",
                   help="comma list, e.g. south-east,south-west,north-west,north-east")
    p.add_argument("--proportions")
    p.add_argument("--seed", type=int)
    p.add_argument("--color-image", help="palette source image (forces palette)")
    p.add_argument("--force-colors", action="store_true")
    p.add_argument("--out-dir", required=True)
    p.set_defaults(fn=cmd_create4)

    p = sub.add_parser("animate", help="animate an existing character")
    p.add_argument("--character-id", required=True)
    p.add_argument("--action", help='e.g. "walking"')
    p.add_argument("--template-id", help="template animation id, if known")
    p.add_argument("--animation-name")
    p.add_argument("--frames", type=int, default=4)
    p.add_argument("--directions")
    p.add_argument("--isometric", action="store_true")
    p.add_argument("--seed", type=int)
    p.add_argument("--out-dir", required=True)
    p.set_defaults(fn=cmd_animate)

    p = sub.add_parser("create8", help="character with 8 directions")
    p.add_argument("--description", required=True)
    p.add_argument("--size", type=int, default=64)
    p.add_argument("--view", default="low top-down",
                   choices=["side", "low top-down", "high top-down"])
    p.add_argument("--isometric", action="store_true")
    p.add_argument("--template-id",
                   help="'mannequin' (default), or quadrupeds: bear/cat/dog/horse/lion")
    p.add_argument("--mode", choices=["standard", "pro"],
                   help="pro = AI reference-based, for non-template body shapes "
                        "(blobs, serpents, flyers); costs 20-40 generations")
    p.add_argument("--direction-ref", action="append",
                   help="direction=path reference image (repeatable); bipeds "
                        "need at least south=... ; image must match --size")
    p.add_argument("--proportions")
    p.add_argument("--seed", type=int)
    p.add_argument("--color-image")
    p.add_argument("--force-colors", action="store_true")
    p.add_argument("--out-dir", required=True)
    p.set_defaults(fn=cmd_create8)

    p = sub.add_parser("isotile", help="isometric terrain tile")
    p.add_argument("--description", required=True)
    p.add_argument("--size", type=int, default=64)
    p.add_argument("--tile-size", type=int, default=32,
                   help="isometric tile size (16 or 32 recommended)")
    p.add_argument("--tile-shape", default="thin tile",
                   choices=["thin tile", "thick tile", "block"],
                   help="engine draws flat 64x32 diamonds -> thin tile")
    p.add_argument("--seed", type=int)
    p.add_argument("--out", required=True)
    p.set_defaults(fn=cmd_isotile)

    p = sub.add_parser("tilespro", help="terrain tiles pro (variations/autotiles/buildings)")
    p.add_argument("--description", required=True,
                   help="number variations: '1). grass 2). soil ...'; for "
                        "--feature tileset describe a transition: 'grass to water'")
    p.add_argument("--tile-type", default="isometric",
                   choices=["hex", "hex_pointy", "isometric", "oblique",
                            "octagon", "square_topdown"])
    p.add_argument("--tile-size", type=int, default=64)
    p.add_argument("--tile-view",
                   choices=["top-down", "high top-down", "low top-down", "side"])
    p.add_argument("--flat-top-px", type=int, choices=[2, 4],
                   help="2 = classic pointed diamond (engine style)")
    p.add_argument("--feature", choices=["roads", "tileset", "building"])
    p.add_argument("--style-image", action="append",
                   help="approved tile PNG(s) to lock style to (repeatable)")
    p.add_argument("--seed", type=int)
    p.add_argument("--out-dir", required=True)
    p.set_defaults(fn=cmd_tilespro)

    p = sub.add_parser("mapobject", help="map object / prop")
    p.add_argument("--description", required=True)
    p.add_argument("--size", type=int, default=64)
    p.add_argument("--view", default="low top-down",
                   choices=["side", "low top-down", "high top-down"])
    p.add_argument("--seed", type=int)
    p.add_argument("--out", required=True)
    p.set_defaults(fn=cmd_mapobject)

    p = sub.add_parser("create-v3", help="v3 character; reference image is rotated")
    p.add_argument("--description", required=True)
    p.add_argument("--reference-image", help="south-facing identity concept (any size)")
    p.add_argument("--view", default="low top-down",
                   choices=["side", "low top-down", "high top-down"])
    p.add_argument("--template-id")
    p.add_argument("--seed", type=int)
    p.add_argument("--out-dir", required=True)
    p.set_defaults(fn=cmd_create_v3)

    p = sub.add_parser("animate-text",
                       help="animate a reference image via text (no character id)")
    p.add_argument("--reference-image", required=True)
    p.add_argument("--description", required=True, help="who the character is")
    p.add_argument("--action", required=True, help='e.g. "walk"')
    p.add_argument("--frames", type=int, default=4)
    p.add_argument("--size", type=int, default=64)
    p.add_argument("--view", default="low top-down",
                   choices=["side", "low top-down", "high top-down"])
    p.add_argument("--direction", default="south-east")
    p.add_argument("--seed", type=int)
    p.add_argument("--prefix", default="frame")
    p.add_argument("--out-dir", required=True)
    p.set_defaults(fn=cmd_animate_text)

    p = sub.add_parser("rotate", help="rotate an existing sprite to a new facing")
    p.add_argument("--from-image", required=True)
    p.add_argument("--size", type=int, default=64)
    p.add_argument("--from-direction", default="south-west")
    p.add_argument("--to-direction", required=True)
    p.add_argument("--from-view", default="low top-down")
    p.add_argument("--to-view", default="low top-down")
    p.add_argument("--isometric", action="store_true")
    p.add_argument("--oblique", action="store_true")
    p.add_argument("--seed", type=int)
    p.add_argument("--out", required=True)
    p.set_defaults(fn=cmd_rotate)

    p = sub.add_parser("pixelate", help="convert an image to pixel art")
    p.add_argument("--image", required=True)
    p.add_argument("--size", type=int, default=128, help="working canvas size")
    p.add_argument("--output-size", type=int, default=64)
    p.add_argument("--out", required=True)
    p.set_defaults(fn=cmd_pixelate)

    p = sub.add_parser("job", help="poll a background job")
    p.add_argument("--id", required=True)
    p.set_defaults(fn=cmd_job)

    sub.add_parser("characters", help="list characters").set_defaults(fn=cmd_characters)

    p = sub.add_parser("character", help="download a character (json + zip)")
    p.add_argument("--id", required=True)
    p.add_argument("--out-dir", required=True)
    p.set_defaults(fn=cmd_character)

    # Accept --dry-run before OR after the subcommand name. SUPPRESS keeps a
    # subcommand-level absence from clobbering a main-level --dry-run.
    for sp in sub.choices.values():
        sp.add_argument("--dry-run", action="store_true",
                        default=argparse.SUPPRESS, dest="dry_run")

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
