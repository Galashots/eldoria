# Asset Manifest (Foundation D)

**Status:** Governance tooling — repository-wide inventory and integrity gate
**Introduced:** 2026-07-31 (Step 6, "Foundation D")
**Files:** `assets/manifest.json` (data), `tools/asset-manifest.mjs` (tool), `tools/asset-manifest-test.mjs` (acceptance suite)

## Purpose

`assets/manifest.json` is the single, machine-readable answer to *"what media exists in this repository, and how is it actually used?"* Before this PR, that answer lived only in scattered code (`loadSprite()` calls, `<img>` tags, CSS `url()`), scattered docs (`assets/README.md`, `tools/pipeline/PIPELINE.md`), and institutional memory. Now:

- every committed media/source-art file is classified exactly once;
- every runtime asset **slot** the game code actually declares is represented, including slots that are intentionally optional or currently missing;
- CI fails the moment any of that drifts — a new unclassified file, a stale hash, a runtime reference the manifest doesn't know about, or a manifest entry the code no longer references.

## Non-goals

This PR is **governance only**. It does not:

- generate, edit, optimize, move, rename, or delete any asset;
- change any runtime loading/fallback behavior, map, save, or gameplay logic;
- replace the specialized gates it records (`validate_sprites.py`, `process-crop-sheet.mjs`, `process-ranger-source.mjs`, `check-ranger-png-integrity.mjs`) — it routes to and documents them, never duplicates their sprite-quality checks;
- build a repository-wide asset *pipeline* or loader refactor. It is an inventory and a drift gate.

## Schema concepts

`assets/manifest.json` has two top-level arrays plus a `policy` block.

### `policy`

- `trackedExtensions` — the file extensions this manifest governs (images, audio/video, art/3D source formats, fonts), so a newly-added format can't silently bypass the gate.
- `excludedPathPrefixes` — a narrow, explicit list (`artifacts/`, `_probe_local/`, `node_modules/`) of directories this manifest does not inventory, because they are CI/test-generated or gitignored scratch, never committed game content. Exclusions must never cover a whole tracked directory just because it's inconvenient to classify.
- `scanCommand` — `git ls-files -z`, the sole authority on "what is tracked."

### `assets[]` — every committed media/source-art file, once

Each entry has:

| Field | Meaning |
|---|---|
| `id` | Stable ID derived from the path (`assets/foo.png` → `assets.foo`). |
| `path` | Exact repo-relative path, case-sensitive. |
| `ext` | File extension. |
| `scope` | `runtime` \| `source` \| `reference` \| `evidence` \| `fixture` |
| `domain` | A short classification tag (`hero-static`, `enemy-sprite`, `north-star`, `playtest-evidence`, …). |
| `status` | `approved` \| `provisional` \| `intentional-placeholder` \| `fallback` \| `source-only` \| `historical` |
| `visualReview` | `aligned` \| `intentional-interim-gap` \| `refresh-candidate` \| `not-applicable` |
| `governedBy` | The doc that owns this asset's decisions, if any (e.g. `docs/CHARACTER_INVENTORY.md`, `docs/VISUAL_NORTH_STAR.md`). |
| `provenance` / `provenanceNote` | Who/how this file was produced, or `"unknown"` with a note on what evidence would resolve it. **Never invented** — see below. |
| `notes` | Free-text human context (e.g. why a generic overlay is an intentional interim gap). |
| `bytes`, `sha256`, `width`, `height` | Computed mechanical facts. Always recomputed by `--write`, never hand-edited. |

**Provenance is never invented.** Most of the 201 files currently inventoried have no in-repository record of who produced them or exactly when (that history lives in `git log`/`git blame`, not duplicated here) — those are honestly recorded as `provenance: "unknown"` with a note. A handful of families **do** have a documented origin elsewhere in the repo (the Ranger-proof fixtures, the North Star), and those entries should be enriched with that provenance as it's confirmed — this is additive, human-reviewed work, not something `--write` guesses at.

### `runtimeBindings[]` — every declared asset **slot**, present or not

This is the part a plain file listing can't give you: the game's `loadSprite()` calls (and a few direct `<img>`/CSS/`Audio` references) are **combinatorial** — one loop registers 8 directions × 2 profiles × 4 equipment slots × 3 animation states. `runtimeBindings` expands every one of those concrete slots individually:

| Field | Meaning |
|---|---|
| `key` | Stable runtime key (mirrors the game's own `SPRITES` key naming where applicable, e.g. `player_adventurer_down`). |
| `family` | Which combinatorial family this belongs to (`hero-static`, `equipment-overlay-walk`, `tile-sprite`, …). |
| `path` | The resolved repo-relative path this slot expects. |
| `owner` | Where in the code this binding is declared (file + mechanism). |
| `required` | `true` if this slot's absence is a real regression; `false` if the engine has a designed fallback. |
| `fallback` | What actually happens when this slot's file is absent (only meaningful when `required: false`). |
| `committed` | Computed by the tool: is `path` currently a tracked file? |
| `use` | The concrete combination (profile/direction/slot/etc.) this expansion represents. |

**`required` means one specific thing: this slot's absence is a visible regression the engine has no designed procedural or static substitute for — not merely "the engine tried to load it."** Concretely, `required: true` applies to exactly these families (46 slots total): hero static sprites and hero walk sprites (both heroes, all eight directions — `js/02-data-state.js`'s `playerSprite()` chain has no drawn substitute for a missing directional pose), title portraits (both heroes — the title screen `<img>` has no fallback image), the Character-screen paper-doll base (both heroes — same reasoning as hero static), and the eight core world tiles (`grass`/`water`/`tree`/`soil`/`path`/`house`/`door`/`exit` — `js/09-main.js`'s draw loop falls back to a flat `TILE_COLOR` fill, which is a visible regression, not a designed placeholder), plus the two title-screen UI images (`title-logo.png`, `title-bg.png` — no designed fallback exists for either).

**Everything else is `required: false`, because `js/02-data-state.js`'s `loadSprite()` already fails closed to a designed substitute for it**: hero attack frames (fall back to the static/walk sprite), every equipment overlay state (fall back to no extra gear layer — the base hero already carries its own permanent identity clothing, see `assets/README.md`'s three-layer governance), the two cavern tiles `rock`/`cave-floor` (fall back to procedurally drawn cavern detailing — the real Mine art doesn't exist yet), crop/enemy/NPC/decoration/environment art (fall back to a procedurally drawn shape each), the legacy `player.png` fallback, and background music (fails silently). **Not every registered `loadSprite()` path is required merely because the engine attempts to load it** — see `js/02-data-state.js` for the actual fallback chain (`profilePlayerSprite()` → `spr('player')` → colored placeholder box, `drawEnemyShape()`, `drawNpcShape()`, `drawProcDeco()`, etc.).

Required-ness is therefore orthogonal to `status`/`visualReview`: a slot can be `required: true` with a fully approved, aligned asset (hero static sprites), or `required: false` while still being an intentional interim gap under active tracking (the generic equipment overlays; Mira and the General Store, both explicitly named "dedicated placeholder treatments" in `docs/CURRENT_STATE.md` and classified `intentional-placeholder`/`intentional-interim-gap` rather than `approved`/`aligned` here).

Two examples worth knowing before you're surprised by the manifest:

- **`equipment_attack_*_cape`** exists as a declared, *optional* binding for all four directions on both heroes, even though `js/09-main.js`'s `draw()` never actually calls `equipmentAttackSprite('cape')` (capes have no attack pose). The registration loop in `js/02-data-state.js` calls `loadSprite()` for this combination unconditionally across all four equipment slots — the manifest reflects that real registration, not the drawing code's narrower usage.
- **`forge_building`** is a declared, required=false runtime binding with **zero committed backing file** — `js/09-main.js` calls `spr('forge_building')` and always falls back to a procedurally drawn stone building with a "FORGE" text label, because Gunnar's forge has no gameplay behind it yet. This is exactly the "intentionally optional or currently missing" case Foundation D exists to make visible instead of buried in a fallback branch nobody remembers.

## Allowed enum values

- **scope**: `runtime`, `source`, `reference`, `evidence`, `fixture`
- **status**: `approved`, `provisional`, `intentional-placeholder`, `fallback`, `source-only`, `historical`
- **visualReview**: `aligned`, `intentional-interim-gap`, `refresh-candidate`, `not-applicable`

## Using the tool

```bash
node tools/asset-manifest.mjs --write               # recompute facts for KNOWN files; canonicalize
node tools/asset-manifest.mjs --write --accept-new   # also add newly discovered files (see below)
node tools/asset-manifest.mjs --check                # verify it matches the repo (no writes) — the CI gate
node tools/asset-manifest.mjs --report               # write an uncommitted summary to artifacts/
```

`--check` verifies, in order: the manifest parses and its enums are valid; every tracked media file is listed exactly once (no more, no less); every listed file's computed facts (bytes/SHA-256/raster dimensions) match what's actually on disk; every required runtime binding has a committed file; every optional runtime binding declares a fallback; and the whole manifest is byte-for-byte canonical (so a hand-edited or stale file fails even if every individual fact happens to still be correct).

`--write` always recomputes every mechanical fact and preserves human-authored `provenance` for files already in the manifest. It **refuses to guess** at classification for a file that matches none of the tool's classification rules — it lists the unclassified path(s) and exits non-zero rather than inventing a scope/domain/status. Extending the classification rules (in `tools/asset-manifest.mjs`) is the deliberate, human-reviewed step that unblocks it.

**A file matching a rule is not thereby approved for entry.** `--write` (without `--accept-new`) only recomputes facts for paths **already present** in the stored manifest — a path the manifest has never seen before, even one that matches an existing rule perfectly, is printed with its *proposed* classification and the command exits non-zero without writing anything. A human reviews that proposal, then re-runs with `--write --accept-new` to actually add it. This is what keeps "matches a rule" and "is approved" as two separate steps, per the contract's requirement that every new tracked path stop for an explicit decision rather than being silently absorbed because a rule happened to match it.

`notes` is treated as rule-generated boilerplate by default: a `--write` that updates a classification rule's wording propagates that fix to every asset the rule governs, so a documentation correction doesn't silently freeze in place. A human who deliberately writes a note beyond what the rule would generate sets `notesLocked: true` on that one entry to opt it out of future regeneration.

`--report` writes `artifacts/asset-manifest-report.json` (gitignored, CI-retained as a build artifact) with counts by scope/domain/status/visual-review, which required slots are present, which optional slots are expected-missing, and how many entries still have unknown provenance.

### The live cross-check

`tools/asset-manifest-test.mjs` (wired into `npm test`) does more than validate the JSON — it **boots the real game in a headless browser and reads its actual `SPRITES` registry, `HERO_IDENTITIES`, DOM `<img>` sources, and `bgMusic.src`**, then cross-checks those live values against the declared `runtimeBindings`. This is what catches drift a hand-maintained table can't: if a future code change adds a new `loadSprite()` call, removes one, or changes a path template, the live cross-check fails even though the manifest JSON itself is internally consistent. (This is exactly how the `equipment_attack_*_cape` binding above was discovered during this PR's own development — the live registry had it, the first draft of the declarative table didn't.)

## How to add a new committed source asset

1. Add the file under an already-scanned directory (`assets/`, `assets/iso/`, `art/`, `docs/visual/`, `docs/playtest/`, etc.) or extend `EXCLUDED_PATH_PREFIXES`'s narrow scope discussion in `tools/asset-manifest.mjs` if it's genuinely a new area.
2. Run `node tools/asset-manifest.mjs --write` (no `--accept-new` yet). If the file matches no classification rule, it's listed as unclassified — add a rule (or extend an existing one) in `tools/asset-manifest.mjs`'s `RULES` table and re-run. Once it matches a rule, the same command prints it as a **newly discovered** file with its proposed classification and exits non-zero without writing.
3. Review that proposed classification. If it's correct, run `node tools/asset-manifest.mjs --write --accept-new` to actually add it with computed facts and `provenance: "unknown"`.
4. Commit the updated `assets/manifest.json` alongside the new file.

## How to promote an asset into runtime use

Per `tools/pipeline/PIPELINE.md`, the full path is: normalize/validate → human visual review → North Star decision → **manifest classification** → **manifest check** → exact-head CI. Concretely for this manifest: add the declared `runtimeBindings` entry (or extend an existing family's expansion) in `tools/asset-manifest.mjs`, mark it `required` appropriately, and run the live cross-check (`node tools/asset-manifest-test.mjs`) to confirm the real game actually resolves it.

## How to retire an asset

Remove the file, remove its `runtimeBindings` entry (or update `committed`/`fallback` if the slot itself is being retired rather than just its current file), and run `--write` — the tool will no longer list the removed asset, and `--check` will fail loudly on any leftover manifest entry pointing at a file that no longer exists.

## Relationship to other docs

- **`assets/README.md`** stays the human asset-authoring guide (what to name a new hero direction, what canvas size to use). It now points here as the exhaustive inventory rather than re-listing every file.
- **`tools/pipeline/PIPELINE.md`** is the production generation pipeline; this manifest is the gate a new production asset must clear on its way into `assets/`.
- **`docs/CHARACTER_INVENTORY.md`** is the authority on hero identity and equipment governance concepts this manifest classifies against (the three-layer identity model, boss trophies).
- **`docs/VISUAL_NORTH_STAR.md`** is the authority on visual-direction alignment; this manifest records *which* assets have been reviewed against it (`visualReview`), not the direction itself.

## PixelLab

PixelLab remains paused. This PR makes zero API calls, balance checks, dry-run requests, or generations, and does not use the ~100-generation authorization. The manifest classifies existing PixelLab-sourced assets (already committed) exactly as it classifies any other file — it does not interact with the PixelLab service.
