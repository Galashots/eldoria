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
| Eldoria equipment direct overlay | `create-character-v3` from-scratch | **Rejected permanently for this purpose:** the single H1a call cost 2 generations and returned eight 120×120 headless mannequin/outfit rotations; H1/body/direct-overlay is LOSE before custody scoring. No H1b object/weapon call is authorized |
| Rotate an existing approved sprite | `generate-8-rotations-v3` | Takes `first_frame` + optional `description` hint |
| Simple humanoid enemy | `create-character-with-8-directions` | `proportions` works here (not in v3) |
| Quadruped | `--template-id bear\|cat\|dog\|horse\|lion` | Template must match the body in the reference |
| Non-template body (blob, serpent, flyer) | `mode=pro` | Expensive; confirm cost first |
| Gear / outfit / pose variant of an existing character — first paid discriminator | **Try on** (experimental web tool) | Documented 1 generation/run; exact committed 64×64 Ranger as subject plus one pinned armour/item reference; armour first; one call only; live availability in Pixelorama is not confirmed |
| Gear / outfit / pose variant — conditional second discriminator | **Multi image** (experimental web tool) | Documented 1 generation/run; requires two or more same-size inputs; use only if available and Try on fails or its input/reference contract is materially better; no retry without diagnosed cause |
| Gear / outfit / pose variant — controlled fallback | **Standard PixelLab Inpaint / Classic in Pixelorama** | Exact committed 64×64 frame plus one approved per-slot/facing binary mask; one fixed-seed result; capture actual live cost before approval; do not substitute Inpaint v3 |
| Gear / outfit / pose variant — quality escalation | **Inpaint v3 in Pixelorama** | Confirmed 20 generations/use; only after a cheaper route is promising and quality is the remaining problem |
| Stock motion | `animate-character` + `template_animation_id` | 1 gen/direction |
| Custom motion | `animate-character` + `action_description` | v3; see §5 |
| Fill in directions a partial animation missed | MCP `animate_character(animation_group_id=...)` or the web UI's per-slot rocket icon | Appends to the existing group instead of regenerating the set. **Not available on the REST character route** ([REST-VERIFIED 2026-07-30]: `CreateCharacterAnimationRequest` has no append field; REST's `animation_group_id` exists only on the *object*-animation endpoint) |
| Reskin frames with an outfit/weapon (future owner-gated route) | `transfer-outfit-v2` | Browser Pixelorama/Aseprite workflow; one outfit reference per call; corrected size/frame/cost table in §8; outside the historical 12-generation cap |
| Strip a background to transparent PNG | `remove-background` | **[LIVE-VERIFIED 2026-08-06]** Model call, max 400×400. **Banned from the gear custody path** (extraction must be deterministic — `GEAR_CUSTODY_CONTRACT.md` GC8); repair/prep only |
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

**PARKED** `create-character-state` applies one edit consistently across rotations,
but returns a **complete edited character**, not an engine-ready transparent
equipment-slot overlay. It is removed from the current batch because the remote
256px character is not byte-identical to the committed 64px runtime source, exact
normalization cannot presently be reconstructed, and its pre-call generation cost
is not adequately bounded. A future raw-source experiment must compare at the
same resolution before extracting a layer; resizing first can change off-mask
pixels and invalidate GC5. Do not assume this route solves overlays.

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
- **Interpolation between two poses** — the REST fields are
  **`custom_start_frame` / `end_frame`** (base64 `Base64Image`) on the character
  animation endpoint, **v3 only, exactly one direction per call**, and the end
  frame's dimensions must match the start [REST-VERIFIED 2026-08-06]. The earlier
  `*_url` names here were MCP aliases, not REST fields — the MCP tool exposes
  `start_frame_url` / `end_frame_url`, and via MCP prefer the URL form because
  inline base64 is routinely truncated by MCP clients, which silently corrupts the
  image.
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
| `direction_type: ordinal` | Would generate only four diagonals; not desired because Eldoria retains all eight directions |
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

**North Star alignment:** this historical section covers process and cost
documentation only. Its claims do not describe the later H1a research output,
which is recorded separately in §8; no production art or runtime visual change
resulted from this section.

---

## 8. Live-schema re-verification (2026-08-06) — Sub-project A gear research

> **Phase 1 disposition (current authority).** The schema verification below was
> read-only. A later H1a probe call executed exactly once and charged 2
> generations; it returned eight 120×120 mannequin/outfit rotations with
> `template_id=mannequin`. This live result, not schema inference, makes
> `create-character-v3` unsuitable for Eldoria direct overlays. H1/body is LOSE
> before custody scoring; H1b is removed and no object/weapon call through that
> endpoint is authorized.

### Phase 1 historical method map and corrected Transfer Outfit costs

The table below records the pre-call priority plan. It is superseded by the
final PR54 disposition that follows it; PR54 authorizes no further generation.

| Method | Phase 1 disposition |
|---|---|
| Try on | First paid discriminator when live-available: exact committed 64×64 Ranger subject plus one pinned armour/item reference; documented 1 generation/run; armour first, one call only; not exercised in this record |
| Multi image | Conditional second discriminator when live-available: exact Ranger plus pinned item/reference image; documented 1 generation/run; only after Try on fails or a materially better contract is demonstrated; not exercised in this record |
| Standard PixelLab Inpaint / Classic in Pixelorama | Controlled fallback on exact committed 64×64 Ranger `down-right`, one approved mask per slot, fixed seed; two controlled armour attempts were completed and the route is LOSE; no retry |
| Inpaint v3 in Pixelorama | Quality escalation only; live-verified at 20 generations/use; H5 visual method PASS but custody INCONCLUSIVE because the exact embedded export was unrecoverable |
| `create-character-state` | Parked future raw-source experiment only; complete characters, remote 256px source not byte-identical to committed 64px, normalization not reconstructible, pre-call cost not bounded |
| Edit Animation Pro | Future owner-gated browser experiment after one-facing test; exact 64×64 directional frames, 20 generations per 2–16-frame batch |
| Transfer Outfit Pro | Future owner-gated browser experiment after one-facing test; approved visual item reference, 20 generations at 64px |

### Final PR54 research disposition

The executed-route record is now closed; no further PixelLab generation is
authorized in PR54:

| Route | Final disposition |
|---|---|
| `create-character-v3` direct overlay | **LOSE** — H1a produced a substantially complete headless mannequin/outfit; H1b is removed |
| Classic Inpaint | **LOSE** after two controlled attempts |
| Pixpatch v2 / Inpaint M-L | **Technical/custody PASS, semantic LOSE** |
| Pixelorama Inpaint v3 + Candidate C | **Visual semantic PASS, custody INCONCLUSIVE** because the authoritative embedded-editor export could not be recovered |
| REST API Inpaint v3 + Candidate C | **Semantic armour success, custody LOSE**: the tested `crop_to_mask=true`, `no_background=false`, Candidate C contract changed 2,858 pixels outside the mask |
| `create-character-state` | **PARKED**, not a failure |
| Transfer Outfit | **PARKED / UNTESTED**, not a failure |

No tested PixelLab route has proven the strict pixel-custody properties required
for direct runtime equipment-overlay generation. PixelLab is currently suitable
as an Eldoria visual/reference authoring tool for equipment; production layers
must be created through a separate deterministic/manual-assisted pipeline.
This REST result is evidence about the tested contract only and must not be
generalized to every Inpaint v3 configuration. `no_background=true` was not
tested and is not authorized by PR54.

The final research ledger is **65/100 generations used and 35/100 unspent**.
The ceiling does not need to be exhausted. Raw API/H1a results, credentials,
job IDs, live URLs, and private generated pixels remain outside the repository.

Approved PixelLab armour visuals may be retained as design references. Transfer
Outfit or another method may be revisited only under a new owner-gated
experiment if a future need justifies it.

Transfer Outfit is a separate browser Pixelorama/Aseprite workflow, with one
outfit reference per call, and is outside the historical 12-generation cap:

| Reference size | Maximum frames | Cost |
|---|---:|---:|
| 32–64px | up to 15 | 20 generations |
| 65–80px | up to 8 | 20 generations |
| 81–128px | up to 3 | 20 generations |
| 129–170px | up to 3 | 25 generations |
| 171–256px | up to 3 | 40 generations |

For any future raw-source method, compare raw full-resolution composite versus a
same-resolution hash-pinned base and mask before resizing. Normalize only a
passing extracted layer to 64×64. Human placement is prohibited; crop, scale,
interpolation, pivot/anchor, and translation must be deterministic and recorded.

The schema portion was re-verified read-only against
`api.pixellab.ai/v2/openapi.json` and `api.pixellab.ai/mcp/docs` (`curl` + script
parse; **no summarizing fetch**; no generation or token used for schema
verification). The Gemini/ChatGPT research inputs on PR #53 were treated as
**hypotheses**; this section records what the live schema exposes and, separately,
what the later H1a probe exercised.
Full research artifacts: `GEAR_CUSTODY_CONTRACT.md`,
`GEAR_EVIDENCE_RECORD_TEMPLATE.md`, and
`docs/ai-team/PIXELLAB_METHOD_PROBE_AUTH_20260806.md`.

### Confirmed real (safe to rely on)

- **`POST /v2/inpaint-v3`** — live schema and one authorized API call confirm
  the request fields `description`, `inpainting_image`, `mask_image`, `seed`,
  `no_background`, and `crop_to_mask`. The route is Pro, returns a background
  job ID, and the completed job's `last_response` contains the authoritative
  result. The live mask convention is **white = generate, black = preserve**.
  The account charges subscription generations; the official tool cost is 20
  generations/use. The exact API probe used the 64×64 Ranger and Candidate C,
  charged 20 generations, and returned a 64×64 opaque RGBA image. It made 3,097
  changes, including 2,858 off-mask changes, so custody failed. This is live
  evidence from one request, not a general claim about every prompt or setting.
  Raw PNG, job metadata, and live URLs remain private and outside `assets/`.

- **`create-character-state`** — real. `character_id` + `edit_description` required;
  applies one edit across all 4/8 rotations; `use_color_palette_from_reference`
  snaps to the source palette. Returns a **complete edited character, not an
  engine-ready layer** — matches spec §6. Per-call **generation count is not
  published** in the schema; measure the balance before/after.
- **Pose interpolation** — real, via `custom_start_frame` / `end_frame` (base64),
  v3 only, one direction, matching dims (corrected in §5).
- **`enhance_prompt`** — real on `create-character-v3` (from-scratch only; 422 with a
  reference) and on the character animation endpoint (v3 only; 422 with
  template/pro); +0.05 gen each. Standalone endpoints exist too
  (`/enhance-character-v3-prompt`, `/enhance-animation-v3-prompt`,
  `/enhance-pixen-prompt`). The prior "[UNTESTED]" note on the animation route is now
  schema-confirmed to exist (behaviour still unexercised here).
- **Cost model unchanged** — the schema restates it: v3 ref-mode
  `ceil(w·h·8/65536)`; `pro` 20–40 gen/dir; `enhance` +0.05. (There is **no
  `confirm_cost` field** in the REST schema — it is a client/MCP-side guard, not a
  request parameter.)

### Corrections to prior research/doc claims (the mismatch report)

- **Style-reference anchoring across a gear family EXISTS, but only via the
  expensive `pro` route — corrected 2026-08-06.** A prior pass of this doc said it
  was "not available on the character route." That was wrong: `CreateCharacterProRequest`
  has `style_character_id` — *"ID of one of your existing 8-direction characters to
  use as the style reference. Its 8 directional sprites guide the new character's
  style in every direction; its south sprite becomes the center style image unless
  `reference_image` is also provided."* This could point at the approved Ranger
  `character_id` to style-anchor a generated gear item to the hero's palette/outline
  across all 8 directions — a real 8-direction anchor, not a flat image.
  **Excluded from the method probe anyway**, not because it doesn't exist but
  because it only exists on `create-character-pro` (**20–40 gen/direction**,
  160–320 for a full set) — cost-prohibitive for exploration; `confirm_cost` must
  never be set on a first call, and the quote goes to Leo first. `style_images` /
  `StyleImage` / `StyleOptions` (a separate, unrelated mechanism) remain
  character-route-absent as originally found — they exist only on
  `generate-with-style-v2` and the `create-image-*` / tileset endpoints, flat images
  with no 8-direction rotation. On `create-character-v3` / `create-character-state`
  (the probe's actual routes) the only anchor remains
  `create-character-state`'s `use_color_palette_from_reference` — **palette only**,
  not outline/detail/shading.
- **"Clothing-only / no-mannequin / no-ghost-body" cannot be a negative prompt on
  these routes.** There is **no `negative_description`** on `create-character-v3`,
  `create-character-state`, or the character animation endpoint (confirms §5). It
  exists only on `animate-with-text`, the create-image endpoints, and `inpaint`. On
  the gear routes the positive edit/action text is the only lever.

### New capabilities the research didn't list

- **`transfer-outfit-v2`** — outfit/weapon reskin of 2–16 supplied frames; returns
  **composited frames, not a layer**; `no_background`, `additional_instructions`;
  sizes 32–256 (frame count drops as size grows because the reference + frames pack
  into one grid). A genuine **third candidate gear method** (alongside H1 direct
  overlay and H2 equipped-state). Recorded as a **flagged, owner-gated extension** to
  the two-arm probe — not folded into it. See the probe auth doc.
- **`remove-background`** — model background stripper, max 400×400. Useful for
  repair/prep, **banned from the custody path** because layer extraction must be
  deterministic (`GEAR_CUSTODY_CONTRACT.md` GC8).

### Live-exercised H1a result (not schema inference)

After the read-only schema verification, one H1a `POST /v2/create-character-v3`
from-scratch call was exercised under the prior conditional authorization. It
charged **2 generations** and returned eight rotations. The exported canvas was
**120×120**, despite the prior assumed/default 64×64 sizing note. Its metadata
reported `template_id=mannequin`, and every rotation was a substantially complete,
headless mannequin/outfit with arms, gloves, belt/lower-body clothing, legs and
boots rather than an isolated breastplate. This is live-exercised evidence from
one result, not a general claim about every create-character-v3 call.

The H1a human semantic gate is **FAIL**, so `H1 / body / direct-overlay` is
**LOSE before GC scoring**. The sanitized private-review evidence was supplied
directly to ChatGPT and visually reviewed; the raw archive and unapproved output
remain outside `assets/` and are not committed. H1b is removed; H2 is parked and
not in the current batch. The
remaining 10 generations of the original 12-generation ceiling are not authorized.

**North Star alignment:** Intentional interim gap — this research output is not a
production asset or runtime visual change. The game remains unchanged; no further
generation is authorized without Leo's explicit per-batch approval.

### Phase 1 supersession note

Any earlier candidate-arm wording in this historical section is superseded by the
Phase 1 method map above: no H1b, H2, or Transfer Outfit call is authorized by
this PR; `create-character-state` is parked; Transfer Outfit is not part of the
remaining 12-generation cap; and the completed live probes are the H1a call plus
the separately recorded Inpaint v3 API confirmation. Schema verification itself
was read-only, while both probe results are live-exercised evidence. No further
generation is authorized by this record.
