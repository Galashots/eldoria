# Large PR Execution Protocol

Use this protocol only when Leo explicitly labels an outcome **LARGE**. It supplements `AGENTS.md` and the AI Team Charter; it does not grant new authority, relax review gates, or make an agent's self-review sufficient.

## One outcome, one integration owner

Before implementation, write a one-paragraph outcome, a closed in-scope list, an out-of-scope list, and measurable acceptance gates. The integration owner keeps the end-to-end mental model, owns shared-file decisions, runs the integrated test suite, prepares evidence, and delivers the final exact-head handoff.

For the next large PR, Claude Code is the default integration owner. ChatGPT remains the standing visual-direction lead and required non-author reviewer for material visual integration. Gemini remains advisory and non-blocking unless Leo explicitly changes the gate.

## Decompose by ownership, not by wish list

Subagents are useful only when their work can proceed independently. Give each lane:

- one bounded deliverable;
- explicit files it may change and files it must not change;
- the contracts it must preserve;
- the commands or evidence that prove completion;
- the expected return format; and
- a stop condition for missing inputs, conflicts, or scope expansion.

Prefer parallel lanes for repository audit, asset preparation/validation, test design, documentation, and visual-evidence planning. Serialize changes to `index.html` under the integration owner. If two lanes would edit the same file, either split ownership by time with a written handoff or keep one lane read-only and have it return a patch plan.

Do not create nested delegation trees unless Leo explicitly asks for them. The integration owner remains accountable for every adopted result.

## Branch and checkpoint discipline

- Start from the exact current `main` SHA and record it in the PR body.
- Use an isolated branch or worktree for each code-writing lane. Never let two agents write the same worktree concurrently.
- Make coherent commits that map to reviewable outcomes; do not mix generated assets, engine wiring, tests, and documentation into one opaque commit.
- Push an integration checkpoint after each accepted lane so an interrupted session can resume from the repository, not chat history.
- Before adopting a lane, inspect its diff and evidence. A subagent's claim that tests passed is input, not verification.
- Rebase or merge the current `main` before final review if required, then rerun the full gates on the resulting exact head.

## Speed without duplicated work

- Read the repository guidance once and include the relevant contracts in each lane brief; do not ask every lane to rediscover project history.
- Parallelize independent, slow work. Keep shared-file edits and final integration sequential.
- Match model strength to the lane: use the strongest reasoning seat for architecture, shared engine code, ambiguous debugging, or final integration; use faster seats for bounded searches, inventory checks, mechanical transformations, and evidence organization when reliable.
- Keep status reports compact: changed files, decisions, tests, blockers, and commit SHA.
- Stop a lane that is duplicating another lane, drifting out of scope, or waiting on a missing approved input. Reassign only after the integration owner resolves the dependency.

## Required lane return

Every lane returns:

1. outcome and changed files;
2. exact commit SHA or a read-only recommendation;
3. tests/validation run and exact results;
4. visual evidence paths where applicable;
5. assumptions and unresolved risks;
6. confirmation that no credentials, private chat, or unrelated changes were added; and
7. whether the integration owner should adopt, revise, or reject the result.

## Integration and review gates

The integration owner must:

1. inspect every adopted diff;
2. run `npm test` on the integrated head;
3. verify CI and retain its run number;
4. inspect required runtime images on phone portrait, iPad landscape, and desktop;
5. test missing-asset fallback and the relevant depth/interaction paths;
6. confirm no unintended save, map, collision, economy, curriculum, or gameplay change;
7. update `docs/CURRENT_STATE.md` and any affected decision/inventory record;
8. record known gaps without disguising placeholders as finished art; and
9. request a non-author exact-head review before merge.

For visual work, the review must inspect actual images and state **Aligned**, **Intentional interim gap**, or **Refresh candidate**. Machine gates may establish size, alpha, anchor, completeness, and deterministic structure; they do not establish identity, camera/facing correctness, readability, polish, or North Star alignment.

## Halt conditions

Stop and ask Leo rather than broadening the task when:

- an architectural change becomes necessary;
- save migration, map redesign, economy/progression change, or curriculum change appears required;
- the North Star would need replacement rather than normal incremental progress;
- required identity or building art fails human review after a bounded iteration;
- shared-file ownership cannot be resolved safely; or
- the exact-head test/evidence gate cannot be reproduced.
