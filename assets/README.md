# Sprite assets for Realm of Eldoria

Drop PNG files in this folder with the exact names below. They replace the placeholder
shapes automatically; no code changes are needed. Every asset is optional, so a missing or
broken file falls back safely to the legacy player art (when available), then the existing
colored shape.

**The exhaustive, machine-checked inventory of every committed asset and every runtime
asset slot — including which are required, which are optional, and what each one's
fallback is — lives in [`assets/manifest.json`](manifest.json), documented in
[`docs/ASSET_MANIFEST.md`](../docs/ASSET_MANIFEST.md).** This README stays the human
authoring guide (naming conventions, canvas sizes, draw order); it does not duplicate the
manifest's per-file listing.

- **Format:** PNG. Use transparent backgrounds for crops and players.
- **Size:** the game draws every sprite into a **32 x 32** tile. Make sprites **32 x 32**
  (or a clean multiple, such as 64 x 64, that can scale down cleanly).
- **Offline only:** these load by relative path. Do not link to web URLs.

## Player sprites

The two heroes are **Ranger** (internal profile ID `adventurer`, the older-reader slot)
and **Mage** (internal ID `mage`, the early-reader slot). The internal IDs stay the file
prefixes and save keys; Ranger/Mage is what the kids see (see
`docs/CHARACTER_INVENTORY.md` and `HERO_IDENTITIES` in `js/02-data-state.js`).

The current committed hero contract is **64 x 64 frames**. The engine slices frames by
image height (frame edge = height), so both legacy 32 px and current 64 px frames render
correctly into the 32 px world tile. Keep every frame for a hero on the same palette,
scale, and bottom-center foot anchor.

Both heroes have **all eight static and walk directions committed**:
`down`, `up`, `left`, `right`, `down-right`, `down-left`, `up-left`, `up-right`
(`<hero>-<direction>.png` + `<hero>-<direction>-walk.png`). The original four slots keep
their iso art mapping (right=SE, down=SW, left=NW, up=NE); the four world-diagonal slots
map to the compass cardinals (down-right=S, down-left=W, up-left=N, up-right=E).

UI uses of this art:

- **Title portraits:** `adventurer-down-right.png` / `mage-down-right.png` — the exact
  south-facing (face-visible) slot. The legacy anime-style `*-portrait.png` files are
  retired; git history is their provenance.
- **Character-screen paper doll:** the `right` (iso south-east) view, because equipment
  overlays exist for the original four facings only (below).

`player.png` remains the optional legacy fallback when a selected direction is missing.

### Walk strips

Each hero direction has a four-frame horizontal walk strip named
`<hero>-<direction>-walk.png`: four square frames ordered left to right (256 x 64 at the
current 64 px contract; legacy 128 x 32 strips still slice correctly). The game advances
frames only when the player actually moves; a missing strip safely uses the matching
static base sprite instead.

## Equipment overlays

Base heroes are intentionally drawn without permanent armor, capes, or weapons. Optional
equipment is a separate transparent 32 x 32 PNG for the same hero and direction:

| Pattern | Slot | Draw order |
|---|---|---|
| `<hero>-<direction>-cape.png` | Cloak, wings, or back gear | Behind the base hero |
| `<hero>-<direction>-body.png` | Tunics, armor, or robes | Over the base hero |
| `<hero>-<direction>-head.png` | Helmets, hats, or crowns | Over the base hero |
| `<hero>-<direction>-weapon.png` | Swords, staffs, shields, or tools | Topmost |

`<hero>` is `adventurer` (Ranger) or `mage`; `<direction>` is `down`, `up`, `left`, or
`right` — **equipment overlays are authored for the original four facings only**. The
four diagonal facings have no overlay files, which is why iso mode draws no overlays on
diagonals and the Character-screen paper doll uses the `right` view. Each overlay must
have a transparent background, the same square canvas, palette, scale, and bottom-center
foot anchor as its matching base sprite. Missing overlays are invisible; they never
replace the base hero.

An optional animated overlay uses the same four-frame horizontal format as a base walk
strip: `<hero>-<direction>-<slot>-walk.png`. If it is absent, the static overlay remains
visible while the base body walks.

Three layers of identity art, in governance order:

1. **Permanent canonical identity clothing/props live in the base hero.** The approved
   Ranger and Mage bases carry their own canonical outfits and silhouettes — future
   asset work must preserve that identity, never strip it back to an underlayer.
2. **Generic progression overlays** (one helmet look for every head item, one weapon
   look for every weapon, and so on) layer over that identity to show equipment
   progression. The Character screen names the exact item in text.
3. **Item-specific art is still deferred** — an intentional interim gap until future
   per-item/state art is approved and generated.

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
