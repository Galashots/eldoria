# Sub-project A Phase 1 — PixelLab method map and H1a failure record

> **SUSPENDED.** This document records the completed H1a probe and the later
> single API confirmation probe, then defines the documentation/tooling review
> protocol. It authorizes no further PixelLab call.
> ChatGPT is the visual/method reviewer; Leo owns spend, mask approval, and any
> later authorization. This PR does not merge, integrate art, or change runtime.

## Scope and disposition

Phase 1 is a method map, custody validator, and failure record. It is not a
production generation batch. The executed probes are H1a and one later Inpaint
v3 API confirmation:

| Fact | Recorded result |
|---|---|
| Call | Exactly one `create-character-v3` from-scratch call |
| Cost | 2 generations; 2 of the original 12-generation ceiling were spent |
| Output | Eight 120×120 RGBA rotations; binary alpha |
| Metadata | `template_id=mannequin` |
| Human result | Headless, substantially complete mannequin/outfit in every rotation: arms, gloves, belt/lower-body clothing, legs and boots |
| Route verdict | H1 / body / direct-overlay = **LOSE before GC scoring** |
| Custody | Raw output remains private and outside `assets/`; sanitized evidence was supplied directly to ChatGPT and reviewed |

This is live-exercised evidence from one result, not a general claim about every
PixelLab endpoint. It permanently eliminates `create-character-v3` as Eldoria's
direct-overlay method. H1b is removed: no further object or weapon call through
that endpoint is authorized or proposed. The historical output UUID appeared in
an earlier public commit and must be treated as exposed; this revision redacts it
and does not rewrite published history.

The remaining 10 generations of the historical 12-generation ceiling remain
recorded, but this document authorizes no automatic spend. The study-derived
method experiments below are bounded by the existing 100-generation total
research ceiling and Reserve rules; Leo must still authorize each cheapest
discriminating call from the live quote. No call is executed by this revision.

## Method map

### Rejected: `create-character-v3` direct overlay

H1a failed the human semantic gate independently of custody scoring. The artifact
cannot become a valid equipment-only layer by cropping, erasing limbs, removing a
background, redrawing, or manual repair. GC4/GC5 remain unscored because the masks
are draft, but that does not soften the semantic **LOSE**.

### Parked: `create-character-state`

This remains a possible future raw-source experiment only, not part of the current
batch. It returns complete edited characters, not transparent slot layers, and the
remote 256px character is not byte-identical to the committed 64px runtime source.
Exact normalization cannot presently be reconstructed, and its pre-call
generation cost is not adequately bounded. No state call is authorized.

If Leo later reopens this route, the raw full-resolution composite must first be
compared against the same-resolution, hash-pinned base and masks. Resizing before
off-mask comparison is invalid because interpolation can change pixels outside a
mask. Only an extracted passing layer may then be deterministically normalized to
64×64.

### Paid-test priority after Stage 0 review

Stage 0 image custody is **PASS**: source-file and export-file SHA-256 values are
separate provenance fields, the canonical pixel SHA-256 matches, and a Chrome
canvas `drawImage` → `getImageData` comparison found zero differing RGBA bytes.
The deterministic `sRGB` ancillary PNG chunk is not a custody failure.

The first paid test is now the cheapest discriminating route available in the
live client:

1. **Try on**, documented at 1 generation per run: exact committed Ranger frame
   as subject, one pinned armour/item reference, armour first, one call only. If
   it clearly fails, stop without retrying.
2. **Multi image**, documented at 1 generation per run: use only if available and
   either Try on fails or reconnaissance shows a materially better
   input/reference contract. Use one exact Ranger plus one pinned item/reference
   image; no retry without a diagnosed cause.
3. **Standard Inpaint / Classic**, using the exact committed 64×64 Ranger frame
   and one approved binary mask. Capture the actual live cost first, use one
   armour or weapon call initially, and do not accidentally select Inpaint v3.
4. **Inpaint v3** is quality escalation only. Its confirmed live cost is 20
   generations; use it only if a cheaper route is promising and quality is the
   remaining problem.

Try on and Multi image were not exposed in the inspected Pixelorama editor, so
their live availability remains a gate. The first confirmed one-facing fallback
is standard PixelLab Inpaint, using the exact committed 64×64 Ranger frame and
one approved binary mask per slot/facing. The first-facing matrix remains:

| Facing | Body item | Weapon item |
|---|---|---|
| `down-right` | iron armour body test | steel sword weapon test |

For each item: one result, one fixed seed, exact hand and sword orientation
pinned, and the actual cost disclosed by the live UI recorded before owner
approval. The browser method map above was the pre-API plan. The later API
confirmation below was separately authorized by Leo after zero-generation
schema and cost reconnaissance. No further call is authorized by this record.

Weapon orientation is pinned to the Ranger's right hand. In the draft masks, the
blade starts at that hand/forearm and extends screen-up-right for `down-right`,
screen-right for `right`, and screen-up-left for `up-left`. The mask is the
computation canvas, not a post-generation crop.

### Scale-up options after the single-facing test

These are future owner-gated browser experiments only:

| Option | Method | Quoted method cost / scope |
|---|---|---|
| A | Repeat standard Inpaint per facing | Measure and approve each call from the live UI |
| B | Edit Animation Pro | Exact 64×64 directional frames; 20 generations per 2–16-frame batch |
| C | Transfer Outfit Pro | Approved visual item reference; 20 generations at 64px |

Options B and C are not authorized by this PR. No animation generation or
production asset integration is included.

### Paid-call evidence checklist

Every paid call must record: tool; exact input paths and SHA-256 values; prompt;
fixed seed; live displayed cost before approval; actual cost and cumulative spend;
screenshots; raw output SHA-256; off-mask pixel count and coordinates;
deterministic extraction/recomposition result; visual verdict; and any
canonical-pixel/Chrome-canvas comparison used for custody. No multi-facing or
animation work begins until one single-facing gear method passes.

`Animate with Text (New)` at 64×64 is recorded only as a future combat-animation
candidate: the current official documentation lists 1 generation for 4, 8, or
16 frames. It is outside the current static gear-method stage.

## Transfer Outfit reference map

Transfer Outfit is not inside the historical remaining 12-generation cap. It is
a separate, future owner-gated browser Pixelorama/Aseprite workflow with one
outfit reference per call:

| Reference size | Maximum frames | Cost |
|---|---:|---:|
| 32–64px | up to 15 | 20 generations |
| 65–80px | up to 8 | 20 generations |
| 81–128px | up to 3 | 20 generations |
| 129–170px | up to 3 | 25 generations |
| 171–256px | up to 3 | 40 generations |

Returned composites would still require same-resolution comparison, deterministic
layer extraction, and the mandatory mask/custody gates. A one-reference-per-call
constraint and the browser workflow must be recorded in any future approval.

## Canvas and anchor custody

Every future evidence record must declare four things before scoring: source
canvas, validation canvas, mask canvas, and deterministic placement. The Phase 1
Inpaint route uses the exact 64×64 source, 64×64 validation canvas, 64×64 mask,
origin `(0,0)`, and no scale, crop, interpolation, rotation, or translation.

For any vendor-sized raw output, placement onto a 64×64 validation canvas must be
an explicit deterministic contract naming crop, scale, interpolation, pivot/anchor,
and allowed translation. Human placement is prohibited. H1a is 120×120 and is a
semantic LOSE; no placement or rescue transform is being invented for it.

For the parked raw-source route, compare the raw full-resolution composite and
same-resolution hash-pinned base/masks first; normalize only a passing extracted
layer to 64×64. The mask must exist on the computation canvas used for the
off-mask comparison.

## Draft mask evidence

The six masks below are deterministic 64×64 binary review artifacts. Every one is
**DRAFT — NOT OWNER/REVIEW APPROVED**. The contact sheet overlays each mask on the
actual committed Ranger hero frame; it is not a mask-only sheet.

Mask disposition after visual review: the original `body-down-right.png` is
**REJECTED FOR BODY-SLOT PRODUCTION GEOMETRY - historical probe evidence only**.
The other original masks remain draft. Three replacement down-right candidates
are recorded under
`tools/pipeline/masks/gear-probe-20260806/body-down-right-candidates/`; all
require ChatGPT/Leo visual approval before any further generation.

Base-frame SHA-256 values:

| Facing | Base path | Base SHA-256 |
|---|---|---|
| down-right | `assets/adventurer-down-right.png` | `a59a6d7caec21752f99304e22390f8fbba7df14aced6efe4b8853b53b9f40300` |
| right | `assets/adventurer-right.png` | `fb7b291ded4c645b91bb084cf7523294475bc3efeca074d1c0e770b500819455` |
| up-left | `assets/adventurer-up-left.png` | `821f0da2e25c9c5ebed63fd0dcf0ad1f00ff22677fc5c08e30387339ab40d8ff` |

| Slot | Facing | Mask | SHA-256 | Status |
|---|---|---|---|---|
| body | down-right | `tools/pipeline/masks/gear-probe-20260806/body-down-right.png` | `a07def2a3959f598bd6a32c9dee3b79b529731c2bb644ed12952692585327ec5` | REJECTED FOR BODY-SLOT PRODUCTION GEOMETRY - historical probe evidence only |
| body | right | `tools/pipeline/masks/gear-probe-20260806/body-right.png` | `70a4c8bbb6b32984ffcafad2a081825e390b932d503fe0da0dc1cb550d527847` | DRAFT — NOT OWNER/REVIEW APPROVED |
| body | up-left | `tools/pipeline/masks/gear-probe-20260806/body-up-left.png` | `2ce7543b0dec1ec3e2fd92599e77f7b61f43a18f6c87c004dbac011cc004c547` | DRAFT — NOT OWNER/REVIEW APPROVED |
| weapon | down-right | `tools/pipeline/masks/gear-probe-20260806/weapon-down-right.png` | `49545f2722cc242b6e827be2e6757a670b90106ebb54e98f130b925a3b99359a` | DRAFT — NOT OWNER/REVIEW APPROVED |
| weapon | right | `tools/pipeline/masks/gear-probe-20260806/weapon-right.png` | `e9910c03ffa3e0712df07229a78ce8aca545690f5a57efd416e629e4705f3a8f` | DRAFT — NOT OWNER/REVIEW APPROVED |
| weapon | up-left | `tools/pipeline/masks/gear-probe-20260806/weapon-up-left.png` | `01d96959286233c3a97062b75c4579a91a85e811ebf861bfe736cda8bcbf5e76` | DRAFT — NOT OWNER/REVIEW APPROVED |

The validator and evidence schema enforce that a draft or missing mask cannot
produce GC4/GC5 PASS, and that a `WIN` requires complete machine and human fields.
Reviewer sheet SHA-256: `b0b1f68d84b754f8181f801eed70b1118462e28fd102e6bc80ad5e3918650960`.

## Inpaint v3 API confirmation — 2026-08-08

The live schema was re-read read-only before the call. `POST /v2/inpaint-v3`
requires `description`, `inpainting_image`, and `mask_image`; it accepts
`seed`, `no_background`, and `crop_to_mask`; and it returns a background job
ID. The completed `GET /v2/background-jobs/{job_id}` response exposes the
authoritative result in `last_response`. The live schema also documents white
as generate and black as preserve for the mask.

The account is charged in subscription generations. The official Inpaint v3
documentation quoted 20 generations per use. The pre-call balance was 1,457
of 2,000; the post-call balance was 1,437, confirming an actual 20-generation
charge. PR54 research spend therefore moved from 45 to 65 of the separate
100-generation-equivalent ceiling. The request used the exact 64x64 Ranger
frame SHA `a59a6d7caec21752f99304e22390f8fbba7df14aced6efe4b8853b53b9f40300`,
Candidate C SHA
`454d285e9d3a4782ade5a16f65327d8941950a4fef01ad7bc9ba2a5b3163832d`, seed
`20260808`, `no_background=false`, and `crop_to_mask=true`. No PixelLab
credential, job ID, or live result URL is committed.

The authoritative raw result is 64x64 RGBA with alpha value 255 throughout.
It visibly contains a fitted torso armour treatment, but it changed 3,097
pixels against the base and 2,858 of those changes were outside Candidate C.
The deterministic extracted layer SHA is
`079b261f792520535e88c11dc67295f50ecd9948f51589e5bb839b7c4042a7fe`; the
recomposed SHA is
`e139d812a8e3e172ad51f30af1c90bf7dadadb52476789af836cde7b3bb2870a`; and
recomposition is byte-identical. The machine result is therefore custody
**LOSE** despite deterministic recomposition. The raw PNG and six-panel sheet
remain private, outside `assets/`, and are not production gear. No API retry,
sword, other facing, Transfer Outfit, animation, or other paid route is
authorized.

Evidence record:
`docs/playtest/2026-08-06-pixellab-gear-probe/api-confirmation-2026-08-08/evidence.json`.

## H1a evidence custody

The private archive `iron-armor-h1a-sanitized-review.zip` is not committed. The
repository may reference its private-review verdict, but does not publish raw
metadata, UUIDs, download URLs, account listings, or private job records. The
committed H1a failure record is
`tools/pipeline/evidence/gear-probe-20260806/h1a-body-direct-overlay.json`.

## North Star alignment

**Intentional interim gap.** This PR adds documentation, masks, a deterministic
validator, and a failure record only. It makes no runtime or production-art
change and does not supersede the repository North Star.
