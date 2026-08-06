# PixelLab method-elimination probe — authorization request for Leo

> **⛔ NOT AUTHORIZED. NOTHING HAS BEEN GENERATED.** This is a request for your
> explicit per-batch approval, in the batch-authorization format spec §6 requires.
> No PixelLab generation call has been made; producing this document cost nothing
> (all verification was read-only `curl` of the public API schema). Generation
> begins only if and when you say so.

**Author seat:** Claude (research seat, Sub-project A). **Directs:** Fable.
**Non-author review:** ChatGPT. **Merges / approves spend:** Leo.
**Governing spec:** `docs/superpowers/specs/2026-08-05-combat-armor-design.md` §6.

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

- `POST /v2/create-character-v3` — exists; reference-mode cost `ceil(w·h·8/65536)`.
- `POST /v2/create-character-state` — exists; returns a **complete edited
  character**, not a layer (`character_id` + `edit_description` required;
  `use_color_palette_from_reference` available). Its per-call **generation count is
  not published in the schema** — see the stop conditions.
- Difference extraction and compositing are **our deterministic code**, not vendor
  calls. `remove-background` exists but is banned from the custody path (GC8).

## Approved inputs (must be pinned by SHA at run time)

- **Hero:** Ranger only (`profile = adventurer`).
- **Extraction truth:** committed `assets/adventurer-<facing>.png` base rotations.
- **Generation reference:** the exact approved south-facing Ranger reference — the
  executor records its SHA-256 into the evidence record before the first call.
- **Items:** one body armour (`iron_armor`) + one weapon (`steel_sword`)
  (`js/03-maps-areas.js`).

## Coverage

| Dimension | Probe value |
|---|---|
| Heroes | 1 (Ranger) |
| Items | 2 (one body armour, one weapon) |
| States | **static only** (no walk/attack — animation deferred per research finding #5) |
| Facings generated | all 8 (v3/state return 8 inherently) |
| Facings **evaluated** | smallest useful subset: `down-right` (compass S, face), `right` (SE, engine-consumed + paper doll), `up-left` (compass N, back — catches cape/weapon occlusion) |
| Retained | all 8 generated facings kept as source |

## Calls, quoted cost, and hard cap

Cost is in **generations** (the vendor's billing unit). Convert to your plan's
per-generation rate before approving.

| Arm | Concrete call(s) | Quoted generations |
|---|---|---|
| **H1 direct** | Generate each item as a transparent layer (candidate endpoint: `create-character-v3` from-scratch at 64 px, or image-endpoint + `generate-8-rotations-v3`; both land ≈2 gen/item). 2 items. | **≈4** |
| **H2 equipped-state** | 1 × `create-character-state` on the Ranger character: *"wearing iron chest armour and holding a steel sword"*; then our free deterministic extraction per slot. | **≈1 set — count UNPUBLISHED, measured live** |

- **Maximum authorized spend: 12 generations for the whole probe.** If the running
  total reaches 12, **stop** — do not finish the batch, do not retry.
- Expected actual spend is well under the cap; the cap exists to bound the
  unpublished state-route cost and any surprise.

## Acceptance criteria (what makes a route "win")

Per `(slot, route)`, recorded in `GEAR_EVIDENCE_RECORD_TEMPLATE.md`:

1. **GC5 = 0 off-mask identity pixels changed** — hard elimination gate. Any drift
   outside the approved mask loses, no matter how good it looks.
2. GC4 mask containment, GC6 layer-order fidelity, GC8 determinism all PASS.
3. Human: heading fidelity holds; the same item is recognizable across the evaluated
   facings; no semantic drift; North Star is not regressed.
4. Cost and manual repair minutes are tolerable and the repair is deterministic.

Outcome may be **per slot** (e.g. body wins on H2, weapon wins on H1) — that is an
allowed result, not a failure.

## Immediate stop conditions (stop and return evidence to Leo — never auto-retry)

- Any **unexpected extra job** or a call fanning out beyond the plan.
- **Billing past the 12-generation cap**, or the balance moving in a way the quote
  didn't predict.
- **Schema mismatch at call time** — an endpoint or field differs from the
  2026-08-06 verification.
- **Off-mask identity changes** that no approved mask can contain (GC5 fails).
- **Arm-2 prerequisite gap:** if the approved Ranger does **not** already exist as a
  PixelLab `character_id` in the account, `create-character-state` cannot run without
  first (re)creating the character — that is **additional spend**. Stop and ask Leo
  rather than spending to recreate it.
- Any `422`/error that would normally invite a retry.

## Raw-output custody

Raw outputs land under `docs/playtest/2026-08-06-pixellab-gear-probe/` (unlisted
until approved for sharing), hashed into the evidence records. Extracted layers,
masks, and composites follow `GEAR_CUSTODY_CONTRACT.md`, not the static-NPC test.

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
> reference, then extract and validate through the same gear custody gates. Quoted
> ≈1 generation set (frame-packed; count measured live), same 12-generation cap
> applies, same stop conditions. Approve only if the two-arm result is inconclusive.*

This keeps a proven third option one word away without opening a new research round.

---

## North Star alignment

Not visually relevant — this is a spend-authorization request, no art produced. No
alignment verdict required.
