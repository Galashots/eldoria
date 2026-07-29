# PixelLab API — capability, cost, and repair reference

**Last verified:** 2026-07-29 against `api.pixellab.ai/v2/openapi.json`,
`api.pixellab.ai/mcp/docs`, `api.pixellab.ai/v2/llms.txt`, and the
`pixellab.ai/docs` guide pages.

**Source authority:** Live PixelLab sources control current vendor parameters,
service capabilities, validation rules, and pricing. Eldoria repository docs
control accepted routes, engine contracts, security policy, normalization,
validation, and review gates. If they conflict, stop and repair the stale
repository guidance before spending credits.

**How to re-verify:** `curl` the spec and parse it with a script. Do **not** use a
summarizing fetch — two earlier passes over these same docs produced wrong
answers that way (see §7).

## What this file is, and is not

[`PIXELLAB_MCP.md`](PIXELLAB_MCP.md) deliberately says it is *"not a copy of
PixelLab's documentation — read the live guide when exact parameters, costs, or
newly released tools matter."* That policy is correct for parameter minutiae and
newly shipped tools, and this file does not overturn it.

But the policy failed in practice: nobody read the cost model, and early heroes
were generated at 192–256 px references (silently inheriting the concept's
dimensions) instead of the 64 px that the engine actually needs (§7). So this file
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

**MEASURED 2026-07-29** on two live reference-mode runs (Ranger, seed 11,
`view=high top-down`, no `image_size` sent). This section previously said "do not
state which one won until step 3 has actually been done." Step 3 is now done.

### What was measured

| Reference fed | Figure in reference | Figure in output | Output canvas | Charged |
|---|---|---|---|---|
| 64×64 | 52 px tall | **52.6 px** | 108×108 | **1 gen** |
| 128×128 | 104 px tall | **104.6 px** | 216×216 | **2 gens** |
| 64×64 (3rd run, unarmed) | 54 px tall | **52–56 px** | 112×112 | **1 gen** |

Two working rules fall out; both held on all three runs, but they are current
measured observations, not universal vendor guarantees:

1. **[MEASURED IN ELDORIA] The figure's pixel height was preserved approximately
   1:1 from the reference across three runs.** Figure occupancy was 48.7%,
   48.4%, and 48.2% of canvas — consistent but not a documented vendor
   commitment.
2. **[MEASURED IN ELDORIA] Rotation is billed on the REFERENCE dimensions, not
   the output canvas.**
   `ceil(ref_w × ref_h × 8 / 65536)` predicted 1, 2 and 1; 1, 2 and 1 were
   charged. Billing on the *output* would have predicted 2, 6 and 2. It did not.

**The canvas size is padding, and it is not exactly predictable.** The spec says
*"Final canvas is padded ~2x for animation room (capped at 256)"*, and a
character that looks like it "came back bigger" is a padded canvas around a
same-size figure. But two 64 px references produced **108** and **112** canvases,
so the padding is approximate — do not treat any multiplier as exact. Budget for
animation against the canvas you actually receive, not a predicted one.

> ### The rule
>
> **Size the reference so the figure lands at the engine's target height.**
> That single lever sets identity fidelity, output size, and price at once.

Eldoria's contract is a **64×64** frame (`normalize_sprite.py`, `FRAME = 64`),
so the target figure is ~52–56 px — which is what a **64×64 reference** produces,
at **1 generation**. That is the standard for Eldoria heroes.

| Reference | Figure out | Rotation cost | Verdict for a 64px frame |
|---|---|---|---|
| **64 px** | **~52 px** (measured) | **1 gen** (measured) | **Standard.** Lands on target, no resampling |
| 128 px | ~104 px (measured) | 2 gens (measured) | 1.9× downscale. Only if fine props must survive (§3) |
| 256 px | ~208 px (projected, unmeasured) | **8 gens** (projected from formula) | Avoid: expensive, requires destructive downscale to reach 64 px |

For the measured **API reference-mode route**, bigger references buy a bigger
figure that must be downscaled and cost more. Generating near target is the
cost-optimized standard when it preserves the required identity.

### Separate manual Creator result — measured visually, cost unmeasured

A 2026-07-29 manual PixelLab Character run used a 256×256 South-facing Ranger
reference already drawn at the target high-top-down camera (approximately 35°).
It returned 8 transparent 256×256 rotations whose figures measured 215–227 px
tall, or approximately 54–57 px after deterministic 64px downscale. Identity,
heading and camera held, and the downscaled set remained readable.

This proves that the manual 256px Creator route can be a valid quality route. It
does **not** prove its cost, does not change the API billing table above, and does
not make 256px mandatory. Record the route used and judge cost, fidelity and
runtime downscale separately.

### What is still unverified

`image_size` was **not sent** on any run, so output was determined entirely by
the reference. That is consistent with the spec calling it *"advisory (model
picks its own size)"* in reference mode, but **we have not tested whether passing
it overrides the reference.** Do not assume it does. The reference's own
dimensions are the lever we have actually proven.

Animation cost is billed against the character's canvas, so a 216 px character
stays expensive for every walk and attack it ever receives. This is the surviving
reason to keep characters small, and it is independent of the rotation billing
above.

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

**[VENDOR-DOCUMENTED] Downloads need no authentication — the UUID is the access
key, and PixelLab permits sharing those links.** Eldoria permits public sharing
of download links **only** for assets intentionally released for public review.
Private, confidential, or unapproved outputs remain unlisted — treat their UUIDs
as unlisted credentials until the asset is approved for sharing.

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

Description-only generation is supported by PixelLab, but Eldoria rejected it as
the hero identity route because it proved less reliable: the from-scratch Ranger
produced four near-identical back views, while the reference-based Mage rotated
correctly in the same session. Every hero gets a concept first. `view` is a weak
hint: `low top-down` ≈ 20° above, `high top-down` ≈ 35°.

Constraints: reference max **256×256**; requires `mode=v3`; `outline`/`detail`
hints are ignored when a reference is supplied; `proportions` is ignored by v3
entirely (it applies to standard/pro only).

### Eldoria's tested default: South-facing at the target camera

**[VENDOR-DOCUMENTED]** PixelLab defines `south` as facing the camera and
`high top-down` as looking down at approximately 35°. Its view and direction
controls are weak. Its rotation guide further states that changing camera
perspective is not what the rotation model was trained to do.

**[MEASURED IN ELDORIA]** The manual Ranger Character workflow supplied a
South-facing reference already drawn at the 35° high-top-down camera and asked
for rotations only. PixelLab returned all 8 directions with consistent identity,
scale and camera.

> **Production default:** establish Eldoria's high-top-down camera in the
> approved South-facing reference. Use PixelLab to rotate direction, not to
> convert an eye-level concept to the game camera.

A prior API run fed a flat eye-level concept to
`create-character-v3(view=high top-down)` and happened to rotate correctly in
all 8 directions (51–53 px figure height). Keep this as historical measured
fallback evidence. It does not supersede the target-camera default because the
vendor describes the camera transformation as weak/untrained.

The REST endpoint exposes one `view` field used by generation and skeleton
reconstruction rather than separate from/to camera fields. The reference and
declared view must therefore describe the same target camera.

All 8 directions are retained as canonical production sources. The current
engine consumes SE/SW/NW/NE as right/down/left/up, but south/east/north/west are
not discarded. The owner intends a later bounded eight-direction runtime for
heroes and moving NPCs/enemies.

### Do not bake weapons into a hero's base sprite

Eldoria composites equipment as layers — `index.html` defines
`EQUIPMENT_SLOTS = ['head', 'body', 'weapon', 'cape']` and draws cape → base →
body → head → weapon at the same position and frame index. A weapon baked into
the base sprite therefore cannot be swapped, and fights every future gear tier.

It also costs fidelity. Measured on the Ranger: at a 64 px reference the bow was
~1 px wide and **did not survive rotation** — a broken stick in `south`, a
featureless stave in `north-east`, and **entirely absent in `south-west`**, the
frame the engine maps to walking toward the camera. At a 128 px reference the
same bow survived in all eight. Fine props are the thing that breaks first when
you shrink a reference.

Generate the hero **unarmed**, and treat the weapon as a `weapon`-slot overlay.

**[UNTESTED]** `create-character-state` (§2) applies one edit consistently across
all rotations, keeping identity and proportions — but it returns a **complete
edited character**, not an engine-ready transparent equipment-slot overlay.
Producing transparent per-slot overlays (weapon, body, head, cape) that composite
correctly with Eldoria's layer pipeline is a separate, untested calibration need.
Do not assume the overlay pipeline is solved.

PixelLab has no equipment-layer endpoint that attaches an item to a specific
limb. Eldoria's overlays are full-frame aligned layers, not hand-anchored.
(There is no hand keypoint to anchor to: the skeleton enum stops at
`LEFT ARM`/`RIGHT ARM`, and `skeletons` came back `null` on both v3
reference-mode characters.)

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

**[VENDOR-DOCUMENTED]** Known weakness: the model *"struggles with hats and
accessories."* This is a plausible risk factor for accessory drift (such as the
Mira-basket flag), but not a measured diagnosis of any specific failure — the
vendor's general warning and a particular observed drift share a category without
proven causation.

---

## 5. Animation specifics

**[MEASURED IN ELDORIA — manual Creator route]** The Ranger South walk export
contains 8 transparent 256×256 GIF frames at 200 ms/frame. It passed as
candidate source motion. Retain the 8 raw frames; bottom-center normalize,
inspect opposite foot contacts and 64px readability, and choose any current
4-frame compatibility strip deliberately. Do not inherit GIF timing or
hard-code an unreviewed 8→4 selection.

- **`--frames N` returns N+1 files per direction.** `keep_first_frame` (v3 only,
  default `true`) keeps the reference as `frame_000`. Convenient for us: the
  engine's walk contract needs frame 0 to be a stand pose.
- **`directions` defaults differ by mode.** Template mode animates every
  character direction; **custom mode animates `south` only.** Always pass
  `directions` explicitly. Retain every completed direction. A partial proof
  is not the final motion set for a character intended to move in 8 directions.
- **Animation sets append server-side**, named after the slugified action.
  **[VENDOR-DOCUMENTED]** PixelLab exposes animation deletion, but Eldoria's
  current client and workflow do not automatically delete bad sets — later
  downloads must select the right folder by name.
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

- **[VENDOR-DOCUMENTED]** `enhance_prompt` on `create-character-v3` is
  from-scratch only — passing it together with `reference_image` returns **422**.
  **[UNTESTED IN ELDORIA]** On `animate-character` it expands
  `action_description` and reuses the expansion across all directions; behavior
  there has not been exercised in this pipeline.
- **`create-character-with-4-directions` is cardinal-only** (`south`, `east`,
  `north`, `west`). Its `directions` field takes reference *images*, not a
  selector. Use an 8-direction route and retain all 8 results; the current engine consumes
  the four diagonals as a compatibility subset.
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
  dimensions. The output was then downscaled 4× to 64 px — paying more for worse
  pixels.
  - **Partly corrected 2026-07-29 by measurement (§1).** The claim that those
    heroes were *"billed at up to 8× the necessary rate"* on their rotations is
    **wrong**, and so is the reasoning in commit `98fb3f6`
    (*"expose --size on create-v3 so heroes are not billed at 8x"*). Rotation is
    billed on the **reference** dimensions, not the output canvas — a 64 px
    reference cost 1 generation despite producing a 108 px character. Since those
    heroes' references were already capped at 256×256, the rotation overspend was
    real but bounded by the reference, not by the output.
  - The **conclusion still holds for a different reason**: animation is billed
    against the character's canvas, so an oversized character stays expensive for
    every walk and attack it ever receives. Keep characters small — but cite the
    animation bill, not the rotation bill.
  - This is a worked example of the failure mode this file exists to prevent: a
    plausible cost model, stated confidently in a commit message, propagated
    without anyone charging one generation to check it. **Two runs and 3
    generations settled it.**
- **`enhance_prompt` was documented as available on `create-character-v3`**
  without the from-scratch-only constraint. It would have returned 422.
- **The Ranger was generated from-scratch** with no concept image, skipping the
  documented identity route, and its rotation wheel collapsed: four of eight
  directions came back as near-identical back views, with `south-west` — engine
  slot `down` — facing away from the camera. The Mage, built from a concept
  reference in the same session, rotated correctly. That contrast is the evidence
  that the route, not luck, is what matters.
  - **Confirmed fixed 2026-07-29.** Regenerated through the identity route from a
    ChatGPT concept, the Ranger's wheel came back correct in all eight
    directions at both 64 px and 128 px references — `south-west` now faces the
    camera. The diagnosis was right: the route was the defect.
  - The remaining failure at 64 px was the **bow**, not the rotation (§3). Do not
    read a prop failure as a rotation failure — they have different fixes.
- **A summarizing fetch twice reported that `/animate-character` does not exist.**
  It does. Parse the spec directly.

**North Star alignment:** process and cost documentation only. No art, no visual
change, no alteration to the approved direction.
