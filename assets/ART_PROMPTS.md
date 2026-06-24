# Art Prompts for ChatGPT / DALL-E

> **How to use:** Copy each prompt into ChatGPT (on your personal PC — `DESKTOP-V5MM927`).
> Save each result as a 32x32 PNG with the exact filename listed. Drop them in this
> `assets/` folder — the game picks them up automatically, no code changes needed.
>
> **Important:** ChatGPT/DALL-E generates large images. You'll need to manually shrink
> each result to **32x32 pixels** (or 64x64 for a crisper downscale) using any image
> editor (Paint, GIMP, or an online resizer). Keep transparency for characters and crops.
>
> **Alternative tools** if ChatGPT quality isn't good enough for pixel art:
> [pixellab.ai](https://www.pixellab.ai) or [sprite-ai.art](https://sprite-ai.art)
> are purpose-built for small pixel sprites and will give better results.

---

## Batch 1: Terrain tiles (safe to do now — no gameplay dependencies)

These are the ground tiles that make up the world. Each should be a **32x32 top-down
tile** with a consistent fantasy/medieval palette. They tile seamlessly (the game places
them in a grid).

### grass.png
```
Create a 32x32 pixel art tile of green grass for a top-down 2D RPG. Fantasy style,
warm green tones, slight texture variation so it doesn't look flat when tiled in a grid.
Transparent background is NOT needed — fill the whole tile. Keep it simple and readable
at small size.
```

### water.png
```
Create a 32x32 pixel art tile of calm water for a top-down 2D RPG. Blue tones with
subtle lighter ripple highlights. Should tile seamlessly in a grid. Fill the whole
tile, no transparency needed. Fantasy pond/lake style.
```

### tree.png
```
Create a 32x32 pixel art tile of a dense tree canopy viewed from above for a top-down
2D RPG. Dark green foliage with brown trunk hints. This is used as a border/wall tile
so it should look like a solid tree mass, not a single tree. Fill the whole tile.
```

### soil.png
```
Create a 32x32 pixel art tile of a freshly tilled farm plot for a top-down 2D RPG.
Dark brown earth with visible furrow lines. Should look like prepared soil ready for
planting. Fill the whole tile, no transparency.
```

### path.png
```
Create a 32x32 pixel art tile of a dirt/gravel path for a top-down 2D RPG. Warm tan/
light brown color, slightly textured. Should tile seamlessly for roads and walkways.
Fill the whole tile, no transparency.
```

### house.png
```
Create a 32x32 pixel art tile of a stone/wood building wall for a top-down 2D RPG.
This is the wall of a medieval shop/store. Show stone or timber construction from above.
Fill the whole tile, no transparency.
```

### door.png
```
Create a 32x32 pixel art tile of a wooden shop door for a top-down 2D RPG. Medieval
fantasy style — a warm brown wooden door with simple iron hinges, set in a stone frame.
This is the entrance to a general store. Fill the whole tile.
```

### exit.png
```
Create a 32x32 pixel art tile of a road/path that leads off the edge of the map for a
top-down 2D RPG. Tan/light brown like a dirt road, but with a slight visual arrow or
directional hint suggesting "this way leads somewhere." Fill the whole tile.
```

---

## Batch 2: Crop sprites (safe to do now)

These need **transparent backgrounds** so they sit on top of soil tiles.

### crop_growing.png
```
Create a 32x32 pixel art sprite of a small young seedling plant for a top-down 2D RPG
farming game. The plant is just sprouting — 2-3 small green leaves on a thin stem,
sitting at the bottom of the tile. TRANSPARENT background (PNG). The game will scale
this sprite taller as it grows, so anchor it to the bottom-center.
```

### crop_ready.png
```
Create a 32x32 pixel art sprite of a fully grown, ripe crop ready to harvest for a
top-down 2D RPG farming game. Lush and colorful — a bushy plant with visible
vegetables/produce. Should look obviously "ready" and harvestable. TRANSPARENT
background (PNG). Anchor to the bottom-center of the tile.
```

---

## Batch 3: Player characters (do these carefully — get approval on front-facing first)

> **Process:** Generate the down-facing (front) sprite first for each hero.
> Get approval before generating the other 3 directions. All 4 directions must
> share the same palette, proportions, and bottom-center foot anchor.

### adventurer-down.png (generate FIRST, get approval)
```
Create a 32x32 pixel art character sprite of a young boy adventurer for a top-down 2D
RPG, facing downward (toward the viewer). He is a blonde-haired crystal-kingdom hero,
about 9 years old. He wears ONLY a simple underlayer: fitted cream/off-white shirt,
dark shorts, and tan ankle wraps. NO armor, NO cape, NO helmet, NO weapon — those are
added as separate overlay sprites later. Chibi/cute proportions appropriate for a kids'
game. TRANSPARENT background. Anchor feet to the bottom-center of the tile.
```

### mage-down.png (generate FIRST, get approval)
```
Create a 32x32 pixel art character sprite of a young boy battle-mage for a top-down 2D
RPG, facing downward (toward the viewer). He is a brown-haired boy, about 6 years old,
slightly smaller than the adventurer. He wears ONLY a simple underlayer: fitted cream/
off-white shirt, dark shorts, and tan ankle wraps. NO staff, NO robe, NO hat, NO weapon
— those are added as separate overlay sprites later. Chibi/cute proportions appropriate
for a kids' game. TRANSPARENT background. Anchor feet to the bottom-center of the tile.
```

After approval, generate: `adventurer-up.png`, `adventurer-left.png`,
`adventurer-right.png`, `mage-up.png`, `mage-left.png`, `mage-right.png` using the
same descriptions but changing the facing direction.

---

## Batch 4: Enemy sprites (hold until after playtest)

These are the three Wilds enemies. Currently drawn as colored shapes (green blob,
purple wings, orange brute). Generate these after combat has been playtested and
the enemy roster is finalized.

### Slime
```
Create a 32x32 pixel art sprite of a cute green slime monster for a top-down 2D RPG.
It's the easiest enemy in the game — should look mildly threatening but not scary
(this is a kids' game for ages 6-9). Gooey, blobby, with simple eyes. TRANSPARENT
background.
```

### Bat
```
Create a 32x32 pixel art sprite of a small purple bat monster for a top-down 2D RPG.
Medium-difficulty enemy. Wings spread, cute but a bit menacing. Appropriate for a kids'
game (ages 6-9). TRANSPARENT background.
```

### Goblin
```
Create a 32x32 pixel art sprite of a small orange/green goblin for a top-down 2D RPG.
The toughest basic enemy — stocky, holding a crude club, looks strong. Should be
challenging-looking but not scary (kids' game, ages 6-9). TRANSPARENT background.
```

---

## Notes

- **File format:** PNG, 32x32 pixels, transparent background where noted.
- **Palette:** warm fantasy tones — greens, browns, golds. Match the game's existing
  color scheme (dark brown UI borders `#5a3a1a`, gold accents `#ffd666`).
- **No external URLs.** All files must be local in this `assets/` folder.
- **The game auto-detects these files.** Drop them in, refresh the browser, done.
- **Equipment overlays** (armor, capes, weapons, helmets) are a separate batch —
  don't generate these until the base characters are approved. See `README.md` for
  the full overlay naming convention.
