# PixelLab method-elimination probe — authorization request for Leo

> **⛔ SUSPENDED (Fable, 2026-08-06) pending this revision pass.** ChatGPT's
> review 4877402780 (REVISE) on PR #54 is adopted in full below. **Partial
> execution already occurred** under Leo's original conditional Step-2
> authorization, before the suspend order arrived — see
> [Partial execution already on record](#partial-execution-already-on-record).
> No further generation happens until Fable re-reviews this revision, ChatGPT
> re-verdicts, and **Leo re-approves the quote below.**

**Author seat:** Claude (research seat, Sub-project A). **Directs:** Fable.
**Non-author review:** ChatGPT. **Merges / approves spend:** Leo.
**Governing spec:** `docs/superpowers/specs/2026-08-05-combat-armor-design.md` §6.

---

## Partial execution already on record

Leo's 2026-08-06 conditional authorization went live, the read-only precheck
passed (below), and Step 2 began. **One call completed before Fable's suspend
order arrived mid-batch:**

| Call | Endpoint | Result | Cost |
|---|---|---|---|
| H1a — Iron Armor, direct-overlay | `POST /create-character-v3` (from-scratch) | `[REDACTED — unapproved output]`, `status: completed`, 8 rotations returned | **2 generations** (balance 1502.0 → 1500.0, confirmed via `/balance` before and after) |

- **H1b (Steel Sword) and both H2 calls were never sent.** No other job or
  character was created in this batch.
- Cost matched the quote exactly (≈2 gen/item) — no overrun, no unexpected
  extra job, no stop condition tripped.
- The raw outputs (request/response, job record, character detail, all 8 rotation
  PNGs) remain in a local/private archive and are **not committed**. A sanitized
  private-review bundle was supplied directly to ChatGPT and visually reviewed;
  it is also not committed. The repository records the verdict and custody rules,
  not the raw archive or live download URLs.
- **H1 / body / direct-overlay: LOSE before GC scoring.** Every rotation is a
  headless, substantially complete mannequin/outfit with arms, gloves, belt/lower-
  body clothing, legs and boots. Metadata reports `template_id=mannequin`.
  The human semantic-drift gate independently eliminates this artifact; GC4/GC5
  remain unscored because the masks are draft/pending, never PASS.
- **Running spend against the cap: 2 of 12 generations.** The quote below is
  revised to account for this.

---

## Purpose & hypothesis

Decide **how** Eldoria should generate per-item gear before spending on the full
two-hero composability slice — so the slice is a production run, not an expensive
method-discovery batch. Two production hypotheses, exactly as spec §6 locks them:

- **H1 — Direct overlay generation:** the model can produce a transparent
  equipment-only layer that composites pixel-exactly over the approved hero body.
- **H2 — Equipped-state generation + deterministic difference extraction:** the
  model regenerates a *consistent* equipped hero, and subtracting the approved base
  yields a clean transparent layer (passes only when non-equipment pixels are
  byte-identical to the base — "looks close" ghosts; see `GEAR_CUSTODY_CONTRACT.md`
  GC5).

The probe eliminates at least one method, or proves both viable per slot, at the
smallest honest spend. It does **not** gate bulk work — OWNER decision 11's full
composability slice still does.

## Tool & live-schema verification

Verified read-only on **2026-08-06** against `api.pixellab.ai/v2/openapi.json` and
`api.pixellab.ai/mcp/docs`:

- `POST /v2/create-character-v3` — exists; from-scratch cost
  `1 (pixen) + ceil(s²·8/65536)` where `s = max(width, height)`. At the default
  64×64 (no `image_size` sent): `1 + ceil(64²·8/65536) = 1 + 1 = 2` generations.
  **Confirmed live 2026-08-06 by the executed H1a call** (quoted 2, charged 2 —
  exact match).
- `POST /v2/create-character-state` — exists; returns a **complete edited
  character**, not a layer (`character_id` + `edit_description` required;
  `use_color_palette_from_reference` available; **no `directions` filter** — every
  call edits all 8). Its per-call **generation count is not published in the
  schema** — see the stop conditions.
- `POST /v2/create-character-pro` — exists, and its `style_character_id` field
  **is a real 8-direction style anchor** (can point at an existing character's 8
  rotations, e.g. the approved Ranger, to guide a new character's style in every
  direction). **Deliberately excluded from this probe**: it costs 20–40
  generations/direction (160–320 for a full set) — see `PIXELLAB_API.md` §8. Not a
  capability gap, a cost decision.
- Difference extraction and compositing are **our deterministic code**, not vendor
  calls. `remove-background` exists but is banned from the custody path (GC8).

## Approved inputs (pinned by SHA; precheck already executed and PASSED)

**Hero — the free read-only `character_id` precheck (Leo's Step 1) has been run:**

| Field | Value |
|---|---|
| `character_id` | `add36c36-295d-4626-94fd-179a4102d1ea` |
| `status` | `completed` |
| `prompt` (live, matches `CAST_INVENTORY.md`'s recorded approved description near-verbatim) | *"Ranger hero for my 2.5D High Top-Down (35 degrees) kids RPG game, Eldoria-V1. Reference image is already provided at the 35 degree top-down angle..."* |
| `view` | `high top-down` |
| `size` | 256×256, all 8 directions present |
| Provenance record | `tools/pipeline/CAST_INVENTORY.md:134` — *"2026-07-29: manual Ranger Character export `add36c36-...`"* |
| Cross-check vs. committed art | Downloaded live `south.png` (256×256, SHA-256 `b2222f807c0a48cb9e305b374181aa3ebdb27901f2cd369a271e215f62ea6526`); committed `assets/adventurer-down-right.png` (64×64, SHA-256 `a59a6d7caec21752f99304e22390f8fbba7df14aced6efe4b8853b53b9f40300`). Not byte-equal (expected — one is the raw 256px source, the other the deterministically normalized 64px engine asset via a resize pipeline this session cannot reproduce exactly). Opaque-bbox aspect ratio: raw 121×222 (0.545) vs. committed 31×57 (0.544) — matches to 0.001. Mean abs RGB diff over the committed-opaque region after Lanczos resize: 13.95/255 (~5.5%), consistent with resize-filter residual, not a different character. **Verdict: same source, structurally confirmed.** |

Full precheck record: `docs/playtest/2026-08-06-pixellab-gear-probe/00-precheck-balance.txt`,
`01-precheck-characters-full.json`, `02-precheck-ranger-detail.json`. Precheck
**PASSED** — no character recreation needed.

- **Extraction truth:** committed `assets/adventurer-<facing>.png` base rotations.
- **Items:** one body armour (`iron_armor`, "Iron Armor", tier 1) + one weapon
  (`steel_sword`, "Steel Sword", tier 2) (`js/03-maps-areas.js:250,253`).

### Draft mask evidence (not owner/review approved)

Six deterministic binary 64×64 masks now exist under
`tools/pipeline/masks/gear-probe-20260806/`, using the committed Ranger base
frames as the visual source. The body masks exclude face, hair, hands, legs and
boots and cover only a conservative torso/shoulder envelope. The weapon masks
cover only a conservative hand/forearm plus plausible weapon extension envelope.
The reviewer sheet is
`tools/pipeline/masks/gear-probe-20260806/contact-sheet.png`.

Every mask and the sheet are explicitly marked **DRAFT — NOT OWNER/REVIEW
APPROVED**. These are review artifacts, not approval. Per
`GEAR_CUSTODY_CONTRACT.md` §2/§3 (fail closed, no route exempt — including
direct-overlay), no generated artifact in this probe can be scored PASS on GC4/GC5
until the relevant mask is reviewed, approved, and applied.

| Slot | Facing | Path | SHA-256 | Status |
|---|---|---|---|---|
| body | down-right | `tools/pipeline/masks/gear-probe-20260806/body-down-right.png` | `a07def2a3959f598bd6a32c9dee3b79b529731c2bb644ed12952692585327ec5` | DRAFT — NOT OWNER/REVIEW APPROVED |
| body | right | `tools/pipeline/masks/gear-probe-20260806/body-right.png` | `70a4c8bbb6b32984ffcafad2a081825e390b932d503fe0da0dc1cb550d527847` | DRAFT — NOT OWNER/REVIEW APPROVED |
| body | up-left | `tools/pipeline/masks/gear-probe-20260806/body-up-left.png` | `2ce7543b0dec1ec3e2fd92599e77f7b61f43a18f6c87c004dbac011cc004c547` | DRAFT — NOT OWNER/REVIEW APPROVED |
| weapon | down-right | `tools/pipeline/masks/gear-probe-20260806/weapon-down-right.png` | `49545f2722cc242b6e827be2e6757a670b90106ebb54e98f130b925a3b99359a` | DRAFT — NOT OWNER/REVIEW APPROVED |
| weapon | right | `tools/pipeline/masks/gear-probe-20260806/weapon-right.png` | `e9910c03ffa3e0712df07229a78ce8aca545690f5a57efd416e629e4705f3a8f` | DRAFT — NOT OWNER/REVIEW APPROVED |
| weapon | up-left | `tools/pipeline/masks/gear-probe-20260806/weapon-up-left.png` | `d94f7a19eda80b838ef4a28fcd3af85064477dd4209e8800bfd00b0c7afc6d6d` | DRAFT — NOT OWNER/REVIEW APPROVED |

The draft masks do not authorize H1b or either H2 call. They only make the
pending review concrete and hash-pinned.

## Coverage

| Dimension | Probe value |
|---|---|
| Heroes | 1 (Ranger) |
| Items | 2 (one body armour, one weapon) |
| States | **static only** (no walk/attack — animation deferred per research finding #5) |
| Facings generated | all 8 (v3/state return 8 inherently) |
| Facings **evaluated** | smallest useful subset: `down-right` (compass S, face), `right` (SE, engine-consumed + paper doll), `up-left` (compass N, back — catches cape/weapon occlusion) |
| Retained | all 8 generated facings kept as source |

## Calls, quoted cost, and hard cap — REVISED, pinned to exact endpoints

Cost is in **generations** (the vendor's billing unit). Convert to your plan's
per-generation rate before approving. **No alternative endpoints remain open —
each arm is pinned to the one exact call it will make.**

| Call | Exact endpoint & parameters | Status | Generations |
|---|---|---|---|
| **H1a — Iron Armor** | `POST /create-character-v3`, from-scratch (no `reference_image`), `view="high top-down"`, `no_background=true`, `seed=20260806`, no `image_size` (prior assumed/default 64×64; actual exported canvas 120×120), description: *"A single RPG game equipment item, an Iron Armor breastplate: plain brushed steel-grey chest armor plate with simple leather straps, no shoulder pauldrons, no arms, no legs, no head, no character, no body, no mannequin, no hands, isolated object floating alone on transparent background, flat pixel art icon style, single-color black outline, medium detail, child-friendly, high top-down 35 degree camera angle to match the game's hero sprites."* | ✅ **EXECUTED** | **2 (spent)** |
| **H1b — Steel Sword** | Same endpoint/mode/view/`no_background`, `seed=20260807`, description: *"A single RPG game equipment item, a Steel Sword: plain straight steel blade with a simple crossguard and brown leather-wrapped hilt, no character, no body, no hand, no arm, no mannequin, isolated object floating alone on transparent background, flat pixel art icon style, single-color black outline, medium detail, child-friendly, high top-down 35 degree camera angle to match the game's hero sprites."* | Not yet sent | **≈2 (quoted)** |
| **H2a — Ranger + Iron Armor only** | `POST /create-character-state`, `character_id="add36c36-295d-4626-94fd-179a4102d1ea"`, `edit_description="wearing a plain iron chestplate armor over the existing outfit; no other changes"`, `use_color_palette_from_reference=true`, `seed=20260808` | Not yet sent | **unpublished — measured live** |
| **H2b — Ranger + Steel Sword only** | `POST /create-character-state`, same `character_id`, `edit_description="holding a plain steel longsword in one hand; no other changes"`, `use_color_palette_from_reference=true`, `seed=20260809` | Not yet sent | **unpublished — measured live** |

The executed H1a export was eight 120×120 RGBA rotations with binary alpha. Its
metadata reported `template_id=mannequin`; the human review found a headless,
substantially complete mannequin/outfit in every rotation. This observed result
is not a schema inference and must not be generalized beyond this one H1a output.

**Fix from ChatGPT's review, adopted:** H2 is now **two independent calls**, one
per item, so body and weapon evidence never share a confounded artifact — the
prior single combined edit (*"wearing iron chest armour and holding a steel
sword"*) would have made it impossible to attribute a GC5 failure to one item or
the other.

- **Maximum authorized spend: 12 generations for the whole probe, unchanged.**
  **2 already spent** (H1a). Remaining budget for H1b + H2a + H2b: **10
  generations**, hard stop if reached — do not finish the batch, do not retry.
- **`transfer-outfit-v2` extension (below) draws from this SAME 12-generation
  cap if ever approved — it does not get a fresh cap.** Total probe spend across
  every arm, including any approved extension, is capped at 12.

## Acceptance criteria (what makes a route "win")

Per `(slot, route)`, recorded in `GEAR_EVIDENCE_RECORD_TEMPLATE.md`:

1. **A mask exists for that `(slot, facing)`.** No mask ⇒ automatic FAIL —
   unscored, never a silent pass.
2. **GC5 = 0 off-mask identity pixels changed** — hard elimination gate. Any drift
   outside the approved mask loses, no matter how good it looks.
3. GC4 mask containment, GC6 layer-order fidelity, GC8 determinism all PASS.
4. Human: heading fidelity holds; the same item is recognizable across the evaluated
   facings; no semantic drift; North Star is not regressed.
5. Cost and manual repair minutes are tolerable and the repair is deterministic.

Outcome may be **per slot** (e.g. body wins on H2, weapon wins on H1) — that is an
allowed result, not a failure.

## Immediate stop conditions (stop and return evidence to Leo — never auto-retry)

- Any **unexpected extra job** or a call fanning out beyond the plan.
- **Billing past the 12-generation cap** (2 already spent; 10 remain), or the
  balance moving in a way the quote didn't predict.
- **Schema mismatch at call time** — an endpoint or field differs from the
  2026-08-06 verification.
- **Off-mask identity changes** that no approved mask can contain (GC5 fails).
- **A directing-seat suspend order arriving mid-batch** — as already happened
  once: the in-flight call is allowed to finish (it cannot be cancelled — no
  cancel endpoint exists), its result is recorded, and **no new call is sent**
  until authorization resumes.
- Any `422`/error that would normally invite a retry.

## H1b disposition — OWNER decision pending

H1b (Steel Sword) is neither authorized nor executed. Leo must choose one of the
following before any further generation:

- **Option A:** stop H1 direct-object testing because H1a shows that the character
  endpoint generated a mannequin despite the pinned isolation prompt.
- **Option B:** spend the separately quoted **2 generations** on H1b only after
  these draft masks are reviewed/approved and Leo explicitly re-authorizes it,
  because weapon behavior may differ by slot.

This document does not choose between those options. H2a, H2b, and
`transfer-outfit-v2` remain suspended as well.

## Raw-output custody

Raw H1a outputs remain in a local/private archive outside the committed repository
and are not available through a public repo path. The sanitized evidence bundle was
supplied directly to ChatGPT and reviewed; it is not committed. Do not publish raw
metadata, UUIDs, live download URLs, the unrelated account listing, or private job
records. Extracted layers, masks, and composites follow `GEAR_CUSTODY_CONTRACT.md`,
not the static-NPC test.

The H1a UUID appeared in an earlier public commit and must be treated as exposed.
This revision redacts it from the current document, but does not claim that history
has been made secret. Do not rewrite branch history without Leo's explicit
authorization.

---

## Flagged third candidate (NOT part of this probe) — `transfer-outfit-v2`

Live-verified 2026-08-06 but **outside** the spec's locked two-arm probe, so it is
recorded here for a fast decision rather than silently folded in. `transfer-outfit-v2`
takes an outfit reference + 2–16 supplied base frames and returns **composited
frames** (`no_background` available); its own docs list *"apply armour/clothing to a
walking animation"* and *"transfer weapon or equipment to an action sequence."* Like
H2 it yields a composite, not a layer, so it would still feed our difference
extraction — but because we hand it the **exact approved base frames**, it may align
more tightly than a from-scratch state edit.

> **Ready-to-approve extension (one paragraph, for a yes/no):** *If the two-arm probe
> is inconclusive — e.g. H1 fails containment and H2 fails GC5 base-identity — add a
> third arm running `transfer-outfit-v2` on the same Ranger + `iron_armor` +
> `steel_sword`, static only, same three evaluated facings, feeding the approved
> `assets/adventurer-<facing>.png` frames as the base and the item as the outfit
> reference, then extract and validate through the same gear custody gates
> (mask-mandatory, fail-closed). Quoted ≈1 generation set (frame-packed; count
> measured live). Draws from the SAME 12-generation cap as the rest of this probe —
> no new cap. Same stop conditions. Approve only if the two-arm result is
> inconclusive.*

This keeps a proven third option one word away without opening a new research round.

---

## North Star alignment

**Intentional interim gap** — the one executed H1a call produced an unapproved
private research output, not a committed character, equipment, or world asset.
The game has no runtime visual change, and no North Star direction is superseded.
