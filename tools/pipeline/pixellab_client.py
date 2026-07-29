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
import sys
import time
import zipfile

import requests

BASE = "https://api.pixellab.ai/v2"
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


def api(method, path, payload=None, raw=False):
    headers = {"Authorization": f"Bearer {get_token()}"}
    resp = requests.request(
        method, BASE + path, json=payload, headers=headers, timeout=180
    )
    if resp.status_code >= 400:
        sys.exit(f"API {method} {path} -> {resp.status_code}: {resp.text[:800]}")
    return resp.content if raw else resp.json()


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
        if status in ("completed", "failed"):
            return job
        if time.time() - start > POLL_TIMEOUT:
            sys.exit(f"job {job_id} still {status} after {POLL_TIMEOUT}s; giving up")
        time.sleep(POLL_SECONDS)


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
        zf.extractall(os.path.join(out_dir, "zip"))
        names = zf.namelist()
    print(f"[save] {zpath} ({len(names)} files) -> {out_dir}/zip/")
    return detail


def finish_async(resp, out_dir, prefix):
    """Handle sync-or-async responses: poll if needed, then save everything."""
    if resp is None:                          # dry run
        return
    print(json.dumps({k: v for k, v in resp.items() if k != "images"}, indent=2)[:600])
    job_id = resp.get("background_job_id")
    if job_id:
        poll_job(job_id)
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

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
