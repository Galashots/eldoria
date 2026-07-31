# Character identity & inventory reference

**Introduced:** Step 5 "Identity and progression surface" (2026-07-31).
**Code:** `HERO_IDENTITIES` in `js/02-data-state.js`, manual equipment in
`js/05-combat-cooking.js` (`equipFromBag` / `unequipSlot`), screen in `js/10-character.js`,
shared modal lifecycle in `js/01-core-canvas.js`.

## Identity mapping

| Internal profile ID | Player-facing role | Grade label | Reader slot |
|---|---|---|---|
| `adventurer` | **Ranger** | Grade 5 | older reader |
| `mage` | **Mage** | Grade 2 | early reader |

- The internal IDs remain the localStorage save-key suffixes (`eldoria_save_adventurer`,
  `eldoria_name_mage`, …), the runtime profile IDs, and the sprite-file prefixes
  (`assets/adventurer-*.png`). **Nothing internal was renamed.**
- The default visible label changed from "Adventurer" to **Ranger**. A locally chosen
  custom name always wins as the hero's name; the canonical role stays visible beside it
  on the Character screen (e.g. `ArcherLeo · Ranger`).
- Ranger and Mage are equal heroes. The grade label records each reader's math level —
  never an easier or harder mode.

## Portrait and paper-doll directions

- **Title portraits** use `assets/<id>-down-right.png`. Under the approved
  eight-direction mapping, `down-right` IS compass **south** — the strongest
  face-visible identity view. Rendered `object-fit: contain` + `image-rendering:
  pixelated`, never cropped or smoothed. The legacy anime-style `*-portrait.png` files
  are removed; git history is sufficient provenance.
- **The Character-screen paper doll** uses the `right` (iso south-east) view instead,
  because equipment overlays are authored for the original four facings only — `right`
  is the face-visible view that can also dress its hero. Layer order: cape (behind) →
  base hero → body → head → weapon. Static images only. A missing overlay hides only
  itself and never the base hero.
- The generic slot overlays are **not** exact per-item art (one helmet look serves every
  head item). This is an intentional interim gap until future item/state art is approved;
  the screen names the exact item in text.

## Equipment model

Four slots: **Head, Body, Weapon, Cape** (`EQUIPMENT_SLOTS`). Saves store bare gear-ID
strings in `player.gear` and `player.inventory` — never item objects. `SAVE_VERSION`
remains 3.

Item-preservation rules (all paths):

- Nothing is ever silently lost; the gear-instance **multiset is preserved** across
  every equip/swap/unequip.
- Duplicate item IDs remain separate inventory instances; manual actions act on the
  exact tapped index.
- Invalid indices/slots are no-ops.
- Profile A's equipment actions never change profile B.

**Auto-equip on loot (unchanged):** a better dropped item auto-equips and the replaced
item goes into the bag; an equal-or-weaker drop goes straight into the bag.

**Manual equip (`equipFromBag(index)`):** validate index and gear ID → identify the
item's slot → remove that exact instance from the bag → move the currently equipped item
in that slot into the bag, if present → equip the selected item → update HUD and
Character screen → save immediately. Manual **downgrades are allowed** — the kid chose.

**Manual unequip (`unequipSlot(slot)`):** validate slot → move its item into the bag →
clear the slot → update HUD and Character screen → save immediately.

Combat attack updates flow through the existing `playerDamage()` path automatically —
it reads `player.gear` live.

## Comparison rule

Bag entries show an explicit, child-readable total-Attack comparison against the equipped
item in that slot, computed from the live `playerDamage()`:
`Attack 18 → 21 (+3)` · `Attack 21 → 18 (-3)` · `Same Attack`.

## Selling

The Character screen displays sell value, but gear is sellable **only through the
General Store** (equipped gear is never listed there). Spare gear price remains
`damage × 5`.

## Boss trophies

`GEAR` carries presentation-only metadata (`tier`, `source`, `trophy`) that changes no
number. Trophy items get a 🏆 marker everywhere they appear:

- **Eldoria Blade** — Shadow Warden trophy (best weapon, guaranteed boss/trophy drop on
  every win — chance 1 in the loot table).
- **Wyrm Scale Armor** — Crystal Wyrm trophy (best armor, guaranteed drop on every win).

## Screen access and layout

- HUD **Hero** button (accessible name "Open character and equipment"), ≥44×44 CSS px,
  disabled while no profile is active. Opening freezes movement; closing restores
  movement and focus.
- Desktop / iPad landscape: two columns — identity + paper doll + live progression stats
  left, equipped slots and bag right. Phone portrait: one scrolling column, identity and
  paper doll first, equipped slots before the bag, no horizontal scrolling, all actions
  ≥44×44. The world stays visible only as a subdued inert background.
- Progression stats are live runtime values (`playerDamage`, `gearDamageBonus`,
  `xpForNextLevel`, upgrade counters) or derived from them by subtraction — no
  duplicated combat math.

## Shared modal lifecycle (Foundation C2)

All overlays — math bonus, shop, dumpling, save tools, seed picker, cooking, double
batch, combat, quest, and the Character screen — route their DOM/accessibility lifecycle
through the shell in `js/01-core-canvas.js`: one active modal, focus moved inside and
trapped (Tab/Shift+Tab), Escape mapped to each modal's existing safe path (combat →
flee, bonus questions → skip, quest → decline, panels → close), background inert,
focus restored on close, and stack cleanup on indirect closes (profile switch, combat
victory). Gameplay flags stay with their modals; the shell owns presentation only.

## Deferred (out of Step 5's scope)

New equipment sprites / per-item icons, eight-direction equipment overlays,
attack/cast/hurt state production, and any PixelLab generation (paused). The full
repository asset manifest is a separate Foundation D outcome.
