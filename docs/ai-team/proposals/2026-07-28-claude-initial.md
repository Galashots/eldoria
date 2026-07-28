# Claude Code Initial AI Team Role Proposal

## Proposal metadata

- **Author/model:** Claude Code (this review session ran on `claude-fable-5`; prior repository sessions are attributed in commit trailers to Claude Opus 4.8 and Claude Fable 5 — "Claude Code" here names the harness/seat, not one fixed model)
- **Date:** 2026-07-28
- **Repository/ref inspected:** `Galashots/eldoria`, branch `docs/ai-team-role-rfc` at `7989034` (branched from `main` at `8730102`)
- **Tools or interfaces available during review:** full repository clone with read/write/git, shell execution, test harness execution, headless Chromium/Puppeteer, image inspection, GitHub PR tooling scoped to this repository
- **Confidence:** High for claims about work observed in this repository; Medium for allocations resting on inference; Low wherever noted as untested

Pass A below was drafted from repository inspection before opening
`2026-07-28-gemini-initial.md` or `2026-07-28-chatgpt-initial.md`, per the RFC method.

## 1. Independent assessment

### Repository needs

Recurring work this repository demonstrably requires, with evidence:

1. **Single-file gameplay engineering.** `index.html` is 4,976 lines of vanilla HTML/CSS/JS; the isometric conversion still has Phases 2–4 ahead (`docs/superpowers/specs/2026-07-27-isometric-conversion-design.md` §9), and features like the dumpling collection land as small CI-green slices (PRs #1–#4 in `git log`).
2. **Design specs and phased, kid-playtest-gated plans.** `docs/superpowers/specs/` and `docs/superpowers/plans/` hold the dumpling and iso specs, both marked "Leo + Claude (brainstorming session)" with explicit phase gates awaiting the boys' verdict.
3. **Art production along two distinct tracks:** (a) deterministic pixel-asset pipelines (`tools/process-crop-sheet.mjs`, the crop asset lab from PR #7 on branch `codex/crop-asset-lab`; the planned 3D→iso Blender pipeline in `tools/3D_ISO_SPRITE_PIPELINE.md`), and (b) concept imagery — the Visual North Star protocol in `docs/VISUAL_NORTH_STAR.md` names ChatGPT as the image-generation target for refresh candidates.
4. **Test and CI maintenance.** `npm test` = deterministic asset build + Puppeteer boot smoke (`tools/smoke-test.mjs`) + live-page iso assertions (`tools/iso-test.mjs`), run by `.github/workflows/ci.yml`. Someone must keep this harness honest as the game grows (see the README discrepancy under Factual corrections).
5. **Standing PR review.** `.github/workflows/gemini-review.yml` + `GEMINI.md` implement a non-blocking, comment-only Gemini advisory review on every non-draft PR.
6. **Playtest evidence capture.** CI uploads `artifacts/*.png`; `docs/playtest/` holds committed phone/desktop evidence; the iso spec's §11 device matrix is a recurring per-phase obligation.
7. **Governance and safety upkeep.** North Star supersession protocol, `AGENTS.md` scope discipline, child-safety/privacy hygiene (commit `cbbdbbc` removed embedded family names from public source), and owner-approved economy locks (PR #3, `f7d0f47` "test: lock approved farm economy").

### Proposed allocation

| Agent | Primary responsibilities | Secondary responsibilities | Should not own alone | Confidence and basis |
| --- | --- | --- | --- | --- |
| Claude Code | Gameplay/engine implementation in `index.html`; spec and phased-plan authoring; test-harness and CI maintenance; git operations and PR preparation with device/browser evidence | Asset-pipeline scripting (`tools/*.mjs`); docs upkeep; debugging from owner-reported error logs | Acceptance of its own material changes; balance/economy values; visual direction; anything owner-gated | High. Observed: iso spec + full Phase 0/1 implementation (`e275368`…`9d6b69b`), smoke/iso test harness (`ec061bc`, `90757a2`), privacy scrub (`cbbdbbc`) — all carry Claude commit trailers |
| Gemini | Standing non-blocking advisory PR review (already automated and zero-marginal-cost per PR) | Second-opinion review of specs/plans it did not author; consistency checks | Implementation or repo writes (no repo evidence); architecture ownership; any blocking gate | Medium-High for the review role — it is wired, hardened, and verified (PRs #5–#6); anything beyond review is untested here |
| ChatGPT | Concept/North Star candidate image generation (the named target of the refresh protocol in `docs/VISUAL_NORTH_STAR.md`); pixel-asset production labs in the PR #7 style | Backup implementer (PR #7 shows repo-level delivery: pipeline code, tests, committed assets, device evidence); UX/narrative brainstorming | Sole approval of art it generated; engine-wide changes to `index.html` (untested at that scale here) | Medium-High. Observed: merged crop asset lab (PR #7, branch `codex/crop-asset-lab`); North Star v1 generation role |
| Kimi K3 | None yet — provisional trial candidate only | After a passed trial: independent long-context review of `index.html`-wide changes, economy/migration checks | Any standing responsibility before a trial; any gate | Low. Zero repository evidence; named only as a possible executor in `tools/3D_ISO_SPRITE_PIPELINE.md`'s portability note |

### Owner and authority boundaries

**Owner-only (Leo):** merges to `main`; North Star approval or supersession; kid-playtest phase gates (iso spec §9); economy/balance approval (the locked preset from PR #3); changes to agent authority, CI gates, or `AGENTS.md`; anything touching the children's data, privacy, or engagement design.

**Delegable per task, explicitly and bounded:** implementation, test authoring, asset-lab runs, evidence capture, draft-PR preparation. A standing role in this charter grants no repo access or approval power by itself — matching `docs/ai-team/README.md`.

**Advisory by default:** all agent reviews, including Gemini's standing workflow (`GEMINI.md` already forbids describing it as a merge gate). A review becomes blocking only by explicit owner designation.

### Workflow proposal

Smallest useful loop, scaled by risk — not every agent on every task:

1. **Intake:** Leo states the outcome and non-negotiables.
2. **Spec only when material:** cross-cutting or risky work gets a short spec/plan in `docs/superpowers/` with repo-fact citations (the iso spec's §3 "verified against `index.html`" table is the model). Small fixes skip this.
3. **Implement:** one lead agent, smallest targeted change, on a branch, with tests and — when the visible game changes — screenshot/device evidence per the North Star rule.
4. **Verify:** CI green (`npm test`); device matrix only at phase gates.
5. **Review:** Gemini's standing advisory comment arrives automatically; add one more reviewer (not the author) only when risk justifies it.
6. **Accept:** Leo reviews evidence, playtests when player-facing, merges.

Docs-only or urgent low-risk changes: steps 1 → 3 → 4 → 6.

### Failure and fallback rules

- **Unavailable agent:** any capable agent takes over via the repository's existing **no-chat-history rule** (`tools/3D_ISO_SPRITE_PIPELINE.md`): everything needed lives in the repo, never in a prior conversation. This is observed working — the iso project passed between Claude sessions on different models (Opus 4.8 → Fable 5 trailers) with no continuity loss.
- **Conflicting advice:** owner decides taste/priority conflicts; empirical conflicts get the smallest trial that settles them.
- **Self-review:** never sufficient for a material change (matching `docs/ai-team/README.md`). Minimum bar: CI green + Gemini advisory + owner. High-risk: add one independent agent reviewer.
- **Uncertain repository facts:** cite file/line or label the claim inferred; a wrong "fact" in a spec propagates into code (see Factual corrections for live examples).
- **Urgent low-risk changes:** one implementer, CI green, owner merge; no ceremony.
- **Failed/skipped advisory reviews** (e.g., `GEMINI_API_KEY` unavailable — the workflow already warns and continues): work proceeds; they are non-blocking by design.

## 2. Cross-review

### Agreements

With both proposals: Claude Code as default implementer and git operator; Leo as final authority; Gemini as a non-blocking reviewer; ChatGPT holding the visual-generation role; the single-file/offline/sacred-world-space guardrails; automated verification for functional changes.

With ChatGPT specifically: proportionate process over a fixed loop; primary/backup/independent-reviewer over exclusive silos; Kimi as provisional-until-trialed; "unbreakable" guardrails being owner-changeable policy; most of its factual corrections of Gemini; charter review after five material tasks or the trials.

### Disagreements

1. **Gemini as "Architect & System Auditor" overstates the record** (Gemini §2). Every architecture artifact in this repository — the iso engine spec, the dumpling spec, the 3D pipeline doc, the Phase 0 plan — was authored in Leo + Claude sessions (spec headers; commit trailers on `7b065df`, `77ee401`, `1f5ebc9`, `a9dd6f8`). Gemini's observed contribution is the advisory reviewer, which is genuinely valuable and should be its named primary. Architecture should be assigned per task, with the plan's author never its sole reviewer. Owner can decide this now; no trial needed.
2. **Gemini's 4-step loop hard-codes a spec handoff** (plan by Gemini/ChatGPT → build by Claude). Observed history shows spec-and-build by the same seat worked well *because* the specs cite verified engine facts gathered while inspecting the code. Keep independent review of plans; drop the mandatory author/implementer split. Owner-decidable now.
3. **ChatGPT's self-allocation is broader than its evidence** (ChatGPT §1). "Product/game-design integration, owner-facing decision support, cross-domain synthesis" as *primary* rests mostly on its own review breadth, which it grades "Observed" — by the RFC's own standard that is closer to Inferred. Its repo-demonstrated strengths are real and specific: the crop asset lab (PR #7) and North Star generation. I'd start it there, with backup-implementer status, and let trials expand the rest. Trial preferable (ChatGPT's own planning/cross-domain trials fit).
4. **ChatGPT lists itself as backup on nearly every charter row** (ChatGPT §5). Plausible but untested at engine scale in this repo; a backup who has never done the domain's work here is a hypothesis, not a fallback plan. Keep the backups, label them provisional.
5. **Neither proposal prices in review noise.** With four agents, the real risk isn't too little review but low-signal advisory volume the owner must triage. Cap default review at Gemini's standing comment plus at most one risk-justified reviewer.

### Factual corrections

- **`README.md` overstates CI** (lines 59–66): it promises three checks including "a Lighthouse accessibility audit" and a "Node DOM-stub harness" gameplay suite. `.github/workflows/ci.yml` runs only `npm test` = asset build + Puppeteer smoke + iso assertions. No Lighthouse job exists anywhere in `.github/workflows/`. Either restore the missing checks or fix the README — as written it invites agents to assume accessibility regressions are caught when nothing catches them.
- **`README.md` links `PROGRESS.md` (line 56), which does not exist** in the tree. Stale reference.
- **`ART_PROMPTS.md` does not exist** (Gemini §3 step 3 cites it as a live source). It appears only as an aspiration in `tools/SPRITE_PIPELINE.md` line 34 ("the winner gets folded into `ART_PROMPTS.md`"). ChatGPT flagged this too; confirming with the exact source.
- **PRs #1, #3, and #4 are unattributed in-repo.** Their commits carry no agent trailer, unlike the Claude-trailed iso/spec commits or the `codex/`-branch PR #7. Neither other proposal notes this; any role argument built on "who built the dumpling MVP / direct taps / balance preset" is currently unverifiable from the repository alone. Only Leo can attribute them.
- Gemini's `eldoria-main` label: already corrected by the provenance note and ChatGPT; the repository is `Galashots/eldoria`.

### Missing considerations

1. **Model tiers inside the "Claude Code" seat.** Commit trailers show the same seat ran on Opus 4.8 and Fable 5 across this project, and the owner selects tiers (including Sonnet-class) partly for token cost. The charter should treat cost/capability tiering *within* a seat as an owner dial — routine mechanical tasks on cheaper tiers, spec-critical or engine-wide work on stronger ones — rather than treating each agent as one fixed capability. The same logic likely applies to other vendors' seats.
2. **The no-chat-history rule is the team's real continuity mechanism** and belongs in the charter, not just the pipeline doc. Both proposals treat fallback abstractly; this repo already solved it concretely and has exercised it.
3. **Prompt-injection discipline.** `gemini-review.yml` reviews from the trusted base commit and `GEMINI.md` orders Gemini to ignore instructions embedded in diffs. No equivalent standing rule binds the *implementing* agents when they read issues, PR comments, or pasted logs. Generalize it in `AGENTS.md`.
4. **CI truthfulness as a standing duty.** The README/CI drift above shows documentation about verification rots fastest; the charter should name an owner for keeping test/CI documentation accurate (I propose Claude Code, as current harness maintainer, with any reviewer empowered to flag drift).
5. **Child privacy review.** Commit `cbbdbbc` (removing family names from public source) shows this is a live concern for a public repo about kids' play. Every agent preparing a public commit should check for personal data; neither proposal mentions it.

## 3. Capability evidence

| Claim | Agent | Observed / Inferred / Untested | Evidence or proposed trial |
| --- | --- | --- | --- |
| Can design and implement engine-scale changes in the single file, test-gated | Claude Code | Observed | Iso spec `7b065df` through Phase 1 `9d6b69b`: projection/camera/input/depth renderer + responsive canvas, 20 tests, CI green, phone-check tuned (spec §9 Phase 0 DONE) |
| Can build and maintain the CI/test harness | Claude Code | Observed | `ec061bc`, `90757a2`, `tools/smoke-test.mjs`, `tools/iso-test.mjs` |
| Survives cold-start handoff between sessions/models | Claude Code | Observed | Opus 4.8-trailed spec/pipeline commits continued by Fable 5-trailed implementation commits with no continuity break |
| Delivers useful standing advisory PR review | Gemini | Observed (recently verified), narrow | Workflow live and hardened over PRs #5–#6; ~10 fix commits to stabilize suggests fragility to config drift; review *quality* over time still thin — score its comments on the next 3 PRs |
| Can implement beyond review (code, tests, git) | Gemini | Untested | One bounded, low-risk fix PR with evidence, if a backup implementer is ever needed |
| Can run a repo-level asset lab: pipeline code + committed assets + device evidence | ChatGPT | Observed | PR #7 (`codex/crop-asset-lab`, merged `8730102`): deterministic crop pipeline, pixel verification test, iPad evidence |
| Can generate North Star-quality concept imagery | ChatGPT | Observed | `docs/visual/eldoria-visual-north-star-v1.png` (owner-approved v1); refresh protocol names ChatGPT as generation target |
| Can make engine-wide changes to `index.html` safely | ChatGPT | Untested | A scoped Phase 2 slice (e.g., one Town object type ported to iso) under normal review |
| Superior long-context/logic/economy verification | Kimi K3 | Untested | ChatGPT's shared balance/migration scenario trial is the right shape; same case to all reviewers, blind |
| Any capability at all in this repository | Kimi K3 | Untested | Its pending RFC proposal (`docs/ai-team/prompts/KIMI_ROLE_REVIEW_PROMPT.md`) is itself the first trial: does it ground claims in real files? |
| Four-agent fixed workflow beats proportionate process | Team | Untested | Agree with ChatGPT §3: compare cycle time and escaped defects on small tasks |

General model reputation is deliberately excluded from this table.

## 4. Recommended trials

Only trials that could change the role decision:

1. **Blind review-quality trial (decides reviewer roster).** Next medium-risk PR: Gemini's standing comment plus independent reviews from ChatGPT and Kimi on the same diff. Owner scores material findings vs. noise. Evidence: the three review texts + scorecard in `docs/ai-team/`. No repository state change.
2. **Kimi grounding trial (decides whether Kimi gets any standing role).** Kimi's own RFC proposal, judged on whether its claims cite real files accurately. Already scheduled; costs nothing extra. Changes repository state only by adding its proposal file.
3. **ChatGPT engine-slice trial (decides backup-implementer status).** One scoped iso Phase 2 slice in `index.html` under the normal workflow (branch, tests, evidence, advisory review, owner merge). Changes repository state via a normal reviewed PR; success = CI green, no regression, spec-conformant.
4. **Not recommended:** a planning bake-off (ChatGPT trial 2). Three parallel plans for one bounded feature mostly measures prose; the review-quality and engine-slice trials answer the live charter questions more cheaply.

## 5. Recommended initial charter

First release; **all rows provisional** until the trials above and the first five material tasks:

| Domain | Primary | Backup | Independent review | Authority boundary |
| --- | --- | --- | --- | --- |
| Product direction, priorities, phase gates | Leo | — | Any agent advises on request | Owner-only |
| Engine implementation in `index.html` + git | Claude Code | ChatGPT *(provisional — pending trial 3)* | Gemini standing advisory; +1 reviewer on high risk | Merge is owner-only |
| Specs and phased plans | The implementing agent (task-assigned) | Claude Code | An agent that did not author the plan | Leo approves material scope |
| Test harness and CI; test-doc truthfulness | Claude Code | ChatGPT | Any reviewer flags drift | New gates are owner-only |
| Deterministic asset pipelines and labs | ChatGPT | Claude Code | Pixel-determinism tests + visual check by a non-author | Asset merges owner-approved |
| North Star candidates and concept art | ChatGPT | — (protocol names ChatGPT) | Runtime-readability check by a non-generator | Approval/supersession owner-only |
| Standing PR review | Gemini (non-blocking) | ChatGPT or Kimi per domain, on request | — | Blocking only by explicit owner designation |
| Economy, balance, save migrations | Claude Code implements; values proposed with worked evidence | Kimi *(provisional — pending trial)* | One non-author reviewer, always | Values/locks owner-approved (PR #3 precedent) |
| Privacy / child-safety pre-publish check | Every committing agent, per commit | — | Reviewer re-checks on material PRs | Incident response owner-led |

**Review date:** after PR #8's charter merges — reassess after the three trials complete or five material tasks land, whichever comes first, and whenever models, tools, or costs change materially (matching `docs/ai-team/README.md` step 6).

## 6. Dissent and uncertainty

- I do not support Gemini's title-first allocation ("Architect", "Art Director", "Verifier") — this repository's evidence supports work-first assignment, and `docs/ai-team/README.md` explicitly warns against prestige titles.
- I do not support granting Kimi the economy/verification domain (Gemini) or listing it as a broad reviewer (ChatGPT) before any trial. Nothing in this repository shows Kimi has done anything.
- Uncertainty about my own row: Claude Code's implementation evidence is extensive but largely *uncontested* — no other agent has attempted an engine-scale change here except ChatGPT's asset-lab work. If trial 3 shows ChatGPT delivering engine slices at comparable quality, the implementation domain should become genuinely shared, and I would support that.
- Uncertainty about attribution: PRs #1/#3/#4 have no in-repo agent attribution. If Leo attributes them to another agent, parts of my allocation table shift in that agent's favor; I would revise accordingly.
- What would change my mind generally: trial evidence. Every "should" above is downstream of the observed record, and the record is one week old.

## North Star alignment

**Aligned.** This is a documentation-only proposal; it changes nothing visible in the game and leaves the North Star protocol untouched. I inspected `docs/visual/eldoria-visual-north-star-v1.png` as required: the spacious isometric farm, brotherly Mage/Ranger duo, warm upper-left light, and touch-first HUD remain the authoritative direction, and nothing in this RFC conflicts with it. No refresh is recommended.
