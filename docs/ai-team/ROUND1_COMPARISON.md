# AI Team Role RFC — Round 1 Comparison

**Status:** Neutral synthesis of initial proposals; not a final charter  
**Date:** 2026-07-28  
**Inputs:** Gemini, ChatGPT, Claude Code, and Kimi K3 initial proposals

## Purpose

This document compares the four initial proposals without erasing dissent. It distinguishes decisions supported by repository evidence from assignments that remain provisional or untested.

No role, gate, approval power, or merge authority is created by this comparison.

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
2. **Claude Code is the default implementation and Git seat.** Its primary responsibilities are scoped repository changes, tests, debugging, evidence, and PR preparation.
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
- **Claude:** strongest current evidence is North Star generation and the crop asset lab; broader product and engine roles should expand through trials.
- **Kimi:** supports ChatGPT as visual and product/game-design primary, with implementation and architecture as secondary/partner duties.

**Assessment:** Gemini's role is clearly too narrow. The repository supports ChatGPT as more than an art prompt seat. The unresolved question is not whether ChatGPT contributes beyond art, but whether it should be a standing primary or provisional partner in engine architecture and implementation.

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

**Assessment:** Kimi's proposal demonstrates useful structured review and appropriate uncertainty, so it passes a basic participation/grounding threshold. It does not prove superiority. Kimi should remain an on-request provisional reviewer until real work supplies comparative evidence.

### 4. Default reviewer volume

- Gemini's initial workflow implies recurring involvement by multiple agents.
- ChatGPT and Kimi recommend proportional review.
- Claude explicitly caps the normal path at Gemini's automatic advisory comment plus at most one additional risk-justified reviewer.

**Assessment:** Claude's cap is the most practical default. More review is not automatically safer when it creates owner triage noise.

### 5. ChatGPT as backup implementer

- ChatGPT and Kimi support it.
- Claude supports it only provisionally, noting that the crop asset lab is demonstrated but engine-wide `index.html` implementation is not yet demonstrated at Claude's scale.
- Gemini did not allocate implementation to ChatGPT.

**Assessment:** Keep ChatGPT as a provisional backup implementer and test the role through one real bounded engine slice rather than a synthetic exercise.

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

## Recommended provisional role matrix

This matrix reflects consensus while labelling contested assignments honestly.

| Domain | Primary | Partner / backup | Independent review | Status and authority |
| --- | --- | --- | --- | --- |
| Product priorities, phase gates, final direction | Leo | ChatGPT advises and synthesizes; others advise by domain | As requested | Owner-only final decision |
| Engine implementation, tests, Git, PR preparation | Claude Code | ChatGPT, provisional for bounded slices | Gemini standing advisory; add one domain reviewer for high risk | Merge only when explicitly authorized |
| Architecture and technical plans | Task-specific lead: normally implementing agent; Gemini or ChatGPT may lead research/design-heavy plans | Complementary agent | Non-author reviewer | Permanent architecture changes owner-approved |
| Visual North Star candidates and concept generation | ChatGPT | Claude/Gemini advise feasibility and pipeline constraints | Non-generator runtime/readability review | North Star approval owner-only |
| Product/game design, gameplay UX, educational integration | ChatGPT | Claude for implementation feasibility; Gemini/Kimi challenge by domain | Non-author reviewer when material | Player-facing tradeoffs owner-approved |
| Deterministic asset tooling and ingestion | Claude Code or ChatGPT, assigned by task | The other seat | Machine validation plus non-author visual review | Visual acceptance and deterministic validation remain separate |
| Standing PR challenge | Gemini, non-blocking | ChatGPT or Kimi on request | N/A | Blocking only by explicit owner designation |
| Economy, balance, save migration | Claude implements; ChatGPT/Kimi may analyze | Kimi provisional; ChatGPT | One non-author reviewer | Values and compatibility locks owner-approved |
| Large-file / cross-cutting audit | On-request reviewer selected by risk | Kimi provisional; ChatGPT/Gemini | Reviewer must not be author | No standing gate until evidence supports it |
| Privacy and child-safety pre-publish check | Every committing agent | Claude maintains technical hygiene; ChatGPT checks product/context risks | PR reviewer rechecks material changes | Owner handles incidents and policy decisions |
| CI/test documentation truthfulness | Claude Code | ChatGPT | Any reviewer may flag drift | New required gates owner-approved |

## Minimal real-work trials

Do not pause development for artificial benchmarks. Use the next suitable real tasks.

### Trial A — reviewer signal

On the next medium-risk functional PR:

- retain Gemini's automatic review;
- ask ChatGPT and Kimi to independently review the exact same head SHA and evidence;
- score material findings, false positives, missed risks, actionable specificity, and owner triage time.

**Decision affected:** whether Gemini remains the default standing reviewer and when Kimi or ChatGPT should be added.

### Trial B — ChatGPT bounded engine delivery

Assign ChatGPT one real, tightly bounded isometric Phase 2 slice that touches `index.html` but does not require a broad rewrite. Require exact scope, tests, runtime evidence, and independent review.

**Decision affected:** whether ChatGPT becomes an established rather than provisional backup implementer.

### Trial C — Kimi logic/migration verification

Use the next real economy, save-compatibility, or migration decision. Give the same deterministic facts to Kimi, Claude, and ChatGPT without showing one another's answers. Compare calculations, edge cases, and test design.

**Decision affected:** whether Kimi receives a recurring economy/migration specialist assignment.

A separate planning bake-off is not recommended now. Architecture can remain task-specific unless real work shows that this causes inconsistency or delay.

## Decisions Leo can make now

The following do not require further trials:

1. Reject Gemini's initial title-first allocation as the final charter.
2. Adopt proportional workflow rather than a mandatory four-agent loop.
3. Keep Claude as default implementer and Git operator.
4. Keep Gemini as standing non-blocking PR reviewer, not exclusive architect.
5. Recognize ChatGPT as a product/game-design and visual-production partner—not only an art prompt generator.
6. Keep Kimi advisory and provisional until comparative evidence exists.
7. Cap default review at Gemini plus at most one additional reviewer unless a task is exceptionally high risk.
8. Preserve explicit owner authority and no-self-approval rules.

## Remaining process

1. Leo accepts or edits the provisional matrix.
2. Record the provisional charter in a separate `AI_TEAM_CHARTER.md`.
3. Run Trials A–C through normal project work.
4. Ask each agent for a short final response after trial evidence exists—not another full proposal.
5. Revise and approve the final charter after the trials or five material tasks, whichever comes first.

## North Star alignment

**Aligned.** This comparison is documentation-only, preserves the owner-approved North Star and its supersession protocol, and does not change any visible game direction.
