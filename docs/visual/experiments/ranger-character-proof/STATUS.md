# Ranger animated-character pipeline proof

**Status:** Four static facings and one four-frame SE/right walk candidate are ready for owner motion review  
**Branch:** `work/ranger-character-pipeline-proof`  
**Scope:** bespoke Ranger pipeline proof only; no attacks, equipment variants, enemies, other walk directions, or runtime integration

## Decision gate

**PROOF READY FOR OWNER REVIEW — ONE WALK DIRECTION.**

Leo accepted the static set as the experimental identity/camera seed. The branch now adds exactly one whole-strip walk experiment for `right` → SE, as authorized. It remains a proof, not approved production art.

The bounded iteration limit was respected:

1. one initial four-facing static candidate;
2. one targeted static correction;
3. one initial four-frame walk strip;
4. one targeted walk correction;
5. deterministic cleanup and normalization only after that correction.

No stock or third-party character model was substituted. The candidate remains a bespoke Eldoria Ranger derived from the owner-approved North Star identity.

## Coordination

- Track 1 remains separate in PR #12.
- Track 2(b) remains separate in PR #13 and is useful as a feasibility record for the deterministic Blender rig.
- No `index.html` change exists here, so there is no Town or gameplay integration overlap.

## Static candidate

Source:

- `art/source/characters/ranger-four-facing-source-v001.png`

Normalized 64×64 facings:

- `art/ranger-proof/normalized/adventurer-right.png`
- `art/ranger-proof/normalized/adventurer-down.png`
- `art/ranger-proof/normalized/adventurer-left.png`
- `art/ranger-proof/normalized/adventurer-up.png`

Engine mapping:

| Engine slot | Isometric facing |
| --- | --- |
| `right` | SE |
| `down` | SW |
| `left` | NW |
| `up` | NE |

All static machine gates pass. The committed-PNG integrity gate runs before any regeneration so corrupted committed assets cannot be hidden by CI overwriting them.

## Walk candidate

Source:

- `art/source/characters/ranger-right-walk-source-v001.jpeg`

Normalized output:

- `art/ranger-proof/normalized/adventurer-right-walk.png`

Review evidence:

- `walk-v1/walk-strip-preview.png`
- `walk-v1/machine-check-report.json`

The source is a 1536×512 whole-strip candidate containing four evenly spaced gait frames on a baked light checkerboard. `tools/process-ranger-walk-source.mjs`:

- slices the fixed 4×1 source grid;
- removes only light, near-neutral checker pixels using fixed thresholds;
- retains the largest four-connected foreground component in each cell;
- applies one shared scale targeting a maximum height of 56 pixels;
- resamples with nearest-neighbour;
- forces binary alpha;
- centers the bottom-six-row foot centroid at `x=32`;
- anchors visible bounds to `y=63`;
- packs a 256×64 strip;
- generates dark, magenta, runtime-scale, and anchor-overlay evidence;
- repeats the process and compares output hashes.

Commands:

```sh
npm run ranger-source:process
npm run ranger-walk:process
npm run ranger-proof:candidate
npm run ranger-proof:self-test
npm test
```

## Walk machine result

- output dimensions: 256×64;
- frame count: 4;
- RGBA with binary alpha: pass;
- visible subject in every frame: pass;
- bottom anchor at row 63: pass;
- horizontal padding: pass;
- shared scale: pass;
- silhouette-centre range: 5.5 px, within the 6 px harness limit;
- top/head-bob range: 2 px, within the 4 px harness limit;
- foot-centre range: about 0.54 px;
- deterministic local rerun: pass.

The first frame is intentionally wider and more left-heavy because of the extended gait, cape, and bow. Its foot pivot remains aligned. Recentring each silhouette independently would hide the real pose displacement and introduce foot slide.

Machine checks do not establish identity, equipment, gait appeal, camera, lighting, pixel quality, or North Star alignment.

## Visual self-check — not approval

- **Identity consistency:** likely pass. Hair, face, green cloak, leather gear, bow, quiver, and proportions remain recognizably the accepted Ranger.
- **Whole-strip coherence:** likely pass. The four frames read as one walk cycle rather than independent character redraws.
- **Gait readability:** likely pass. The strip contains alternating contact and passing poses.
- **Equipment consistency:** promising. Bow, quiver, cape, belt, and satchel remain in stable locations, with small frame-to-frame drawing drift.
- **Foot contact:** likely pass at normalized scale; runtime motion still requires browser review.
- **Silhouette at 1×:** likely pass. The role and major equipment survive, while facial and costume micro-detail compress.
- **Pixel treatment:** promising but still softer and more illustrative than final deliberately clustered HD-2D production art.
- **Fixed-camera consistency:** uncertain. This is a coherent generated whole strip, not a mathematically fixed 3D render.

## Evidence policy

Committed review evidence is intentionally small:

- static enlarged contact sheet;
- walk enlarged dark-background preview;
- static and walk machine reports.

CI regenerates the true 1× sheet, magenta transparency sheet, dark-background sheet, anchor/bounds overlay, and validator report as downloadable workflow artifacts.

## North Star alignment

**Intentional interim gap.**

The proof preserves the older Ranger role, green-and-leather explorer identity, child-friendly adventure tone, readable diagonal facing, warm light, and clear distinction from the Mage. It does not yet prove final production pixel clustering or exact fixed-camera geometry. No North Star refresh is recommended.

## Owner review question

Judge only the motion seed:

1. **Accept the four-frame SE/right walk as sufficient pipeline proof**, after which the PR can remain a reusable evidence/tooling branch or be merged without runtime integration; or
2. **Reject it with one specific motion or consistency target**.

Do not expand to other facings or integrate into `index.html` until this review gate is resolved.
