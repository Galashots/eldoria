#!/usr/bin/env node
// Foundation D — repository-wide asset manifest and integrity gate.
// See docs/ASSET_MANIFEST.md for the full contract this tool implements.
//
// Usage:
//   node tools/asset-manifest.mjs --write    canonicalize assets/manifest.json
//   node tools/asset-manifest.mjs --check    verify manifest matches the repo (CI gate)
//   node tools/asset-manifest.mjs --report   write an uncommitted summary to artifacts/
//
// This tool is GOVERNANCE ONLY: it inventories and verifies. It never modifies,
// moves, renames, or regenerates any media file.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = join(ROOT, 'assets', 'manifest.json');
const SCHEMA_VERSION = 1;

const MODE = process.argv.includes('--write') ? 'write'
  : process.argv.includes('--report') ? 'report'
  : 'check'; // default, and explicit --check

// ==================================================================
// Policy: which tracked files this manifest governs.
// ==================================================================

const TRACKED_EXTENSIONS = [
  // runtime and reference images
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico',
  // audio and video
  '.wav', '.ogg', '.mp3', '.m4a', '.mp4', '.webm',
  // art and 3D source formats
  '.aseprite', '.psd', '.psb', '.kra', '.blend', '.glb', '.gltf', '.fbx', '.obj', '.mtl',
  // fonts
  '.ttf', '.otf', '.woff', '.woff2',
];

// Narrow, explicit, documented exclusions — never a whole tracked directory
// exempted merely because it's inconvenient to classify.
const EXCLUDED_PATH_PREFIXES = [
  'artifacts/',        // CI/test-generated, gitignored, never committed
  '_probe_local/',      // gitignored local pipeline scratch
  'node_modules/',
];

function isExcluded(path) {
  return EXCLUDED_PATH_PREFIXES.some(p => path.startsWith(p));
}

function isTrackedMedia(path) {
  const lower = path.toLowerCase();
  return TRACKED_EXTENSIONS.some(ext => lower.endsWith(ext)) && !isExcluded(path);
}

// ==================================================================
// git-backed scanning: tracked files are the sole authority.
// ==================================================================

function listTrackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

// ==================================================================
// Computed integrity facts (mechanical, never human-authored).
// ==================================================================

function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }

// Minimal PNG IHDR reader — width/height are the first 8 bytes of the IHDR
// chunk, big-endian, immediately after the 8-byte signature + 8-byte chunk header.
function pngDimensions(buf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(sig)) return null;
  const type = buf.toString('ascii', 12, 16);
  if (type !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Minimal baseline/progressive JPEG SOF reader: scan markers until an SOFn
// (0xC0-0xC3, 0xC5-0xC7, 0xC9-0xCB, 0xCD-0xCF) segment, height/width follow
// immediately after the segment length + sample-precision byte.
function jpegDimensions(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) { offset++; continue; }
    const marker = buf[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { offset += 2; continue; }
    if (offset + 4 > buf.length) break;
    const segLen = buf.readUInt16BE(offset + 2);
    const isSOF = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
                  (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (isSOF) {
      if (offset + 9 > buf.length) return null;
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    offset += 2 + segLen;
  }
  return null;
}

function rasterDimensions(path, buf) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return pngDimensions(buf);
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return jpegDimensions(buf);
  return null; // not attempted for other formats — "where applicable" per contract
}

function computeFacts(path) {
  const buf = readFileSync(join(ROOT, path));
  const dims = rasterDimensions(path, buf);
  return {
    bytes: buf.length,
    sha256: sha256(buf),
    width: dims ? dims.width : null,
    height: dims ? dims.height : null,
  };
}

// ==================================================================
// Classification policy: ordered path-pattern rules. First match wins.
// Every currently-tracked media file must match exactly one rule; --write
// fails loudly (rather than guessing) on anything that matches none.
// ==================================================================

const HERO_PROFILES = ['adventurer', 'mage'];
const HERO_DIRECTIONS = ['down', 'up', 'left', 'right', 'down-right', 'down-left', 'up-left', 'up-right'];
const OVERLAY_DIRECTIONS = ['down', 'up', 'left', 'right'];
const EQUIPMENT_SLOTS = ['head', 'body', 'weapon', 'cape'];

function idFromPath(path) {
  return path.replace(/\//g, '.').replace(/\.[^.]+$/, '');
}

// Each rule: { test(path) -> boolean, classify(path) -> partial asset fields }
const RULES = [
  {
    name: 'hero-static',
    test: p => new RegExp(`^assets/(${HERO_PROFILES.join('|')})-(${HERO_DIRECTIONS.join('|')})\\.png$`).test(p),
    classify: () => ({
      domain: 'hero-static', scope: 'runtime', status: 'approved', visualReview: 'aligned',
      governedBy: 'docs/CHARACTER_INVENTORY.md', notes: '',
    }),
  },
  {
    name: 'hero-walk',
    test: p => new RegExp(`^assets/(${HERO_PROFILES.join('|')})-(${HERO_DIRECTIONS.join('|')})-walk\\.png$`).test(p),
    classify: () => ({
      domain: 'hero-walk', scope: 'runtime', status: 'approved', visualReview: 'aligned',
      governedBy: 'docs/CHARACTER_INVENTORY.md', notes: '',
    }),
  },
  {
    name: 'hero-attack',
    test: p => new RegExp(`^assets/(${HERO_PROFILES.join('|')})-(${OVERLAY_DIRECTIONS.join('|')})-attack\\.png$`).test(p),
    classify: () => ({
      domain: 'hero-attack', scope: 'runtime', status: 'approved', visualReview: 'aligned',
      governedBy: 'docs/CHARACTER_INVENTORY.md', notes: 'Optional runtime slot (falls back to static/walk sprite); currently present for both heroes.',
    }),
  },
  {
    name: 'equipment-overlay-attack',
    test: p => new RegExp(`^assets/(${HERO_PROFILES.join('|')})-(${OVERLAY_DIRECTIONS.join('|')})-weapon-attack\\.png$`).test(p),
    classify: () => ({
      domain: 'equipment-overlay-attack', scope: 'runtime', status: 'intentional-placeholder', visualReview: 'intentional-interim-gap',
      governedBy: 'docs/CHARACTER_INVENTORY.md',
      notes: 'Generic per-slot overlay art, not exact per-item art — documented interim gap. Optional runtime slot with a static/walk fallback.',
    }),
  },
  {
    name: 'equipment-overlay-walk',
    test: p => new RegExp(`^assets/(${HERO_PROFILES.join('|')})-(${OVERLAY_DIRECTIONS.join('|')})-cape-walk\\.png$`).test(p),
    classify: () => ({
      domain: 'equipment-overlay-walk', scope: 'runtime', status: 'intentional-placeholder', visualReview: 'intentional-interim-gap',
      governedBy: 'docs/CHARACTER_INVENTORY.md',
      notes: 'Generic per-slot overlay art, not exact per-item art — documented interim gap. Optional runtime slot with a static fallback. Currently only committed for the Ranger; the Mage cape stays static while walking (also optional/graceful).',
    }),
  },
  {
    name: 'equipment-overlay-static',
    test: p => new RegExp(`^assets/(${HERO_PROFILES.join('|')})-(${OVERLAY_DIRECTIONS.join('|')})-(${EQUIPMENT_SLOTS.join('|')})\\.png$`).test(p),
    classify: () => ({
      domain: 'equipment-overlay-static', scope: 'runtime', status: 'intentional-placeholder', visualReview: 'intentional-interim-gap',
      governedBy: 'docs/CHARACTER_INVENTORY.md',
      notes: 'Generic per-slot overlay art, not exact per-item art — documented interim gap. Optional runtime slot; absence means no extra progression-tier gear layer, not a bare hero — the base sprite already carries its own permanent canonical identity clothing (see assets/README.md\'s three-layer governance).',
    }),
  },
  {
    name: 'hero-equipment-reference-sheet',
    test: p => new RegExp(`^assets/(${HERO_PROFILES.join('|')})-equipment-sheet\\.png$`).test(p),
    classify: () => ({
      domain: 'reference-sheet', scope: 'reference', status: 'source-only', visualReview: 'not-applicable',
      governedBy: '', notes: 'Contact-sheet style reference image; not loaded by any runtime code path.',
    }),
  },
  {
    name: 'orphaned-reference-image',
    test: p => ['assets/title-portraits.png', 'assets/weapon-down-attack.png', 'assets/weapon-up-attack.png',
      'assets/weapon-left-attack.png', 'assets/weapon-right-attack.png', 'assets/water_edge.png',
      'assets/npc-cookpot-sheet.png', 'assets/enemies-sheet.png'].includes(p),
    classify: () => ({
      domain: 'orphaned-reference', scope: 'reference', status: 'provisional', visualReview: 'not-applicable',
      governedBy: '', notes: 'Not referenced by any current runtime code path. Provenance unknown; retained without a known active purpose — flag for owner disposition if confirmed unused going forward.',
    }),
  },
  {
    name: 'tile-sprite',
    test: p => ['assets/grass.png', 'assets/water.png', 'assets/tree.png', 'assets/soil.png',
      'assets/path.png', 'assets/house.png', 'assets/door.png', 'assets/exit.png'].includes(p),
    classify: () => ({
      domain: 'tile-sprite', scope: 'runtime', status: 'approved', visualReview: 'aligned',
      governedBy: '', notes: '',
    }),
  },
  {
    name: 'tile-decoration-variant',
    test: p => ['assets/grass2.png', 'assets/grass3.png'].includes(p),
    classify: () => ({
      domain: 'tile-decoration-variant', scope: 'runtime', status: 'approved', visualReview: 'aligned',
      governedBy: '', notes: 'Optional grass-tile visual variety; falls back to the base grass tile if absent.',
    }),
  },
  {
    name: 'decoration-sprite',
    test: p => ['assets/flowers.png', 'assets/boulder.png', 'assets/tree_stump.png', 'assets/stone.png'].includes(p),
    classify: () => ({
      domain: 'decoration-sprite', scope: 'runtime', status: 'approved', visualReview: 'aligned',
      governedBy: '', notes: 'Optional; falls back to a procedurally drawn shape if absent.',
    }),
  },
  {
    name: 'crop-sprite',
    test: p => ['assets/crop_growing.png', 'assets/crop_ready.png'].includes(p),
    classify: () => ({
      domain: 'crop-sprite', scope: 'runtime', status: 'approved', visualReview: 'aligned',
      governedBy: '', notes: 'Optional; falls back to a procedurally drawn colored shape if absent.',
    }),
  },
  {
    name: 'crop-iso-strip',
    test: p => /^assets\/iso\/crop-(turnip|carrot|corn|pumpkin|starfruit)\.png$/.test(p),
    classify: () => ({
      domain: 'crop-iso-strip', scope: 'runtime', status: 'approved', visualReview: 'aligned',
      governedBy: '', notes: 'Optional; falls back to the existing deterministic canvas crop proof if absent.',
    }),
  },
  {
    name: 'enemy-sprite',
    test: p => /^assets\/enemy_[a-z_]+\.png$/.test(p),
    classify: () => ({
      domain: 'enemy-sprite', scope: 'runtime', status: 'approved', visualReview: 'aligned',
      governedBy: '', notes: 'Optional; falls back to a procedurally drawn per-type shape if absent.',
    }),
  },
  {
    name: 'npc-sprite',
    test: p => /^assets\/npc_[a-z_]+\.png$/.test(p),
    classify: () => ({
      domain: 'npc-sprite', scope: 'runtime', status: 'approved', visualReview: 'aligned',
      governedBy: '', notes: 'Optional; falls back to a procedurally drawn per-NPC shape if absent.',
    }),
  },
  {
    name: 'environment-sprite',
    test: p => ['assets/cookpot.png', 'assets/shop_building.png'].includes(p),
    classify: () => ({
      domain: 'environment-sprite', scope: 'runtime', status: 'approved', visualReview: 'aligned',
      governedBy: '', notes: 'Optional; falls back to a procedurally drawn shape if absent.',
    }),
  },
  {
    name: 'ui-title',
    test: p => ['assets/title-logo.png', 'assets/title-bg.png'].includes(p),
    classify: (p) => ({
      domain: 'ui-title', scope: 'runtime', status: 'approved', visualReview: 'aligned',
      governedBy: '',
      notes: p === 'assets/title-bg.png'
        ? 'CSS background-image; a missing file falls back to the declared solid background-color (#1a1208), not a designed placeholder.'
        : 'Plain <img> tag with no designed fallback if absent.',
    }),
  },
  {
    name: 'audio-music',
    test: p => p === 'assets/music-town.mp3',
    classify: () => ({
      domain: 'audio-music', scope: 'runtime', status: 'approved', visualReview: 'not-applicable',
      governedBy: '', notes: 'Optional; a missing/failing file silently produces no audio (Audio() has no onerror handling), game is otherwise unaffected.',
    }),
  },
  {
    name: 'ranger-proof-fixture',
    test: p => p.startsWith('art/ranger-proof/normalized/'),
    classify: () => ({
      domain: 'ranger-proof-fixture', scope: 'fixture', status: 'source-only', visualReview: 'not-applicable',
      governedBy: 'tools/check-ranger-png-integrity.mjs, tools/ranger-proof.mjs',
      notes: 'Pinned by the ranger-proof integrity/self-test gates already wired into npm test.',
    }),
  },
  {
    name: 'source-art',
    test: p => p.startsWith('art/source/'),
    classify: () => ({
      domain: 'source-art', scope: 'source', status: 'source-only', visualReview: 'not-applicable',
      governedBy: 'tools/check-ranger-png-integrity.mjs, tools/process-crop-sheet.mjs',
      notes: 'Pinned by existing asset-processing/verify scripts.',
    }),
  },
  {
    name: 'north-star-v2',
    test: p => p === 'docs/visual/eldoria-visual-north-star-v2.png',
    classify: () => ({
      domain: 'north-star', scope: 'reference', status: 'approved', visualReview: 'aligned',
      governedBy: 'docs/VISUAL_NORTH_STAR.md', notes: 'The current authoritative visual-direction reference. Not a runtime asset.',
    }),
  },
  {
    name: 'north-star-v1',
    test: p => p === 'docs/visual/eldoria-visual-north-star-v1.png',
    classify: () => ({
      domain: 'north-star', scope: 'reference', status: 'historical', visualReview: 'not-applicable',
      governedBy: 'docs/VISUAL_NORTH_STAR.md', notes: 'Superseded by v2; retained for supersession history.',
    }),
  },
  {
    name: 'visual-experiment-record',
    test: p => p.startsWith('docs/visual/experiments/'),
    classify: () => ({
      domain: 'experiment-record', scope: 'evidence', status: 'historical', visualReview: 'not-applicable',
      governedBy: '', notes: 'Historical pipeline-experiment evidence.',
    }),
  },
  {
    name: 'visual-review-record',
    test: p => p.startsWith('docs/visual/reviews/'),
    classify: () => ({
      domain: 'review-record', scope: 'evidence', status: 'historical', visualReview: 'not-applicable',
      governedBy: '', notes: 'Historical non-author visual review evidence.',
    }),
  },
  {
    name: 'playtest-evidence',
    test: p => p.startsWith('docs/playtest/'),
    classify: () => ({
      domain: 'playtest-evidence', scope: 'evidence', status: 'historical', visualReview: 'not-applicable',
      governedBy: '', notes: 'Playtest session evidence (screenshots/reference stills).',
    }),
  },
  {
    name: 'readme-preview',
    test: p => p === 'eldoria-title.png',
    classify: () => ({
      domain: 'readme-preview', scope: 'reference', status: 'approved', visualReview: 'not-applicable',
      governedBy: 'README.md', notes: 'README hero image, not a runtime game asset.',
    }),
  },
];

function classify(path) {
  for (const rule of RULES) {
    if (rule.test(path)) return { rule: rule.name, ...rule.classify(path) };
  }
  return null;
}

// ==================================================================
// Runtime binding families — the declarative expansion table.
// ==================================================================

function tpl(pattern, vars) {
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), pattern);
}

function buildRuntimeBindings() {
  const bindings = [];
  const push = (b) => bindings.push(b);

  for (const profile of HERO_PROFILES) {
    for (const dir of HERO_DIRECTIONS) {
      push({
        key: `player_${profile}_${dir}`, family: 'hero-static',
        path: tpl('assets/{p}-{d}.png', { p: profile, d: dir }),
        owner: 'js/02-data-state.js (loadSprite loop)', required: true,
        fallback: 'assets/player.png legacy sprite, then a drawn placeholder box',
        use: { profile, direction: dir },
      });
      push({
        key: `player_walk_${profile}_${dir}`, family: 'hero-walk',
        path: tpl('assets/{p}-{d}-walk.png', { p: profile, d: dir }),
        owner: 'js/02-data-state.js (loadSprite loop)', required: true,
        fallback: 'static hero sprite for that direction (no walk animation)',
        use: { profile, direction: dir },
      });
    }
    for (const dir of OVERLAY_DIRECTIONS) {
      push({
        key: `player_attack_${profile}_${dir}`, family: 'hero-attack',
        path: tpl('assets/{p}-{d}-attack.png', { p: profile, d: dir }),
        owner: 'js/02-data-state.js (loadSprite loop)', required: false,
        fallback: 'static or walk hero sprite (no attack animation)',
        use: { profile, direction: dir },
      });
      for (const slot of EQUIPMENT_SLOTS) {
        push({
          key: `equipment_${profile}_${dir}_${slot}`, family: 'equipment-overlay-static',
          path: tpl('assets/{p}-{d}-{s}.png', { p: profile, d: dir, s: slot }),
          owner: 'js/02-data-state.js (loadSprite loop)', required: false,
          fallback: 'no extra progression-tier gear layer for that slot — the base hero already carries its own permanent canonical identity clothing/props, it does not render bare',
          use: { profile, direction: dir, slot },
        });
        push({
          key: `equipment_walk_${profile}_${dir}_${slot}`, family: 'equipment-overlay-walk',
          path: tpl('assets/{p}-{d}-{s}-walk.png', { p: profile, d: dir, s: slot }),
          owner: 'js/02-data-state.js (loadSprite loop)', required: false,
          fallback: 'static equipment overlay for that slot',
          use: { profile, direction: dir, slot },
        });
        // js/02-data-state.js's registration loop calls loadSprite() for this
        // family unconditionally across ALL FOUR slots, including cape — even
        // though js/09-main.js's draw() never calls equipmentAttackSprite('cape')
        // (capes have no attack pose in the rendered game). The SPRITES registry
        // entry exists regardless; it is simply never queried for cape. Declaring
        // it here (rather than skipping cape) is what the live cross-check
        // against the real SPRITES registry requires — verified against source,
        // not assumed from the drawing code alone.
        push({
          key: `equipment_attack_${profile}_${dir}_${slot}`, family: 'equipment-overlay-attack',
          path: tpl('assets/{p}-{d}-{s}-attack.png', { p: profile, d: dir, s: slot }),
          owner: 'js/02-data-state.js (loadSprite loop)', required: false,
          fallback: slot === 'cape'
            ? 'never drawn — draw() never calls equipmentAttackSprite(\'cape\'); this registered SPRITES entry has no visible effect regardless of load state'
            : 'static or walk equipment overlay for that slot',
          use: { profile, direction: dir, slot },
        });
      }
    }
    push({
      key: `title_portrait_${profile}`, family: 'title-portrait',
      path: tpl('assets/{p}-down-right.png', { p: profile }),
      owner: 'index.html title screen + js/02-data-state.js HERO_IDENTITIES', required: true,
      fallback: 'none designed — plain <img>, browser broken-image icon if absent',
      use: { profile },
    });
    push({
      key: `paperdoll_base_${profile}`, family: 'character-paperdoll',
      path: tpl('assets/{p}-right.png', { p: profile }),
      owner: 'js/10-character.js renderPaperDoll()', required: true,
      fallback: 'none designed — img.onerror hides just that layer',
      use: { profile },
    });
    for (const slot of EQUIPMENT_SLOTS) {
      push({
        key: `paperdoll_${slot}_${profile}`, family: 'character-paperdoll',
        path: tpl('assets/{p}-right-{s}.png', { p: profile, s: slot }),
        owner: 'js/10-character.js renderPaperDoll()', required: false,
        fallback: 'img.onerror hides just that overlay layer; base hero stays visible',
        use: { profile, slot },
      });
    }
  }

  const TILE_REQUIRED = { grass: true, water: true, tree: true, soil: true, path: true, house: true, door: true, exit: true, rock: false, 'cave-floor': false };
  const TILE_FILE = { grass: 'grass', water: 'water', tree: 'tree', soil: 'soil', path: 'path', house: 'house', door: 'door', exit: 'exit', rock: 'rock', 'cave-floor': 'cave-floor' };
  for (const [tile, required] of Object.entries(TILE_REQUIRED)) {
    push({
      key: `tile_${tile}`, family: 'tile-sprite',
      path: `assets/${TILE_FILE[tile]}.png`,
      owner: 'js/02-data-state.js TILE_SPRITE', required,
      fallback: required ? 'flat TILE_COLOR fill' : 'procedurally drawn cavern detailing (ROCK/CAVE) — the real Mine art is not yet produced',
      use: { tile },
    });
  }
  for (const variant of ['grass2', 'grass3']) {
    push({ key: variant, family: 'tile-decoration-variant', path: `assets/${variant}.png`,
      owner: 'js/02-data-state.js + js/09-main.js grass-variety draw', required: false,
      fallback: 'base grass tile', use: {} });
  }
  for (const [key, path] of Object.entries({
    deco_flowers: 'flowers', deco_boulder: 'boulder', deco_stump: 'tree_stump', deco_stone: 'stone',
  })) {
    push({ key, family: 'decoration-sprite', path: `assets/${path}.png`,
      owner: 'js/09-main.js drawProcDeco()', required: false,
      fallback: 'procedurally drawn decoration shape', use: {} });
  }
  for (const key of ['crop_growing', 'crop_ready']) {
    push({ key, family: 'crop-sprite', path: `assets/${key}.png`,
      owner: 'js/02-data-state.js + js/09-main.js', required: false,
      fallback: 'procedurally drawn colored crop shape', use: {} });
  }
  for (const crop of ['turnip', 'carrot', 'corn', 'pumpkin', 'starfruit']) {
    push({ key: `iso_crop_${crop}`, family: 'crop-iso-strip', path: `assets/iso/crop-${crop}.png`,
      owner: 'js/02-data-state.js + js/08-iso-renderer.js', required: false,
      fallback: 'deterministic canvas crop proof', use: { crop } });
  }
  for (const type of ['slime', 'bat', 'goblin', 'wolf', 'bear', 'troll', 'rock_golem', 'magma_slug', 'crystal_wyrm', 'shadow_warden']) {
    push({ key: `enemy_${type}`, family: 'enemy-sprite', path: `assets/enemy_${type}.png`,
      owner: 'js/02-data-state.js + js/09-main.js drawEnemyShape()', required: false,
      fallback: 'procedurally drawn per-type enemy shape', use: { enemyType: type } });
  }
  for (const id of ['mira', 'bram', 'gunnar', 'dumpling_vendor']) {
    push({ key: `npc_${id}`, family: 'npc-sprite', path: `assets/npc_${id}.png`,
      owner: 'js/09-main.js NPC draw loop + drawNpcShape()', required: false,
      fallback: 'procedurally drawn per-NPC shape', use: { npcId: id } });
  }
  push({ key: 'cookpot', family: 'environment-sprite', path: 'assets/cookpot.png',
    owner: 'js/02-data-state.js + js/09-main.js', required: false,
    fallback: 'procedurally drawn cooking-pot shape', use: {} });
  push({ key: 'shop_building', family: 'environment-sprite', path: 'assets/shop_building.png',
    owner: 'js/02-data-state.js + js/09-main.js', required: false,
    fallback: 'HOUSE/DOOR tile fallback rendering', use: {} });
  push({ key: 'forge_building', family: 'environment-sprite', path: 'assets/forge_building.png',
    owner: 'js/09-main.js (spr(\'forge_building\') call site)', required: false,
    fallback: 'procedurally drawn stone building with a "FORGE" text label — Gunnar\'s forge has no gameplay behind it yet',
    use: {} });
  push({ key: 'title_logo', family: 'ui-title', path: 'assets/title-logo.png',
    owner: 'index.html title screen', required: true, fallback: 'none designed', use: {} });
  push({ key: 'title_bg', family: 'ui-title', path: 'assets/title-bg.png',
    owner: 'eldoria.css .title-overlay', required: true,
    fallback: 'CSS solid background-color (#1a1208)', use: {} });
  push({ key: 'music_town', family: 'audio-music', path: 'assets/music-town.mp3',
    owner: 'js/02-data-state.js bgMusic', required: false,
    fallback: 'silent — Audio() has no onerror handling, game is unaffected', use: {} });
  push({ key: 'player', family: 'legacy-fallback', path: 'assets/player.png',
    owner: 'js/02-data-state.js loadSprite + playerSprite() fallback chain', required: false,
    fallback: 'a colored placeholder box with a directional nose triangle', use: {} });

  return bindings;
}

// ==================================================================
// Canonicalization
// ==================================================================

function buildCanonicalManifest(existing) {
  const tracked = listTrackedFiles().filter(isTrackedMedia).sort();
  const existingByPath = new Map((existing?.assets ?? []).map(a => [a.path, a]));
  const unclassified = [];
  const assets = [];

  for (const path of tracked) {
    const cls = classify(path);
    if (!cls) { unclassified.push(path); continue; }
    const facts = computeFacts(path);
    const prior = existingByPath.get(path);
    assets.push({
      id: idFromPath(path),
      path,
      ext: path.slice(path.lastIndexOf('.')).toLowerCase(),
      scope: cls.scope,
      domain: cls.domain,
      status: cls.status,
      visualReview: cls.visualReview,
      governedBy: cls.governedBy,
      // Provenance is never invented — carry forward any human-recorded value,
      // otherwise 'unknown' with a note on what would resolve it.
      provenance: prior?.provenance ?? 'unknown',
      provenanceNote: prior?.provenanceNote ?? 'No repository record establishes the origin of this file; resolving it would require author/tool history from outside this repo.',
      notes: prior?.notes ?? cls.notes,
      bytes: facts.bytes,
      sha256: facts.sha256,
      width: facts.width,
      height: facts.height,
    });
  }

  const runtimeBindings = buildRuntimeBindings()
    .map(b => ({ ...b, committed: tracked.includes(b.path) }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      policy: {
        trackedExtensions: TRACKED_EXTENSIONS,
        excludedPathPrefixes: EXCLUDED_PATH_PREFIXES,
        scanCommand: 'git ls-files -z',
      },
      assets,
      runtimeBindings,
    },
    unclassified,
  };
}

function canonicalJSON(obj) {
  // Deterministic key ordering, independent of JS object insertion order,
  // except for array element order which the builder already sorts.
  return JSON.stringify(obj, Object.keys(obj).length ? sortKeysReplacer : undefined, 2) + '\n';
}
function sortKeysReplacer(key, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).sort().reduce((acc, k) => { acc[k] = value[k]; return acc; }, {});
  }
  return value;
}

// ==================================================================
// Modes
// ==================================================================

function readExistingManifest() {
  try { return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')); } catch { return null; }
}

function runWrite() {
  const existing = readExistingManifest();
  const { manifest, unclassified } = buildCanonicalManifest(existing);
  if (unclassified.length) {
    console.error(`asset-manifest --write: ${unclassified.length} tracked media file(s) match no classification rule:`);
    for (const p of unclassified) console.error(`  ${p}`);
    console.error('Add a classification rule (with human-reviewed scope/domain/status/notes) before writing.');
    process.exit(1);
  }
  writeFileSync(MANIFEST_PATH, canonicalJSON(manifest));
  console.log(`Wrote ${MANIFEST_PATH}: ${manifest.assets.length} assets, ${manifest.runtimeBindings.length} runtime bindings.`);
}

function deepEqualCanonical(a, b) {
  return canonicalJSON(a) === canonicalJSON(b);
}

function runCheck() {
  const existing = readExistingManifest();
  if (!existing) {
    console.error(`asset-manifest --check: ${MANIFEST_PATH} is missing or invalid JSON. Run --write first.`);
    process.exit(1);
  }
  const { manifest, unclassified } = buildCanonicalManifest(existing);
  const errors = [];

  if (unclassified.length) {
    errors.push(`${unclassified.length} tracked media file(s) are not in the manifest: ${unclassified.join(', ')}`);
  }

  // Enum validation.
  const SCOPES = new Set(['runtime', 'source', 'reference', 'evidence', 'fixture']);
  const STATUSES = new Set(['approved', 'provisional', 'intentional-placeholder', 'fallback', 'source-only', 'historical']);
  const VISUAL = new Set(['aligned', 'intentional-interim-gap', 'refresh-candidate', 'not-applicable']);
  for (const a of manifest.assets) {
    if (!SCOPES.has(a.scope)) errors.push(`${a.path}: unknown scope "${a.scope}"`);
    if (!STATUSES.has(a.status)) errors.push(`${a.path}: unknown status "${a.status}"`);
    if (!VISUAL.has(a.visualReview)) errors.push(`${a.path}: unknown visualReview "${a.visualReview}"`);
    if (a.path.includes('..')) errors.push(`${a.path}: path traversal is not allowed`);
    if (/^https?:\/\//.test(a.path) || a.path.startsWith('data:')) errors.push(`${a.path}: HTTP/data URLs are not allowed`);
    if (/^[A-Za-z]:[\\/]/.test(a.path) || a.path.startsWith('/')) errors.push(`${a.path}: absolute paths are not allowed`);
  }
  // Duplicate ID / path detection.
  const seenIds = new Map(), seenPaths = new Map();
  for (const a of manifest.assets) {
    if (seenIds.has(a.id)) errors.push(`duplicate asset id "${a.id}" (${seenPaths.get(a.path)} vs ${a.path})`);
    seenIds.set(a.id, a.path);
    if (seenPaths.has(a.path)) errors.push(`duplicate manifest path "${a.path}"`);
    seenPaths.set(a.path, true);
  }

  // Drift against the stored manifest: recomputed canonical form must match
  // byte-for-byte (this also catches stale hashes/sizes/dimensions and any
  // manifest path that no longer exists / is no longer tracked).
  if (!deepEqualCanonical(manifest, existing)) {
    errors.push('assets/manifest.json is not canonical. Run `node tools/asset-manifest.mjs --write` and commit the result.');
  }

  // Runtime-binding required/optional semantics.
  for (const b of manifest.runtimeBindings) {
    if (b.required && !b.committed) errors.push(`required runtime binding "${b.key}" has no committed file at ${b.path}`);
    if (!b.required && !b.fallback) errors.push(`optional runtime binding "${b.key}" has no declared fallback`);
  }

  if (errors.length) {
    console.error(`asset-manifest --check: ${errors.length} problem(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`asset-manifest --check: OK (${manifest.assets.length} assets, ${manifest.runtimeBindings.length} runtime bindings).`);
}

function runReport() {
  const existing = readExistingManifest();
  if (!existing) {
    console.error('asset-manifest --report: no manifest to report on. Run --write first.');
    process.exit(1);
  }
  const { manifest } = buildCanonicalManifest(existing);
  const by = (arr, field) => arr.reduce((acc, x) => { acc[x[field]] = (acc[x[field]] || 0) + 1; return acc; }, {});
  const requiredMissing = manifest.runtimeBindings.filter(b => b.required && !b.committed);
  const optionalMissing = manifest.runtimeBindings.filter(b => !b.required && !b.committed);
  const report = {
    totalAssets: manifest.assets.length,
    byScope: by(manifest.assets, 'scope'),
    byDomain: by(manifest.assets, 'domain'),
    byStatus: by(manifest.assets, 'status'),
    byVisualReview: by(manifest.assets, 'visualReview'),
    requiredRuntimeSlotsPresent: manifest.runtimeBindings.filter(b => b.required && b.committed).length,
    optionalRuntimeSlotsPresent: manifest.runtimeBindings.filter(b => !b.required && b.committed).length,
    expectedMissingOptionalSlots: optionalMissing.map(b => b.key),
    requiredMissing: requiredMissing.map(b => b.key),
    unknownProvenanceCount: manifest.assets.filter(a => a.provenance === 'unknown').length,
    intentionalInterimGaps: manifest.assets.filter(a => a.visualReview === 'intentional-interim-gap').map(a => a.path),
    warnings: requiredMissing.length ? [`${requiredMissing.length} required runtime binding(s) missing — see requiredMissing`] : [],
  };
  mkdirSync(join(ROOT, 'artifacts'), { recursive: true });
  const out = join(ROOT, 'artifacts', 'asset-manifest-report.json');
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(`Wrote ${out}`);
  console.log(JSON.stringify(report, null, 2));
}

if (MODE === 'write') runWrite();
else if (MODE === 'report') runReport();
else runCheck();
