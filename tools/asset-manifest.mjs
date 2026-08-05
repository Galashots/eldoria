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
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = join(ROOT, 'assets', 'manifest.json');
const SCHEMA_VERSION = 1;

const MODE = process.argv.includes('--write') ? 'write'
  : process.argv.includes('--report') ? 'report'
  : 'check'; // default, and explicit --check
const ACCEPT_NEW = process.argv.includes('--accept-new');
const RECOVER_MALFORMED = process.argv.includes('--recover-malformed-manifest');

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
export function pngDimensions(buf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(sig)) return null;
  const type = buf.toString('ascii', 12, 16);
  if (type !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Minimal baseline/progressive JPEG SOF reader: scan markers until an SOFn
// (0xC0-0xC3, 0xC5-0xC7, 0xC9-0xCB, 0xCD-0xCF) segment, height/width follow
// immediately after the segment length + sample-precision byte.
export function jpegDimensions(buf) {
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

// GIF87a/GIF89a: 6-byte signature, then a 7-byte Logical Screen Descriptor
// whose first 4 bytes are width/height as little-endian uint16.
export function gifDimensions(buf) {
  if (buf.length < 10) return null;
  const sig = buf.toString('ascii', 0, 6);
  if (sig !== 'GIF87a' && sig !== 'GIF89a') return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

// WebP: a RIFF container ('RIFF' size 'WEBP') holding one image chunk.
// VP8X (extended): 24-bit little-endian (width-1)/(height-1) at fixed offsets.
// VP8  (lossy):    a 3-byte frame tag, a 3-byte start code (0x9d 0x01 0x2a),
//                  then 14-bit width/height (top 2 bits of each 16-bit field
//                  are a scale factor, masked off here).
// VP8L (lossless):  a 0x2f signature byte, then 14-bit (width-1)/(height-1)
//                  packed across the following 4 bytes, little-endian.
export function webpDimensions(buf) {
  if (buf.length < 30) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fourCC = buf.toString('ascii', 12, 16);
  if (fourCC === 'VP8X') {
    if (buf.length < 30) return null;
    return { width: (buf.readUIntLE(24, 3) + 1), height: (buf.readUIntLE(27, 3) + 1) };
  }
  if (fourCC === 'VP8 ') {
    if (buf.length < 30 || buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (fourCC === 'VP8L') {
    if (buf.length < 25 || buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

const DIMENSION_READERS = {
  '.png': pngDimensions,
  '.jpg': jpegDimensions,
  '.jpeg': jpegDimensions,
  '.gif': gifDimensions,
  '.webp': webpDimensions,
};

// Container-completeness checks. A header can parse cleanly (signature OK,
// dimensions readable) while the file body is still truncated OR simply
// EMPTY of real pixel data — a structurally well-formed shell with a valid
// ending marker but zero encoded payload (e.g. a PNG with signature+IHDR+IEND
// and no IDAT chunk at all) would satisfy a check that only looks for the
// terminal marker. These checks re-derive from the SAME bytes the dimension
// readers already parsed, verifying BOTH that the container reaches its real
// end-of-stream marker AND that genuine encoded payload actually exists
// in between — not full decoding, but enough that an empty or hand-crafted
// shell cannot pass as a real image.
//
// PNG: walk the chunk chain from byte 8, collecting IDAT data, and confirm
// it reaches a real IEND chunk without any chunk's declared length
// overrunning the buffer. Then zlib-inflate the concatenated IDAT stream —
// a missing/empty IDAT fails to inflate at all (an empty buffer is not a
// valid zlib stream), and for a non-interlaced image the inflated byte
// count must exactly match what IHDR's dimensions/color type/bit depth
// predict (this is the exact technique used to verify the crop-carrot.png
// repair by hand — now built into the tool itself). Adam7-interlaced images
// skip the exact-count match (pass sizing is significantly more complex) but
// still require a successful, non-empty inflate.
const PNG_CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
export function pngContainerComplete(buf) {
  if (buf.length < 26) return false;
  const bitDepth = buf[24], colorType = buf[25], interlace = buf[28];
  let offset = 8;
  const idatParts = [];
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const chunkEnd = offset + 8 + len + 4; // length + type + data + CRC
    if (chunkEnd > buf.length) return false; // chunk claims bytes past the buffer end
    if (type === 'IDAT') idatParts.push(buf.subarray(offset + 8, offset + 8 + len));
    if (type === 'IEND') {
      const channels = PNG_CHANNELS_BY_COLOR_TYPE[colorType];
      if (!channels || !idatParts.length) return false;
      let raw;
      try { raw = inflateSync(Buffer.concat(idatParts)); } catch { return false; }
      if (raw.length === 0) return false;
      if (interlace === 0) {
        const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20);
        const rowBytes = Math.ceil((width * channels * bitDepth) / 8) + 1; // +1 filter-type byte
        return raw.length === height * rowBytes;
      }
      return true; // interlaced: successful non-empty inflate is as far as this check goes
    }
    offset = chunkEnd;
  }
  return false;
}
// JPEG: a complete stream ends with the End-Of-Image marker (0xFFD9), AND
// has a real Start-Of-Scan segment with at least one byte of entropy-coded
// data between the SOS header and that EOI marker — a file with only
// SOI/SOF/EOI and no SOS has no scan data at all.
export function jpegContainerComplete(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return false;
  if (buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9) return false;
  let offset = 2;
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) { offset++; continue; }
    const marker = buf[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { offset += 2; continue; }
    const segLen = buf.readUInt16BE(offset + 2);
    if (marker === 0xda) {
      const scanDataStart = offset + 2 + segLen;
      const scanDataEnd = buf.length - 2; // the trailing EOI marker
      return scanDataEnd > scanDataStart;
    }
    offset += 2 + segLen;
  }
  return false; // no SOS segment found — no scan data at all
}
// GIF: a complete stream ends with the trailer byte (0x3B), AND contains a
// real Image Descriptor block with at least one non-empty LZW data
// sub-block — not just a Logical Screen Descriptor and a bare trailer.
export function gifContainerComplete(buf) {
  if (buf.length < 13 || (buf[buf.length - 1] !== 0x3b)) return false;
  const lsdPacked = buf[10];
  const gctSize = (lsdPacked & 0x80) ? 3 * (2 ** ((lsdPacked & 0x07) + 1)) : 0;
  let offset = 13 + gctSize;
  while (offset < buf.length) {
    const b = buf[offset];
    if (b === 0x3b) return false; // trailer reached, no image descriptor found
    if (b === 0x21) { // Extension: introducer + label, then length-prefixed sub-blocks
      offset += 2;
      while (offset < buf.length && buf[offset] !== 0x00) offset += 1 + buf[offset];
      offset += 1;
      continue;
    }
    if (b === 0x2c) { // Image Descriptor
      if (offset + 10 > buf.length) return false;
      const descPacked = buf[offset + 9];
      const lctSize = (descPacked & 0x80) ? 3 * (2 ** ((descPacked & 0x07) + 1)) : 0;
      offset += 10 + lctSize + 1; // descriptor + local color table + LZW min code size byte
      let sawData = false;
      while (offset < buf.length) {
        const subLen = buf[offset];
        offset += 1;
        if (subLen === 0) break;
        sawData = true;
        offset += subLen;
      }
      return sawData;
    }
    return false; // unrecognized block type — bail out conservatively
  }
  return false;
}
// WebP: the RIFF size field (bytes 4-7, little-endian) must equal the number
// of bytes that actually follow it, AND a real pixel-bearing chunk must
// exist. For direct (non-extended) VP8/VP8L, the chunk IS the pixel data, so
// its declared length must exceed the fixed dimension-header bytes this tool
// already parses. For extended VP8X, the dimensions live in VP8X itself, but
// the actual pixels live in a LATER sub-chunk (VP8 /VP8L/ANMF) — a bare VP8X
// with nothing else has correct RIFF size accounting but zero pixel data.
export function webpContainerComplete(buf) {
  if (buf.length < 12 || buf.readUInt32LE(4) !== buf.length - 8) return false;
  const fourCC = buf.toString('ascii', 12, 16);
  if (fourCC === 'VP8 ' || fourCC === 'VP8L') {
    if (buf.length < 20) return false;
    const declaredLen = buf.readUInt32LE(16);
    const headerBytes = fourCC === 'VP8 ' ? 10 : 5; // VP8: 3(frame tag)+3(start code)+4(dims); VP8L: 1(sig)+4(packed dims)
    return declaredLen > headerBytes;
  }
  if (fourCC === 'VP8X') {
    let offset = 12;
    while (offset + 8 <= buf.length) {
      const chunkFourCC = buf.toString('ascii', offset, offset + 4);
      const chunkLen = buf.readUInt32LE(offset + 4);
      if (['VP8 ', 'VP8L', 'ANMF'].includes(chunkFourCC) && chunkLen > 0) return true;
      offset += 8 + chunkLen + (chunkLen % 2); // RIFF sub-chunks are word-aligned
    }
    return false;
  }
  return false;
}

const CONTAINER_VALIDATORS = {
  '.png': pngContainerComplete,
  '.jpg': jpegContainerComplete,
  '.jpeg': jpegContainerComplete,
  '.gif': gifContainerComplete,
  '.webp': webpContainerComplete,
};

// Known magic-byte signatures, checked against the extension a file is
// COMMITTED under. A mismatch (or a signature that fails to match a format
// this checker knows) is a real integrity failure, not a silent skip —
// "extension says X, bytes say Y" is exactly the class of corruption a
// filename-only inventory can never catch.
export function matchesSignature(ext, buf) {
  switch (ext) {
    case '.png': return buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case '.jpg': case '.jpeg': return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case '.gif': return buf.length >= 6 && (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a');
    case '.webp': return buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
    case '.ico': return buf.length >= 4 && buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0;
    case '.svg': return /^\s*(<\?xml|<svg)/i.test(buf.subarray(0, Math.min(buf.length, 256)).toString('utf8'));
    case '.wav': return buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE';
    case '.ogg': return buf.length >= 4 && buf.toString('ascii', 0, 4) === 'OggS';
    case '.mp3': return buf.length >= 3 && (buf.toString('ascii', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0));
    case '.mp4': case '.m4a': return buf.length >= 8 && buf.toString('ascii', 4, 8) === 'ftyp';
    case '.webm': return buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
    case '.ttf': return buf.length >= 4 && (buf.readUInt32BE(0) === 0x00010000 || buf.toString('ascii', 0, 4) === 'true');
    case '.otf': return buf.length >= 4 && buf.toString('ascii', 0, 4) === 'OTTO';
    case '.woff': return buf.length >= 4 && buf.toString('ascii', 0, 4) === 'wOFF';
    case '.woff2': return buf.length >= 4 && buf.toString('ascii', 0, 4) === 'wOF2';
    default: return null; // no known signature to check — not a failure, just not attempted
  }
}

export function rasterDimensions(path, buf) {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  const reader = DIMENSION_READERS[ext];
  return reader ? reader(buf) : null;
}

// Persisted computed facts only — bytes/sha256/width/height, matching the
// contract's data model. Signature/corruption validation is deliberately NOT
// persisted (see integrityIssues below): it is re-derived live every --check
// run directly from the file bytes, so it can never itself go stale.
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

// Live (non-persisted) integrity validation for one buffer of bytes claimed
// to be at `path` with extension `ext`. Pure function of (path, ext, buf) —
// takes no dependency on the file actually being git-tracked or even really
// on disk, so it is directly unit-testable against synthetic malformed
// buffers. Returns an array of human-readable problem strings, empty when
// the buffer is clean.
export function integrityIssuesForBuffer(path, ext, buf) {
  const issues = [];
  if (buf.length === 0) { issues.push('file is zero bytes'); return issues; }
  const sigMatch = matchesSignature(ext, buf);
  if (sigMatch === false) issues.push(`file bytes do not match the "${ext}" signature (corrupt or misnamed)`);
  if (ext in DIMENSION_READERS) {
    if (rasterDimensions(path, buf) === null) {
      issues.push(`raster dimensions could not be read from a "${ext}" file (corrupt or truncated)`);
    } else if (ext in CONTAINER_VALIDATORS && !CONTAINER_VALIDATORS[ext](buf)) {
      issues.push(`"${ext}" file container is incomplete or truncated (header and dimensions read cleanly, but the file body/trailer is missing)`);
    }
  }
  return issues;
}

// Thin disk-reading wrapper used by the CLI's --check path.
function integrityIssues(path, ext) {
  let buf;
  try { buf = readFileSync(join(ROOT, path)); } catch (e) { return [`cannot read file: ${e.message}`]; }
  return integrityIssuesForBuffer(path, ext, buf);
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
    name: 'farm-iso-terrain',
    test: p => /^assets\/iso\/terrain\/(?:path|soil|water)-(?:0[0-9]|1[0-5])\.png$/.test(p)
      || /^assets\/iso\/terrain\/grass-base-(?:path|soil|water)\.png$/.test(p),
    classify: () => ({
      domain: 'farm-iso-terrain', scope: 'runtime', status: 'provisional', visualReview: 'intentional-interim-gap',
      governedBy: 'docs/ai-team/STEP8_ENVART_CONTRACT_20260804.md',
      notes: 'Farm ground Pass 1 terrain; native 64x48 sprites with 64x32 top-face diamonds. Required runtime files have exact slicer/provenance and fallback gates; final visual review remains a non-author gate.',
    }),
  },
  {
    name: 'iso-npc-source-idle',
    test: p => /^docs\/visual\/reviews\/(?:npc-sprite-integration-20260805\/source-rotations\/(?:mira|bram|gunnar)|momo-sprite-integration-20260805\/source-rotations\/momo)\/(?:south|south-east|east|north-east|north|north-west|west|south-west)\.png$/.test(p),
    classify: p => ({
      domain: 'iso-npc-sprite-source', scope: 'source', status: 'provisional', visualReview: 'aligned',
      governedBy: p.startsWith('docs/visual/reviews/momo-sprite-integration-20260805/')
        ? 'docs/visual/reviews/momo-sprite-integration-20260805/README.md'
        : 'docs/visual/reviews/npc-sprite-integration-20260805/README.md',
      notes: 'Canonical retained NPC idle direction source; exact 64x64 crop/translation output with no resampling. Source ZIP custody, character ID, direction mapping, and pixel hashes are recorded in npc-direction-map.json.',
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
    name: 'iso-npc-idle-sprite',
    test: p => /^assets\/iso\/npc\/(?:mira|bram|gunnar|momo)-down-right\.png$/.test(p),
    classify: p => ({
      domain: 'iso-npc-sprite', scope: 'runtime', status: 'provisional', visualReview: 'intentional-interim-gap',
      governedBy: p.endsWith('/momo-down-right.png')
        ? 'docs/visual/reviews/momo-sprite-integration-20260805/README.md'
        : 'docs/visual/reviews/npc-sprite-integration-20260805/README.md',
      notes: 'Lossless crop/translate-only south-facing/down-right idle frame for the stationary Town NPC renderer. The other seven canonical directions are retained as source assets; no facing/state runtime path exists yet. Falls back to the existing procedural NPC shape.',
    }),
  },
  {
    // Mira is explicitly named in docs/CURRENT_STATE.md as a "dedicated
    // placeholder treatment" within Town's intentionally partial isometric
    // scope — classification must say so, not blanket-mark every NPC sprite
    // as finished/aligned production art.
    name: 'npc-mira-sprite',
    test: p => p === 'assets/npc_mira.png',
    classify: () => ({
      domain: 'npc-sprite', scope: 'runtime', status: 'intentional-placeholder', visualReview: 'intentional-interim-gap',
      governedBy: 'docs/CURRENT_STATE.md',
      notes: 'Optional; falls back to a procedurally drawn per-NPC shape if absent. docs/CURRENT_STATE.md records Mira as a "dedicated placeholder treatment" within Town\'s intentionally partial isometric scope, not finished production art.',
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
    // The General Store building is likewise explicitly named in
    // docs/CURRENT_STATE.md as a "dedicated placeholder treatment," distinct
    // from other environment sprites (e.g. the cooking pot) that doc doesn't
    // call out as placeholder.
    name: 'general-store-sprite',
    test: p => p === 'assets/shop_building.png',
    classify: () => ({
      domain: 'environment-sprite', scope: 'runtime', status: 'intentional-placeholder', visualReview: 'intentional-interim-gap',
      governedBy: 'docs/CURRENT_STATE.md',
      notes: 'Optional; falls back to HOUSE/DOOR tile rendering if absent. docs/CURRENT_STATE.md records the General Store as a "dedicated placeholder treatment" within Town\'s intentionally partial isometric scope, not finished production art.',
    }),
  },
  {
    name: 'environment-sprite',
    test: p => p === 'assets/cookpot.png',
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
    name: 'terrain-cell-legend',
    test: p => /^docs\/visual\/terrain-legend\/(?:path|soil|water)-contact-sheet\.png$/.test(p),
    classify: () => ({
      domain: 'terrain-cell-legend', scope: 'evidence', status: 'provisional', visualReview: 'not-applicable',
      governedBy: 'docs/ai-team/TERRAIN_FIX_BRIEF_20260805.md',
      notes: 'Gutter-aware vendor-order contact sheet for the human Leo plus ChatGPT legend-verification gate; source-only evidence, no mask or topology inference, not loaded by runtime code.',
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

// Every binding declares a fallbackKind, in addition to the free-text
// `fallback` field, so "what happens if this is missing" is machine-checkable
// rather than only human-readable prose:
//   asset-chain      — the engine substitutes ANOTHER declared binding, named
//                       in fallbackChain (in the real precedence order the
//                       drawing code actually tries them). Validated: every
//                       chain entry must be a real binding key, and the chain
//                       must terminate in a required (guaranteed-present)
//                       binding or a non-asset-chain kind — never a dead end.
//   engine-drawn      — a procedural/canvas-drawn substitute, no asset involved.
//   css-fallback      — a declared CSS fallback (background-color, etc.).
//   silent            — absence is inaudible/invisible; nothing draws or plays.
//   none              — no substitute; the layer/element is simply absent.
//   not-applicable    — this binding is registered but never actually queried
//                       by any live code path (dead declaration, not a gap).
//   context-dependent — the substitute depends on map/game state the manifest
//                       can't express as one static key (documented in prose).
const FALLBACK_KINDS = [
  'asset-chain', 'engine-drawn', 'css-fallback', 'silent', 'none', 'not-applicable', 'context-dependent',
];

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
        fallbackKind: 'asset-chain', fallbackChain: ['player'],
        use: { profile, direction: dir },
      });
      push({
        key: `player_walk_${profile}_${dir}`, family: 'hero-walk',
        path: tpl('assets/{p}-{d}-walk.png', { p: profile, d: dir }),
        owner: 'js/02-data-state.js (loadSprite loop)', required: true,
        fallback: 'static hero sprite for that direction (no walk animation)',
        fallbackKind: 'asset-chain', fallbackChain: [tpl('player_{p}_{d}', { p: profile, d: dir })],
        use: { profile, direction: dir },
      });
    }
    for (const dir of OVERLAY_DIRECTIONS) {
      // Verified against js/09-main.js draw(): playerImg = playerAttackImg ||
      // playerWalkImg || playerSprite() — attack falls back to walk, then to
      // static, then (inside playerSprite()) to the legacy 'player' sprite.
      push({
        key: `player_attack_${profile}_${dir}`, family: 'hero-attack',
        path: tpl('assets/{p}-{d}-attack.png', { p: profile, d: dir }),
        owner: 'js/02-data-state.js (loadSprite loop)', required: false,
        fallback: 'walk hero sprite for that direction, then the static hero sprite (no attack animation)',
        fallbackKind: 'asset-chain',
        fallbackChain: [tpl('player_walk_{p}_{d}', { p: profile, d: dir }), tpl('player_{p}_{d}', { p: profile, d: dir })],
        use: { profile, direction: dir },
      });
      for (const slot of EQUIPMENT_SLOTS) {
        push({
          key: `equipment_${profile}_${dir}_${slot}`, family: 'equipment-overlay-static',
          path: tpl('assets/{p}-{d}-{s}.png', { p: profile, d: dir, s: slot }),
          owner: 'js/02-data-state.js (loadSprite loop)', required: false,
          fallback: 'no extra progression-tier gear layer for that slot — the base hero already carries its own permanent canonical identity clothing/props, it does not render bare',
          fallbackKind: 'none',
          use: { profile, direction: dir, slot },
        });
        push({
          key: `equipment_walk_${profile}_${dir}_${slot}`, family: 'equipment-overlay-walk',
          path: tpl('assets/{p}-{d}-{s}-walk.png', { p: profile, d: dir, s: slot }),
          owner: 'js/02-data-state.js (loadSprite loop)', required: false,
          fallback: 'static equipment overlay for that slot',
          fallbackKind: 'asset-chain',
          fallbackChain: [tpl('equipment_{p}_{d}_{s}', { p: profile, d: dir, s: slot })],
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
        //
        // For body/head/weapon: verified against draw()'s `if (spriteMode ===
        // 'attack') { ... } else if (profilePlayerImg) { ...walk/static... }`
        // branch structure — the walk/static substitute ONLY runs in the ELSE
        // branch (not attacking). While actually attacking, a missing overlay
        // for body/head/weapon draws NOTHING for that slot that frame; it does
        // NOT fall back to the walk or static overlay. (An earlier version of
        // this manifest's fallback text claimed a walk/static substitute here —
        // that claim did not match the real drawing code and has been corrected.)
        push({
          key: `equipment_attack_${profile}_${dir}_${slot}`, family: 'equipment-overlay-attack',
          path: tpl('assets/{p}-{d}-{s}-attack.png', { p: profile, d: dir, s: slot }),
          owner: 'js/02-data-state.js (loadSprite loop)', required: false,
          fallback: slot === 'cape'
            ? 'never drawn — draw() never calls equipmentAttackSprite(\'cape\'); this registered SPRITES entry has no visible effect regardless of load state'
            : 'no substitute is drawn for that slot during the attack animation frames — the base hero, cape, and any other resolved equipment layers still render normally; this slot\'s overlay is simply absent for those frames',
          fallbackKind: slot === 'cape' ? 'not-applicable' : 'none',
          use: { profile, direction: dir, slot },
        });
      }
    }
    push({
      key: `title_portrait_${profile}`, family: 'title-portrait',
      path: tpl('assets/{p}-down-right.png', { p: profile }),
      owner: 'index.html title screen + js/02-data-state.js HERO_IDENTITIES', required: true,
      fallback: 'none designed — plain <img>, browser broken-image icon if absent',
      fallbackKind: 'none',
      use: { profile },
    });
    push({
      key: `paperdoll_base_${profile}`, family: 'character-paperdoll',
      path: tpl('assets/{p}-right.png', { p: profile }),
      owner: 'js/10-character.js renderPaperDoll()', required: true,
      fallback: 'none designed — img.onerror hides just that layer',
      fallbackKind: 'none',
      use: { profile },
    });
    for (const slot of EQUIPMENT_SLOTS) {
      push({
        key: `paperdoll_${slot}_${profile}`, family: 'character-paperdoll',
        path: tpl('assets/{p}-right-{s}.png', { p: profile, s: slot }),
        owner: 'js/10-character.js renderPaperDoll()', required: false,
        fallback: 'img.onerror hides just that overlay layer; base hero stays visible',
        fallbackKind: 'none',
        use: { profile, slot },
      });
    }
  }

  // The registered SPRITES key is 'tile_' + the NUMERIC tile-type constant
  // (js/02-data-state.js: `for (var ts in TILE_SPRITE) loadSprite('tile_' + ts, ...)`
  // where TILE_SPRITE's own keys are the GRASS=0/WATER=1/... constants) — NOT
  // the human-readable tile name. Verified against source: an earlier draft
  // declared `tile_grass` etc, which the live cross-check (test 26) proved
  // never matches any real SPRITES key.
  const TILE_IDS = { grass: 0, water: 1, tree: 2, soil: 3, path: 4, house: 5, door: 6, exit: 7, rock: 8, 'cave-floor': 9 };
  const TILE_REQUIRED = { grass: true, water: true, tree: true, soil: true, path: true, house: true, door: true, exit: true, rock: false, 'cave-floor': false };
  const TILE_FILE = { grass: 'grass', water: 'water', tree: 'tree', soil: 'soil', path: 'path', house: 'house', door: 'door', exit: 'exit', rock: 'rock', 'cave-floor': 'cave-floor' };
  for (const [tile, required] of Object.entries(TILE_REQUIRED)) {
    push({
      key: `tile_${TILE_IDS[tile]}`, family: 'tile-sprite',
      path: `assets/${TILE_FILE[tile]}.png`,
      owner: 'js/02-data-state.js TILE_SPRITE', required,
      fallback: required ? 'flat TILE_COLOR fill' : 'procedurally drawn cavern detailing (ROCK/CAVE) — the real Mine art is not yet produced',
      fallbackKind: 'engine-drawn',
      use: { tile, tileTypeId: TILE_IDS[tile] },
    });
  }
  for (const variant of ['grass2', 'grass3']) {
    // Verified against js/09-main.js: `ctx.drawImage(gv || tileImg, ...)` where
    // tileImg is spr('tile_0') (base grass) — a genuine asset-chain, not a
    // procedural substitute.
    push({ key: variant, family: 'tile-decoration-variant', path: `assets/${variant}.png`,
      owner: 'js/02-data-state.js + js/09-main.js grass-variety draw', required: false,
      fallback: 'base grass tile', fallbackKind: 'asset-chain', fallbackChain: ['tile_0'], use: {} });
  }
  for (const [key, path] of Object.entries({
    deco_flowers: 'flowers', deco_boulder: 'boulder', deco_stump: 'tree_stump', deco_stone: 'stone',
  })) {
    push({ key, family: 'decoration-sprite', path: `assets/${path}.png`,
      owner: 'js/09-main.js drawProcDeco()', required: false,
      fallback: 'procedurally drawn decoration shape', fallbackKind: 'engine-drawn', use: {} });
  }
  for (const key of ['crop_growing', 'crop_ready']) {
    push({ key, family: 'crop-sprite', path: `assets/${key}.png`,
      owner: 'js/02-data-state.js + js/09-main.js', required: false,
      fallback: 'procedurally drawn colored crop shape', fallbackKind: 'engine-drawn', use: {} });
  }
  for (const crop of ['turnip', 'carrot', 'corn', 'pumpkin', 'starfruit']) {
    push({ key: `iso_crop_${crop}`, family: 'crop-iso-strip', path: `assets/iso/crop-${crop}.png`,
      owner: 'js/02-data-state.js + js/08-iso-renderer.js', required: false,
      fallback: 'deterministic canvas crop proof', fallbackKind: 'engine-drawn', use: { crop } });
  }
  for (const family of ['path', 'soil', 'water']) {
    for (let mask = 0; mask < 16; mask++) {
      const suffix = String(mask).padStart(2, '0');
      push({
        key: `iso_terrain_${family}_${suffix}`,
        family: 'farm-iso-terrain-transition',
        path: `assets/iso/terrain/${family}-${suffix}.png`,
        owner: 'js/02-data-state.js + js/08-iso-renderer.js Farm ground Pass 1',
        required: true,
        fallback: family === 'soil' ? 'drawIsoSoilTile' : 'drawIsoTileDiamond with TILE_COLOR',
        fallbackKind: 'engine-drawn',
        use: { terrainFamily: family, mask, renderLayer: 'Farm ground Pass 1' },
      });
    }
    push({
      key: `iso_terrain_grass_base_${family}`,
      family: 'farm-iso-terrain-grass-base',
      path: `assets/iso/terrain/grass-base-${family}.png`,
      owner: 'js/02-data-state.js + js/08-iso-renderer.js Farm ground Pass 1',
      required: true,
      fallback: 'drawIsoTileDiamond with TILE_COLOR',
      fallbackKind: 'engine-drawn',
      use: { terrainFamily: 'grass', sourceVariant: family, renderLayer: 'Farm ground Pass 1' },
    });
  }
  for (const type of ['slime', 'bat', 'goblin', 'wolf', 'bear', 'troll', 'rock_golem', 'magma_slug', 'crystal_wyrm', 'shadow_warden']) {
    push({ key: `enemy_${type}`, family: 'enemy-sprite', path: `assets/enemy_${type}.png`,
      owner: 'js/02-data-state.js + js/09-main.js drawEnemyShape()', required: false,
      fallback: 'procedurally drawn per-type enemy shape', fallbackKind: 'engine-drawn', use: { enemyType: type } });
  }
  for (const entry of [
    { id: 'mira', asset: 'mira' }, { id: 'bram', asset: 'bram' },
    { id: 'gunnar', asset: 'gunnar' }, { id: 'dumpling_vendor', asset: 'momo' }
  ]) {
    push({ key: `iso_npc_${entry.id}_down_right`, family: 'iso-npc-sprite', path: `assets/iso/npc/${entry.asset}-down-right.png`,
      owner: 'js/02-data-state.js + js/08-iso-renderer.js drawIsoNpc()', required: false,
      fallback: 'existing procedural drawIsoNpc body/head shape', fallbackKind: 'engine-drawn',
      use: { npcId: entry.id, assetId: entry.asset, direction: 'down-right', state: 'idle', renderMode: 'iso' } });
  }
  // Verified against js/02-data-state.js: only 'npc_mira' has an actual
  // loadSprite() registration. bram/gunnar/dumpling_vendor have NO
  // registration anywhere — js/09-main.js's draw loop still calls
  // spr('npc_' + npc.id) for all four, but spr() looks up SPRITES[name],
  // which is simply never created for these three. Committing a file at
  // these three paths today would have NO effect until a source change adds
  // the missing loadSprite() call — that is a real behavior change, out of
  // scope for this governance-only tool, so it is documented here rather
  // than silently assumed.
  for (const id of ['mira', 'bram', 'gunnar', 'dumpling_vendor']) {
    const wired = id === 'mira';
    push({ key: `npc_${id}`, family: 'npc-sprite', path: `assets/npc_${id}.png`,
      owner: 'js/09-main.js NPC draw loop + drawNpcShape()', required: false,
      fallback: wired
        ? 'procedurally drawn per-NPC shape'
        : 'always procedurally drawn — no loadSprite() call registers this key yet, so spr() always returns null regardless of whether a file is committed at this path',
      fallbackKind: 'engine-drawn', use: { npcId: id } });
  }
  push({ key: 'cookpot', family: 'environment-sprite', path: 'assets/cookpot.png',
    owner: 'js/02-data-state.js + js/09-main.js', required: false,
    fallback: 'procedurally drawn cooking-pot shape', fallbackKind: 'engine-drawn', use: {} });
  // Depends on which tile the map cell actually is (HOUSE or DOOR) — not a
  // single static asset key, so this is documented in prose rather than a
  // fallbackChain. Verified against js/09-main.js: `if ((tileType === HOUSE ||
  // tileType === DOOR) && currentArea === 'town' && spr('shop_building'))
  // continue;` — absent shop_building simply lets the normal tile draw run.
  push({ key: 'shop_building', family: 'environment-sprite', path: 'assets/shop_building.png',
    owner: 'js/02-data-state.js + js/09-main.js', required: false,
    fallback: 'HOUSE/DOOR tile fallback rendering (whichever the map cell actually is)',
    fallbackKind: 'context-dependent', use: {} });
  // Verified against js/02-data-state.js: no loadSprite('forge_building', ...)
  // call exists anywhere. js/09-main.js's spr('forge_building') therefore
  // always returns null — committing a file at this path today has no
  // effect until a source change adds the missing registration.
  push({ key: 'forge_building', family: 'environment-sprite', path: 'assets/forge_building.png',
    owner: 'js/09-main.js (spr(\'forge_building\') call site)', required: false,
    fallback: 'always procedurally drawn (stone building with a "FORGE" text label) — no loadSprite() call registers this key yet, so spr() always returns null regardless of whether a file is committed at this path; Gunnar\'s forge has no gameplay behind it yet',
    fallbackKind: 'engine-drawn', use: {} });
  push({ key: 'title_logo', family: 'ui-title', path: 'assets/title-logo.png',
    owner: 'index.html title screen', required: true, fallback: 'none designed', fallbackKind: 'none', use: {} });
  push({ key: 'title_bg', family: 'ui-title', path: 'assets/title-bg.png',
    owner: 'eldoria.css .title-overlay', required: true,
    fallback: 'CSS solid background-color (#1a1208)', fallbackKind: 'css-fallback', use: {} });
  push({ key: 'music_town', family: 'audio-music', path: 'assets/music-town.mp3',
    owner: 'js/02-data-state.js bgMusic', required: false,
    fallback: 'silent — Audio() has no onerror handling, game is unaffected', fallbackKind: 'silent', use: {} });
  push({ key: 'player', family: 'legacy-fallback', path: 'assets/player.png',
    owner: 'js/02-data-state.js loadSprite + playerSprite() fallback chain', required: false,
    fallback: 'a colored placeholder box with a directional nose triangle', fallbackKind: 'engine-drawn', use: {} });

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
      // notes is rule-generated boilerplate by default, so a --write that
      // updates a classification rule's wording must propagate to every
      // asset that rule governs. A human who deliberately customizes a note
      // beyond the rule's default sets notesLocked: true to opt that one
      // entry out of future regeneration; everything else always reflects
      // the CURRENT rule, never a stale prior run's text.
      notes: prior?.notesLocked ? prior.notes : cls.notes,
      notesLocked: prior?.notesLocked ?? false,
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

// A manifest that TRULY does not exist yet (ENOENT — first-time bootstrap,
// nothing to lose) is a fundamentally different situation from one that
// EXISTS but fails to parse (corruption — a bad merge, truncated write, or
// accidental edit). Conflating them under a single "return null" made
// --write treat a corrupted manifest exactly like a fresh bootstrap: every
// asset would look "newly discovered," silently skipping notesLocked
// preservation and the --accept-new review gate for all of them at once.
// Only ENOENT is auto-bootstrapped; a parse failure is refused unless the
// caller explicitly opts in with --recover-malformed-manifest.
class MalformedManifestError extends Error {}

function readExistingManifest() {
  let raw;
  try {
    raw = readFileSync(MANIFEST_PATH, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null; // no manifest yet — legitimate first-run bootstrap
    throw e;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    if (RECOVER_MALFORMED) return null; // explicit opt-in: discard and rebuild from scratch
    throw new MalformedManifestError(
      `${MANIFEST_PATH} exists but is not valid JSON (${e.message}). Refusing to silently rebuild it ` +
      `from scratch, since that would skip existing-path safeguards (notesLocked preservation, ` +
      `--accept-new gating) for every asset at once. Restore the file from git history, or re-run ` +
      `with --recover-malformed-manifest to intentionally discard it and bootstrap a fresh manifest.`
    );
  }
}

function readExistingManifestOrExit(mode) {
  try {
    return readExistingManifest();
  } catch (e) {
    if (e instanceof MalformedManifestError) {
      console.error(`asset-manifest ${mode}: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}

function runWrite() {
  const existing = readExistingManifestOrExit('--write');
  const { manifest, unclassified } = buildCanonicalManifest(existing);
  if (unclassified.length) {
    console.error(`asset-manifest --write: ${unclassified.length} tracked media file(s) match no classification rule:`);
    for (const p of unclassified) console.error(`  ${p}`);
    console.error('Add a classification rule (with human-reviewed scope/domain/status/notes) before writing.');
    process.exit(1);
  }

  // A path matching a classification rule is eligible to be inventoried — it
  // is NOT automatically approved for entry. Per the contract, every path the
  // stored manifest has never seen before must stop for an explicit human
  // decision, regardless of how confidently a rule classifies it. Recomputing
  // mechanical facts for ALREADY-KNOWN files never requires this — only the
  // first time a path appears.
  if (existing) {
    const existingPaths = new Set(existing.assets.map(a => a.path));
    const newlyDiscovered = manifest.assets.filter(a => !existingPaths.has(a.path));
    if (newlyDiscovered.length && !ACCEPT_NEW) {
      console.error(`asset-manifest --write: ${newlyDiscovered.length} newly tracked file(s) are not yet in the manifest:`);
      for (const a of newlyDiscovered) console.error(`  ${a.path}  (would classify as: ${a.domain}, ${a.scope}, ${a.status})`);
      console.error('Review the proposed classification above, then re-run with --write --accept-new to add them.');
      process.exit(1);
    }
  }

  writeFileSync(MANIFEST_PATH, canonicalJSON(manifest));
  console.log(`Wrote ${MANIFEST_PATH}: ${manifest.assets.length} assets, ${manifest.runtimeBindings.length} runtime bindings.`);
}

function deepEqualCanonical(a, b) {
  return canonicalJSON(a) === canonicalJSON(b);
}

function runCheck() {
  const existing = readExistingManifestOrExit('--check');
  if (!existing) {
    console.error(`asset-manifest --check: ${MANIFEST_PATH} is missing. Run --write first.`);
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

  // A committed runtime binding must resolve to an asset actually classified
  // scope:"runtime" — otherwise the manifest could point live game code at a
  // source/reference/evidence file (or a path with no asset entry at all)
  // without ever being told so.
  const assetByPath = new Map(manifest.assets.map(a => [a.path, a]));
  for (const b of manifest.runtimeBindings) {
    if (!b.committed) continue;
    const asset = assetByPath.get(b.path);
    if (!asset) errors.push(`runtime binding "${b.key}" is committed but has no manifest asset entry at ${b.path}`);
    else if (asset.scope !== 'runtime') errors.push(`runtime binding "${b.key}" points at ${b.path}, which is classified scope:"${asset.scope}" (expected "runtime")`);
  }

  // Structured fallback validation: a free-text `fallback` string is not
  // machine-checkable. `fallbackKind` says WHAT KIND of substitute exists;
  // for "asset-chain" kinds, `fallbackChain` names the other bindings the
  // real drawing code tries, in order, verified to (a) all be real declared
  // keys and (b) actually terminate somewhere guaranteed to be present,
  // rather than silently dead-ending.
  const bindingsByKey = new Map(manifest.runtimeBindings.map(b => [b.key, b]));
  function chainTerminatesSafely(binding, seen) {
    if (binding.fallbackKind !== 'asset-chain') return true;
    if (seen.has(binding.key)) return false; // cycle
    const chain = binding.fallbackChain || [];
    if (!chain.length) return false;
    const last = bindingsByKey.get(chain[chain.length - 1]);
    if (!last) return false; // unresolved key, reported separately below
    if (last.required) return true;
    return chainTerminatesSafely(last, new Set(seen).add(binding.key));
  }
  for (const b of manifest.runtimeBindings) {
    if (!FALLBACK_KINDS.includes(b.fallbackKind)) {
      errors.push(`runtime binding "${b.key}": unknown fallbackKind "${b.fallbackKind}"`);
      continue;
    }
    if (b.fallbackKind === 'asset-chain') {
      const chain = b.fallbackChain || [];
      if (!chain.length) errors.push(`runtime binding "${b.key}": fallbackKind is "asset-chain" but fallbackChain is empty`);
      const allKeysResolve = chain.every(k => {
        const ok = bindingsByKey.has(k);
        if (!ok) errors.push(`runtime binding "${b.key}": fallbackChain references undeclared key "${k}"`);
        return ok;
      });
      if (chain.length && allKeysResolve && !chainTerminatesSafely(b, new Set())) {
        errors.push(`runtime binding "${b.key}": fallbackChain does not terminate in a required (guaranteed-present) binding or a non-asset-chain fallback`);
      }
    } else if (b.fallbackChain) {
      errors.push(`runtime binding "${b.key}": fallbackChain is only valid when fallbackKind is "asset-chain"`);
    }
  }

  // Live file integrity: re-derived directly from bytes on every run, never
  // trusted from the manifest itself, so a corrupted or misnamed file cannot
  // hide behind mechanical facts that happen to still look plausible.
  for (const a of manifest.assets) {
    for (const issue of integrityIssues(a.path, a.ext)) errors.push(`${a.path}: ${issue}`);
  }

  if (errors.length) {
    console.error(`asset-manifest --check: ${errors.length} problem(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`asset-manifest --check: OK (${manifest.assets.length} assets, ${manifest.runtimeBindings.length} runtime bindings).`);
}

function runReport() {
  const existing = readExistingManifestOrExit('--report');
  if (!existing) {
    console.error('asset-manifest --report: no manifest to report on. Run --write first.');
    process.exit(1);
  }
  const { manifest } = buildCanonicalManifest(existing);
  const by = (arr, field) => arr.reduce((acc, x) => { acc[x[field]] = (acc[x[field]] || 0) + 1; return acc; }, {});
  const requiredMissing = manifest.runtimeBindings.filter(b => b.required && !b.committed);
  const optionalMissing = manifest.runtimeBindings.filter(b => !b.required && !b.committed);
  const boundPaths = new Set(manifest.runtimeBindings.map(b => b.path));
  const unknownProvenance = manifest.assets.filter(a => a.provenance === 'unknown');
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
    unknownProvenanceCount: unknownProvenance.length,
    unknownProvenanceEntries: unknownProvenance.map(a => a.path),
    // Every committed RUNTIME-scoped file that no declared runtime binding
    // actually points at — the manifest's own answer to "is this file used
    // by the game at all?" Scoped to scope:"runtime" specifically: source
    // art, North Star references, playtest evidence, and other non-runtime
    // scopes are never bound by design (they aren't game assets), so
    // including them here would make every single one look "unused" and bury
    // the signal this field exists for. Distinct from expectedMissingOptionalSlots
    // (which describes bindings with no file), this describes FILES with no binding.
    unusedCommittedRuntimeCandidates: manifest.assets
      .filter(a => a.scope === 'runtime' && !boundPaths.has(a.path))
      .map(a => a.path),
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
