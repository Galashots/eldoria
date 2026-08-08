# Retire Top-Down Rendering — Implementation Plan (sub-project 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** APPROVED by Fable 2026-08-06 — see RESOLVED block. Author/implementation seat: Claude. Directs + exact-head acceptance: Fable. Non-author review: ChatGPT. **Leo merges — never self-merge.**

### RESOLVED (Fable, 2026-08-06)
- **D1 → D1-C (two-PR split).** **PR 1a** = this plan's Phases A + C + D + E + F (pure code render-deletion; §7 rollback custody applies to 1a). **PR 1b** = an *immediate bounded fast-follow* that retires the attack strips, `OVERLAY_DIRECTIONS`, the dead `equipment_*`/`player_attack_*` SPRITES bindings, and the matching `asset-manifest.mjs`/`manifest.json`/`asset-manifest-test.mjs` declarations — **nothing else**. 1b gets its own review and is deliberately **outside 1a's revert window** (that is the point of splitting). NOT deferred to sub-project 5 — §3's "superseded by 5" is the *rationale* for retiring the strips, not permission to defer their deletion. Phase B below is now the PR-1b spec.
- **D2 → remove `isoActive()` entirely.** A `return true` stub is a lie the next reader must disprove; honest deletion even with more call sites.
- **D3 → approved as written.** ELD-PT-005 overhang-tap re-points to iso (not dropped); `combat-progression-test.mjs` stays byte-untouched — any pressure to edit it is a STOP condition.
- **Added requirement:** PR 1a's body must explicitly state that the `paperdoll_*` manifest family and `assets/<profile>-right-*.png` are intentionally retained, citing manifest-test **checks 33/34** as evidence (the claim ChatGPT probes first).

**Goal:** Delete the top-down renderer so the game renders isometric-only in every area, as a clean, single-revert-able pure-code deletion — with the Character paper doll's gear still visible and the combat mechanics untouched.

**Architecture:** The world already has a complete iso renderer (`js/08-iso-renderer.js`, entered via `draw()`'s `isoActive()` branch). Retiring top-down means collapsing every `isoActive() ? iso : topdown` fork to the iso arm, deleting the top-down `draw()` body and its exclusive helpers, deleting the `?iso=0/1` override + per-area flags, and deleting the cardinal-facing snap machinery — leaving the iso path as the only path. World coordinates, collision, saves, economy, quests, and combat are renderer-independent and are **not** touched.

**Tech stack:** One offline vanilla HTML/CSS/JS game rooted in `index.html`; inline blocks extracted into `eldoria.css` + deferred `js/01-*.js … js/11-*.js`. Dev-only test harness: Node + puppeteer, run via `npm test`. No framework, no bundler, no TypeScript.

**Base:** `agent/retire-topdown-20260806` off `origin/main` @ `836637f` (post PR #53 — sub-project 0 already merged; CURRENT_STATE.md already authorizes this work). Worktree: `C:/Users/Leo/Desktop/eldoria-retire-topdown`.

## Global Constraints (apply to every task)

- **Pure deletion, cleanly `git revert`-able.** The deletion removes the fallback renderer before iso combat is proven; that single revert is the mitigation. No behavior rewrites beyond collapsing a two-arm fork to its surviving arm. (spec §3)
- **No save-schema change.** `SAVE_VERSION` stays `4`; `defaultState()` keys unchanged; no field added or removed. (spec §3, §9)
- **No facing is saved, and none is migrated.** `saveGame()` (js/06-saves.js:481) already never serializes `player.facing` — verified. Assert this via `ingestSaveText`; add no migration. (spec §3, §9)
- **The four cardinal equipment overlay sets + `paperDollDirection: 'right'` SURVIVE**, scoped to the Character paper doll only. Deleting them blacks out gear visibility everywhere. (spec §3; task)
- **Combat mechanics assertions pass untouched.** `combat-progression-test.mjs` (damage budgets, answer→slash loop, duplicate-input, ≥3-answered-questions boss floor) must not be modified. (spec §9)
- **Presentation tests for the deleted renderer are replaced, not silently dropped** (spec §9). Every removed top-down assertion maps to an iso equivalent or is documented as moot in the PR.
- **Do NOT touch** `GEAR` stats, the saves schema, or the dumpling stall. Those belong to sub-project 2 and other work.
- Every visually relevant PR states a **North Star alignment** verdict.

---

## DECISIONS REQUIRED FROM FABLE (before any coding)

### D1 — Scope of the overlay/attack-strip retirement vs. Foundation-D coupling  *(the important one)*

Spec §3's "Deleted:" list names `OVERLAY_DIRECTIONS`, and says the cardinal attack strips (`*-attack.png`, `*-weapon-attack.png`) "retire with the renderer." But those live in a governance system that is **not** pure code:

- `OVERLAY_DIRECTIONS` (js/02-data-state.js:118) drives the `loadSprite` loop that registers the `player_attack_*`, `equipment_*`, `equipment_walk_*`, `equipment_attack_*` entries in the runtime `SPRITES` registry.
- **Foundation D binds to exactly those entries:** `tools/asset-manifest.mjs:737-795` declares them; `tools/asset-manifest-test.mjs` checks **31/32** assert the live `SPRITES` registry contains them, and line **427** reads `OVERLAY_DIRECTIONS` out of the running game. `assets/manifest.json` records them.
- The top-down `draw()` was the **only** consumer of `playerAttackSprite`/`equipmentSprite`/`equipmentAttackSprite`/`equipmentWalkSprite` (grep-verified). After Phase A they are dead code.

**Key fact that de-risks this:** the Character paper doll is **fully independent** of this system. `renderPaperDoll` (js/10-character.js:68-89) builds `<img src="assets/<profile>-right-<slot>.png">` DOM nodes directly — it never reads `SPRITES`, `OVERLAY_DIRECTIONS`, or the overlay `loadSprite` loop. The manifest declares the paper-doll assets under a **separate** `paperdoll_*` family (checks 33/34). So the surviving cardinal overlays survive no matter which option below we pick.

Therefore deleting `OVERLAY_DIRECTIONS` / the overlay `loadSprite` loop / the attack-strip assets forces coordinated edits to `asset-manifest.mjs` + `asset-manifest-test.mjs` + `assets/manifest.json` (and possibly `git rm` of binary PNGs). That **breaks "pure deletion, cleanly revert-able,"** and enters a domain the spec §8 stale-doc registry did **not** assign to sub-project 1 (it assigned only `assets/README.md`'s retention note to us; the manifest tooling is unassigned; `.claude/skills/asset-generation/SKILL.md` went to sub-project A). Spec §3 also says the attack strips are "superseded by the gear-aware combat animations in **sub-project 5**" — a natural home for their physical retirement.

**Options:**

- **(D1-A) Recommended — keep sub-project 1 a pure code render-deletion.** Do all of Phase A + C + D + E. **Leave** `OVERLAY_DIRECTIONS`, the overlay/attack `loadSprite` loop, the four accessor functions, the attack-strip/overlay asset files, and the entire Foundation-D manifest **untouched**, so the manifest gate stays green with zero Foundation-D edits. The overlay `SPRITES` entries become loaded-but-unused plumbing; note the intentional deviation from §3's literal list of `OVERLAY_DIRECTIONS`, and record that the attack-strip + manifest retirement is deferred to sub-project 5 (per §3's own "superseded in sub-project 5"). Maximally revert-able; smallest blast radius; the flagged risk (gear visibility) is provably untouched.
- **(D1-B) Full spec-literal retirement now.** Additionally delete `OVERLAY_DIRECTIONS`, the overlay/attack `loadSprite` registrations, and the four accessors; edit `asset-manifest.mjs` (drop the `player_attack_*` / `equipment_walk_*` / `equipment_attack_*` declarations — **keep** the four cardinal `equipment_*` static declarations for the paper doll), rewrite `asset-manifest-test.mjs` checks 31/32 + line 427, regenerate `assets/manifest.json`, and (optionally) `git rm` the retired PNGs. Honors §3 literally but is **not** pure deletion and edits Foundation-D governance + binaries.
- **(D1-C) Fast-follow.** Do D1-A in this PR; open a separate, immediately-following PR for the OVERLAY_DIRECTIONS/attack-strip/manifest retirement so the render deletion stays trivially revert-able on its own.

Phase B below is written concretely so that **if** Fable picks D1-B or D1-C it is ready to execute; under D1-A, Phase B is skipped.

### D2 — Removal style for `isoActive()`

With all areas iso, `isoActive()` is always true. **Recommended:** delete `isoActive()`, `ISO_AREAS`, and the override entirely, and remove each caller's top-down arm (true "retire the branch"). Alternative: collapse `isoActive()` to `return true` and leave callers' dead arms — rejected, because it leaves the top-down code the spec says to delete. Confirm the recommended full removal.

### D3 — Test-replacement mapping

Phase C proposes an exact keep/replace/delete decision for every affected test (below). Confirm the mapping — especially that (a) the ELD-PT-005 overhang-tap regression is **re-pointed to iso**, not dropped, and (b) `combat-progression-test.mjs` is not touched.

---

## Rollback custody (spec §7 — recorded here and repeated in the PR body)

1. **Exact pre-deletion SHA, tagged.** Before the first deletion commit, tag the branch point: `git tag pre-retire-topdown 836637f` (annotated) and push the tag. The PR body links it as the one-revert target.
2. **Five-area iso smoke matrix, run before merge.** Capture farm, town, wilds, deepwoods, mine each rendering under the iso renderer with no console errors (puppeteer capture per area). Attach as PR evidence; do not infer from pixel metrics.
3. **Reverse-order rollback sequence.** Documented in the PR: `git revert` the merge commit (single revert restores the top-down renderer, override, cardinal facing, and per-area flags together). If dependent PRs (sub-project 2/3) have landed on top, revert them first in reverse merge order, then this PR.
4. **Rollback window.** Stays open through world-combat iPad acceptance (sub-project 3). The PR states this explicitly so the deletion is not treated as reversible-forever.

---

## File Structure — what is deleted, what survives

**Deletion targets (top-down only):**

| File | Delete | Notes |
| --- | --- | --- |
| `js/09-main.js` | top-down `draw()` body → `drawIsoWorld()` only; `topDownCamera()`; the `else` arm of `canvasBackingPointToTile`; the `dCol` fork in `interactAtVisibleTile`; the stale `?iso=0` comment near `fixedJoystick` | `draw()` becomes a one-liner dispatch |
| `js/03-maps-areas.js` | `?iso=0/1` search+localStorage lines; `ISO_AREAS`; `isoActive()` | areas render iso unconditionally |
| `js/01-core-canvas.js` | `applyCanvasMode` top-down `else` (the 640×480 store); `isoActive()` guard in `__isoTestMove` | keep the iso canvas sizing |
| `js/02-data-state.js` | `cardinalFromVector()`; `FACING_TO_CARDINAL` | (`OVERLAY_DIRECTIONS` only under D1-B/C — see Phase B) |
| `js/04-interaction.js` | the `isoActive() ? … : cardinalFromVector(…)` fork in `faceWorldTile` → `facingFromVector(…)` only | `getFacingTile` is gameplay — **keep** |
| `js/07-hud-movement.js` | the top-down arms in `update()` (cardinal facing + the `FACING_TO_CARDINAL` snap + the `isoMoved` speed/normalize forks); `drawNpcShape`; `drawEnemyShape`; `drawProcDeco` | movement stays iso; `drawArrow` is shared — **keep** |
| `js/08-iso-renderer.js` | `drawRockTile`; `drawCaveFloorTile`; `tileHash` (top-down-only fallbacks; iso uses prisms/diamonds) | everything else in this file is the surviving renderer |
| `js/11-onboarding.js` | the `else` (top-down) arm of `drawOnboardingWorldHighlight` | keep the iso arm |

**Survives untouched (must not regress):** `drawIsoWorld` and all `js/08` iso code; `drawArrow`, `getFacingTile`, `facingFromVector`, `FACING_OCTANTS`; `playerSprite`, `playerWalkSprite`, `profilePlayerSprite`; the Character paper doll (`js/10` + `paperDollDirection: 'right'` + the four cardinal `equipment_*` static overlay files + `paperdoll_*` manifest entries); all saves/economy/quest/combat code; the dumpling stall; `triggerShake`/`shakeUntil` (unused by iso, left as harmless dead state — note in PR).

**Orphaned data (minor):** `AREA_DECORATIONS` (js/03) was consumed only by the deleted top-down deco pass; deleting `drawProcDeco` orphans it. Leaving the data is benign; deleting it is optional cleanup — call out the choice in the PR, default to leaving it to keep the diff minimal and revert clean.

---

## PHASE A — Core render retirement (pure code; run under D1-A/B/C alike)

> Ordering rule: simplify every `isoActive()` caller's top-down arm FIRST (each commit stays green while `isoActive()` still exists), then delete `isoActive()`/`ISO_AREAS`/override LAST (Task A7), after Phase C has removed the tests that call `isoActive()`/`eldoria_iso`. Each task ends green on `npm test` except where a Phase-C test rewrite is its named co-dependency.

### Task A1: Collapse the render dispatch to iso-only

**Files:**
- Modify: `js/09-main.js` (`topDownCamera`, `draw`, `canvasBackingPointToTile`, `interactAtVisibleTile`, the `?iso=0` comment ~line 435)

**Interfaces:**
- Produces: `draw()` that always renders iso; `canvasBackingPointToTile` iso-only.

- [ ] **Step 1: Replace the `draw()` body and delete `topDownCamera()`.** Delete `topDownCamera()` (js/09-main.js:2-11) and replace the whole `draw()` function (js/09-main.js:13-405) with:

```javascript
function draw() {
  drawIsoWorld();
}
```

- [ ] **Step 2: Iso-only `canvasBackingPointToTile`.** Replace its `if (isoActive()) { … } else { … }` (js/09-main.js:594-604) so only the iso arm remains:

```javascript
function canvasBackingPointToTile(bx, by) {
  var projectedX = bx / isoScale + isoCamPX;
  var projectedY = by / isoScale + isoCamPY;
  var wx = isoInvX(projectedX, projectedY);
  var wy = isoInvY(projectedX, projectedY);
  var row = Math.floor(wy / TILE);
  var col = Math.floor(wx / TILE);
  if (row < 0 || row >= MAP_H || col < 0 || col >= MAP_W) return null;
  return { row: row, col: col };
}
```

- [ ] **Step 3: Iso-only `interactAtVisibleTile`.** The down-screen walk-back advances row AND col in iso; drop the top-down `dCol = 0` fork:

```javascript
function interactAtVisibleTile(row, col) {
  for (var step = 0; step <= TAP_REACH; step++) {
    var r = row + step, c = col + step;
    if (r >= MAP_H || c >= MAP_W) break;
    if (interactAtTile(r, c)) return true;
  }
  return false;
}
```

- [ ] **Step 4: Fix the stale comment.** In the `fixedJoystick` comment block (js/09-main.js ~435) remove the "Match the existing `?iso=0` pattern" clause (the pattern no longer exists); keep the rest.

- [ ] **Step 5: Run the suite.** Run: `npm test`. Expected: green (Phase-C tests not yet touched still boot iso by default on farm; any test that flipped to `eldoria_iso='0'` is addressed in Phase C — if a red appears there, it is expected and resolved in Phase C; note it and continue).

- [ ] **Step 6: Commit.** `git add js/09-main.js && git commit -m "Retire top-down: iso-only render dispatch and tap math"`

### Task A2: Movement facing → iso-only

**Files:** Modify `js/07-hud-movement.js` (`update`)

- [ ] **Step 1: Collapse the movement forks.** In `update()` (js/07-hud-movement.js:207-239) the iso transform always runs and facing is always `facingFromVector`. Replace the block from the `var isoMoved = false;` line through the `moveSpeed` line with:

```javascript
    // Iso movement: the joystick is SCREEN-relative; convert the screen vector to a
    // UNIT world vector through the inverse projection, then derive facing from world motion.
    if (dx !== 0 || dy !== 0) {
      var wvx = isoInputX(dx, dy), wvy = isoInputY(dx, dy);
      var wvl = Math.sqrt(wvx * wvx + wvy * wvy);
      dx = wvx / wvl;
      dy = wvy / wvl;
      player.facing = facingFromVector(dx, dy);
    }

    // Iso vectors are already unit-length. Projected movement uses its own tuning knob.
    var moveSpeed = player.speed * ISO_SPEED_MULT;
```

(This deletes the `isoMoved` flag, the `cardinalFromVector` arm, the `FACING_TO_CARDINAL` idle-snap arm, and the top-down `0.7071` diagonal normalize — all top-down-only.)

- [ ] **Step 2:** Run: `npm test`. Expected: green (movement/zoom tests that measured top-down speed are Phase C; a red there is expected and handled in Phase C).
- [ ] **Step 3:** `git add js/07-hud-movement.js && git commit -m "Retire top-down: iso-only movement facing and speed"`

### Task A3: Interaction facing → iso-only

**Files:** Modify `js/04-interaction.js` (`faceWorldTile`)

- [ ] **Step 1:** Replace `faceWorldTile`'s facing line (js/04-interaction.js:121-122) so it always uses `facingFromVector`:

```javascript
  player.facing = facingFromVector(dc, dr);
```
(Remove the `// Same split as movement…` comment's top-down half; keep a one-line note that facing is eight-way iso.)

- [ ] **Step 2:** Run: `npm test`. Expected: green. **Step 3:** `git add js/04-interaction.js && git commit -m "Retire top-down: iso-only tap-to-face"`

### Task A4: Onboarding highlight → iso-only

**Files:** Modify `js/11-onboarding.js` (`drawOnboardingWorldHighlight`)

- [ ] **Step 1:** In `drawOnboardingWorldHighlight` (js/11-onboarding.js:351-380) delete the `var isIso = …` branch variable and the `else` (top-down) arm (lines ~371-377, the `topDownCamera()` block), keeping only the iso arm; hard-set the iso line width. Result loop body:

```javascript
  ctx.lineWidth = 2.5;
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    var wx = (t.col + 0.5) * TILE, wy = (t.row + 0.5) * TILE;
    var cx = isoPX(wx, wy), cy = isoPY(wx, wy);
    drawIsoDiamondAt(cx, cy, ISO_TW / 2 + 4, ISO_TH / 2 + 4, 'rgba(255,232,146,' + (0.08 + pulse * 0.08) + ')');
    ctx.strokeStyle = 'rgba(255,232,146,' + pulse + ')';
    ctx.beginPath(); ctx.moveTo(cx, cy - ISO_TH / 2 - 4); ctx.lineTo(cx + ISO_TW / 2 + 4, cy);
    ctx.lineTo(cx, cy + ISO_TH / 2 + 4); ctx.lineTo(cx - ISO_TW / 2 - 4, cy); ctx.closePath(); ctx.stroke();
    drawArrow(cx, cy - ISO_TH / 2 - 16 - Math.sin(now / 220) * 3, 7, 'down', '#fff2b0');
  }
```

- [ ] **Step 2:** Run: `npm test`. Expected: green (`onboarding-test.mjs` boots iso by default). **Step 3:** `git add js/11-onboarding.js && git commit -m "Retire top-down: iso-only onboarding highlight"`

### Task A5: Canvas store → iso-only

**Files:** Modify `js/01-core-canvas.js` (`applyCanvasMode`, `__isoTestMove`)

- [ ] **Step 1:** Replace `applyCanvasMode` (js/01-core-canvas.js:9-28) so only the iso arm runs (drop the 640×480 top-down store and the `iso-mode` class toggle-off):

```javascript
function applyCanvasMode() {
  canvas.classList.add('iso-mode');
  var rect = canvas.getBoundingClientRect();
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var cssW = rect.width || 640, cssH = rect.height || 480;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  isoScale = (cssH / (TARGET_VIEW_ROWS * TILE / 2)) * dpr;
  isoCamW = canvas.width / isoScale;
  isoCamH = canvas.height / isoScale;
  ctx.imageSmoothingEnabled = false;
}
```

- [ ] **Step 2:** In `__isoTestMove` (js/01-core-canvas.js:182) drop the `isoActive()` guard so the iso transform always applies:

```javascript
    if (dx !== 0 || dy !== 0) {
```

- [ ] **Step 3:** Update the "Legacy top-down mode keeps its original fixed 640x480 store untouched" comment (js/01-core-canvas.js:6-7) to reflect iso-only.
- [ ] **Step 4:** Run: `npm test`. Expected: green. **Step 5:** `git add js/01-core-canvas.js && git commit -m "Retire top-down: iso-only canvas store"`

### Task A6: Delete top-down-only draw helpers

**Files:** Modify `js/07-hud-movement.js` (`drawNpcShape`, `drawEnemyShape`, `drawProcDeco`), `js/08-iso-renderer.js` (`drawRockTile`, `drawCaveFloorTile`, `tileHash`)

- [ ] **Step 1: Confirm no remaining callers.** Run: `grep -rn "drawNpcShape\|drawEnemyShape\|drawProcDeco\|drawRockTile\|drawCaveFloorTile\|tileHash" js/`. Expected: only the definitions (all call sites were in the deleted top-down `draw()`).
- [ ] **Step 2:** Delete `drawNpcShape` (js/07:330-372), `drawEnemyShape` (js/07:438-580), `drawProcDeco` (js/07:376-435). **Keep `drawArrow`** (js/07:316-325 — shared with iso + onboarding).
- [ ] **Step 3:** Delete `drawRockTile` (js/08:568-597), `drawCaveFloorTile` (js/08:600-613), `tileHash` (js/08:564). These are top-down-only fallbacks; the iso Mine draws ROCK as a prism and CAVE as a colored diamond (`drawIsoWorld`), so they are never reached after the flip.
- [ ] **Step 4:** Run: `npm test`. Expected: green. **Step 5:** `git add js/07-hud-movement.js js/08-iso-renderer.js && git commit -m "Retire top-down: delete top-down-only draw helpers"`

### Task A7: Remove `isoActive()`, `ISO_AREAS`, and the `?iso` override  *(co-dependency: Phase C must land first)*

**Files:** Modify `js/03-maps-areas.js`. Also remove the now-dead `cardinalFromVector`/`FACING_TO_CARDINAL` in `js/02-data-state.js`.

- [ ] **Step 1: Verify no code/test references remain.** Run: `grep -rn "isoActive\|ISO_AREAS\|eldoria_iso\|iso=0\|iso=1\|cardinalFromVector\|FACING_TO_CARDINAL" js/ tools/`. Expected: nothing in `js/` except the definitions to delete; nothing in the CI-run test tools (Phase C removed them). If any CI test still references them, STOP — Phase C is incomplete.
- [ ] **Step 2:** In `js/03-maps-areas.js` delete lines 8-18 (`ISO_AREAS`, the two `location.search` override lines, and `isoActive()`), and the "Override: ?iso=…" comment. (The `// ---- Iso mode flag ----` per-area rollout comment retires with it.)
- [ ] **Step 3:** In `js/02-data-state.js` delete `cardinalFromVector` (283-286) and `FACING_TO_CARDINAL` (287-290) plus their comments. Keep `facingFromVector`/`FACING_OCTANTS`.
- [ ] **Step 4:** Run: `npm test`. Expected: green. **Step 5:** `git add js/02-data-state.js js/03-maps-areas.js && git commit -m "Retire top-down: delete isoActive, per-area flags, and ?iso override"`

---

## PHASE B — Overlay/attack-strip + Foundation-D retirement  *(= PR 1b, immediate fast-follow; NOT in PR 1a)*

> **This is a SEPARATE PR (1b), landed immediately after 1a merges, with its own review — deliberately outside 1a's revert window.** The four cardinal **static** `equipment_*` overlays and `paperdoll_*` entries are RETAINED — only attack strips and walk overlays retire.

### Task B1: Delete the dead overlay/attack accessors and `loadSprite` registrations

- [ ] Delete `playerAttackSprite`, `equipmentSprite`, `equipmentAttackSprite`, `equipmentWalkSprite` (js/02-data-state.js:230-251) — grep-verified dead after Phase A.
- [ ] In the sprite-load loop (js/02:155-176) remove the `player_attack_*` load, the `equipment_walk_*` and `equipment_attack_*` loads, and delete `OVERLAY_DIRECTIONS` (line 118). **Keep** the `equipment_<profile>_<dir>_<slot>` static loads for the four cardinals (paper-doll retention) — hoist the direction list into a local retained constant (e.g. `PAPER_DOLL_OVERLAY_DIRECTIONS = ['down','up','left','right']`) so the static overlays still register.
- [ ] Run `npm test`. Expected: RED on `asset-manifest-test.mjs` (checks 31/32 + line 427) — resolved in B2. All other suites green.

### Task B2: Reconcile Foundation D

- [ ] `tools/asset-manifest.mjs`: remove the `player_attack_*`, `equipment_walk_*`, and `equipment_attack_*` `push()` declarations (lines ~737-795); keep the `equipment_*` static declarations; update the local `OVERLAY_DIRECTIONS` (line 381) → paper-doll retained set; remove the retired `weapon-*-attack` entries from the special-case list (~451).
- [ ] `tools/asset-manifest-test.mjs`: remove check 31/32's `equipment_walk_`/`equipment_attack_` assertions and the top-down attack-strip expectations; update the live-read at line 427 to the retained set (or drop `overlayDirections` if unused after).
- [ ] Regenerate: `npm run assets:manifest:write`, review the `assets/manifest.json` diff (only the retired families disappear; `paperdoll_*` + `equipment_*` static remain).
- [ ] (Optional, Fable's call) `git rm` the retired PNG files (`assets/*-{up,down,left,right}-attack.png`, `assets/*-*-*-attack.png`, `assets/*-*-*-walk.png`) — a large binary diff; defer to sub-project 5 unless Fable wants it now.
- [ ] Run `npm test` + `npm run assets:verify`. Expected: green. Commit.

---

## PHASE C — Replace top-down presentation tests (never silently drop)  *(spec §9)*

> Land these BEFORE Task A7 so nothing references the removed symbols. `combat-progression-test.mjs`, `identity-progression-test.mjs`, `onboarding-test.mjs`, `terrain-test.mjs`, `adaptive-joystick-test.mjs` (the `?iso=1` param becomes a harmless no-op there), and `smoke-test.mjs` are NOT modified (verify smoke boots iso with no top-down assumption — it launches default, and farm is already iso).

### Task C1: `tools/iso-test.mjs`
- [ ] Suite 2 (flag plumbing, ~34-53): rewrite so it asserts every area (farm, town, wilds, deepwoods, mine) renders iso by default; delete the `?iso=1 turns iso on` and `unported areas default to top-down` assertions (both moot/inverted).
- [ ] Suite 2b (`?iso=0` forces top-down, ~56-63): **delete** (escape hatch removed).
- [ ] `topDownCamera` "top-down screen point resolves exact world tile" suite (~237-247): **delete**; confirm the iso tap-math suites (~212+) already assert exact-tile resolution (they do). Note the deletion + iso coverage in the PR.
- [ ] "iso and top-down Town saves share one schema" suite (~686-721): simplify to a single iso Town save assertion (schema is renderer-independent; the "share one schema" premise is moot). Remove the `eldoria_iso='0'` flip.
- [ ] Suite 17 "top-down escape hatch keeps cardinal facings" (~840-880): **delete** (tests `cardinalFromVector`/`FACING_TO_CARDINAL`/attack overlays under `?iso=0`, all removed). Facing-octant coverage is retained by Suite 16.
- [ ] Suite 16 (eight-direction facings, ~796-835): **keep** unchanged.
- [ ] Remove every remaining `localStorage.setItem('eldoria_iso', …)` and drop redundant `?iso=1` launch params (optional) throughout.
- [ ] Run: `node tools/iso-test.mjs`. Expected: green. Commit.

### Task C2: `tools/playtest-fixes-test.mjs`
- [ ] ELD-PT-005 top-down overhang-tap suite (~236-253): **replace with an iso equivalent** — launch iso (default), `activateArea('wilds')`, assert the overhang tap (row+1 AND col+1, per iso `interactAtVisibleTile`) opens combat. The guarded bug still applies in iso; do not drop it. Remove the `?iso=0` / `isoActive()===false` / "the Wilds really is the top-down renderer" assertions.
- [ ] Run: `node tools/playtest-fixes-test.mjs`. Expected: green. Commit.

### Task C3: `tools/zoom-speed-test.mjs`
- [ ] Iso-speed suite (~41-58): remove the top-down measurement (`eldoria_iso='0'`) and the `top-down step remains the base player speed` assertion; keep the iso `ISO_SPEED_MULT` assertion. Retitle to drop "preserve top-down".
- [ ] Run: `node tools/zoom-speed-test.mjs`. Expected: green. Commit.

### Task C4: `tools/npc-sprite-test.mjs`
- [ ] Line ~39 returns `iso: isoActive()`; replace with `iso: true` (or remove the field + its assertion). `?iso=1` launches stay as harmless no-ops.
- [ ] Run: `node tools/npc-sprite-test.mjs`. Expected: green. Commit.

### Task C5 (non-CI cleanup): `tools/full-playtest.mjs`
- [ ] Not in `npm test`; update the comment at line ~213 referencing `ISO_AREAS + isoActive()` so it does not point at deleted symbols. No assertion change. Commit (or fold into C4).

---

## PHASE D — Assert no facing is saved  *(spec §3, §9)*

### Task D1: no-facing-saved assertion through `ingestSaveText`
**Files:** Modify `tools/profile-state-test.mjs` (saves domain; add assertions, do not alter existing ones).

- [ ] **Step 1: Write the failing assertions.** In `profile-state-test.mjs`, inside the running game (`page.evaluate`), add a block that:
  1. serializes a live save and asserts no `facing` key anywhere: `JSON.stringify(JSON.parse(saveText)).indexOf('"facing"') === -1` where `saveText` is produced by the real `saveGame()` path (set `currentProfile`, call `saveGame`, read `localStorage`);
  2. feeds a hand-built save that INCLUDES a bogus `player.facing` through `ingestSaveText(...)` and asserts `result.ok` and that `result.canonicalText.indexOf('"facing"') === -1` (the field is dropped, never stored — no migration);
  3. asserts `SAVE_VERSION === 4` and that `Object.keys(defaultState().player)` is unchanged (no field added/removed).

```javascript
// no-facing-saved contract (sub-project 1): the deletion serializes no facing and adds no save field.
const r = await page.evaluate(() => {
  currentProfile = 'adventurer';
  player.facing = 'down-right';
  saveGame();
  const stored = localStorage.getItem('eldoria_save_adventurer');
  const withFacing = JSON.stringify({ version: 4, area: 'farm', x: 160, y: 256,
    player: Object.assign({ facing: 'left' }, JSON.parse(stored).player),
    areas: JSON.parse(stored).areas });
  const ing = ingestSaveText(withFacing);
  return {
    savedHasFacing: stored.indexOf('"facing"') !== -1,
    ingestOk: ing.ok,
    canonicalHasFacing: ing.ok && ing.canonicalText.indexOf('"facing"') !== -1,
    version: SAVE_VERSION
  };
});
check('facing: saveGame() serializes no facing field', r.savedHasFacing === false);
check('facing: ingestSaveText drops an incoming facing (no migration, no storage)',
  r.ingestOk === true && r.canonicalHasFacing === false);
check('facing: save version unchanged (no new field)', r.version === 4);
```

- [ ] **Step 2:** Run: `node tools/profile-state-test.mjs`. Expected: green (facts already hold — this locks them against regression).
- [ ] **Step 3:** `git add tools/profile-state-test.mjs && git commit -m "Retire top-down: assert no facing is saved via ingestSaveText"`

---

## PHASE E — Docs (retention note, banner-marks, status)  *(spec §8)*

### Task E1: `assets/README.md` retention note  *(§8 stale registry assigns this to sub-project 1)*
- [ ] Add a note that the four-facing generic per-slot **equipment overlays are retained for the Character paper doll only** (`paperDollDirection: 'right'`); the cardinal **attack strips retire with the top-down renderer** (per spec §3; physical/manifest retirement per D1's chosen option). Do not rewrite the per-item contract — that is sub-project 5.
- [ ] Commit.

### Task E2: Banner-mark superseded top-down sections  *(§8)*
- [ ] In `docs/superpowers/specs/2026-07-27-isometric-conversion-design.md`, banner-mark (using the `STEP8_ENVART_CONTRACT_20260804.md` banner pattern) the sections asserting top-down coexistence / parity gates / DOM-combat-under-top-down — now superseded because top-down is retired. Banner only; do not delete content.
- [ ] Commit.

### Task E3: `docs/CURRENT_STATE.md` status update
- [ ] Update the Live-architecture line that still says Wilds/Deep Woods/Mine "remain top-down by default" (line ~20) to record that top-down is retired and all areas render iso; note the rollback window per §7. Keep it a status edit, not an authority change.
- [ ] Commit.

---

## PHASE F — Evidence, review, handoff

- [ ] Tag `pre-retire-topdown` at `836637f` (rollback custody item 1) and push.
- [ ] Capture the five-area iso smoke matrix (farm, town, wilds, deepwoods, mine) — screenshots + zero console errors. Attach to the PR (inspected, not inferred).
- [ ] Full `npm test` green on the exact head; confirm `combat-progression-test.mjs` unmodified (`git diff --stat` shows it untouched).
- [ ] PR body includes: the rollback custody record (§7, all four items), the test keep/replace/delete map, the D1-C two-PR split, and a **North Star alignment** verdict (expected **Intentional interim gap** — retiring a renderer is not a visual upgrade; iso is already the direction).
- [ ] PR body states explicitly: **the paper-doll gear is intentionally retained** — the `paperdoll_*` manifest family and `assets/<profile>-right-*.png` are untouched by 1a; evidence = `asset-manifest-test.mjs` **checks 33/34** stay green. (This is the first thing ChatGPT will probe.)
- [ ] Request ChatGPT non-author review on the exact head; Fable does exact-head acceptance. **Leo merges.** This PR lands before sub-project 2.

---

## Self-Review — spec coverage

- §3 "Deleted: dual-render branches, `OVERLAY_DIRECTIONS`, `cardinalFromVector()`, `FACING_TO_CARDINAL`, `?iso=0/1` override" → A1-A7 (dual-render, cardinalFromVector, FACING_TO_CARDINAL, override) + Phase B (`OVERLAY_DIRECTIONS`, under D1). **`OVERLAY_DIRECTIONS` deletion is the one item gated on decision D1 — flagged, not silently dropped.**
- §3 attack strips retire → Phase B (physical/manifest), gated on D1; superseded by sub-project 5 per §3.
- §3 `paperDollDirection` stays `'right'` + four cardinal overlay sets retained → not touched (A) / explicitly retained (B). Covered.
- §3 Wilds/Deep Woods/Mine default to iso → A7 (isoActive/ISO_AREAS removed → unconditional iso). Covered.
- §3 no facing saved, no migration → Phase D. Covered.
- §7 rollback custody (tagged SHA, five-area smoke, reverse-order rollback, window) → Rollback section + Phase F. Covered.
- §9 mechanics untouched → `combat-progression-test.mjs` not modified (verified in Phase F). Covered.
- §9 presentation tests replaced not dropped → Phase C maps every one. Covered.
- §9 assert via `ingestSaveText` no facing + no new field → Phase D. Covered.
- §9 North Star verdict → Phase F. Covered.
- §8 stale-doc registry items assigned to sub-project 1 (`assets/README.md` retention note; banner-mark iso-conversion spec) → E1, E2. Covered.

**Gaps intentionally surfaced, not silently resolved:** D1 (overlay/attack/manifest scope vs pure-deletion + Foundation-D domain), D2 (`isoActive` removal style), D3 (test map). All three are Fable's to decide before coding.
