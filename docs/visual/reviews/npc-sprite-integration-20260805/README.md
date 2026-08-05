# Town NPC sprite integration — 2026-08-05

## Scope

This bounded integration replaces the isometric Town fallback shapes for Mira,
Bram, and Gunnar with one normalized south-facing idle frame per NPC. The
current NPC data has no facing, walk, or animation state, so the renderer uses
the PixelLab `south` source direction, which maps to Eldoria's `down-right`
engine slot. The existing procedural shape remains the fallback, and the
legacy top-down `assets/npc_mira.png` path is unchanged.

The other seven supplied rotations are intentionally not wired into runtime.
Adding a facing/state system would expand this workstream. They remain
reviewed source material in the contact sheet below, not silently treated as
production-ready runtime files.

## Supplied source packs

Each ZIP contains exactly eight idle rotation PNGs under `Idle/rotations/` plus
`metadata.json`. There are no walk, attack, hurt, or other animation frames.
Every source PNG is 128×128 RGBA with transparent background and one character
frame.

| NPC | PixelLab character ID | Directions | ZIP SHA-256 |
| --- | --- | ---: | --- |
| Mira | `fe739371-4690-48f1-bac3-dcbe9b76c4d1` | 8 idle | `02507CF04FE9CEE1694D73E4E90751437AF7DE0E6AE3A37D3A2E0E679F4CE41F` |
| Bram | `c51c8a9f-4f10-4dde-9cec-2db6b7988512` | 8 idle | `C8E2A1A6F827B0943E5559756BCA41D7EE847615A672EDA5F630157C7BC10303` |
| Gunnar | `aa10971b-ebbf-4293-b701-5b28db54c9a9` | 8 idle | `14A5887F4BFF3A0D29725910086699EF7EB573F30DEFA1E9C2329C4856B054EF` |

Source prompts and exports identify the intended roles: Mira is a warm,
capable Town steward with apron, tied-back hair, travel clothes, and produce
basket; Bram is a sturdy bearded General Store keeper with merchant apron and
pouches; Gunnar is a broad, weathered dwarf-style smith/material historian with
red-grey beard and forge apron. The source metadata declares `high top-down`.

![All supplied idle rotations](source-rotation-contact-sheet.png)

## Deterministic processing

The source direction names were mapped to the engine slots without flipping or
mirroring: `south → down-right`, `south-east → right`, `east → up-right`,
`north-east → up`, `north → up-left`, `north-west → left`, `west → down-left`,
and `south-west → down`. The selected `down-right` files were normalized with
the repository's `tools/pipeline/normalize_sprite.py` using the shared 64×64
engine frame and premultiplied-alpha resize. The committed files are:

- `assets/iso/npc/mira-down-right.png`
- `assets/iso/npc/bram-down-right.png`
- `assets/iso/npc/gunnar-down-right.png`

The selected frames pass the static engine checks for 64×64 dimensions, binary
alpha, bottom anchor, and side padding. Running the full eight-direction pack
through the hero validator is not promoted as a pass: its orientation-dependent
opaque-width spread exceeds the hero threshold (Mira 12 px, Bram 10 px, Gunnar
15 px). That is why this PR ships only the current renderer's single idle
direction rather than weakening a shared validation gate or inventing NPC
movement behavior.

## Runtime behavior and gap

`js/02-data-state.js` registers the three `iso_npc_*_down_right` assets.
`js/08-iso-renderer.js` draws them at the NPC's existing world anchor in Town's
isometric pass and falls back to the prior procedural body/head shape if an
image is unavailable. Interaction, NPC positions, top-down fallback behavior,
save data, and gameplay roles are unchanged.

North Star alignment: **Intentional interim gap.** The supplied sprites move
Town toward the North Star's crisp pixel-art character language and high
top-down/isometric readability, but this PR does not claim complete directional
NPC animation or final visual approval. A non-author visual review and Leo's
runtime acceptance remain required.

The real-render evidence set under
`docs/playtest/2026-08-05-npc-sprite-integration/` includes focused desktop
captures for Mira, Bram, and Gunnar plus Mira at iPad-landscape and phone
portrait sizes. The focused positions keep each NPC in the camera view instead
of claiming that one phone frame can show the whole Town.
