# Sprite pipeline — ChatGPT → game-ready PNG

The goal: prompts + a deterministic post-process that **regularly** produce clean 32×32
sprites, instead of fighting ChatGPT for pixel-perfect transparency and alignment.

## The two jobs, split

- **ChatGPT's job (easy, repeatable):** draw a single clean subject on a flat
  **pure-magenta** background. That's it. No transparency, no exact size, no alignment.
- **The script's job (`tools/process-sprite.mjs`, deterministic):** knock out the magenta,
  trim, downscale to 32×32, and — for equipment — shift the piece onto the hero's anchor.

Magenta (`#FF00FF`) is used as the chroma key because ChatGPT removes-background-on-request
unreliably, but it paints a flat solid colour behind a subject very reliably, and magenta
never appears in our warm-fantasy art so it knocks out cleanly.

## Prompt conventions (put these in EVERY prompt)

1. Entire background is **flat pure magenta, RGB 255,0,255 (`#FF00FF`)** — no shadow, no
   ground plane, no gradient, no border, no text.
2. **One subject, centered**, filling most of the frame (more source pixels = cleaner downscale).
3. **Chunky pixel-art, bold dark outline, limited palette**, readable at tiny size.
4. **Irregular/organic silhouette** where appropriate (so it isn't a filled square — that was
   the old `flowers.png` bug).
5. Square image.

## The loop

1. You paste a prompt into ChatGPT (personal PC `DESKTOP-V5MM927` only — art guardrail).
2. Download the result into `art-incoming/` with any name (e.g. `flowers-raw.png`).
3. Tell me it's there. I run `process-sprite.mjs` → writes the real `assets/<name>.png`.
4. I verify in-game (pixel-sample / snapshot) and show you. We tune the prompt or the
   script flags (`--fit`, `--vanchor`, `--nudgeY`, `--tol`) and repeat until it's solid.
5. Once a prompt + flags combo "regularly works", the winner gets folded into `ART_PROMPTS.md`.

---

## Test 1 — flowers (calibration: simplest standalone decoration)

Run this first. It proves the whole loop with the easiest possible subject.

```
Pixel-art cluster of small wildflowers for a top-down 2D RPG, viewed from above at a
slight angle. A loose natural clump of 5–6 blossoms in red, yellow, and blue on short
green stems with a couple of leaves. Chunky pixel-art style with a bold dark outline and
a limited warm-fantasy palette. The clump has an IRREGULAR, organic silhouette (it is NOT
a filled square or rectangle). One clump, centered, filling most of the frame. The entire
background is flat pure magenta, RGB 255,0,255 (#FF00FF) — absolutely no shadow, no
ground, no gradient, no border, no text. Square image.
```

Process: `node tools/process-sprite.mjs --in art-incoming/flowers-raw.png --out assets/flowers.png --bg magenta --fit 28 --vanchor bottom`

---

## Test 2 — equipment overlay (the real target)

Equipment overlays draw on the hero in this order: **cape (behind) → body → head → weapon
(on top)**. Each is generated alone on magenta; the script's `--align assets/<hero>-<dir>.png`
shifts it onto that hero's pixel centroid, and `--vanchor`/`--nudgeY` set its height band.

Start with the adventurer's **down-facing cape** (one piece, one direction) to dial it in
before generating all 4 directions × 4 slots × 2 heroes.

```
Pixel-art hero's cape for a top-down 2D RPG, drawn ALONE with no character or body. Royal
blue cloth cape with a small gold clasp at the top and a rounded lower hem, shown hanging
straight down as seen from behind a small chibi hero (the part of the cape that would be
visible around a character facing toward the viewer). Chunky pixel-art, bold dark outline,
limited palette. Centered, organic silhouette, filling most of the frame. Entire background
flat pure magenta, RGB 255,0,255 (#FF00FF) — no shadow, ground, gradient, border, or text.
Square image.
```

Provisional process (we'll tune the flags after seeing it):
`node tools/process-sprite.mjs --in art-incoming/cape-raw.png --out assets/adventurer-down-cape.png --bg magenta --fit 22 --align assets/adventurer-down.png --vanchor center`

Per-slot anchor starting points (tune in-game):
- **cape** `--vanchor center` · **body** `--vanchor center` · **head** `--vanchor top` ·
  **weapon** `--vanchor center` (may need a horizontal nudge to the hand side later)

---

## Full equipment checklist (run ALL of these for every new armor set)

When adding a new equipment piece, generate **all three sprite types** so the overlay
animates correctly during walk and combat, not just idle:

### 1. Static overlay (2×2 grid → `slice-grid.mjs`)
- Reference: `make-ref-grid.mjs --profile <X>` → 512×512 idle pose grid
- Prompt: "Draw ONLY [equipment] on each pose..." (see examples above)
- Process: `slice-grid.mjs --in <grid>.png --profile <X> --slot <slot> --fit 22`
- Output: `assets/<profile>-<dir>-<slot>.png` × 4 directions

### 2. Walk animation strip (4×4 grid → `slice-anim-grid.mjs`)
- Reference: `make-anim-grid.mjs --profile <X> --anim walk` → 512×512 walk grid
- Prompt: "Draw ONLY [equipment] on each frame, [describe motion]..."
- Process: `slice-anim-grid.mjs --in <grid>.png --profile <X> --slot <slot> --anim walk`
- Output: `assets/<profile>-<dir>-<slot>-walk.png` × 4 directions (128×32 strips)

### 3. Attack animation strip (4×4 grid → `slice-anim-grid.mjs`)
- Reference: `make-anim-grid.mjs --profile <X> --anim attack` → 512×512 attack grid
- Prompt: "Draw ONLY [equipment] on each frame, [describe motion]..."
- Process: `slice-anim-grid.mjs --in <grid>.png --profile <X> --slot <slot> --anim attack`
- Output: `assets/<profile>-<dir>-<slot>-attack.png` × 4 directions (128×32 strips)

**Total per equipment piece per profile: 3 ChatGPT prompts → 12 sprite files.**
Repeat for both profiles (adventurer + mage) = 6 prompts, 24 files per equipment piece.

### Which slots need which animations?
| Slot   | Static | Walk strip | Attack strip | Notes |
|--------|--------|------------|--------------|-------|
| Cape   | ✅     | ✅ flutter | ✅ swirl     | Most visually dynamic |
| Weapon | ✅     | optional   | ✅ swing arc | Walk = just bobbing |
| Body   | ✅     | optional   | optional     | Armor doesn't move much |
| Head   | ✅     | optional   | optional     | Helmet is static |

At minimum: cape (all 3) + weapon attack + static for all 4 slots = 5 prompts per profile.
