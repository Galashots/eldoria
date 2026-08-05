# Step 7 revise brief — for the Codex implementation seat

**Director/reviewer:** Claude (Fable) · **Author:** Codex (GPT 5.6 Luna) · **Date:** 2026-08-04
**Branch:** `feat/step7-mira-onboarding-20260804` (PR #44, current head `358ff58`) — continue on this branch, do NOT squash or rebase away the reviewed head.
**Context:** PR #44 (Mira's Guide onboarding, save v4) got a REVISE from the non-author review (review `#4856414416` on the PR — read it in full first). All four blockers are accepted. The planner rulings below are locked; implement them exactly. If something here conflicts with the code you find, stop and flag it in the PR rather than improvising.

Read first: the PR body, review #4856414416, `js/11-onboarding.js`, `js/06-saves.js` (ingestion path), `tools/onboarding-test.mjs`, `docs/CURRENT_STATE.md`.

## Blocker 1 — complete the guide surface (largest item)

Extend `js/11-onboarding.js` (keep all logic in this module; hooks elsewhere stay one-line):

- **World/route highlight** for the current objective's target, drawn by the existing renderers (a pulsing outline/marker is enough; match each renderer's existing style conventions):
  - planted → nearest empty soil plot (Farm);
  - harvested → the growing/ready crop tile;
  - usedCrop → the General Store door AND the cookpot (either satisfies it);
  - metMira/acceptedQuest → route hint toward Town + Mira's tile when in Town;
  - enteredWilds → the right-edge exit.
  - Works in BOTH render modes (iso Farm/Town, top-down elsewhere). Purely presentational: NO collision, reach, or interaction changes.
- **Skip guide**: a small persistent control (on the chip or next to it) with a child-proof confirm (e.g. hold or two-step). Sets `status:'skipped'` permanently for that save, saves immediately, removes chip + highlights. Skipped is forever (no restart UI this PR).
- **Read-aloud control**: a speaker button on the chip that speaks the current objective via the existing `speak()`/`speakToAll()` conventions (child taps → hear it again; works for both profiles — use `speakToAll` for the explicit button since it is user-initiated).
- **Progress indicator**: "x of 6" on the expanded chip.
- **Transition toast**: `showToast` when the derived objective changes (see blocker 2 for the only-on-change rule).
- **Touch targets**: chip, collapsed compass badge, skip, and speaker controls all ≥44×44 CSS px.

## Blocker 2 — honest chain + narration only on objective change

- Keep six persisted milestones. The VISIBLE chain is **five objectives** (planner ruling): the real Mira interaction completes `metMira` and `acceptedQuest` together; progress may jump 3/6 → 5/6. Update chip text/PR wording accordingly. Do NOT invent a new accept-quest interaction.
- In `recordOnboardingMilestone`: compute the derived objective BEFORE and AFTER recording; `speak`/toast ONLY when it changed. (Current bug: selling first re-speaks "Plant".)
- The Mira double-completion gets ONE combined transition message (reviewer-agreed wording direction: "Mira gave you a quest! Head into the Wilds!") so the child understands why two milestones completed; never render or speak an impossible standalone "accept quest" step.
- Tests: a `speechSynthesis` spy (count utterances, not just last) covering the synchronous Mira path and out-of-order records; prove at-most-once narration per objective change.

## Blocker 3 — strict canonical policy in js/06-saves.js

- A present v4 onboarding block must contain **exactly all six** boolean milestone keys — reject anything else (missing keys are no longer defaulted; delete the default-false test).
- `completed` requires all six true — reject a completed block with any false milestone.
- `active` with all six true **canonicalizes to completed** during migration.
- `skipped` preserves partial milestones (test this).
- A v4 save missing the whole onboarding block remains a **supported recovery case** → migrates to `skipped` (document in the header comment).
- v0–v3 → `skipped` unchanged.

## Blocker 4 — evidence, ledger, test 49

- Extend `tools/onboarding-test.mjs` evidence: at least one **real verb-driven end-to-end run** (plant → harvest → sell → Mira → Wilds via real functions, not state injection) capturing: highlight states, Skip control, read-aloud control, chip coexisting with an active kill-quest tracker, Town/Mira routing, Wilds completion.
- New tests: skip persistence + inertness, 44×44 sizing assertions, focus behavior, no horizontal overflow on phone portrait, highlight target selection per milestone, combat coexistence (highlights hidden too).
- `tools/asset-manifest-test.mjs` test 49: print **SKIP** (not a synthetic PASS) when `EXPECT_NO_RUNTIME_DELTA` unset; when set to `1`, an unresolvable base ref **fails closed**.
- PR body ledger: rename the onboarding row to **ELD-UX-001**; label topic rows without stable CGPT IDs as "unnumbered observation".

## Gates before handing back

1. Full `npm test` green locally (run it; the onboarding suite includes the captures).
2. `node tools/asset-manifest.mjs --write --accept-new` after any runtime-file change, then `--check` clean.
3. Push to the SAME branch; report the exact head SHA in the PR + to Claude for review.
4. No scope creep: no economy/curriculum/combat/map changes, no PixelLab, no new dependencies.

Known environment gotchas: `process-crop-sheet.mjs --check` fails on Windows locally (pre-existing Puppeteer canvas variance — ignore; Linux CI is authoritative). Bash cwd can reset to Desktop between commands — `cd` explicitly.
