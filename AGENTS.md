# Agent Instructions

These instructions apply to every agent working in this repository.

## Start here

- Read `README.md` for the product and architecture.
- Read `docs/VISUAL_NORTH_STAR.md` and inspect its linked image before any repository-wide review or any material decision affecting the visible game.
- For isometric conversion work, also read `docs/superpowers/specs/2026-07-27-isometric-conversion-design.md`.
- Preserve the repo's deliberately simple architecture: one self-contained `index.html`, vanilla HTML/CSS/JavaScript, offline operation, and touch-first tablet support unless the owner explicitly authorizes an architectural change.

## Visual North Star rule

The current repository-wide visual authority is:

- [Visual North Star rules](docs/VISUAL_NORTH_STAR.md)
- [Current North Star image](docs/visual/eldoria-visual-north-star-v1.png)

For visually relevant reviews and decisions, include a brief **North Star alignment** result: **Aligned**, **Intentional interim gap**, or **Refresh candidate**.

Incremental work does not fail merely because it has not yet achieved concept-art polish. Judge whether it moves the game toward the applicable direction while remaining readable and playable.

If a feature creates a persistent, worthwhile direction that the current image no longer represents:

1. flag **NORTH STAR REFRESH RECOMMENDED**;
2. explain the mismatch briefly;
3. provide a feature-specific, ready-to-paste ChatGPT image prompt using the current repository image link and the template in `docs/VISUAL_NORTH_STAR.md`; and
4. continue otherwise-authorized scoped work unless the owner made visual approval a gate.

Do not overwrite, silently supersede, or self-approve a North Star. Only explicit owner approval makes a new version authoritative.

## Scope discipline

- Make the smallest targeted change that fulfills the task.
- Do not alter unrelated code or assets.
- Flag uncertainty instead of inventing missing requirements.
- Keep learning inside natural play; do not turn progression into quizzes that block adventure.
- Treat direct tapping on a visible person, enemy, crop, or object as a first-class interaction where applicable, alongside action-button controls.
- Keep farming rewarding and legible because it is a proven high-interest system for the intended players.
