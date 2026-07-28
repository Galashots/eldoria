import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FILES = [
  'art/source/characters/ranger-four-facing-source-v001.png',
  'art/ranger-proof/normalized/adventurer-right.png',
  'art/ranger-proof/normalized/adventurer-down.png',
  'art/ranger-proof/normalized/adventurer-left.png',
  'art/ranger-proof/normalized/adventurer-up.png',
  'art/ranger-proof/normalized/adventurer-right-walk.png',
  'docs/visual/experiments/ranger-character-proof/candidate-v1/four-facing-contact-sheet.png',
  'docs/visual/experiments/ranger-character-proof/walk-v1/walk-strip-preview.png',
];

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePng(buffer, file) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 20 || !buffer.subarray(0, 8).equals(signature)) throw new Error(`${file}: invalid PNG signature`);
  let offset = 8;
  const chunkTypes = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataEnd = offset + 8 + length;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > buffer.length) throw new Error(`${file}: truncated ${buffer.toString('ascii', typeStart, typeStart + 4)} chunk`);
    const type = buffer.toString('ascii', typeStart, typeStart + 4);
    const stored = buffer.readUInt32BE(dataEnd);
    const calculated = crc32(buffer.subarray(typeStart, dataEnd));
    if (stored !== calculated) throw new Error(`${file}: bad ${type} CRC (stored ${stored.toString(16)}, calculated ${calculated.toString(16)})`);
    chunkTypes.push(type);
    offset = chunkEnd;
    if (type === 'IEND') break;
  }
  if (!chunkTypes.includes('IHDR') || !chunkTypes.includes('IDAT') || chunkTypes.at(-1) !== 'IEND') {
    throw new Error(`${file}: incomplete PNG chunk sequence`);
  }
  if (offset !== buffer.length) throw new Error(`${file}: unexpected trailing or truncated bytes`);
}

for (const file of FILES) validatePng(await readFile(path.join(ROOT, file)), file);
console.log(`Committed Ranger PNG integrity passed (${FILES.length} files)`);
