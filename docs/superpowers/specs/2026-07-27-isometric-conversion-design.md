# Isometric Conversion — Engine Design Spec

> **PARTIALLY SUPERSEDED (2026-08-06) — top-down retired.** The combat/armor umbrella design
> (`docs/superpowers/specs/2026-08-05-combat-armor-design.md`) retired the top-down renderer in
> its **sub-project 1**. Every "parallel engine behind a flag", "port area-by-area while the
> live game keeps working", top-down-coexistence, and top-down/DOM-combat parity-gate
> assumption in this spec is now historical: the game renders **isometric-only** in all areas
> (Farm, Town, Wilds, Deep Woods, Mine). The engine-side iso projection, input, and depth-sort
> facts below remain the source of truth; only the coexistence / area-by-area-rollout / parity
> framing is superseded. See `docs/superpowers/plans/2026-08-06-retire-topdown.md`.

- **Date:** 2026-07-27
- **Game:** Realm of Eldoria (original / `eldoria-public`, single-file `index.html`)
- **Status:** Engine design approved; Phase 0/Farm and the first bounded Town slice are merged. Production-art generation is governed by `tools/pipeline/PIPELINE.md`.
- **Companion doc:** `tools/pipeline/PIPELINE.md` (adopted production-art route). The former
  `tools/3D_ISO_SPRITE_PIPELINE.md` generation route is historical after PR #13; **this file
  remains the engine-side source of truth.**
- **Author:** Leo + Claude (brainstorming session; visual mock approved at
  `mockups/iso-preview.html`)

## 1. Summary & goal

Convert Realm of Eldoria from flat top-down rendering to **true 2:1 isometric** (diamond tiles),
with an art direction that is **sleek and slightly badass — not cutesy, not storybook**. The
conversion is **render + input only**: every game system (farming, combat, economy, cooking,
quests, saves, the incoming dumpling collection) keeps running unchanged in the existing
orthogonal world space. The game stays a single-file, offline, 2D-canvas app.

## 2. Locked decisions & flagged defaults

Locked in brainstorming (Leo, 2026-07-27):
1. **True 2:1 isometric** (diamond tiles, classic 2:1 projection). Mock approved.
2. **Parallel engine behind a flag, Farm-first** — port area-by-area (Farm → Town → Wilds →
   Deep Woods → Mine); the live game keeps working the whole way.
3. **Screen-relative joystick** — pushing up moves the hero toward the top of the screen, always.
4. **Placeholder-first** — the iso engine ships on programmatic diamonds/prisms; real art comes
   from the 3D→iso render pipeline afterward.
5. **Art direction: sleek, a little badass.** Rich/moody palette, bold silhouettes, rim light.
6. **Dumplings stay 2D** and are untouched by this conversion (their UI is DOM, see §10).

Defaults adopted, **veto anytime before Phase 3** (art production is when they harden):
- **D1 — 4 facings** (not 8). Doubles are cheap to add later; start simple.
  **SUPERSEDED 2026-07-30 by owner call (iso mode):** heroes run all 8 facings in iso with
  per-facing walk strips; the four world-diagonal slots (down-right=S, down-left=W,
  up-left=N, up-right=E) joined the original four (right=SE, down=SW, left=NW, up=NE).
  The top-down escape hatch stays cardinal — its attack/equipment art only exists for
  the original four facings.
- **D2 — Equipment as cohesive gear-tier looks** (not per-slot paper-doll overlays) for iso art.
  Interim: iso base bodies + NO separate equipment overlays; gear still applies statistically.
  (See pipeline doc §6; revisit if the kids miss visual mix-and-match.)
- **D3 — Character frames 64×64**, ground tiles **64×32** diamonds.

## 3. Current engine facts (verified against `index.html`, 2026-07-27)

| Fact | Value / location |
|---|---|
| Tile size | `TILE = 32` (line ~777) |
| Map dimensions | `MAP_W = 30`, `MAP_H = 22` (lines ~778–779) — world is 960×704 px |
| Canvas | fixed `640×480` (`#game`, line ~540), CSS-upscaled, `image-rendering: pixelated` |
| Camera | **already a follow camera**: `camX/camY` centered on player, clamped to map bounds (draw loop, ~line 3592) |
| Movement | axis-separated pixel movement with per-axis collision: `boxIsBlocked(player.x + dx, player.y)` then `(player.x, player.y + dy)` (~lines 3262–3263) |
| Facing | derived from dominant velocity axis; horizontal wins ties (~lines 3251–3252) |
| Position | `player.x/y` in world pixels; saves store them raw |
| Sprites | `SPRITES` registry + `loadSprite`/`spr` with **fallback shapes when art is missing** (~800–875) |
| Frames | walk strips 4×110 ms, attack strips 4×80 ms; `drawSpriteFrame` reads horizontal strips hardcoded to `TILE` (~924–934) |
| UI | ALL menus/modals/HUD are **DOM overlays**, not canvas — combat, shop, cooking, quests, seed picker |
| Decorations | fences/signposts drawn as canvas shapes (~3382+) |

## 4. Architecture principle: world space is sacred

**Nothing in game logic changes.** Positions, collision, crop plots, enemy spawns, doors, travel,
and saves all stay in the existing orthogonal pixel space (`px ∈ [0, MAP_W·TILE)`,
`py ∈ [0, MAP_H·TILE)`). The isometric layer is exactly two transforms:

1. **Render:** world → screen projection (§5) + depth-sorted painter's algorithm (§7).
2. **Input:** joystick screen-vector → world-vector inverse transform (§6).

This is what makes the parallel-engine plan safe: flipping the flag swaps *how the same world is
drawn and steered*, never what the world *is*. Old saves work in both modes by construction.

## 5. Projection & camera

With `TILE = 32` and a 64×32 diamond (`ISO_TW = 64`, `ISO_TH = 32`), the world→screen map is
integer-friendly:

```
sx = px - py            // = (px − py) · ISO_TW / (2·TILE), coefficient exactly 1
sy = (px + py) / 2      // = (px + py) · ISO_TH / (2·TILE), coefficient exactly 0.5
```

Inverse (used by input mapping, §6):

```
px = sy + sx/2
py = sy - sx/2
```

- A tile's diamond center for grid cell `(row, col)` is the projection of its world-space center
  `((col + 0.5)·TILE, (row + 0.5)·TILE)`.
- **Camera:** reuse the existing follow-camera logic, but computed in projected space: center on
  the projected player position, clamped to the projected map footprint
  (width `(MAP_W + MAP_H)·TILE = 1664 px`, height `(MAP_W + MAP_H)·TILE/2 = 832 px`, plus
  headroom for tall props at the top edge). Same 640×480 canvas.
- All world→screen draws go through ONE pair of helpers (`isoSX(px,py)`, `isoSY(px,py)`), applied
  after camera subtraction — a single choke point, no scattered math.
- **Note for implementers:** raw `sx` is negative for the map's left half (`px < py`). Add the
  constant `+ MAP_H·TILE` (=704) inside the helper so projected x starts at 0; the camera clamp
  then works in non-negative coordinates. (Remember the matching `−704` in the inverse if you
  invert helper output rather than raw `sx`.)

## 5b. Responsive viewport (phone-first playtesting — Leo, 2026-07-27)

Leo playtests on his **phone** regularly; the kids play on **iPad**. Today's canvas is a fixed
640×480 backing store CSS-scaled to `min(96vw, 960px)` at a locked 4:3 aspect (`#game`, ~line 58)
— on a portrait phone that letterboxes into a small window. In **iso mode** the canvas becomes
fully responsive:

- **Backing store = container size × devicePixelRatio** (DPR capped at 2 to bound fill cost on
  3× phones), recomputed on `resize` / `orientationchange`. CSS size fills the available viewport
  (minus HUD/controls), any aspect — portrait, landscape, notch and all (`viewport-fit=cover` +
  `env(safe-area-inset-*)` padding on the joystick/Action button if needed).
- **Zoom rule — fixed world height, variable width:** choose scale so a constant
  `TARGET_VIEW_ROWS` (~14 diamond-rows ≈ 448 world px, tune at the Phase 1 gate) always fits
  vertically: `scale = canvasCssHeight / (TARGET_VIEW_ROWS · ISO_TH/2 …)` — implemented as a
  single `ctx.setTransform(scale·dpr, 0, 0, scale·dpr, …)` before the camera translate. A phone
  simply *sees fewer columns* than the iPad; the follow camera already handles any viewport size.
  Nothing about the world, speeds, or logic changes — same sacred-world principle.
- **Same experience guarantee:** identical vertical field of view on every device means combat
  cues, crops, and enemies stay the same on-screen size; only horizontal reach differs. No
  device-specific art or layouts.
- **Mode switching:** entering an iso area applies responsive sizing; entering a still-top-down
  area restores the legacy fixed 640×480 store (one `applyCanvasMode()` on area change). The
  legacy path is never touched beyond that restore call.
- **DOM UI:** modals/HUD are already viewport-positioned and touch-first; verify small-phone
  fit (modal `max-height` + scroll) in the §11 device matrix rather than redesigning them.

## 6. Input: screen-relative joystick

The joystick produces a screen-space vector `(jx, jy)`. In iso mode, transform it through the
inverse projection into a world-space velocity, then normalize to the existing speed:

```
wx = jy + jx/2
wy = jy - jx/2
(wx, wy) → normalize → × SPEED
```

Sanity checks: push **up** `(0,−1)` → world `(−1,−1)` → projects to screen `(0,−1)` = straight up
on screen ✓. Push **right** `(1,0)` → world `(0.5,−0.5)` → screen `(1,0)` ✓.

- Movement, collision, and facing derivation code are **unchanged** — they just receive the
  transformed `(dx, dy)`. Facing falls out of the existing dominant-axis rule; ties still resolve
  to the horizontal slot, so walking straight up-screen shows the `left` (NW) sprite — standard
  for 4-facing iso games.
- Facing → on-screen appearance follows the mapping table in the pipeline doc §5E
  (`right`→SE, `down`→SW, `left`→NW, `up`→NE).

## 7. Rendering: two passes, painter's algorithm

**Pass 1 — ground.** For every cell, draw its floor diamond (grass/path/soil/water). Flat floors
don't overlap, so order is free; draw row-major. Crops draw on their soil diamond in this pass
(they're low). Missing iso art → flat colored diamond using the existing tile colors (extends the
current fallback-shape philosophy).

**Pass 2 — objects, depth-sorted.** Collect every tall drawable — trees, house, shop building,
door highlights, NPCs, enemies, cookpot, decorations, the player — each with:
- `anchor`: its world-space base point `(px, py)` (feet / footprint front corner)
- `depthKey = px + py` (equivalently its screen `sy`; larger = nearer)

Sort ascending, draw each **bottom-center anchored** at its projected anchor. The hero correctly
walks behind and in front of things with zero special cases.

- **Multi-tile buildings** (house 4×3, shop 4×3): one sprite, anchored at the footprint's
  nearest (max `px+py`) edge; their tiles stay blocking in world space as today.
- **Tall tiles → objects:** TREE/HOUSE/DOOR/EXIT currently painted as flat tiles become Pass-2
  objects. The map arrays don't change — the iso draw path just routes those tile types to Pass 2.
- **Placeholders (Phase 0):** floor = flat diamonds in existing tile colors; props = simple
  extruded prisms (top diamond + two shaded faces) with a darker rim — deliberately tuned toward
  the sleek/moody direction so even the placeholder build reads "new and cool," not broken.
- **Cues:** the pulsing arrows/`!` indicators re-anchor to projected tile centers (same logic,
  projected coordinates). Canvas-drawn fences/signposts get prism/line equivalents in Phase 0.
- **Combat sparks, damage pops, walk bobbing:** all screen-space effects at projected positions —
  carry over unchanged.

## 8. Art files & engine changes (deliberately small)

**Iso assets live under `assets/iso/`**, basenames identical to today's conventions (see pipeline
doc §3): e.g. `assets/iso/adventurer-down.png` (64×64 idle SW), `assets/iso/adventurer-down-walk.png`
(256×64 strip), `assets/iso/tile-grass.png` (64×32), `assets/iso/prop-tree.png` (64×96, bottom-
anchored). Top-down art stays where it is — both modes coexist during the port.

Engine code changes (complete list — anything beyond this is scope creep):
1. `ISO_AREAS` flag table (per-area boolean) + dev override via `localStorage['eldoria_iso']` so
   we can A/B a single area live with the kids.
2. Projection helpers + camera-in-projected-space (§5).
3. Joystick inverse transform, applied only in iso mode (§6).
4. `drawSpriteFrame` generalized: `(img, stripType, dx, dy, frameW, frameH)` with bottom-center
   anchoring; existing top-down call sites pass `TILE, TILE` — zero behavioral change outside iso.
5. The iso draw path (two-pass renderer, §7) selected per-area by the flag.
6. `loadSprite` registrations for `assets/iso/*` names (missing files fall back per §7).
7. Responsive canvas in iso mode (§5b): DPR-aware backing store, fixed-view-rows zoom transform,
   resize/orientation listeners, and `applyCanvasMode()` on area transitions.

## 9. Phased rollout (kid-playtest-gated)

- **Phase 0 — Engine + placeholder Farm.** Items 1–6 above; Farm renders iso on placeholder
  diamonds/prisms behind the flag. *Gate:* full farm loop (plant → grow → harvest → cook → travel
  to Town and back) playable in iso; headless boot smoke stays clean.
  **DONE 2026-07-27** — 20 automated tests green, CI green, Leo's phone device-check passed
  (placeholders read as "more is coming", collision solid; zoom tuned 14→18 rows on feedback).
- **Phase 1 — Kid playtest on the Farm.** Flag on for the boys; tune movement feel, camera, tile
  readability. *Gate: the kids prefer it (or at worst don't mind it).*
  **STARTED 2026-07-27** — `ISO_AREAS.farm = true` on the live site; `?iso=0` hardened to
  persist a forced top-down opt-out (it previously only cleared the override, which would have
  fallen through to the new iso default). Gate awaits the boys' verdict.
- **Phase 2 — Port remaining areas.** Town (NPCs, buildings) → Wilds → Deep Woods → Mine (enemies,
  combat entry cues). *Gate:* every area playable in iso; combat/quests verified in-world.
  **IN PROGRESS 2026-07-29** — the first bounded Town slice (General Store + Mira) is merged with
  placeholder art; the Forge, other Town villagers, Wilds, Deep Woods, and Mine remain.
- **Phase 3 — Real art.** Use the adopted PixelLab + deterministic post-process route in
  `tools/pipeline/PIPELINE.md`. The Ranger proof and production tooling are merged; the cast and
  Farm landscape concepts are owner-approved. Next: approved-style building kits, normalization,
  validation, and bounded engine wiring for Farm plus the validated Town slice. The engine runs
  all eight facing slots sourced from approved eight-direction rotations (superseding the earlier
  four-diagonal compatibility subset, per the 2026-07-30 owner call).
- **Phase 4 — Default flip.** Iso becomes the default everywhere; top-down remains reachable via
  the flag for one settling period, then the top-down draw path is retired. Not started: the
  Wilds/Deep Woods/Mine defaults stay top-down until Phase 2 combat/quest parity is verified
  there (2026-07-30 non-author review). Hero walk animation in the iso renderer is delivered.

## 10. What does NOT change

Game logic (crops, combat math, economy, quests, XP), save schema (positions are world-space in
both modes — old saves just work), all DOM UI (modals, HUD, answer buttons, dumpling screens),
maps/`blankMap` builders, enemy/NPC placement data, doors/travel logic, audio/speech, profiles,
and the dumpling feature (2D, DOM-based, fully insulated).

## 11. Testing & verification

- **Projection round-trip:** `inverse(project(p)) == p` for corner/center/edge points (dev-console
  assertion in Phase 0).
- **Headless boot smoke** runs through `npm test` in CI with zero console errors; the same suite
  also exercises the isometric interaction, travel, depth, save, and evidence paths.
- **Depth-sort spot checks:** hero behind/in-front of a tree both render correctly on the Farm
  (the exact scenario in the approved mock).
- **Input feel check:** push-up moves hero straight up-screen in iso Farm; door transitions
  preserve position sanity.
- **Device matrix (every phase gate):** Leo's phone portrait + landscape, iPad Safari, desktop —
  identical vertical FOV, crisp rendering at device DPR, no letterboxing, modals fully reachable,
  joystick/Action clear of safe-area insets, orientation change mid-play doesn't break the camera.
- **Save round-trip:** save in iso Farm, reload with flag off → identical world state top-down.

## 12. Risks & mitigations

- **Art volume is the long pole** → placeholder-first; adopted PixelLab generation plus
  deterministic normalization/validation; cohesive gear-tier looks avoid per-slot render volume.
- **Movement feel on tablet** → Phase 1 kid gate before any further investment.
- **Sprite jitter** → single shared foot-anchor rule (pipeline §5F) + bottom-center draw (§8.4).
- **Scope creep in a 4,100-line file** → §8's closed change list; everything else is content.
- **Handoff mid-project** → this spec + pipeline doc are self-contained; no-chat-history rule
  applies. A cold-start agent implements §8 in order, gated by §9.

## 13. Open items

1. Complete the Phase 1 kid preference gate; Farm is live in iso but the boys' recorded verdict is still outstanding.
2. Finish Phase 2 beyond the validated General Store/Mira slice: remaining Town content, Wilds, Deep Woods, and Mine.
3. Land Phase 3 production art through the adopted pipeline, beginning with approved-style building kits and bounded Farm/Town engine wiring.
4. Keep tuning `TARGET_VIEW_ROWS` (§5b) on Leo's phone and the iPad together if playtesting identifies a real visibility problem.
5. Delete `mockups/iso-preview.html` once it no longer provides useful comparison evidence.
