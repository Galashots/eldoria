# AI Team Role Trial Evidence

**Status:** Active evidence register  
**Charter:** [`AI_TEAM_CHARTER.md`](AI_TEAM_CHARTER.md)  
**Started:** 2026-07-28  
**Last updated:** 2026-07-29  
**Owner:** Leo Pinto, Game Director

## Purpose

This file records real-work evidence used to reassess Eldoria's provisional AI team charter. It prevents provisional role claims from becoming permanent through repetition and avoids retroactively treating unrelated work as a successful trial.

This register records evidence; it does not change roles, authority, approval gates, or merge permissions.

## Counting rules

A task counts toward the charter's five-material-task reassessment trigger only when it has reached one of these outcomes:

1. a pull request is merged;
2. a pull request or branch is deliberately closed with a reusable documented technical or product decision; or
3. Leo explicitly accepts a delivered artifact or decision as complete for its bounded scope.

Draft work, intermediate commits, CI success alone, generated candidates awaiting review, and paused experiments do not count as completed material tasks.

A qualifying task must record:

- the exact reviewed or accepted commit SHA;
- the bounded outcome;
- lead agent and model/seat where known;
- material reviewers and whether they inspected the same SHA;
- tests and runtime or visual evidence;
- correct findings, false positives, and missed issues where review quality is being compared;
- material tool, context, cost, usage, or owner-effort constraints;
- the owner's decision; and
- any implication for future role routing.

Related parallel tracks count separately only when each produces an independently useful accepted result. Splitting one outcome into several branches does not automatically create several material tasks.

## Current reassessment count

**Completed material tasks since charter approval: 4 / 5**

The fifth qualifying task triggers charter reassessment even if Trials A–C are still incomplete.

## Charter trial status

| Trial | Status | Qualification rule | Current note |
| --- | --- | --- | --- |
| A — Reviewer signal | Not started | Gemini, ChatGPT, and Kimi independently review the same medium-risk functional PR head and evidence; retain findings, false positives, misses, actionable specificity, time/cost, and owner triage effort | Recent PRs supplied useful reviews but not the required same-head three-reviewer comparison. |
| B — ChatGPT bounded engine delivery | Not started | ChatGPT delivers a tightly bounded real engine slice affecting `index.html`, with tests, runtime evidence, and non-author review | PR #11 is accepted visual/asset-pipeline evidence, not the specified engine slice. Do not relabel it. |
| C — Kimi verification | Not started | Kimi, Claude, and ChatGPT receive the same deterministic economy, save, or migration facts; compare calculations, edge cases, and test design | No qualifying comparison has been run. |

## Completed evidence records

### Task 1 — Ranger animated-character proof

- **Outcome:** merged bounded Ranger statics plus one four-frame SE/right walk proof and deterministic processing/validation harness.
- **PR:** [#11](https://github.com/Galashots/eldoria/pull/11)
- **Exact accepted SHA:** `b065a224e74a264b5c66518dd62c38e0948162f1`
- **Lead agent/seat:** ChatGPT; visual and asset-pipeline delivery.
- **Task classification:** visual / asset pipeline.
- **Charter trial:** none; explicitly not Trial B because `index.html` was untouched.
- **Tests and machine evidence:** CI run 88 passed committed PNG integrity, deterministic static/walk processing, synthetic and real-candidate harnesses, smoke tests, isometric tests, and evidence retention. The output met 64×64/256×64, alpha, shared-scale, pivot, stability, and repeat-hash gates.
- **Runtime or visual evidence:** runtime-, dark-, magenta-, anchor-, and walk-preview sheets were committed; owner accepted the experimental source and corrected walk strip.
- **Non-author review:** Gemini reviewed the final head and reported no material finding. Owner acceptance and merge completed the bounded proof; final production-art approval was not implied.
- **Correct material findings:** machine gates were explicitly limited to structure and stability, not identity, gait appeal, camera, lighting, or North Star quality.
- **False positives or review noise:** none retained.
- **Known misses or escaped issues:** no runtime integration; only one walk direction; the proof remained softer than final production pixel treatment.
- **Tool/context/cost/usage constraints:** one primary walk-generation attempt and one corrective pass; deterministic cleanup handled a baked checkerboard source.
- **Owner effort and decision:** Leo accepted the static seed and corrected walk proof; PR merged 2026-07-28.
- **Role-routing implication:** ChatGPT can deliver bounded visual/asset tooling with machine evidence, but this does not establish ChatGPT engine-delivery Trial B.
- **Counts toward five-task trigger:** yes — merged, independently useful proof and tooling.

### Task 2 — TRELLIS/Blender feasibility decision

- **Outcome:** deliberately closed, not merged, as a reusable decision record. The downstream fixed-camera render, normalization, and validation harness worked; the available generated-mesh/blockout source route was blocked and visibly below the North Star.
- **PR:** [#13](https://github.com/Galashots/eldoria/pull/13)
- **Exact accepted SHA:** `91bf0de2784e0ec355bb2907f3ee7d2f67d8b6b5`
- **Lead agent/seat:** Claude Code; feasibility probe.
- **Task classification:** asset-pipeline research / technical decision.
- **Charter trial:** none.
- **Tests and machine evidence:** Blender 4.2.22 headless rendering, Python normalization, and the unchanged Ranger proof harness passed for four statics plus one walk strip. The branch was intentionally not merged.
- **Runtime or visual evidence:** committed contact sheets and runtime-scale evidence showed the primitive blockout was a muddy, inadequate character source despite contract-valid output.
- **Non-author review:** closure recorded that no branch code should enter `main`; the adopted PR #15 decision record independently superseded this route.
- **Correct material findings:** the probe separated reproducible downstream mechanics from the upstream source-quality/access blocker and respected the one-correction stop limit.
- **False positives or review noise:** an early claim that `main` CI was red was wrong; the final head corrected it to a Windows-local rasterization mismatch while CI remained green.
- **Known misses or escaped issues:** no clean full-body Ranger concept and no usable TRELLIS generation quota/token; no production-quality mesh was tested.
- **Tool/context/cost/usage constraints:** anonymous ZeroGPU quota blocked `/image_to_3d`; the available North Star crop was unsuitable as a standing-character input.
- **Owner effort and decision:** closed 2026-07-29 as the do-not-merge feasibility record; retained only for historical evidence and selected contract facts.
- **Role-routing implication:** future asset work should use the adopted PixelLab path; do not revive the 3D generation route without materially new tools and an explicit owner decision.
- **Counts toward five-task trigger:** yes — deliberately closed with a reusable documented decision.

### Task 3 — Production asset pipeline v2

- **Outcome:** merged the PixelLab client, deterministic premultiplied-alpha normalizer, fail-closed validator, labelled cast-sheet builder, complete cast inventory/prompt pack, and model-agnostic asset-generation skill. No runtime or production assets changed.
- **PR:** [#15](https://github.com/Galashots/eldoria/pull/15)
- **Exact accepted SHA:** `1c6be80d672609923647150fdd28413015269019`
- **Lead agent/seat:** Claude Code; tooling and documentation delivery.
- **Task classification:** asset pipeline / documentation.
- **Charter trial:** none.
- **Tests and machine evidence:** CI run 99 passed. Calibration exercised eight-direction identity rotation, cast/landscape generation, premultiplied-alpha normalization, PNG verification, G7 stand-frame checks, G8 completeness, empty-directory failure, and mandatory `--require-walks` for walking profiles.
- **Runtime or visual evidence:** Leo approved the Mage identity rotation, full cast sheet, and Farm landscape sheet; the engine consumes the four diagonal directions from eight-direction generation.
- **Non-author review:** ChatGPT requested material code/documentation changes at two exact heads, then approved exact head `1c6be80…` after both rounds were resolved. Gemini later reported no material finding.
- **Correct material findings:** fail-open validation, background-job exit handling, PNG verification, missing direction labels, unsupported examples, absent `--style-image`, dry-run parsing, camera/slope wording, landscape status, normalizer assumptions, `--require-walks`, and machine-vs-visual gate claims were corrected before merge.
- **False positives or review noise:** none retained; requested fixes were bounded and accepted.
- **Known misses or escaped issues:** generation outputs remain candidates until normalized, validated, committed, wired, and inspected in-game; building kits and Phase 3 wiring remain.
- **Tool/context/cost/usage constraints:** hosted credit-priced generation; local GTX 1060 route rejected as inefficient for this need.
- **Owner effort and decision:** Leo approved the calibration sheets; final exact-head approval and green CI authorized merge on 2026-07-29.
- **Role-routing implication:** Claude is effective for bounded production tooling when paired with rigorous non-author code and visual-process review.
- **Counts toward five-task trigger:** yes — merged, independently useful production process.

### Task 4 — First Town isometric slice

- **Outcome:** merged the General Store and Mira as the first bounded Town isometric slice using validated placeholder geometry, per-tile building depth, doorway/travel cues, and both Action/direct-tap interaction paths.
- **PR:** [#12](https://github.com/Galashots/eldoria/pull/12)
- **Exact accepted SHA:** `078476822768d88aade4e9a0dcf3f8f689b09154`
- **Lead agent/seat:** Claude Code; engine delivery.
- **Task classification:** engine / gameplay-preserving visual integration.
- **Charter trial:** none; useful evidence for Claude's default implementation seat, but not one of Trials A–C.
- **Tests and machine evidence:** CI run 101 passed. `npm test` reported 80 checks, including 25 new Town, depth, interaction, travel, save-invariance, fallback, and evidence assertions.
- **Runtime or visual evidence:** desktop, iPad landscape, phone portrait, building/NPC overlap, interaction, and Farm→Town arrival frames were committed and reviewed.
- **Non-author review:** ChatGPT approved the exact final head after reconciling `.gitignore` with merged PR #15; Gemini subsequently reported no material finding.
- **Correct material findings:** per-tile depth was retained for a wide footprint; direct tap and Action reached the same existing paths; world-space saves and schema version were unchanged.
- **False positives or review noise:** none retained.
- **Known misses or escaped issues:** the Forge and other villagers remain generic placeholders; a hero directly north of the store can be fully occluded; production art is intentionally deferred.
- **Tool/context/cost/usage constraints:** the branch required a small `.gitignore` restack after PR #15; no shared gameplay file conflict remained.
- **Owner effort and decision:** Leo delegated review/merge; exact-head approval plus green CI completed the merge on 2026-07-29.
- **Role-routing implication:** Claude's default implementation seat is supported for bounded engine slices with strong automated and visual evidence.
- **Counts toward five-task trigger:** yes — merged, independently useful engine slice.

## Reassessment trigger

Reassess the charter when either condition is met:

- five material tasks are recorded as complete; or
- Trials A, B, and C are all complete.

Reassess sooner only when model capabilities, tooling, cost, availability, or repository architecture changes materially. A reassessment should use this evidence without erasing dissent or treating one successful task as proof of universal superiority.
