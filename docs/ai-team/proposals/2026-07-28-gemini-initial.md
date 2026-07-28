# Gemini Initial AI Team Role Proposal

> Provenance note: The proposal below was supplied by Gemini and pasted by the owner on 2026-07-28. It is preserved as an attributed input rather than silently corrected. Its `eldoria-main` label refers to this repository, whose exact name is `Galashots/eldoria`. Any other factual or strategic corrections belong in the independent reviews and later synthesis.

---

# AI Team Role Plan & Workflow Strategy
**Author:** Gemini (Architect & Non-Blocking Advisory Reviewer)  
**Date:** July 28, 2026  
**Status:** Initial Draft — Pending Team Review  
**Applies to:** Realm of Eldoria (`eldoria-main`)

---

## 1. Overview & Directorial Vision
To convert *Realm of Eldoria* into a 2.5D isometric game while maintaining its zero-build, single-file (`index.html`), offline-first architecture, development is driven by a non-coding **Game Director** supported by an AI model team. Each AI tool operates in a specialized capacity to eliminate overlapping work, prevent hallucinated breaking changes, and keep momentum fast and fun.

---

## 2. Model Allocations & Responsibilities

| AI Tool | Assigned Role | Primary Focus & Domain | Execution Vector |
| :--- | :--- | :--- | :--- |
| **Claude Code** | **Lead Developer & Git Operator** | Code execution, repo modifications, running test harnesses (`npm test`), script generation in `tools/`, and git commits. | Local Terminal |
| **Gemini** *(Author)* | **Architect & System Auditor** | Drafting technical specs, designing asset pipelines, writing task-by-task plans, auditing diffs, and enforcing single-file/offline constraints. | Contextual Advisory / GitHub PR Review |
| **ChatGPT** | **Art Director & Creative Brainstormer** | Visual North Star drafting, ChatGPT/DALL-E image prompt engineering, UI/UX concepting, and game lore/narrative expansion. | Web UI |
| **Kimi K3** | **Logic & Deep-Context Verifier** | High-context auditing, math/economy balance verification, edge-case sanity checks on large code blocks, and migration risk analysis. | Web UI |

---

## 3. The 4-Step "Vibe Coding" Execution Loop

1. **Plan & Spec (Gemini / ChatGPT):** Write a task-by-task markdown plan for any new system or tool (stored in `docs/superpowers/plans/`).
2. **Build & Test (Claude Code):** Claude Code executes the plan task-by-task in the terminal, confirming green passes on `npm test` before committing.
3. **Generate Assets (ChatGPT / PixelLab):** Create matching 2:1 isometric or 2D sprites using prompt templates from `ART_PROMPTS.md`.
4. **Director Playtest & Review (You):** Verify in browser/tablet. If errors occur, pass the error log back to Claude Code or Gemini for resolution.

---

## 4. Core Architecture Guardrails (Unbreakable)
* **Single-File Engine:** All core game code lives inline within `index.html`. No build bundlers, TypeScript, or external runtime frameworks.
* **Offline Operation:** Zero external web dependencies at runtime.
* **Sacred World Space:** Isometric view is a render and input transform only; world coordinates ($X, Y$), save data, and game logic remain untouched.
* **Test Safety Net:** Every functional PR or feature branch must pass the Puppeteer smoke suite (`tools/smoke-test.mjs` & `tools/iso-test.mjs`).

---

## 5. Feedback & Revisions
*Pending review and feedback from Claude Code, ChatGPT, and Kimi K3.*
