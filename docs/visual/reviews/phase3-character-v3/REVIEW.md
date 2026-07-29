# Phase 3 character evidence — Ranger & Mage v3 (review pack)

**Date:** 2026-07-29 (UTC) · **Purpose:** evidence delivery only, for ChatGPT's visual/North-Star
review and Leo's disposition. Nothing here is normalized, validated, promoted to `assets/`, wired
into `index.html`, or approved. Everything is staged from existing gitignored `_probe_local/`
outputs; **zero PixelLab credits were spent producing this pack.**

## Sheets in this directory

| File | What it shows | Claude's read |
| --- | --- | --- |
| `ranger-v3-rotations.png` | Ranger v3, 8 labelled directions (`make_cast_sheet.py`) | Review-ready |
| `mage-v3-rotations.png` | Mage v3, 8 labelled directions | Review-ready (identity previously accepted by Leo during calibration) |
| `mage-walk.png` | Mage walk, 4 engine directions × 5 frames (frame_000 = stand) | Review-ready; Claude's inspection found clean strides, identity held |
| `ranger-walk1-failed.png` | Ranger walk attempt 1, raw sheet | **FAILED** — see findings below; retained as evidence only |
| `ranger-walk2-steady-stride.png` | Ranger walk attempt 2 (steady-stride action, seed 11) | Review-ready; Claude's inspection found clean strides, identity held |
| `ranger-walk-failed-vs-success.png` | Per-direction comparison: failed row (red) above successful row (green) | The key exhibit for findings 1–4 |

Sheets are nearest-neighbour upscales of the raw generation frames (Ranger 192², Mage 256²);
no runtime-size (64×64 normalized) views exist yet because normalization is deliberately
deferred until after this review.

## Provenance

| Character | PixelLab character ID | Canvas | View | Created (UTC) |
| --- | --- | --- | --- | --- |
| Ranger | `92bb93e5-25e1-4f8c-bae9-65ce0f9c8c84` | 192×192 | low top-down | 2026-07-29 03:43 |
| Mage | `7979e760-a7c0-49a1-8a1f-e1f364dddb42` | 256×256 | low top-down | 2026-07-29 02:27 |

Source probe paths (gitignored, canonical): `_probe_local/pipeline/ranger-v3/`,
`ranger-v3-walk/` (failed), `ranger-v3-walk2/` (success), `mage-v3/`, `mage-walk/`.

The Mage character was created with `create-v3 --seed 11` from Leo's approved concept
(`art-incoming/mage-concept-v1.png`, SHA-256 `68F9158F…0334`); full command recorded in
`_probe_local/pipeline/review-pack/REVIEW-PACK.md`. The Ranger character was created via
`create-v3` in an earlier calibration step this session; its prompt and settings are durable in
the server `character.json`, but its creation seed was not separately logged — PixelLab does
**not** record seeds server-side (finding for the docs pass).

Walk generation commands (each run = 4 directions ≈ 12 generations; job IDs are per-direction
and recorded in local session task logs):

```
# Mage walk — CLEAN result despite bare action (run in run-heroes-batch.sh)
pixellab_client.py animate --character-id 7979e760-… --action "walking" \
  --frames 4 --isometric --directions south-east,south-west,north-west,north-east

# Ranger walk attempt 1 — FAILED (bare action, no seed)
pixellab_client.py animate --character-id 92bb93e5-… --action "walking" \
  --frames 4 --isometric --directions south-east,south-west,north-west,north-east

# Ranger walk attempt 2 — SUCCESS
pixellab_client.py animate --character-id 92bb93e5-… \
  --action "walking with a steady stride, legs stepping, arms swinging naturally" \
  --frames 4 --isometric --seed 11 \
  --directions south-east,south-west,north-west,north-east
```

Server-side note: animation sets **append** to the character (named after the slugified action
description), so the failed `walking` set still exists on the Ranger character alongside the
good `walking_with_a_steady_stride…` set. Any future download must select the correct set folder.

## Directions and engine-slot mapping (locked)

`right = south-east · down = south-west · left = north-west · up = north-east`
(64×64 final frames, foot pivot row 63, per `tools/pipeline/PIPELINE.md`.)
Rotation sheets show all 8 directions; the engine consumes the 4 diagonals.

## Findings (recorded, not overstated)

1. **Bare `--action "walking"` on the Ranger hallucinated new content:** in SE and SW the
   bow/quiver region mutated into a growing animal-companion-like object beside the hero; NW
   grew dashed projectile-trail artifacts. See the red rows of the comparison sheet.
2. **The seeded, explicit action** — `"walking with a steady stride, legs stepping, arms
   swinging naturally"` + `--seed 11` — produced the clean retry, per Claude's visual
   inspection (pending the lead's review). Note the *Mage's* bare `"walking"` run came out
   clean, so the failure is stochastic risk, not a deterministic property of the bare action;
   the explicit action + seed is risk mitigation, not a proven guarantee.
3. **Machine structure gates cannot catch this failure class:** every failed frame is a valid,
   correctly-sized, alpha-clean PNG. Only visual inspection detects a semantically
   hallucinated companion or prop mutation.
4. **Therefore: raw direction-labelled walk sheets must receive visual inspection before
   normalization** — proposed as a mandatory pipeline gate in the follow-up docs pass.
5. **Frame 0 must visually match the corresponding standing rotation** before a walk set may
   proceed (frame_000 is the stand/reference frame; the engine walk pattern is
   stand → A → stand → B). The success sheets satisfy this on Claude's inspection; the
   reviewer should confirm.

## Approval state — what exists and what is pending

**Prior owner approvals that actually exist:**

- Leo approved the Mage identity concept and the Mage v3 identity rotation during pipeline
  calibration (PR #15 context), plus the enemy cast sheet and Farm landscape sheet.
- Leo accepted the *original* Ranger experimental source and corrected SE walk strip in merged
  PR #11 — that is a **different asset lineage** from this PixelLab ranger-v3 character and
  does not transfer to it.

**Pending (nothing in this pack is approved):**

- ChatGPT visual/North-Star review of all six sheets, and Leo's disposition.
- The separate four-character pack (Mage/Mira/Shadow Warden/Crystal Wyrm rotations) also
  awaits ChatGPT's verdict; its two drift flags (Mira NE basket, Wyrm NE pose) are tracked in
  `_probe_local/pipeline/review-pack/REVIEW-PACK.md`.

**What an approval here would authorize:** normalizing these specific rotation/walk sets
through the merged pipeline (`normalize_sprite.py` → `validate` with `--require-walks`),
producing runtime-size review views, and staging validated output as Phase 3 candidates.

**What it would NOT authorize:** committing anything to `assets/`, editing `index.html`,
generating further animations or characters, spending credits, changing the North Star, or
skipping the exact-head non-author review on whatever PR eventually integrates the assets.

## North Star alignment

Claude's read: **Aligned, pending the lead's verdict** — same `low top-down` view and
restrained-palette treatment as the approved cast; the brotherly duo silhouette contrast
(small hooded Mage vs. taller cloaked Ranger) holds in the success sheets. The roster-wide
soft-neutral key-light question raised in the four-character pack applies here too and remains
the lead's call. The failed sheet is excluded from any alignment claim; it exists only as
process evidence.
