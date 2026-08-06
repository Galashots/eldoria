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
| H1a — Iron Armor, direct-overlay | `POST /create-character-v3` (from-scratch) | `character_id 6de87792-b910-4357-800f-a46763b5ff65`, `status: completed`, 8 rotations returned | **2 generations** (balance 1502.0 → 1500.0, confirmed via `/balance` before and after) |

- **H1b (Steel Sword) and both H2 calls were never sent.** No other job or
  character was created in this batch.
- Cost matched the quote exactly (≈2 gen/item) — no overrun, no unexpected
  extra job, no stop condition tripped.
- Raw outputs (request/response, job record, character detail, all 8
  rotation PNGs) are archived under
  `docs/playtest/2026-08-06-pixellab-gear-probe/h1-direct-overlay/`.
- **This artifact cannot be GC-scored yet.** No approved `(slot, facing)` mask
  exists for Iron Armor. Under the now-mandatory fail-closed mask rule (see
  the mask-provenance plan below), GC4/GC5 record **FAIL — unscored**, not a
  pass, until a mask is authored and applied. It is evidence of cost and
  completion, not yet of quality.
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

### Mask provenance plan (new — masks are now mandatory for every route)

No `(slot, facing)` mask yet exists for `iron_armor` or `steel_sword` on any of
the three evaluated facings. Per `GEAR_CUSTODY_CONTRACT.md` §2/§3 (fail closed,
no route exempt — including direct-overlay), **no generated artifact in this
probe can be scored PASS on GC4/GC5 until a mask is authored and applied.**
Proposed plan, for Fable/ChatGPT to confirm before generation resumes:

1. For each evaluated facing, a human (Claude drafts, ChatGPT/Leo confirms)
   marks the approved equipment region directly on the **committed base frame**
   — e.g. the torso silhouette for `body`, the hand/forearm reach envelope for
   `weapon` — as a binary PNG at the same canvas size as the artifact it gates.
2. Masks are committed under `docs/playtest/2026-08-06-pixellab-gear-probe/masks/`
   pending promotion to a permanent `tools/pipeline/masks/` home if the method
   they gate wins.
3. Masks are drawn conservatively (smaller, not larger, than the expected item
   footprint) so containment is a real test, not a rubber stamp.
4. Until a mask for a given `(slot, facing)` exists, its GC4/GC5 result is
   recorded **FAIL — unscored**, exactly as done for the already-executed H1a
   Iron Armor artifact above.

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
| **H1a — Iron Armor** | `POST /create-character-v3`, from-scratch (no `reference_image`), `view="high top-down"`, `no_background=true`, `seed=20260806`, no `image_size` (defaults 64×64), description: *"A single RPG game equipment item, an Iron Armor breastplate: plain brushed steel-grey chest armor plate with simple leather straps, no shoulder pauldrons, no arms, no legs, no head, no character, no body, no mannequin, no hands, isolated object floating alone on transparent background, flat pixel art icon style, single-color black outline, medium detail, child-friendly, high top-down 35 degree camera angle to match the game's hero sprites."* | ✅ **EXECUTED** | **2 (spent)** |
| **H1b — Steel Sword** | Same endpoint/mode/view/`no_background`, `seed=20260807`, description: *"A single RPG game equipment item, a Steel Sword: plain straight steel blade with a simple crossguard and brown leather-wrapped hilt, no character, no body, no hand, no arm, no mannequin, isolated object floating alone on transparent background, flat pixel art icon style, single-color black outline, medium detail, child-friendly, high top-down 35 degree camera angle to match the game's hero sprites."* | Not yet sent | **≈2 (quoted)** |
| **H2a — Ranger + Iron Armor only** | `POST /create-character-state`, `character_id="add36c36-295d-4626-94fd-179a4102d1ea"`, `edit_description="wearing a plain iron chestplate armor over the existing outfit; no other changes"`, `use_color_palette_from_reference=true`, `seed=20260808` | Not yet sent | **unpublished — measured live** |
| **H2b — Ranger + Steel Sword only** | `POST /create-character-state`, same `character_id`, `edit_description="holding a plain steel longsword in one hand; no other changes"`, `use_color_palette_from_reference=true`, `seed=20260809` | Not yet sent | **unpublished — measured live** |

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
> reference, then extract and validate through the same gear custody gates
> (mask-mandatory, fail-closed). Quoted ≈1 generation set (frame-packed; count
> measured live). Draws from the SAME 12-generation cap as the rest of this probe —
> no new cap. Same stop conditions. Approve only if the two-arm result is
> inconclusive.*

This keeps a proven third option one word away without opening a new research round.

---

## North Star alignment

Not visually relevant — this is a spend-authorization request; the one executed
call (H1a) produced a floating equipment icon, not a character or world asset. No
alignment verdict required.
