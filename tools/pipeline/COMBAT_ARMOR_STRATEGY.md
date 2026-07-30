# Combat animations & equipment variants — strategy record

**Status:** Proposal, approved for documentation by the owner 2026-07-30.
No generation authorized yet. The PR #25/#26 art stack merged to `main`
(c27a2af) on 2026-07-30, so execution is no longer blocked on it; each
generation batch still requires its own owner authorization and cost quote.

**Authority:** Subordinate to [`PIPELINE.md`](PIPELINE.md) and
[`PIXELLAB_API.md`](PIXELLAB_API.md). If this file conflicts with either,
those win and this file is stale.

---

## 1. MCP connection facts (verified 2026-07-30)

- The PixelLab MCP server is connected and functional from Claude Desktop.
  `get_balance` returned an active Tier 1 subscription, 1,520 of 2,000
  generations remaining, $0 credit fallback.
- **The vendor's `agent_help` tool contradicts Eldoria's measured record.**
  Asked about combat + equipment workflow, it recommended:
  - `create_character(description=...)` — from-scratch mode, the route that
    collapsed the Ranger rotation wheel ([`PIXELLAB_API.md`](PIXELLAB_API.md) §7);
  - `template_animation_id="attack"` etc. — template mode, which failed the
    visual gate on the walk attempt (identity wrecked, ~5× documented billing,
    no cancel path once the client poller gives up).

  `agent_help` reflects vendor defaults, not our calibration. Treat it as a
  discovery aid only; the repo decision record stays authoritative.
- **[VENDOR-CONFIRMED via `agent_help`] Character states are independent
  characters: animations must be queued separately for every state.** There is
  no animation inheritance from base to state. This drives the cost math in §4.

## 2. Combat animation route

- **Use `animate_character` with a custom `action_description` (v3 mode), not
  `template_animation_id`.** Custom v3 cost scales with canvas × frames, which
  stays cheap on 64px-reference heroes (~108–112 px canvases). A single bounded
  template-mode re-test on a small canvas may be authorized later (the template
  failure was measured on a 256 px character), but production does not depend
  on it.
- **Always pass `directions` explicitly** — custom mode silently animates
  `south` only.
- **Frame 0 is the stand pose** (`keep_first_frame`, default true, returns
  N+1 frames) — matches the engine's existing strip contract.
- **Action-description discipline** (no `negative_description` exists on this
  endpoint): name what is held and in which hand; name what must not move;
  name which arm may swing; end with *"no new objects, companions, creatures
  or effects."*
- **Order of attack:** hit-reaction and death animations first — no props, so
  they dodge the model's documented accessory weakness. Weapon/cast attacks
  second, with weapon-class-specific descriptions (§3).
- Use `animation_group_id` to fill directions a partial run missed; never
  regenerate a whole set for one bad direction before trying the repair
  ladder in [`PIXELLAB_API.md`](PIXELLAB_API.md) §4.

## 3. Equipment architecture — the decision

The engine composites `EQUIPMENT_SLOTS = ['head','body','weapon','cape']` as
full-frame transparent layers. PixelLab has **no equipment-overlay endpoint**,
no hand keypoints, and `create_character_state` returns a complete edited
character — not a slot overlay. Two candidate models were considered:

| Model | How | Pro | Con |
|---|---|---|---|
| **Diff-derived overlays** | Generate armored state, per-pixel diff against unarmed base → transparent overlay | Preserves the engine's layered slot design | **Untested.** Depends on states being pixel-aligned with the base; every animation frame needs the same treatment |
| **Whole-character states** | Each gear tier is a full sprite set; engine swaps sets | Matches what PixelLab actually supports; visually robust | Multiplicative cost: heroes × tiers × actions × directions, animations re-queued per state |

**Adopted direction (pending calibration): hybrid.**

- **Weapons stay composited overlays** — a baked weapon cannot be swapped and
  fights every future tier ([`PIXELLAB_API.md`](PIXELLAB_API.md) §3). One
  animation set per weapon *class* (e.g. "one-handed swing", "bow draw",
  "two-handed cast"), described explicitly in the action text, serves every
  weapon in the class.
- **Armor/body tiers become whole-character states**, capped at a small tier
  count (2–3 per hero). Generate with `use_color_palette_from_reference=true`.
- The **diff-overlay experiment** stays on the books as a bounded calibration
  probe; if it works, it re-opens per-slot armor without the state
  multiplication.

## 4. Cost rules for combat/state work

- Animation is billed against the **character's canvas**. The 64px-reference
  heroes (~108–112 px canvas) are the cheap substrate for animation.
- **The Mage is a 256×256-canvas character** (early oversized generation,
  [`PIXELLAB_API.md`](PIXELLAB_API.md) §7). The owner created a caster-combat
  state on it 2026-07-30 (web UI) and **decided 2026-07-30 that this state is
  a keeper — the 256 px Mage stays; do not regenerate it at 64 px.** The cost
  consequence is accepted and now vendor-confirmed: the MCP tool docs state
  v3 animation cost explicitly — ~1 gen/direction ≤96 px, 128 px≈2/dir,
  256 px≈8/dir. Budget Mage animations at the 8×/direction rate.
- Never pass `confirm_cost` on a first pro-mode call; quote the cost to the
  owner first. Never auto-confirm anything that spends.
- Every state × animation combination is a separate spend. Budget as
  heroes × tiers × actions × directions before authorizing a batch.

## 5. First calibration batch (AUTHORIZED 2026-07-30, ~100 generation cap)

The original "5–10 generations" estimate here was **wrong** — it predated the
measured pricing: `create_character_state` discloses **20–40 gens** up front,
and Transfer Outfit is a flat **20–40 gens** per batch by frame size. The
owner authorized a corrected batch at a **~100 generation cap** (1,516
remaining at authorization), each call still quoted against the cap as it
happens:

1. One custom hit-reaction animation on a hero (custom v3, all 8 directions,
   ~8 gens). Visual gate first look: **south-facing frames must show the
   face** (see §7 incident 2).
2. One armored `create_character_state` (20–40 gens).
3. One **Transfer Outfit reskin test** (20–40 gens) — the decisive experiment
   for the §3 architecture choice: reskin the finished unarmed animation
   frames with an armor reference and judge identity/alignment per frame.
4. The diff-overlay extraction test rides on 2's output for free (armored
   state minus unarmed base, per direction).
5. Standard gates throughout: raw output to `_probe_local/`, normalize,
   validate, contact sheet, North Star comparison, owner approval before
   anything reaches `assets/`.

**Owner data-retention decision (2026-07-30): ALLOWED.** Eldoria character
art may be fed through Transfer Outfit / Edit Animation (pro) despite
PixelLab's disclosure that those tools' *"inputs and results are saved to
help us build better and cheaper models"* — the sprites are public art with
no personal data. This grant covers Eldoria game art only.

---

## 6a. 2026-07-30 live web-app findings (Phases 2–3, bounded exploration)

A logged-in review of the web app (read-only Phase 2, then a Leo-authorized
15-gen exploration Phase 3 that spent 4) established:

- **Filling missing directions**: an animation group renders all 8 direction
  slots immediately, missing ones as dashed placeholders with a per-slot
  **rocket icon** that queues that direction *into the same group* — the UI
  equivalent of `animation_group_id`. **Reproduced**: one "Taking Punch"
  direction created the group; the rocket on a second slot appended to it
  (animation count stayed 1). Any tool that instead re-describes the action
  fresh mints a duplicate group — the §7 incident-1 mechanism, confirmed.
- **Transfer Outfit to Animation (pro) and Edit Animation (pro) live in the
  "Edit in Pixelorama" bridge** (button on every state card), NOT the plain
  Characters UI and NOT the MCP. Both cost a **flat 40 gens at 256px / 20 at
  ≤128px** per batch (≤15 frames), disclosed in-form before running. Edit
  Animation is the text-driven sibling ("wearing red armor") of the
  reference-image-driven Transfer Outfit — same price, and also a per-frame
  repair option alongside inpaint.
- **Cost-disclosure asymmetry**: Create State shows "Costs 20-40 generations"
  before you type; **the Add Animation page shows no cost anywhere and
  submits without confirmation**. Treat Add Animation as a spend with no
  guardrail. Its direction selector is a single-select radio (one direction
  per submission), unlike the REST `directions` list.
- The template system carries a **"(DEPRECATED — NEW SOLUTION IN THE WORKS)"
  banner** steering to "state + Custom Animation V3" — the vendor converging
  on this doc's §2 route. Combat templates ("Taking Punch",
  "Falling Back Death", "Fight Stance Idle") remain one click away meanwhile.
- Create State's palette checkbox tooltip: use `use_color_palette_from_
  reference` to hold the original colors, but **leave it off when the new
  state's point is new colors** (e.g. colored armor tiers).
- Export is the free, unauthenticated `GET /characters/{id}/zip` — instant
  download, no dialog, no cost.
- Aseprite was evaluated and **ruled out**: paid (~$20, extensions require
  paid v1.3+) and its PixelLab extension offers nothing the free embedded
  Pixelorama bridge lacks.

## 6. 2026-07-30 review findings (read-only doc sweep, Sonnet browser agent)

A read-only review of PixelLab's public docs (`pixellab.ai/docs`,
`api.pixellab.ai/v2/llms.txt`, `api.pixellab.ai/mcp/docs`, generated
2026-07-30) surfaced:

- **`POST /transfer-outfit-v2` is a documented REST endpoint** built to apply
  an outfit/armor reference image across 2–16 existing animation frames in
  one call (flat ~20 gens ≤64 px output, up to 40 at larger sizes). If
  usable, it is a **third equipment model** this doc's §3 did not consider:
  animate the unarmed base once, then reskin the finished frames per armor
  tier — potentially much cheaper than whole-state re-animation.
  **Unresolved vendor contradiction:** the tool's own docs page says
  *"Available in Aseprite and Pixelorama extensions only"* while the REST
  reference documents it as directly callable (with a Python-client example),
  and it is absent from the MCP tool list. Resolve with one cheap
  owner-authorized probe before putting planning weight on it.
- **The live template list is larger than [`PIXELLAB_API.md`](PIXELLAB_API.md)
  §5 records** — combat-relevant additions include `taking-punch`
  (hit-reaction), `getting-up`, and `fight-stance-idle-8-frames`. Candidates
  for the small-canvas template re-test, not production commitments.
- Camera angles (20°/35°), the repair ladder, and the web-only feature list
  were all re-confirmed unchanged.
- MCP tool docs quote `create-character-v3` at "2–9 generations"; Eldoria
  measured 1 gen at a 64 px reference. Possibly a range-vs-measurement
  artifact — noted, unresolved.

## 7. Measured incident: duplicate animation sets via MCP (2026-07-30)

Opus 5, animating Mage/Ranger walks through the MCP, created a **new** buggy
animation set instead of completing the owner's existing in-browser walking
set that was only missing the four diagonals. This is documented behavior,
not vendor breakage: animation sets append server-side named after the
slugified action, and **filling missing directions in an existing set
requires passing `animation_group_id`** ([`PIXELLAB_API.md`](PIXELLAB_API.md)
§5). The owner repaired it manually (completed the original set in the web
UI, deleted the duplicate). Standing rule: **before animating a character
that already has any animation set, list its existing sets and target the
right `animation_group_id`; never start a parallel set for an action that
already exists.** The web UI surfaces existing sets visually, which is why it
is currently more robust in the owner's hands than the MCP path.

**Incident 2 (2026-07-30): template-mode heading flip on a combat frame.**
The Phase 3 probe's very first "Taking Punch" South frame came back showing
the **back of the character's head** — a heading flip on the camera-facing
direction, in template mode, on the 256px Mage throwaway state, visible on a
2-generation probe. Same defect class as the from-scratch Ranger wheel
(§ PIXELLAB_API.md §7), now measured on combat animation. Standing
consequences: (a) the raw-sheet visual gate — *south/south-east/south-west
must show the face* — is the mandatory first look for every combat animation,
template or custom; no structural validator can catch this (the frame is a
valid, correctly-sized, alpha-clean PNG); (b) repair one bad direction via
its slot (rocket icon / `animation_group_id`), never by rerolling the set.

---

**North Star alignment:** process and cost documentation only. No art, no
visual change, no alteration to the approved direction.
