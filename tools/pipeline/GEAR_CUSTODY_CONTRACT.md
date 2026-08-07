# Gear custody contract and validator

**Status:** IMPLEMENTED TOOLING CONTRACT (Sub-project A Phase 1, 2026-08-06).
`tools/pipeline/validate_gear.py` implements the deterministic checks specified
here. One unapproved H1a research output exists outside `assets/`; its human
semantic gate failed before custody scoring. This contract is what generated
equipment must pass before it may enter `assets/`.

H1a is therefore **LOSE before GC scoring**, not merely an unscored custody
failure. Its mannequin/outfit content independently violates the direct-overlay
hypothesis. GC4/GC5 remain fail-closed. The former `body-down-right.png` mask
is now **REJECTED FOR BODY-SLOT PRODUCTION GEOMETRY - historical probe evidence
only**; the other original masks and the three replacement down-right candidates
remain draft and cannot produce a production custody PASS.

## 1. Contract facts

- Runtime frames are 64x64 RGBA with binary alpha.
- Equipment is rendered as aligned full-frame layers in `cape -> base -> body ->
  head -> weapon` order.
- There is no hand keypoint to anchor a generated weapon. The approved mask and
  declared deterministic transform are the anchor contract.
- This contract governs generated equipment layers, extracted layers, masks, and
  composites. The static-NPC crop/translate contract remains separate.
- Source-file SHA-256 and candidate/export-file SHA-256 are separate provenance
  fields. For same-resolution PNG custody, also record a canonical pixel
  SHA-256 over dimensions followed by decoded RGBA bytes. A no-cost Chrome canvas
  `drawImage` → `getImageData` comparison must report zero differing RGBA bytes.
  Deterministic ancillary PNG metadata does not fail image custody when those
  pixel checks pass.

## 2. Required validator inputs

The validator requires all of the following:

1. An immutable, hash-pinned committed base frame.
2. A candidate composite or candidate transparent layer.
3. A committed binary mask that is approved for this slot and facing.
4. `--slot`, `--facing`, and an evidence record.

The current draft masks are review artifacts, not approval. No missing or pending
mask can produce GC4/GC5 PASS.

## 3. Canvas, anchor, and transform custody

Every evidence record declares the source canvas, validation canvas, mask canvas,
deterministic transform, and anchor before scoring. The Phase 1 standard Inpaint
route uses the exact committed 64x64 source frame, a 64x64 validation canvas, a
64x64 mask, origin `(0,0)`, and identity transform: no crop, scale,
interpolation, rotation, or translation. Human placement is prohibited.

If a future vendor route returns a 120px or 256px composite, placement onto the
64x64 validation canvas must explicitly name crop, scale, interpolation,
pivot/anchor, and allowed translation. The raw full-resolution composite must
first be compared against the same-resolution hash-pinned base and masks;
resizing first can change off-mask pixels and invalidate GC5. Only a passing
extracted layer may then be deterministically normalized to 64x64. Masks exist on
the computation canvas, not only on a later review sheet.

## 4. Gates

Exit 0 means all applicable machine checks pass. A nonzero exit prints the
failure. Human approval remains separate.

### GC1 — canvas and alpha primitives

Base, candidate, and mask are exactly 64x64. Base and candidate are RGBA. Alpha
is binary (`0` or `255`) for every PNG. A mask is non-empty and is not the full
canvas.

### GC2 — immutable base

The base is read-only input. The validator never edits, resizes, filters, or
normalizes it.

### GC3 — registration and transform custody

The base and candidate use the declared computation canvas and origin. Base pixels
are not translated, rescaled, rotated, cropped, or filtered. A vendor-to-engine
placement is accepted only when its deterministic transform and anchor are written
in the evidence record. Legitimate silhouette growth inside the approved mask is
allowed; no hero-sized bounding-box limit is imposed on an equipment layer.

### GC4 — mask containment

Every changed pixel in a composite, or every nontransparent pixel in a layer, is
inside the approved `(slot, facing)` mask. The validator reports the exact count
and coordinates of off-mask changes.

### GC5 — off-mask identity invariance

Every pixel outside the approved mask is byte-identical to the base. For an
equipped composite, the same-resolution off-equipment region must already equal
the base before difference extraction. A visually close hero with identity drift
fails this gate.

### GC6 — deterministic extraction and recomposition

The extracted layer is produced deterministically from base versus composite. The
validator recomposes the base with that layer and proves byte-identical equality
to the candidate composite. Layer order remains the fixed engine order above.

### GC7 — coverage

The required `(slot, facing, state)` matrix must be present. Missing entries fail
unless the evidence record contains an owner-acknowledged waiver. This Phase 1
review evaluates only `down-right`, `right`, and `up-left`; it does not claim full
production coverage.

### GC8 — deterministic SHA-256

Re-running extraction and recomposition from the same committed inputs yields
byte-identical PNG bytes and SHA-256 values. Model generation is upstream of this
custody path. Vendor background removal is not a custody step.

## 5. Route disposition

- **Try on:** first paid discriminator when live-available; use the exact 64x64
  subject and one pinned item reference, then apply this same custody contract
  to the returned composite.
- **Multi image:** conditional second discriminator when live-available; use
  same-size exact inputs and apply this same custody contract to the result.
- **Standard Inpaint / Classic:** controlled fallback. Use the exact 64x64 frame
  and mask on the same computation canvas.
- **Inpaint v3:** quality escalation only; its confirmed live cost is 20
  generations/use and it must not be the first paid test.
- **`create-character-v3`:** permanently eliminated as Eldoria direct-overlay by
  H1a. No H1b object/weapon call is authorized through it.
- **`create-character-state`:** parked as a possible future raw-source experiment;
  it returns complete edited characters, its cost is not adequately bounded, and
  its remote 256px source is not byte-identical to the committed 64px source.
- **Transfer Outfit:** future owner-gated browser workflow; it returns composites,
  so same-resolution comparison and deterministic extraction remain mandatory.
  Its size/frame/cost table is outside the historical 12-generation cap.

## 6. Human gates and evidence states

Machine PASS is only eligibility for review. Heading fidelity, semantic drift,
recognizability, temporal stability, and North Star alignment remain human fields.

- **DRAFT:** review artifact; never WIN; masks are not approved.
- **SCORED:** machine custody fields have been evaluated with an approved mask;
  this does not itself approve the art.
- **FINAL:** all required machine and human fields are complete. `WIN` is legal
  only for a FINAL record with approved mask, SCORED custody, GC4/GC6/GC8 PASS,
  GC5 exactly zero, semantic gate PASS, and complete human fields.
- **LOSE:** may be recorded after a human semantic FAIL before custody scoring;
  GC fields remain UNSCORED and this is not a custody PASS.

The evidence schema and validator must reject any attempt to call an incomplete
record `WIN`.

## 7. Implemented tooling

`tools/pipeline/validate_gear.py` accepts `--base`, `--candidate`,
`--candidate-kind composite|layer`, `--mask`, `--slot`, `--facing`,
`--evidence`, `--layer-out`, and `--recomposed-out`. It performs the gates above,
prints off-mask coordinates, emits deterministic PNGs, and prints their SHA-256
values. `tools/pipeline/validate_gear_test.py` covers composite and layer inputs,
off-mask coordinates, draft/WIN guarding, recomposition, and deterministic hashes.

## 8. Relationship to existing tools

| Tool | Governs | Status |
|---|---|---|
| `tools/npc-static-contract-test.py` | Static NPC source frames | Remains in force for that asset class |
| `tools/pipeline/validate_sprites.py` | Normalized hero sprite geometry | Remains in force |
| `tools/pipeline/validate_gear.py` | Equipment masks, layers, extraction, composites | Phase 1 tooling |

No production asset, runtime code, or public raw PixelLab output is part of this
contract.
