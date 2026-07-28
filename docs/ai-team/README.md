# AI Team Role RFC

**Status:** Provisional charter approved; real-work validation underway  
**Owner:** Leo Pinto, Game Director  
**Repository:** `Galashots/eldoria`  
**Opened:** 2026-07-28  
**Owner approval recorded:** 2026-07-28

## Current authority

The working role allocation is now defined in:

- [`AI_TEAM_CHARTER.md`](AI_TEAM_CHARTER.md)

The charter is owner-approved and operational. It remains provisional only in the sense that assignments will be reassessed against real project evidence. It does not reduce the owner's authority or grant automatic repository, approval, or merge rights.

The owner-approved clarification is explicit: **Claude Code and ChatGPT may exchange or share planning and implementation leadership according to the task, while ChatGPT remains the standing visual-direction lead.**

## Purpose of this folder

This folder preserves the evidence and reasoning used to establish the charter. Gemini's first draft initiated the discussion; it was treated as one proposal rather than the baseline or default allocation.

## Participants

- Claude Code
- Gemini
- ChatGPT
- Kimi K3

A role title does not grant repository access, approval authority, or merge authority. Tool access and owner authorization remain task-specific.

## Evaluation principles

- Assign work based on demonstrated capability, tool access, availability, cost, context, and task risk.
- Prefer complementary leads and independent review over exclusive silos.
- Separate standing responsibility from task-specific authority.
- Treat self-assessments and vendor claims as hypotheses until supported by repository work.
- No agent's self-review is sufficient for a material change it created.
- Advisory reviewers are non-blocking unless the owner explicitly designates a gate.
- The owner approves the charter and resolves unresolved disagreements.

## Round 1 artifacts

- `proposals/2026-07-28-gemini-initial.md`
- `proposals/2026-07-28-chatgpt-initial.md`
- `proposals/2026-07-28-claude-initial.md`
- `proposals/2026-07-28-kimi-initial.md`
- `ROUND1_COMPARISON.md`
- `ROLE_REVIEW_TEMPLATE.md`
- `prompts/CLAUDE_ROLE_REVIEW_PROMPT.md`
- `prompts/KIMI_ROLE_REVIEW_PROMPT.md`

These files are historical evidence and do not override the approved charter.

## Current validation plan

Use normal project work rather than artificial benchmark tasks:

1. Compare reviewer signal from Gemini, ChatGPT, and Kimi on the same medium-risk PR.
2. Give ChatGPT one bounded real engine-delivery slice with tests and independent review.
3. Compare Kimi, Claude, and ChatGPT on the next real economy, save, or migration decision.

Reassess the charter after these trials or five material tasks, whichever comes first, and whenever tools, models, costs, or availability change materially.

## Scope

This role process does not itself change gameplay, architecture, the Visual North Star, branch protection, reviewer settings, or merge rules. Those changes require their normal task-specific authority and review.
