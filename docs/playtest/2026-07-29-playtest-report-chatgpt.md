# Eldoria Full Playtest Findings Tracker

**Repository:** `Galashots/eldoria`  
**Live build tested:** https://galashots.github.io/eldoria/  
**Test date:** 2026-07-29  
**Main revision observed:** `496d712334deb906e6fc44099d1fb185dd27dc58` (documentation-only merge; runtime behavior corresponds to the preceding game revision)  
**Tracker rule:** A finding remains **Open** until its acceptance criteria are implemented and the original reproduction path passes a focused retest.

## Executive verdict

The current build is a functional vertical slice with a surprisingly broad set of working systems. Both profiles boot; farming, cooking, shopping, upgrades, quests, combat, boss victory, loot, save/import, and dumpling collection all execute successfully.

The largest problems are not crashes. They are conflicts between the current game loop and Eldoria's stated product goals:

1. Learning is repeatedly presented as an overt multiple-choice quiz rather than embodied in play.
2. Correct learning answers can produce zero combat progress unless the player rapidly taps a timed button.
3. The Mine reads visually as a forest of repeated shrubs, undermining the final area's identity and boss presentation.

**Visual North Star verdict:** **Intentional interim gap.** The isometric Farm/Town foundation, legible lanes, and large touch UI move in the right direction. Placeholder structures, block-shaped NPCs/props, top-down combat areas, and the Mine's incorrect blocker art keep the current build well below the stated premium pixel-art/HD-2D target. The North Star itself does not need refreshing.

## Scope and test coverage

| Area or system | Coverage | Result |
| --- | --- | --- |
| Title and profiles | Adventurer/Grade 5 and Mage/Grade 2 | Pass |
| Save tools | Export surface, import, reload, profile persistence | Pass |
| Farm | Movement, plant, timed growth, direct harvest, Bonus Harvest | Pass with findings |
| Cooking | Recipe cost, optional bonus question, skip, consume/heal | Pass with finding |
| Town | Mira quests, kill quest assignment, NPC interaction | Pass with findings |
| Store | Buy seeds, sell crop, sell spare gear, permanent HP upgrade | Pass with finding |
| Wilds combat | Correct/wrong answer flow, timed slash, food, flee | Pass with findings |
| Deep Woods | Standard enemy and Shadow Warden boss presentation | Pass with findings |
| Mine | Crystal Wyrm fight, victory, guaranteed Wyrm Scale loot/equip | Pass with findings |
| Dumplings | Single pull, three-pull bundle, duplicate refund/dough, rarity/pity UI | Pass with finding |
| Runtime health | Game-origin console errors/warnings | Pass; none observed |
| Desktop viewport | 1363×936 cloud-browser viewport | Pass with fit finding |
| Phone/tablet layouts | Source/automation evidence only; no true device viewport in this run | Retest required |
| Audio quality/read-aloud | Controls and code path inspected; audio not audibly evaluated | Retest required |

The game's own visible save/export/import workflow was used to position profiles near later-game content so every major zone and boss could be exercised without spending the session walking across placeholder maps. Local package tests could not be executed from this workspace, and the tested commits exposed no external commit-status records, so the repository's automated suite should be rerun during implementation.

## Prioritized findings

| ID | Priority | Status | Finding |
| --- | --- | --- | --- |
| ELD-PT-001 | P1 | Open | Core learning is delivered as repeated overt multiple-choice quizzes |
| ELD-PT-002 | P1 | Open | Timed rapid tapping can erase the benefit of a correct combat answer |
| ELD-PT-003 | P1 | Open | Mine blockers render as dense rows of green shrubs/trees |
| ELD-PT-004 | P2 | Open | HUD health/food state becomes stale after eating or fleeing in combat |
| ELD-PT-005 | P2 | Open | Visible NPC/crop bodies are not fully tappable |
| ELD-PT-006 | P2 | Planned | Add Diablo-led Character & Inventory screens |
| ELD-PT-007 | P2 | Open | Equipped visual layers are not reliably reconstructed from saved gear |
| ELD-PT-008 | P2 | Open | Bosses use the generic math/slash modal and are visually obscured |
| ELD-PT-009 | P2 | Open – interim gap | World presentation is discontinuous and heavily placeholder-dependent |
| ELD-PT-010 | P2 | Open | Wrong answers do not provide a scaffolded retry |
| ELD-PT-011 | P2 | Open | Accessibility/settings surface is too limited |
| ELD-PT-012 | P2 | Open | First-session objective and navigation guidance are insufficient |
| ELD-PT-013 | P2 | Open | Dumpling collection uses kid-facing gacha pressure patterns |
| ELD-PT-014 | P3 | Open | Store's “most gold” learning prompt is mathematically ambiguous |
| ELD-PT-015 | P3 | Open | Canvas extends below the desktop viewport |
| ELD-PT-016 | P3 | Open | Automated test status is not published on the tested revisions |

## Detailed findings and acceptance criteria

### ELD-PT-001 — Overt quizzes dominate the learning loop

**Observed:** Mira quests, Bonus Harvest, cooking bonuses, and every combat turn open a conventional multiple-choice arithmetic question. Examples included `7 × 9`, `8 − 1`, `20 − 7`, and “about how much is 71 + 32?”.

**Why it matters:** This directly conflicts with the supplied design and pedagogy guidance: learning should be embedded in world actions, resource decisions, dialogue, and environmental problem solving—not feel like a quiz interrupting the RPG.

**Acceptance criteria:**

- Replace at least the first Farm→Town→Wilds learning arc with playable, contextual tasks.
- Retain optional explicit practice only as a non-gating support mode.
- Record evidence from player actions such as planting ratios, route choice, inventory/resource planning, dialogue construction, or world manipulation.
- Verify both Grade 2 and Grade 5 variants preserve the same fantasy while adjusting scaffolding and complexity.

### ELD-PT-002 — Rapid tapping can negate a correct answer

**Reproduction:**

1. Enter any fight.
2. Answer the math problem correctly.
3. Do not tap `SLASH` during the three-second Adventurer or five-second Mage window.
4. Observe zero hits and zero damage; the enemy attacks normally.

**Why it matters:** Learning success is subordinated to a timed dexterity test. This can block younger players and players with motor, attention, fatigue, or touch-accuracy constraints.

**Acceptance criteria:**

- A correct answer always produces meaningful base damage.
- Timed interaction may add a bonus, but cannot reduce correct-answer damage to zero.
- Add a no-mash/reduced-dexterity option and clear feedback.
- Validate with touch, keyboard/switch-friendly control, and both profiles.

### ELD-PT-003 — The Mine visually reads as a forest

**Observed:** The Mine is filled with repeated green shrub/tree sprites arranged in dense rows. The Crystal Wyrm fight takes place over this forest-like scene.

**Acceptance criteria:**

- Replace Mine blockers with cavern-appropriate rock, wall, crystal, rail, ore, or rubble assets.
- Establish a distinct cavern palette, lighting treatment, floor language, and navigable lane hierarchy.
- Verify collision and boss approach remain legible on phone and tablet.

### ELD-PT-004 — Combat consumption and flee leave stale HUD values

**Reproduction:**

1. Start combat below maximum health with one soup.
2. Eat the soup; observe combat health change.
3. Flee.
4. Observe the world HUD can still show the pre-consumption food count and pre-combat health.

**Acceptance criteria:**

- Update and persist HUD state after item use, enemy retaliation, flee, victory, and defeat.
- Add a focused regression test for each exit path.

### ELD-PT-005 — Direct-tap hitboxes do not match visible art

**Observed:** Tapping the upper/body portion of a visible ready crop or Mira did nothing. Tapping near the base tile succeeded.

**Acceptance criteria:**

- The complete visible silhouette of an NPC, crop, enemy, shop, and major prop is tappable.
- Preserve tile-base fallback and prevent overlapping hitboxes from selecting the wrong object.
- Add phone-size tests for every primary interactable class.

### ELD-PT-006 — Character & Inventory milestone

**Direction:** Approximately **75% Diablo III, 25% Minecraft**—closer to Diablo.

**Recommended implementation step:** Build this immediately after the combat/HUD state fixes and before expanding the item pool.

**Experience specification:**

- Full-screen Character & Inventory overlay opened from a dedicated HUD button.
- Diablo-led paper doll with the hero prominent and the existing `head`, `body`, `weapon`, and `cape` slots arranged around the character.
- Inventory grid beside the paper doll, borrowing Minecraft's immediate slot readability rather than its crafting emphasis.
- Tap item → compare → equip; tap equipped item → unequip/swap. Drag may be supported, but never required.
- Clear damage, max-health/defense, rarity, and before/after comparison states.
- Equipped visuals update immediately and restore after reload/profile switch.
- Keep the existing save schema and gear fields where possible; migrate only if necessary.
- Grade 2 mode uses simpler labels/read-aloud; Grade 5 can show richer stat detail.
- Large touch targets, controller/keyboard path, scalable text, and phone/tablet responsive layouts.
- New loot goes to the bag and offers an equip decision; silently auto-equip only into an empty slot, not over an existing choice.

**Acceptance criteria:**

- Equip, unequip, compare, swap, sell, save, reload, and switch-profile tests pass.
- Combat damage and health derive from the displayed equipment.
- No item can be lost during a full bag, swap, or interrupted save.
- The character preview and saved gear never disagree.

### ELD-PT-007 — Saved gear and visible equipment can disagree

**Observed:** Combat loot updates saved gear and reports auto-equipping, while the visual-equipment flags are separate transient state. Reloading does not reliably rebuild those flags from the saved gear object.

**Acceptance criteria:**

- Derive visual equipment directly from canonical saved gear on boot, import, equip, unequip, and profile switch.
- Remove or synchronize duplicate equipment state.
- Cover every slot with reload tests.

### ELD-PT-008 — Bosses are generic and obscured

**Observed:** Shadow Warden and Crystal Wyrm encounters use the same question→slash modal as normal enemies. The large centered modal hides most of the combat scene and boss art.

**Acceptance criteria:**

- Give each boss at least one unique, readable mechanic tied to its identity and learning goal.
- Keep the boss visible during decisions and attacks.
- Add telegraphs, phase feedback, and a distinct victory/trophy moment.

### ELD-PT-009 — World coherence remains an interim gap

**Observed:** Farm/Town are isometric, while Wilds/Deep Woods/Mine switch to a smaller top-down field with black margins. Farm props, Town NPCs, the store, and cookpot are largely colored boxes/cuboids. The polished painted title screen creates an abrupt fidelity shift.

**Acceptance criteria:**

- Complete the staged isometric conversion for the combat regions.
- Replace primary interaction placeholders first: NPCs, cookpot, storefront, exits, enemies, and boss arenas.
- Normalize projection, sprite scale, palette, lighting, shadows, and environmental density.

### ELD-PT-010 — Wrong-answer feedback lacks instructional scaffolding

**Observed:** A wrong Mira answer shows “Not quite—ask me again!” and closes. Retrying generates a different random problem rather than supporting the same problem with a hint, representation, or worked step.

**Acceptance criteria:**

- First miss: contextual hint or visual model.
- Second miss: partial step/choice reduction.
- Third miss: guided solution followed by a similar transfer task.
- Preserve dignity, momentum, and rewards; never punish with lost resources.

### ELD-PT-011 — Accessibility/settings are incomplete

**Observed:** The visible global control is a single sound toggle. There is no settings surface for text scale, separate music/speech/SFX, captions/subtitles, reduced motion, contrast, control alternatives, or read-aloud preferences.

**Acceptance criteria:**

- Add a persistent settings panel covering those controls.
- Never make audio the only channel for instructions.
- Test settings persistence independently for both profiles.

### ELD-PT-012 — First-session goal clarity is weak

**Observed:** Starting a profile drops the player into a large sparse Farm with no short onboarding objective, quest log, waypoint, minimap, or visible “do this next” sequence.

**Acceptance criteria:**

- Add a brief guided-release onboarding: model one action, complete one together, then give an independent goal.
- Maintain a compact current-goal surface and optional waypoint.
- Allow replay/skip and avoid long tutorial text.

### ELD-PT-013 — Dumpling collection uses gacha pressure patterns

**Observed:** The child-facing collection offers discounted bundles, random rarity, a legendary pity counter, duplicate conversion currency, locked silhouettes, and “save for a bundle to get a better deal.” All currency is earned in game and no real-money purchase was observed, but the pressure pattern remains.

**Acceptance criteria:**

- Product/pedagogy review explicitly approves or replaces the mechanic.
- Preferred replacement: visible rotating adoption choices, quest-earned companions, or a transparent no-duplicate collection track.
- If random pulls remain, disclose odds, remove urgency/pressure language, cap grind, and ensure no paid currency or progression advantage.

### ELD-PT-014 — Store question has multiple valid interpretations

**Observed:** “Which seed makes you the most gold? Do the math!” can mean absolute profit, return on investment, or profit per unit time. Most normal crops have the same absolute margin while grow times differ.

**Acceptance criteria:**

- Name the measure and time horizon, such as “profit from one harvest” or “profit in 60 seconds.”
- Explain why the correct choice wins.

### ELD-PT-015 — Canvas extends below the viewport

**Observed at 1363×936:** The canvas rectangle began at `y=57`, had height `936`, and ended at `y=993`, 57 pixels below the viewport. The document client height was 936.

**Acceptance criteria:**

- Fit the playable canvas below the HUD without clipping or hidden interactive content.
- Retest desktop, iPad landscape, common phone portrait/landscape, safe areas, and browser zoom/text scaling.

### ELD-PT-016 — Automated verification is not visible on tested commits

**Observed:** The repository defines integrity, asset, smoke, proof, and isometric tests, but the tested runtime/main revisions exposed no associated commit-status or workflow-run records through the repository integration.

**Acceptance criteria:**

- Run the full `npm test` chain on pull requests and `main`.
- Publish required status checks and retain relevant screenshots/artifacts for responsive/isometric checks.

## Recommended implementation order

1. Fix state integrity: ELD-PT-004 and ELD-PT-007.
2. Fix core interaction/accessibility: ELD-PT-002 and ELD-PT-005.
3. Implement Character & Inventory: ELD-PT-006.
4. Replace quiz interruptions with one complete playable learning arc: ELD-PT-001 and ELD-PT-010.
5. Repair Mine/boss/world presentation: ELD-PT-003, ELD-PT-008, and ELD-PT-009.
6. Add onboarding/settings and resolve the dumpling design decision: ELD-PT-011 through ELD-PT-013.
7. Address polish/verification items: ELD-PT-014 through ELD-PT-016.

## Retest protocol

When an item is claimed fixed:

1. Record the implementation commit/PR in this tracker.
2. Run the finding's original reproduction steps.
3. Run the full automated test chain.
4. Exercise both profiles and at least desktop, iPad landscape, and phone portrait.
5. Mark **Resolved** only when acceptance criteria pass; otherwise return it to **Open** with new evidence.

