# 3D → Isometric Sprite Animation Pipeline (portable handoff)

**Purpose:** a reproducible way to produce *sleek, slightly badass* animated sprites for the
isometric relaunch of Realm of Eldoria by modelling and animating characters in **3D**, then
**pre-rendering** them to 2D sprite sheets at the isometric camera angle.

**Portability promise (read this first):** this document is written so **any assistant — Claude,
ChatGPT, or Kimi — plus Leo can execute it without the conversation that produced it.** It is
self-contained. The "art" is made *deterministic* by a committed Blender Python script, so whoever
picks this up regenerates identical sprites by re-running one command. If you are a model taking
over, jump to **§9 Handoff checklist**.

**No-chat-history rule:** everything needed to continue lives in **this repository** (this file,
`tools/SPRITE_PIPELINE.md`, `docs/superpowers/specs/`, and `index.html` itself). Never assume
knowledge from a previous assistant's conversation or memory; if something isn't written down here,
ask Leo rather than guessing.

---

## 0. TL;DR

Concept image → **TRELLIS** image-to-3D → **Blender** (clean, rig, animate) → **orthographic iso
camera render** (4 facings × {idle, walk, attack}) → trim to a shared foot-pivot, downscale, pack
into horizontal frame strips → drop into `assets/` with the game's existing filenames. The engine
already auto-loads any PNG that matches the naming and falls back to a shape if it's missing, so
installs are incremental and safe.

## 1. Interpretation & scope (assumption — correct me if wrong)

"3D animate the sprites" here means **pre-rendered 3D**: we build and animate 3D models, but the
game **stays a 2D `<canvas>` sprite engine** (single-file vanilla, offline). We render the 3D
models down to 2D sprite sheets at the iso angle — the classic *Diablo II / Donkey Kong Country*
technique. This gives the sleek, dimensional, slightly-badass look **without** turning the game
into a real-time 3D/WebGL app.

> **Off-ramp:** if Leo actually wants *real-time* 3D in the browser (models rendered live), that is
> a fundamentally different and much larger project (a three.js/WebGL rewrite that abandons the
> single-file 2D engine and the iso-sprite plan). That is **not** this pipeline. Flag it and re-plan
> if that's the intent.

## 2. Art direction (locked)

- **Sleek, a little badass. NOT a cutesy kid game, NOT storybook.** The boys liked the edgier look.
- Rich, moody, saturated-but-not-pastel palette. Bold, readable silhouettes. Confident rim-lighting.
- Consistency across every asset comes from a **fixed light rig + camera** in the render script
  (§5E) — that's what makes 3D-rendered sprites look like one cohesive set instead of patchwork.

## 3. The engine contract (what the pipeline MUST output)

From `index.html` (sprite system ~lines 800–940) and `tools/SPRITE_PIPELINE.md`:

| Thing | Today (top-down) | Isometric target |
|---|---|---|
| Frame size | 32×32 (`TILE`) | **64×64 recommended, foot-anchored** (iso characters are taller than a tile) |
| Facings | 4: `down, up, left, right` (`player.facing`) | 4 iso facings to start (SE, SW, NE, NW) mapped onto the existing `down/left/up/right` slots; 8 later if wanted |
| Idle | static single frame | static single frame |
| Walk | 4-frame horizontal strip, `WALK_FRAME_MS=110` | same frame count + timing |
| Attack | 4-frame horizontal strip, `ATTACK_FRAME_MS=80` | same |
| Strip layout | frames laid left→right; `drawSpriteFrame` reads `(frame*TILE, 0, TILE, TILE)` | generalize to `(frame*frameW, 0, frameW, frameH)` (small engine change, see §5G) |
| Naming | `assets/<profile>-<dir>.png`, `-<dir>-walk.png`, `-<dir>-attack.png`; equipment `-<dir>-<slot>[-walk\|-attack].png`; enemies `assets/enemy_<type>.png` | **keep identical names** so `loadSprite` picks them up with zero code churn |
| Profiles | `adventurer` (older), `mage` (early) | same two |
| Layering | paper-doll: cape → body → head → weapon | see §6 — decide before scaling |

**Golden rule:** match the existing filenames + frame counts and the engine barely changes.

## 4. Tools (all free / already in Leo's kit; model-agnostic)

1. **Concept image** — Foundry / ChatGPT image GPT (existing art guardrail: personal PC only).
   One clean character on a plain, uncluttered background, ¾ front view, full body, neutral pose.
2. **Image → 3D** — **TRELLIS** (image-to-3D). Output: a textured mesh (`.glb`).
   **Access note for a cold-start agent:** Leo has a working TRELLIS.2 setup proven on his other
   kid-game project (Ninja Merge Academy) — its location/setup is NOT in this repo, so **ask Leo
   where it lives** before improvising. If it's unavailable, any image-to-3D tool that outputs a
   textured `.glb` satisfies this stage.
3. **Rig + animate** — **Mixamo** (free auto-rig + humanoid idle/walk/attack) for humanoids; hand-keyed
   loops in Blender for non-humanoids (enemies). **Note:** Mixamo needs a free Adobe login — if you
   (the agent) lack browser/account access, hand this step to Leo with the exact upload/download
   instructions.
4. **Model, light, render** — **Blender** (free, Python-scriptable). This is the **portability
   keystone**: a committed `render_iso_sprites.py` does the deterministic iso render + frame export.
5. **Pack/post-process** — extend the repo's existing `tools/*.mjs` (magenta-knockout, trim, slice,
   pack) or do it in Blender's compositor. Output = strips matching §3.

## 5. Pipeline, stage by stage

**Stage A — Concept reference.** Generate a clean full-body ¾-front concept in the locked art
direction (§2). Optionally a back view to help TRELLIS. Keep the background plain.

**Stage B — Image → 3D (TRELLIS).** Produce a textured `.glb`. Sanity-check scale and that the
mesh is watertight enough to animate.

**Stage C — Import & prep in Blender.** Clean obvious artifacts; set **origin at the feet**
(pivot!), **+Y = forward**, real-world-ish scale. Apply transforms.

**Stage D — Rig + animate.** Auto-rig via Mixamo (or Blender Rigify), import back. Author/retarget
**idle** (loop), **walk** (exactly 4 key display-frames to match the strip), **attack** (4 frames).
Keep motion snappy — this reads better once downscaled.

**Stage E — Iso camera + light (the deterministic heart).**
- **Orthographic** camera (no perspective — that's what makes tiles/sprites tile cleanly).
- **Angle:** for the **2:1 pixel-iso** we chose (2:1 diamond tiles), use camera elevation
  `atan(1/2) ≈ 26.57°`, azimuth `45°`. (Note: "true isometric" is `30°`; we want `26.57°` to match
  2:1 tiles. Pick one and keep it identical everywhere.)
- **Facings:** keep the camera fixed; **rotate the character** by `0/90/180/270°` and render each →
  the 4 iso facings. (Add `45°` steps later for 8.)
- **Facing → engine-slot mapping (explicit — do not guess).** The projection is
  `x_screen = (col−row)·TW/2`, `y_screen = (col+row)·TH/2`, so grid **+col** appears as the
  screen's **down-right** diagonal (SE) and grid **+row** as **down-left** (SW). The engine's
  existing slots keep their grid meaning:

  | Engine slot (`player.facing`) | Grid direction | Renders as iso facing |
  |---|---|---|
  | `right` | +col | **SE** (down-right, toward viewer) |
  | `down`  | +row | **SW** (down-left, toward viewer) |
  | `left`  | −col | **NW** (up-left, away) |
  | `up`    | −row | **NE** (up-right, away) |

  Sanity check after the first render: `down` and `right` sprites must show the character's
  **face**; `up` and `left` must show the **back**. If mirrored, your character yaw sign is flipped.
- **Light rig:** fixed key + fill + rim, documented as constants so every asset matches. The rim
  light is what gives the "sleek/badass" edge.
- **Render:** each facing × each animation × each frame → PNG **with alpha**, supersampled (e.g.
  render 4× target then downscale) for clean edges.

**Stage F — Trim, anchor, downscale, pack.**
- Trim every frame against a **single shared foot-anchor pivot** (all frames + facings use the same
  pivot, or the sprite jitters).
- Downscale to the target frame size (§3). Optional light palette-quantize/outline pass to sit
  consistently in the game.
- Pack frames left→right into strips; name per §3.

**Stage G — Integrate.**
- Drop PNGs into `assets/` — `loadSprite` auto-picks them; missing files fall back to shapes, so
  partial installs never break the build.
- **Engine change for iso:** generalize `drawSpriteFrame` from hardcoded `TILE` to a `frameW/frameH`
  + **bottom-center (foot) anchor** so a 64-tall sprite stands correctly on a 2:1 tile. This is the
  only required code change and belongs in the iso-engine spec.
- Map the 4 iso facings onto `player.facing` slots.

## 6. Equipment / paper-doll — DECIDE before scaling

The current game layers 4 separate gear overlays per direction/animation. In 3D that's costly.

- **Option 1 — cohesive "looks" (recommended for relaunch):** model gear ONTO the character and
  render a small number of whole outfits (e.g. one per gear tier). Simpler, fewer renders, and more
  on-brand for a "sleek" look. Trade-off: loses granular mix-and-match.
- **Option 2 — 3D paper-doll:** render each slot as a separate overlay sharing the exact rig,
  camera, and pivot. Preserves current mix-and-match; far more render + alignment work.
- **Option 3 — interim hybrid:** new 3D base body now, keep existing 2D equipment overlays on top,
  convert gear to 3D later.

Recommendation: **Option 1** for the iso relaunch; revisit if the kids miss mixing gear.

## 7. Deterministic reproducibility (the portability guarantee)

- Commit the **source model(s)** and **`render_iso_sprites.py`** into `tools/3d/`. These are the
  source of truth; the PNGs in `assets/` are generated artifacts. (`tools/3d/` does not exist yet —
  the first agent to run Stage E creates it, plus a `tools/3d/README.md` recording tool versions.)
- **Pin the Blender version** (record it in the script header and `tools/3d/README.md`). A
  committed script is only deterministic if everyone renders with the same Blender release.
- Put every knob (camera angle, resolution, supersample, light rig, frame counts, pivot rule,
  facing count) as **constants at the top of the script** — one place to tune.
- Documented regenerate command (example):
  ```
  blender -b tools/3d/eldoria_rig.blend -P tools/3d/render_iso_sprites.py -- \
    --profile adventurer --anims idle,walk,attack --facings 4 --frame-size 64
  ```
- Because it's a script, **any assistant can read, modify, or re-run it** — that's how a different
  model (or Leo alone) continues without this conversation.

## 8. First proof slice (do this before anything scales)

1. One character: **adventurer**, 4 facings, {idle, walk, attack}, **no equipment**.
2. Run the full chain A→G.
3. Integrate into the **iso Farm** (behind the existing area-flag) and verify in-game.
4. Only then scale to: `mage` → enemies → gear (§6) → dumplings (§10).

Prove the whole chain on one character first; do not batch-produce before the loop is validated.

## 9. Handoff checklist — "I'm a different model picking this up"

1. Read, in order: **this file**, `tools/SPRITE_PIPELINE.md` (existing 2D conventions),
   `docs/superpowers/specs/<date>-isometric-*.md` (the iso engine spec), and
   `index.html` **lines ~800–940** (sprite loading / `drawSpriteFrame` / facings / frame timing).
   **If no isometric spec exists in `docs/superpowers/specs/` yet, STOP — do not start rendering.**
   The engine side isn't defined; help Leo write that spec first (the locked decisions are in §1–§3
   and §10 here).
2. Confirm tools available: Blender, TRELLIS access, Mixamo, Node (for the `tools/*.mjs` post-step).
3. Outputs go to `assets/` using the **exact names in §3**. Source model + render script live in
   `tools/3d/`.
4. Verify by opening the game: correct art appears; missing art falls back to a shape (never a
   crash). Check the sprite stands on the tile (foot anchor) and doesn't jitter between frames.
5. Follow **§8** — one character, full chain, in-game check — before scaling.

## 10. Open decisions for Leo

- **4 vs 8 facings** (4 is the recommended start; 8 doubles render + storage).
- **Equipment approach** (§6 — recommend Option 1).
- **Target frame size** (recommend 64×64).
- ~~Dumpling turntable synergy~~ **DECIDED (Leo, 2026-07-27): dumplings stay 2D** and are out of
  scope for this pipeline. Their showcase uses a gear/equip-screen-style UI with a 2D spin/squish
  animation — see `docs/superpowers/specs/2026-07-27-dumpling-collection-design.md`. This pipeline
  covers characters, enemies, and world art only.
