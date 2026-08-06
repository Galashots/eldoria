# Gear custody contract & validator — design

**Status:** DESIGN ONLY (Sub-project A research output, 2026-08-06). No validator
code is shipped by this document; it specifies one precisely enough to implement
under Sub-project A's implementation lane. No art exists to validate yet — this
contract is what generated equipment **must** pass before it may enter `assets/`.

**Why this exists.** `docs/superpowers/specs/2026-08-05-combat-armor-design.md` §6
and ChatGPT's non-author review (PR #53) both ruled that PR #48's
`tools/npc-static-contract-test.py` — which proves crop/translate-only custody for
a **single static NPC frame** — is **not sufficient** for generated equipment,
masks, extracted layers, multi-layer composites, or animation strips. Those follow
this dedicated contract instead. The PR #48 crop/translate rule keeps governing the
static NPC frames it was built for; it does not govern gear.

**This validator says nothing about whether the art is GOOD.** A machine PASS means
"eligible for human + North Star review", never "approved" — same rule as
`validate_sprites.py`. Heading fidelity, semantic drift, and North Star alignment
stay human judgments (see the PixelLab skill's visual-gate rule).

---

## 1. Engine facts the contract is built on (verified in code, 2026-08-06)

| Fact | Source |
|---|---|
| Frame is **64×64 RGBA**, binary alpha, bottom-anchored (lowest opaque row = 63), ≥1 transparent column each side | `tools/pipeline/normalize_sprite.py`, `validate_sprites.py` |
| Composite **z-order: cape → base → body → head → weapon** | `js/10-character.js:64-80` (paper doll); world render uses the same order (spec §1) |
| Equipment slots: `['head','body','weapon','cape']` | `js/02-data-state.js:123` |
| Overlays are authored for the **four cardinal facings only** (`OVERLAY_DIRECTIONS = ['down','up','left','right']`) **as of this baseline**; iso renders eight (`PLAYER_DIRECTIONS`). **[Fable, 2026-08-06] Going stale on purpose:** sub-project 1 deletes top-down rendering, moving world-rendered gear to the full eight-facing `PLAYER_DIRECTIONS` set — `OVERLAY_DIRECTIONS`'s cardinal restriction survives only for the Character-screen paper doll (`paperDollDirection = 'right'`). See GC7. | `js/02-data-state.js:114-118` |
| Overlay file naming: `assets/<profile>-<facing>-<slot>.png`, walk `…-<slot>-walk.png`, attack `…-<slot>-attack.png`; base `assets/<profile>-<facing>.png` | `js/02-data-state.js:159-173` |
| A missing overlay hides **only itself** (`onerror`) and can never take the base hero with it | `js/10-character.js:65,83` |
| **There is no hand keypoint to anchor to.** The skeleton enum stops at `LEFT ARM`/`RIGHT ARM`, and `skeletons` returned `null` on both v3 reference-mode heroes | `tools/pipeline/PIXELLAB_API.md` §3 |

**Consequence for the contract:** overlays are **full-frame aligned layers**, not
hand-anchored props. Alignment is therefore verified against the base frame's
geometry and an approved per-slot mask, **not** against keypoints (there are none).

---

## 2. Inputs the validator takes

1. **Approved base frame(s)** — the committed, canonical hero sprite for the
   facing under test (`assets/<profile>-<facing>.png`). Treated as immutable truth.
2. **Candidate artifact**, one of:
   - a **transparent overlay layer** (direct-overlay route), or
   - a **full equipped composite** (equipped-state / transfer-outfit route), or
   - a **deterministically extracted layer** (equipped composite minus approved base).
3. **Approved equipment mask** — a committed binary PNG per `(slot, facing)` marking
   the region the human review has approved this slot to occupy. No mask ⇒ the
   artifact cannot be trusted; the gate fails closed.
4. **Declared route + evidence record** — the per-slot evidence record
   (`GEAR_EVIDENCE_RECORD_TEMPLATE.md`) naming route, tool, exact command, seed,
   source/output hashes, and mask id.

Masks are **owner/review-approved before extraction is trusted**, exactly because
"looks close" ghosts when composited (spec §6). The mask is the contract's notion
of "the pixels this slot is allowed to change."

---

## 3. Gates (exit 0 = all pass; nonzero + printed failures otherwise)

Naming `GC#` to distinguish from `validate_sprites.py`'s `G1–G8`.
**[Fable, 2026-08-06] G1–G8 do NOT apply uniformly to every artifact this
contract handles.** A lone equipment layer (e.g. a floating chest-piece) is not
a bottom-anchored character frame — demanding G3 (bottom anchor), G5 (cross-facing
scale spread), G6/G7 (walk-frame stability/stand-identity), or G8
(slot-completeness, which is per-*set*, not per-item) of an isolated layer is a
category error. Applicability by artifact class:

| Primitive | Isolated layer (pre-composite) | Complete composite (base + layer(s), full character frame) |
|---|---|---|
| Canvas size | Yes — layer's own declared canvas | Yes (G1: 64×64, or 256×64 walk strip) |
| G2 binary alpha | Yes | Yes |
| G4 side padding | Yes, where the layer's own bbox allows it | Yes |
| G3 bottom anchor (lowest opaque row = frame bottom) | **No** — a layer need not touch the frame bottom | Yes — the composite is a full character frame |
| G5 scale spread across facings | **No** — meaningless for one floating item | Yes |
| G6 walk-centre/top stability, G7 stand-frame identity | **No** — this probe is static-only; applies only once walk strips exist | Yes, for walk strips |
| G8 slot/facing/state completeness | N/A — that gate is per-*set*; see GC7 below | Yes |

**Structural (canvas + alpha primitives; class-dependent per the table above):**

- **GC1 canvas & anchor** — layer: shares the base frame's declared canvas with no
  offset/rescale; own-bbox bottom anchor is NOT required. Composite: full
  `validate_sprites.py` G1/G3 — correct frame size, bottom-anchored.
- **GC2 binary alpha** — every pixel alpha ∈ {0, 255}, both artifact classes.
- **GC3 scale/pivot invariance** — **composite only**: opaque bbox height/width and
  centre-x stay within G5 tolerances of the **approved base** (facings must still
  read as one character; gear must not resize the hero). Not applicable to an
  isolated layer, which has no independent "hero scale" to compare against.

**Custody (the properties PR #48's test cannot express):**

- **GC4 mask containment** — every opaque pixel of the candidate **layer** lies
  inside the approved `(slot, facing)` mask. No bleed into face, hands, or a
  neighbouring slot's region.
- **GC5 off-mask identity invariance** — composite the layer onto the approved base
  in z-order; **every pixel outside the union of approved masks is byte-identical to
  the base.** For the extraction route, the equipped composite's own off-equipment
  region must already be byte-identical to the base before subtraction — otherwise
  the "layer" carries hero-identity drift and will ghost. This is the single most
  important gate and the one the static-NPC test has no concept of.
- **GC6 layer-order fidelity** — compositing is done by ONE fixed function in
  `cape → base → body → head → weapon` order; where two approved slots overlap, the
  higher slot occludes the lower (e.g. weapon over body). The composite is
  byte-reproducible from the same inputs.
- **GC7 coverage matrix** — the required `(slot × facing × state)` set for the batch
  is present. Missing entries FAIL unless explicitly waived in the evidence record
  with an owner-acknowledged reason. **[Fable, 2026-08-06] Facing default is
  forward-looking, not today's `OVERLAY_DIRECTIONS`:** sub-project 1 deletes
  top-down rendering, so world-rendered gear moves to the full iso
  `PLAYER_DIRECTIONS` (all eight facings) once that PR lands. The cardinal `right`
  frame survives **only** for the Character-screen paper doll (per ChatGPT's
  accepted PR #53 finding 4 — retain `paperDollDirection = 'right'` and the
  cardinal generic overlays there until replacement per-item art exists). Default
  GC7's required set to `PLAYER_DIRECTIONS` once sub-project 1 has landed; use
  today's four-cardinal `OVERLAY_DIRECTIONS` only for probe/evidence work that
  predates that PR and for paper-doll-only art.
- **GC8 determinism** — re-running extraction/composition from the same committed
  inputs yields **byte-identical** output (SHA-256 match), the same reproducibility
  discipline `npc-static-contract-test.py` enforces for static frames. Any
  model-side (non-deterministic) step must be upstream of the committed artifact,
  never inside the custody path.

**What GC-gates deliberately do NOT assert** (stay human/North Star):
heading fidelity, semantic drift, cross-facing recognizability of the *same item*,
temporal readability, and whether the armour looks like the tier it represents.
These are recorded as verdicts in the evidence record, not machine gates.

---

## 4. Route-specific notes

- **Direct-overlay route** — the model returns a layer directly; GC4/GC5 are the
  acceptance test. Risk: the model draws a mannequin/ghost body behind the gear, so
  GC4 (containment) and binary alpha catch "not actually transparent."
- **Equipped-state / transfer-outfit route** — the model returns a **complete edited
  character**, not a layer (verified: `create-character-state` and
  `transfer-outfit-v2` both return composited frames). The engine-ready layer is
  produced by **our deterministic difference extraction**, never by a vendor
  background-removal call (`remove-background` exists but is a model step and is
  banned from the custody path by GC8). GC5's "base region byte-identical" precheck
  is what decides whether difference extraction is even valid for that output.

---

## 5. Relationship to existing tools

| Tool | Governs | Stays in force? |
|---|---|---|
| `tools/npc-static-contract-test.py` (PR #48) | Static NPC source frames, crop/translate-only | Yes — for that asset class only |
| `tools/pipeline/validate_sprites.py` (G1–G8) | Normalized hero sprite geometry | Yes — GC re-runs the *applicable* primitives per §3's table: canvas/alpha/padding on layers, the full G1–G8 set only on complete bottom-anchored composites |
| **This contract's validator** (GC1–GC8) | **Generated equipment: layers, masks, extraction, composites** | To be implemented under Sub-project A |

Suggested home when implemented: `tools/pipeline/validate_gear.py`, wired into
`npm run assets:verify` alongside the existing gates, with a `--slot`/`--facing`/
`--route` interface and an evidence-record path. **Not built here.**
