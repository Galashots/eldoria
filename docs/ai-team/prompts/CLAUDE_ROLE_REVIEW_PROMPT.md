# Prompt for Claude Code: Independent AI Team Role Proposal

Copy the prompt below into Claude Code while its working directory is a clean clone of `Galashots/eldoria`.

---

You are participating in a documentation-only AI team role RFC for `Galashots/eldoria`.

Your task is to inspect the repository, independently assess how Claude Code, Gemini, ChatGPT, and Kimi K3 should be used on this project, cross-review the existing Gemini and ChatGPT proposals, and add your own attributed proposal to the RFC branch.

## Authority and scope

You are authorized to:

- fetch and check out the existing branch `docs/ai-team-role-rfc`;
- inspect repository files, history, and relevant prior work;
- create exactly one new proposal file:
  `docs/ai-team/proposals/2026-07-28-claude-initial.md`;
- commit and push that file to the existing branch.

Do not:

- edit Gemini's or ChatGPT's proposal;
- edit the RFC process or template;
- change `AGENTS.md`, `CLAUDE.md`, gameplay, tests, assets, configuration, or any unrelated file;
- synthesize a final charter;
- open another PR, merge the existing PR, or grant any agent new authority;
- present general model reputation or vendor marketing as repository evidence.

## Required reading and visual check

1. Read `AGENTS.md` and `README.md` in full.
2. Read `docs/ai-team/README.md` and `docs/ai-team/ROLE_REVIEW_TEMPLATE.md`.
3. Because this is a repository-wide review, read `docs/VISUAL_NORTH_STAR.md` and actually inspect its linked image. Include the required brief **North Star alignment** result, even though this RFC makes no visual change.
4. Read the current isometric design source of truth at `docs/superpowers/specs/2026-07-27-isometric-conversion-design.md` and any other files needed to verify role claims.

## Review order

Complete the work in two genuine passes:

### Pass A — independent allocation

Before reading the Gemini and ChatGPT proposal files, form your own assessment of:

- the recurring work this repository requires;
- each agent's primary and secondary uses;
- work each agent should not own alone;
- owner-only and delegated authority;
- the smallest useful delivery and review workflow;
- fallback rules; and
- important claims that are observed, inferred, or untested.

Record notes for Pass A before opening the other proposals. Do not allow an existing title or allocation to become your default merely because it was written first.

### Pass B — cross-review

Then read:

- `docs/ai-team/proposals/2026-07-28-gemini-initial.md`
- `docs/ai-team/proposals/2026-07-28-chatgpt-initial.md`

Identify agreements, disagreements, factual corrections, missing considerations, and only those practical trials that could change the role decision.

## Deliverable

Use every substantive section of `docs/ai-team/ROLE_REVIEW_TEMPLATE.md`. Write a candid proposal—not a diplomatic average. It is acceptable to argue for a larger or smaller Claude role, but distinguish:

- capabilities demonstrated in this repository;
- capabilities available because of Claude Code's execution environment;
- reasonable inference; and
- untested comparative claims.

For important domains, prefer a primary, backup, and independent reviewer where justified. Do not force all four agents into every task.

Before committing:

- verify that only your one proposal file changed;
- run `git diff --check`;
- do not run the full test suite for this documentation-only addition unless another repository rule clearly requires it.

Commit message:

`docs: add Claude AI team role proposal`

Push to:

`docs/ai-team-role-rfc`

At the end, report:

- the commit SHA;
- the one file changed;
- whether `git diff --check` passed;
- your North Star alignment result; and
- any blocker or uncertainty.

Stop after pushing. Do not synthesize or merge.
