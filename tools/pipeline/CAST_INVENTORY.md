# Eldoria 2.5D cast & sprite inventory

Complete list of sprites the iso relaunch needs, with the generation route for
each, per `tools/pipeline/PIPELINE.md`. Derived from `index.html`'s asset
loader and the ENEMIES/GEAR tables; excludes dumplings (locked 2D) and gear
overlays (iso spec: cohesive gear-tier looks, decided at Phase 3, not per-slot
overlays).

## Routes

- **A — identity-first (heroes, bosses, NPCs):** ChatGPT concept on a plain
  background (North Star identity control) → PixelLab reference rotation
  (`create-character-v3` or `directions` reference on the 8-direction
  endpoint, retain all 8 directions) → walk/attack animation → normalize →
  validate → review.
- **B — description-only (simple monsters):** PixelLab
  `create-character-with-8-directions` from a text description (the Mage
  calibration test showed description-only quality is high) → same tail.
- **C — tiles & world objects:** PixelLab `create-isometric-tile` /
  `map-objects` for terrain and props; not characters, tracked separately at
  iso Phase 2/3.

Every moving character retains all 8 PixelLab facings as canonical production
source material. The current runtime consumes four diagonal slots
(right=SE, down=SW, left=NW, up=NE) and a 4-frame walk strip per consumed facing
(frame 0 = stand; only 3 distinct poses needed). Heroes additionally need the
current 4-frame attack strip per consumed facing. Do not discard the cardinal
sources or raw animation frames: the owner intends a later bounded
eight-direction runtime upgrade for heroes and moving NPCs/enemies. Overworld
enemies render as a single static sprite today — engine-facing animation remains
a later implementation slice, while retained source coverage keeps that path
open.

## Characters

| Asset | Route | Priority | Notes |
|---|---|---|---|
| `adventurer` (Ranger, older brother) | A | P0 — in flight | Identity approved on PR #11; PixelLab rotation + walk calibration passed 2026-07-28 |
| `mage` (younger brother) | A | P0 | Calibration candidate generated (seed 11) looks strong; regenerate as 8-direction with Ranger palette shared, brotherly duo per North Star |
| `npc_mira` (Town steward / market coordinator) | A | P1 | Kids interact with her every session; identity worth a concept |
| Slime (Wilds t1) | B | P1 | `#5fa860` green; simple blob, description-only |
| Bat (Wilds t1) | B | P1 | `#8866bb` purple |
| Goblin (Wilds t1) | B | P1 | `#bb7744` tan leathers |
| Wolf (Deep Woods t2) | B | P1 | `#888888` grey; quadruped template |
| Bear (Deep Woods t2) | B | P1 | `#7a5230` brown; quadruped template |
| Troll (Deep Woods t2) | B | P1 | `#6b8e4e` mossy green |
| **Shadow Warden (BOSS)** | A | P1 | `#3a2a5a`; capstone fight, guaranteed Eldoria Blade trophy — deserves identity art |
| Rock Golem (Mine t3) | B | P2 | `#7d7468` |
| Magma Slug (Mine t3) | B | P2 | `#c0501f` |
| **Crystal Wyrm (BOSS)** | A | P2 | `#2f6e8f`; endgame boss, guaranteed Wyrm Scale trophy |

## ChatGPT concept prompt pack (route A)

Conventions (all prompts): one character, full body, **South-facing at Eldoria's
high-top-down camera (approximately 35°)**, neutral standing pose, feet visible,
plain flat light-grey background, no shadow on the ground, no text, square image. Style: premium crisp pixel-art
concept for a child-friendly adventure (ages 7–11, sleek not cutesy, not
preschool), rich saturated-but-moody palette, warm upper-left key light with
down-right shadows, bold readable silhouette. These concepts are *identity
references* for PixelLab rotation — silhouette clarity beats detail density.

**Reference and equipment rules verified 2026-07-29 — see
`PIXELLAB_API.md` §1 and §3:**

1. **Establish the target camera in the reference.** Ask for South-facing at
   Eldoria's high-top-down camera (approximately 35°). PixelLab rotates
   direction; do not rely on it to convert an eye-level concept to the game
   camera. Retain all eight rotations.
2. **Player heroes are drawn UNARMED.** Eldoria composites swappable weapons as
   a `weapon`-slot layer. A unique non-swappable boss or NPC may retain a
   silhouette-critical held prop only when the exception is explicit and the
   full rotation/animation set passes visual review. The Shadow Warden's
   greatsword and Mira's basket use that exception; they are not hero equipment.

**Tested Ranger description (manual PixelLab Character workflow):**

> Ranger hero for my 2.5D High Top-Down (35 degrees) kids RPG game,
> Eldoria-V1. Reference image is already provided at the 35 degree top-down
> angle, so vertical perspective shift is not needed, only rotations. The game
> sprites are meant to be no larger than 64x64 pixels in the final product.

This 256×256 manual route produced eight transparent, coherent rotations. Its
cost was not measured; it does not replace the API sizing/cost rules.

**Mage (younger brother of the approved Ranger):**
> Full-body pixel-art concept of a young apprentice mage for a child-friendly
> isometric adventure RPG (ages 7–11, sleek not cutesy). Younger brother of a
> seasoned ranger in a weathered green hooded cloak — design them as a
> complementary duo with clearly distinct silhouettes: the mage is smaller,
> rounder, brighter. Deep-blue hooded robe with silver trim, satchel of
> scrolls, big friendly eyes, brown hair, **empty hands** (no staff — weapons
> are generated as a separate equipment-slot overlay). Premium crisp pixel art,
> warm upper-left light, down-right shadow on the figure only. One character,
> full body, **South-facing at Eldoria's high-top-down camera (approximately 35°)**, neutral standing pose, plain
> flat light-grey background, no ground shadow, no text, square image.

**Mira (Town steward / market coordinator):**
> Full-body pixel-art concept of Mira, a warm, capable Town steward and market coordinator for a
> child-friendly isometric adventure RPG (ages 7–11, sleek not cutesy).
> Practical market apron over adventurer-ish travel clothes, hair tied back,
> holding a small basket of produce, welcoming expression with a hint of
> mischief. Rich warm palette that fits a fantasy farm town. Premium crisp
> pixel art, warm upper-left light, down-right shadow on the figure only. One
> character, full body, **South-facing at Eldoria's high-top-down camera (approximately 35°)**, neutral standing
> pose, plain flat light-grey background, no ground shadow, no text, square
> image.

**Shadow Warden (Deep Woods boss):**
> Full-body pixel-art concept of the Shadow Warden, the forest boss of a
> child-friendly isometric adventure RPG (ages 7–11) — imposing and cool, NOT
> horror. A tall knight-like guardian of living shadow in deep violet-indigo
> armor (#3a2a5a family) with tattered dusk-colored cloak, faint cold rim
> light along the armor edges, eyes glowing soft blue-white, greatsword held
> point-down. Menacing but beatable — a trophy fight a 9-year-old is proud
> of, not scared of. Premium crisp pixel art, warm upper-left key against
> cool shadow tones, down-right shadow on the figure only. One character,
> full body, **South-facing at Eldoria's high-top-down camera (approximately 35°)**, neutral standing pose,
> plain flat light-grey background, no ground shadow, no text, square image.

**Crystal Wyrm (Mine boss):**
> Full-body pixel-art concept of the Crystal Wyrm, the endgame cavern boss of
> a child-friendly isometric adventure RPG (ages 7–11) — majestic, NOT gory.
> A serpentine dragon of deep teal-blue (#2f6e8f family) armored in faceted
> glowing crystals, coiled in a proud S-curve with head raised, restrained
> magical glow from the crystal ridges lighting the cavern-dark body.
> Impressive final-boss presence with a treasure-guardian feel. Premium crisp
> pixel art, warm upper-left key with cool crystal accents, down-right shadow
> on the figure only. One creature, full body, **South-facing at Eldoria's high-top-down camera
> (approximately 35°)**, plain flat light-grey background, no ground shadow, no text,
> square image.

## Status log

- 2026-07-29: manual Ranger Character export `add36c36-295d-4626-94fd-179a4102d1ea`
  produced all 8 transparent 256×256 high-top-down rotations. ChatGPT's
  source-art review recommended the rotation set through the source gate; all
  eight directions remain retained. The South walk export contains 8
  transparent 256×256 frames at 200 ms and is a candidate source animation,
  pending deterministic bottom-center normalization, foot-phase selection,
  complete direction coverage, and runtime inspection.

- 2026-07-28: inventory established. Ranger in flight on PR #11; Mage
  description-only candidate generated during calibration (seed 11,
  `_probe_local/pipeline/calibration/mage/`).
- 2026-07-28 (evening): all four route-A concepts generated via ChatGPT and
  banked in `art-incoming/` (`mage`, `mira`, `shadow-warden`,
  `crystal-wyrm`, each ~1254², flat light-grey bg). Mage identity proven
  through v3 reference rotation (staff + satchel + trim held in all 8
  directions — `_probe_local/pipeline/mage-v3/v3-sheet.png`). Full enemy
  cast generated 8-directional (quadruped templates for wolf/bear, pro mode
  for slime/bat/slug/wyrm); review sheet at
  `_probe_local/pipeline/cast/cast-review-sheet.png`. Reroll candidates
  flagged: goblin (reads as village kid), rock_golem (reads as knight).
  Next: owner review of sheets → v3-rotate Mira + bosses → walk cycles →
  normalize → validate → in-game screenshot.
- 2026-07-28 (late): **owner approved the full cast sheet as-is** ("I love
  all of em") — goblin/rock_golem rerolls waived. Landscape work started:
  isometric tiles use `--tile-shape "thin tile"` (matches the engine's flat
  64×32 diamonds; the default "block" is a tall cube), props via
  `mapobject`. Farm set generating: grass/soil/water/path +
  tree/boulder/flowers/stump/fence/cookpot.
- 2026-07-28 (night): **Farm landscape set complete**, all in
  `_probe_local/pipeline/landscape/`: 16 tiles-pro ground tiles (4
  variations × grass/soil/water/path, engine-shaped diamonds), 6 props
  (tree/boulder/flowers/stump/fence/cookpot), and the composability layer —
  grass→water / grass→soil / grass→path 16-tile transition tilesets plus an
  18-config road autotile set, each with machine-readable `tile_rules`.
  ~180/2000 monthly generations used in total. **Owner approved the
  landscape set** ("everything looks lovely"); next: building kits
  (farmhouse/shop) with `--style-image` locked to approved tiles, then
  Phase-3 engine wiring for tile/prop loading (separate iso-spec work).
- 2026-07-29: ChatGPT non-author review of PR #15 returned REQUEST CHANGES
  (fail-open validator, silent job failures, unverified downloads,
  direction-unsafe sheets, stale create4 example, unimplemented
  style_images, camera-claim overreach). All addressed same night; see
  PIPELINE.md and the PR thread.

## North Star alignment

**Aligned** (process doc). Prompts encode the North Star's binding qualities
directly: complementary brotherly duo with distinct silhouettes, premium
crisp pixel art, warm upper-left light/down-right shadows, restrained glow,
ages 7–11 without preschool tone. Generated art still passes human + North
Star review before any commit.
