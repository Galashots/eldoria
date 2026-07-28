# Prompt for Kimi K3: Independent AI Team Role Proposal

Copy the prompt below into a new Kimi K3 conversation. Kimi does not need repository write access; it should return one complete Markdown proposal for later addition to the RFC branch.

---

You are participating in a documentation-only AI team role RFC for the public repository `Galashots/eldoria`:

https://github.com/Galashots/eldoria

The draft RFC branch is:

https://github.com/Galashots/eldoria/tree/docs/ai-team-role-rfc/docs/ai-team

Your task is to inspect the repository, independently assess how Claude Code, Gemini, ChatGPT, and Kimi K3 should be used on this project, cross-review the existing Gemini and ChatGPT proposals, and return your own proposal as one ready-to-save Markdown document.

## Authority and scope

This is analysis only. Do not claim to edit the repository, create a PR, merge, approve a North Star, or grant any agent authority.

Do not:

- rewrite the existing proposals into consensus;
- treat Gemini's first draft or ChatGPT's response as the baseline;
- present general model reputation, vendor marketing, or unsupported claims as repository evidence;
- assume that a role title grants tool access, approval authority, or merge authority;
- force all four agents into every task.

## Required repository reading

Inspect at minimum:

1. `README.md`
2. `AGENTS.md`
3. `package.json`
4. `docs/VISUAL_NORTH_STAR.md` and the linked North Star image
5. `docs/superpowers/specs/2026-07-27-isometric-conversion-design.md`
6. `docs/ai-team/README.md`
7. `docs/ai-team/ROLE_REVIEW_TEMPLATE.md`

If you cannot access a required file or inspect the image, state that limitation precisely. Do not invent its contents. You may continue with a clearly labelled context-limited review if enough evidence remains.

Because this is a repository-wide review, include the repository-required **North Star alignment** result: **Aligned**, **Intentional interim gap**, or **Refresh candidate**. This RFC itself changes no visual direction, so explain the result briefly rather than forcing a visual critique.

## Review order

Complete the work in two genuine passes.

### Pass A — independent allocation

Before opening the existing Gemini and ChatGPT proposal files, form and record your own assessment of:

- the recurring work this repository actually requires;
- each agent's primary and secondary uses;
- work each agent should not own alone;
- owner-only and delegated authority;
- the smallest useful delivery and review workflow;
- fallback rules; and
- capability claims that are observed, inferred, or untested.

Do not allocate Kimi a prestigious or exclusive role merely because you are Kimi. Be candid about your interface, tool, context, and availability limitations.

### Pass B — cross-review

After recording Pass A, read:

- `docs/ai-team/proposals/2026-07-28-gemini-initial.md`
- `docs/ai-team/proposals/2026-07-28-chatgpt-initial.md`

Identify substantive agreements, disagreements, factual corrections, missing considerations, and practical trials that could change the role decision.

## Required output

Return exactly one Markdown document intended to be saved as:

`docs/ai-team/proposals/2026-07-28-kimi-initial.md`

Use every substantive section of `docs/ai-team/ROLE_REVIEW_TEMPLATE.md`. Include:

- proposal metadata and the exact repository/ref you inspected;
- the required North Star alignment result;
- your independent allocation table for all four agents;
- owner and authority boundaries;
- a proportional workflow that does not require every agent for every task;
- failure and fallback rules;
- cross-review of the Gemini and ChatGPT proposals;
- repository-specific factual corrections with cited paths;
- an Observed / Inferred / Untested evidence table;
- only small, decision-relevant trials;
- a concise initial charter with primary, backup, and independent review assignments;
- explicit dissent and uncertainty.

Important: distinguish what you observed in this repository from what you merely infer about any model, including yourself. If you claim Kimi is especially capable at long-context, logic, economy, math, code review, or migration analysis, label the claim according to the actual evidence available and propose a bounded trial where needed.

Do not add introductory or closing chat outside the Markdown document. Stop after the complete proposal.
