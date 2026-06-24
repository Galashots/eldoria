# Sprite assets for Realm of Eldoria

Drop PNG files in this folder with the exact names below. They replace the placeholder
shapes automatically; no code changes are needed. Every asset is optional, so a missing or
broken file falls back safely to the legacy player art (when available), then the existing
colored shape.

- **Format:** PNG. Use transparent backgrounds for crops and players.
- **Size:** the game draws every sprite into a **32 x 32** tile. Make sprites **32 x 32**
  (or a clean multiple, such as 64 x 64, that can scale down cleanly).
- **Offline only:** these load by relative path. Do not link to web URLs.

## Player sprites

The player asset system chooses the selected profile and its last movement direction.
Keep every frame for a hero on the same palette, scale, and bottom-center foot anchor.

| File | What it is |
|---|---|
| `adventurer-down.png` | Adventurer (older-reader slot), facing down/front; approve first. |
| `adventurer-up.png` | Adventurer, facing up/back. |
| `adventurer-left.png` | Adventurer, facing left. |
| `adventurer-right.png` | Adventurer, facing right. |
| `mage-down.png` | Mage (early-reader slot), facing down/front; approve first. |
| `mage-up.png` | Mage, facing up/back. |
| `mage-left.png` | Mage, facing left. |
| `mage-right.png` | Mage, facing right. |
| `player.png` | Optional legacy fallback used when a selected direction is missing. |

Generate and approve the two down-facing seed frames first. Use each approved seed to
derive its up, left, and right frames as one consistent directional set. The current pass
uses idle poses only; walk, harvest, and combat animations can reuse these seeds later.

### Walk strips

Each hero can also have an optional four-frame horizontal walk strip named
`<hero>-<direction>-walk.png`. It is **128 x 32**: four 32 x 32 frames ordered left to
right. The game advances frames only when the player actually moves; a missing strip safely
uses the matching static base sprite instead.

## Equipment overlays

Base heroes are intentionally drawn without permanent armor, capes, or weapons. Optional
equipment is a separate transparent 32 x 32 PNG for the same hero and direction:

| Pattern | Slot | Draw order |
|---|---|---|
| `<hero>-<direction>-cape.png` | Cloak, wings, or back gear | Behind the base hero |
| `<hero>-<direction>-body.png` | Tunics, armor, or robes | Over the base hero |
| `<hero>-<direction>-head.png` | Helmets, hats, or crowns | Over the base hero |
| `<hero>-<direction>-weapon.png` | Swords, staffs, shields, or tools | Topmost |

`<hero>` is `adventurer` or `mage`; `<direction>` is `down`, `up`, `left`, or `right`.
For example: `mage-left-weapon.png`. Each overlay must have a transparent background,
the same 32 x 32 canvas, palette, scale, and bottom-center foot anchor as its matching base
sprite. Missing overlays are invisible; they never replace the base hero.

An optional animated overlay uses the same four-frame horizontal format as a base walk strip:
`<hero>-<direction>-<slot>-walk.png` (128 x 32). If it is absent, the static overlay remains
visible while the base body walks.

The adventurer is a blonde crystal-kingdom hero; the mage is a brown-haired battle-mage with
a short crystal staff as a future weapon overlay. Their base sprites wear only the permanent,
child-safe underlayer: fitted cream shirt, dark shorts, and tan ankle wraps. Reserve all
armor, capes, helmets, footwear, and weapon silhouettes for overlays.

## Terrain and crop sprites

| File | What it is |
|---|---|
| `grass.png` | Grass ground tile. |
| `water.png` | Pond/water tile. |
| `tree.png` | Tree / map border (the blocked edge). |
| `soil.png` | Empty farm plot. |
| `path.png` | Dirt/road path tile. |
| `house.png` | The store building wall. |
| `door.png` | The store door you walk into. |
| `exit.png` | The travel road tile at a map edge. |
| `crop_growing.png` | A young plant, drawn rising as it grows. |
| `crop_ready.png` | A ripe crop ready to harvest. |

`crop_growing.png` is anchored to the bottom of the plot and grows taller in code, so draw
the plant sitting on the ground. The bobbing harvest arrows and blinking highlights remain
on top of all art as gameplay cues.
