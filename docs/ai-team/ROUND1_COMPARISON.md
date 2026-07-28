# AI Team Role RFC — Round 1 Comparison

**Status:** Historical synthesis; owner decision recorded in `AI_TEAM_CHARTER.md`  
**Date:** 2026-07-28  
**Inputs:** Gemini, ChatGPT, Claude Code, and Kimi K3 initial proposals

## Owner decision

Leo approved the provisional matrix on 2026-07-28 with one clarification:

> Claude Code and ChatGPT may exchange or share planning and implementation leadership depending on the task. ChatGPT remains the standing visual-direction lead.

The operative allocation is now [`AI_TEAM_CHARTER.md`](AI_TEAM_CHARTER.md). This comparison remains the evidence and dissent record; where wording differs, the owner-approved charter governs.

## Purpose

This document compares the four initial proposals without erasing dissent. It distinguishes decisions supported by repository evidence from assignments that remain provisional or untested.

No role, gate, approval power, or merge authority was created by this comparison alone.

## Proposal evidence quality

| Proposal | Repository access during review | Strongest evidence | Material limitations |
| --- | --- | --- | --- |
| Gemini | Contextual advisory / GitHub review context | Correctly identified the single-file/offline architecture and Claude's execution advantage | Initial allocation preceded the shared rubric; overconcentrated architecture duties; understated ChatGPT; asserted Kimi role without trials; referenced a nonexistent `ART_PROMPTS.md` |
| ChatGPT | Direct GitHub read/write tools plus image generation and local analysis | Verified repository identity and active test command; demonstrated current GitHub and visual-production capabilities; supplied proportional workflow and authority boundaries | Self-allocation is broad; engine-scale implementation in this repository remains less demonstrated than Claude's |
| Claude Code | Full clone, shell, git, tests, browser/image inspection, PR tooling | Inspected history, workflows, tests, evidence, North Star image, and attributed repository work; identified README/CI drift and public-repo privacy risk | Naturally weights repository-committed work more heavily than owner-facing design/synthesis work that may occur outside commit history; its own implementation record is extensive but not yet comparatively tested |
| Kimi K3 | Web UI and URL fetching only | Candidly labelled tool limitations; produced a useful cross-review; identified cost, context, save, device, and continuity concerns | Could not inspect the North Star image, `package.json`, or CI; repeated some stale README claims; cited conversation history and prior work not independently verifiable from this repository; output required transcription from Markmap SVG |

## Strong consensus

All four proposals substantially support these positions:

1. **Leo remains Game Director and final authority.** Product priority, material architecture changes, North Star approval, engagement/learning tradeoffs, and undelegated merges remain owner decisions.
2. **Claude Code is a strong default implementation and Git seat.** Its primary strengths are scoped repository changes, tests, debugging, evidence, and PR preparation.
3. **Gemini is useful as a non-blocking reviewer/challenger.** The strongest evidence supports its already-implemented standing PR review rather than exclusive architecture ownership.
4. **ChatGPT owns an important visual-production role.** North Star generation, visual concepting, asset prompts, and visual/gameplay integration are supported by repository process and prior delivered work.
5. **No agent should approve its own material work alone.** Tests do not replace independent visual, gameplay, architecture, or acceptance judgment.
6. **Workflow should scale with risk.** Small fixes should not require four-agent ceremony; cross-cutting changes should retain plans, tests, evidence, and non-author review.
7. **Current architecture is an owner-protected guardrail, not an immutable law.** Single-file, offline-first, sacred world space, and touch-first behavior remain binding unless Leo explicitly changes them.
8. **Standing titles grant no authority.** Tool access, approval gates, review status, and merge power remain explicit and task-specific.
9. **Kimi's proposed specialist role is provisional.** No proposal supplies comparative repository evidence proving superior logic, economy, migration, or long-context review.
10. **The charter must be revisited.** Models, tool access, cost, and observed performance can change.

## Material disagreements

### 1. How broad ChatGPT's standing role should be

- **Gemini:** primarily art direction, prompts, UI concepts, and lore.
- **ChatGPT:** product/game-design integration, visual direction, gameplay/UX/pedagogy, synthesis, review, and backup implementation.
- **Claude:** strongest current repository evidence is North Star generation and the crop asset lab; broader product and engine roles should expand through trials.
- **Kimi:** supports ChatGPT as visual and product/game-design primary, with implementation and architecture as secondary or partner duties.

**Assessment:** Gemini's role was clearly too narrow. The owner resolved the remaining implementation question by approving Claude–ChatGPT interchangeability for planning and implementation according to task fit, while retaining ChatGPT's standing visual-direction lead.

### 2. Whether one agent should be the standing architect

- **Gemini:** Gemini as Architect & System Auditor.
- **ChatGPT:** architecture should be task-specific among Claude, Gemini, and ChatGPT, with a non-author reviewer.
- **Claude:** repository evidence currently favors Claude for specs tied closely to implementation, but leadership should still be task-specific.
- **Kimi:** no permanent lead-architect title; task-specific leadership.

**Assessment:** There is enough consensus to reject a permanent exclusive architect. Material plans should be led by the agent closest to the task and reviewed by a complementary non-author.

### 3. Kimi's initial standing assignment

- **Gemini:** Logic & Deep-Context Verifier.
- **ChatGPT:** provisional logic/economy/migration reviewer.
- **Claude:** no standing responsibility until Kimi passes a grounding or comparative trial.
- **Kimi:** proposes provisional economy/migration and large-file audit duties while acknowledging they are untested.

**Assessment:** Kimi's proposal demonstrates useful structured review and appropriate uncertainty, so it passes a basic participation/grounding threshold. It does not prove superiority. Kimi remains an on-request provisional reviewer until real work supplies comparative evidence.

### 4. Default reviewer volume

- Gemini's initial workflow implies recurring involvement by multiple agents.
- ChatGPT and Kimi recommend proportional review.
- Claude explicitly caps the normal path at Gemini's automatic advisory comment plus at most one additional risk-justified reviewer.

**Assessment:** Claude's cap is the most practical default. More review is not automatically safer when it creates owner triage noise.

### 5. ChatGPT as implementation lead or backup

- ChatGPT and Kimi support implementation responsibility.
- Claude supports it provisionally, noting that the crop asset lab is demonstrated but engine-wide `index.html` implementation is not yet demonstrated at Claude's scale.
- Gemini did not allocate implementation to ChatGPT.

**Assessment:** The owner approved task-dependent interchangeability rather than a permanent lead/backup hierarchy. Claude remains the default implementation seat because of its normal execution environment, but ChatGPT may lead or share implementation when suitably equipped. A bounded engine-delivery trial will inform future routing rather than gate the approved rule.

## Verified factual corrections

1. The exact repository is `Galashots/eldoria`, not `eldoria-main`.
2. `npm test` runs:
   - `npm run assets:build`
   - `node tools/smoke-test.mjs`
   - `node tools/iso-test.mjs`
3. `.github/workflows/ci.yml` runs `npm test` and uploads playtest evidence. It does not currently run a Lighthouse audit or the README-described Node DOM-stub gameplay suite.
4. `ART_PROMPTS.md` is not an established current source of truth.
5. The Game Director's authority is not dependent on being described as coding or non-coding.
6. Kimi's North Star alignment was based on text only because it could not inspect the image.

The README/CI mismatch and missing `PROGRESS.md` reference are real repository-maintenance findings, but they should be corrected in a separate focused PR rather than mixed into the role RFC.

## Approved role direction

The full operative table is in `AI_TEAM_CHARTER.md`. Its core decisions are:

- Leo retains final authority.
- Claude and ChatGPT may exchange or share planning and implementation leadership according to task fit; Claude is the default implementation seat, not the exclusive implementer.
- ChatGPT remains the standing visual-direction and product/game-design integration lead.
- Gemini remains the standing non-blocking PR reviewer and challenger, not exclusive architect.
- Kimi remains an on-request provisional specialist reviewer.
- Default review is Gemini plus at most one additional risk-justified reviewer.
- Material work requires non-author review; titles grant no automatic authority.

## Minimal real-work trials

Do not pause development for artificial benchmarks. Use the next suitable real tasks.

### Trial A — reviewer signal

On the next medium-risk functional PR:

- retain Gemini's automatic review;
- ask ChatGPT and Kimi to independently review the exact same head SHA and evidence;
- score material findings, false positives, missed risks, actionable specificity, and owner triage time.

**Decision affected:** future reviewer routing and whether Kimi or ChatGPT should be added more often.

### Trial B — ChatGPT bounded engine delivery

Assign ChatGPT one real, tightly bounded isometric Phase 2 slice that touches `index.html` but does not require a broad rewrite. Require exact scope, tests, runtime evidence, and independent review.

**Decision affected:** future distribution of implementation work between Claude and ChatGPT; it does not suspend the approved interchangeability rule.

### Trial C — Kimi logic/migration verification

Use the next real economy, save-compatibility, or migration decision. Give the same deterministic facts to Kimi, Claude, and ChatGPT without showing one another's answers. Compare calculations, edge cases, and test design.

**Decision affected:** whether Kimi receives a recurring economy/migration specialist assignment.

A separate planning bake-off is not recommended now. Architecture remains task-specific unless real work shows that this causes inconsistency or delay.

## Remaining process

1. **Complete:** Leo approved the provisional matrix with the Claude–ChatGPT interchangeability clarification.
2. **Complete:** Record the owner-approved working allocation in `AI_TEAM_CHARTER.md`.
3. Run Trials A–C through normal project work.
4. Ask each agent for a short final response after trial evidence exists—not another full proposal.
5. Reassess the charter after the trials or five material tasks, whichever comes first.

## North Star alignment

**Aligned.** This comparison is documentation-only, preserves the owner-approved North Star and its supersession protocol, and does not change any visible game direction.
