# AI Team Role Trial Evidence

**Status:** Active evidence register  
**Charter:** [`AI_TEAM_CHARTER.md`](AI_TEAM_CHARTER.md)  
**Started:** 2026-07-28  
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

**Completed material tasks since charter approval: 0 / 5**

The open work below remains candidate evidence and must not be counted until it meets a counting rule.

## Charter trial status

| Trial | Status | Qualification rule | Current note |
| --- | --- | --- | --- |
| A — Reviewer signal | Not started | Gemini, ChatGPT, and Kimi independently review the same medium-risk functional PR head and evidence; retain findings, false positives, misses, actionable specificity, time/cost, and owner triage effort | Draft PRs have not yet supplied the required same-head three-reviewer comparison |
| B — ChatGPT bounded engine delivery | Not started | ChatGPT delivers a tightly bounded real engine slice affecting `index.html`, with tests, runtime evidence, and non-author review | Ranger PR #11 is relevant visual/asset-delivery evidence but is not the specified engine slice and must not be relabelled as Trial B |
| C — Kimi verification | Not started | Kimi, Claude, and ChatGPT receive the same deterministic economy, save, or migration facts; compare calculations, edge cases, and test design | No qualifying decision has been run |

## Candidate real-work evidence

These entries record coordination context only. They are not completed trial results.

| Work | Lead | Latest observed state at register creation | Potential evidence | Current disposition |
| --- | --- | --- | --- | --- |
| [PR #11 — Ranger character proof](https://github.com/Galashots/eldoria/pull/11) | ChatGPT | Draft; observed head `9261eb44d3c56d6b8ed68837e4ec5f019a11bece` | Visual production, deterministic asset tooling, exact-head CI, owner-gated iteration | In progress; does not satisfy Trial B because it is not an `index.html` engine slice |
| [PR #12 — first Town isometric slice](https://github.com/Galashots/eldoria/pull/12) | Claude Code | Draft; observed head `51421612d6fafefbc14faba014166b873380d205` | Engine delivery, test/runtime evidence, repository hygiene, exact-head reporting | In progress; possible baseline evidence for Claude's default implementation seat |
| [PR #13 — TRELLIS/Blender probe](https://github.com/Galashots/eldoria/pull/13) | Claude Code | Draft and paused; observed head `7f0768d83ca8d1cf99275354d8e4750ac3e47a5c` | Honest blocked-route decision, deterministic Blender rig, validator reuse, tool-access limits | Pending owner disposition; does not count while paused and unaccepted |

The observed heads above are snapshots, not permanent review targets. Replace them with the exact final reviewed or accepted SHAs when recording completed evidence.

## Completed evidence records

None yet.

When a task qualifies, add one record using this structure:

### Task N — Short name

- **Outcome:**
- **PR/branch:**
- **Exact accepted SHA:**
- **Lead agent/seat:**
- **Task classification:** engine / visual / asset pipeline / review / economy / save-migration / other
- **Charter trial:** A / B / C / none
- **Scope completed:**
- **Tests and machine evidence:**
- **Runtime or visual evidence:**
- **Non-author review:**
- **Correct material findings:**
- **False positives or review noise:**
- **Known misses or escaped issues:**
- **Tool/context/cost/usage constraints:**
- **Owner effort and decision:**
- **Role-routing implication:**
- **Counts toward five-task trigger:** yes / no, with reason

## Reassessment trigger

Reassess the charter when either condition is met:

- five material tasks are recorded as complete; or
- Trials A, B, and C are all complete.

Reassess sooner only when model capabilities, tooling, cost, availability, or repository architecture changes materially. A reassessment should use this evidence without erasing dissent or treating one successful task as proof of universal superiority.
