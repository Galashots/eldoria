# PixelLab API — capability, cost, and repair reference

**Last verified:** 2026-07-29 against `api.pixellab.ai/v2/openapi.json`,
`api.pixellab.ai/mcp/docs`, `api.pixellab.ai/v2/llms.txt`, and the
`pixellab.ai/docs` guide pages.

**How to re-verify:** `curl` the spec and parse it with a script. Do **not** use a
summarizing fetch — two earlier passes over these same docs produced wrong
answers that way (see §7).

## What this file is, and is not

[`PIXELLAB_MCP.md`](PIXELLAB_MCP.md) deliberately says it is *"not a copy of
PixelLab's documentation — read the live guide when exact parameters, costs, or
newly released tools matter."* That policy is correct for parameter minutiae and
newly shipped tools, and this file does not overturn it.

But the policy failed in practice: nobody read the cost model, and the project
spent roughly **eight times** what it needed to on every hero (§7). So this file
records the small set of **durable decisions and rules derived from** those docs
— the ones that change what we spend and whether the art is usable. It is a
decision record, not a mirror of the vendor reference.

| Doc | Owns |
|---|---|
| `PIXELLAB_MCP.md` | Connecting agents to PixelLab; secrets; operating rules |
| **`PIXELLAB_API.md`** (this) | **What to call, what it costs, how to repair it** |
| `PIPELINE.md` | Eldoria's end-to-end production pipeline and calibration record |
| `.claude/skills/asset-generation/SKILL.md` | The Eldoria run-book |

---

## 1. Cost and sizing — read this before generating anything

**Rotation cost is documented as `ceil(w × h × 8 / 65536)` generations.**
From-scratch mode adds one Pixen generation: `1 + ceil(s² × 8 / 65536)`.

| Character size | Rotation set | Custom (v3) walk, 4 directions |
|---|---|---|
| 256 px | **8 gens** | ~8/dir → **~32 gens** |
| 192 px | 5 gens | ~6/dir → ~24 gens |
| 128 px | 2 gens | ~2/dir → ~8 gens |
| 96 px | 2 gens | ~1/dir → ~4 gens |
| **64 px** | **1 gen** | **~1/dir → ~4 gens** |

Animation cost scales with canvas × frames the same way: roughly 1 generation
per direction at ≤96 px, rising to ~8 per direction at 256 px.

### The rule

> **Set `size` to the engine's target resolution. Never let it default.**

`size` defaults to 48 px — *except* when you pass a reference image, where it
**silently inherits the reference's own dimensions**. Feed a 256×256 concept and
you get a 256 px character, an 8× bill, and every future animation on that
character billed at 256 px too.

This is not only a cost argument. Eldoria renders at **64×64**. Generating at
256 px and downscaling 4× blends 4×4 blocks into one output pixel, which is
exactly how you destroy a pixel grid. Generating at the target size is
**cheaper and sharper**. Reserve larger sizes for art that genuinely ships large.

Canvas comes back roughly 40% larger than `size` to leave animation room; the
normalizer handles that.

### Mode costs

| Mode | Cost | Use when |
|---|---|---|
| `template` | **1 gen/direction** | A stock motion fits (see the template list in §5) |
| `v3` | scales with canvas×frames | Custom motion needed; default when no `template_animation_id` |
| `pro` | **20–40 gen/direction** | Highly detailed characters only. Requires `confirm_cost` — never set it on the first call; surface the quoted cost to the owner first |

`enhance_prompt` costs **+0.05 generations**.

---

## 2. Route decision table

| Job | Endpoint / mode | Notes |
|---|---|---|
| Hero / named NPC identity | `create-character-v3` **with** `reference_image` | The supported identity route. See §3 |
| Rotate an existing approved sprite | `generate-8-rotations-v3` | Takes `first_frame` + optional `description` hint |
| Simple humanoid enemy | `create-character-with-8-directions` | `proportions` works here (not in v3) |
| Quadruped | `--template-id bear\|cat\|dog\|horse\|lion` | Template must match the body in the reference |
| Non-template body (blob, serpent, flyer) | `mode=pro` | Expensive; confirm cost first |
| Gear / outfit / pose variant of an existing character | **`create-character-state`** | One edit applied consistently across **all** rotations; keeps identity, body type and proportions. `use_color_palette_from_reference` snaps it to the source palette |
| Stock motion | `animate-character` + `template_animation_id` | 1 gen/direction |
| Custom motion | `animate-character` + `action_description` | v3; see §5 |
| Fill in directions a partial animation missed | `animation_group_id` | Appends to the existing group instead of regenerating the set |
| Download everything | `GET /characters/{id}/zip` | Rotations, animation frames, `metadata.json`, and per-frame keypoints |

**Downloads need no authentication — the UUID is the access key, and PixelLab
says to share those links freely.** That is the cheapest way to give an external
reviewer (e.g. ChatGPT) real image bytes without committing PNGs anywhere.

**Creation is non-blocking.** Every create returns a job id immediately; queue
animations straight away rather than waiting for the character to finish.

---

## 3. Identity route — why heroes need a south-facing reference

`reference_image` is documented as a **south-facing character sprite**, and the
vendor calls reference mode *"the right tool for turning an existing character
sprite into a full rotating character."*

Omit it and you get **from-scratch mode**: Pixen invents a south sprite, then v3
rotates that invention. Two stochastic steps instead of one anchored one.

The vendor is explicit that the guidance knobs are weak:

> "The view and direction controls are **quite weak** in this tool, and you can
> often get better results if you also use an init image."

So relying on text alone to produce a faithful eight-direction wheel is the
**unsupported** path. Every hero gets a concept first. `view` is likewise a weak
hint: `low top-down` ≈ 20° above, `high top-down` ≈ 35°.

Constraints: reference max **256×256**; requires `mode=v3`; `outline`/`detail`
hints are ignored when a reference is supplied; `proportions` is ignored by v3
entirely (it applies to standard/pro only).

---

## 4. Repair playbook — a bad direction is not automatically a reroll

The vendor documents four fixes, in rough order of cost:

1. **Mirror the opposing angle** — *only if the character is symmetric.* Flip a
   good `south-west` to make `south-east`. **Illegal for anyone carrying or
   wearing something asymmetric** (a bow, a quiver, a staff, a basket): it moves
   their gear to the wrong side. This is why the Ranger could not be mirror-repaired.
2. **Inpaint** the region that failed.
3. **Init image** — take the failed frame, fix it by hand, feed it back as an
   init image. Documented strength bands:

   | `init_image_strength` | Effect |
   |---|---|
   | 0–300 | Rough colour guidance only |
   | 300–400 | Rough shapes and colours |
   | 400–600 | Variations on an existing image |
   | 600–900 | Detailed guidance — modifying a nearly finished piece |

4. **Regenerate from scratch** — last resort, *"the model might make the same
   mistake again."*

**Chained rotation** (generate each direction 45° from the previous one) is
better at each individual step, but *"any errors will accumulate."* Generating
all directions from one camera-facing reference is more robust for a full set.

Known weakness: the model **"struggles with hats and accessories."** That is the
documented explanation for the Mira-basket drift flag, not a one-off.

---

## 5. Animation specifics

- **`--frames N` returns N+1 files per direction.** `keep_first_frame` (v3 only,
  default `true`) keeps the reference as `frame_000`. Convenient for us: the
  engine's walk contract needs frame 0 to be a stand pose.
- **`directions` defaults differ by mode.** Template mode animates every
  character direction; **custom mode animates `south` only.** Always pass
  `directions` explicitly.
- **Animation sets append server-side**, named after the slugified action. A bad
  set is never deleted — later downloads must select the right folder by name.
- **`frame_count`** 4–16, even, **v3 only.** Pro ignores it: frame count is fixed
  by size (≤64 px → 16 frames, >64 px → 4).
- **`ai_freedom`** (0–900) is **template mode only**; 0 follows the template rigidly.
- **`custom_start_frame_url` / `end_frame_url`** enable interpolation between two
  poses — **v3 only, one direction per call.** Prefer the URL forms; inline
  base64 is routinely truncated by MCP clients, which silently corrupts the image.
- **Seeds are not stored server-side.** `character.json` records id, prompt, view,
  directions and status — no seed. The command is the only durable record.
- **Template motions available** include `walk`, `walking`, `walking-2..10`,
  `walking-N-frames`, `crouched-walking`, `sad-walk`, `scary-walk`,
  `running-4/6/8-frames`, plus non-walk motions (`attack`-style: `cross-punch`,
  `lead-jab`, `high-kick`, `roundhouse-kick`, `fireball`, `throw-object`,
  `picking-up`, `pushing`, `drinking`, `breathing-idle`, `falling-back-death`).

### Writing an action description for an equipped character

There is **no `negative_description` on `create-character-v3` or the character
animation endpoint** — it exists only on `animate-with-text`, the create-image
endpoints, and `inpaint`. On the v3 route the action text is the only lever, so
it has to do the work:

- name **what is held and in which hand**;
- name **what is attached and must not move**;
- say **which arm may swing**;
- end with **"no new objects, companions, creatures or effects."**

A generic *"arms swinging naturally"* is actively harmful for anyone holding
something — it invites the model to free up the occupied hand.

---

## 6. Gotchas and the API-vs-web-tool boundary

Several attractive options exist **only in the web tool / plugin** and are absent
from the REST API. Verified absent — do not go looking for them again:

| Not in the REST API | What it would have done |
|---|---|
| `direction_type: ordinal` | Generate only the 4 diagonals we actually use |
| `rotation` / `tilt` angles | Explicit per-frame angle control |
| "Create animations (automatic)" | Character + animation in all directions in one call (≤64×64, Tier 1) |

Other traps:

- **`enhance_prompt` on `create-character-v3` is from-scratch only.** Passing it
  together with `reference_image` returns **422**. On `animate-character` it
  expands `action_description` and reuses the expansion across all directions.
- **`create-character-with-4-directions` is cardinal-only** (`south`, `east`,
  `north`, `west`). Its `directions` field takes reference *images*, not a
  selector. For diagonals use an 8-direction route and keep the four you need.
- **`estimate-skeleton` accepts only 16/32/64/128/256 px.**
- **`oblique` view** is BETA: max 128 px, 4-direction, standard mode only.
- An **official Python SDK** exists (`pip install pixellab`). Eldoria hand-rolled
  `pixellab_client.py` before that was noted; worth revisiting if the client ever
  needs significant work.

---

## 7. What we got wrong, and why it is recorded here

Two passes over these same documents produced wrong answers. Recording the
failure modes is the point of this file.

- **Cost was never checked.** The Mage was generated at 256 px and the Ranger at
  192 px because `size` was never passed and silently inherited the reference
  dimensions. Every rotation set and every custom walk on those characters was
  billed at up to 8× the necessary rate, and the output was then downscaled 4× to
  64 px — paying more for worse pixels.
- **`enhance_prompt` was documented as available on `create-character-v3`**
  without the from-scratch-only constraint. It would have returned 422.
- **The Ranger was generated from-scratch** with no concept image, skipping the
  documented identity route, and its rotation wheel collapsed: four of eight
  directions came back as near-identical back views, with `south-west` — engine
  slot `down` — facing away from the camera. The Mage, built from a concept
  reference in the same session, rotated correctly. That contrast is the evidence
  that the route, not luck, is what matters.
- **A summarizing fetch twice reported that `/animate-character` does not exist.**
  It does. Parse the spec directly.

**North Star alignment:** process and cost documentation only. No art, no visual
change, no alteration to the approved direction.
