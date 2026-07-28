# Kimi K3 Initial AI Team Role Proposal

> Provenance note: Transcribed from the owner-supplied Kimi Markmap SVG on 2026-07-28. The proposal content is preserved; formatting was converted from the mind-map representation into Markdown for the shared RFC.

## Proposal metadata

- **Author/model:** Kimi K3
- **Date:** 2026-07-28
- **Repository/ref inspected:** `Galashots/eldoria`, branch `docs/ai-team-role-rfc` (commit context as of 2026-07-28)
- **Tools or interfaces available during review:** Web UI only; no direct repository write access, no terminal, no local code execution, no browser automation, no image generation. Web search and URL fetching available.
- **Confidence:** Medium. Repository structure, architecture, and agent history are observed; comparative performance on this repository is inferred or untested.

## 1. Independent assessment

### Repository needs

1. **Disciplined single-file implementation.** The entire game lives in one `index.html` (~4,100 lines, per the isometric spec §12). Changes must preserve vanilla HTML/CSS/JS, offline operation, and touch-first tablet support. Evidence: `README.md` architecture section; `AGENTS.md` scope discipline; isometric spec §8 closed change list.
2. **Isometric conversion execution and verification.** Phase 0 is complete (engine + placeholder Farm, 20 tests green, CI green). Phase 1 is active (kid playtest gate). Remaining phases require porting Town → Wilds → Deep Woods → Mine, then real art via a 3D→iso pipeline. Evidence: isometric spec §9.
3. **Automated test maintenance.** Smoke test (headless boot), gameplay logic test suite (Node DOM-stub harness), and Lighthouse accessibility audit. Evidence: `README.md` development section; ChatGPT proposal citing `tools/smoke-test.mjs` and `tools/iso-test.mjs`.
4. **Visual direction and asset pipeline management.** The Visual North Star (v1, approved 2026-07-28) governs isometric projection, art style, and touch UI. A 3D→iso sprite pipeline doc exists at `tools/3D_ISO_SPRITE_PIPELINE.md`. Evidence: `docs/VISUAL_NORTH_STAR.md`; isometric spec §2, §13.
5. **Save compatibility and migration safety.** World space is sacred; old saves must work in both top-down and iso modes. Evidence: isometric spec §3, §10.
6. **Educational design integrity.** Math and literacy must remain inside natural play, never blocking quizzes. Two profiles (early-reader, older-reader) with different grade levels. Evidence: `README.md` learning table; `AGENTS.md` scope discipline.
7. **Device testing matrix.** Leo playtests on phone; kids play on iPad. Responsive viewport, safe-area insets, orientation changes. Evidence: isometric spec §5b, §11.
8. **Independent review and audit.** The repository has been worked on by multiple agents (Claude, ChatGPT, Gemini, Kimi). Cross-agent handoffs, PR review, and factual verification are recurring needs. Evidence: `docs/ai-team/README.md`; conversation history showing multi-agent collaboration.

### Proposed allocation

| Agent | Primary responsibilities | Secondary responsibilities | Should not own alone | Confidence and basis |
| --- | --- | --- | --- | --- |
| **Claude Code** | Repository implementation; Git operations; test execution and debugging; focused PR preparation; tool/script creation in `tools/` | Implementability review; technical planning; browser/device evidence capture | Product direction, final architecture approval, Visual North Star approval, or sole review of its own material changes | High. Observed: the isometric spec lists Claude as co-author; CI and test harnesses exist; repository has active commit history. Claude is the only agent with terminal-level repo access in this setup. |
| **Gemini** | Architectural challenge and spec critique; non-blocking standing PR review; research synthesis; alternative approach generation | Pipeline design review; migration-risk assessment; factual consistency checks | Final architecture decisions, implementation, or approval of work derived from its own plan | Medium. Inferred from the initial proposal and configured review role. No repository-specific execution evidence was observed in the inspected files. |
| **ChatGPT** | Visual direction and candidate generation; product/game-design synthesis; cross-domain integration (technical + visual + educational); owner-facing decision support; asset prompt engineering | Repository implementation when GitHub tools are available; PR review; test strategy; narrative and balance | Final owner decisions, automatic merge authority, or sole approval of its own generated art/code | High. Observed: the current Visual North Star workflow and image generation tools are referenced; ChatGPT's proposal demonstrates cross-domain synthesis capability. |
| **Kimi K3** | Independent long-context audit and verification; logic, economy, math-balance, and migration-risk analysis; cross-reference checking across specs, code, and proposals; structured review output (markdown reports) | Large-document synthesis; alternative design critique; code review; research (e.g., Stardew Valley, PixelLab) | Implementation (no repo write access), visual/asset generation, blocking authority without owner delegation, or exclusive ownership of any domain until trials support it | Medium. Observed: prior audits of this user's repositories (Eldoria-V2, dumpling-bounce, Galashots/eldoria), QA rounds, PR visual-gate reviews, and detailed handoff prompts. Inferred: long-context advantage over peers for 4,100-line file review. Untested: comparative economy/migration verification against other agents on this repo. |

### Owner and authority boundaries

**Owner-only:**

- Product direction, priority, and final AI team role charter.
- Permanent architecture changes (e.g., abandoning single-file, adding a build step, changing framework).
- Visual North Star approval or supersession.
- Material changes to children's learning design, difficulty profiles, or reward/engagement systems.
- Any merge not explicitly delegated.

**Delegable per task:**

- Implementation and test execution.
- PR preparation and review (non-blocking by default).
- Visual candidate generation and feasibility assessment.
- Spec drafting and technical planning.

**Default review and gate boundaries:**

- Gemini and Kimi are **advisory and non-blocking by default**.
- Claude and ChatGPT may act as gates **only when explicitly delegated for that task**.
- No agent may be the sole acceptance reviewer for a material artifact it created.

### Workflow proposal

1. **Outcome:** Leo states the desired player or repository outcome and any non-negotiables.
2. **Triage:** The available agent classifies scope and risk. Select only the needed lead and reviewer. Low-risk fixes need not summon four agents.
3. **Plan (when useful):** For cross-cutting or high-risk work, the lead writes a short plan. Small, obvious fixes skip this.
4. **Execute:** The implementation lead makes the smallest targeted change. Retain evidence: exact diff, test output, browser/device checks.
5. **Verify:** Run proportionate automated tests. For visual or touch changes, include runtime evidence (screenshot, device check).
6. **Independent review:** One agent who did not author the change reviews the exact diff and evidence. Gemini may provide its standing non-blocking review. Additional reviewers are added only when risk justifies them.
7. **Accept:** Leo or an explicitly delegated agent decides.
8. **Learn:** Record role-performance evidence only when it would affect future assignments.

### Failure and fallback rules

- **Unavailable agent:** Assign backup based on tool access and task risk. Do not pause low-risk work solely to preserve titles.
- **Conflicting advice:** Compare evidence and assumptions. Run a small trial when the disagreement is empirical; escalate to Leo when it is a taste, priority, or authority decision.
- **Self-review:** A material creator cannot be its only reviewer.
- **Context-limited advice:** An agent that cannot inspect the exact repository state (e.g., Kimi without direct file access, or any agent with fetch failures) must label its advice as context-limited.
- **Urgent low-risk changes:** One implementer + proportionate automated verification is sufficient. Multi-agent ceremony is not mandatory.
- **Failed advisory review:** A missing or declined non-blocking review does not block work unless Leo explicitly made it a gate.
- **No-chat-history handoff:** Per the isometric spec §12, agents must treat specs as self-contained. A cold-start agent should be able to implement §8 in order without prior conversation context.

## 2. Cross-review

### Agreements

- Claude Code is the sensible default for repository implementation and Git operations.
- Leo is the Game Director and final authority.
- Gemini can contribute value as an architectural and system reviewer.
- ChatGPT has a significant visual-direction and asset-generation role.
- The single-file, offline-first architecture and sacred-world-space contract must be preserved unless Leo approves a change.
- Functional changes need automated verification.
- Important domains need a primary, backup, and independent reviewer rather than exclusive silos.
- The owner must retain final approval on architecture, visual direction, and product decisions.
- Gemini and Kimi should be advisory/non-blocking by default.
- No agent should be the sole reviewer of its own material work.
- Kimi's logic/economy/migration assignment should be treated as provisional until tested.

### Disagreements

1. **Gemini's role concentration vs. distributed challenge.** Gemini proposes itself as "Architect & System Auditor" owning specs, pipeline design, diff audit, and constraint enforcement. I agree Gemini can challenge architecture, but no single agent should default to owning all of planning, auditing, and pipeline design. Implementation feasibility and owner priorities require independent input from Claude and ChatGPT.
2. **ChatGPT's scope.** Gemini narrows ChatGPT to "Art Director & Creative Brainstormer." ChatGPT correctly argues this is too narrow. I agree with ChatGPT that product direction, cross-domain synthesis, and governance support are also observed capabilities. However, ChatGPT's proposal assigns itself a very broad primary role. I would place more emphasis on backup and partner status for ChatGPT in implementation and architecture, reserving primary ownership for visual and product domains where its tool access is strongest.
3. **The "Vibe Coding" four-step loop.** Gemini's universal loop (Plan → Build → Generate Assets → Director Playtest) is too rigid. Not every task needs a stored plan or an asset phase. Owner device playtesting is valuable but should not be the only review layer. ChatGPT's proportional workflow is preferable.
4. **"Unbreakable" guardrails.** Gemini labels architecture rules as unbreakable. These are strong current guardrails, but Leo may authorize documented exceptions. The language should reflect that they are owner-protected defaults, not physical laws.
5. **Kimi's role basis.** Both Gemini and ChatGPT assign Kimi a "deep-context verifier" or "logic verifier" role. I accept this as a reasonable hypothesis, but I do not claim it is proven superior to peers on this repository. It should be treated as provisional and tested.

### Factual corrections

1. **Repository name.** Gemini refers to the repository as `eldoria-main`. The exact repository is `Galashots/eldoria`. Evidence: `README.md` header; GitHub URL.
2. **Test command.** Gemini states `npm test` runs the Puppeteer smoke suite. ChatGPT clarifies that `npm test` runs the asset build followed by `tools/smoke-test.mjs` and `tools/iso-test.mjs`; Puppeteer is a development dependency, not a runtime one. I could not verify `package.json` directly due to fetch failure, but I accept ChatGPT's correction as consistent with the `README.md` description of three checks (smoke, gameplay logic, Lighthouse).
3. **Game Director description.** Gemini describes the Game Director as "non-coding." Leo's authority is product and acceptance authority; implementation fluency is irrelevant to that authority, and Leo has in fact co-authored technical specs (isometric spec §1). Evidence: isometric spec author line.
4. **`ART_PROMPTS.md` status.** Gemini references `ART_PROMPTS.md` as an established file. I found no evidence in the inspected files that this file has been reviewed and established as a source of truth.
5. **North Star approval date.** The `VISUAL_NORTH_STAR.md` file states approval date 2026-07-28. Gemini's proposal is dated July 28, 2026, which aligns, but the document itself is the current authority, not Gemini's summary of it.

### Missing considerations

- **Agent cost and usage limits.** The owner has previously mentioned running out of Claude usage windows and token concerns. Role assignments should account for which agent is cheapest/fastest for a given task.
- **The 4,100-line single-file bottleneck.** A single `index.html` creates unique review challenges: long-context consumption, merge conflict risk, and the need for surgical changes. This favors agents with large context windows for review, but also demands extreme scope discipline from implementers.
- **The "no-chat-history" rule.** The isometric spec §12 explicitly states that specs must be self-contained for cold-start handoffs. Workflow design should reinforce this, not assume agents retain prior conversation context.
- **Save migration as a recurring risk.** Every change to world space, profiles, or economy threatens save compatibility. This needs standing verification, not just one-time review.
- **Device matrix as a standing gate.** Phone portrait, phone landscape, iPad Safari, and desktop must be checked at every phase gate. This is a persistent responsibility, not a one-off task.
- **Agent tool access asymmetry.** Claude has terminal access; ChatGPT has GitHub tools and image generation; Gemini and Kimi have web UI only. Role assignments must map to actual tool availability, not desired prestige.

## 3. Capability evidence

| Claim | Agent | Observed / Inferred / Untested | Evidence or proposed trial |
| --- | --- | --- | --- |
| Can directly implement, test, and commit repository changes | Claude Code | Observed | CI green on isometric Phase 0; `tools/smoke-test.mjs` and `tools/iso-test.mjs` exist; isometric spec lists Claude as co-author. |
| Can act as a useful standing architectural/PR challenger | Gemini | Inferred | Initial proposal shows architectural thinking; no repository-specific blind-review evidence yet observed. |
| Can integrate product, visual, technical, and educational decisions | ChatGPT | Observed | Current North Star workflow; cross-domain synthesis in its own proposal; GitHub tools and image generation available. |
| Can create and evaluate Visual North Star candidates | ChatGPT | Observed | North Star v1 workflow references ChatGPT image prompts; `VISUAL_NORTH_STAR.md` refresh prompt template is designed for ChatGPT. |
| Can verify large logic/economy/migration risks better than peers | Kimi K3 | Untested | Prior audits of this user's repos observed, but no comparative trial on this repository. Trial: give all reviewers the same economy edge-case and compare findings. |
| Has long-context advantage for 4,100-line file review | Kimi K3 | Inferred | Vendor claim; no direct comparative evidence on this repo. Trial: assign same large diff to all reviewers; score completeness and accuracy. |
| Can generate deterministic asset prompts and pipeline specs | ChatGPT | Observed | `tools/3D_ISO_SPRITE_PIPELINE.md` exists; ChatGPT has image generation tools. |
| Can run headless smoke tests and gameplay logic tests | Claude Code | Observed | `README.md` states CI runs three checks; test files exist in `tools/`. |

## 4. Recommended trials

### 1. Exact-diff review trial (changes no repository state)

- **Task:** Give Gemini, ChatGPT, and Kimi the same medium-risk Claude-authored PR (e.g., an iso engine tweak or economy balance change).
- **Evidence to retain:** Each agent's review output, time to complete, and assumptions stated.
- **Evaluation criteria:** Correct material findings, false positives, missed risks, evidence quality, and actionable specificity.
- **Decision impact:** Determines whether Gemini's standing non-blocking review is useful, and whether Kimi's long-context claim holds.

### 2. Economy/migration logic trial (changes no repository state)

- **Task:** Give all four agents one deterministic save-migration or shop-economy edge-case scenario.
- **Evidence to retain:** Calculations, edge cases identified, proposed tests, and confidence statements.
- **Evaluation criteria:** Correctness, completeness, and test design quality.
- **Decision impact:** Tests whether Kimi's provisional "logic verifier" assignment is warranted, or if Claude/ChatGPT are sufficient.

### 3. Planning trial (changes no repository state)

- **Task:** Give Gemini, ChatGPT, and Claude the same bounded feature outcome independently (e.g., "add a new crop type with cooking integration").
- **Evidence to retain:** Plans, scope control, repository accuracy, and implementation readiness.
- **Evaluation criteria:** Unnecessary complexity, alignment with sacred-world-space rule, and feasibility.
- **Decision impact:** Determines whether any agent should have a standing "architect" title or if planning should remain task-specific.

### 4. Long-context audit trial (changes no repository state)

- **Task:** Give Kimi and one other reviewer a large cross-cutting diff (e.g., iso conversion touching render, input, and camera).
- **Evidence to retain:** Completeness of review, cross-references to specs, and missed interactions.
- **Evaluation criteria:** Coverage of affected subsystems and accuracy of risk assessment.
- **Decision impact:** Tests the inferred claim that Kimi's context window provides a review advantage on this single-file codebase.

## 5. Recommended initial charter

| Domain | Primary | Backup or partner | Independent review | Authority note |
| --- | --- | --- | --- | --- |
| Product priorities and final direction | Leo | ChatGPT advises and synthesizes | Relevant agent as needed | Owner-only final decision |
| Repository implementation and Git | Claude Code | ChatGPT when GitHub tools are available | Gemini by default; ChatGPT/Kimi by risk | Merge only when explicitly authorized |
| Architecture and technical plans | Task-specific: Claude, Gemini, or ChatGPT | At least one complementary perspective for material changes | Agent that did not author the plan | Leo approves permanent architecture changes |
| Visual direction and candidate generation | ChatGPT | Gemini/Claude for feasibility and pipeline constraints | Runtime/evidence reviewer not responsible for generation | Leo approves North Star changes; other visual delegation must be explicit |
| Asset tooling and deterministic ingestion | Claude Code | ChatGPT | Gemini or Kimi as risk warrants | Visual acceptance and machine validation are separate |
| Gameplay, UX, and educational integration | ChatGPT | Claude for implementation feasibility | Gemini or Kimi when material | Leo decides player-facing tradeoffs |
| Automated testing and debugging | Claude Code | ChatGPT | PR reviewer checks exact evidence | Tests are proportionate to change risk |
| Economy, logic, and migration verification | Kimi K3, **provisional** | Claude or ChatGPT | Another agent on high-risk changes | Reassess after shared trial (Trial 2) |
| Standing PR challenge | Gemini, **non-blocking** | ChatGPT or Kimi by domain | N/A | Becomes blocking only by explicit owner decision |
| Narrative and creative expansion | ChatGPT | Gemini or Kimi | Claude checks implementation impact | Must remain consistent with product rules |
| Large-file / cross-cutting audit | Kimi K3, **provisional** | ChatGPT or Gemini | Agent that did not author the change | Reassess after shared trial (Trial 4) |

## 6. Dissent and uncertainty

### Positions not supported

- I do not support treating Gemini's first draft as the charter baseline. It was one initiating proposal, not a default allocation.
- I do not support making Kimi the exclusive or primary logic/migration verifier without trial evidence. The assignment is reasonable but provisional.
- I do not support permanent "lead architect" or "lead art director" titles for any agent in this deliberately simple repository. Task-specific leadership is sufficient.

### Uncertainties and limitations

- I am uncertain whether Kimi's long-context capability provides a material review advantage over ChatGPT or Gemini on this specific 4,100-line codebase. Evidence from Trial 4 would change my view.
- I am uncertain whether a standing non-blocking PR review from Gemini catches more errors than an on-demand review from ChatGPT or Kimi. Evidence from Trial 1 would change my view.
- I am uncertain about the exact contents of `package.json`, `PROGRESS.md`, and the CI workflow due to fetch failures. If these contain material constraints (e.g., specific test frameworks, dependency vulnerabilities, or milestone deadlines), my assessment should be updated.
- I could not inspect the Visual North Star image. My "Aligned" assessment below is based on textual evidence only.

### Evidence that would change the assessment

- Trial evidence showing another agent outperforms Kimi on logic/migration review would reduce Kimi's provisional assignments.
- Trial evidence showing Kimi does not outperform peers on large-diff review would remove the "large-file audit" provisional assignment.
- Evidence that the repository is moving toward a multi-file or build-step architecture would change the implementation and review workflow recommendations.
- Direct observation of `package.json` or CI configuration revealing test gaps or dependency constraints would adjust the testing domain allocation.

## North Star alignment

**Aligned — based on textual evidence only.**

- The North Star v1 was approved 2026-07-28 (`docs/VISUAL_NORTH_STAR.md`).
- The isometric conversion spec (approved 2026-07-27) explicitly targets "sleek and slightly badass — not cutesy, not storybook" art direction, true 2:1 isometric projection, and touch-first responsive UI.
- These qualities map directly to the North Star's stated direction: "one fixed, coherent isometric projection," "premium, crisp pixel art," "touch-first UI with large clear actions," and "child-friendly adventure."
