// Visual evidence for the ELD-PT-013 compliance work.
// Run: node tools/dumpling-compliance-capture.mjs
import { launch } from './smoke-test.mjs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('../docs/playtest/2026-08-05-dumpling-compliance/', import.meta.url));
await mkdir(dir, { recursive: true });

const shots = [
  { name: 'stall-desktop', width: 1363, height: 936, state: 'fresh' },
  { name: 'stall-ipad-landscape', width: 1180, height: 820, state: 'fresh' },
  { name: 'stall-phone-portrait', width: 390, height: 780, state: 'fresh' },
  { name: 'dough-ready-ipad', width: 1180, height: 820, state: 'dough' },
  { name: 'dough-picking-ipad', width: 1180, height: 820, state: 'picking' },
  { name: 'dough-picking-phone', width: 390, height: 780, state: 'picking' }
];

for (const shot of shots) {
  const { browser, page } = await launch();
  await page.setViewport({ width: shot.width, height: shot.height, deviceScaleFactor: 2 });
  await page.evaluate(state => {
    selectProfile('adventurer');
    player.gold = 260;
    if (state !== 'fresh') {
      player.dumplingDough = DUMPLING_DOUGH_PER_PICK;
      player.dumplings = { plain_bun: 2, rice_ball: 1, custard_bao: 1 };
    }
    openDumplingVendor();
    if (state === 'picking') openDoughPicker();
  }, shot.state);
  await page.screenshot({ path: join(dir, shot.name + '.png') });
  console.log('captured ' + shot.name);
  await browser.close();
}
