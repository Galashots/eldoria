# Hotfix Work Order — iPad playtest round 1 (2026-08-05)

**Seat:** Codex implements. Fable directs + exact-head acceptance review. ChatGPT spot-check optional (no visual gate — no art changes in scope).
**Source:** Leo's iPad playtest of merged Step 8 (main=37c04ea). Three findings in this PR; tile-placement protocol and beautification are SEPARATE follow-ups, out of scope here.
**Branch suggestion:** `agent/hotfix-input-feel-20260805`. Normal PR flow, CI green on exact head required.

---

## Item 1 — Kill iPad double-tap zoom (ASAP, highest priority)

Safari double-tap-to-zoom fires on rapid taps in the playfield (kids tap fast — see ELD-PT-011's mashing history). Required:

- `touch-action: manipulation` on the game surface containers (canvas, HUD, action button — `#joystickZone` already has `touch-action: none`, leave it).
- Audit for any remaining `dblclick`/gesture path that zooms; suppress on game surfaces only.
- Do NOT set `user-scalable=no` globally without flagging it: pinch-zoom is an accessibility affordance; prefer `touch-action` scoping. If a viewport-meta change ends up necessary, state it explicitly in the PR body for director sign-off.
- **Test:** synthetic rapid double-tap on farm tiles / HUD / action button produces no viewport scale change (visualViewport.scale stays 1); tap-to-move still works on the second tap (two fast taps = two moves, not zoom).

## Item 2 — Ranger iso movement speed

`player.speed = 2.4` (`js/02-data-state.js:348`). **Verified NOT persisted** — `saveGame()` has an explicit field list without `speed`, so tuning reaches existing profiles. Ruling:

- Do NOT bump the global constant: top-down mode (`?iso=0`) and non-iso areas share it, and iso only *feels* slower partly because the projection halves vertical screen motion (sy=(px+py)/2).
- Add an **iso-only multiplier** (e.g. `ISO_SPEED_MULT`, first guess 1.5) applied where movement is computed in iso mode (`js/07-hud-movement.js:235` region). Make it a tunable knob like `TARGET_VIEW_ROWS` — Leo tunes on iPad with the boys; expect a follow-up value change without code review.
- **Test:** iso step distance = topdown distance × mult; topdown path byte-unchanged; collision/bounds still respected at the higher speed (no tunneling through blocked tiles — step must still be ≤ collision resolution or clamped).

## Item 3 — Adaptive joystick (design port from eldoria-v2, NOT a code port)

**ChatGPT tightening (accepted 2026-08-05): the joystick is the riskiest part of this PR — keep it in its OWN commit with its own acceptance checks**, so the zoom kill and speed fix can be accepted/reverted independently of joystick regressions. Additional required checks (verbatim from visual lead):
- no browser zoom from double-tap, rapid ACTION taps, crop taps, or modal interactions;
- ordinary pinch zoom behavior follows the intended app policy;
- speed changes apply only to isometric movement and preserve collision, interaction reach, animation timing, and diagonal normalization;
- joystick spawns only from valid world-touch regions — never over HUD, guide chip, modals, or action controls;
- the existing fixed-control behavior remains an immediate fallback if adaptive placement misbehaves on iPad (keep the old fixed-zone path switchable, e.g. a localStorage flag like the iso opt-out).

**Fit-check verdict (Fable, done):** v2's wiring is Phaser/TS (`src/scenes/WorldScene.ts:1293-1370`, `src/presentation/joystickZone.ts`) — it does not transplant into our vanilla DOM rig. The *design* ports cleanly; our rig already has the right primitives (pointer events, `setPointerCapture`, DOM thumb, 4-way `held.*` output with 0.2 deadzone). Port the three design elements:

1. **Bounded corner activation zone, larger than the visible circle.** v2 measured ~323×274 CSS px vs our fixed 140×140 circle. Make `#joystickZone` an invisible catchment box anchored bottom-left (start ~240×220 CSS px, knob-tunable) — v2's audit lesson: bounded box, NOT the whole lower-left quadrant, or it eats world taps.
2. **Spawn-at-touch origin.** On `pointerdown` inside the zone, reposition `#joystickBase`+`#joystickThumb` to the touch point; that point becomes the origin for `joystickUpdate` offsets (currently offsets are computed from the fixed zone center via `getBoundingClientRect`, `js/09-main.js:422-437`).
3. **Hide on release.** Base+thumb invisible until touch-down; `joystickReset()` hides instead of recentering.

Constraints:
- **Output contract unchanged:** keep 4-way digital `held.left/right/up/down` + `JOYSTICK_DEAD 0.2`. v2's analog `inputStrength` is NOT ported (would change gameplay). The iso screen-relative conversion (`js/07-hud-movement.js:208`) consumes `held.*` and must not change.
- Clamp: if the touch lands so close to the screen edge the base would clip, shift the base inward (v2 doesn't handle this; our zone reaches the corner).
- Keyboard/desktop path untouched.
- **Tests:** extract zone geometry to a pure function (v2's `joystickZone.test.ts` pattern); assert touch inside zone engages at touch point, just-outside does NOT engage AND still performs a world tap; drag beyond radius clamps; release hides; second touch while active is ignored (existing `joystickId` guard).

## Evidence

- Captures: joystick engaged at 3 different points in the zone (iPad viewport), before/after speed at fixed frame count, double-tap sequence screenshot pair.
- Committed under `docs/playtest/hotfix-input-feel/`, registered in the manifest (**run `node tools/asset-manifest.mjs --write` then `--check` before pushing — this exact miss made Step 8 CI red**).

## Scope fence

IN: the three items above, their tests, evidence, manifest regen.
OUT: tile-placement/terrain protocol (next work order, needs Leo's placement spec), any art/asset generation (PixelLab PAUSED), Town/env-art expansion, UI theming, analog movement, gameplay tuning beyond the speed knob.
