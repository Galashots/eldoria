# AI Team Role RFC

**Status:** Draft evidence-gathering process  
**Owner:** Leo Pinto, Game Director  
**Repository:** `Galashots/eldoria`  
**Opened:** 2026-07-28

## Purpose

This folder gathers independent proposals for how the AI agents supporting Realm of Eldoria should be used. It does not establish permanent roles, review gates, or authority. Gemini's first draft initiated the discussion; it is one proposal, not the baseline or default charter.

The goal is to identify sensible standing responsibilities, useful overlap, limitations, and escalation paths while preserving the owner's final decision.

## Current participants

- Claude Code
- Gemini
- ChatGPT
- Kimi K3

A model's proposed title does not grant repository access, approval authority, or merge authority. Tool access and owner authorization remain task-specific.

## Required review method

Each participant should complete the following two passes in order:

1. **Independent allocation:** Inspect the repository and assess all four agents without copying the role allocations in existing proposals. State what evidence is observed, what is inferred, and what remains untested.
2. **Cross-review:** Read the other available proposals. Identify agreements, disagreements, factual corrections, missing responsibilities, and claims that require a practical trial.

Each agent must use `ROLE_REVIEW_TEMPLATE.md` and create or return one separate proposal under `proposals/`. Do not edit another agent's proposal.

## Evaluation principles

- Assign work based on demonstrated capability, tool access, availability, cost, and task risk—not prestige or a desire to give every model a unique title.
- Prefer a primary, backup, and independent reviewer for important domains over exclusive silos.
- Separate standing responsibility from task-specific authority.
- Treat self-assessments and vendor claims as hypotheses until supported by repository work.
- No agent's self-review is sufficient for a material change it created.
- Advisory reviewers are non-blocking unless the owner explicitly designates a gate.
- The owner approves the final charter and resolves unresolved disagreements.

## Evidence expected

When making a repository-specific claim, cite the inspected file, pull request, test, screenshot, or other evidence. When evidence is unavailable, label the claim as an inference or proposed trial.

Each proposal must distinguish:

- **Observed:** supported by repository work or direct tool behavior.
- **Inferred:** a reasonable but unverified expectation.
- **Untested:** a capability claim requiring a trial.

## Initial proposal files

- `proposals/2026-07-28-gemini-initial.md`
- `proposals/2026-07-28-chatgpt-initial.md`
- Claude and Kimi proposals: pending

## Decision process

1. Collect all four initial proposals without editing them into consensus.
2. Produce a neutral comparison matrix covering consensus, disagreements, factual conflicts, and trial candidates.
3. Run small representative trials where role claims materially conflict or remain untested.
4. Ask each agent for a short final response to the comparison and trial evidence.
5. Leo approves the final role charter.
6. Review the charter after the first five material tasks and whenever tools, models, cost, or availability change significantly.

## Scope of this RFC

This RFC is documentation-only. It does not modify gameplay, architecture, the Visual North Star, repository instructions, branch protection, reviewer settings, or merge rules.
