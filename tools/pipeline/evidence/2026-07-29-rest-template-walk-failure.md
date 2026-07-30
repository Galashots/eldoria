# Evidence note: REST/Python template-walk failure (2026-07-29)

**Status:** Durable, sanitized import of an author-held session record from the
2026-07-29 generation session, committed 2026-07-30 so the claim it supports is
independently inspectable in-repo. This note contains no credentials, no raw
sprites, and no session transcript — only the request facts and measured
outcomes that control future spending decisions.

## Request

| Field | Value |
|---|---|
| Date | 2026-07-29 |
| Interface | REST via Eldoria's Python client (`tools/pipeline/pixellab_client.py`) |
| Endpoint | `POST /animate-character` |
| Mode | Template (`template_animation_id: "walking"`) |
| Character | Eldoria Ranger, `add36c36-295d-4626-94fd-179a4102d1ea` |
| Canvas | 256×256 (`mannequin` body, `view: high top-down`) |
| Directions | 4 (the diagonal set of the pipeline probe command: `south-east`, `south-west`, `north-west`, `north-east`) |

The character UUID also appears in the author's local (untracked)
`_probe_local/heroes-20260729/ranger/character.json`; that local file is
corroboration for the author only and is **not** part of the repo record —
this note is the durable record.

## Measured outcomes

- **Visual gate: FAILED, set rejected.** Frames hallucinated a wide-brimmed
  hat on a bareheaded character, drifted the camera from ~35° toward
  straight-down, and broke identity frame to frame (black hair in one frame,
  a white outfit in another, a lime tunic in a third). Not a gait — six
  unrelated poses.
- **Billing: 20 generations for 4 directions (~$0.184)** vs the documented
  template rate of 1 generation/direction — ~5× the documented rate at this
  canvas size. Wall clock ~15 minutes.
- **Route-specific, not character-specific:** the same character's *cardinal*
  walks, produced manually through the web Creator route in the same period,
  were clean (stable identity, stable camera, legible alternating stride).

## Operational traps measured on the same run

- `/animate-character` returns **`background_job_ids` — one job per
  direction**, not a single job id.
- The client's `POLL_TIMEOUT = 600` caused it to **give up and exit non-zero
  while the jobs kept running and billing**. A client timeout is not a
  failure and not a refund; poll the job ids directly.
- **No cancel exists.** Once POSTed, the spend is committed.
- `animation_name` is **ignored** when `template_animation_id` is set; the
  set is named from the template slug (`walking`), which merged with an
  existing `Walking` set during Windows zip extraction.

## Referenced by

- [`COMBAT_ARMOR_STRATEGY.md`](../COMBAT_ARMOR_STRATEGY.md) §1 (template
  evidence by interface)
- [`PIPELINE.md`](../PIPELINE.md) (template-route block)
